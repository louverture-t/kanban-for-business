import { describe, it, expect, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import {
  User,
  Project,
  ProjectFolder,
  ProjectMember,
  Task,
  Subtask,
  Comment,
  TaskTag,
  AuditLog,
  Notification,
} from '@server/models/index.js';
import { folderResolvers } from '@server/resolvers/folderResolvers.js';
import { projectResolvers } from '@server/resolvers/projectResolvers.js';
import { type GraphQLContext, type TokenPayload } from '@server/utils/auth.js';

// --- Test helpers ---

function mockContext(overrides: { user?: TokenPayload | null } = {}): GraphQLContext {
  return {
    user: overrides.user ?? null,
    req: { ip: '127.0.0.1', cookies: {} } as unknown as GraphQLContext['req'],
    res: { cookie: vi.fn(), clearCookie: vi.fn() } as unknown as GraphQLContext['res'],
  };
}

function superadminPayload(id: string): TokenPayload {
  return { id, username: 'superadmin', role: 'superadmin' };
}

function managerPayload(id: string): TokenPayload {
  return { id, username: 'manager', role: 'manager' };
}

function userPayload(id: string): TokenPayload {
  return { id, username: 'regularuser', role: 'user' };
}

async function createUser(overrides: Partial<{ username: string; role: string }> = {}) {
  return User.create({
    username: overrides.username ?? 'testuser',
    password: 'Test@1234',
    role: overrides.role ?? 'user',
    active: true,
  });
}

const { Query: FolderQuery, Mutation: FolderMutation } = folderResolvers;
const { Query: ProjectQuery, Mutation: ProjectMutation, Project: ProjectFieldResolvers } =
  projectResolvers;

// --- Cleanup ---

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Project.deleteMany({}),
    ProjectFolder.deleteMany({}),
    ProjectMember.deleteMany({}),
    Task.deleteMany({}),
    Subtask.deleteMany({}),
    Comment.deleteMany({}),
    TaskTag.deleteMany({}),
    AuditLog.deleteMany({}),
    Notification.deleteMany({}),
  ]);
});

// ═══════════════════════════════════════════════════════════════
// FOLDER RESOLVERS
// ═══════════════════════════════════════════════════════════════

describe('folders query', () => {
  it('returns all folders for authenticated user', async () => {
    await ProjectFolder.create([
      { name: 'Zeta', color: '#ff0000' },
      { name: 'Alpha', color: '#00ff00' },
    ]);

    const user = await createUser();
    const ctx = mockContext({ user: userPayload(String(user._id)) });

    const result = await FolderQuery.folders(null, {}, ctx);
    expect(result).toHaveLength(2);
    // Sorted by name ascending
    expect(result[0].name).toBe('Alpha');
    expect(result[1].name).toBe('Zeta');
  });

  it('throws when not authenticated', () => {
    const ctx = mockContext();
    expect(() => FolderQuery.folders(null, {}, ctx)).toThrow(/logged in/);
  });
});

describe('createFolder mutation', () => {
  it('creates folder with manager role', async () => {
    const user = await createUser({ username: 'mgr', role: 'manager' });
    const ctx = mockContext({ user: managerPayload(String(user._id)) });

    const result = await FolderMutation.createFolder(null, { name: 'Clinical' }, ctx);
    expect(result.name).toBe('Clinical');
    expect(result.color).toBe('#6b7280'); // default color
  });

  it('creates folder with custom color', async () => {
    const user = await createUser({ username: 'mgr', role: 'manager' });
    const ctx = mockContext({ user: managerPayload(String(user._id)) });

    const result = await FolderMutation.createFolder(
      null,
      { name: 'IT', color: '#ef4444' },
      ctx,
    );
    expect(result.color).toBe('#ef4444');
  });

  it('throws for regular user role', async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const ctx = mockContext({ user: userPayload(userId) });

    await expect(
      FolderMutation.createFolder(null, { name: 'Nope' }, ctx),
    ).rejects.toThrow(/Manager or Superadmin/);
  });

  it('throws for empty folder name', async () => {
    const user = await createUser({ username: 'mgr', role: 'manager' });
    const ctx = mockContext({ user: managerPayload(String(user._id)) });

    await expect(
      FolderMutation.createFolder(null, { name: '   ' }, ctx),
    ).rejects.toThrow(/required/);
  });
});

describe('updateFolder mutation', () => {
  it('updates folder name and color', async () => {
    const folder = await ProjectFolder.create({ name: 'Old', color: '#000000' });
    const user = await createUser({ username: 'mgr', role: 'manager' });
    const ctx = mockContext({ user: managerPayload(String(user._id)) });

    const result = await FolderMutation.updateFolder(
      null,
      { id: String(folder._id), name: 'New', color: '#ffffff' },
      ctx,
    );

    expect(result.name).toBe('New');
    expect(result.color).toBe('#ffffff');
  });

  it('throws NotFound for bad ID', async () => {
    const user = await createUser({ username: 'mgr', role: 'manager' });
    const ctx = mockContext({ user: managerPayload(String(user._id)) });
    const fakeId = new mongoose.Types.ObjectId().toString();

    await expect(
      FolderMutation.updateFolder(null, { id: fakeId, name: 'X' }, ctx),
    ).rejects.toThrow(/not found/i);
  });
});

