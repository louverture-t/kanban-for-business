# Day 4 — Dashboard + Roadmap + AI + Search + Notifications

**Goal:** All five view modes operational. AI decomposition and subtask generation working. Global search and notifications wired.

---

## Task Tracker

| # | Task | Branch | File(s) | Status |
|---|------|--------|---------|--------|
| 4.1 | Dashboard page | `feat/dashboard-roadmap` | `client/src/pages/dashboard.tsx` | ⬜ Not Started |
| 4.2 | Roadmap (Gantt) page | `feat/dashboard-roadmap` | `client/src/pages/roadmap.tsx` | ⬜ Not Started |
| 4.2T | Component tests — Dashboard + Roadmap | `feat/dashboard-roadmap` | `client/src/__tests__/pages/dashboard.test.tsx`, `roadmap.test.tsx` | ⬜ Not Started |
| 4.3 | PR #7 — `feat/dashboard-roadmap` → main | — | — | ⬜ Not Started |
| 4.4 | AI decompose dialog | `feat/ai-search-notifications` | `client/src/components/ai-decompose-dialog.tsx` | ⬜ Not Started |
| 4.5 | AI subtask generation | `feat/ai-search-notifications` | `client/src/components/task-dialog.tsx` (Subtasks tab) | ⬜ Not Started |
| 4.6 | Global search | `feat/ai-search-notifications` | `client/src/components/search-command.tsx` | ⬜ Not Started |
| 4.7 | Notification bell | `feat/ai-search-notifications` | `client/src/components/notification-bell.tsx` | ⬜ Not Started |
| 4.8 | Sleep overlay + idle timer | `feat/ai-search-notifications` | `client/src/hooks/use-idle-timer.ts`, `client/src/components/sleep-overlay.tsx` | ⬜ Not Started |
| 4.9 | PR #8 — `feat/ai-search-notifications` → main | — | — | ⬜ Not Started |

**Status key:** ⬜ Not Started · 🔄 In Progress · ✅ Done · ❌ Blocked

---

## Day 4 Checkpoint

- [ ] Dashboard renders stats, charts, folder progress
- [ ] Roadmap shows task bars on timeline, navigation works
- [ ] AI decompose: text/file → preview → confirm → tasks created
- [ ] AI subtask generation works in task dialog
- [ ] Ctrl+K search finds tasks across projects
- [ ] Notification bell shows unread count, popover lists notifications
- [ ] Idle timer triggers sleep overlay after 15 minutes
- [ ] **All component tests pass** (`npm run test:client`)
- [ ] PR #7 and PR #8 merged to main

---

---

# Plan: Implement Task 4.1 — Dashboard Page

## TL;DR

Replace the `DashboardPage` placeholder in `App.tsx` with a full `client/src/pages/dashboard.tsx`. All three needed queries (`PROJECTS_QUERY`, `TASKS_QUERY`, `FOLDERS_QUERY`) already exist in `operations.ts`. Four folder/project mutations are missing from `operations.ts` and must be added first. Use `priority.tsx` as the reference pattern for query + TaskCard + TaskDialog.

---

## Pre-requisite: Git Setup

```bash
git checkout main && git pull
git checkout -b feat/dashboard-roadmap
```

---

## Phase 1 — Add Missing Mutations to `client/src/graphql/operations.ts`

All four exist in the server SDL (`server/schemas/typeDefs.ts` lines 294–296, 301) but are absent from the client.

```typescript
export const CREATE_FOLDER_MUTATION = gql`
  mutation CreateFolder($name: String!, $color: String) {
    createFolder(name: $name, color: $color) {
      _id
      name
      color
    }
  }
`;

export const UPDATE_FOLDER_MUTATION = gql`
  mutation UpdateFolder($id: ID!, $name: String, $color: String) {
    updateFolder(id: $id, name: $name, color: $color) {
      _id
      name
      color
    }
  }
`;

export const DELETE_FOLDER_MUTATION = gql`
  mutation DeleteFolder($id: ID!) {
    deleteFolder(id: $id)
  }
