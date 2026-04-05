import { NODE_ENV } from '@server/config/connection.js';

export const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 2 * 60 * 60 * 1000, // 2 hours
  path: '/graphql',
};
