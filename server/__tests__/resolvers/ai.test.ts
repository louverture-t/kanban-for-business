import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { Task, Project, ProjectMember, AuditLog } from '@server/models/index.js';
import { aiResolvers } from '@server/resolvers/aiResolvers.js';
import type { GraphQLContext, TokenPayload } from '@server/utils/auth.js';

// --- Mock fetch globally ---

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// --- Test helpers ---

function mockContext(overrides: { user?: TokenPayload | null } = {}): GraphQLContext {
  return {
    user: overrides.user ?? null,
    req: { ip: '127.0.0.1', cookies: {} } as unknown as GraphQLContext['req'],
    res: { cookie: vi.fn(), clearCookie: vi.fn() } as unknown as GraphQLContext['res'],
  };
}

function managerPayload(id: string): TokenPayload {
  return { id, username: 'manager', role: 'manager' };
}

function userPayload(id: string): TokenPayload {
  return { id, username: 'regular', role: 'user' };
}

function mockOpenRouterResponse(content: unknown) {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      choices: [{ message: { content: JSON.stringify(content) } }],
    }),
  });
}

let projectId: string;
let managerId: mongoose.Types.ObjectId;

const { Mutation } = aiResolvers;

// --- Setup ---

beforeEach(async () => {
  await Task.deleteMany({});
  await Project.deleteMany({});
  await ProjectMember.deleteMany({});
  await AuditLog.deleteMany({});
  mockFetch.mockReset();

  // Create a project and add the manager as a member
  managerId = new mongoose.Types.ObjectId();
  const project = await Project.create({ name: 'Test Project' });
  projectId = String(project._id);

  await ProjectMember.create({
    projectId: project._id,
    userId: managerId,
  });
});

afterEach(() => {
  // Clear the rate-limit map between tests by calling with fresh state
  // The in-memory map persists across tests, so we need to account for that
});

// ─── aiDecompose ────────────────────────────────────────────

describe('aiDecompose mutation', () => {
  it('calls OpenRouter and returns parsed TaskPreview array', async () => {
    const tasks = [
      { title: 'Task 1', priority: 'high' },
      { title: 'Task 2', priority: 'low' },
    ];
    mockOpenRouterResponse(tasks);

    const ctx = mockContext({ user: managerPayload(String(managerId)) });
    const result = await Mutation.aiDecompose(null, { projectId, text: 'Build a feature' }, ctx);

    expect(result).toHaveLength(2);
    expect(result[0].title).toBe('Task 1');
    expect(result[0].priority).toBe('high');
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('requires manager or above role', async () => {
    const regularId = new mongoose.Types.ObjectId();
    const ctx = mockContext({ user: userPayload(String(regularId)) });

    await expect(
      Mutation.aiDecompose(null, { projectId, text: 'something' }, ctx),
    ).rejects.toThrow();
  });

  it('requires project access (membership)', async () => {
    const nonMemberId = new mongoose.Types.ObjectId();
    const ctx = mockContext({ user: managerPayload(String(nonMemberId)) });

    await expect(
      Mutation.aiDecompose(null, { projectId, text: 'something' }, ctx),
    ).rejects.toThrow();
  });
});

// ─── aiConfirmDecomposition ─────────────────────────────────

describe('aiConfirmDecomposition mutation', () => {
  it('creates Task documents in the database', async () => {
    const ctx = mockContext({ user: managerPayload(String(managerId)) });

    const previews = [
      { title: 'Created Task A', priority: 'high' as const },
      { title: 'Created Task B', priority: 'medium' as const },
    ];

    const result = await Mutation.aiConfirmDecomposition(
      null,
      { projectId, tasks: previews },
      ctx,
    );

    expect(result).toHaveLength(2);
    expect(result[0].title).toBe('Created Task A');
    expect(result[1].title).toBe('Created Task B');

    // Verify persisted in DB
    const dbTasks = await Task.find({ projectId });
    expect(dbTasks).toHaveLength(2);
  });

  it('creates AuditLog entries for each task', async () => {
    const ctx = mockContext({ user: managerPayload(String(managerId)) });

    await Mutation.aiConfirmDecomposition(
      null,
      { projectId, tasks: [{ title: 'Audited Task' }] },
      ctx,
    );

    const logs = await AuditLog.find({ action: 'CREATE' });
    expect(logs).toHaveLength(1);
    expect(logs[0].changes).toContain('ai-decompose');
  });

  it('requires manager or above role', async () => {
    const regularId = new mongoose.Types.ObjectId();
    const ctx = mockContext({ user: userPayload(String(regularId)) });

    await expect(
      Mutation.aiConfirmDecomposition(null, { projectId, tasks: [{ title: 'T' }] }, ctx),
    ).rejects.toThrow();
  });

  it('requires project access', async () => {
    const nonMemberId = new mongoose.Types.ObjectId();
    const ctx = mockContext({ user: managerPayload(String(nonMemberId)) });

    await expect(
      Mutation.aiConfirmDecomposition(null, { projectId, tasks: [{ title: 'T' }] }, ctx),
    ).rejects.toThrow();
  });
});

// ─── aiGenerateSubtasks ─────────────────────────────────────

describe('aiGenerateSubtasks mutation', () => {
  it('returns string array of subtask suggestions', async () => {
    const task = await Task.create({
      projectId,
      title: 'Parent Task',
      status: 'backlog',
      position: 0,
      createdBy: managerId,
    });

    const subtasks = ['Subtask A', 'Subtask B', 'Subtask C'];
    mockOpenRouterResponse(subtasks);

    const ctx = mockContext({ user: managerPayload(String(managerId)) });
    const result = await Mutation.aiGenerateSubtasks(null, { taskId: String(task._id) }, ctx);

    expect(result).toEqual(subtasks);
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('requires manager or above role', async () => {
    const regularId = new mongoose.Types.ObjectId();
    const ctx = mockContext({ user: userPayload(String(regularId)) });

    await expect(
      Mutation.aiGenerateSubtasks(null, { taskId: String(new mongoose.Types.ObjectId()) }, ctx),
    ).rejects.toThrow();
  });

  it('throws NotFound for nonexistent taskId', async () => {
    mockOpenRouterResponse(['a']);
    const fakeId = new mongoose.Types.ObjectId();
    const ctx = mockContext({ user: managerPayload(String(managerId)) });

    await expect(
      Mutation.aiGenerateSubtasks(null, { taskId: String(fakeId) }, ctx),
    ).rejects.toThrow(/not found/i);
  });
});

// ─── Rate limiting ──────────────────────────────────────────

describe('AI rate limiting', () => {
  it('allows 10 calls then throws on the 11th', async () => {
    // Use a unique user for rate-limit isolation
    const rateLimitUserId = new mongoose.Types.ObjectId();
    await ProjectMember.create({ projectId, userId: rateLimitUserId });

    const ctx = mockContext({ user: managerPayload(String(rateLimitUserId)) });

    mockOpenRouterResponse([{ title: 'T', priority: 'low' }]);

    // First 10 should succeed
    for (let i = 0; i < 10; i++) {
      await Mutation.aiDecompose(null, { projectId, text: `call ${i}` }, ctx);
    }

    // 11th should throw
    await expect(
      Mutation.aiDecompose(null, { projectId, text: 'one too many' }, ctx),
    ).rejects.toThrow(/rate limit/i);
  });
});
