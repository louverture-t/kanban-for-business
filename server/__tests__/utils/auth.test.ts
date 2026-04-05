import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import {
  signAccessToken,
  signRefreshToken,
  verifyToken,
  hashPassword,
  comparePassword,
  requireAuth,
  requireManagerOrAbove,
  requireSuperadmin,
  type TokenPayload,
  type GraphQLContext,
} from '@server/utils/auth.js';
import { AuthenticationError, ForbiddenError } from '@server/utils/errors.js';

// Minimal req/res stubs for GraphQLContext
const mockReq = {} as GraphQLContext['req'];
const mockRes = {} as GraphQLContext['res'];

function makeCtx(user: TokenPayload | null): GraphQLContext {
  return { user, req: mockReq, res: mockRes };
}

const mockUser: TokenPayload = {
  id: '507f1f77bcf86cd799439011',
  username: 'testuser',
  role: 'user',
};

const mockManager: TokenPayload = { ...mockUser, role: 'manager' };
const mockSuperadmin: TokenPayload = { ...mockUser, role: 'superadmin' };

describe('signAccessToken / verifyToken', () => {
  it('returns a valid JWT decodable by verifyToken', () => {
    const token = signAccessToken(mockUser);
    const decoded = verifyToken(token);

    expect(decoded.id).toBe(mockUser.id);
    expect(decoded.username).toBe(mockUser.username);
    expect(decoded.role).toBe(mockUser.role);
  });

  it('includes correct user payload (id, role, username)', () => {
    const token = signAccessToken(mockSuperadmin);
    const decoded = verifyToken(token);

    expect(decoded.id).toBe(mockSuperadmin.id);
    expect(decoded.role).toBe('superadmin');
    expect(decoded.username).toBe('testuser');
  });

  it('throws on expired token', () => {
    const expired = jwt.sign(
      { id: mockUser.id, username: mockUser.username, role: mockUser.role },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '0s' },
    );

    expect(() => verifyToken(expired)).toThrow();
  });

  it('throws on invalid/tampered token', () => {
    expect(() => verifyToken('not.a.valid.token')).toThrow();

    const validToken = signAccessToken(mockUser);
    const tampered = validToken.slice(0, -5) + 'XXXXX';
    expect(() => verifyToken(tampered)).toThrow();
  });
});

describe('signRefreshToken', () => {
  it('returns a valid JWT with user payload', () => {
    const token = signRefreshToken(mockUser);
    const decoded = verifyToken(token);

    expect(decoded.id).toBe(mockUser.id);
    expect(decoded.username).toBe(mockUser.username);
  });
});

describe('hashPassword / comparePassword', () => {
  it('round-trip succeeds for correct password', async () => {
    const password = 'MyP@ssw0rd!';
    const hash = await hashPassword(password);
    const result = await comparePassword(password, hash);

    expect(result).toBe(true);
  });

  it('rejects wrong password', async () => {
    const hash = await hashPassword('CorrectP@ss1');
    const result = await comparePassword('WrongP@ss1', hash);

    expect(result).toBe(false);
  });
});

describe('requireAuth', () => {
  it('throws AuthenticationError when no user in context', () => {
    const ctx = makeCtx(null);
    expect(() => requireAuth(ctx)).toThrow(AuthenticationError);
  });

  it('passes when user exists in context', () => {
    const ctx = makeCtx(mockUser);
    const result = requireAuth(ctx);
    expect(result.id).toBe(mockUser.id);
  });
});

describe('requireManagerOrAbove', () => {
  it('throws ForbiddenError for role "user"', () => {
    const ctx = makeCtx(mockUser);
    expect(() => requireManagerOrAbove(ctx)).toThrow(ForbiddenError);
  });

  it('passes for "manager"', () => {
    const ctx = makeCtx(mockManager);
    const result = requireManagerOrAbove(ctx);
    expect(result.role).toBe('manager');
  });

  it('passes for "superadmin"', () => {
    const ctx = makeCtx(mockSuperadmin);
    const result = requireManagerOrAbove(ctx);
    expect(result.role).toBe('superadmin');
  });
});

describe('requireSuperadmin', () => {
  it('throws ForbiddenError for "manager"', () => {
    const ctx = makeCtx(mockManager);
    expect(() => requireSuperadmin(ctx)).toThrow(ForbiddenError);
  });

  it('throws ForbiddenError for "user"', () => {
    const ctx = makeCtx(mockUser);
    expect(() => requireSuperadmin(ctx)).toThrow(ForbiddenError);
  });

  it('passes for "superadmin"', () => {
    const ctx = makeCtx(mockSuperadmin);
    const result = requireSuperadmin(ctx);
    expect(result.role).toBe('superadmin');
  });
});
