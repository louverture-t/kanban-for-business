# Day 5 Plan — K4B (Kanban for Business)

## Session Status — April 7, 2026

### ✅ Completed

- [x] Variant C design guidelines implementation (accessibility-first, Teal/Emerald WCAG theme)
- [x] `client/src/pages/admin.tsx` — 3-tab admin panel (Users, Invitations, Membership), full ARIA, typed `useQuery` generics
- [x] `client/src/pages/settings.tsx` — theme toggle (light/dark), project management with `AlertDialog` deletes
- [x] `client/src/pages/not-found.tsx` — 404 fallback page
- [x] `client/src/graphql/admin-operations.ts` — 6 admin GraphQL operations (`ADMIN_USERS_QUERY`, `ADMIN_INVITATIONS_QUERY`, `UPDATE_USER_MUTATION`, `CREATE_INVITATION_MUTATION`, `ADD_PROJECT_MEMBER_MUTATION`, `REMOVE_PROJECT_MEMBER_MUTATION`)
- [x] `client/src/index.css` — Teal/Emerald WCAG theme (`--primary: 172 66% 32%` light, `172 66% 45%` dark)
- [x] `client/src/App.tsx` — admin, settings, and 404 routes wired
- [x] All variant worktrees removed (A, B, C) — git pruned, branches deleted, directories cleaned
- [x] Variant C merged to `main` via `git merge --no-ff` (8 files, 822 insertions)
- [x] `git push origin main` — remote synced (`09fbdcd` → `8283e4f`)
- [x] `npm run check` — zero TypeScript errors on main

### ⬜ Remaining

- [ ] **E2E tests** (`e2e/auth.spec.ts`, `e2e/kanban.spec.ts`, `e2e/admin.spec.ts`, `e2e/search.spec.ts`)
- [ ] **`playwright.config.ts`** — add `webServer`, `retries`, CI-aware workers
- [ ] **`.github/workflows/ci.yml`** — type-check, lint, Vitest on PR (`render-deployment-engineer` agent)
- [ ] **`.github/workflows/deploy.yml`** — Render deploy hook on push to main (agent)
- [ ] **`render.yaml`** — Render Blueprint (`render-deployment-engineer` agent + `render-deployment` skill)
- [ ] **`server/config/connection.ts`** — Mongoose pool options for production (`mongodb-connection` skill)
- [ ] Local production build test: `npm run build` + `NODE_ENV=production npm start`
- [ ] Render onboarding: `k4b-env` group, Blueprint deploy, Atlas IP allowlist, `CLIENT_ORIGIN`, deploy hook secret
- [ ] Final RBAC validation sweep (all 3 roles + full auth lifecycle)

---

## Day 5 Checkpoint

- [x] Admin panel: user management, invitations, membership — built and on `main`
- [x] TypeScript clean (`npm run check` zero errors)
- [x] `main` synced to `origin/main`
- [ ] E2E tests pass (`npm run test:e2e`)
- [ ] CI pipeline passes on PR (type-check + lint + Vitest)
- [ ] Deploy pipeline triggers on push to main
- [ ] App deployed and accessible on Render — health check green
- [ ] Production build verified locally
- [ ] All 3 RBAC roles manually tested
- [ ] Full auth lifecycle: register → login → use app → idle timeout → refresh → logout
- [ ] PR #9 and PR #10 merged to main

---

## Tool Audit Results

### INCLUDED (with placement)

| Tool | Type | Phase | Gate |
|------|------|-------|------|
| `mem-search` skill | Cross-session memory | Phase 0 | Session pre-flight |
| `mongodb-mcp-setup` skill | MCP Atlas connection | Phase 0 | Pre-flight before any DB queries |
| `mongodb-natural-language-querying` skill | Atlas DB verification | Phase 0, Phase 1, Phase 3 | Seed verify, post-admin verify, post-deploy verify |
| `graphql-architect` agent | GraphQL SDL/ops | Phase 1 | Before writing to operations.ts |
| `mongodb-connection` skill | Pool config for production | Phase 2 | Before pushing render.yaml |
| `render-deployment-engineer` agent | ci.yml, deploy.yml, render.yaml | Phase 2 | Before writing any YAML |
| `render-deployment` skill | Blueprint spec, Render MCP, env var onboarding | Phase 2 + Phase 3 | Reference + API key setup |

### EXCLUDED (with reasoning)

| Tool | Reason |
|------|--------|
| `atlas-stream-processing` | K4B has no streaming workloads |
| `mongodb-schema-design` | No new Mongoose models in Day 5 (all 12 created Day 1) |
| `mongodb-search-and-ai` | K4B `searchTasks` uses `$text` index (already built Day 2), NOT Atlas Search |
| `mongodb-query-optimizer` | No new queries in Day 5; optimization is not a Day 5 goal |

