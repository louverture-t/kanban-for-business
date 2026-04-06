import { Notification } from '@server/models/index.js';
import { requireAuth, type GraphQLContext } from '@server/utils/auth.js';
import { NotFoundError } from '@server/utils/errors.js';

export const notificationResolvers = {
  Query: {
    notifications: (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      const user = requireAuth(context);
      return Notification.find({ userId: user.id }).sort({ createdAt: -1 }).exec();
    },
  },

  Mutation: {
    markNotificationRead: async (
      _parent: unknown,
      args: { id: string },
      context: GraphQLContext,
    ) => {
      const user = requireAuth(context);

      const notification = await Notification.findById(args.id);
      if (!notification) {
        throw new NotFoundError('Notification not found');
      }

      if (String(notification.userId) !== user.id) {
        throw new NotFoundError('Notification not found');
      }

      notification.read = true;
      await notification.save();

      return notification;
    },

    markAllNotificationsRead: async (
      _parent: unknown,
      _args: unknown,
      context: GraphQLContext,
    ) => {
      const user = requireAuth(context);

      await Notification.updateMany(
        { userId: user.id, read: false },
        { $set: { read: true } },
      );

      return true;
    },
  },
};
