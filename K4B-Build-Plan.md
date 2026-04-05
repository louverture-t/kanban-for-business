# Kanban for Business — Optimized 5-Day Build Plan

This plan is optimized for **parallel development using Claude Code and Git worktrees**. 
Each subtask is a standalone prompt block for a Claude Code terminal session in a specific worktree.

**Source:** PLAN.md (authoritative) — this file is a condensed prompt-block version.
**Timeline:** 5 Days | **Stack:** MERN + GraphQL (Apollo) + TypeScript + Tailwind + Shadcn UI
**PRs:** 10 total (2 per day) | **Tests:** ~113 across unit, integration, component, and E2E

---

## Parallel Worktree Strategy

1. Open your main terminal and create worktrees for the day's branches.
2. Open a new terminal window for each worktree.
3. `cd` into the worktree directory.
4. Run `claude` to start the agent.
5. Paste the corresponding **Prompt Block** below.

---

## Day 1 — Foundation + Server Core

**Goal:** Express + Apollo Server 4 running, all 12 Mongoose models, auth system with refresh tokens, SDL, auth resolvers with integration tests, seed script, GraphQL playground accessible.

**Branches:** `feat/project-init` → PR #1, then `feat/server-core` → PR #2.

### 1.1 Foundation Setup (Main Branch — `feat/project-init`)
*Run this sequentially first before spawning worktrees.*

```text
Initialize a MERN + GraphQL monorepo for "Kanban for Business" according to the k4b-PRD.md specifications.

1. Run `npm init -y` and install all required production and dev dependencies:
   - Server: express, @apollo/server, graphql, graphql-tag, mongoose, jsonwebtoken, bcryptjs, cors, cookie-parser, multer, pdf-parse, mammoth, express-rate-limit, dotenv
   - Client: react, react-dom, react-router-dom, @apollo/client, graphql, @hello-pangea/dnd, recharts, framer-motion, cmdk, tailwindcss, postcss, autoprefixer (+ shadcn/radix)
   - Build: typescript, @types/*, vite, @vitejs/plugin-react, eslint
   - Testing: vitest, @testing-library/react, @testing-library/jest-dom, @testing-library/user-event, mongodb-memory-server, jsdom, @playwright/test
2. Configure TypeScript with strict mode and path aliases (@client/* → client/src/*, @server/* → server/*, @shared/* → shared/*).
3. Set up Vite with React plugin, proxy /graphql and /api to http://localhost:3001. Configure Tailwind CSS with dark mode (class strategy) and custom CSS properties for theming.
4. Initialize Shadcn UI in `client/src/components/ui/` with `components.json`.
5. Configure Vitest for two test projects: `server` (node environment, mongodb-memory-server setup in beforeAll/afterAll) and `client` (jsdom environment, @testing-library/jest-dom matchers). Coverage via v8 provider.
6. Add all NPM scripts: dev, build, start, check, lint, test, test:server, test:client, test:e2e, test:coverage.
7. Create minimal `client/src/main.tsx` that renders `<App />` and `client/src/index.css` with Tailwind directives + shadcn CSS variables.

Do not implement business logic yet. Verify: `npm install` succeeds, `npx tsc --noEmit` passes, `npm run dev` starts Vite on port 5173, `npm run test` exits clean.

When complete, create PR #1 with title: "Initialize monorepo with MERN + GraphQL stack, Vitest, and build tooling"
```

### 1.2 Server Core + Auth + Models + SDL + Auth Resolvers (Worktree: `feat/server-core`)
*Run after PR #1 is merged to main.*

