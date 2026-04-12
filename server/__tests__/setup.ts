// Set test env vars before any module imports that validate them
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-vitest';
process.env.OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || 'test-openrouter-key';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/test';

import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { beforeAll, afterAll, beforeEach } from 'vitest';
import { clearAuthRateLimit } from '@server/utils/auth.js';

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

// Reset the in-memory auth rate-limit map between tests so individual
// test cases don't bleed their attempt counts into subsequent tests.
beforeEach(() => {
  clearAuthRateLimit();
});
