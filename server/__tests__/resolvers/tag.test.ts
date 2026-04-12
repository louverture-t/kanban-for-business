import { describe, it, expect, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { Tag, TaskTag, Task, Project, ProjectMember } from '@server/models/index.js';
import { tagResolvers } from '@server/resolvers/tagResolvers.js';
import type { GraphQLContext, TokenPayload } from '@server/utils/auth.js';

// --- Test helpers ---

function mockContext(overrides: { user?: TokenPayload | null } = {}): GraphQLContext {
  return {
    user: overrides.user ?? null,
    req: { ip: '127.0.0.1', cookies: {} } as unknown as GraphQLContext['req'],
    res: { cookie: vi.fn(), clearCookie: vi.fn() } as unknown as GraphQLContext['res'],
  };
}

const { Query, Mutation } = tagResolvers;

let projectId: string;
let taskId: string;

const userId = new mongoose.Types.ObjectId().toString();

const userPayload: TokenPayload = { id: userId, username: 'testuser', role: 'user' };
const managerPayload: TokenPayload = {
  id: new mongoose.Types.ObjectId().toString(),
  username: 'manager',
  role: 'manager',
};

beforeEach(async () => {
  await Tag.deleteMany({});
  await TaskTag.deleteMany({});
  await Task.deleteMany({});
  await Project.deleteMany({});
  await ProjectMember.deleteMany({});

  const project = await Project.create({ name: 'Test Project', createdBy: userId });
  projectId = String(project._id);

  const task = await Task.create({
    title: 'Test Task',
    projectId,
    status: 'backlog',
  });
  taskId = String(task._id);

  await ProjectMember.create({ projectId, userId });
});

// ─── tags query ────────────────────────────────────────────

describe('tags query', () => {
  it('returns all tags sorted by name', async () => {
    await Tag.create({ name: 'Zypper', color: '#ff0000' });
    await Tag.create({ name: 'Alpha', color: '#00ff00' });
    await Tag.create({ name: 'Middle', color: '#0000ff' });

    const ctx = mockContext({ user: userPayload });
    const result = await Query.tags(null, {}, ctx);

    expect(result).toHaveLength(3);
    expect(result[0].name).toBe('Alpha');
    expect(result[1].name).toBe('Middle');
    expect(result[2].name).toBe('Zypper');
  });
});

// ─── taskTags query ────────────────────────────────────────

describe('taskTags query', () => {
  it('returns tags associated with a task', async () => {
    const tagA = await Tag.create({ name: 'Bug', color: '#ff0000' });
    const tagB = await Tag.create({ name: 'Feature', color: '#00ff00' });
    const tagC = await Tag.create({ name: 'Unlinked', color: '#0000ff' });

    await TaskTag.create({ taskId, tagId: tagA._id });
    await TaskTag.create({ taskId, tagId: tagB._id });
    // tagC is NOT linked to the task

    const ctx = mockContext({ user: userPayload });
    const result = await Query.taskTags(null, { taskId }, ctx);

    expect(result).toHaveLength(2);
    const names = result.map((t: { name: string }) => t.name);
    expect(names).toContain('Bug');
    expect(names).toContain('Feature');
    expect(names).not.toContain('Unlinked');
  });
});

// ─── createTag ─────────────────────────────────────────────

describe('createTag mutation', () => {
  it('creates tag with manager role', async () => {
    const ctx = mockContext({ user: managerPayload });

    const result = await Mutation.createTag(null, { name: 'Urgent' }, ctx);

    expect(result.name).toBe('Urgent');
    expect(result.color).toBe('#6b7280'); // default color
  });

  it('creates tag with custom color', async () => {
    const ctx = mockContext({ user: managerPayload });

    const result = await Mutation.createTag(null, { name: 'Priority', color: '#e11d48' }, ctx);

    expect(result.color).toBe('#e11d48');
  });

  it('throws for user role (not manager+)', async () => {
    const ctx = mockContext({ user: userPayload });

    await expect(
      Mutation.createTag(null, { name: 'Blocked' }, ctx),
    ).rejects.toThrow();
  });
});

// ─── addTagToTask ──────────────────────────────────────────

describe('addTagToTask mutation', () => {
  it('links tag to task', async () => {
    const tag = await Tag.create({ name: 'Linked', color: '#333' });
    const ctx = mockContext({ user: userPayload });

    const result = await Mutation.addTagToTask(null, { taskId, tagId: String(tag._id) }, ctx);

    expect(String(result.taskId)).toBe(taskId);
    expect(String(result.tagId)).toBe(String(tag._id));
  });

  it('returns existing link on duplicate', async () => {
    const tag = await Tag.create({ name: 'Dupe', color: '#444' });
    const ctx = mockContext({ user: userPayload });

    const first = await Mutation.addTagToTask(null, { taskId, tagId: String(tag._id) }, ctx);
    const second = await Mutation.addTagToTask(null, { taskId, tagId: String(tag._id) }, ctx);

    expect(String(first._id)).toBe(String(second._id));

    // Only one TaskTag in DB
    const count = await TaskTag.countDocuments({ taskId, tagId: tag._id });
    expect(count).toBe(1);
  });

  it('throws for nonexistent task', async () => {
    const tag = await Tag.create({ name: 'Orphan', color: '#555' });
    const ctx = mockContext({ user: userPayload });
    const fakeTaskId = new mongoose.Types.ObjectId().toString();

    await expect(
      Mutation.addTagToTask(null, { taskId: fakeTaskId, tagId: String(tag._id) }, ctx),
    ).rejects.toThrow(/Task not found/);
  });

  it('throws for nonexistent tag', async () => {
    const ctx = mockContext({ user: userPayload });
    const fakeTagId = new mongoose.Types.ObjectId().toString();

    await expect(
      Mutation.addTagToTask(null, { taskId, tagId: fakeTagId }, ctx),
    ).rejects.toThrow(/Tag not found/);
  });
});

// ─── removeTagFromTask ─────────────────────────────────────

describe('removeTagFromTask mutation', () => {
  it('removes tag link from task', async () => {
    const tag = await Tag.create({ name: 'Remove Me', color: '#666' });
    await TaskTag.create({ taskId, tagId: tag._id });
    const ctx = mockContext({ user: userPayload });

    const result = await Mutation.removeTagFromTask(null, { taskId, tagId: String(tag._id) }, ctx);

    expect(result).toBe(true);
    expect(await TaskTag.findOne({ taskId, tagId: tag._id })).toBeNull();
  });

  it('throws NotFound if tag is not linked to task', async () => {
    const tag = await Tag.create({ name: 'Not Linked', color: '#777' });
    const ctx = mockContext({ user: userPayload });

    await expect(
      Mutation.removeTagFromTask(null, { taskId, tagId: String(tag._id) }, ctx),
    ).rejects.toThrow(/not associated/);
  });
});
