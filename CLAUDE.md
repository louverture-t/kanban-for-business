# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

Kanban for Business (K4B) — Kanban-style project management app for Atlas Infectious Disease Practice (AIDP). UCF Split Stack program (Back End track). Invite-only, 3-user team.

## Tech Stack

MERN + GraphQL + TypeScript monorepo:
- **Frontend:** React 18, Vite, Tailwind v3, Shadcn UI (Radix), Apollo Client v4, React Router v6, `@hello-pangea/dnd`, Recharts, Framer Motion, cmdk
- **Backend:** Node 20, Express 4, Apollo Server v4 (`expressMiddleware`), Mongoose v8, JWT (jsonwebtoken + bcryptjs)
- **Database:** MongoDB Atlas (M0)
- **AI:** OpenRouter (google/gemini-3.1-flash-lite-preview), server-side only
- **Testing:** Vitest, React Testing Library, mongodb-memory-server, Playwright
- **Deploy:** Render + GitHub Actions CI/CD (`render.yaml` Blueprint, deploy hook trigger, `autoDeploy: false`, `startCommand: node dist/server/index.js`)

## Commands

```bash
npm install              # Install all dependencies
npm run dev              # Dev server (Vite 5173 + Express 3001)
npm run build            # Production build
npm run start            # Run production build
npm run check            # TypeScript type check (tsc --noEmit)
npm run lint             # ESLint
npm run test             # All Vitest tests (server + client)
npm run test:server      # Server unit + integration tests only
npm run test:client      # Client component tests only
npm run test:e2e         # Playwright E2E tests
npm run test:coverage    # Vitest with v8 coverage report
```

## Architecture

- **API:** Single GraphQL endpoint `/graphql` (Apollo Sandbox in dev). REST only for health check (`GET /api/health`) and file upload (`POST /api/upload`).
- **Auth:** JWT access token (15-min, in-memory) + refresh token (2-hr, HttpOnly cookie, bcrypt hash on User). Token rotation on refresh. Account lockout after 5 failed attempts.
- **RBAC:** Superadmin > Manager > User. Guards: `requireAuth`, `requireManagerOrAbove`, `requireSuperadmin`, `requireProjectAccess`. Superadmin bypasses project membership.
- **Vite integration:** Dev uses Vite middleware (`server/vite.ts`). Prod serves static from `dist/public` (`server/static.ts`).
- **Sweeps:** Hourly `setInterval` — auto-archive (complete 7+ days), auto-purge (trashed 7+ days, archived 30+ days).

## Data Model

12 Mongoose models: User, Project, ProjectFolder, ProjectMember, Task, Subtask, Tag, TaskTag, Comment, AuditLog, Notification, Invitation. Tasks use `assigneeId` (ObjectId ref). All models use `timestamps: true`.

## Key Constraints

- **No-PHI:** Persistent UI banner on all authenticated pages. AI prompts include PHI-stripping instruction. No patient health information anywhere in the app.
- **AI ops:** Server-side only, OpenRouter key never exposed to client. Rate limited 10/hr per user. Preview-before-write.
- **File uploads:** REST endpoint, Multer, 5 MB limit. Supports .txt/.md/.docx/.pdf. Extraction via `pdf-parse` and `mammoth`.

## Git Conventions

- **Branches:** `feat/<scope>`, `test/<scope>`
- **Commits:** Conventional Commits (`feat:`, `fix:`, `test:`, `chore:`)
- **PRs:** Implementation + tests. Merge to `main`.
- **Account:** `louverture-t` (UCF)

## Environment Variables

Required in `.env` (see `.env.example`):
- `MONGODB_URI`, `JWT_SECRET`, `OPENROUTER_API_KEY`, `PORT` (default 3001), `NODE_ENV`, `CLIENT_ORIGIN` (optional)

Server validates required vars on startup and exits with clear error if missing.

## TypeScript Path Aliases

`@client/*` → `client/src/*` | `@server/*` → `server/*` | `@shared/*` → `shared/*`

## Progressive Disclosure

Domain-specific instructions live in `.claude/rules/` and load automatically on matching file globs:
- `testing-standards.md` — test setup, patterns, environment config → `**/__tests__/**/*.ts`, `**/__tests__/**/*.tsx`, `e2e/**/*.ts`
- `ui-components.md` — Shadcn UI, Tailwind, accessibility, No-PHI banner → `client/src/components/**/*.tsx`, `client/src/pages/**/*.tsx`
- `graphql-resolvers.md` — RBAC guards, error handling, resolver patterns → `server/schemas/resolvers/**/*.ts`, `server/schemas/typeDefs.ts`
- `day5-deployment.md` — Render Blueprint, GitHub Actions CI/CD, E2E Playwright gate → `render.yaml`, `.github/workflows/**`, `e2e/**`

---

## Day 5 — Delivery & Deployment (April 7–8, 2026)