describe('deleteFolder mutation', () => {
  it('deletes folder and unsets folderId on referencing projects', async () => {
    const user = await createUser({ username: 'mgr', role: 'manager' });
    const folder = await ProjectFolder.create({ name: 'Doomed', color: '#000' });
    const project = await Project.create({
      name: 'P1',
      folderId: folder._id,
      createdBy: user._id,
    });

    const ctx = mockContext({ user: managerPayload(String(user._id)) });
    const result = await FolderMutation.deleteFolder(null, { id: String(folder._id) }, ctx);

    expect(result).toBe(true);
    expect(await ProjectFolder.findById(folder._id)).toBeNull();

    const updatedProject = await Project.findById(project._id);
    expect(updatedProject!.folderId).toBeUndefined();
  });

  it('throws NotFound for nonexistent folder', async () => {
    const user = await createUser({ username: 'mgr', role: 'manager' });
    const ctx = mockContext({ user: managerPayload(String(user._id)) });
    const fakeId = new mongoose.Types.ObjectId().toString();

    await expect(
      FolderMutation.deleteFolder(null, { id: fakeId }, ctx),
    ).rejects.toThrow(/not found/i);
  });
});

// ═══════════════════════════════════════════════════════════════
// PROJECT RESOLVERS
// ═══════════════════════════════════════════════════════════════

describe('projects query', () => {
  it('superadmin sees all projects', async () => {
    const admin = await createUser({ username: 'superadmin', role: 'superadmin' });
    const other = await createUser({ username: 'other', role: 'user' });

    await Project.create([
      { name: 'P1', createdBy: admin._id },
      { name: 'P2', createdBy: other._id },
    ]);

    const ctx = mockContext({ user: superadminPayload(String(admin._id)) });
    const result = await ProjectQuery.projects(null, {}, ctx);
    expect(result).toHaveLength(2);
  });

  it('regular user sees only member projects', async () => {
    const user = await createUser({ username: 'member', role: 'user' });
    const p1 = await Project.create({ name: 'MyProject', createdBy: user._id });
    await Project.create({ name: 'NotMine' });

    await ProjectMember.create({ projectId: p1._id, userId: user._id });

    const ctx = mockContext({ user: userPayload(String(user._id)) });
    const result = await ProjectQuery.projects(null, {}, ctx);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('MyProject');
  });

  it('throws when not authenticated', async () => {
    const ctx = mockContext();
    await expect(ProjectQuery.projects(null, {}, ctx)).rejects.toThrow(/logged in/);
  });
});

describe('project query', () => {
  it('returns project by ID', async () => {
    const user = await createUser();
    const project = await Project.create({ name: 'Test', createdBy: user._id });

    const ctx = mockContext({ user: userPayload(String(user._id)) });
    const result = await ProjectQuery.project(null, { id: String(project._id) }, ctx);

    expect(result.name).toBe('Test');
  });

  it('throws NotFound for bad ID', async () => {
    const user = await createUser();
    const ctx = mockContext({ user: userPayload(String(user._id)) });
    const fakeId = new mongoose.Types.ObjectId().toString();

    await expect(
      ProjectQuery.project(null, { id: fakeId }, ctx),
    ).rejects.toThrow(/not found/i);
  });
});

describe('projectMembers query', () => {
  it('returns members for project when user has access', async () => {
    const admin = await createUser({ username: 'superadmin', role: 'superadmin' });
    const member = await createUser({ username: 'member', role: 'user' });
    const project = await Project.create({ name: 'Team', createdBy: admin._id });

    await ProjectMember.create([
      { projectId: project._id, userId: admin._id },
      { projectId: project._id, userId: member._id },
    ]);

    const ctx = mockContext({ user: superadminPayload(String(admin._id)) });
    const result = await ProjectQuery.projectMembers(
      null,
      { projectId: String(project._id) },
      ctx,
    );

    expect(result).toHaveLength(2);
  });

  it('throws for non-member without superadmin role', async () => {
    const user = await createUser({ username: 'outsider', role: 'user' });
    const project = await Project.create({ name: 'Private' });

    const ctx = mockContext({ user: userPayload(String(user._id)) });

    await expect(
      ProjectQuery.projectMembers(null, { projectId: String(project._id) }, ctx),
    ).rejects.toThrow(/not a member/i);
  });
});

