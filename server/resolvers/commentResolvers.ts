import { Comment, Task, User, AuditLog, Notification } from '@server/models/index.js';
import {
  requireAuth,
  requireManagerOrAbove,
  type GraphQLContext,
} from '@server/utils/auth.js';
import { ValidationError, NotFoundError } from '@server/utils/errors.js';
import { sanitizeInput } from '@server/utils/validators.js';

export const commentResolvers = {
  Query: {
    comments: async (
      _parent: unknown,
      args: { taskId: string },
      context: GraphQLContext,
    ) => {
      requireAuth(context);
      return Comment.find({ taskId: args.taskId }).sort({ createdAt: 1 }).exec();
    },

    auditLogs: async (
      _parent: unknown,
      args: { taskId: string },
      context: GraphQLContext,
    ) => {
      requireAuth(context);
      return AuditLog.find({ taskId: args.taskId }).sort({ createdAt: -1 }).exec();
    },
  },

  Mutation: {
    createComment: async (
      _parent: unknown,
      args: { taskId: string; content: string },
      context: GraphQLContext,
    ) => {
      const user = requireAuth(context);

      const task = await Task.findById(args.taskId);
      if (!task) {
        throw new NotFoundError('Task not found');
      }

      const content = sanitizeInput(args.content);
      if (!content.trim()) {
        throw new ValidationError('Comment content is required');
      }

      const comment = await Comment.create({
        taskId: args.taskId,
        content,
        authorId: user.id,
      });

      await AuditLog.create({
        taskId: args.taskId,
        userId: user.id,
        action: 'comment_created',
        userName: user.username,
      });

      // Notify task assignee if they are not the commenter
      if (task.assigneeId && String(task.assigneeId) !== user.id) {
        await Notification.create({
          userId: task.assigneeId,
          type: 'comment',
          content: `${user.username} commented on "${task.title}"`,
          read: false,
          taskId: args.taskId,
        });
      }

      return comment;
    },

    deleteComment: async (
      _parent: unknown,
      args: { id: string },
      context: GraphQLContext,
    ) => {
      const user = requireAuth(context);

      const comment = await Comment.findById(args.id);
      if (!comment) {
        throw new NotFoundError('Comment not found');
      }

      // Only the author or a manager+ can delete
      const isAuthor = String(comment.authorId) === user.id;
      if (!isAuthor) {
        requireManagerOrAbove(context);
      }

      await Comment.findByIdAndDelete(args.id);

      await AuditLog.create({
        taskId: comment.taskId,
        userId: user.id,
        action: 'comment_deleted',
        userName: user.username,
      });

      return true;
    },
  },

  Comment: {
    author: async (parent: { authorId: string }) => {
      return User.findById(parent.authorId).exec();
    },
  },
};
