import { describe, it, expect, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { User, Invitation, AuditLog } from '@server/models/index.js';
import { adminResolvers } from '@server/resolvers/adminResolvers.js';
import type { GraphQLContext, TokenPayload } from '@server/utils/auth.js';

// --- Test helpers ---

function mockContext(overrides: { user?: TokenPayload | null } = {}): GraphQLContext {
  return {
    user: overrides.user ?? null,
    req: { ip: '127.0.0.1', cookies: {} } as unknown as GraphQLContext['req'],
    res: { cookie: vi.fn(), clearCookie: vi.fn() } as unknown as GraphQLContext['res'],
  };
}

const VALID_PASSWORD = 'Test@1234';

async function createTestUser(overrides: Partial<{
  username: string;
  password: string;
  role: string;
  active: boolean;
}> = {}) {
  return User.create({
    username: overrides.username ?? 'testuser',
    password: overrides.password ?? VALID_PASSWORD,
    role: overrides.role ?? 'user',
    active: overrides.active ?? true,
  });
}

function superadminPayload(id: string): TokenPayload {
  return { id, username: 'admin', role: 'superadmin' };
}

function userPayload(id: string): TokenPayload {
  return { id, username: 'regular', role: 'user' };
}

const { Query, Mutation } = adminResolvers;

// --- Tests ---

beforeEach(async () => {
  await User.deleteMany({});
  await Invitation.deleteMany({});
  await AuditLog.deleteMany({});
});

// ─── adminUsers ─────────────────────────────────────────────

describe('adminUsers query', () => {
  it('returns all users for superadmin', async () => {
    const admin = await createTestUser({ username: 'admin', role: 'superadmin' });
    await createTestUser({ username: 'user1' });
    await createTestUser({ username: 'user2' });

    const ctx = mockContext({ user: superadminPayload(String(admin._id)) });
    const result = await Query.adminUsers(null, {}, ctx);

    expect(result).toHaveLength(3);
  });

  it('throws for non-superadmin', async () => {
    const user = await createTestUser({ username: 'regular' });
    const ctx = mockContext({ user: userPayload(String(user._id)) });

    expect(() => Query.adminUsers(null, {}, ctx)).toThrow();
  });

  it('returns users even if createdAt is missing on a document', async () => {
    const admin = await createTestUser({ username: 'admin', role: 'superadmin' });
    // Insert a legacy doc directly via Mongoose's collection to bypass timestamps
    await User.collection.insertOne({
      _id: new mongoose.Types.ObjectId(),
      username: 'legacy-user',
      password: 'hashed',
      role: 'user',
      active: true,
      failedAttempts: 0,
      mustChangePassword: false,
      // createdAt / updatedAt intentionally omitted
    });

    const ctx = mockContext({ user: superadminPayload(String(admin._id)) });
    // Should not throw — toISORequired provides fallback for missing timestamps
    const result = await Query.adminUsers(null, {}, ctx);
    expect(result.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── adminInvitations ───────────────────────────────────────

describe('adminInvitations query', () => {
  it('returns all invitations for superadmin', async () => {
    const admin = await createTestUser({ username: 'admin', role: 'superadmin' });

    await Invitation.create({
      email: 'a@test.com',
      token: 'tok-1',
      role: 'user',
      invitedBy: admin._id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    await Invitation.create({
      email: 'b@test.com',
      token: 'tok-2',
      role: 'manager',
      invitedBy: admin._id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    const ctx = mockContext({ user: superadminPayload(String(admin._id)) });
    const result = await Query.adminInvitations(null, {}, ctx);

    expect(result).toHaveLength(2);
  });

  it('throws for non-superadmin', async () => {
    const user = await createTestUser({ username: 'regular' });
    const ctx = mockContext({ user: userPayload(String(user._id)) });

    expect(() => Query.adminInvitations(null, {}, ctx)).toThrow();
  });
});

// ─── updateUser ─────────────────────────────────────────────

describe('updateUser mutation', () => {
  it('updates role', async () => {
    const admin = await createTestUser({ username: 'admin', role: 'superadmin' });
    const target = await createTestUser({ username: 'target' });

    const ctx = mockContext({ user: superadminPayload(String(admin._id)) });
    const result = await Mutation.updateUser(null, { id: String(target._id), role: 'manager' }, ctx);

    expect(result.role).toBe('manager');
  });

  it('updates active status', async () => {
    const admin = await createTestUser({ username: 'admin', role: 'superadmin' });
    const target = await createTestUser({ username: 'target' });

    const ctx = mockContext({ user: superadminPayload(String(admin._id)) });
    const result = await Mutation.updateUser(null, { id: String(target._id), active: false }, ctx);

    expect(result.active).toBe(false);
  });

  it('cannot deactivate own account', async () => {
    const admin = await createTestUser({ username: 'admin', role: 'superadmin' });

    const ctx = mockContext({ user: superadminPayload(String(admin._id)) });

    await expect(
      Mutation.updateUser(null, { id: String(admin._id), active: false }, ctx),
    ).rejects.toThrow(/own account/i);
  });

  it('throws NotFound for nonexistent user', async () => {
    const admin = await createTestUser({ username: 'admin', role: 'superadmin' });
    const fakeId = new mongoose.Types.ObjectId();

    const ctx = mockContext({ user: superadminPayload(String(admin._id)) });

    await expect(
      Mutation.updateUser(null, { id: String(fakeId), role: 'manager' }, ctx),
    ).rejects.toThrow(/not found/i);
  });

  it('throws for non-superadmin', async () => {
    const user = await createTestUser({ username: 'regular' });
    const target = await createTestUser({ username: 'target' });

    const ctx = mockContext({ user: userPayload(String(user._id)) });

    await expect(
      Mutation.updateUser(null, { id: String(target._id), role: 'manager' }, ctx),
    ).rejects.toThrow();
  });

  it('creates AuditLog entry when role is changed', async () => {
    const admin = await createTestUser({ username: 'admin', role: 'superadmin' });
    const target = await createTestUser({ username: 'target' });

    const ctx = mockContext({ user: superadminPayload(String(admin._id)) });
    await Mutation.updateUser(null, { id: String(target._id), role: 'manager' }, ctx);

    const log = await AuditLog.findOne({ action: 'user_role_changed' });
    expect(log).not.toBeNull();
    expect(log!.userName).toBe('admin');
  });

  it('creates AuditLog entry when user is deactivated', async () => {
    const admin = await createTestUser({ username: 'admin', role: 'superadmin' });
    const target = await createTestUser({ username: 'target' });

    const ctx = mockContext({ user: superadminPayload(String(admin._id)) });
    await Mutation.updateUser(null, { id: String(target._id), active: false }, ctx);

    const log = await AuditLog.findOne({ action: 'user_deactivated' });
    expect(log).not.toBeNull();
  });

  it('clears refreshTokenHash when deactivating a user', async () => {
    const admin = await createTestUser({ username: 'admin', role: 'superadmin' });
    const target = await createTestUser({ username: 'target' });
    // Manually set a refreshTokenHash on the target
    await User.findByIdAndUpdate(target._id, { refreshTokenHash: 'somehash' });

    const ctx = mockContext({ user: superadminPayload(String(admin._id)) });
    await Mutation.updateUser(null, { id: String(target._id), active: false }, ctx);

    const updated = await User.findById(target._id);
    expect(updated!.refreshTokenHash).toBeUndefined();
  });

  it('preserves refreshTokenHash when only changing role', async () => {
    const admin = await createTestUser({ username: 'admin', role: 'superadmin' });
    const target = await createTestUser({ username: 'target' });
    await User.findByIdAndUpdate(target._id, { refreshTokenHash: 'keepmyhash' });

    const ctx = mockContext({ user: superadminPayload(String(admin._id)) });
    await Mutation.updateUser(null, { id: String(target._id), role: 'manager' }, ctx);

    const updated = await User.findById(target._id);
    expect(updated!.refreshTokenHash).toBe('keepmyhash');
  });
});

// ─── createInvitation ───────────────────────────────────────

describe('createInvitation mutation', () => {
  it('creates invitation with token and 7-day expiry', async () => {
    const admin = await createTestUser({ username: 'admin', role: 'superadmin' });
    const ctx = mockContext({ user: superadminPayload(String(admin._id)) });

    const before = Date.now();
    const result = await Mutation.createInvitation(
      null,
      { email: 'new@example.com', role: 'user' },
      ctx,
    );

    expect(result.email).toBe('new@example.com');
    expect(result.role).toBe('user');
    expect(result.token).toBeDefined();
    expect(result.token.length).toBeGreaterThan(0);

    // Expiry should be ~7 days from now
    const expiryMs = new Date(result.expiresAt).getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(expiryMs).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000);
    expect(expiryMs).toBeLessThanOrEqual(Date.now() + sevenDaysMs + 1000);
  });

  it('throws for invalid email format', async () => {
    const admin = await createTestUser({ username: 'admin', role: 'superadmin' });
    const ctx = mockContext({ user: superadminPayload(String(admin._id)) });

    await expect(
      Mutation.createInvitation(null, { email: 'not-an-email', role: 'user' }, ctx),
    ).rejects.toThrow(/email/i);
  });

  it('throws for non-superadmin', async () => {
    const user = await createTestUser({ username: 'regular' });
    const ctx = mockContext({ user: userPayload(String(user._id)) });

    await expect(
      Mutation.createInvitation(null, { email: 'test@example.com', role: 'user' }, ctx),
    ).rejects.toThrow();
  });
});