`;

export const DELETE_PROJECT_MUTATION = gql`
  mutation DeleteProject($id: ID!) {
    deleteProject(id: $id)
  }
`;
```

---

## Phase 2 — Create `client/src/pages/dashboard.tsx`

### State

```typescript
const [filterStatus, setFilterStatus] = useState<TaskStatus | null>(null);
const [folderDialogOpen, setFolderDialogOpen] = useState(false);
const [folderDialogMode, setFolderDialogMode] = useState<'create' | 'edit'>('create');
const [editingFolder, setEditingFolder] = useState<IProjectFolder | null>(null);
const [projectDialogOpen, setProjectDialogOpen] = useState(false);
const [projectDialogMode, setProjectDialogMode] = useState<'create' | 'edit'>('create');
const [editingProject, setEditingProject] = useState<IProject | null>(null);
const [openTaskId, setOpenTaskId] = useState<string | null>(null);
```

### Data Fetching

```typescript
const { data: projectsData, refetch: refetchProjects } = useQuery<{ projects: IProject[] }>(PROJECTS_QUERY);
const { data: tasksData, refetch: refetchTasks } = useQuery<{ tasks: ITask[] }>(TASKS_QUERY, {
  variables: { includeArchived: false },
});
const { data: foldersData, refetch: refetchFolders } = useQuery<{ folders: IProjectFolder[] }>(FOLDERS_QUERY);

const projects: IProject[] = projectsData?.projects ?? [];
const allTasks: ITask[] = tasksData?.tasks ?? [];
const folders: IProjectFolder[] = foldersData?.folders ?? [];
```

> **Risk note:** If `TASKS_QUERY` resolver requires `$projectId` and returns empty when omitted, fallback is to fetch tasks per project and merge arrays. Verify at runtime.

### Derived Data

```typescript
const activeTasks = allTasks.filter(t => !t.deletedAt);

const today = new Date();
const stats = {
  total: activeTasks.length,
  completed: activeTasks.filter(t => t.status === TaskStatus.Complete).length,
  active: activeTasks.filter(t => t.status === TaskStatus.Active).length,
  overdue: activeTasks.filter(t => t.dueDate && new Date(t.dueDate) < today && t.status !== TaskStatus.Complete).length,
};

// Priority task list: filtered by stat card click, or top-10 high-priority non-complete by dueDate
const priorityList = filterStatus
  ? activeTasks.filter(t => t.status === filterStatus).slice(0, 10)
  : activeTasks
      .filter(t => t.priority === TaskPriority.High && t.status !== TaskStatus.Complete)
      .sort((a, b) => new Date(a.dueDate ?? '9999').getTime() - new Date(b.dueDate ?? '9999').getTime())
      .slice(0, 10);

// Recharts status donut data
const statusChartData = [
  { name: 'Backlog', value: activeTasks.filter(t => t.status === TaskStatus.Backlog).length, fill: '#94a3b8' },
  { name: 'Active', value: activeTasks.filter(t => t.status === TaskStatus.Active).length, fill: '#3b82f6' },
  { name: 'Review', value: activeTasks.filter(t => t.status === TaskStatus.Review).length, fill: '#f59e0b' },
  { name: 'Complete', value: activeTasks.filter(t => t.status === TaskStatus.Complete).length, fill: '#22c55e' },
];

// Recharts priority bar data
const priorityChartData = [
  { name: 'High', value: activeTasks.filter(t => t.priority === TaskPriority.High).length },
  { name: 'Medium', value: activeTasks.filter(t => t.priority === TaskPriority.Medium).length },
  { name: 'Low', value: activeTasks.filter(t => t.priority === TaskPriority.Low).length },
];

// Folder progress grouping
const folderProgress = folders.map(folder => ({
  folder,
  projects: projects.filter(p => p.folderId === folder._id).map(project => {
    const projectTasks = activeTasks.filter(t => t.projectId === project._id);
    return {
      project,
      total: projectTasks.length,
      completed: projectTasks.filter(t => t.status === TaskStatus.Complete).length,
    };
  }),
}));
const noFolderProjects = projects.filter(p => !p.folderId).map(project => {
  const projectTasks = activeTasks.filter(t => t.projectId === project._id);
  return { project, total: projectTasks.length, completed: projectTasks.filter(t => t.status === TaskStatus.Complete).length };
});
```

