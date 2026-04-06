import { describe, it, expect, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import {
  Task,
  Project,
  User,
  Subtask,
  Comment,
  TaskTag,
  Tag,
  AuditLog,
  Notification,
  ProjectMember,
} from '@server/models/index.js';
import { taskResolvers } from '@server/resolvers/taskResolvers.js';
import { type GraphQLContext, type TokenPayload } from '@server/utils/auth.js';

// --- Test helpers ---

function mockContext(overrides: { user?: TokenPayload | null } = {}): GraphQLContext {
  return {
    user: overrides.user ?? null,
    req: { ip: '127.0.0.1', cookies: {} } as unknown as GraphQLContext['req'],
    res: { cookie: vi.fn(), clearCookie: vi.fn() } as unknown as GraphQLContext['res'],
  };
}

const { Query, Mutation, Task: TaskFieldResolvers } = taskResolvers;

// Reusable IDs
let projectId: mongoose.Types.ObjectId;
let userId: mongoose.Types.ObjectId;
let userPayload: TokenPayload;
let superadminPayload: TokenPayload;

async function seedProject() {
  const project = await Project.create({ name: 'Test Project', createdBy: userId });
  projectId = project._id as mongoose.Types.ObjectId;
  return project;
}

async function seedMembership(
  pId: mongoose.Types.ObjectId = projectId,
  uId: mongoose.Types.ObjectId = userId,
) {
  return ProjectMember.create({ projectId: pId, userId: uId });
}

async function seedTask(overrides: Record<string, unknown> = {}) {
  return Task.create({
    projectId,
    title: 'Default task',
    status: 'backlog',
    priority: 'medium',
    position: 0,
    createdBy: userId,
    ...overrides,
  });
}

// --- Lifecycle ---

beforeEach(async () => {
  await Promise.all([
    Task.deleteMany({}),
    Project.deleteMany({}),
    User.deleteMany({}),
    Subtask.deleteMany({}),
    Comment.deleteMany({}),
    TaskTag.deleteMany({}),
    Tag.deleteMany({}),
    AuditLog.deleteMany({}),
    Notification.deleteMany({}),
    ProjectMember.deleteMany({}),
  ]);

  const user = await User.create({
    username: 'taskuser',
    password: 'Test@1234',
    role: 'user',
    active: true,
  });
  userId = user._id as mongoose.Types.ObjectId;
  userPayload = { id: String(userId), username: 'taskuser', role: 'user' };

  const admin = await User.create({
    username: 'superadmin',
    password: 'Test@1234',
    role: 'superadmin',
    active: true,
  });
  superadminPayload = { id: String(admin._id), username: 'superadmin', role: 'superadmin' };

  await seedProject();
  await seedMembership();
});

// ─── Query: tasks ──────────────────────────────────────────────

describe('tasks query', () => {
  it('returns non-deleted tasks for a project', async () => {
    await seedTask({ title: 'Active task' });
    await seedTask({ title: 'Deleted task', deletedAt: new Date() });

    const ctx = mockContext({ user: userPayload });
    const result = await Query.tasks(null, { projectId: String(projectId) }, ctx);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Active task');
  });

  it('excludes archived tasks by default', async () => {
    await seedTask({ title: 'Normal' });
    await seedTask({ title: 'Archived', archivedAt: new Date() });

    const ctx = mockContext({ user: userPayload });
    const result = await Query.tasks(null, { projectId: String(projectId) }, ctx);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Normal');
  });

  it('includes archived tasks when flag is set', async () => {
    await seedTask({ title: 'Normal' });
    await seedTask({ title: 'Archived', archivedAt: new Date() });

    const ctx = mockContext({ user: userPayload });
    const result = await Query.tasks(
      null,
      { projectId: String(projectId), includeArchived: true },
      ctx,
    );

    expect(result).toHaveLength(2);
  });

  it('throws when not authenticated', async () => {
    const ctx = mockContext();
    await expect(
      Query.tasks(null, { projectId: String(projectId) }, ctx),
    ).rejects.toThrow(/logged in/);
  });

  it('throws when user lacks project access', async () => {
    const otherUser = await User.create({
      username: 'outsider',
      password: 'Test@1234',
      role: 'user',
      active: true,
    });
    const outsiderPayload: TokenPayload = {
      id: String(otherUser._id),
      username: 'outsider',
      role: 'user',
    };

    const ctx = mockContext({ user: outsiderPayload });
    await expect(
      Query.tasks(null, { projectId: String(projectId) }, ctx),
    ).rejects.toThrow(/not a member/);
  });

  it('sorts tasks by position', async () => {
    await seedTask({ title: 'Second', position: 2 });
    await seedTask({ title: 'First', position: 1 });

    const ctx = mockContext({ user: userPayload });
    const result = await Query.tasks(null, { projectId: String(projectId) }, ctx);

    expect(result[0].title).toBe('First');
    expect(result[1].title).toBe('Second');
  });
});

// ─── Query: task ───────────────────────────────────────────────

describe('task query', () => {
  it('returns task by ID with project access', async () => {
    const task = await seedTask({ title: 'Find me' });

    const ctx = mockContext({ user: userPayload });
    const result = await Query.task(null, { id: String(task._id) }, ctx);

    expect(result.title).toBe('Find me');
  });

  it('throws NotFound for nonexistent task', async () => {
    const ctx = mockContext({ user: userPayload });
    const fakeId = new mongoose.Types.ObjectId();

    await expect(
      Query.task(null, { id: String(fakeId) }, ctx),
    ).rejects.toThrow(/not found/i);
  });

  it('throws when user lacks project access', async () => {
    const task = await seedTask();
    const otherUser = await User.create({
      username: 'noaccess',
      password: 'Test@1234',
      role: 'user',
      active: true,
    });
    const noAccessPayload: TokenPayload = {
      id: String(otherUser._id),
      username: 'noaccess',
      role: 'user',
    };

    const ctx = mockContext({ user: noAccessPayload });
    await expect(
      Query.task(null, { id: String(task._id) }, ctx),
    ).rejects.toThrow(/not a member/);
  });
});

// ─── Query: searchTasks ────────────────────────────────────────

describe('searchTasks query', () => {
  it('throws for empty query', async () => {
    const ctx = mockContext({ user: userPayload });
    await expect(
      Query.searchTasks(null, { query: '   ' }, ctx),
    ).rejects.toThrow(/empty/);
  });

  it('returns non-deleted tasks matching text', async () => {
    await seedTask({ title: 'Deploy staging server' });
    await seedTask({ title: 'Deleted deploy', deletedAt: new Date() });
    // Ensure text index is built
    await Task.ensureIndexes();

    const ctx = mockContext({ user: userPayload });
    const result = await Query.searchTasks(null, { query: 'deploy' }, ctx);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Deploy staging server');
  });

  it('throws when not authenticated', async () => {
    const ctx = mockContext();
    await expect(
      Query.searchTasks(null, { query: 'test' }, ctx),
    ).rejects.toThrow(/logged in/);
  });

  it('does not return tasks from projects user is not a member of', async () => {
    const otherProject = await Project.create({ name: 'Other Project', createdBy: userId });
    await seedTask({ title: 'My deploy task' });
    await Task.create({
      projectId: otherProject._id,
      title: 'Other deploy task',
      status: 'backlog',
      priority: 'medium',
      position: 0,
      createdBy: userId,
    });
    await Task.ensureIndexes();

    const ctx = mockContext({ user: userPayload });
    const result = await Query.searchTasks(null, { query: 'deploy' }, ctx);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('My deploy task');
  });

  it('superadmin can search tasks across all projects', async () => {
    const otherProject = await Project.create({ name: 'Other Project', createdBy: userId });
    await seedTask({ title: 'Project A deploy' });
    await Task.create({
      projectId: otherProject._id,
      title: 'Project B deploy',
      status: 'backlog',
      priority: 'medium',
      position: 0,
      createdBy: userId,
    });
    await Task.ensureIndexes();

    const ctx = mockContext({ user: superadminPayload });
    const result = await Query.searchTasks(null, { query: 'deploy' }, ctx);

    expect(result).toHaveLength(2);
  });
});

// ─── Query: trashedTasks ───────────────────────────────────────

describe('trashedTasks query', () => {
  it('superadmin sees all trashed tasks across projects', async () => {
    const otherProject = await Project.create({ name: 'Other', createdBy: userId });
    await seedTask({ title: 'Trashed A', deletedAt: new Date() });
    await seedTask({
      title: 'Trashed B',
      projectId: otherProject._id,
      deletedAt: new Date(),
    });

    const ctx = mockContext({ user: superadminPayload });
    const result = await Query.trashedTasks(null, {}, ctx);

    expect(result).toHaveLength(2);
  });

  it('regular user only sees trashed tasks in their projects', async () => {
    const otherProject = await Project.create({ name: 'Other', createdBy: userId });
    await seedTask({ title: 'My trashed', deletedAt: new Date() });
    await seedTask({
      title: 'Not my trashed',
      projectId: otherProject._id,
      deletedAt: new Date(),
    });

    const ctx = mockContext({ user: userPayload });
    const result = await Query.trashedTasks(null, {}, ctx);

    // User only has membership in projectId, not otherProject
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('My trashed');
  });

  it('throws when not authenticated', async () => {
    const ctx = mockContext();
    await expect(
      Query.trashedTasks(null, {}, ctx),
    ).rejects.toThrow(/logged in/);
  });
});

// ─── Mutation: createTask ──────────────────────────────────────

describe('createTask mutation', () => {
  it('creates task with auto-position and createdBy', async () => {
    await seedTask({ position: 5 }); // existing task with position 5

    const ctx = mockContext({ user: userPayload });
    const result = await Mutation.createTask(null, {
      input: { projectId: String(projectId), title: 'New task' },
    }, ctx);

    expect(result.title).toBe('New task');
    expect(result.position).toBe(6); // auto 5+1
    expect(String(result.createdBy)).toBe(String(userId));
    expect(result.status).toBe('backlog');
    expect(result.priority).toBe('medium');
  });

  it('creates AuditLog on task creation', async () => {
    const ctx = mockContext({ user: userPayload });
    await Mutation.createTask(null, {
      input: { projectId: String(projectId), title: 'Audited task' },
    }, ctx);

    const log = await AuditLog.findOne({ action: 'task_created' });
    expect(log).not.toBeNull();
    expect(log!.userName).toBe('taskuser');
  });

  it('throws when projectId is missing', async () => {
    const ctx = mockContext({ user: userPayload });
    await expect(
      Mutation.createTask(null, { input: { title: 'No project' } }, ctx),
    ).rejects.toThrow(/projectId is required/);
  });

  it('throws when title is missing', async () => {
    const ctx = mockContext({ user: userPayload });
    await expect(
      Mutation.createTask(null, {
        input: { projectId: String(projectId), title: '' },
      }, ctx),
    ).rejects.toThrow(/title is required/);
  });

  it('throws when user lacks project access', async () => {
    const outsider = await User.create({
      username: 'outsider2',
      password: 'Test@1234',
      role: 'user',
      active: true,
    });
    const outsiderPayload: TokenPayload = {
      id: String(outsider._id),
      username: 'outsider2',
      role: 'user',
    };

    const ctx = mockContext({ user: outsiderPayload });
    await expect(
      Mutation.createTask(null, {
        input: { projectId: String(projectId), title: 'Nope' },
      }, ctx),
    ).rejects.toThrow(/not a member/);
  });

  it('sets completedAt when created with status complete', async () => {
    const ctx = mockContext({ user: userPayload });
    const result = await Mutation.createTask(null, {
      input: { projectId: String(projectId), title: 'Done', status: 'complete' },
    }, ctx);

    expect(result.completedAt).toBeDefined();
  });
});

// ─── Mutation: updateTask ──────────────────────────────────────

describe('updateTask mutation', () => {
  it('updates title and logs changes in AuditLog', async () => {
    const task = await seedTask({ title: 'Old title' });

    const ctx = mockContext({ user: userPayload });
    const result = await Mutation.updateTask(null, {
      id: String(task._id),
      input: { title: 'New title' },
    }, ctx);

    expect(result!.title).toBe('New title');

    const log = await AuditLog.findOne({ action: 'task_updated' });
    expect(log).not.toBeNull();
    const changes = JSON.parse(log!.changes as string);
    expect(changes.title.from).toBe('Old title');
    expect(changes.title.to).toBe('New title');
  });

  it('sets completedAt when status changes to complete', async () => {
    const task = await seedTask({ status: 'active' });

    const ctx = mockContext({ user: userPayload });
    const result = await Mutation.updateTask(null, {
      id: String(task._id),
      input: { status: 'complete' },
    }, ctx);

    expect(result!.completedAt).toBeDefined();
  });

  it('clears completedAt when status leaves complete', async () => {
    const task = await seedTask({ status: 'complete', completedAt: new Date() });

    const ctx = mockContext({ user: userPayload });
    const result = await Mutation.updateTask(null, {
      id: String(task._id),
      input: { status: 'active' },
    }, ctx);

    expect(result!.completedAt).toBeNull();
  });

  it('creates assignment notification when assigneeId changes', async () => {
    const assignee = await User.create({
      username: 'assignee',
      password: 'Test@1234',
      role: 'user',
      active: true,
    });
    const task = await seedTask();

    const ctx = mockContext({ user: userPayload });
    await Mutation.updateTask(null, {
      id: String(task._id),
      input: { assigneeId: String(assignee._id) },
    }, ctx);

    const notif = await Notification.findOne({
      userId: assignee._id,
      type: 'assignment',
    });
    expect(notif).not.toBeNull();
    expect(notif!.content).toMatch(/assigned/);
  });

  it('returns unchanged task if no updates provided', async () => {
    const task = await seedTask({ title: 'Same' });

    const ctx = mockContext({ user: userPayload });
    const result = await Mutation.updateTask(null, {
      id: String(task._id),
      input: {},
    }, ctx);

    expect(result!.title).toBe('Same');
    // No audit log should be created for no-op
    const logs = await AuditLog.find({ action: 'task_updated' });
    expect(logs).toHaveLength(0);
  });

  it('throws NotFound for deleted task', async () => {
    const task = await seedTask({ deletedAt: new Date() });

    const ctx = mockContext({ user: userPayload });
    await expect(
      Mutation.updateTask(null, {
        id: String(task._id),
        input: { title: 'Updated' },
      }, ctx),
    ).rejects.toThrow(/not found/i);
  });

  it('throws when not authenticated', async () => {
    const task = await seedTask();
    const ctx = mockContext();
    await expect(
      Mutation.updateTask(null, {
        id: String(task._id),
        input: { title: 'Nope' },
      }, ctx),
    ).rejects.toThrow(/logged in/);
  });

  // ── Owner-or-Manager+ guard (Gap 4) ──

  it('allows task assignee (role=user) to update', async () => {
    const task = await seedTask({ assigneeId: userId });
    const ctx = mockContext({ user: userPayload });
    const result = await Mutation.updateTask(null, {
      id: String(task._id),
      input: { title: 'Updated by assignee' },
    }, ctx);
    expect(result!.title).toBe('Updated by assignee');
  });

  it('allows task creator (role=user) to update when not assignee', async () => {
    const other = await User.create({ username: 'other', password: 'Test@1234', role: 'user', active: true });
    // task createdBy=userId, assigneeId=other
    const task = await seedTask({ assigneeId: other._id });
    const ctx = mockContext({ user: userPayload });
    const result = await Mutation.updateTask(null, {
      id: String(task._id),
      input: { title: 'Updated by creator' },
    }, ctx);
    expect(result!.title).toBe('Updated by creator');
  });

  it('allows manager (non-owner) to update any task', async () => {
    const manager = await User.create({ username: 'mgr', password: 'Test@1234', role: 'manager', active: true });
    await ProjectMember.create({ projectId, userId: manager._id });
    const managerPayload: TokenPayload = { id: String(manager._id), username: 'mgr', role: 'manager' };
    const other = await User.create({ username: 'other2', password: 'Test@1234', role: 'user', active: true });
    const task = await seedTask({ assigneeId: other._id, createdBy: other._id });
    const ctx = mockContext({ user: managerPayload });
    const result = await Mutation.updateTask(null, {
      id: String(task._id),
      input: { title: 'Updated by manager' },
    }, ctx);
    expect(result!.title).toBe('Updated by manager');
  });

  it('rejects unrelated user (role=user) from updating task they do not own', async () => {
    const other = await User.create({ username: 'other3', password: 'Test@1234', role: 'user', active: true });
    const otherPayload: TokenPayload = { id: String(other._id), username: 'other3', role: 'user' };
    await ProjectMember.create({ projectId, userId: other._id });
    // task createdBy=userId, assigneeId=userId — other3 is neither
    const task = await seedTask({ assigneeId: userId });
    const ctx = mockContext({ user: otherPayload });
    await expect(
      Mutation.updateTask(null, {
        id: String(task._id),
        input: { title: 'Unauthorized' },
      }, ctx),
    ).rejects.toThrow(/Manager or Superadmin/);
  });

  it('allows superadmin to update any task', async () => {
    const other = await User.create({ username: 'other4', password: 'Test@1234', role: 'user', active: true });
    const task = await seedTask({ assigneeId: other._id, createdBy: other._id });
    const ctx = mockContext({ user: superadminPayload });
    const result = await Mutation.updateTask(null, {
      id: String(task._id),
      input: { title: 'Updated by superadmin' },
    }, ctx);
    expect(result!.title).toBe('Updated by superadmin');
  });
});

// ─── Mutation: deleteTask ──────────────────────────────────────

describe('deleteTask mutation', () => {
  it('soft deletes by setting deletedAt', async () => {
    const task = await seedTask();

    const ctx = mockContext({ user: userPayload });
    const result = await Mutation.deleteTask(null, { id: String(task._id) }, ctx);

    expect(result!.deletedAt).toBeDefined();
  });

  it('creates AuditLog on delete', async () => {
    const task = await seedTask();

    const ctx = mockContext({ user: userPayload });
    await Mutation.deleteTask(null, { id: String(task._id) }, ctx);

    const log = await AuditLog.findOne({ action: 'task_deleted' });
    expect(log).not.toBeNull();
  });

  it('throws for already-deleted task', async () => {
    const task = await seedTask({ deletedAt: new Date() });

    const ctx = mockContext({ user: userPayload });
    await expect(
      Mutation.deleteTask(null, { id: String(task._id) }, ctx),
    ).rejects.toThrow(/not found/i);
  });

  it('throws when not authenticated', async () => {
    const task = await seedTask();
    const ctx = mockContext();
    await expect(
      Mutation.deleteTask(null, { id: String(task._id) }, ctx),
    ).rejects.toThrow(/logged in/);
  });
});

// ─── Mutation: restoreTask ─────────────────────────────────────

describe('restoreTask mutation', () => {
  it('clears deletedAt on trashed task', async () => {
    const task = await seedTask({ deletedAt: new Date() });

    const ctx = mockContext({ user: userPayload });
    const result = await Mutation.restoreTask(null, { id: String(task._id) }, ctx);

    expect(result!.deletedAt).toBeUndefined();
  });

  it('throws for non-trashed task', async () => {
    const task = await seedTask();

    const ctx = mockContext({ user: userPayload });
    await expect(
      Mutation.restoreTask(null, { id: String(task._id) }, ctx),
    ).rejects.toThrow(/Trashed task not found/);
  });
});

// ─── Mutation: unarchiveTask ───────────────────────────────────

describe('unarchiveTask mutation', () => {
  it('clears archivedAt on archived task', async () => {
    const task = await seedTask({ archivedAt: new Date() });

    const ctx = mockContext({ user: userPayload });
    const result = await Mutation.unarchiveTask(null, { id: String(task._id) }, ctx);

    expect(result!.archivedAt).toBeUndefined();
  });

  it('throws for non-archived task', async () => {
    const task = await seedTask();

    const ctx = mockContext({ user: userPayload });
    await expect(
      Mutation.unarchiveTask(null, { id: String(task._id) }, ctx),
    ).rejects.toThrow(/Archived task not found/);
  });
});

// ─── Mutation: archiveSweep ────────────────────────────────────

describe('archiveSweep mutation', () => {
  it('archives tasks completed 7+ days ago', async () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);

    await seedTask({ status: 'complete', completedAt: eightDaysAgo }); // should be archived
    await seedTask({ status: 'complete', completedAt: oneDayAgo }); // too recent

    const ctx = mockContext({ user: superadminPayload });
    const count = await Mutation.archiveSweep(null, {}, ctx);

    expect(count).toBe(1);

    const archived = await Task.find({ archivedAt: { $ne: null } });
    expect(archived).toHaveLength(1);
  });

  it('skips already-archived or deleted tasks', async () => {
    const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    await seedTask({ status: 'complete', completedAt: oldDate, archivedAt: new Date() });
    await seedTask({ status: 'complete', completedAt: oldDate, deletedAt: new Date() });

    const ctx = mockContext({ user: superadminPayload });
    const count = await Mutation.archiveSweep(null, {}, ctx);

    expect(count).toBe(0);
  });

  it('throws for non-superadmin', async () => {
    const ctx = mockContext({ user: userPayload });
    await expect(
      Mutation.archiveSweep(null, {}, ctx),
    ).rejects.toThrow(/Superadmin/);
  });
});

