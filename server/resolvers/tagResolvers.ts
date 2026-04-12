import { Tag, TaskTag, Task } from '@server/models/index.js';
import {
  requireAuth,
  requireManagerOrAbove,
  requireProjectAccess,
  type GraphQLContext,
} from '@server/utils/auth.js';
import { NotFoundError, ValidationError } from '@server/utils/errors.js';
import { sanitizeInput } from '@server/utils/validators.js';

export const tagResolvers = {
  Query: {
    tags: async (
      _parent: unknown,
      _args: unknown,
      context: GraphQLContext,
    ) => {
      requireAuth(context);
      return Tag.find().sort({ name: 1 }).exec();
    },

    taskTags: async (
      _parent: unknown,
      args: { taskId: string },
      context: GraphQLContext,
    ) => {
      const task = await Task.findById(args.taskId);
      if (!task) {
        throw new NotFoundError('Task not found');
      }
      await requireProjectAccess(context, String(task.projectId));
      const taskTags = await TaskTag.find({ taskId: args.taskId }).exec();
      const tagIds = taskTags.map((tt) => tt.tagId);
      return Tag.find({ _id: { $in: tagIds } }).sort({ name: 1 }).exec();
    },
  },

  Mutation: {
    createTag: async (
      _parent: unknown,
      args: { name: string; color?: string },
      context: GraphQLContext,
    ) => {
      requireManagerOrAbove(context);

      const name = sanitizeInput(args.name);
      if (!name.trim()) {
        throw new ValidationError('Tag name is required');
      }

      return Tag.create({
        name,
        color: args.color ?? '#6b7280',
      });
    },

    addTagToTask: async (
      _parent: unknown,
      args: { taskId: string; tagId: string },
      context: GraphQLContext,
    ) => {
      requireAuth(context);

      const task = await Task.findById(args.taskId);
      if (!task) {
        throw new NotFoundError('Task not found');
      }
      await requireProjectAccess(context, String(task.projectId));

      const tag = await Tag.findById(args.tagId);
      if (!tag) {
        throw new NotFoundError('Tag not found');
      }

      // Handle duplicate gracefully — return existing if already linked
      const existing = await TaskTag.findOne({
        taskId: args.taskId,
        tagId: args.tagId,
      });

      if (existing) {
        return existing;
      }

      return TaskTag.create({
        taskId: args.taskId,
        tagId: args.tagId,
      });
    },

    removeTagFromTask: async (
      _parent: unknown,
      args: { taskId: string; tagId: string },
      context: GraphQLContext,
    ) => {
      requireAuth(context);

      const removeTask = await Task.findById(args.taskId);
      if (!removeTask) {
        throw new NotFoundError('Task not found');
      }
      await requireProjectAccess(context, String(removeTask.projectId));

      const result = await TaskTag.findOneAndDelete({
        taskId: args.taskId,
        tagId: args.tagId,
      });

      if (!result) {
        throw new NotFoundError('Tag not associated with this task');
      }

      return true;
    },
  },
};
