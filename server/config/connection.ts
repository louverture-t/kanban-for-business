import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

export const MONGODB_URI = process.env.MONGODB_URI as string;
export const JWT_SECRET = process.env.JWT_SECRET as string;
export const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY as string;
export const PORT = parseInt(process.env.PORT || '3001', 10);
export const NODE_ENV = process.env.NODE_ENV || 'development';
export const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN;

/**
 * One-time backfill: set createdAt/updatedAt on User documents that were
 * inserted before { timestamps: true } was added to the User schema.
 * Uses the ObjectId-embedded timestamp as the source of truth.
 * Safe to run on every startup — the $exists filter makes it a no-op when
 * all documents already have timestamps.
 */
async function backfillUserTimestamps(): Promise<void> {
  const db = mongoose.connection.db;
  if (!db) return;

  const users = db.collection('users');

  // Find users missing either field
  const cursor = users.find({
    $or: [{ createdAt: { $exists: false } }, { updatedAt: { $exists: false } }],
  });

  let patched = 0;
  for await (const doc of cursor) {
    const ts = doc._id.getTimestamp();
    await users.updateOne(
      { _id: doc._id },
      {
        $set: {
          ...(doc.createdAt === undefined ? { createdAt: ts } : {}),
          ...(doc.updatedAt === undefined ? { updatedAt: ts } : {}),
        },
      },
    );
    patched++;
  }

  if (patched > 0) {
    console.log(`✅ Backfilled timestamps on ${patched} User document(s).`);
  }
}

export async function connectDB(): Promise<typeof mongoose> {
    // Validate required vars here so the port is already bound before we exit
    const requiredVars = ['MONGODB_URI', 'JWT_SECRET', 'OPENROUTER_API_KEY'] as const;
    for (const varName of requiredVars) {
        if (!process.env[varName]) {
            console.error(`❌ Missing required environment variable: ${varName}`);
            console.error('Check .env.example for required variables.');
            process.exit(1);
        }
    }

    try {
          const conn = await mongoose.connect(process.env.MONGODB_URI!, {
                  maxPoolSize: 10,
                  serverSelectionTimeoutMS: 5000,
                  socketTimeoutMS: 45000,
          } as mongoose.ConnectOptions);
          console.log(`✅ MongoDB connected: ${conn.connection.host}`);
          await backfillUserTimestamps();
          return conn;
    } catch (error) {
          console.error('❌ MongoDB connection failed:', error);
          process.exit(1);
          throw error; // unreachable, but satisfies TypeScript return analysis
    }
}