---

## Phase 0 — Session Pre-Flight (before any branch work)

### 0.1 mem-search skill — Check past K4B sessions
Invoke `mem-search` skill. Search: `"kanban-for-business production build apollo server express"`. Look for known issues with: production server start command, Apollo Server v5 `expressMiddleware`, Vitest CI failures.

### 0.2 mongodb-mcp-setup skill — Atlas MCP connection
Invoke `mongodb-mcp-setup` skill. Check `env | grep MDB_MCP`. If not configured, walk through Option A (connection string) or Option B (service account). Required for ALL subsequent MongoDB verification steps.

### 0.3 mongodb-natural-language-querying skill — Seed verification
Once MCP connected: query `users` collection, filter `{ role: 'superadmin' }`. Confirm `superadmin/Admin@123` seeded. If none, run `npm run dev` (or `npx ts-node server/seed.ts`) to seed.

### 0.4 Manual gate — Merge PR #8
User must manually merge `feat/ai-search-notifications` → `main` via GitHub before Phase 1.

---

## Phase 1 — feat/admin-panel (PR #9)

Start:
```bash
git checkout main && git pull && git checkout -b feat/admin-panel
```

### 1.1 graphql-architect agent — Validate and write 6 admin GraphQL operations
**INVOKE graphql-architect agent first.** Agent reads `server/schemas/typeDefs.ts` and `client/src/graphql/operations.ts`, then authors 6 missing operations to append to `client/src/graphql/operations.ts`:
- `ADMIN_USERS_QUERY` — for `adminUsers` query
- `ADMIN_INVITATIONS_QUERY` — for `adminInvitations` query
- `UPDATE_USER_MUTATION` — for `updateUser` mutation
- `CREATE_INVITATION_MUTATION` — for `createInvitation` mutation
- `ADD_PROJECT_MEMBER_MUTATION` — for `addProjectMember` mutation
- `REMOVE_PROJECT_MEMBER_MUTATION` — for `removeProjectMember` mutation

Agent verifies field alignment with Mongoose models (User, Invitation, ProjectMember). Agent applies consistent naming and field selection patterns matching existing ops in `operations.ts`.

```
Commit: feat: add admin GraphQL operations to client
```

### 1.2 Create client/src/pages/admin.tsx — Users section
Three-tab layout (Shadcn `Tabs`). Tab 1: Users table.
- Columns: username, email, role (Select dropdown), active (Toggle), createdAt
- Role change: wrapped in `AlertDialog` ("Change role to X?")
- Deactivate: wrapped in `AlertDialog` ("Deactivate this user?")
- Disable own-account deactivation (compare with `useAuth().user._id`)
- Calls: `ADMIN_USERS_QUERY`, `UPDATE_USER_MUTATION`

```
Commit: feat: add admin user management panel
```

### 1.3 Admin page — Invitations section (same file, Tab 2)
- Create form: email input, role Select, optional project dropdown (from `PROJECTS_QUERY`)
- Submit calls `CREATE_INVITATION_MUTATION`
- Generated URL: `${window.location.origin}/register?token=${invitation.token}`
- "Copy URL" button per invitation row
- Table: email, role, status (pending/accepted/expired), createdAt, expiresAt
- Status badge: green=accepted, yellow=pending, red=expired

```
Commit: feat: add admin invitation management with shareable URLs
```

### 1.4 Admin page — Membership section (same file, Tab 3)
- Project Select dropdown (calls `PROJECTS_QUERY`)
- On select: shows current members (from `PROJECT_MEMBERS_QUERY`)
- "Add Member" Select (filters out already-members from `ADMIN_USERS_QUERY`)
- "Remove" button per member → calls `REMOVE_PROJECT_MEMBER_MUTATION`
- Add button calls `ADD_PROJECT_MEMBER_MUTATION`

```
Commit: feat: add admin project membership management
```

### 1.5 Create client/src/pages/settings.tsx
- Theme section: light/dark/system (reuse ThemeProvider, Shadcn `RadioGroup`)
- Password change link → navigates to `/change-password`
- Project management: list all user's projects using `PROJECTS_QUERY`, Edit via `project-dialog.tsx`, Delete wrapped in `AlertDialog` → `DELETE_PROJECT_MUTATION`

```
Commit: feat: add settings page
```

### 1.6 Create client/src/pages/not-found.tsx
- Simple 404 with heading, message, and link back to `/`

```
Commit: feat: add 404 not-found fallback page
```