// ─── Mutation: purgeSweep ──────────────────────────────────────

describe('purgeSweep mutation', () => {
  it('hard-deletes tasks trashed 7+ days ago', async () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    const task = await seedTask({ deletedAt: eightDaysAgo });

    // Create related docs
    await Subtask.create({ taskId: task._id, title: 'Sub' });
    await Comment.create({ taskId: task._id, authorId: userId, content: 'Test' });
    const tag = await Tag.create({ name: 'urgent' });
    await TaskTag.create({ taskId: task._id, tagId: tag._id });

    const ctx = mockContext({ user: superadminPayload });
    const count = await Mutation.purgeSweep(null, {}, ctx);

    expect(count).toBe(1);
    expect(await Task.countDocuments()).toBe(0);
    expect(await Subtask.countDocuments()).toBe(0);
    expect(await Comment.countDocuments()).toBe(0);
    expect(await TaskTag.countDocuments()).toBe(0);
  });

  it('cascade-deletes AuditLog entries for purged tasks', async () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    const task = await seedTask({ deletedAt: eightDaysAgo });
    await AuditLog.create({
      taskId: task._id,
      userId,
      userName: 'taskuser',
      action: 'task_created',
    });

    const ctx = mockContext({ user: superadminPayload });
    await Mutation.purgeSweep(null, {}, ctx);

    expect(await AuditLog.countDocuments({ taskId: task._id })).toBe(0);
  });

  it('hard-deletes tasks archived 30+ days ago', async () => {
    const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    await seedTask({ archivedAt: thirtyOneDaysAgo });

    const ctx = mockContext({ user: superadminPayload });
    const count = await Mutation.purgeSweep(null, {}, ctx);

    expect(count).toBe(1);
  });

  it('does not purge recently trashed or archived tasks', async () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    await seedTask({ deletedAt: twoDaysAgo });
    await seedTask({ archivedAt: twoDaysAgo });

    const ctx = mockContext({ user: superadminPayload });
    const count = await Mutation.purgeSweep(null, {}, ctx);

    expect(count).toBe(0);
  });

  it('returns 0 when nothing to purge', async () => {
    const ctx = mockContext({ user: superadminPayload });
    const count = await Mutation.purgeSweep(null, {}, ctx);
    expect(count).toBe(0);
  });

  it('throws for non-superadmin', async () => {
    const ctx = mockContext({ user: userPayload });
    await expect(
      Mutation.purgeSweep(null, {}, ctx),
    ).rejects.toThrow(/Superadmin/);
  });
});

