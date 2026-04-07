# Task 4.4 — AI Decompose Dialog

## What you'll see when 4.4 is done

The AI Decompose dialog will be a 2-step wizard, Manager+ only (button hidden for regular users):

**Step 1 — Input**
- A textarea to paste/type work description
- An "Upload File" button (hidden file input) — select `.txt`, `.md`, `.docx`, or `.pdf` up to 5 MB → it POSTs to `/api/upload`, extracts text, auto-fills the textarea
- "Analyze" button calls the `aiDecompose` mutation → advances to Step 2

**Step 2 — Preview**
- Each proposed task is now a **fully editable card** (not read-only):
  - Editable title (`Input`)
  - Editable description (`Textarea`)
  - Priority dropdown (`Select`: high / medium / low)
  - Due date (`Input type="date"`)
  - Assignee dropdown (`Select` populated from `PROJECT_MEMBERS_QUERY`)
- An **"Add Task"** button at the bottom appends a blank task
- Each card has an **×** remove button
- "Confirm" creates all tasks via `aiConfirmDecomposition` → toast → closes → refetches board
- "Back" returns to Step 1

---

## Plan: Task 4.4 — AI Decompose Dialog

**The existing component is partially done** — the skeleton, mutations, and Manager+ gate all work. Only two things are missing: the **file upload** in Step 1, and **editable fields + add-task** in Step 2.

---

### Phase 1 — Extend `ai-decompose-dialog.tsx` (all in one file, no backend changes needed)

**Step 1 — File upload**
- Add a hidden `<input type="file" accept=".txt,.md,.docx,.pdf" ref={fileInputRef}>` + styled "Upload File" button
- `handleFileUpload` POSTs `FormData` to `/api/upload`, receives `{ text }`, calls `setText(data.text)`
- Show spinner while uploading; disable Analyze + textarea during upload
- Toast on error

**Step 2 — Editable preview cards**
- Add `updatePreview(index, field, value)` that immutably patches `previews[index]`
- Replace each read-only card with live-editing fields:
  - `Input` for title
  - `Textarea` for description (2-row compact, always visible)
  - `Select` for priority: high / medium / low
  - `Input type="date"` for dueDate
  - `Select` for assignee

**Step 3 — Add Task button**
- A `<Plus>` button at list bottom appends `{ title: '' }` to previews
- Confirm button stays disabled if any title is empty

**Step 4 — Assignee data**
- Import `PROJECT_MEMBERS_QUERY`
- Add `useQuery` skipped until `step === 'preview'`
- Map members to `<SelectItem>` in each card's assignee dropdown

**Step 5 — Validation**
- Disable Confirm when any preview has an empty title
- Highlight empty title fields with red border

---

### Phase 2 — Verify & Ship

**Step 6 — TypeScript check**
- Run `npm run check` → zero TS errors

**Step 7 — Playwright E2E**
- Manager full flow: paste text → Analyze → edit fields → file upload → add/remove tasks → Confirm → toast → board refetches
- Regular user: AI Decompose button is not visible

**Step 8 — Sub-agent audit**
- Explore agent reviews all implementation steps against the task 4.4 spec checklist

**Step 9 — Branch, commit, PR, push**
- `git checkout -b feat/ai-search-notifications`
- Commit: `feat: add AI task decomposition dialog with file upload and preview`
- Open PR, push to main

---

## Relevant Files

| File | Role |
|---|---|
| `client/src/components/ai-decompose-dialog.tsx` | **Primary file to modify** — add file upload (Step 1) + editable fields + add-task (Step 2) |
| `client/src/graphql/operations.ts` | `PROJECT_MEMBERS_QUERY`, `AI_DECOMPOSE_MUTATION`, `AI_CONFIRM_DECOMPOSITION_MUTATION` already exist — no changes needed |
| `client/src/pages/kanban.tsx` | Manager+ gate already wired — no changes needed |
| `server/index.ts` | `/api/upload` already implemented (multer, 5 MB, .txt/.md/.docx/.pdf) — no changes needed |
| `server/resolvers/aiResolvers.ts` | `aiDecompose`, `aiConfirmDecomposition` fully implemented — no changes needed |

---

## Design Decisions

- **Date picker** → native `<Input type="date">` — no Shadcn Calendar component installed
- **Assignee query** → skipped until `step === 'preview'` to avoid unnecessary network call on dialog open
- **Description visibility** → always visible (not collapsible) — simpler, matches spec
- **Add Task** → appends `{ title: '' }`; Confirm disabled until all titles non-empty

---

# Task 4.5 — AI Subtask Generation

## What you'll see when 4.5 is done

The Subtasks tab inside the task dialog (Manager+ only) gets a full preview/edit/accept-reject flow before any subtasks are written to the database:

1. Click **"AI Generate"** → spinner appears on the button
2. AI suggestions pop in as a **preview list** labeled "AI Suggestions" (above the existing subtask list)
3. Each suggestion shows:
   - A **checkbox** (checked = accepted, unchecked = rejected) — all start checked
   - An **editable `<Input>`** pre-filled with the suggested title
