import crypto from 'crypto';
import { User, Invitation } from '@server/models/index.js';
import { requireSuperadmin, type GraphQLContext } from '@server/utils/auth.js';
import { ValidationError, NotFoundError } from '@server/utils/errors.js';
import { sanitizeInput } from '@server/utils/validators.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVITE_EXPIRY_DAYS = 7;

export const adminResolvers = {
  Query: {
    adminUsers: (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      requireSuperadmin(context);
      return User.find().sort({ createdAt: -1 });
    },

    adminInvitations: (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      requireSuperadmin(context);
      return Invitation.find().sort({ createdAt: -1 });
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

      const update: Record<string, unknown> = {};
      if (args.role !== undefined) update.role = args.role;
      if (args.active !== undefined) update.active = args.active;

      const user = await User.findByIdAndUpdate(args.id, update, { new: true });
      if (!user) {
        throw new NotFoundError('User not found');
      }

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