### 1.7 Update client/src/App.tsx
- Replace inline stub functions for `AdminPage`, `SettingsPage`, `NotFoundPage` with real imports
- Verify admin route has superadmin guard: redirect non-superadmin to `/`

```
Commit: feat: wire admin, settings, and 404 pages into router
```

### 1.8 Verify app-sidebar.tsx admin link
- Read `client/src/components/app-sidebar.tsx`
- Confirm "Admin" link is conditionally rendered only when `isSuperadmin`
- No changes unless missing

### 1.9 mongodb-natural-language-querying skill — Post-admin verification
After manually testing the admin panel (login as superadmin, create invitation, change a role):
- Query `invitations` collection — confirm invitation document exists with correct fields
- Query `users` collection — confirm role change reflected in DB
- Query `auditlogs` collection — confirm audit log entries created

### 1.10 Update playwright.config.ts
Current state: missing `webServer`, `retries`, CI-aware workers.
Changes required:
- `baseURL: 'http://localhost:5173'`
- `webServer`: `{ command: 'npm run dev', url: 'http://localhost:5173', reuseExistingServer: !process.env.CI }`
- `retries: process.env.CI ? 2 : 0`
- `workers: process.env.CI ? 1 : undefined`
- `timeout: 30000`

### 1.11 Create E2E test files
Four files (all in `e2e/`):

**`e2e/auth.spec.ts`** — 7 tests:
- Valid login → redirect to dashboard
- Wrong password → error toast
- Locked account → lockout message
- Register with invite token → account created, redirect to dashboard
- Forced password change on first login → redirect to `/change-password`
- Logout → redirect to login
- Protected route → redirect to login when unauthenticated

**`e2e/kanban.spec.ts`** — 7 tests:
- Navigate to project Kanban view
- Create task via "+" button → appears in correct column
- Drag task Backlog → Active → status updates
- Edit task dialog opens with correct data
- Delete task → moves to trash
- Restore task from trash → returns to board
- Archive toggle shows archived tasks

**`e2e/admin.spec.ts`** — 5 tests:
- Superadmin can access admin panel
- Manager redirected away from admin panel
- Create invitation → URL shown
- Change user role → reflected in user table
- Add/remove project member → reflected in membership list

**`e2e/search.spec.ts`** — 3 tests:
- Ctrl+K opens search dialog
- Type query → matching tasks appear
- Click result → navigates to project view

```
Commit: test: add Playwright E2E tests for auth, Kanban, admin, and search
```

### 1.12 Quality gates
```bash
npm run check    # TypeScript — zero errors required
npm run lint     # ESLint — zero errors/warnings required
npm run test     # Vitest (server + client) — all pass
npm run test:e2e # Playwright (requires dev server running)
```
Fix any failures before proceeding to PR.

### 1.13 Push + PR #9
```bash
git push -u origin feat/admin-panel
gh pr create \
  --title "Add admin panel (users, invitations, membership) and E2E test suite" \
  --body "Closes Day 5.1–5.5. Admin panel with 3 tabs, settings, 404 page, E2E suite."
```

---

## Phase 2 — feat/ci-cd-deploy (PR #10)

**Gate:** PR #9 must be merged to main first.

Start:
```bash
git checkout main && git pull && git checkout -b feat/ci-cd-deploy
```

### 2.1 render-deployment-engineer agent — Author .github/workflows/ci.yml
**INVOKE render-deployment-engineer agent.** Agent reads `package.json` for script names, then produces `.github/workflows/ci.yml`:
- Trigger: `pull_request` targeting `main`
- Steps: `checkout` (v4), `setup-node` 20 with npm cache, `npm ci`, `npm run check`, `npm run lint`, `npm run test`
- Pinned action versions with SHA
- Cache: `node_modules` keyed by `package-lock.json` hash
- Does NOT run `test:e2e` (Playwright needs browser + server; too heavy for CI)

```
Commit: ci: add GitHub Actions CI workflow (type-check, lint, tests on PR)
```

### 2.2 render-deployment-engineer agent — Author .github/workflows/deploy.yml
**Same agent invocation (or follow-up).** Produces `.github/workflows/deploy.yml`:
- Trigger: `push` to `main`
- Steps: checkout, `curl -X POST ${{ secrets.RENDER_DEPLOY_HOOK_URL }}`
- Depends on CI workflow passing

```
Commit: ci: add GitHub Actions deploy workflow (push to main triggers Render deploy hook)
```

### 2.3 render-deployment-engineer agent + render-deployment skill — Author render.yaml
**`render-deployment` skill** provides the Blueprint spec reference. **`render-deployment-engineer` agent** produces the file.