### Section A — Stats Cards (4)

Shadcn `Card` × 4: Total Tasks / Completed / Active / Overdue.

- Each card is `onClick={() => setFilterStatus(prev => prev === status ? null : status)}`
- Active card (matching `filterStatus`) gets a ring highlight: `ring-2 ring-primary`
- "Total" card sets `filterStatus = null` (show all high-priority)

### Section B — Charts (two-column layout)

```tsx
// Left: Status donut
<ResponsiveContainer width="100%" height={220}>
  <PieChart>
    <Pie data={statusChartData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value">
      {statusChartData.map(entry => <Cell key={entry.name} fill={entry.fill} />)}
    </Pie>
    <Tooltip />
    <Legend />
  </PieChart>
</ResponsiveContainer>

// Right: Priority bar
<ResponsiveContainer width="100%" height={220}>
  <BarChart data={priorityChartData}>
    <XAxis dataKey="name" />
    <YAxis />
    <Tooltip />
    <Bar dataKey="value" fill="#6366f1" />
  </BarChart>
</ResponsiveContainer>
```

### Section C — Priority Task List

```tsx
<h2>{filterStatus ? `Filtered: ${filterStatus}` : 'High Priority'}</h2>
{priorityList.map(task => (
  <TaskCard key={task._id} task={task} onClick={() => setOpenTaskId(task._id)} />
))}
// TaskDialog driven by openTaskId state (same pattern as priority.tsx)
<TaskDialog
  open={!!openTaskId}
  onOpenChange={open => !open && setOpenTaskId(null)}
  mode="edit"
  taskId={openTaskId ?? ''}
  projectId={priorityList.find(t => t._id === openTaskId)?.projectId ?? ''}
  onSuccess={() => refetchTasks()}
/>
```

### Section D — Folder/Project Progress

**RBAC gates:**
- Folder create/edit/delete buttons: `isManagerOrAbove` (from `useAuth`)
- Project delete button: `isSuperadmin` (server guard is `requireSuperadmin`)
- Project create/edit: `isManagerOrAbove`

**Behavior:**
- Each folder header: name, color swatch, edit button, delete button (Manager+)
- Each project row: project name, `<Progress value={(completed/total)*100} />`, `completed/total` count label, edit/delete buttons
- "New Project" button per folder → `ProjectDialog` create mode with `folderId` preset
- "New Folder" button at top of section → opens inline folder `Dialog`
- "No Folder" section always rendered last for projects with `folderId` null

**Delete AlertDialog text:**
- Folder delete: "Deleting this folder will unlink all its projects (projects are not deleted). Continue?"
- Project delete: "Deleting this project will permanently delete all its tasks. This cannot be undone."

### Folder CRUD Dialog (inline, not a separate component)

Simple Shadcn `Dialog`:
- `Input` for name
- Color selector: 8 presets (same hex values as `ProjectDialog` color options)
- Submit calls `CREATE_FOLDER_MUTATION` or `UPDATE_FOLDER_MUTATION`
- On success: `refetchFolders()`

---

## Phase 3 — Modify `client/src/App.tsx`

1. Remove the inline placeholder:
   ```tsx
   // DELETE THIS:
   function DashboardPage() {
     return <div className="p-8"><h1 className="text-2xl font-bold">Dashboard</h1></div>;
   }
   ```

2. Add import (match the path convention used by existing pages):
   ```tsx
   import { DashboardPage } from '@client/pages/dashboard';
   ```

3. Route `/` element stays `<DashboardPage />` — no change needed there.

---

## Relevant Files

