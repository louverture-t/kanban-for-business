import { describe, it, expect, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { Notification } from '@server/models/index.js';
import { notificationResolvers } from '@server/resolvers/notificationResolvers.js';
import type { GraphQLContext, TokenPayload } from '@server/utils/auth.js';

// --- Test helpers ---

function mockContext(overrides: { user?: TokenPayload | null } = {}): GraphQLContext {
  return {
    user: overrides.user ?? null,
    req: { ip: '127.0.0.1', cookies: {} } as unknown as GraphQLContext['req'],
    res: { cookie: vi.fn(), clearCookie: vi.fn() } as unknown as GraphQLContext['res'],
  };
}

const userId = new mongoose.Types.ObjectId();
const otherUserId = new mongoose.Types.ObjectId();

const testUser: TokenPayload = {
  id: String(userId),
  username: 'testuser',
  role: 'user',
};

const { Query, Mutation } = notificationResolvers;

// --- Tests ---

beforeEach(async () => {
  await Notification.deleteMany({});
});

// ─── notifications query ────────────────────────────────────

describe('notifications query', () => {
  it('returns only current user notifications sorted by createdAt desc', async () => {
    // Create notifications with staggered dates
    await Notification.create({
      userId,
      type: 'assignment',
      content: 'Older notification',
      read: false,
      createdAt: new Date('2025-01-01'),
    });
    await Notification.create({
      userId,
      type: 'comment',
      content: 'Newer notification',
      read: false,
      createdAt: new Date('2025-06-01'),
    });
    // Other user's notification — should not appear
    await Notification.create({
      userId: otherUserId,
      type: 'due_date',
      content: 'Not mine',
      read: false,
    });

    const ctx = mockContext({ user: testUser });
    const result = await Query.notifications(null, {}, ctx);

    expect(result).toHaveLength(2);
    expect(result[0].content).toBe('Newer notification');
    expect(result[1].content).toBe('Older notification');
  });

  it('throws when not authenticated', () => {
    const ctx = mockContext();
    expect(() => Query.notifications(null, {}, ctx)).toThrow();
  });
});

// ─── markNotificationRead ───────────────────────────────────

describe('markNotificationRead mutation', () => {
  it('sets read=true on the notification', async () => {
    const notification = await Notification.create({
      userId,
      type: 'assignment',
      content: 'Test notification',
      read: false,
    });

    const ctx = mockContext({ user: testUser });
    const result = await Mutation.markNotificationRead(null, { id: String(notification._id) }, ctx);

    expect(result.read).toBe(true);

    const updated = await Notification.findById(notification._id);
    expect(updated!.read).toBe(true);
  });

  it('throws NotFound if notification belongs to a different user', async () => {
    const notification = await Notification.create({
      userId: otherUserId,
      type: 'assignment',
      content: 'Not mine',
      read: false,
    });

    const ctx = mockContext({ user: testUser });

    await expect(
      Mutation.markNotificationRead(null, { id: String(notification._id) }, ctx),
    ).rejects.toThrow(/not found/i);
  });

  it('throws NotFound for nonexistent notification', async () => {
    const ctx = mockContext({ user: testUser });
    const fakeId = new mongoose.Types.ObjectId();

    await expect(
      Mutation.markNotificationRead(null, { id: String(fakeId) }, ctx),
    ).rejects.toThrow(/not found/i);
  });
});

// ─── markAllNotificationsRead ───────────────────────────────

describe('markAllNotificationsRead mutation', () => {
  it('marks all unread notifications for the user as read', async () => {
    await Notification.create([
      { userId, type: 'assignment', content: 'N1', read: false },
      { userId, type: 'comment', content: 'N2', read: false },
      { userId, type: 'due_date', content: 'N3', read: true }, // already read
    ]);
    // Other user — should remain unread
    await Notification.create({
      userId: otherUserId,
      type: 'assignment',
      content: 'Other user',
      read: false,
    });

    const ctx = mockContext({ user: testUser });
    const result = await Mutation.markAllNotificationsRead(null, {}, ctx);

    expect(result).toBe(true);

    const myNotifs = await Notification.find({ userId });
    expect(myNotifs.every((n) => n.read === true)).toBe(true);

    // Other user's notification should be untouched
    const otherNotif = await Notification.findOne({ userId: otherUserId });
    expect(otherNotif!.read).toBe(false);
  });

  it('returns true even when there are no unread notifications', async () => {
    const ctx = mockContext({ user: testUser });
    const result = await Mutation.markAllNotificationsRead(null, {}, ctx);
    expect(result).toBe(true);
  });
});
