# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

Kanban for Business (K4B) — Kanban-style project management app for Atlas Infectious Disease Practice (AIDP). UCF Split Stack program (Back End track). Invite-only, 3-user team.

## Tech Stack

MERN + GraphQL + TypeScript monorepo:
- **Frontend:** React 18, Vite, Tailwind v3, Shadcn UI (Radix), Apollo Client v3, React Router v6, `@hello-pangea/dnd`, Recharts, Framer Motion, cmdk
- **Backend:** Node 20, Express 4, Apollo Server v4 (`expressMiddleware`), Mongoose v8, JWT (jsonwebtoken + bcryptjs)
- **Database:** MongoDB Atlas (M0)
- **AI:** OpenRouter (google/gemini-3.1-flash-lite-preview), server-side only
- **Testing:** Vitest, React Testing Library, mongodb-memory-server, Playwright
- **Deploy:** Render + GitHub Actions CI/CD

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