```text
Build the complete server core for Kanban for Business based on the PRD. This branch covers: Express + Apollo Server setup, env validation, custom errors, auth utilities, validators, all 12 Mongoose models, full GraphQL SDL, auth resolvers, seed script, shared types, and unit + integration tests.

**Server entry point** (`server/index.ts`, `server/vite.ts`, `server/static.ts`):
1. Express app with cors, cookie-parser, express.json() middleware.
2. Apollo Server 4 via expressMiddleware from @apollo/server/express4.
3. Context function: decode JWT from Authorization header, attach user to context.
4. Health check: GET /api/health → { status: "ok" }.
5. Vite dev middleware (server/vite.ts) for development, static file serving (server/static.ts) for production (dist/public).
6. Hourly sweep intervals: archiveSweep and purgeSweep via setInterval.
7. Cookie settings for refresh token: HttpOnly, Secure in prod, SameSite=Strict.

**Env validation + errors** (`server/config/connection.ts`, `server/utils/errors.ts`):
8. Validate MONGODB_URI, JWT_SECRET, OPENROUTER_API_KEY on startup; exit with clear message if missing; connect to MongoDB Atlas via Mongoose.
9. Custom GraphQL error classes: AuthenticationError, ForbiddenError, ValidationError, NotFoundError — all extend GraphQLError with appropriate codes.

**Auth utilities** (`server/utils/auth.ts`):
10. signAccessToken(user) → JWT 15-min TTL, signRefreshToken(user) → JWT 2-hr TTL, verifyToken(token), hashPassword (bcrypt 12 rounds), comparePassword, hashRefreshToken, buildContext(req).
11. RBAC guards: requireAuth, requireManagerOrAbove, requireSuperadmin, requireProjectAccess (checks project membership, Superadmin bypasses).

**Validators** (`server/utils/validators.ts`):
12. validatePassword (min 8 chars, 1 uppercase, 1 number, 1 special char), validateUsername (alphanumeric 3-30 chars), sanitizeInput (basic XSS prevention).

**Unit tests** (`server/__tests__/utils/auth.test.ts`, `validators.test.ts`):
13. ~15 auth tests: JWT sign/verify round-trip, expired token, tampered token, hash/compare password, all RBAC guards (requireAuth throws AuthenticationError when no user, requireManagerOrAbove throws ForbiddenError for "user" role, requireSuperadmin rejects manager/user, etc.).
14. ~8 validator tests: password policy rejections (short, no uppercase, no number, no special), valid acceptance, username rejections and acceptance.

**All 12 Mongoose models** (`server/models/`):
15. User, Project, ProjectFolder, ProjectMember, Task, Subtask, Tag, TaskTag, Comment, AuditLog, Notification, Invitation.
16. All use timestamps: true. Tasks use assigneeId as ObjectId ref. User has pre-save hook for password hashing and refreshTokenHash field. ProjectMember has compound unique index { projectId, userId }. Task has text index { title, description } and compound index { projectId, status }. Invitation has 7-day expiry and unique token.
17. Barrel export from server/models/index.ts.

**GraphQL SDL** (`server/schemas/typeDefs.ts`):
18. Full SDL per PRD Section 8: all object types (User, Project, ProjectFolder, ProjectMember, Task, Subtask, Tag, TaskTag, Comment, AuditLog, Notification, Invitation, AuthPayload, TaskPreview), input types (ProjectInput, TaskInput, TaskPreviewInput), enum types (status, priority, role, category, notification type), all 17 queries and 30+ mutations.

**Auth resolvers** (`server/resolvers/authResolvers.ts`):
19. me query, login (validate credentials, check lockout, reset/increment failedAttempts, sign tokens, set refresh cookie, audit log), register (validate invite token, validate password, create user, mark invitation accepted, sign tokens), changePassword (validate current + new password policy, clear mustChangePassword), refreshToken (read cookie, verify hash, rotate token), logout (clear cookie, remove refreshTokenHash).

**Seed script** (`server/seed.ts`):
20. On startup check if any users exist; if none, create superadmin with mustChangePassword: true.

**Auth integration tests** (`server/__tests__/resolvers/auth.test.ts`):
21. ~16 tests using mongodb-memory-server: login success + refresh cookie, wrong password increments failedAttempts, lockout after 5 failures, lockout expiry, register with valid/expired invite token, register with invalid password, register marks invitation accepted, changePassword correct/wrong current, changePassword clears mustChangePassword, refreshToken success + rotation + invalid cookie, logout clears refreshTokenHash, me returns user.

**Shared types** (`shared/types.ts`):
22. TypeScript interfaces matching all GraphQL types: IUser, IProject, ITask, ISubtask, IComment, ITag, INotification, IAuditLog, IInvitation, IProjectFolder, IProjectMember, AuthPayload, TokenPayload. Enums: UserRole, TaskStatus, TaskPriority, ProjectStatus, ProjectCategory, NotificationType.

Verify: Server starts on port 3001, /api/health returns OK, /graphql serves Apollo Sandbox, superadmin seeded on first run, login/me/refreshToken/logout flow works, npm run test:server — all pass.

When complete, create PR #2 with title: "Add server core: models, auth system, GraphQL schema, auth resolvers, and unit/integration tests"
```

