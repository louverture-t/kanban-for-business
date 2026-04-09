import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

export const MONGODB_URI = process.env.MONGODB_URI as string;
export const JWT_SECRET = process.env.JWT_SECRET as string;
export const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY as string;
export const PORT = parseInt(process.env.PORT || '3001', 10);
export const NODE_ENV = process.env.NODE_ENV || 'development';
export const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN;

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
          return conn;
    } catch (error) {
          console.error('❌ MongoDB connection failed:', error);
          process.exit(1);
          throw error; // unreachable, but satisfies TypeScript return analysis
    }
}