| File | Action |
|------|--------|
| `client/src/pages/dashboard.tsx` | CREATE |
| `client/src/App.tsx` | MODIFY — swap placeholder for import |
| `client/src/graphql/operations.ts` | MODIFY — add 4 mutations |
| `client/src/pages/priority.tsx` | READ-ONLY reference (query + TaskCard + TaskDialog pattern) |
| `client/src/components/project-dialog.tsx` | REUSE as-is |
| `client/src/components/task-card.tsx` | REUSE as-is |
| `client/src/components/ui/progress.tsx` | REUSE (Shadcn Progress) |
| `client/src/components/ui/card.tsx` | REUSE |
| `server/schemas/typeDefs.ts` | READ — confirm mutation signatures (lines 294–296, 301) |

---

## Scope Decisions

- **Tests (4.2T) NOT in scope here** — `dashboard.test.tsx` is a separate subtask
- **`TASKS_QUERY` with no `projectId`** — call with `{ includeArchived: false }` only; if resolver returns empty without `projectId`, fallback to per-project queries
- **Folder delete cascade** — deletes only unlink projects (no cascade); state this in AlertDialog warning
- **"No Folder" section** — always rendered last for projects where `folderId` is `null`/`undefined`
- **Color presets** — reuse the same 8 presets from `ProjectDialog`, no full color picker needed

---

## Verification

### Step 1 — TypeScript
```bash
npm run check
```
Expect: zero type errors.

### Step 2 — Dev server
```bash
npm run dev
```
Expect: Vite at `http://localhost:5173`, Express at `:3001`, no startup errors.

### Steps 3–10 — Playwright CLI Live Browser Checks

```bash
playwright-cli open http://localhost:5173
```

**3.** Login as any user → land on `/` → `playwright-cli snapshot`
- Confirm: full dashboard rendered (not the "Dashboard" placeholder `h1`)
- Confirm: `Stats`, `charts`, task list, folder sections all present

**4.** `playwright-cli snapshot`
- Confirm: 4 stat cards visible — Total / Completed / Active / Overdue
- Confirm: counts are non-zero (or zero is meaningful if no data)

**5.** Click "Completed" stat card → `playwright-cli snapshot`
- Confirm: task list header changes to "Filtered: complete"
- Click "Completed" again → `playwright-cli snapshot`
- Confirm: reverts to "High Priority" list

**6.** `playwright-cli screenshot`
- Visually confirm: donut chart (left) + bar chart (right) both rendered with data

**7.** Scroll to Folder/Project Progress section → `playwright-cli snapshot`
- Confirm: at least one folder section visible
- Confirm: progress bars present with percentage values

**8.** Click a task in the priority list → `playwright-cli snapshot`
- Confirm: TaskDialog opens with correct task title and status fields

**9.** (Manager+ session) `playwright-cli snapshot`
- Confirm: folder create/edit/delete buttons visible
- Logout → login as regular User role → `playwright-cli snapshot`
- Confirm: CRUD buttons absent for regular user

**10.** (Manager+ session) Click delete on a folder → `playwright-cli snapshot`
- Confirm: AlertDialog appears with warning text
- Click "Confirm" → `playwright-cli snapshot`
- Confirm: folder removed from list; its projects appear in "No Folder" section

---

## Commit Message

```
feat: add Dashboard with stats, charts, and folder management
```

---

## Notes — 4.1

_Use this section to record blockers, discoveries, or deviations from plan during implementation._

---

# Plan: Implement Task 4.2 — Roadmap (Gantt) Page

## TL;DR

Create `client/src/pages/roadmap.tsx` — custom CSS/absolute-position Gantt chart. No library. Uses `TASKS_QUERY` with `{ projectId, includeArchived: false }`. No new GraphQL operations needed. Replace inline `RoadmapPage` placeholder in `App.tsx`.

---

## Pre-requisite: Git Setup

Same branch as 4.1 (`feat/dashboard-roadmap`) — no new branch needed.

---

## Phase 1 — Create `client/src/pages/roadmap.tsx`

### State

```typescript
const { projectId } = useParams<{ projectId: string }>();
const [viewMode, setViewMode] = useState<'month' | 'quarter'>('month');
const [currentPeriodStart, setCurrentPeriodStart] = useState<Date>(() => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
});
const [openTaskId, setOpenTaskId] = useState<string | undefined>();
```

### Data Fetching (exact `priority.tsx` pattern)