---

## Day 2 — All Remaining Resolvers + Client Shell

**Goal:** Every GraphQL query and mutation works with integration tests. Client has auth flow, routing, sidebar, theme, and page shells.

**Branches:** `feat/graphql-resolvers` → PR #3, then `feat/client-shell` → PR #4.

### 2.1 All Remaining GraphQL Resolvers (Worktree: `feat/graphql-resolvers`)
*Run after Day 1 PRs are merged. Resolver groups can be parallelized via subagents.*

```text
Implement ALL remaining GraphQL resolvers for Kanban for Business based on the PRD. Auth resolvers already exist from Day 1 — this covers everything else.

**Folder + Project resolvers** (`server/resolvers/folderResolvers.ts`, `projectResolvers.ts`):
1. Folder: folders query (authenticated), createFolder/updateFolder/deleteFolder (Manager+ guard).
2. Project: projects query scoped to user membership (superadmin sees all), project query by ID with membership check, projectMembers query.
3. createProject (Manager+, auto-add creator as member), updateProject (Manager+ and member), deleteProject (Superadmin, cascade delete tasks/members/etc), addProjectMember/removeProjectMember (Superadmin).
4. Field resolvers: Project.folder, Project.createdByUser, Project.memberCount.

**Task resolvers** (`server/resolvers/taskResolvers.ts`):
5. tasks query (by projectId, filter out deleted, optionally include archived), task query (by ID with membership check), searchTasks (MongoDB text search scoped to accessible projects), trashedTasks (tasks with deletedAt set, scoped).
6. createTask (authenticated + member, auto-set createdBy, audit log, assignment notification if assigneeId set), updateTask (owner or Manager+, audit log changes, handle status→complete sets completedAt, status from complete clears completedAt/archivedAt).
7. deleteTask (soft delete: deletedAt = new Date()), restoreTask (clear deletedAt), unarchiveTask (clear archivedAt).
8. archiveSweep: tasks with status "complete" and completedAt > 7 days ago → set archivedAt.
9. purgeSweep: permanently delete tasks with deletedAt > 7 days ago OR archivedAt > 30 days ago; cascade delete subtasks/comments/tags/audit logs.
10. Field resolvers: Task.project, Task.assignee (User from assigneeId), Task.createdByUser, Task.subtasks, Task.comments, Task.tags.

**Subtask + Comment + Tag resolvers** (`server/resolvers/subtaskResolvers.ts`, `commentResolvers.ts`, `tagResolvers.ts`):
11. Subtask: subtasks query (by taskId), createSubtask, updateSubtask, deleteSubtask.
12. Comment: comments query (by taskId), createComment (+ notification to task assignee), deleteComment. auditLogs query (by taskId).
13. Tag: tags query (all), createTag, addTagToTask, removeTagFromTask, taskTags query (by taskId).

**Notification + Admin resolvers** (`server/resolvers/notificationResolvers.ts`, `adminResolvers.ts`):
14. Notification: notifications query (user-scoped, newest first), markNotificationRead, markAllNotificationsRead.
15. Admin: adminUsers query (Superadmin), adminInvitations query (Superadmin), updateUser (Superadmin: change role/active, audit log, revoke refresh token if deactivated), createInvitation (Superadmin: unique token, 7-day expiry, optional project assignment).

**AI resolvers + File upload** (`server/resolvers/aiResolvers.ts`, REST route in `server/index.ts`):
16. aiDecompose (Manager+ and member, rate limited 10/hr, OpenRouter with No-PHI system prompt, return [TaskPreview]).
17. aiConfirmDecomposition (Manager+ and member, create tasks from previews, audit log, ai_complete notification).
18. aiGenerateSubtasks (Manager+ and member, rate limited, return [String]).
19. POST /api/upload: Multer (disk, 5MB, .txt/.md/.docx/.pdf), extract text via pdf-parse/mammoth/readFile, return { text }, delete temp file.

**Resolver index** (`server/resolvers/index.ts`):
20. Import and deep-merge all resolver modules into single export.

**Integration tests** (`server/__tests__/resolvers/`):
21. Project tests (~10): CRUD for Manager+, regular user forbidden, membership scoping, superadmin sees all, deleteProject cascades, add/removeProjectMember require Superadmin.
22. Task tests (~12): CRUD with RBAC, searchTasks scoping, soft delete/restore, archiveSweep (complete > 7 days), purgeSweep (trashed > 7 days OR archived > 30 days), completedAt on status change, assignment notification, audit log on changes.
23. Subtask/comment/tag tests (~8): CRUD basics, auth required.
24. Admin tests (~8): updateUser requires Superadmin, createInvitation generates token with 7-day expiry, deactivating user clears refreshTokenHash.
25. AI tests (~6, mock OpenRouter): aiDecompose returns previews, aiConfirmDecomposition creates tasks, rate limiting rejects after 10, Manager+ required.

Verify: Every query and mutation works via Apollo Sandbox. npm run test:server — all pass.

When complete, create PR #3 with title: "Add all GraphQL resolvers with full integration test suite"
```

