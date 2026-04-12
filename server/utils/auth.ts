import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
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
  req: Request;
  res: Response;
}

// --- Auth rate limiter (in-memory, per-IP) ---
// Limits login / register / refreshToken to 20 attempts per 15-minute window.
// In-memory store is acceptable for a single-instance Render free tier service;
// swap to a Redis-backed store if you scale to multiple instances.

const AUTH_RATE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const AUTH_RATE_MAX = 20;
const authRateMap = new Map<string, { count: number; windowStart: number }>();

/** Wipes all rate-limit counters. Call in test beforeEach to prevent bleed-over. */
export function clearAuthRateLimit(): void {
  authRateMap.clear();
}

export function checkAuthRateLimit(ip: string | undefined): void {
  const key = ip ?? 'unknown';
  const now = Date.now();
  const entry = authRateMap.get(key);

  if (!entry || now - entry.windowStart > AUTH_RATE_WINDOW_MS) {
    authRateMap.set(key, { count: 1, windowStart: now });
    return;
  }

  if (entry.count >= AUTH_RATE_MAX) {
    const resetIn = Math.ceil((AUTH_RATE_WINDOW_MS - (now - entry.windowStart)) / 60000);
    throw new AuthenticationError(
      `Too many authentication attempts. Try again in ${resetIn} minute${resetIn !== 1 ? 's' : ''}.`,
    );
  }

  entry.count++;
}

// --- Token operations ---

export function signAccessToken(user: TokenPayload): string {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL, algorithm: 'HS256' },
  );
}

export function signRefreshToken(user: TokenPayload): string {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_TTL, algorithm: 'HS256' },
  );
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as TokenPayload;
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

export async function buildContext({ req, res }: { req: Request; res: Response }): Promise<GraphQLContext> {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return { user: null, req, res };
  }

  try {
    const payload = verifyToken(token);
    return { user: payload, req, res };
  } catch {
    return { user: null, req, res };
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

export async function requireProjectAccess(
  context: GraphQLContext,
  projectId: string,
): Promise<TokenPayload> {
  const user = requireAuth(context);
  if (user.role === 'superadmin') {
    return user;
  }
  const { default: ProjectMember } = await import('@server/models/ProjectMember.js');
  const member = await ProjectMember.findOne({ projectId, userId: user.id });
  if (!member) {
    throw new ForbiddenError('You are not a member of this project');
  }
  return user;
}
