import { describe, it, expect, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { Subtask, Task, Project, AuditLog } from '@server/models/index.js';
import { subtaskResolvers } from '@server/resolvers/subtaskResolvers.js';
import type { GraphQLContext, TokenPayload } from '@server/utils/auth.js';

// --- Test helpers ---

function mockContext(overrides: { user?: TokenPayload | null } = {}): GraphQLContext {
  return {
    user: overrides.user ?? null,
    req: { ip: '127.0.0.1', cookies: {} } as unknown as GraphQLContext['req'],
    res: { cookie: vi.fn(), clearCookie: vi.fn() } as unknown as GraphQLContext['res'],
  };
}

const { Query, Mutation } = subtaskResolvers;

let projectId: string;
let taskId: string;
const userId = new mongoose.Types.ObjectId().toString();

const userPayload: TokenPayload = { id: userId, username: 'testuser', role: 'user' };

beforeEach(async () => {
  await Subtask.deleteMany({});
  await Task.deleteMany({});
  await Project.deleteMany({});
  await AuditLog.deleteMany({});

  const project = await Project.create({ name: 'Test Project', ownerId: userId });
  projectId = String(project._id);

  const task = await Task.create({
    title: 'Test Task',
    projectId,
    status: 'backlog',
  });
  taskId = String(task._id);
});

// ─── subtasks query ────────────────────────────────────────

describe('subtasks query', () => {
  it('returns subtasks for a task sorted by createdAt', async () => {
    await Subtask.create({ taskId, title: 'First', completed: false });
    // Small delay to guarantee ordering
    await Subtask.create({ taskId, title: 'Second', completed: false });

    const ctx = mockContext({ user: userPayload });
    const result = await Query.subtasks(null, { taskId }, ctx);

    expect(result).toHaveLength(2);
    expect(result[0].title).toBe('First');
    expect(result[1].title).toBe('Second');
  });

  it('throws when not authenticated', async () => {
    const ctx = mockContext();
    await expect(Query.subtasks(null, { taskId }, ctx)).rejects.toThrow();
  });
});

// ─── createSubtask ─────────────────────────────────────────

describe('createSubtask mutation', () => {
  it('creates subtask and returns it', async () => {
    const ctx = mockContext({ user: userPayload });

    const result = await Mutation.createSubtask(null, { taskId, title: 'New Subtask' }, ctx);

    expect(result.title).toBe('New Subtask');
    expect(result.completed).toBe(false);
    expect(String(result.taskId)).toBe(taskId);
  });

  it('creates an audit log entry', async () => {
    const ctx = mockContext({ user: userPayload });

    await Mutation.createSubtask(null, { taskId, title: 'Audited Subtask' }, ctx);

    const log = await AuditLog.findOne({ action: 'subtask_created' });
    expect(log).not.toBeNull();
    expect(log!.userName).toBe('testuser');
    expect(String(log!.taskId)).toBe(taskId);
  });

  it('throws for nonexistent task', async () => {
    const ctx = mockContext({ user: userPayload });
    const fakeTaskId = new mongoose.Types.ObjectId().toString();

    await expect(
      Mutation.createSubtask(null, { taskId: fakeTaskId, title: 'Orphan' }, ctx),
    ).rejects.toThrow(/Task not found/);
  });

  it('throws for empty title', async () => {
    const ctx = mockContext({ user: userPayload });

    await expect(
      Mutation.createSubtask(null, { taskId, title: '   ' }, ctx),
    ).rejects.toThrow(/required/);
  });
});

// ─── updateSubtask ─────────────────────────────────────────

describe('updateSubtask mutation', () => {
  it('updates title and creates audit log', async () => {
    const subtask = await Subtask.create({ taskId, title: 'Old Title', completed: false });
    const ctx = mockContext({ user: userPayload });

    const result = await Mutation.updateSubtask(
      null,
      { id: String(subtask._id), title: 'New Title' },
      ctx,
    );

    expect(result!.title).toBe('New Title');

    const log = await AuditLog.findOne({ action: 'subtask_updated' });
    expect(log).not.toBeNull();
  });

  it('updates completed status', async () => {
    const subtask = await Subtask.create({ taskId, title: 'Toggle Me', completed: false });
    const ctx = mockContext({ user: userPayload });

    const result = await Mutation.updateSubtask(
      null,
      { id: String(subtask._id), completed: true },
      ctx,
    );

    expect(result!.completed).toBe(true);
  });

  it('throws NotFound for nonexistent subtask', async () => {
    const ctx = mockContext({ user: userPayload });
    const fakeId = new mongoose.Types.ObjectId().toString();

    await expect(
      Mutation.updateSubtask(null, { id: fakeId, title: 'Nope' }, ctx),
    ).rejects.toThrow(/not found/);
  });
});

// ─── deleteSubtask ─────────────────────────────────────────

describe('deleteSubtask mutation', () => {
  it('deletes subtask and creates audit log', async () => {
    const subtask = await Subtask.create({ taskId, title: 'Delete Me', completed: false });
    const ctx = mockContext({ user: userPayload });

    const result = await Mutation.deleteSubtask(null, { id: String(subtask._id) }, ctx);

    expect(result).toBe(true);
    expect(await Subtask.findById(subtask._id)).toBeNull();

    const log = await AuditLog.findOne({ action: 'subtask_deleted' });
    expect(log).not.toBeNull();
    expect(log!.changes).toContain('Delete Me');
  });

  it('throws NotFound for nonexistent subtask', async () => {
    const ctx = mockContext({ user: userPayload });
    const fakeId = new mongoose.Types.ObjectId().toString();

    await expect(
      Mutation.deleteSubtask(null, { id: fakeId }, ctx),
    ).rejects.toThrow(/not found/);
  });
});