### 2.2 Client Shell + Apollo Setup (Worktree: `feat/client-shell`)
*Run after PR #3 is merged to main.*

```text
Set up the React client shell and Apollo Client for Kanban for Business.

**Apollo Client** (`client/src/lib/apolloClient.ts`, `client/src/utils/auth.ts`):
1. HttpLink to /graphql, authLink (Bearer token from in-memory storage), errorLink (intercept UNAUTHENTICATED → attempt refreshToken → retry or redirect to login; other errors → toast).
2. InMemoryCache with type policies for task/project lists. credentials: 'same-origin' (or 'include' for dev).
3. In-memory token storage: getToken(), setToken(), clearToken() — no localStorage.

**Auth hook** (`client/src/hooks/use-auth.ts`):
4. AuthProvider context: user, loading, login(), logout(), refetchUser().
5. On mount: attempt refreshToken → if success, set token + fetch me → if fail, user is logged out.
6. login(): call mutation, set token, set user. logout(): call mutation, clear token, redirect to /login.
7. Expose isAuthenticated, isSuperadmin, isManagerOrAbove computed booleans.

**App shell** (`client/src/App.tsx`):
8. ApolloProvider → AuthProvider → ThemeProvider → Router.
9. Protected routes: redirect to /login if not authenticated. Force /change-password if user.mustChangePassword.
10. Routes: /, /login, /register, /change-password, /project/:projectId/kanban, /project/:projectId/priority, /project/:projectId/roadmap, /project/:projectId/team, /admin, /settings, * (404).

**Sidebar** (`client/src/components/app-sidebar.tsx`):
11. Logo/brand at top. Nav links: Dashboard, Admin (superadmin only).
12. Project list (fetched via projects query), each expandable with view links (Kanban, Priority, Roadmap, Team).
13. Notification bell in footer. User info + logout button in footer.

**Auth pages** (`client/src/pages/login.tsx`, `register.tsx`, `change-password.tsx`):
14. Login: username + password form, lockout timer display, error toast, redirect to dashboard (or change-password if mustChangePassword).
15. Register: username + password + optional email, invite token from URL query param, password strength indicator, redirect to dashboard.
16. Change password: current + new + confirm, validate policy client-side.

**Theme + No-PHI + Error boundary + Toast**:
17. Theme provider: dark/light via CSS class on <html>, persisted in localStorage. Theme toggle: sun/moon icon.
18. No-PHI banner: sticky on all authenticated pages — "No PHI: Do not enter patient names, DOB, MRN, or other identifiers". Cannot be dismissed.
19. Error boundary: catches React render errors, shows fallback UI.
20. Toast hook: wraps shadcn toast component for programmatic use.

Verify: Auth flow works end-to-end (login → dashboard, register with token, forced password change, logout). Sidebar navigates. Theme toggle works. No-PHI banner visible.

When complete, create PR #4 with title: "Add client shell: Apollo Client, auth flow, routing, sidebar, and theme"
```

