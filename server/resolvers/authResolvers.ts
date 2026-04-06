import { GraphQLError } from 'graphql';
import { User, AuditLog, Invitation } from '@server/models/index.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyToken,
  comparePassword,
  hashRefreshToken,
  requireAuth,
  type GraphQLContext,
  type TokenPayload,
} from '@server/utils/auth.js';
import { AuthenticationError, ValidationError } from '@server/utils/errors.js';
import { validatePassword, validateUsername, sanitizeInput } from '@server/utils/validators.js';
import { REFRESH_COOKIE_OPTIONS } from '@server/config/cookies.js';

const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const MAX_FAILED_ATTEMPTS = 5;

function toTokenPayload(user: { _id: unknown; username: string; role: string }): TokenPayload {
  return {
    id: String(user._id),
    username: user.username,
    role: user.role as TokenPayload['role'],
  };
}

async function issueTokens(
  payload: TokenPayload,
  context: GraphQLContext,
): Promise<{ token: string }> {
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  // Store hashed refresh token on user doc
  const refreshHash = await hashRefreshToken(refreshToken);
  await User.findByIdAndUpdate(payload.id, { refreshTokenHash: refreshHash });

  // Set refresh token as HttpOnly cookie
  context.res.cookie('refresh_token', refreshToken, REFRESH_COOKIE_OPTIONS);

  return { token: accessToken };
}

export const authResolvers = {
  Query: {
    me: (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      const user = requireAuth(context);
      return User.findById(user.id).exec();
    },
  },

  Mutation: {
    login: async (
      _parent: unknown,
      args: { username: string; password: string },
      context: GraphQLContext,
    ) => {
      const { username, password } = args;

      const user = await User.findOne({ username });
      if (!user) {
        throw new AuthenticationError('Invalid credentials');
      }

      if (!user.active) {
        throw new AuthenticationError('Account is deactivated');
      }

      // Check lockout
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        const remaining = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
        throw new GraphQLError(
          `Account locked. Try again in ${remaining} minute${remaining !== 1 ? 's' : ''}.`,
          {
            extensions: {
              code: 'ACCOUNT_LOCKED',
              lockoutMinutes: remaining,
            },
          },
        );
      }

      const valid = await comparePassword(password, user.password);

      if (!valid) {
        const attempts = user.failedAttempts + 1;
        const update: Record<string, unknown> = { failedAttempts: attempts };

        if (attempts >= MAX_FAILED_ATTEMPTS) {
          update.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
        }

        await User.findByIdAndUpdate(user._id, update);

        await AuditLog.create({
          userId: user._id,
          action: 'login_failed',
          userName: user.username,
          ipAddress: context.req.ip,
        });

        throw new AuthenticationError('Invalid credentials');
      }

      // Reset failed attempts on successful login
      await User.findByIdAndUpdate(user._id, {
        failedAttempts: 0,
        lockedUntil: undefined,
      });

      await AuditLog.create({
        userId: user._id,
        action: 'login_success',
        userName: user.username,
        ipAddress: context.req.ip,
      });

      const payload = toTokenPayload(user);
      const { token } = await issueTokens(payload, context);

      return { token, user };
    },

    register: async (
      _parent: unknown,
      args: { username: string; password: string; email?: string; token: string },
      context: GraphQLContext,
    ) => {
      const { username, password, email, token: inviteToken } = args;

      // Validate invite token
      const invitation = await Invitation.findOne({
        token: inviteToken,
        status: 'pending',
      });

      if (!invitation) {
        throw new ValidationError('Invalid or already-used invitation token');
      }

      if (invitation.expiresAt < new Date()) {
        await Invitation.findByIdAndUpdate(invitation._id, { status: 'expired' });
        throw new ValidationError('Invitation token has expired');
      }

      // Validate inputs
      const usernameCheck = validateUsername(username);
      if (!usernameCheck.valid) {
        throw new ValidationError(usernameCheck.message);
      }

      const passwordCheck = validatePassword(password);
      if (!passwordCheck.valid) {
        throw new ValidationError(passwordCheck.message);
      }

      // Check uniqueness
      const existing = await User.findOne({ username });
      if (existing) {
        throw new ValidationError('Username already taken');
      }

      // Create user (password hashed by pre-save hook)
      const user = await User.create({
        username: sanitizeInput(username),
        email: email ? sanitizeInput(email) : undefined,
        password,
        role: invitation.role,
      });

      // Mark invitation accepted
      await Invitation.findByIdAndUpdate(invitation._id, { status: 'accepted' });

      const payload = toTokenPayload(user);
      const { token } = await issueTokens(payload, context);

      return { token, user };
    },

    changePassword: async (
      _parent: unknown,
      args: { currentPassword: string; newPassword: string },
      context: GraphQLContext,
    ) => {
      const authUser = requireAuth(context);
      const { currentPassword, newPassword } = args;

      const user = await User.findById(authUser.id);
      if (!user) {
        throw new AuthenticationError('User not found');
      }

      const valid = await comparePassword(currentPassword, user.password);
      if (!valid) {
        throw new AuthenticationError('Current password is incorrect');
      }

      const passwordCheck = validatePassword(newPassword);
      if (!passwordCheck.valid) {
        throw new ValidationError(passwordCheck.message);
      }

      // Assign and save (pre-save hook hashes)
      user.password = newPassword;
      user.mustChangePassword = false;
      await user.save();

      return user;
    },

    refreshToken: async (
      _parent: unknown,
      _args: unknown,
      context: GraphQLContext,
    ) => {
      const token = context.req.cookies?.refresh_token;
      if (!token) {
        throw new AuthenticationError('No refresh token');
      }

      let payload: TokenPayload;
      try {
        payload = verifyToken(token);
      } catch {
        throw new AuthenticationError('Invalid or expired refresh token');
      }

      const user = await User.findById(payload.id);
      if (!user || !user.active || !user.refreshTokenHash) {
        throw new AuthenticationError('Invalid refresh token');
      }

      // Verify the token matches stored hash
      const valid = await comparePassword(token, user.refreshTokenHash);
      if (!valid) {
        throw new AuthenticationError('Invalid refresh token');
      }

      // Rotate: issue new tokens (invalidates old refresh hash)
      const newPayload = toTokenPayload(user);
      const { token: accessToken } = await issueTokens(newPayload, context);

      return { token: accessToken, user };
    },

    logout: async (
      _parent: unknown,
      _args: unknown,
      context: GraphQLContext,
    ) => {
      const authUser = requireAuth(context);

      // Clear refresh token hash from DB
      await User.findByIdAndUpdate(authUser.id, {
        $unset: { refreshTokenHash: 1 },
      });

      // Clear cookie
      context.res.clearCookie('refresh_token', {
        httpOnly: REFRESH_COOKIE_OPTIONS.httpOnly,
        secure: REFRESH_COOKIE_OPTIONS.secure,
        sameSite: REFRESH_COOKIE_OPTIONS.sameSite,
        path: REFRESH_COOKIE_OPTIONS.path,
      });

      return true;
    },
  },
};