Key fields (verified against skill reference docs):

```yaml
services:
  - type: web
    name: kanban-for-business
    runtime: node
    buildCommand: npm ci && npm run build
    startCommand: node dist/server/index.js
    healthCheckPath: /api/health
    autoDeploy: false
    envVars:
      - key: NODE_ENV
        value: production
      - key: JWT_SECRET
        generateValue: true
      - key: MONGODB_URI
        sync: false
      - key: OPENROUTER_API_KEY
        sync: false
      - key: CLIENT_ORIGIN
        sync: false
    envVarGroups:
      - k4b-env
```

Critical notes:
- **No `rootDir`** — K4B builds from repo root (`npm run build` = `tsc && vite build`)
- **`autoDeploy: false`** — `deploy.yml` is the only trigger
- **`generateValue: true`** for `JWT_SECRET` — Render auto-generates; do NOT manually set
- **`startCommand: node dist/server/index.js`** — correct compiled output path (NOT `dist/index.js`)

```
Commit: chore: add Render Blueprint configuration (render.yaml)
```

### 2.4 mongodb-connection skill — Review production connection pool
**INVOKE mongodb-connection skill.** Current `server/config/connection.ts` has only `mongoose.connect(MONGODB_URI)` — no pool config.

Context for skill:
- Deployment: Render free tier (single instance, ~512MB RAM)
- MongoDB: Atlas M0 (max 500 connections, shared cluster)
- Workload: 3-user app, low concurrency, Express + Apollo Server v5
- Async driver (Mongoose v8 / Node.js)

Expected output — apply to `mongoose.connect()` options:
```typescript
await mongoose.connect(MONGODB_URI, {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
});
```

```
Commit: fix: configure mongoose connection pool for production (Render → Atlas M0)
```

### 2.5 Local production build test
```bash
npm run build                   # Must produce dist/server/index.js + dist/public/
NODE_ENV=production npm start   # Must serve static + /graphql + /api/health
curl http://localhost:3001/api/health  # Must return {"status":"ok"}
```

### 2.6 Push + PR #10
```bash
git push -u origin feat/ci-cd-deploy
gh pr create \
  --title "Add CI/CD pipeline and Render deployment config" \
  --body "Closes Day 5.7–5.9. GitHub Actions CI/CD, render.yaml Blueprint."
```

---

## Phase 3 — Render Onboarding (Manual + render-deployment skill)

**Gate:** PR #10 must be merged to main first.

### 3.1 render-deployment skill — Render API key + MCP setup
**INVOKE render-deployment skill.** Skill walks through:
- Get Render API key from `https://dashboard.render.com/u/*/settings#api-keys`
- Configure Render MCP in Claude Code:
  ```bash
  claude mcp add --transport http render https://mcp.render.com/mcp \
    --header "Authorization: Bearer <API_KEY>"
  ```

### 3.2 Create k4b-env environment group on Render dashboard
Manually in Render dashboard → Environment Groups → Create group named `k4b-env`. Add:
- `MONGODB_URI` — Atlas M0 connection string (with `+srv`)
- `OPENROUTER_API_KEY` — OpenRouter key
- `CLIENT_ORIGIN` — will update after service URL is known
- `NODE_ENV` — `production`

### 3.3 Deploy Web Service via Blueprint (render.yaml)
Render dashboard → New → Blueprint → Connect GitHub `louverture-t/kanban-for-business`. Render detects `render.yaml` and creates the web service.

### 3.4 MongoDB Atlas — IP allowlist
Atlas dashboard → Network Access → Add IP → `0.0.0.0/0` (Allow from anywhere).

> **Reason:** Render outbound IPs rotate on each deploy. A static allowlist will break deployments after restart/redeploy.

### 3.5 Update CLIENT_ORIGIN after service URL is known
Once Render assigns service URL (e.g., `https://kanban-for-business.onrender.com`):
- Update `CLIENT_ORIGIN` in `k4b-env` group to that URL
- Trigger manual redeploy from Render dashboard

### 3.6 Get deploy hook URL → add GitHub Secret
Render dashboard → Service → Settings → Deploy Hook → copy URL.
GitHub repo → Settings → Secrets and variables → Actions → New secret:
- Name: `RENDER_DEPLOY_HOOK_URL`
- Value: paste hook URL

### 3.7 Trigger first deploy + monitor
Push a commit to `main` or manually trigger deploy from Render dashboard. Monitor Build Logs. Expected successful sequence:
1. `npm ci` completes
2. `tsc && vite build` completes
3. `node dist/server/index.js` starts
4. `✅ MongoDB connected`
5. Health check at `/api/health` → HTTP 200