```typescript
const { data, loading } = useQuery<{ tasks: ITask[] }>(TASKS_QUERY, {
  variables: { projectId, includeArchived: false },
  skip: !projectId,
});
const tasks = (data?.tasks ?? []).filter(t => !t.deletedAt && (t.startDate || t.dueDate));
```

### Period Constants

```typescript
const NUM_COLS       = viewMode === 'month' ? 6 : 4;
const COL_WIDTH      = viewMode === 'month' ? 160 : 240;    // px
const MONTHS_PER_COL = viewMode === 'month' ? 1 : 3;
const gridStart      = currentPeriodStart.getTime();
const gridEnd        = addMonths(currentPeriodStart, NUM_COLS * MONTHS_PER_COL).getTime();
const gridSpan       = gridEnd - gridStart;
const totalWidth     = NUM_COLS * COL_WIDTH;
const todayPx = Math.min(Math.max((Date.now() - gridStart) / gridSpan, 0), 1) * totalWidth;
```

### Date Utility (inline — use `date-fns` if available)

```typescript
function addMonths(date: Date, n: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}
```

### Column Labels

```typescript
function colLabel(i: number): string {
  const d = addMonths(currentPeriodStart, i * MONTHS_PER_COL);
  if (viewMode === 'month') return d.toLocaleString('default', { month: 'short', year: '2-digit' });
  return `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
}
```

### Bar Position Math

```typescript
function getBarStyle(task: ITask): React.CSSProperties | null {
  const s = task.startDate ? new Date(task.startDate).getTime() : null;
  const e = task.dueDate   ? new Date(task.dueDate).getTime()   : null;
  if (!s && !e) return null;
  const start = s ?? e!;
  const end   = e ?? s!;
  const left  = Math.max(start, gridStart);
  const right = Math.min(end, gridEnd);
  if (left > right && start !== end) return null;  // off-screen
  const leftPct  = (left - gridStart) / gridSpan * 100;
  const widthPct = Math.max((right - left) / gridSpan * 100, 0.5);  // min 0.5%
  return { left: `${leftPct}%`, width: `${widthPct}%` };
}
```

### Priority Color Map

```typescript
const BAR_COLOR: Record<string, string> = {
  high:   'bg-red-500 hover:bg-red-400',
  medium: 'bg-amber-500 hover:bg-amber-400',
  low:    'bg-blue-400 hover:bg-blue-300',
};
```

### JSX Layout

```tsx
<div className="flex flex-col h-full overflow-hidden">
  <NoPhiBanner />

  {/* Header: title + Month|Quarter toggle + navigation */}
  <div className="flex items-center gap-2 p-4 border-b shrink-0">
    <h1 className="text-xl font-semibold mr-4">Roadmap</h1>
    <button
      onClick={() => setViewMode('month')}
      className={cn('px-3 py-1 rounded text-sm', viewMode === 'month' ? 'bg-primary text-primary-foreground' : 'bg-muted')}
    >Month</button>
    <button
      onClick={() => setViewMode('quarter')}
      className={cn('px-3 py-1 rounded text-sm', viewMode === 'quarter' ? 'bg-primary text-primary-foreground' : 'bg-muted')}
    >Quarter</button>
    <button
      onClick={() => setCurrentPeriodStart(prev => addMonths(prev, -MONTHS_PER_COL))}
      className="px-3 py-1 rounded text-sm bg-muted"
    >← Prev</button>
    <button
      onClick={() => setCurrentPeriodStart(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}
      className="px-3 py-1 rounded text-sm bg-muted"
    >Today</button>
    <button
      onClick={() => setCurrentPeriodStart(prev => addMonths(prev, MONTHS_PER_COL))}
      className="px-3 py-1 rounded text-sm bg-muted"
    >Next →</button>
  </div>

  {/* Flex row: sticky task-name sidebar + scrollable grid */}
  <div className="flex flex-1 overflow-auto">

    {/* Sticky left: task titles */}
    <div className="sticky left-0 z-20 bg-background border-r shrink-0 w-48">
      <div className="h-10 border-b" />
      {tasks.map(task => (
        <div key={task._id} className="h-10 flex items-center px-2 text-sm truncate border-b">
          <span className={cn('w-2 h-2 rounded-full mr-2 shrink-0',
            task.priority === 'high'   ? 'bg-red-500'   :
            task.priority === 'medium' ? 'bg-amber-500' : 'bg-blue-400'
          )} />
          {task.title}
        </div>
      ))}
    </div>

    {/* Scrollable grid */}
    <div className="relative flex-1 overflow-x-auto">

      {/* Column headers row */}
      <div className="flex h-10 border-b sticky top-0 z-10 bg-background">
        {Array.from({ length: NUM_COLS }, (_, i) => (
          <div key={i} style={{ width: COL_WIDTH }} className="shrink-0 flex items-center justify-center text-xs text-muted-foreground border-r">
            {colLabel(i)}
          </div>
        ))}
      </div>

      {/* Task rows container */}
      <div className="relative" style={{ width: totalWidth }}>

        {/* Today line */}
        {todayPx >= 0 && todayPx <= totalWidth && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 pointer-events-none"
            style={{ left: todayPx }}
          />
        )}

        {/* Column grid lines */}
        {Array.from({ length: NUM_COLS }, (_, i) => (
          <div key={i} className="absolute top-0 bottom-0 border-r border-border/40"
            style={{ left: i * COL_WIDTH, width: COL_WIDTH }} />
        ))}

        {/* Task rows */}
        {tasks.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            No tasks with dates assigned
          </div>
        ) : (
          tasks.map(task => {
            const barStyle = getBarStyle(task);
            return (
              <div key={task._id} className="relative h-10 border-b flex items-center">
                {barStyle && (
                  <div
                    className={cn(
                      'absolute h-6 rounded text-xs text-white flex items-center px-1 cursor-pointer truncate',
                      BAR_COLOR[task.priority] ?? 'bg-slate-400'
                    )}
                    style={barStyle}
                    onClick={() => setOpenTaskId(task._id)}
                    title={`${task.title} | ${task.status} | ${task.startDate ?? '—'} → ${task.dueDate ?? '—'}`}
                  >
                    {task.title}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  </div>

  <TaskDialog
    open={!!openTaskId}
    onOpenChange={(open) => { if (!open) setOpenTaskId(undefined); }}
    mode="edit"
    taskId={openTaskId}
    projectId={projectId ?? ''}
  />
</div>
```

---

## Phase 2 — Modify `client/src/App.tsx`

1. **Remove** the inline placeholder:
   ```tsx
   // DELETE THIS:
   function RoadmapPage() {
     return <div className="p-8"><h1 className="text-2xl font-bold">Roadmap</h1></div>;
   }
   ```

2. **Add** import alongside other page imports:
   ```tsx
   import { RoadmapPage } from '@client/pages/roadmap';
   ```

3. Route stays unchanged:
   ```tsx
   <Route path="/project/:projectId/roadmap" element={<RoadmapPage />} />
   ```

---

## Relevant Files

| File | Action |
|------|--------|
| `client/src/pages/roadmap.tsx` | CREATE |
| `client/src/App.tsx` | MODIFY — remove placeholder, add import |
| `client/src/graphql/operations.ts` | READ-ONLY — `TASKS_QUERY` already has `startDate` + `dueDate` |
| `client/src/pages/priority.tsx` | READ-ONLY reference (query + `openTaskId` + `TaskDialog` pattern) |
| `client/src/components/task-dialog.tsx` | REUSE as-is |
| `client/src/components/no-phi-banner.tsx` | REUSE as-is |

---

## Scope Decisions

- **No Gantt library** — custom CSS absolute positioning only
- **`date-fns`**: use if present in `node_modules`; otherwise the inline `addMonths` utility above
- **Tooltips**: native HTML `title` attribute — no Radix import needed
- **Tasks without any date**: filtered out before render (`startDate || dueDate` required)
- **Single-date tasks** (only `dueDate`): 0.5% min-width bar pinned at that date
- **Off-screen bars**: skipped (`getBarStyle` returns `null`)
- **4.2T tests NOT in scope here** — separate subtask

---

## What to Expect After Completing 4.2

1. **Working Gantt timeline** — tasks with dates render as horizontal colored bars
2. **Priority colors** — red (`high`), amber (`medium`), blue (`low`)
3. **Today line** — vertical red line at current date position
4. **Month / Quarter toggle** — 6-month (160px cols) or 4-quarter (240px cols)
5. **Prev / Next / Today navigation** — shifts the visible period window
6. **Sticky task-name sidebar** — left column stays fixed while grid scrolls horizontally
7. **Click bar → TaskDialog** — opens edit mode for that task
8. **Single-day markers** — tasks with only `dueDate` show a narrow marker bar at that position
9. **App.tsx cleaned up** — inline placeholder removed, proper named import in place
10. **Branch ready for 4.2T and PR #7**

---

## Verification

### Step 1 — TypeScript
```bash
npm run check
```
Expect: zero type errors.

### Step 2 — Dev server
```bash
npm run dev
```
Expect: Vite at `http://localhost:5173`, Express at `:3001`, no startup errors.

### Steps 3–10 — Playwright CLI Live Browser Checks

```bash
playwright-cli open http://localhost:5173
```

**3.** Login → navigate to any project → click Roadmap in sidebar → `playwright-cli snapshot`
- Confirm: Roadmap page renders (not the old `<h1>Roadmap</h1>` placeholder)
- Confirm: header row with Month/Quarter buttons and ← Prev | Today | Next → visible

**4.** `playwright-cli snapshot`
- Confirm: sticky left sidebar shows task names with priority color dots
- Confirm: column headers show month/quarter labels

**5.** Click "Quarter" toggle → `playwright-cli snapshot`
- Confirm: 4 columns visible, labels show `Q1 2026` format, column width increases
- Click "Month" → `playwright-cli snapshot`
- Confirm: reverts to 6 months

**6.** Click "← Prev" twice → `playwright-cli snapshot`
- Confirm: column headers shift back 2 months
- Click "Today" → `playwright-cli snapshot`
- Confirm: returns to current period with today's month visible

**7.** `playwright-cli screenshot`
- Visually confirm: colored bars appear in the grid at correct positions
- Confirm: red vertical "today" line is visible

**8.** Click a task bar → `playwright-cli snapshot`
- Confirm: TaskDialog opens with correct task title and editable fields

**9.** Hover over a bar → check tooltip text
- Confirm: tooltip shows `title | status | startDate → dueDate`

**10.** Navigate to a project with no dated tasks → `playwright-cli snapshot`
- Confirm: "No tasks with dates assigned" empty state message renders

---

## Commit Message

```
feat: add Roadmap/Gantt view with timeline bars and period navigation
```

---

## Notes — 4.2

_Use this section to record blockers, discoveries, or deviations from plan during implementation._

---

# Plan: Implement Task 4.3 — PR: `feat/dashboard-roadmap` → `main`

## TL;DR

Pre-flight all checks on `feat/dashboard-roadmap` (TypeScript, lint, tests), then create a pull request from `feat/dashboard-roadmap` into `main` via `gh pr create`. This PR lands both the Dashboard (4.1) and Roadmap (4.2) pages.

> **Git context:** PR #43 already merged an earlier snapshot of `feat/dashboard-roadmap` (Dashboard only). Tasks 4.2 (Roadmap) and 4.2T (tests) must be committed to the branch before this PR is opened.

---

## Pre-requisites

- [ ] Task 4.1 (`dashboard.tsx`) committed on `feat/dashboard-roadmap`
- [ ] Task 4.2 (`roadmap.tsx`) committed on `feat/dashboard-roadmap`
- [ ] Task 4.2T (component tests) committed and passing
- [ ] `day4.md` untracked file — do **not** commit it to this branch

---

## Phase 1 — Sync Branch with `main`

```bash
git checkout feat/dashboard-roadmap
git pull origin main --rebase
```

Resolve any conflicts, then run:

```bash
git push origin feat/dashboard-roadmap --force-with-lease
```

> Use `--force-with-lease` (never `--force`) to protect against overwriting remote work.

---

## Phase 2 — Pre-flight Checks

Run all three in order. Fix any failures before opening the PR.

```bash
# 1. TypeScript — zero errors required
npm run check

# 2. Lint — zero errors required (warnings OK)
npm run lint

# 3. All Vitest tests — must pass
npm run test
```

Expected output for `npm run test`:
- Server suite: all resolver + util tests pass
- Client suite: `dashboard.test.tsx` and `roadmap.test.tsx` pass
- Zero failing tests, zero console errors from test runner

---

## Phase 3 — Create the Pull Request

```bash
gh pr create \
  --title "feat: Dashboard and Roadmap views (Day 4, Tasks 4.1–4.2T)" \
  --body "$(cat <<'EOF'
## Summary

Implements the Dashboard and Roadmap pages as specified in PLAN.md Day 4 (Tasks 4.1–4.2T).

## Changes

### Dashboard (`client/src/pages/dashboard.tsx`)
- Stats cards: Total / Completed / Active / Overdue — click to filter task list
- Status donut chart + Priority bar chart (Recharts)
- High-priority task list with TaskDialog on click
- Folder/project progress with RBAC-gated CRUD (Manager+)
- New GraphQL client mutations: `CREATE_FOLDER`, `UPDATE_FOLDER`, `DELETE_FOLDER`, `DELETE_PROJECT`

### Roadmap (`client/src/pages/roadmap.tsx`)
- Custom CSS Gantt chart — no external library
- Month (6-col) and Quarter (4-col) view modes
- ← Prev / Today / Next → period navigation
- Bars colored by priority (red/amber/blue); today line in red
- Sticky task-name sidebar; click bar to open TaskDialog

### App.tsx
- Removed inline `DashboardPage` and `RoadmapPage` placeholder functions
- Replaced with named imports from `@client/pages/dashboard` and `@client/pages/roadmap`

### Tests (`client/src/__tests__/pages/`)
- `dashboard.test.tsx` — stats derivation, stat card filter toggle, RBAC visibility
- `roadmap.test.tsx` — bar position math, empty state, view mode toggle

## Test Results

```
npm run test — all suites pass
npm run check — zero TypeScript errors
npm run lint — zero lint errors
```

## Screenshots

_Attach screenshots of Dashboard and Roadmap views here before requesting review._

## Checklist

- [ ] No-PHI banner present on both pages
- [ ] TypeScript passes (`npm run check`)
- [ ] All tests pass (`npm run test`)
- [ ] No `console.log` statements left in production code
- [ ] RBAC verified: Manager+ sees CRUD buttons; User role does not
EOF
)" \
  --base main \
  --head feat/dashboard-roadmap \
  --assignee louverture-t
```

---

## Phase 4 — Post-PR Checks

After the PR is open:

1. **Confirm CI passes** — GitHub Actions workflow runs `npm run test` and `npm run check`; both must be green
2. **Self-review diff** — read every changed file in the GitHub PR diff view; confirm no debug code, no secrets, no `console.log`
3. **Address review feedback** — push fixes as new commits (do not amend + force-push on an open PR unless explicitly needed)
4. **Merge strategy** — use **Squash and merge** on GitHub to keep `main` history clean
5. **Delete branch after merge** — GitHub will prompt; click "Delete branch"

---

## What to Expect After Completing 4.3

1. **PR open on GitHub** — title, description, and checklist all filled in
2. **CI green** — GitHub Actions passes TypeScript check + Vitest suite
3. **Dashboard and Roadmap visible on `main`** after merge
4. **`feat/dashboard-roadmap` branch deleted** from remote
5. **Local cleanup** — `git checkout main && git pull` brings `main` up to date
6. **Ready for Day 4 second branch** — start `feat/ai-search-notifications` (Tasks 4.4–4.8)

---

## Post-Merge Local Cleanup

```bash
git checkout main
git pull origin main
git branch -d feat/dashboard-roadmap
```

---

## Commit Message (for any last-minute fixes on the branch)

```
chore: pre-PR cleanup and test fixes
```

---

## Notes — 4.3

_Use this section to record blockers, discoveries, or deviations from plan during implementation._

