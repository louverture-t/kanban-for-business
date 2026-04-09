import path from 'path';
import express, { type Express } from 'express';

export function setupStaticServing(app: Express): void {
  const clientDist = path.resolve(process.cwd(), 'dist/public');
  app.use(express.static(clientDist));

  // SPA fallback — serve index.html for all non-API routes
  app.get('/{*path}', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}
