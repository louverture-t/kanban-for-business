import { describe, it, expect, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { User, AuditLog, Invitation } from '@server/models/index.js';
import { authResolvers } from '@server/resolvers/authResolvers.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyToken,
  hashRefreshToken,
  hashPassword,
  type GraphQLContext,
  type TokenPayload,
} from '@server/utils/auth.js';

// --- Test helpers ---

function mockContext(overrides: {
  user?: TokenPayload | null;
  cookies?: Record<string, string>;
} = {}): GraphQLContext {
  const cookieFn = vi.fn();
  const clearCookieFn = vi.fn();

  return {
    user: overrides.user ?? null,
    req: {
      ip: '127.0.0.1',
      cookies: overrides.cookies ?? {},
    } as unknown as GraphQLContext['req'],
    res: {
      cookie: cookieFn,
      clearCookie: clearCookieFn,
    } as unknown as GraphQLContext['res'],
  };
}

const VALID_PASSWORD = 'Test@1234';
const NEW_PASSWORD = 'NewP@ss99';

async function createTestUser(overrides: Partial<{
  username: string;
  password: string;
  role: string;
  active: boolean;
  failedAttempts: number;
  lockedUntil: Date;
  mustChangePassword: boolean;
  refreshTokenHash: string;
}> = {}) {
  return User.create({
    username: overrides.username ?? 'testuser',
    password: overrides.password ?? VALID_PASSWORD,
    role: overrides.role ?? 'user',
    active: overrides.active ?? true,
    failedAttempts: overrides.failedAttempts ?? 0,
    lockedUntil: overrides.lockedUntil,
    mustChangePassword: overrides.mustChangePassword ?? false,
    refreshTokenHash: overrides.refreshTokenHash,
  });
}

async function createInvitation(overrides: Partial<{
  email: string;
  token: string;
  role: string;
  status: string;
  expiresAt: Date;
  invitedBy: mongoose.Types.ObjectId;
}> = {}) {
  return Invitation.create({
    email: overrides.email ?? 'invite@test.com',
    token: overrides.token ?? 'valid-invite-token',
    role: overrides.role ?? 'user',
    status: overrides.status ?? 'pending',
    expiresAt: overrides.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    invitedBy: overrides.invitedBy ?? new mongoose.Types.ObjectId(),
  });
}

const { Query, Mutation } = authResolvers;

// --- Tests ---

beforeEach(async () => {
  await User.deleteMany({});
  await AuditLog.deleteMany({});
  await Invitation.deleteMany({});
});

// ─── me ────────────────────────��────────────────���───────────

describe('me query', () => {
  it('returns current user from context', async () => {
    const user = await createTestUser();
    const ctx = mockContext({
      user: { id: String(user._id), username: user.username, role: user.role },
    });

    const result = await Query.me(null, {}, ctx);
    expect(result).not.toBeNull();
    expect(result!.username).toBe('testuser');
  });

  it('throws when not authenticated', () => {
    const ctx = mockContext();
    expect(() => Query.me(null, {}, ctx)).toThrow(/logged in/);
  });
});

// ─── login ──────────────────────────────────────────────────