4. Edit any title inline; uncheck any you don't want
5. **"Add Selected (N)"** button shows count of accepted items — disabled if zero are checked
6. **"Cancel"** clears the preview without creating anything
7. Clicking "Add Selected" calls `createSubtask` for each accepted item using the edited title, then clears the preview and refreshes the subtask list with a toast: `"Added N subtask(s)"`

---

## Plan: Task 4.5 — AI Subtask Generation Preview Flow

### Current State Audit

| Requirement | Status |
|---|---|
| "Generate with AI" button (Manager+ only) | ✅ Exists |
| Calls `aiGenerateSubtasks(taskId)` mutation | ✅ Exists |
| Loading state during generation | ✅ `aiGenerating` / Loader2 spinner |
| Preview list of suggested titles | ❌ Missing — creates directly |
| Each title editable + accept/reject toggle | ❌ Missing |
| "Add Selected" button → `createSubtask` per accepted | ❌ Missing |

**TL;DR:** Backend resolver, schema, client GraphQL operation, Manager+ button, and loading spinner are all already built. The only gap is the preview/edit/accept-reject UX — `handleAiGenerate` currently auto-creates all suggestions immediately without showing them to the user first.

---

### Phase 1 — `task-dialog.tsx` (all changes in one file)

**Step 1 — Add 3 preview state variables** (near `newSubtaskTitle` state):
- `aiPreviews: string[]` — raw suggestions from the mutation
- `aiPreviewAccepted: boolean[]` — one per suggestion, all default `true`
- `aiPreviewEdits: string[]` — editable title copy for each suggestion

**Step 2 — Refactor `handleAiGenerate`:**
- Remove the `for` loop that calls `createSubtask` immediately
- Set the three state arrays above with the returned `string[]`
- Keep the error toast; remove the success toast (moves to `handleAddSelected`)

**Step 3 — Add `handleAddSelected` callback:**
- Filter indices where `aiPreviewAccepted[i] === true`
- Call `createSubtask` for each, using `aiPreviewEdits[i]` as title
- Clear all three preview state arrays
- `refetchSubtasks()` + toast: `"Added N subtask(s)"`

**Step 4 — Add `handleCancelPreview` callback** — clears all three preview state arrays

**Step 5 — Add preview UI block in `subtasksTab`** (between AI button row and existing subtask list, rendered only when `aiPreviews.length > 0`):
- Section header: `"AI Suggestions"` with muted label styling
- Scrollable list (`max-h-48 overflow-y-auto`), each item:
  - `<input type="checkbox">` (checked = `aiPreviewAccepted[i]`, toggles index)
  - `<Input>` value bound to `aiPreviewEdits[i]`, `onChange` updates that index
- Footer row: `"Add Selected (N)"` primary button (N = accepted count, disabled if 0) + `"Cancel"` ghost button

---

### Phase 2 — Playwright E2E

**Step 6 — Create `playwright.config.ts`** (no existing file):
- `baseURL: 'http://localhost:5173'`
- `testDir: './e2e'`
- Headless defaults

**Step 7 — Create `e2e/ai-subtask-generation.spec.ts`**:
- `beforeAll`: log in as Manager via UI
- Navigate to a project's Kanban board, open an existing task dialog
- Assert "AI Generate" button is visible
- Click → assert spinner → await preview section labeled "AI Suggestions"
- Assert at least one preview item (checkbox + Input)
- Edit one title; uncheck one item (reject)
- Click "Add Selected (N)"
- Assert preview section gone; subtask list shows the accepted (edited) title; rejected title absent

---

### Phase 3 — Git

**Step 8 — Branch:** `feat/ai-search-notifications`

**Step 9 — Commit:** `feat: add AI subtask generation to task dialog`

**Step 10 — Push + PR** to `main` on `louverture-t/kanban-for-business`

---

### Phase 4 — Verification (5 audit subagents)

**Step 11 — Launch 5 parallel subagents**, each checking one requirement:
1. Button visibility + Manager-only guard
2. Mutation call + loading state
3. Preview rendering with editable inputs
4. Accept/reject toggle behavior
5. "Add Selected" creates correct subtasks + preview clears afterward

---

## Relevant Files

| File | Role |
|---|---|
| `client/src/components/task-dialog.tsx` | **Primary file** — state additions, `handleAiGenerate` refactor, preview UI |
| `client/src/graphql/operations.ts` | `AI_GENERATE_SUBTASKS_MUTATION` already exists — no changes needed |
| `server/resolvers/aiResolvers.ts` | `aiGenerateSubtasks` fully implemented — no changes needed |
| `server/schemas/typeDefs.ts` | Schema already defined — no changes needed |
| `playwright.config.ts` | CREATE at repo root |
| `e2e/ai-subtask-generation.spec.ts` | CREATE — full flow test |

---

## Design Decisions

- **Preview state** → 3 parallel arrays (previews, accepted flags, editable titles) instead of an array of objects — aligns with the existing flat-state pattern in the component
- **All default accepted** → checkbox starts checked; user opts out rather than opts in — matches the ai-decompose-dialog UX where all previews start visible
- **No new mutation** → "Add Selected" reuses the existing `createSubtask` loop — no backend changes required
- **Preview replaces auto-create** → the current sequential `createSubtask` loop in `handleAiGenerate` is removed entirely; DB writes only happen after user confirms
- **Backend** → untouched — all server functionality already complete