### 3.8 mongodb-natural-language-querying skill — Post-deploy Atlas verification
Once deployed: query `users` collection via MCP → confirm superadmin exists (seed.ts runs on empty DB at startup).
If no users found: check `server/seed.ts` — confirm it is called in `server/index.ts` startup sequence.

### 3.9 render-deployment-engineer agent — Post-deploy health check
Agent verifies from deploy logs: build succeeded, server started, health check green.
```bash
curl https://<your-service>.onrender.com/api/health
# Expected: {"status":"ok"}
```

---

## Phase 4 — Final Validation Sweep (Manual)

Manual test of every RBAC path:

- [ ] Superadmin can access everything
- [ ] Manager can create projects/tasks, use AI, cannot access `/admin`
- [ ] User can only edit own tasks, cannot use AI, cannot create projects
- [ ] Unauthenticated requests rejected (GraphQL + REST)
- [ ] Invite-only registration works end-to-end (create invitation → copy URL → open in incognito → register)
- [ ] Refresh token rotation works (check network tab — cookie refreshed silently)
- [ ] Idle timeout triggers sleep overlay after 15 minutes
- [ ] No-PHI banner visible on all authenticated pages
- [ ] Ctrl+K search finds tasks across projects user has access to
- [ ] Notifications created on assignment, comment, and AI complete

---

## Verification Commands

```bash
npm run check                     # TypeScript — zero errors
npm run lint                      # ESLint — zero warnings
npm run test                      # Vitest server + client
npm run test:e2e                  # Playwright (dev server must be running)
npm run build                     # Production build
NODE_ENV=production npm start     # Local production smoke test
curl http://localhost:3001/api/health
curl https://<render-url>/api/health
```

---

## Critical Corrections vs Earlier Plan Draft

| Issue in earlier draft | Correction |
|------------------------|-----------|
| `JWT_SECRET` set manually | `generateValue: true` — Render auto-generates |
| `rootDir: ./server` | Remove — K4B builds from repo root |
| `startCommand: node dist/index.js` | `node dist/server/index.js` — correct output path |
| `autoDeploy: true` | `autoDeploy: false` — `deploy.yml` is the single trigger |
| Missing MongoDB Atlas IP allowlist step | Add `0.0.0.0/0` — Render IPs rotate on each deploy |
| No `graphql-architect` gate before writing ops | Agent validates against `typeDefs.ts` before writing |
| No `mongodb-connection` review | Skill runs before deploy — bare `mongoose.connect()` needs pool config |
| No MCP setup step | `mongodb-mcp-setup` skill runs in Phase 0 pre-flight |

---

## Files Changed / Created

| File | Action | Owner |
|------|--------|-------|
| `client/src/graphql/operations.ts` | Modify — append 6 admin ops | `graphql-architect` agent |
| `client/src/App.tsx` | Modify — replace 3 inline stubs with real imports | Coding agent |
| `client/src/pages/admin.tsx` | **CREATE** — 3 tabs: Users, Invitations, Membership | Coding agent |
| `client/src/pages/settings.tsx` | **CREATE** | Coding agent |
| `client/src/pages/not-found.tsx` | **CREATE** | Coding agent |
| `client/src/components/app-sidebar.tsx` | Verify — admin link guard (no change expected) | Read-only check |
| `playwright.config.ts` | Modify — add webServer, retries, CI workers | Coding agent |
| `e2e/auth.spec.ts` | **CREATE** | Coding agent |
| `e2e/kanban.spec.ts` | **CREATE** | Coding agent |
| `e2e/admin.spec.ts` | **CREATE** | Coding agent |
| `e2e/search.spec.ts` | **CREATE** | Coding agent |
| `.github/workflows/ci.yml` | **CREATE** | `render-deployment-engineer` agent |
| `.github/workflows/deploy.yml` | **CREATE** | `render-deployment-engineer` agent |
| `render.yaml` | **CREATE** | `render-deployment-engineer` agent + `render-deployment` skill |
| `server/config/connection.ts` | Modify — add pool options to `mongoose.connect()` | `mongodb-connection` skill |

---

## Day 5 Checkpoint

- [ ] Admin panel: user management, invitations, membership — all tabs working
- [ ] E2E tests pass (`npm run test:e2e`)
- [ ] CI pipeline passes on PR (type check + lint + Vitest)
- [ ] Deploy pipeline triggers on push to main
- [ ] App deployed and accessible on Render — health check green
- [ ] Production build verified locally before push
- [ ] All 3 RBAC roles manually tested
- [ ] Full auth lifecycle: register → login → use app → idle timeout → refresh → logout
- [ ] PR #9 and PR #10 merged to main