// ─── Field resolvers ───────────────────────────────────────────

describe('Task field resolvers', () => {
  it('Task.project returns the project', async () => {
    const task = await seedTask();
    const result = await TaskFieldResolvers.project(task);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Test Project');
  });

  it('Task.assignee returns user when assigned', async () => {
    const task = await seedTask({ assigneeId: userId });
    const result = await TaskFieldResolvers.assignee(task);
    expect(result).not.toBeNull();
    expect(result!.username).toBe('taskuser');
  });

  it('Task.assignee returns null when unassigned', async () => {
    const task = await seedTask();
    const result = await TaskFieldResolvers.assignee(task);
    expect(result).toBeNull();
  });

  it('Task.subtasks returns subtask array', async () => {
    const task = await seedTask();
    await Subtask.create({ taskId: task._id, title: 'Sub 1' });
    await Subtask.create({ taskId: task._id, title: 'Sub 2' });

    const result = await TaskFieldResolvers.subtasks(task);
    expect(result).toHaveLength(2);
  });

  it('Task.tags returns tags via TaskTag join', async () => {
    const task = await seedTask();
    const tag1 = await Tag.create({ name: 'bug' });
    const tag2 = await Tag.create({ name: 'feature' });
    await TaskTag.create({ taskId: task._id, tagId: tag1._id });
    await TaskTag.create({ taskId: task._id, tagId: tag2._id });

    const result = await TaskFieldResolvers.tags(task);
    expect(result).toHaveLength(2);
    const names = result.map((t: { name: string }) => t.name).sort();
    expect(names).toEqual(['bug', 'feature']);
  });

  it('Task.tags returns empty array when no tags', async () => {
    const task = await seedTask();
    const result = await TaskFieldResolvers.tags(task);
    expect(result).toEqual([]);
  });
});