---

## Day 3 — Kanban Board + Task Management + Alternative Views

**Goal:** Fully functional Kanban board with DnD, task/project dialogs, archive/trash lifecycle. Priority Board and Team View working. Component tests passing.

**Branches:** `feat/kanban-board` → PR #5, then `feat/priority-team-views` → PR #6.

### 3.1 Kanban Board + Dialogs + Archive/Trash (Worktree: `feat/kanban-board`)
*Run after Day 2 PRs are merged.*

```text
Build the Kanban board, task/project dialogs, and archive/trash lifecycle for Kanban for Business.

**Task card** (`client/src/components/task-card.tsx`):
1. Displays: title, priority badge (color-coded), assignee avatar/name, due date (red if overdue), subtask completion count (e.g. "3/5").
2. Click opens task dialog. Shows "Archived" badge if archivedAt set. Trash countdown in trash view.
3. Framer Motion entrance animation.

**Project dialog** (`client/src/components/project-dialog.tsx`):
4. Create and edit modes. Fields: name, description, status, color (color picker), category dropdown, start/end dates, folder dropdown.
5. Submit calls createProject or updateProject. Manager+ only.

**Task dialog** (`client/src/components/task-dialog.tsx`):
6. Tabbed dialog with: Details (title, description, status, priority, assignee dropdown, start/due dates), Subtasks (list with checkboxes, add/delete, AI generate button for Manager+), Comments (list with author + timestamp, add input), Tags (add/remove, create new), Activity (audit log entries).
7. Create mode: only Details tab. Edit mode: all tabs.
8. Submit calls createTask or updateTask. "Move to Trash" button (soft delete) in edit mode.

**Kanban board** (`client/src/pages/kanban.tsx`):
9. Four columns: Backlog, Active, Review, Complete using @hello-pangea/dnd (DragDropContext → Droppable per column → Draggable per card).
10. On drag end: call updateTask mutation with new status and position. Task count badge per column header.
11. Per-column "+" button to create task in that status. AI Decompose button in header (Manager+ only).
12. Fetches tasks via tasks(projectId, includeArchived) query. Filter out deletedAt tasks from main columns.

**Archive toggle + Trash panel**:
13. "Show Archived" toggle: shows archived tasks in original column with "Archived" badge and "Unarchive" button.
14. "Show Trash" toggle: expands collapsible section below columns. Lists trashed tasks with countdown ("Deleted 3d ago — 4d until purge"). "Restore" button per task.
15. On mount: trigger archiveSweep mutation to auto-archive completed tasks > 7 days.

**Component tests** (`client/src/__tests__/`):
16. Task card tests: renders title/priority/assignee, "Archived" badge when archivedAt set, overdue styling, onClick fires.
17. Task dialog tests: create mode shows only Details tab, edit mode shows all tabs, form submits with correct values.
18. Kanban tests (mock Apollo): renders four columns, tasks in correct columns by status, archive toggle shows/hides.

Verify: DnD works (drag Backlog → Active → Review → Complete). Task dialog creates/edits. Subtasks, comments, tags functional. Archive/trash lifecycle works. npm run test:client — all pass.

When complete, create PR #5 with title: "Add Kanban board with DnD, task/project dialogs, archive/trash lifecycle"
```

### 3.2 Priority Board + Team View (Worktree: `feat/priority-team-views`)
*Run after PR #5 is merged to main.*