describe('createProject mutation', () => {
  it('creates project with manager role and auto-adds creator as member', async () => {
    const user = await createUser({ username: 'mgr', role: 'manager' });
    const ctx = mockContext({ user: managerPayload(String(user._id)) });

    const result = await ProjectMutation.createProject(
      null,
      { input: { name: 'New Project', description: 'A test project' } },
      ctx,
    );

    expect(result.name).toBe('New Project');
    expect(result.description).toBe('A test project');
    expect(String(result.createdBy)).toBe(String(user._id));

    // Verify creator was added as member
    const membership = await ProjectMember.findOne({
      projectId: result._id,
      userId: user._id,
    });
    expect(membership).not.toBeNull();
  });

  it('throws for regular user role', async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const ctx = mockContext({ user: userPayload(userId) });

    await expect(
      ProjectMutation.createProject(null, { input: { name: 'Nope' } }, ctx),
    ).rejects.toThrow(/Manager or Superadmin/);
  });

  it('throws when name is missing', async () => {
    const user = await createUser({ username: 'mgr', role: 'manager' });
    const ctx = mockContext({ user: managerPayload(String(user._id)) });

    await expect(
      ProjectMutation.createProject(null, { input: {} }, ctx),
    ).rejects.toThrow(/required/i);
  });
});

describe('updateProject mutation', () => {
  it('updates project fields for member', async () => {
    const user = await createUser({ username: 'mgr', role: 'manager' });
    const project = await Project.create({ name: 'Old Name', createdBy: user._id });
    await ProjectMember.create({ projectId: project._id, userId: user._id });

    const ctx = mockContext({ user: managerPayload(String(user._id)) });
    const result = await ProjectMutation.updateProject(
      null,
      {
        id: String(project._id),
        input: { name: 'Updated Name', status: 'paused', color: '#ef4444' },
      },
      ctx,
    );

    expect(result.name).toBe('Updated Name');
    expect(result.status).toBe('paused');
    expect(result.color).toBe('#ef4444');
  });

  it('throws for non-member (non-superadmin)', async () => {
    const user = await createUser({ username: 'outsider', role: 'manager' });
    const project = await Project.create({ name: 'Not Yours' });

    const ctx = mockContext({ user: managerPayload(String(user._id)) });

    await expect(
      ProjectMutation.updateProject(
        null,
        { id: String(project._id), input: { name: 'Hacked' } },
        ctx,
      ),
    ).rejects.toThrow(/not a member/i);
  });
});

describe('deleteProject mutation', () => {
  it('cascade-deletes all related data', async () => {
    const admin = await createUser({ username: 'superadmin', role: 'superadmin' });
    const project = await Project.create({ name: 'Doomed', createdBy: admin._id });

    // Create related data
    await ProjectMember.create({ projectId: project._id, userId: admin._id });

    const task = await Task.create({
      projectId: project._id,
      title: 'T1',
      status: 'backlog',
      createdBy: admin._id,
    });

    await Promise.all([
      Subtask.create({ taskId: task._id, title: 'Sub1' }),
      Comment.create({ taskId: task._id, authorId: admin._id, content: 'C1' }),
      TaskTag.create({ taskId: task._id, tagId: new mongoose.Types.ObjectId() }),
      AuditLog.create({
        taskId: task._id,
        userId: admin._id,
        userName: 'superadmin',
        action: 'task_created',
      }),
      Notification.create({
        taskId: task._id,
        userId: admin._id,
        type: 'assignment',
        content: 'Test',
      }),
    ]);

    const ctx = mockContext({ user: superadminPayload(String(admin._id)) });
    const result = await ProjectMutation.deleteProject(
      null,
      { id: String(project._id) },
      ctx,
    );

    expect(result).toBe(true);

    // Verify cascade
    expect(await Project.findById(project._id)).toBeNull();
    expect(await Task.countDocuments({ projectId: project._id })).toBe(0);
    expect(await Subtask.countDocuments({ taskId: task._id })).toBe(0);
    expect(await Comment.countDocuments({ taskId: task._id })).toBe(0);
    expect(await TaskTag.countDocuments({ taskId: task._id })).toBe(0);
    expect(await ProjectMember.countDocuments({ projectId: project._id })).toBe(0);
    expect(await AuditLog.countDocuments({ taskId: task._id })).toBe(0);
    expect(await Notification.countDocuments({ taskId: task._id })).toBe(0);
  });

  it('throws NotFound for nonexistent project', async () => {
    const admin = await createUser({ username: 'superadmin', role: 'superadmin' });
    const ctx = mockContext({ user: superadminPayload(String(admin._id)) });
    const fakeId = new mongoose.Types.ObjectId().toString();

    await expect(
      ProjectMutation.deleteProject(null, { id: fakeId }, ctx),
    ).rejects.toThrow(/not found/i);
  });
});

