import { Subtask, Task, AuditLog } from '@server/models/index.js';
import { requireAuth, type GraphQLContext } from '@server/utils/auth.js';
import { ValidationError, NotFoundError } from '@server/utils/errors.js';
import { sanitizeInput } from '@server/utils/validators.js';

export const subtaskResolvers = {
  Query: {
    subtasks: async (
      _parent: unknown,
      args: { taskId: string },
      context: GraphQLContext,
    ) => {
      requireAuth(context);
      return Subtask.find({ taskId: args.taskId }).sort({ createdAt: 1 });
    },
  },

  Mutation: {
    createSubtask: async (
      _parent: unknown,
      args: { taskId: string; title: string; completed?: boolean },
      context: GraphQLContext,
    ) => {
      const user = requireAuth(context);

      const task = await Task.findById(args.taskId);
      if (!task) {
        throw new NotFoundError('Task not found');
      }

      const title = sanitizeInput(args.title);
      if (!title.trim()) {
        throw new ValidationError('Subtask title is required');
      }

      const subtask = await Subtask.create({
        taskId: args.taskId,
        title,
        completed: args.completed ?? false,
      });

      await AuditLog.create({
        taskId: args.taskId,
        userId: user.id,
        action: 'subtask_created',
        userName: user.username,
        changes: `Created subtask: "${title}"`,
      });

      return subtask;
    },

    updateSubtask: async (
      _parent: unknown,
      args: { id: string; title?: string; completed?: boolean },
      context: GraphQLContext,
    ) => {
      const user = requireAuth(context);

      const subtask = await Subtask.findById(args.id);
      if (!subtask) {
        throw new NotFoundError('Subtask not found');
      }

      const updates: Record<string, unknown> = {};
      const changeDetails: string[] = [];

      if (args.title !== undefined) {
        const title = sanitizeInput(args.title);
        if (!title.trim()) {
          throw new ValidationError('Subtask title is required');
        }
        updates.title = title;
        changeDetails.push(`title → "${title}"`);
      }

      if (args.completed !== undefined) {
        updates.completed = args.completed;
        changeDetails.push(`completed → ${args.completed}`);
      }

      const updated = await Subtask.findByIdAndUpdate(args.id, updates, { new: true });

      await AuditLog.create({
        taskId: subtask.taskId,
        userId: user.id,
        action: 'subtask_updated',
        userName: user.username,
        changes: changeDetails.join(', '),
      });

      return updated;
    },

    deleteSubtask: async (
      _parent: unknown,
      args: { id: string },
      context: GraphQLContext,
    ) => {
      const user = requireAuth(context);

      const subtask = await Subtask.findById(args.id);
      if (!subtask) {
        throw new NotFoundError('Subtask not found');
      }

      await Subtask.findByIdAndDelete(args.id);

      await AuditLog.create({
        taskId: subtask.taskId,
        userId: user.id,
        action: 'subtask_deleted',
        userName: user.username,
        changes: `Deleted subtask: "${subtask.title}"`,
      });

      return true;
    },
  },
};