```text
Build the Priority Board and Team View for Kanban for Business.

**Priority board** (`client/src/pages/priority.tsx`):
1. Three sections: High, Medium, Low.
2. Same task cards as Kanban. Click opens task dialog.
3. No DnD — priority changed via dialog edit.
4. Fetches tasks(projectId) query, groups by priority field.

**Team view** (`client/src/pages/team.tsx`):
5. Sections grouped by assignee (resolved User from assigneeId). "Unassigned" group for null assigneeId.
6. Same task cards. User avatar/name as section header with task count.
7. Fetches tasks(projectId) + projectMembers(projectId) for grouping.

**Component tests** (`client/src/__tests__/pages/`):
8. Priority tests (mock Apollo): renders three sections (High/Medium/Low), tasks in correct section, empty section shows placeholder.
9. Team tests (mock Apollo): renders sections per assignee + Unassigned, correct task count per assignee, unassigned tasks grouped correctly.

Verify: Priority board groups correctly. Team view groups by assignee. npm run test:client — all pass.

When complete, create PR #6 with title: "Add Priority board and Team view with component tests"
```

---

## Day 4 — Dashboard + Roadmap + AI + Search + Notifications

**Goal:** All five view modes operational. AI decomposition and subtask generation working. Global search and notifications wired. Idle timer functional.

**Branches:** `feat/dashboard-roadmap` → PR #7, then `feat/ai-search-notifications` → PR #8.

### 4.1 Dashboard + Roadmap (Worktree: `feat/dashboard-roadmap`)
*Run after Day 3 PRs are merged.*

```text
Build the Dashboard and Roadmap (Gantt) views for Kanban for Business.

**Dashboard** (`client/src/pages/dashboard.tsx`):
1. Stats cards: total tasks, completed, active, overdue (clickable to filter).
2. Completion rate progress bar (% of tasks in "complete" status).
3. Priority task list: top 10 high-priority non-complete tasks sorted by due date.
4. Status distribution chart: pie/donut via Recharts (Backlog/Active/Review/Complete).
5. Priority distribution chart: bar chart (High/Medium/Low).
6. Folder/project progress: grouped by folder, each project shows progress bar (completed/total). Folders manageable inline (create/edit/delete for Manager+).
7. Fetches projects, tasks, folders queries.

**Roadmap (Gantt)** (`client/src/pages/roadmap.tsx`):
8. Timeline grid: months as columns (month view) or quarters (quarter view).
9. Task rows: horizontal bar from startDate to dueDate. Single-day marker if no startDate. Bars color-coded by priority, clipped to visible window.
10. Navigation: Previous/Next period buttons, "Today" button (scroll to current date). View toggle: Month / Quarter.
11. Click task bar opens task dialog. Responsive: horizontal scroll.
12. Implementation: custom CSS Grid or absolute-positioned divs in scrollable container. Each month column fixed width, task bars absolutely positioned via date math.

**Component tests** (`client/src/__tests__/pages/`):
13. Dashboard tests (mock Apollo): renders stat cards with correct counts, progress bar correct percentage, folder sections with project progress bars.
14. Roadmap tests (mock Apollo): task bars in correct positions based on dates, "Today" button scrolls to current month, view toggle switches month/quarter.

Verify: Dashboard renders stats, charts, folder progress. Roadmap shows task bars, navigation works. npm run test:client — all pass.

When complete, create PR #7 with title: "Add Dashboard with charts and Roadmap/Gantt timeline view"
```

### 4.2 AI Features + Search + Notifications + Idle Timer (Worktree: `feat/ai-search-notifications`)
*Run after PR #7 is merged to main.*

