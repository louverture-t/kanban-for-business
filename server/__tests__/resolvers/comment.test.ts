import { describe, it, expect, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { Comment, Task, Project, User, AuditLog, Notification, ProjectMember } from '@server/models/index.js';
import { commentResolvers } from '@server/resolvers/commentResolvers.js';
import type { GraphQLContext, TokenPayload } from '@server/utils/auth.js';

// --- Test helpers ---

function mockContext(overrides: { user?: TokenPayload | null } = {}): GraphQLContext {
  return {
    user: overrides.user ?? null,
    req: { ip: '127.0.0.1', cookies: {} } as unknown as GraphQLContext['req'],
    res: { cookie: vi.fn(), clearCookie: vi.fn() } as unknown as GraphQLContext['res'],
  };
}

const { Query, Mutation, Comment: CommentFieldResolvers } = commentResolvers;

let projectId: string;
let taskId: string;

const userAId = new mongoose.Types.ObjectId().toString();
const userBId = new mongoose.Types.ObjectId().toString();

const userAPayload: TokenPayload = { id: userAId, username: 'alice', role: 'user' };
const userBPayload: TokenPayload = { id: userBId, username: 'bob', role: 'user' };
const managerPayload: TokenPayload = {
  id: new mongoose.Types.ObjectId().toString(),
  username: 'manager',
  role: 'manager',
};

beforeEach(async () => {
  await Comment.deleteMany({});
  await Task.deleteMany({});
  await Project.deleteMany({});
  await User.deleteMany({});
  await AuditLog.deleteMany({});
  await Notification.deleteMany({});
  await ProjectMember.deleteMany({});

  const project = await Project.create({ name: 'Test Project', createdBy: userAId });
  projectId = String(project._id);

  const task = await Task.create({
    title: 'Test Task',
    projectId,
    status: 'backlog',
    assigneeId: userBId,
  });
  taskId = String(task._id);

  // Add all test users as project members
  await ProjectMember.create({ projectId, userId: userAId });
  await ProjectMember.create({ projectId, userId: userBId });
  await ProjectMember.create({ projectId, userId: managerPayload.id });

  // Create user docs for field resolver tests
  await User.create({ username: 'alice', password: 'Test@1234', role: 'user' });
  await User.create({ username: 'bob', password: 'Test@1234', role: 'user' });
});

// ─── comments query ────────────────────────────────────────

describe('comments query', () => {
  it('returns comments for a task sorted by createdAt', async () => {
    await Comment.create({ taskId, content: 'First', authorId: userAId });
    await Comment.create({ taskId, content: 'Second', authorId: userBId });

    const ctx = mockContext({ user: userAPayload });
    const result = await Query.comments(null, { taskId }, ctx);

    expect(result).toHaveLength(2);
    expect(result[0].content).toBe('First');
    expect(result[1].content).toBe('Second');
  });
});

// ─── auditLogs query ──────────────────────────────────────

describe('auditLogs query', () => {
  it('returns audit logs for a task sorted by createdAt desc', async () => {
    await AuditLog.create({ taskId, userId: userAId, action: 'first_action', userName: 'alice', createdAt: new Date('2026-01-01') });
    await AuditLog.create({ taskId, userId: userAId, action: 'second_action', userName: 'alice', createdAt: new Date('2026-01-02') });

    const ctx = mockContext({ user: userAPayload });
    const result = await Query.auditLogs(null, { taskId }, ctx);

    expect(result).toHaveLength(2);
    // Descending: most recent first
    expect(result[0].action).toBe('second_action');
    expect(result[1].action).toBe('first_action');
  });
});

// ─── createComment ─────────────────────────────────────────

describe('createComment mutation', () => {
  it('creates comment with authorId from context and creates audit log', async () => {
    const ctx = mockContext({ user: userAPayload });

    const result = await Mutation.createComment(null, { taskId, content: 'Nice work!' }, ctx);

    expect(result.content).toBe('Nice work!');
    expect(String(result.authorId)).toBe(userAId);

    const log = await AuditLog.findOne({ action: 'comment_created' });
    expect(log).not.toBeNull();
    expect(log!.userName).toBe('alice');
  });

  it('creates notification for task assignee when commenter is different', async () => {
    // Task is assigned to userB; userA comments
    const ctx = mockContext({ user: userAPayload });

    await Mutation.createComment(null, { taskId, content: 'Heads up' }, ctx);

    const notification = await Notification.findOne({ userId: userBId, type: 'comment' });
    expect(notification).not.toBeNull();
    expect(notification!.content).toContain('alice');
  });

  it('does NOT create notification when commenter is the assignee', async () => {
    // Task is assigned to userB; userB comments on own task
    const ctx = mockContext({ user: userBPayload });

    await Mutation.createComment(null, { taskId, content: 'Self note' }, ctx);

    const notifications = await Notification.find({ type: 'comment' });
    expect(notifications).toHaveLength(0);
  });

  it('throws for nonexistent task', async () => {
    const ctx = mockContext({ user: userAPayload });
    const fakeTaskId = new mongoose.Types.ObjectId().toString();

    await expect(
      Mutation.createComment(null, { taskId: fakeTaskId, content: 'Orphan' }, ctx),
    ).rejects.toThrow(/Task not found/);
  });

  it('throws for empty content', async () => {
    const ctx = mockContext({ user: userAPayload });

    await expect(
      Mutation.createComment(null, { taskId, content: '   ' }, ctx),
    ).rejects.toThrow(/required/);
  });
});

// ─── deleteComment ─────────────────────────────────────────

describe('deleteComment mutation', () => {
  it('author can delete own comment', async () => {
    const comment = await Comment.create({ taskId, content: 'My comment', authorId: userAId });
    const ctx = mockContext({ user: userAPayload });

    const result = await Mutation.deleteComment(null, { id: String(comment._id) }, ctx);

    expect(result).toBe(true);
    expect(await Comment.findById(comment._id)).toBeNull();
  });

  it('manager can delete any comment', async () => {
    const comment = await Comment.create({ taskId, content: 'User comment', authorId: userAId });
    const ctx = mockContext({ user: managerPayload });

    const result = await Mutation.deleteComment(null, { id: String(comment._id) }, ctx);

    expect(result).toBe(true);
    expect(await Comment.findById(comment._id)).toBeNull();
  });

  it('regular user cannot delete another user\'s comment', async () => {
    const comment = await Comment.create({ taskId, content: 'Not yours', authorId: userAId });
    const ctx = mockContext({ user: userBPayload });

    await expect(
      Mutation.deleteComment(null, { id: String(comment._id) }, ctx),
    ).rejects.toThrow();
  });

  it('throws NotFound for nonexistent comment', async () => {
    const ctx = mockContext({ user: userAPayload });
    const fakeId = new mongoose.Types.ObjectId().toString();

    await expect(
      Mutation.deleteComment(null, { id: fakeId }, ctx),
    ).rejects.toThrow(/not found/);
  });
});

// ─── Comment.author field resolver ─────────────────────────

describe('Comment.author field resolver', () => {
  it('returns the author User document', async () => {
    const user = await User.findOne({ username: 'alice' });
    const result = await CommentFieldResolvers.author({ authorId: String(user!._id) });

    expect(result).not.toBeNull();
    expect(result!.username).toBe('alice');
  });
});