Final sprint: E2E tests, CI/CD pipeline, Render production deploy. Two PRs (#9 admin-panel, #10 ci-cd-deploy).

### Phase Overview

| Phase | Branch | Gate |
|-------|--------|------|
| 0 — Pre-flight | `main` | Session start — mem-search, MCP setup, seed verify |
| 1 — Admin panel + E2E | `feat/admin-panel` → PR #9 | After PR #8 merged |
| 2 — CI/CD + render.yaml | `feat/ci-cd-deploy` → PR #10 | After PR #9 merged |
| 3 — Render onboarding | n/a (manual + skill) | After PR #10 merged |
| 4 — Final RBAC sweep | n/a (manual) | After Render deploy green |

### Agent & Skill Routing — Day 5

| Tool | Type | Phase | Trigger |
|------|------|-------|---------|
| `mem-search` | skill | Phase 0 | Session pre-flight — check past K4B sessions |
| `mongodb-mcp-setup` | skill | Phase 0 | Configure Atlas MCP before any DB query |
| `mongodb-natural-language-querying` | skill | Phase 0, 1, 3 | Seed verify, post-admin verify, post-deploy verify |
| `graphql-architect` | agent | Phase 1 | MUST run before writing to `operations.ts` or any GraphQL SDL |
| `mongodb-connection` | skill | Phase 2 | Review `mongoose.connect()` pool options before deploy |
| `render-deployment-engineer` | agent | Phase 2 | Author `ci.yml`, `deploy.yml`, `render.yaml` |
| `render-deployment` | skill | Phase 2–3 | Blueprint spec reference + Render MCP/API key onboarding |

**Excluded tools** (with reasoning):
- `atlas-stream-processing` — K4B has no streaming workloads
- `mongodb-schema-design` — all 12 Mongoose models built on Day 1; no new models in Day 5
- `mongodb-search-and-ai` — `searchTasks` uses `$text` index (built Day 2), not Atlas Search
- `mongodb-query-optimizer` — no new queries in Day 5; optimization not a Day 5 goal

### Critical render.yaml Corrections

| Wrong (earlier drafts) | Correct |
|------------------------|----------|
| `JWT_SECRET` set manually | `generateValue: true` — Render auto-generates |
| `rootDir: ./server` present | Remove — K4B builds from repo root |
| `startCommand: node dist/index.js` | `node dist/server/index.js` — correct compiled output path |
| `autoDeploy: true` | `autoDeploy: false` — `deploy.yml` is the sole trigger |
| Atlas IP static allowlist | `0.0.0.0/0` — Render outbound IPs rotate on each deploy/restart |
| No `mongodb-connection` review | Skill runs before deploy — bare `mongoose.connect()` needs pool config |
| No MCP setup step | `mongodb-mcp-setup` skill runs in Phase 0 pre-flight |
| No `graphql-architect` gate | Agent validates against `typeDefs.ts` before writing admin operations |

### Files Changed/Created — Day 5

| File | Action | Owner |
|------|--------|-------|
| `client/src/graphql/admin-operations.ts` | CREATE — 6 admin ops | `graphql-architect` agent |
| `client/src/App.tsx` | Modify — wire 3 real page imports | Coding agent |
| `client/src/pages/admin.tsx` | CREATE — 3 tabs: Users, Invitations, Membership | Coding agent |
| `client/src/pages/settings.tsx` | CREATE — theme + project management | Coding agent |
| `client/src/pages/not-found.tsx` | CREATE — 404 fallback | Coding agent |
| `playwright.config.ts` | Modify — webServer, retries, CI workers | Coding agent |
| `e2e/auth.spec.ts` | CREATE — 7 auth tests | Coding agent |
| `e2e/kanban.spec.ts` | CREATE — 7 Kanban tests | Coding agent |
| `e2e/admin.spec.ts` | CREATE — 5 admin RBAC tests | Coding agent |
| `e2e/search.spec.ts` | CREATE — 3 search tests | Coding agent |
| `.github/workflows/ci.yml` | CREATE — PR type-check/lint/test | `render-deployment-engineer` agent |
| `.github/workflows/deploy.yml` | CREATE — push to main → deploy hook | `render-deployment-engineer` agent |
| `render.yaml` | CREATE — Render Blueprint | `render-deployment-engineer` agent + `render-deployment` skill |
| `server/config/connection.ts` | Modify — add pool options to `mongoose.connect()` | `mongodb-connection` skill |

### Day 5 Verification Commands

```bash
npm run check                     # TypeScript — zero errors required
npm run lint                      # ESLint — zero warnings required
npm run test                      # Vitest server + client — all pass
npm run test:e2e                  # Playwright — dev server must be running
npm run build                     # Must produce dist/server/index.js + dist/public/
NODE_ENV=production npm start     # Local production smoke test
curl http://localhost:3001/api/health      # {"status":"ok"}
curl https://<render-url>/api/health       # {"status":"ok"} post-deploy
```

### Day 5 PR Sequence

```bash
# PR #9 — admin panel + E2E
git checkout -b feat/admin-panel
# ... implement + test ...
git push -u origin feat/admin-panel
gh pr create --title "Add admin panel and E2E test suite"

# PR #10 — CI/CD + render.yaml (after PR #9 merged)
git checkout main && git pull
git checkout -b feat/ci-cd-deploy
# ... implement ...
git push -u origin feat/ci-cd-deploy
gh pr create --title "Add CI/CD pipeline and Render deployment config"
```
