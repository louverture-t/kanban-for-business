import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import path from 'path';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express5';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';

import rateLimit from 'express-rate-limit';
import { connectDB, PORT, NODE_ENV, CLIENT_ORIGIN, JWT_SECRET } from '@server/config/connection.js';
import { runArchiveSweep, runPurgeSweep } from '@server/utils/sweeps.js';
import { buildContext, type GraphQLContext } from '@server/utils/auth.js';
import typeDefs from '@server/schemas/typeDefs.js';
import { resolvers } from '@server/resolvers/index.js';
import { seedDatabase } from '@server/seed.js';

// --- Express + HTTP server ---
const app = express();
const httpServer = http.createServer(app);
let appReady = false;

// Render (and most PaaS) reverse-proxies requests; trust the first proxy
// so express-rate-limit reads the real client IP from X-Forwarded-For.
if (NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// --- Apollo Server ---
const server = new ApolloServer<GraphQLContext>({
  typeDefs,
  resolvers,
  plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
});

await server.start();

// --- Middleware ---
app.use(
  helmet({
    // CSP disabled in dev — Apollo Sandbox and Vite HMR inject inline scripts
    contentSecurityPolicy: NODE_ENV === 'production',
    // HSTS disabled in dev (HTTP only)
    strictTransportSecurity: NODE_ENV === 'production',
  }),
);
app.use(cookieParser(JWT_SECRET));

// Trim CLIENT_ORIGIN to prevent ERR_INVALID_CHAR from whitespace in env vars
const sanitizedOrigin = CLIENT_ORIGIN?.trim() || undefined;
const corsOptions: cors.CorsOptions = {
  origin: NODE_ENV === 'production' ? (sanitizedOrigin ?? false) : (sanitizedOrigin ?? true),
  credentials: true,
};

const generalLimiter = rateLimit({
  windowMs: NODE_ENV === 'production' ? 15 * 60 * 1000 : 60 * 1000, // 15 min prod / 1 min dev
  max: NODE_ENV === 'production' ? 200 : 10_000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: NODE_ENV === 'production' ? 20 : 1_000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Upload limit exceeded, please try again later.' },
});

// Health check (REST)
app.get('/api/health', (_req, res) => {
  if (!appReady) {
    res.status(503).json({ status: 'starting' });
    return;
  }
  res.json({ status: 'ok' });
});

// File upload REST endpoint
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.txt', '.md', '.docx', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only .txt, .md, .docx, and .pdf files are allowed'));
    }
  },
});

app.post('/api/upload', uploadLimiter, cors(corsOptions), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    let text = '';

    if (ext === '.txt' || ext === '.md') {
      text = req.file.buffer.toString('utf-8');
    } else if (ext === '.docx') {
      const mammoth = await import('mammoth');
      const result = await mammoth.default.extractRawText({ buffer: req.file.buffer });
      text = result.value;
    } else if (ext === '.pdf') {
      const { PDFParse } = await import('pdf-parse');
      const parser = new PDFParse({ data: new Uint8Array(req.file.buffer) });
      const result = await parser.getText();
      text = result.text;
    }

    // Strip path components and non-word characters to prevent
    // path-traversal artifacts and social-engineering via raw filenames.
    const safeFilename = path.basename(req.file.originalname).replace(/[^\w.\-]/g, '_');
    res.json({ text, filename: safeFilename });
  } catch (error) {
    res.status(500).json({ error: 'Failed to process file' });
  }
});

// GraphQL endpoint
app.use(
  '/graphql',
  generalLimiter,
  cors<cors.CorsRequest>(corsOptions),
  express.json(),
  expressMiddleware(server, {
    context: buildContext,
  }),
);

// --- Sweep intervals ---
const ONE_HOUR = 60 * 60 * 1000;
setInterval(() => runArchiveSweep().catch((err) => console.error('archiveSweep error:', err)), ONE_HOUR);
setInterval(() => runPurgeSweep().catch((err) => console.error('purgeSweep error:', err)), ONE_HOUR);

// --- Vite (dev) or static (prod) ---
if (NODE_ENV === 'development') {
  const { setupViteDevMiddleware } = await import('@server/vite.js');
  await setupViteDevMiddleware(app);
} else {
  const { setupStaticServing } = await import('@server/static.js');
  setupStaticServing(app);
}

// --- Bind port first so health checks pass immediately ---
await new Promise<void>((resolve) => {
  httpServer.listen({ port: PORT }, resolve);
});
console.log(`🚀 Server ready at http://localhost:${PORT}`);
console.log(`📊 GraphQL: http://localhost:${PORT}/graphql`);
console.log(`💊 Health: http://localhost:${PORT}/api/health`);

// --- Connect DB + seed after port is bound ---
await connectDB();
await seedDatabase();
appReady = true;