describe('addProjectMember mutation', () => {
  it('adds a new member to the project', async () => {
    const admin = await createUser({ username: 'superadmin', role: 'superadmin' });
    const newUser = await createUser({ username: 'newbie', role: 'user' });
    const project = await Project.create({ name: 'Team', createdBy: admin._id });

    const ctx = mockContext({ user: superadminPayload(String(admin._id)) });
    const result = await ProjectMutation.addProjectMember(
      null,
      { projectId: String(project._id), userId: String(newUser._id) },
      ctx,
    );

    expect(String(result.userId)).toBe(String(newUser._id));
    expect(String(result.projectId)).toBe(String(project._id));
  });

  it('throws for duplicate membership', async () => {
    const admin = await createUser({ username: 'superadmin', role: 'superadmin' });
    const member = await createUser({ username: 'member', role: 'user' });
    const project = await Project.create({ name: 'Team', createdBy: admin._id });
    await ProjectMember.create({ projectId: project._id, userId: member._id });

    const ctx = mockContext({ user: superadminPayload(String(admin._id)) });

    await expect(
      ProjectMutation.addProjectMember(
        null,
        { projectId: String(project._id), userId: String(member._id) },
        ctx,
      ),
    ).rejects.toThrow(/already a member/i);
  });

  it('throws for nonexistent user', async () => {
    const admin = await createUser({ username: 'superadmin', role: 'superadmin' });
    const project = await Project.create({ name: 'Team', createdBy: admin._id });
    const fakeUserId = new mongoose.Types.ObjectId().toString();

    const ctx = mockContext({ user: superadminPayload(String(admin._id)) });

    await expect(
      ProjectMutation.addProjectMember(
        null,
        { projectId: String(project._id), userId: fakeUserId },
        ctx,
      ),
    ).rejects.toThrow(/not found/i);
  });
});

describe('removeProjectMember mutation', () => {
  it('removes an existing member', async () => {
    const admin = await createUser({ username: 'superadmin', role: 'superadmin' });
    const member = await createUser({ username: 'member', role: 'user' });
    const project = await Project.create({ name: 'Team', createdBy: admin._id });
    await ProjectMember.create({ projectId: project._id, userId: member._id });

    const ctx = mockContext({ user: superadminPayload(String(admin._id)) });
    const result = await ProjectMutation.removeProjectMember(
      null,
      { projectId: String(project._id), userId: String(member._id) },
      ctx,
    );

    expect(result).toBe(true);
    expect(
      await ProjectMember.findOne({ projectId: project._id, userId: member._id }),
    ).toBeNull();
  });

  it('throws NotFound for non-member', async () => {
    const admin = await createUser({ username: 'superadmin', role: 'superadmin' });
    const project = await Project.create({ name: 'Team', createdBy: admin._id });
    const fakeUserId = new mongoose.Types.ObjectId().toString();

    const ctx = mockContext({ user: superadminPayload(String(admin._id)) });

    await expect(
      ProjectMutation.removeProjectMember(
        null,
        { projectId: String(project._id), userId: fakeUserId },
        ctx,
      ),
    ).rejects.toThrow(/not found/i);
  });
});

// ═══════════════════════════════════════════════════════════════
// PROJECT FIELD RESOLVERS
// ═══════════════════════════════════════════════════════════════

describe('Project field resolvers', () => {
  it('Project.folder returns the associated folder', async () => {
    const folder = await ProjectFolder.create({ name: 'Clinical', color: '#ff0000' });
    const project = await Project.create({ name: 'P1', folderId: folder._id });

    const result = await ProjectFieldResolvers.folder(project);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Clinical');
  });

  it('Project.folder returns null when no folderId', async () => {
    const project = await Project.create({ name: 'NoFolder' });

    const result = ProjectFieldResolvers.folder(project);
    expect(result).toBeNull();
  });

  it('Project.createdByUser returns the creator', async () => {
    const user = await createUser({ username: 'creator' });
    const project = await Project.create({ name: 'P1', createdBy: user._id });

    const result = await ProjectFieldResolvers.createdByUser(project);
    expect(result).not.toBeNull();
    expect(result!.username).toBe('creator');
  });

  it('Project.createdByUser returns null when no createdBy', async () => {
    const project = await Project.create({ name: 'Orphan' });

    const result = ProjectFieldResolvers.createdByUser(project);
    expect(result).toBeNull();
  });

  it('Project.memberCount returns correct count', async () => {
    const user1 = await createUser({ username: 'u1' });
    const user2 = await createUser({ username: 'u2' });
    const project = await Project.create({ name: 'Team' });

    await ProjectMember.create([
      { projectId: project._id, userId: user1._id },
      { projectId: project._id, userId: user2._id },
    ]);

    const count = await ProjectFieldResolvers.memberCount(project);
    expect(count).toBe(2);
  });
});
