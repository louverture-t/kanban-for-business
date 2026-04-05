import express from 'express';
import http from 'http';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express5';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import gql from 'graphql-tag';

import { connectDB, PORT, NODE_ENV, CLIENT_ORIGIN } from '@server/config/connection.js';
import { buildContext, type GraphQLContext } from '@server/utils/auth.js';

// Placeholder schema — replaced when real typeDefs/resolvers are added
const typeDefs = gql`
  type Query {
    health: String
  }
`;

const resolvers = {
  Query: {
    health: () => 'OK',
  },
};

// --- Express + HTTP server ---
const app = express();
const httpServer = http.createServer(app);

// --- Apollo Server ---
const server = new ApolloServer<GraphQLContext>({
  typeDefs,
  resolvers,
  plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
});

await server.start();

// --- Middleware ---
app.use(cookieParser());

const corsOptions: cors.CorsOptions = {
  origin: CLIENT_ORIGIN || true,
  credentials: true,
};

// Health check (REST)
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// GraphQL endpoint
app.use(
  '/graphql',
  cors<cors.CorsRequest>(corsOptions),
  express.json(),
  expressMiddleware(server, {
    context: buildContext,
  }),
);

// --- Cookie settings (exported for auth resolvers) ---
export const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 2 * 60 * 60 * 1000, // 2 hours
  path: '/graphql',
};

// --- Sweep intervals (stubs until models exist) ---
function archiveSweep(): void {
  // Auto-archive tasks complete 7+ days — implemented with Task model
}

function purgeSweep(): void {
  // Auto-purge trashed 7+ days, archived 30+ days — implemented with Task model
}

const ONE_HOUR = 60 * 60 * 1000;
setInterval(archiveSweep, ONE_HOUR);
setInterval(purgeSweep, ONE_HOUR);

// --- Vite (dev) or static (prod) ---
if (NODE_ENV === 'development') {
  const { setupViteDevMiddleware } = await import('@server/vite.js');
  await setupViteDevMiddleware(app);
} else {
  const { setupStaticServing } = await import('@server/static.js');
  setupStaticServing(app);
}

// --- Connect DB + start ---
await connectDB();

await new Promise<void>((resolve) => {
  httpServer.listen({ port: PORT }, resolve);
});

console.log(`🚀 Server ready at http://localhost:${PORT}`);
console.log(`📊 GraphQL: http://localhost:${PORT}/graphql`);
console.log(`💊 Health: http://localhost:${PORT}/api/health`);
