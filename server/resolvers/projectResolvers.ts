import {
  Project,
  ProjectFolder,
  ProjectMember,
  User,
  Task,
  Subtask,
  Comment,
  TaskTag,
  AuditLog,
  Notification,
} from '@server/models/index.js';
import {
  requireAuth,
  requireManagerOrAbove,
  requireProjectAccess,
  type GraphQLContext,
} from '@server/utils/auth.js';
import { ValidationError, NotFoundError } from '@server/utils/errors.js';
import { sanitizeInput } from '@server/utils/validators.js';

export interface ProjectInput {
  name?: string;
  description?: string;
  status?: 'active' | 'paused' | 'completed';
  color?: string;
  category?: string;
  startDate?: string;
  endDate?: string;
  folderId?: string;
}

export const projectResolvers = {
  Query: {
    projects: async (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      const user = requireAuth(context);

      // Superadmin sees all projects
      if (user.role === 'superadmin') {
        return Project.find().sort({ createdAt: -1 }).exec();
      }

      // Others see only projects they're members of
      const memberships = await ProjectMember.find({ userId: user.id }).select('projectId');
      const projectIds = memberships.map((m) => m.projectId);
      return Project.find({ _id: { $in: projectIds } }).sort({ createdAt: -1 }).exec();
    },

    project: async (_parent: unknown, args: { id: string }, context: GraphQLContext) => {
      requireAuth(context);

      const project = await Project.findById(args.id);
      if (!project) {
        throw new NotFoundError('Project not found');
      }

      await requireProjectAccess(context, args.id);
      return project;
    },

    projectMembers: async (
      _parent: unknown,
      args: { projectId: string },
      context: GraphQLContext,
    ) => {
      await requireProjectAccess(context, args.projectId);
      const members = await ProjectMember.find({ projectId: args.projectId }).lean().exec();
      const userIds = members.map((m) => m.userId);
      const users = await User.find({ _id: { $in: userIds } }).lean().exec();
      const userMap = new Map(users.map((u) => [String(u._id), u]));
      return members.map((m) => ({
        ...m,
        userId: String(m.userId),
        user: userMap.get(String(m.userId)) ?? null,
      }));
    },
  },

  Mutation: {
    createProject: async (
      _parent: unknown,
      args: { input: ProjectInput },
      context: GraphQLContext,
    ) => {
      const user = requireManagerOrAbove(context);
      const { input } = args;

      if (!input.name) {
        throw new ValidationError('Project name is required');
      }

      const project = await Project.create({
        name: sanitizeInput(input.name.trim()),
        description: input.description ? sanitizeInput(input.description.trim()) : undefined,
        status: input.status ?? 'active',
        color: input.color ?? '#3b82f6',
        category: input.category,
        startDate: input.startDate,
        endDate: input.endDate,
        folderId: input.folderId || undefined,
        createdBy: user.id,
      });

      // Add creator as a project member
      await ProjectMember.create({
        projectId: project._id,
        userId: user.id,
      });

      return project;
    },

    updateProject: async (
      _parent: unknown,
      args: { id: string; input: ProjectInput },
      context: GraphQLContext,
    ) => {
      await requireProjectAccess(context, args.id);
      const { input } = args;

      const update: Record<string, unknown> = {};

      if (input.name !== undefined) {
        const name = sanitizeInput(input.name.trim());
        if (!name) {
          throw new ValidationError('Project name cannot be empty');
        }
        update.name = name;
      }
      if (input.description !== undefined) {
        update.description = input.description ? sanitizeInput(input.description.trim()) : '';
      }
      if (input.status !== undefined) update.status = input.status;
      if (input.color !== undefined) update.color = input.color;
      if (input.category !== undefined) update.category = input.category;
      if (input.startDate !== undefined) update.startDate = input.startDate;
      if (input.endDate !== undefined) update.endDate = input.endDate;
      if (input.folderId !== undefined) update.folderId = input.folderId || undefined;

      const project = await Project.findByIdAndUpdate(args.id, update, {
        new: true,
        runValidators: true,
      });

      if (!project) {
        throw new NotFoundError('Project not found');
      }

      return project;
    },

    deleteProject: async (
      _parent: unknown,
      args: { id: string },
      context: GraphQLContext,
    ) => {
      requireManagerOrAbove(context);
      await requireProjectAccess(context, args.id);

      const project = await Project.findByIdAndDelete(args.id);
      if (!project) {
        throw new NotFoundError('Project not found');
      }

      // Get all task IDs for this project to cascade-delete task-related data
      const tasks = await Task.find({ projectId: project._id }).select('_id');
      const taskIds = tasks.map((t) => t._id);

      // Cascade-delete all related data in parallel
      await Promise.all([
        ProjectMember.deleteMany({ projectId: project._id }),
        Subtask.deleteMany({ taskId: { $in: taskIds } }),
        Comment.deleteMany({ taskId: { $in: taskIds } }),
        TaskTag.deleteMany({ taskId: { $in: taskIds } }),
        AuditLog.deleteMany({ taskId: { $in: taskIds } }),
        Notification.deleteMany({ taskId: { $in: taskIds } }),
        Task.deleteMany({ projectId: project._id }),
      ]);

      return true;
    },

    addProjectMember: async (
      _parent: unknown,
      args: { projectId: string; userId: string },
      context: GraphQLContext,
    ) => {
      requireManagerOrAbove(context);
      await requireProjectAccess(context, args.projectId);

      // Verify the target user exists
      const targetUser = await User.findById(args.userId);
      if (!targetUser) {
        throw new NotFoundError('User not found');
      }

      // Check for existing membership
      const existing = await ProjectMember.findOne({
        projectId: args.projectId,
        userId: args.userId,
      });
      if (existing) {
        throw new ValidationError('User is already a member of this project');
      }

      return ProjectMember.create({
        projectId: args.projectId,
        userId: args.userId,
      });
    },

    removeProjectMember: async (
      _parent: unknown,
      args: { projectId: string; userId: string },
      context: GraphQLContext,
    ) => {
      requireManagerOrAbove(context);
      await requireProjectAccess(context, args.projectId);

      const member = await ProjectMember.findOneAndDelete({
        projectId: args.projectId,
        userId: args.userId,
      });

      if (!member) {
        throw new NotFoundError('Project member not found');
      }

      return true;
    },
  },

  Project: {
    folder: (parent: { folderId?: string }) => {
      if (!parent.folderId) return null;
      return ProjectFolder.findById(parent.folderId).exec();
    },

    createdByUser: (parent: { createdBy?: string }) => {
      if (!parent.createdBy) return null;
      return User.findById(parent.createdBy).exec();
    },

    memberCount: (parent: { _id: string }) => {
      return ProjectMember.countDocuments({ projectId: parent._id }).exec();
    },
  },

  ProjectMember: {
    userId: (parent: { userId: unknown }) =>
      parent.userId ? String(parent.userId) : '',

    user: (parent: { userId: unknown }) =>
      parent.userId ? User.findById(String(parent.userId)).exec() : null,
  },
};
