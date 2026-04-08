---
description: Render Blueprint, GitHub Actions CI/CD, E2E Playwright gate — Day 5 deployment rules
globs:
  - "render.yaml"
  - ".github/workflows/**"
  - "e2e/**"
---

# Day 5 — Deployment & E2E Standards

## Render Deployment Gate

When touching `render.yaml` or `.github/workflows/ci.yml` / `deploy.yml`, apply this decision tree **in order**:

1. **`render-deployment-engineer` agent** — covers render.yaml Blueprint, GitHub Actions CI/CD, deploy hooks, health checks, env var management, zero-downtime deploys. If in scope → dispatch this agent. Stop.
2. **`render-deployment` skill** — Blueprint spec reference, Render API/MCP key onboarding, per-user workspace selection. If in scope → invoke skill. Stop.
3. **General coding agent** — only if neither agent nor skill covers the task. Document why it fell through in the commit message.

## Critical render.yaml Rules (K4B)

| Field | Correct Value | Common Mistake |
|-------|---------------|----------------|
| `startCommand` | `node dist/server/index.js` | `node dist/index.js` — wrong path |
| `buildCommand` | `npm ci && npm run build` | Don't split tsc and vite separately |
| `autoDeploy` | `false` — `deploy.yml` is the sole trigger | `true` causes double-deploys |
| `JWT_SECRET` | `generateValue: true` | Never set manually |
| `rootDir` | **Omit entirely** — K4B builds from repo root | `rootDir: ./server` breaks build |
| `healthCheckPath` | `/api/health` | Must match Express route |
| Atlas IP allowlist | `0.0.0.0/0` | Static IPs break after Render restarts |

## GitHub Actions Rules

- CI workflow (`ci.yml`): triggers on `pull_request` targeting `main`
  - Steps: `npm ci` → `npm run check` → `npm run lint` → `npm run test`
  - Do NOT run `test:e2e` in CI — Playwright needs browser + running server
  - Use `actions/checkout@v4`, `actions/setup-node@v4`, `node-version: 20`
  - Cache `node_modules` keyed by `package-lock.json` hash
- Deploy workflow (`deploy.yml`): triggers on `push` to `main`
  - Single step: `curl -X POST ${{ secrets.RENDER_DEPLOY_HOOK_URL }}`
  - GitHub Secret name: `RENDER_DEPLOY_HOOK_URL`

## Mongoose Connection Pool

Before any changes to `server/config/connection.ts` or any file calling `mongoose.connect()`, invoke the **`mongodb-connection` skill**. Bare `mongoose.connect(uri)` without pool options is not production-ready.

Required pool options for Render free tier → Atlas M0:

```typescript
await mongoose.connect(MONGODB_URI, {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
});
```

## E2E Test Configuration (playwright.config.ts)

Required fields for CI-aware Playwright config:

```typescript
{
  baseURL: 'http://localhost:5173',
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 30000,
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
}
```

## E2E Test Coverage (Day 5)

| File | Tests | Gate |
|------|-------|------|
| `e2e/auth.spec.ts` | 7 — login, wrong password, locked account, invite register, forced PW change, logout, protected route | PR #9 |
| `e2e/kanban.spec.ts` | 7 — navigate, create task, drag task, edit task, delete, restore, archive toggle | PR #9 |
| `e2e/admin.spec.ts` | 5 — superadmin access, manager redirect, create invitation, change role, add/remove member | PR #9 |
| `e2e/search.spec.ts` | 3 — Ctrl+K, search returns results, click navigates | PR #9 |

All E2E tests must pass locally (`npm run test:e2e` with dev server running) before pushing PR #9.

## Phase 3 Manual Onboarding Sequence

1. Get Render API key → configure Render MCP via `render-deployment` skill
2. Create `k4b-env` environment group with: `MONGODB_URI`, `OPENROUTER_API_KEY`, `CLIENT_ORIGIN`, `NODE_ENV=production`
3. Deploy via Blueprint (New → Blueprint → connect `louverture-t/kanban-for-business`)
4. Set Atlas Network Access → `0.0.0.0/0`
5. Update `CLIENT_ORIGIN` in `k4b-env` after Render assigns service URL
6. Copy deploy hook URL → add as GitHub Secret `RENDER_DEPLOY_HOOK_URL`
7. Verify: `curl https://<service>.onrender.com/api/health` → `{"status":"ok"}`