```text
Implement AI features, global search, notifications, and idle timer for Kanban for Business.

**AI decompose dialog** (`client/src/components/ai-decompose-dialog.tsx`):
1. Step 1 — Input: textarea for pasting text OR file upload button (.txt/.md/.docx/.pdf, 5MB max). File upload POSTs to /api/upload → receives { text } → auto-fills textarea.
2. Step 2 — Preview: call aiDecompose mutation → display proposed tasks in editable list. Each: editable title, description, priority dropdown, due date picker, assignee dropdown. Add/remove proposed tasks.
3. Step 3 — Confirm: call aiConfirmDecomposition → tasks created → toast success → close → refetch task list.
4. Loading states and error handling. Manager+ only (button hidden for regular users).

**AI subtask generation** (integrated into task-dialog.tsx Subtasks tab):
5. "Generate with AI" button (Manager+ only). Calls aiGenerateSubtasks(taskId).
6. Returns preview list of suggested subtask titles. Each editable with accept/reject toggle.
7. "Add Selected" button: calls createSubtask for each accepted. Loading state during generation.

**Global search** (`client/src/components/search-command.tsx`):
8. Triggered by Ctrl+K / Cmd+K. cmdk-style dialog (or shadcn Command component).
9. Debounced text input (300ms). Calls searchTasks(query) GraphQL query.
10. Results: task cards with project name, status badge, "Archived" badge if applicable.
11. Click result → navigate to project Kanban view + open task dialog. Close on Escape.

**Notification bell** (`client/src/components/notification-bell.tsx`):
12. Bell icon in sidebar footer. Red badge with unread count (0 = hidden).
13. Click opens popover: notification list (newest first), unread highlighted with blue dot, type icon + content + relative timestamp.
14. Click item → mark read + navigate to related task. "Mark all as read" button.
15. Auto-refresh via pollInterval: 30000 on notifications query.

**Idle timer + Sleep overlay** (`client/src/hooks/use-idle-timer.ts`, `client/src/components/sleep-overlay.tsx`):
16. Track: mousemove, keydown, click, scroll, touchstart. 15-minute timeout. Returns { isIdle, resetTimer }.
17. Full-screen semi-transparent overlay with "Wake Up" button. On wake: resetTimer(), check token validity, attempt refresh if expired, redirect to login if refresh fails.

Verify: AI decompose text/file → preview → confirm → tasks created. AI subtask generation works. Ctrl+K search finds tasks. Notification bell shows unread, popover works. Idle timer triggers after 15 minutes.

When complete, create PR #8 with title: "Add AI features, global search, notifications, and idle timer"
```

---

## Day 5 — Admin Panel + E2E + CI/CD + Deploy

**Goal:** Admin panel fully functional. E2E test suite passing. CI/CD pipeline configured. Deployed to Render. All RBAC paths validated.

**Branches:** `feat/admin-panel` → PR #9, then `feat/ci-cd-deploy` → PR #10.

### 5.1 Admin Panel + Settings + E2E Tests (Worktree: `feat/admin-panel`)
*Run after Day 4 PRs are merged.*

```text
Build the Admin panel, Settings page, 404 page, and E2E test suite for Kanban for Business.

**Admin — User management** (`client/src/pages/admin.tsx`):
1. Users section: table with username, email, role, active status, created date.
2. Toggle active/inactive (calls updateUser). Role dropdown: user/manager/superadmin (calls updateUser).
3. Audit log entry on role/status change. Cannot deactivate own account.

**Admin — Invitations**:
4. Create form: email, role dropdown, optional project dropdown. Submit calls createInvitation.
5. Generates shareable URL: {origin}/register?token={token}. "Copy URL" button.
6. Table: email, role, status (pending/accepted/expired), created date, expiry date.

**Admin — Project membership**:
7. Project selector dropdown. Shows current members. "Add Member" dropdown (non-members). "Remove" button per member.
8. Calls addProjectMember / removeProjectMember.

**Settings + 404** (`client/src/pages/settings.tsx`, `not-found.tsx`):
9. Settings: theme selection (dark/light/system), display name (future), password change link.
10. 404: simple page with link to dashboard.

**Superadmin-only access**: admin.tsx accessible only to Superadmins. All actions handle errors gracefully.

**E2E tests — Playwright** (`e2e/`, `playwright.config.ts`):
11. Config: base URL http://localhost:5173, web server starts dev server, chromium primary.
12. auth.spec.ts: login success → dashboard, wrong password → error, locked account → lockout message, register with invite token, forced password change redirect, logout → login page, protected route redirect.
13. kanban.spec.ts: navigate to Kanban, create task via "+", drag Backlog→Active, edit task via click, delete → trash, restore from trash, archive toggle.
14. admin.spec.ts: superadmin accesses admin, manager redirected, create invitation → URL shown, change role → reflected, add/remove member → reflected.
15. search.spec.ts: Ctrl+K opens search, type query → results appear, click result → navigates.

Verify: Admin panel works for all three sections. E2E: npm run test:e2e — all pass.

When complete, create PR #9 with title: "Add admin panel (users, invitations, membership) and E2E test suite"
```