describe('login mutation', () => {
  it('returns access token and user with valid credentials', async () => {
    await createTestUser();
    const ctx = mockContext();

    const result = await Mutation.login(null, { username: 'testuser', password: VALID_PASSWORD }, ctx);

    expect(result.token).toBeDefined();
    expect(result.user.username).toBe('testuser');
    // Verify token is a valid JWT
    const decoded = verifyToken(result.token);
    expect(decoded.username).toBe('testuser');
  });

  it('sets refresh cookie on successful login', async () => {
    await createTestUser();
    const ctx = mockContext();

    await Mutation.login(null, { username: 'testuser', password: VALID_PASSWORD }, ctx);

    const cookieCall = (ctx.res.cookie as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(cookieCall[0]).toBe('refresh_token');
    expect(cookieCall[2]).toMatchObject({ httpOnly: true, path: '/graphql' });
  });

  it('logs login_success audit event', async () => {
    await createTestUser();
    const ctx = mockContext();

    await Mutation.login(null, { username: 'testuser', password: VALID_PASSWORD }, ctx);

    const log = await AuditLog.findOne({ action: 'login_success' });
    expect(log).not.toBeNull();
    expect(log!.userName).toBe('testuser');
  });

  it('increments failedAttempts on wrong password', async () => {
    await createTestUser();
    const ctx = mockContext();

    await expect(
      Mutation.login(null, { username: 'testuser', password: 'WrongP@ss1' }, ctx),
    ).rejects.toThrow(/Invalid credentials/);

    const updated = await User.findOne({ username: 'testuser' });
    expect(updated!.failedAttempts).toBe(1);
  });

  it('logs login_failed audit event on wrong password', async () => {
    await createTestUser();
    const ctx = mockContext();

    await expect(
      Mutation.login(null, { username: 'testuser', password: 'WrongP@ss1' }, ctx),
    ).rejects.toThrow();

    const log = await AuditLog.findOne({ action: 'login_failed' });
    expect(log).not.toBeNull();
  });

  it('locks account after 5 failed attempts', async () => {
    await createTestUser({ failedAttempts: 4 });
    const ctx = mockContext();

    await expect(
      Mutation.login(null, { username: 'testuser', password: 'WrongP@ss1' }, ctx),
    ).rejects.toThrow(/Invalid credentials/);

    const updated = await User.findOne({ username: 'testuser' });
    expect(updated!.failedAttempts).toBe(5);
    expect(updated!.lockedUntil).toBeDefined();
    expect(updated!.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
  });

  it('returns lockout error when account is locked', async () => {
    await createTestUser({
      lockedUntil: new Date(Date.now() + 10 * 60 * 1000), // 10 min from now
    });
    const ctx = mockContext();

    await expect(
      Mutation.login(null, { username: 'testuser', password: VALID_PASSWORD }, ctx),
    ).rejects.toThrow(/Account locked/);
  });

  it('allows login after lockout period expires', async () => {
    await createTestUser({
      failedAttempts: 5,
      lockedUntil: new Date(Date.now() - 1000), // expired 1s ago
    });
    const ctx = mockContext();

    const result = await Mutation.login(null, { username: 'testuser', password: VALID_PASSWORD }, ctx);
    expect(result.token).toBeDefined();

    const updated = await User.findOne({ username: 'testuser' });
    expect(updated!.failedAttempts).toBe(0);
  });

  it('resets failedAttempts on successful login', async () => {
    await createTestUser({ failedAttempts: 3 });
    const ctx = mockContext();

    await Mutation.login(null, { username: 'testuser', password: VALID_PASSWORD }, ctx);

    const updated = await User.findOne({ username: 'testuser' });
    expect(updated!.failedAttempts).toBe(0);
  });

  it('throws for nonexistent user', async () => {
    const ctx = mockContext();
    await expect(
      Mutation.login(null, { username: 'nobody', password: VALID_PASSWORD }, ctx),
    ).rejects.toThrow(/Invalid credentials/);
  });

  it('throws for deactivated account', async () => {
    await createTestUser({ active: false });
    const ctx = mockContext();

    await expect(
      Mutation.login(null, { username: 'testuser', password: VALID_PASSWORD }, ctx),
    ).rejects.toThrow(/deactivated/);
  });

  it('lockout error includes ACCOUNT_LOCKED code and lockoutMinutes in extensions', async () => {
    await createTestUser({
      lockedUntil: new Date(Date.now() + 10 * 60 * 1000), // 10 min from now
    });
    const ctx = mockContext();

    try {
      await Mutation.login(null, { username: 'testuser', password: VALID_PASSWORD }, ctx);
      expect.fail('should have thrown');
    } catch (err: unknown) {
      const gqlErr = err as any;
      expect(gqlErr.extensions?.code).toBe('ACCOUNT_LOCKED');
      expect(typeof gqlErr.extensions?.lockoutMinutes).toBe('number');
      expect(gqlErr.extensions?.lockoutMinutes).toBeGreaterThan(0);
    }
  });
});

// ─── register ───────────────────────────────────────────────

describe('register mutation', () => {
  it('creates user with correct role from invitation', async () => {
    await createInvitation({ role: 'manager' });
    const ctx = mockContext();

    const result = await Mutation.register(null, {
      username: 'newuser',
      password: VALID_PASSWORD,
      token: 'valid-invite-token',
    }, ctx);

    expect(result.token).toBeDefined();
    expect(result.user.username).toBe('newuser');
    expect(result.user.role).toBe('manager');
  });

  it('marks invitation as accepted', async () => {
    await createInvitation();
    const ctx = mockContext();

    await Mutation.register(null, {
      username: 'newuser',
      password: VALID_PASSWORD,
      token: 'valid-invite-token',
    }, ctx);

    const inv = await Invitation.findOne({ token: 'valid-invite-token' });
    expect(inv!.status).toBe('accepted');
  });

  it('throws for expired invitation token', async () => {
    await createInvitation({
      expiresAt: new Date(Date.now() - 1000), // expired
    });
    const ctx = mockContext();

    await expect(
      Mutation.register(null, {
        username: 'newuser',
        password: VALID_PASSWORD,
        token: 'valid-invite-token',
      }, ctx),
    ).rejects.toThrow(/expired/);
  });

  it('marks expired invitation status in DB', async () => {
    await createInvitation({
      expiresAt: new Date(Date.now() - 1000),
    });
    const ctx = mockContext();

    await expect(
      Mutation.register(null, {
        username: 'newuser',
        password: VALID_PASSWORD,
        token: 'valid-invite-token',
      }, ctx),
    ).rejects.toThrow();

    const inv = await Invitation.findOne({ token: 'valid-invite-token' });
    expect(inv!.status).toBe('expired');
  });

  it('throws for invalid invitation token', async () => {
    const ctx = mockContext();

    await expect(
      Mutation.register(null, {
        username: 'newuser',
        password: VALID_PASSWORD,
        token: 'bogus-token',
      }, ctx),
    ).rejects.toThrow(/Invalid or already-used/);
  });

  it('throws for invalid password', async () => {
    await createInvitation();
    const ctx = mockContext();

    await expect(
      Mutation.register(null, {
        username: 'newuser',
        password: 'weak',
        token: 'valid-invite-token',
      }, ctx),
    ).rejects.toThrow(/8 characters/);
  });

  it('throws for duplicate username', async () => {
    await createTestUser({ username: 'taken' });
    await createInvitation();
    const ctx = mockContext();

    await expect(
      Mutation.register(null, {
        username: 'taken',
        password: VALID_PASSWORD,
        token: 'valid-invite-token',
      }, ctx),
    ).rejects.toThrow(/already taken/);
  });
});

// ─── changePassword ─────────────────────────────────────────

describe('changePassword mutation', () => {
  it('updates password hash with correct current password', async () => {
    const user = await createTestUser();
    const oldHash = user.password;
    const ctx = mockContext({
      user: { id: String(user._id), username: user.username, role: user.role },
    });

    const result = await Mutation.changePassword(null, {
      currentPassword: VALID_PASSWORD,
      newPassword: NEW_PASSWORD,
    }, ctx);

    expect(result.username).toBe('testuser');
    const updated = await User.findById(user._id);
    expect(updated!.password).not.toBe(oldHash);
  });

  it('clears mustChangePassword flag', async () => {
    const user = await createTestUser({ mustChangePassword: true });
    const ctx = mockContext({
      user: { id: String(user._id), username: user.username, role: user.role },
    });

    await Mutation.changePassword(null, {
      currentPassword: VALID_PASSWORD,
      newPassword: NEW_PASSWORD,
    }, ctx);

    const updated = await User.findById(user._id);
    expect(updated!.mustChangePassword).toBe(false);
  });

  it('throws with wrong current password', async () => {
    const user = await createTestUser();
    const ctx = mockContext({
      user: { id: String(user._id), username: user.username, role: user.role },
    });

    await expect(
      Mutation.changePassword(null, {
        currentPassword: 'WrongP@ss1',
        newPassword: NEW_PASSWORD,
      }, ctx),
    ).rejects.toThrow(/incorrect/);
  });

  it('throws with invalid new password', async () => {
    const user = await createTestUser();
    const ctx = mockContext({
      user: { id: String(user._id), username: user.username, role: user.role },
    });

    await expect(
      Mutation.changePassword(null, {
        currentPassword: VALID_PASSWORD,
        newPassword: 'weak',
      }, ctx),
    ).rejects.toThrow(/8 characters/);
  });
});

// ─── refreshToken ───────────────────────────────────────────

describe('refreshToken mutation', () => {
  it('returns new access token with valid refresh cookie', async () => {
    const user = await createTestUser();
    const payload: TokenPayload = { id: String(user._id), username: user.username, role: user.role };
    const refreshToken = signRefreshToken(payload);
    const refreshHash = await hashRefreshToken(refreshToken);
    await User.findByIdAndUpdate(user._id, { refreshTokenHash: refreshHash });

    const ctx = mockContext({ cookies: { refresh_token: refreshToken } });

    const result = await Mutation.refreshToken(null, {}, ctx);
    expect(result.token).toBeDefined();
    const decoded = verifyToken(result.token);
    expect(decoded.username).toBe('testuser');
  });

  it('rotates the refresh token (old hash invalidated)', async () => {
    const user = await createTestUser();
    const payload: TokenPayload = { id: String(user._id), username: user.username, role: user.role };
    const refreshToken = signRefreshToken(payload);
    const oldHash = await hashRefreshToken(refreshToken);
    await User.findByIdAndUpdate(user._id, { refreshTokenHash: oldHash });

    const ctx = mockContext({ cookies: { refresh_token: refreshToken } });

    await Mutation.refreshToken(null, {}, ctx);

    const updated = await User.findById(user._id);
    expect(updated!.refreshTokenHash).not.toBe(oldHash);
  });

  it('sets new refresh cookie', async () => {
    const user = await createTestUser();
    const payload: TokenPayload = { id: String(user._id), username: user.username, role: user.role };
    const refreshToken = signRefreshToken(payload);
    const refreshHash = await hashRefreshToken(refreshToken);
    await User.findByIdAndUpdate(user._id, { refreshTokenHash: refreshHash });

    const ctx = mockContext({ cookies: { refresh_token: refreshToken } });

    await Mutation.refreshToken(null, {}, ctx);

    const cookieCall = (ctx.res.cookie as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(cookieCall[0]).toBe('refresh_token');
  });

  it('throws with no refresh cookie', async () => {
    const ctx = mockContext();
    await expect(
      Mutation.refreshToken(null, {}, ctx),
    ).rejects.toThrow(/No refresh token/);
  });

  it('throws with invalid/expired refresh cookie', async () => {
    const ctx = mockContext({ cookies: { refresh_token: 'garbage-token' } });
    await expect(
      Mutation.refreshToken(null, {}, ctx),
    ).rejects.toThrow(/Invalid or expired/);
  });

  it('throws for deactivated user with valid refresh token', async () => {
    const user = await createTestUser({ active: false });
    const payload: TokenPayload = { id: String(user._id), username: user.username, role: user.role };
    const refreshToken = signRefreshToken(payload);
    const refreshHash = await hashRefreshToken(refreshToken);
    await User.findByIdAndUpdate(user._id, { refreshTokenHash: refreshHash });

    const ctx = mockContext({ cookies: { refresh_token: refreshToken } });

    await expect(
      Mutation.refreshToken(null, {}, ctx),
    ).rejects.toThrow(/Invalid refresh token/);
  });
});

// ─── logout ─────────────────────────────────────────────────

describe('logout mutation', () => {
  it('clears refreshTokenHash on user', async () => {
    const user = await createTestUser();
    const payload: TokenPayload = { id: String(user._id), username: user.username, role: user.role };
    const refreshToken = signRefreshToken(payload);
    const refreshHash = await hashRefreshToken(refreshToken);
    await User.findByIdAndUpdate(user._id, { refreshTokenHash: refreshHash });

    const ctx = mockContext({
      user: payload,
    });

    const result = await Mutation.logout(null, {}, ctx);
    expect(result).toBe(true);

    const updated = await User.findById(user._id);
    expect(updated!.refreshTokenHash).toBeUndefined();
  });

  it('clears refresh cookie', async () => {
    const user = await createTestUser();
    const ctx = mockContext({
      user: { id: String(user._id), username: user.username, role: user.role },
    });

    await Mutation.logout(null, {}, ctx);

    const clearCall = (ctx.res.clearCookie as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(clearCall[0]).toBe('refresh_token');
    expect(clearCall[1]).toMatchObject({ httpOnly: true, path: '/graphql' });
  });
});
