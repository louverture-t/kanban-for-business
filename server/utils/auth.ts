import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import type { Request } from 'express';
import { JWT_SECRET } from '@server/config/connection.js';
import { AuthenticationError, ForbiddenError } from '@server/utils/errors.js';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '2h';
const BCRYPT_ROUNDS = 12;

export interface TokenPayload {
  id: string;
  username: string;
  role: 'user' | 'manager' | 'superadmin';
}

export interface GraphQLContext {
  user: TokenPayload | null;
}

// --- Token operations ---

export function signAccessToken(user: TokenPayload): string {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL },
  );
}

export function signRefreshToken(user: TokenPayload): string {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_TTL },
  );
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
}

// --- Password operations ---

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function hashRefreshToken(token: string): Promise<string> {
  return bcrypt.hash(token, BCRYPT_ROUNDS);
}

// --- Context builder ---

export async function buildContext({ req }: { req: Request }): Promise<GraphQLContext> {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return { user: null };
  }

  try {
    const payload = verifyToken(token);
    return { user: payload };
  } catch {
    return { user: null };
  }
}

// --- RBAC guards ---

export function requireAuth(context: GraphQLContext): TokenPayload {
  if (!context.user) {
    throw new AuthenticationError('You must be logged in');
  }
  return context.user;
}

export function requireManagerOrAbove(context: GraphQLContext): TokenPayload {
  const user = requireAuth(context);
  if (user.role === 'user') {
    throw new ForbiddenError('Manager or Superadmin access required');
  }
  return user;
}

export function requireSuperadmin(context: GraphQLContext): TokenPayload {
  const user = requireAuth(context);
  if (user.role !== 'superadmin') {
    throw new ForbiddenError('Superadmin access required');
  }
  return user;
}

export function requireProjectAccess(
  context: GraphQLContext,
  _projectId: string,
): TokenPayload {
  const user = requireAuth(context);
  // Superadmin bypasses project membership check
  if (user.role === 'superadmin') {
    return user;
  }
  // Project membership check will be implemented when ProjectMember model exists
  // For now, authenticated users pass (actual check added with resolvers)
  return user;
}
