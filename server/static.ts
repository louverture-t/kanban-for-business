import path from 'path';
import express, { type Express } from 'express';

export function setupStaticServing(app: Express): void {
  const clientDist = path.resolve(process.cwd(), 'dist/public');

  // Hashed asset bundles (e.g. /assets/task-card-Didq_RNR.js) — filename
  // changes on rebuild, so they are safe to cache aggressively and immutably.
  app.use(
    '/assets',
    express.static(path.join(clientDist, 'assets'), {
      maxAge: '1y',
      immutable: true,
    }),
  );

  // If a hashed asset isn't found, 404 it explicitly. Without this, the
  // SPA wildcard fallback below would return index.html with an HTML MIME
  // type, breaking dynamic imports for already-open tabs after a new deploy.
  app.use('/assets', (_req, res) => {
    res.status(404).type('text/plain').send('Asset not found');
  });

  // Other static files at the root (favicon, robots.txt, manifest, etc.)
  app.use(express.static(clientDist, { maxAge: 0 }));

  // SPA fallback — force revalidation of index.html on every load so a new
  // deploy's asset hashes are picked up immediately instead of being masked
  // by a stale in-memory browser cache.
  app.get('/{*path}', (_req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}
