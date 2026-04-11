import crypto from 'crypto';
import { User, Invitation, AuditLog } from '@server/models/index.js';
import { requireAuth, requireSuperadmin, type GraphQLContext } from '@server/utils/auth.js';
import { ValidationError, NotFoundError } from '@server/utils/errors.js';
import { sanitizeInput } from '@server/utils/validators.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVITE_EXPIRY_DAYS = 7;

export const adminResolvers = {
  Query: {
    adminUsers: (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      requireSuperadmin(context);
      return User.find().sort({ createdAt: -1 }).exec();
    },

    adminInvitations: (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      requireSuperadmin(context);
      return Invitation.find().sort({ createdAt: -1 }).exec();
    },

    assignableUsers: (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      requireAuth(context);
      return User.find({ active: true }).select('_id username').sort({ username: 1 }).exec();
    },
  },

  Mutation: {
    updateUser: async (
      _parent: unknown,
      args: { id: string; role?: string; active?: boolean },
      context: GraphQLContext,
    ) => {
      const authUser = requireSuperadmin(context);

      if (args.active === false && args.id === authUser.id) {
        throw new ValidationError('Cannot deactivate your own account');
      }

      const setFields: Record<string, unknown> = {};
      if (args.role !== undefined) setFields.role = args.role;
      if (args.active !== undefined) setFields.active = args.active;

      const updateOp: Record<string, unknown> = { $set: setFields };
      if (args.active === false) {
        updateOp.$unset = { refreshTokenHash: 1 };
      }

      const user = await User.findByIdAndUpdate(args.id, updateOp, { new: true });
      if (!user) {
        throw new NotFoundError('User not found');
      }

      let action = 'user_updated';
      if (args.active === false) action = 'user_deactivated';
      else if (args.active === true) action = 'user_reactivated';
      else if (args.role !== undefined) action = 'user_role_changed';

      await AuditLog.create({
        userId: args.id,
        action,
        userName: authUser.username,
        changes: JSON.stringify({
          ...(args.role !== undefined ? { role: { to: args.role } } : {}),
          ...(args.active !== undefined ? { active: { to: args.active } } : {}),
        }),
        ipAddress: context.req.ip,
      });

      return user;
    },

    createInvitation: async (
      _parent: unknown,
      args: { email: string; role: string; projectId?: string },
      context: GraphQLContext,
    ) => {
      const authUser = requireSuperadmin(context);

      const email = sanitizeInput(args.email).toLowerCase();
      if (!EMAIL_RE.test(email)) {
        throw new ValidationError('Invalid email format');
      }

      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

      const invitation = await Invitation.create({
        email,
        token,
        role: args.role,
        projectId: args.projectId || undefined,
        invitedBy: authUser.id,
        expiresAt,
      });

      return invitation;
    },
  },
};
