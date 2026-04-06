import {
  Task,
  Project,
  User,
  Subtask,
  Comment,
  Tag,
  TaskTag,
  AuditLog,
  Notification,
  ProjectMember,
} from '@server/models/index.js';
import type { ITask } from '@server/models/index.js';
import {
  requireAuth,
  requireSuperadmin,
  requireProjectAccess,
  requireManagerOrAbove,
  type GraphQLContext,
} from '@server/utils/auth.js';
import { ValidationError, NotFoundError } from '@server/utils/errors.js';
import { sanitizeInput } from '@server/utils/validators.js';
import { runArchiveSweep, runPurgeSweep } from '@server/utils/sweeps.js';

export interface TaskInput {
  projectId?: string;
  title?: string;
  description?: string;
  status?: ITask['status'];
  priority?: ITask['priority'];
  startDate?: string;
  dueDate?: string;
  assigneeId?: string;
  position?: number;
}

export const taskResolvers = {
  Query: {
    tasks: async (
      _parent: unknown,
      args: { projectId?: string; includeArchived?: boolean },
      context: GraphQLContext,
    ) => {
      requireAuth(context);

      const filter: Record<string, unknown> = { deletedAt: null };

      if (args.projectId) {
        await requireProjectAccess(context, args.projectId);
        filter.projectId = args.projectId;
      }

      if (!args.includeArchived) {
        filter.archivedAt = null;
      }

      return Task.find(filter).sort({ position: 1 });
    },

    task: async (
      _parent: unknown,
      args: { id: string },
      context: GraphQLContext,
    ) => {
      requireAuth(context);

      const task = await Task.findById(args.id);
      if (!task) {
        throw new NotFoundError('Task not found');
      }

      await requireProjectAccess(context, String(task.projectId));
      return task;
    },

    searchTasks: async (
      _parent: unknown,
      args: { query: string },
      context: GraphQLContext,
    ) => {
      const user = requireAuth(context);

      if (!args.query.trim()) {
        throw new ValidationError('Search query cannot be empty');
      }

      const filter: Record<string, unknown> = {
        $text: { $search: args.query },
        deletedAt: null,
      };

      if (user.role !== 'superadmin') {
        const memberships = await ProjectMember.find({ userId: user.id });
        filter.projectId = { $in: memberships.map((m) => m.projectId) };
      }

      return Task.find(filter).sort({ score: { $meta: 'textScore' } });
    },

    trashedTasks: async (
      _parent: unknown,
      _args: unknown,
      context: GraphQLContext,
    ) => {
      const user = requireAuth(context);

      if (user.role === 'superadmin') {
        return Task.find({ deletedAt: { $ne: null } }).sort({ deletedAt: -1 });
      }

      // Non-superadmin: only tasks in projects they belong to
      const memberships = await ProjectMember.find({ userId: user.id });
      const projectIds = memberships.map((m) => m.projectId);

      return Task.find({
        deletedAt: { $ne: null },
        projectId: { $in: projectIds },
      }).sort({ deletedAt: -1 });
    },
  },

  Mutation: {
    createTask: async (
      _parent: unknown,
      args: { input: TaskInput },
      context: GraphQLContext,
    ) => {
      const user = requireAuth(context);
      const { input } = args;

      if (!input.projectId) {
        throw new ValidationError('projectId is required');
      }
      if (!input.title?.trim()) {
        throw new ValidationError('title is required');
      }

      await requireProjectAccess(context, input.projectId);

      const status = input.status || 'backlog';

      // Auto-set position to max + 1 in the project/status column
      const maxTask = await Task.findOne({
        projectId: input.projectId,
        status,
        deletedAt: null,
      }).sort({ position: -1 });
      const position = input.position ?? (maxTask ? maxTask.position + 1 : 0);

      const task = await Task.create({
        projectId: input.projectId,
        title: sanitizeInput(input.title.trim()),
        description: input.description ? sanitizeInput(input.description) : undefined,
        status,
        priority: input.priority || 'medium',
        startDate: input.startDate || undefined,
        dueDate: input.dueDate || undefined,
        assigneeId: input.assigneeId || undefined,
        position,
        createdBy: user.id,
        completedAt: status === 'complete' ? new Date() : undefined,
      });

      await AuditLog.create({
        taskId: task._id,
        userId: user.id,
        action: 'task_created',
        userName: user.username,
        ipAddress: context.req.ip,
      });

      return task;
    },

    updateTask: async (
      _parent: unknown,
      args: { id: string; input: TaskInput },
      context: GraphQLContext,
    ) => {
      const user = requireAuth(context);
      const { id, input } = args;

      const task = await Task.findById(id);
      if (!task || task.deletedAt) {
        throw new NotFoundError('Task not found');
      }

      await requireProjectAccess(context, String(task.projectId));

      // Owner-or-Manager+ guard: only assignee, creator, or Manager+ can update
      const isAssignee = task.assigneeId && String(task.assigneeId) === user.id;
      const isCreator = task.createdBy && String(task.createdBy) === user.id;
      if (!isAssignee && !isCreator) {
        requireManagerOrAbove(context);
      }

      const changes: Record<string, { from: unknown; to: unknown }> = {};
      const update: Record<string, unknown> = {};

      if (input.title !== undefined) {
        const sanitized = sanitizeInput(input.title.trim());
        if (sanitized !== task.title) {
          changes.title = { from: task.title, to: sanitized };
          update.title = sanitized;
        }
      }

      if (input.description !== undefined) {
        const sanitized = input.description ? sanitizeInput(input.description) : '';
        if (sanitized !== (task.description || '')) {
          changes.description = { from: task.description, to: sanitized };
          update.description = sanitized || undefined;
        }
      }

      if (input.status !== undefined && input.status !== task.status) {
        changes.status = { from: task.status, to: input.status };
        update.status = input.status;

        // Track completedAt transitions
        if (input.status === 'complete' && task.status !== 'complete') {
          update.completedAt = new Date();
        } else if (input.status !== 'complete' && task.status === 'complete') {
          update.completedAt = null;
        }
      }

      if (input.priority !== undefined && input.priority !== task.priority) {
        changes.priority = { from: task.priority, to: input.priority };
        update.priority = input.priority;
      }

      if (input.startDate !== undefined) {
        update.startDate = input.startDate || null;
      }

      if (input.dueDate !== undefined) {
        update.dueDate = input.dueDate || null;
      }

      if (input.position !== undefined && input.position !== task.position) {
        changes.position = { from: task.position, to: input.position };
        update.position = input.position;
      }

      if (input.assigneeId !== undefined) {
        const oldAssignee = task.assigneeId ? String(task.assigneeId) : null;
        const newAssignee = input.assigneeId || null;

        if (oldAssignee !== newAssignee) {
          changes.assigneeId = { from: oldAssignee, to: newAssignee };
          update.assigneeId = newAssignee;

          // Notify new assignee
          if (newAssignee) {
            await Notification.create({
              userId: newAssignee,
              type: 'assignment',
              content: `You were assigned to task "${task.title}"`,
              taskId: task._id,
            });
          }
        }
      }

      // If projectId is being moved (rare but supported)
      if (input.projectId && input.projectId !== String(task.projectId)) {
        await requireProjectAccess(context, input.projectId);
        changes.projectId = { from: String(task.projectId), to: input.projectId };
        update.projectId = input.projectId;
      }

      if (Object.keys(update).length === 0) {
        return task;
      }

      const updated = await Task.findByIdAndUpdate(id, update, { new: true });

      await AuditLog.create({
        taskId: task._id,
        userId: user.id,
        action: 'task_updated',
        userName: user.username,
        changes: JSON.stringify(changes),
        ipAddress: context.req.ip,
      });

      return updated;
    },

    deleteTask: async (
      _parent: unknown,
      args: { id: string },
      context: GraphQLContext,
    ) => {
      const user = requireAuth(context);

      const task = await Task.findById(args.id);
      if (!task || task.deletedAt) {
        throw new NotFoundError('Task not found');
      }

      await requireProjectAccess(context, String(task.projectId));

      const updated = await Task.findByIdAndUpdate(
        args.id,
        { deletedAt: new Date() },
        { new: true },
      );

      await AuditLog.create({
        taskId: task._id,
        userId: user.id,
        action: 'task_deleted',
        userName: user.username,
        ipAddress: context.req.ip,
      });

      return updated;
    },

    restoreTask: async (
      _parent: unknown,
      args: { id: string },
      context: GraphQLContext,
    ) => {
      const user = requireAuth(context);

      const task = await Task.findById(args.id);
      if (!task || !task.deletedAt) {
        throw new NotFoundError('Trashed task not found');
      }

      await requireProjectAccess(context, String(task.projectId));

      return Task.findByIdAndUpdate(
        args.id,
        { $unset: { deletedAt: 1 } },
        { new: true },
      );
    },

    unarchiveTask: async (
      _parent: unknown,
      args: { id: string },
      context: GraphQLContext,
    ) => {
      const user = requireAuth(context);

      const task = await Task.findById(args.id);
      if (!task || !task.archivedAt) {
        throw new NotFoundError('Archived task not found');
      }

      await requireProjectAccess(context, String(task.projectId));

      return Task.findByIdAndUpdate(
        args.id,
        { $unset: { archivedAt: 1 } },
        { new: true },
      );
    },

    archiveSweep: async (
      _parent: unknown,
      _args: unknown,
      context: GraphQLContext,
    ) => {
      requireSuperadmin(context);
      return runArchiveSweep();
    },

    purgeSweep: async (
      _parent: unknown,
      _args: unknown,
      context: GraphQLContext,
    ) => {
      requireSuperadmin(context);
      return runPurgeSweep();
    },
  },

  Task: {
    project: (task: ITask) => Project.findById(task.projectId),

    assignee: (task: ITask) =>
      task.assigneeId ? User.findById(task.assigneeId) : null,

    createdByUser: (task: ITask) =>
      task.createdBy ? User.findById(task.createdBy) : null,

    subtasks: (task: ITask) => Subtask.find({ taskId: task._id }),

    comments: (task: ITask) => Comment.find({ taskId: task._id }),

    tags: async (task: ITask) => {
      const taskTags = await TaskTag.find({ taskId: task._id });
      const tagIds = taskTags.map((tt) => tt.tagId);
      if (tagIds.length === 0) return [];
      return Tag.find({ _id: { $in: tagIds } });
    },
  },
};