### 5.2 CI/CD + Render Deploy (Worktree: `feat/ci-cd-deploy`)
*Run after PR #9 is merged to main.*

```text
Set up CI/CD pipeline and Render deployment for Kanban for Business.

**GitHub Actions CI** (`.github/workflows/ci.yml` — on PR to main):
1. Checkout, Setup Node 20 with npm cache, npm ci.
2. npm run check (tsc --noEmit).
3. npm run lint.
4. npm run test (Vitest — server + client unit/integration).

**GitHub Actions Deploy** (`.github/workflows/deploy.yml` — on push to main):
5. Checkout.
6. curl -X POST ${{ secrets.RENDER_DEPLOY_HOOK_URL }}.

**Render config** (`render.yaml`):
7. Node web service per PRD Section 10. Env vars from k4b-env group on Render.
8. Build command builds Vite app. Start command serves via Express in production.

**Production build verification**:
9. npm run build produces dist/ (server) + dist/public/ (client).
10. Test locally: NODE_ENV=production npm start → serves static + GraphQL.
11. Push to main → GitHub Actions triggers Render deploy.
12. Verify on Render: health check passes, login works, full flow operational.

**Final validation sweep** (manual):
- Superadmin can access everything.
- Manager can create projects/tasks, use AI, cannot access admin.
- User can only edit own tasks, cannot use AI, cannot create projects.
- Unauthenticated requests rejected.
- Invite-only registration end-to-end.
- Refresh token rotation works.
- Idle timeout triggers correctly.
- No-PHI banner visible everywhere.
- Search finds tasks across accessible projects.
- Notifications on assignment, comment, AI complete.

When complete, create PR #10 with title: "Add CI/CD pipeline and Render deployment config"
```

---

## Reference: PR Schedule

| PR | Branch | Title |
|----|--------|-------|
| #1 | `feat/project-init` | Initialize monorepo with MERN + GraphQL stack, Vitest, and build tooling |
| #2 | `feat/server-core` | Add server core: models, auth system, GraphQL schema, auth resolvers, and unit/integration tests |
| #3 | `feat/graphql-resolvers` | Add all GraphQL resolvers with full integration test suite |
| #4 | `feat/client-shell` | Add client shell: Apollo Client, auth flow, routing, sidebar, and theme |
| #5 | `feat/kanban-board` | Add Kanban board with DnD, task/project dialogs, archive/trash lifecycle |
| #6 | `feat/priority-team-views` | Add Priority board and Team view with component tests |
| #7 | `feat/dashboard-roadmap` | Add Dashboard with charts and Roadmap/Gantt timeline view |
| #8 | `feat/ai-search-notifications` | Add AI features, global search, notifications, and idle timer |
| #9 | `feat/admin-panel` | Add admin panel (users, invitations, membership) and E2E test suite |
| #10 | `feat/ci-cd-deploy` | Add CI/CD pipeline and Render deployment config |

## Reference: Test Coverage (~113 tests)

| Category | Count | Scope |
|----------|-------|-------|
| Auth utilities unit | ~15 | JWT, password hash, RBAC guards |
| Validator unit | ~8 | Password policy, username rules |
| Auth resolver integration | ~16 | Login, register, refresh, logout, lockout |
| Project/folder integration | ~10 | CRUD, membership, cascade, RBAC |
| Task resolver integration | ~12 | CRUD, search, archive/trash, sweeps, audit |
| Subtask/comment/tag integration | ~8 | CRUD basics, auth |
| Admin/notification integration | ~8 | RBAC, invitations, user management |
| AI resolver integration | ~6 | Decompose, confirm, rate limiting |
| Client component unit | ~15 | Cards, dialogs, Kanban, Priority, Team, Dashboard |
| E2E (Playwright) | ~15 | Auth, Kanban DnD, admin, search |
| **Total** | **~113** | |
