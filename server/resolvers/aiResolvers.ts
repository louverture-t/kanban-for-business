import { Task, AuditLog, Notification } from '@server/models/index.js';
import {
  requireManagerOrAbove,
  requireProjectAccess,
  type GraphQLContext,
  type TokenPayload,
} from '@server/utils/auth.js';
import { ValidationError, NotFoundError } from '@server/utils/errors.js';
import { OPENROUTER_API_KEY, NODE_ENV } from '@server/config/connection.js';

// --- Rate limiting: in-memory per-user AI call tracker ---
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = NODE_ENV === 'production' ? 10 : 1_000;

function checkRateLimit(userId: string): void {
  const now = Date.now();
  const timestamps = rateLimitMap.get(userId) ?? [];

  // Prune timestamps older than 1 hour
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW);

  if (recent.length >= RATE_LIMIT_MAX) {
    rateLimitMap.set(userId, recent);
    throw new ValidationError('AI rate limit exceeded: 10 requests per hour');
  }

  recent.push(now);
  rateLimitMap.set(userId, recent);
}

// --- OpenRouter helper ---
interface OpenRouterMessage {
  role: 'system' | 'user';
  content: string;
}

async function callOpenRouter(messages: OpenRouterMessage[]): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new ValidationError(`AI service error: ${errorText}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;

  if (!content) {
    throw new ValidationError('AI service returned an empty response');
  }

  return content;
}

function parseJsonFromResponse<T>(raw: string): T {
  // Strip markdown code fences if present
  const cleaned = raw.replace(/```(?:json)?\s*/g, '').replace(/```\s*/g, '').trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new ValidationError('AI returned invalid JSON — please try again');
  }
}

// --- Resolvers ---
export interface TaskPreview {
  title: string;
  description?: string;
  priority?: 'high' | 'medium' | 'low';
  dueDate?: string;
  assigneeId?: string;
}

export interface TaskPreviewInput {
  title: string;
  description?: string;
  priority?: 'high' | 'medium' | 'low';
  dueDate?: string;
  assigneeId?: string;
}

export const aiResolvers = {
  Mutation: {
    aiDecompose: async (
      _parent: unknown,
      args: { projectId: string; text: string },
      context: GraphQLContext,
    ): Promise<TaskPreview[]> => {
      requireManagerOrAbove(context);
      await requireProjectAccess(context, args.projectId);
      checkRateLimit(context.user!.id);

      const raw = await callOpenRouter([
        {
          role: 'system',
          content:
            'You are a project management assistant. Decompose the given text into actionable tasks. IMPORTANT: Strip any patient health information (PHI) - no names, DOB, MRN, or identifiers. Return a JSON array of objects with fields: title (string, required), description (string, optional), priority (\'high\'|\'medium\'|\'low\', optional), dueDate (ISO string, optional).',
        },
        { role: 'user', content: args.text },
      ]);

      return parseJsonFromResponse<TaskPreview[]>(raw);
    },

    aiConfirmDecomposition: async (
      _parent: unknown,
      args: { projectId: string; tasks: TaskPreviewInput[] },
      context: GraphQLContext,
    ) => {
      requireManagerOrAbove(context);
      await requireProjectAccess(context, args.projectId);

      const userId = context.user!.id;

      // Determine starting position
      const lastTask = await Task.findOne({ projectId: args.projectId })
        .sort({ position: -1 })
        .select('position')
        .lean();
      let nextPosition = (lastTask?.position ?? -1) + 1;

      const createdTasks = [];

      for (const preview of args.tasks) {
        const task = await Task.create({
          projectId: args.projectId,
          title: preview.title,
          description: preview.description,
          priority: preview.priority || 'medium',
          dueDate: preview.dueDate ? new Date(preview.dueDate) : undefined,
          assigneeId: preview.assigneeId || undefined,
          status: 'backlog',
          position: nextPosition++,
          createdBy: userId,
        });

        await AuditLog.create({
          userId,
          action: 'CREATE',
          userName: context.user!.username,
          taskId: task._id,
          changes: JSON.stringify({ source: 'ai-decompose', title: task.title }),
        });

        createdTasks.push(task);
      }

      await Notification.create({
        userId,
        type: 'ai_complete',
        content: `AI created ${createdTasks.length} task${createdTasks.length === 1 ? '' : 's'} successfully`,
      });

      return createdTasks;
    },

    aiGenerateSubtasks: async (
      _parent: unknown,
      args: { taskId: string },
      context: GraphQLContext,
    ): Promise<string[]> => {
      requireManagerOrAbove(context);
      checkRateLimit(context.user!.id);

      const task = await Task.findById(args.taskId);
      if (!task) {
        throw new NotFoundError('Task not found');
      }

      await requireProjectAccess(context, task.projectId.toString());

      const raw = await callOpenRouter([
        {
          role: 'system',
          content:
            'You are a project management assistant. Given a task title and description, suggest 3-5 subtask titles. IMPORTANT: Strip any PHI. Return a JSON array of strings.',
        },
        {
          role: 'user',
          content: `Task: ${task.title}\nDescription: ${task.description || 'No description'}`,
        },
      ]);

      return parseJsonFromResponse<string[]>(raw);
    },
  },
};
