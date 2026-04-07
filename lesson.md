# K4B Bug Lessons

A running log of major bugs encountered during development, their root causes, and the fixes applied.

---

## Bug #1 — "Create Project" dialog closes but no project is created

**Date:** April 6, 2026  
**Symptom:** Clicking "Create Project" / "Save Project" causes the dialog to disappear, but no project appears in the sidebar. No error toast is shown.

### Root Cause

Mongoose v8 enforces strict **single-execution** on `Query` objects. Returning a raw Mongoose Query from a GraphQL field resolver causes the error:

```
MongooseError: Query was already executed: ProjectMember.countDocuments(...)
```

GraphQL's execution engine calls `.then()` on the returned value to resolve it as a Promise. If the same Query object is awaited more than once (which can happen internally), Mongoose v8 throws.

The `memberCount` field resolver on the `Project` type was returning a raw Mongoose Query:

```ts
// BROKEN — returns a Mongoose Query object, not a Promise
memberCount: (parent: { _id: string }) => {
  return ProjectMember.countDocuments({ projectId: parent._id });
},
```

Because `memberCount: Int!` is **non-nullable** in the GraphQL schema, the field error propagated up and nullified the entire `createProject` response (`"data": null`). Apollo Client received this, closed the dialog (the mutation technically "completed"), but no project ID came back so nothing rendered in the sidebar. The `onError` handler didn't fire because the error was a GraphQL field error, not a network error.

### Fix

Call `.exec()` on all Mongoose Query returns inside field resolvers to immediately convert the lazy Query into a plain Promise that GraphQL can safely `await` once.

**Files changed:** `server/resolvers/projectResolvers.ts`, `server/resolvers/commentResolvers.ts`

---

## Bug #2 — "Create Task" form freezes / task is never created

**Date:** April 6, 2026  
**Symptom:** On the Kanban page, clicking "Save" or pressing Enter to create a task causes the form to freeze. No task appears. No error toast.

### Root Cause

Same Mongoose v8 single-execution issue as Bug #1, but spread across **all** resolver files. Every resolver that returned a bare Mongoose Query (`.find()`, `.findById()`, `.findOne()`, `.countDocuments()`, `.findByIdAndUpdate()`) without calling `.exec()` was a latent bomb. The `Task` field resolvers were the immediate trigger — when `createTask` returned the new task, GraphQL attempted to resolve its fields (`project`, `assignee`, `createdByUser`, `subtasks`, `comments`, `tags`) and each of those returned bare Queries. One or more non-nullable fields threw, nullifying the entire mutation response.

### Fix

Added `.exec()` to **every** bare Mongoose Query return across all resolver files:

**Files changed:**
- `server/resolvers/taskResolvers.ts` — `Task` field resolvers (`project`, `assignee`, `createdByUser`, `subtasks`, `comments`, `tags`), `tasks`, `searchTasks`, `trashedTasks` queries, `restoreTask`, `unarchiveTask` mutations
- `server/resolvers/subtaskResolvers.ts` — `subtasks` query
- `server/resolvers/tagResolvers.ts` — `tags`, `taskTags` queries
- `server/resolvers/commentResolvers.ts` — `comments`, `auditLogs` queries
- `server/resolvers/notificationResolvers.ts` — `notifications` query
- `server/resolvers/folderResolvers.ts` — `folders` query
- `server/resolvers/projectResolvers.ts` — `projects`, `projectMembers` queries
- `server/resolvers/adminResolvers.ts` — `adminUsers`, `adminInvitations` queries
- `server/resolvers/authResolvers.ts` — `me` query

### Rule Going Forward

**In Mongoose v8+, every resolver that returns the result of a Mongoose query method must call `.exec()`.** This applies to top-level Query resolvers, Mutation resolvers, and especially field resolvers. The safest rule: if you write `return Model.find(...)` or `return Model.findById(...)` anywhere in a resolver, append `.exec()`.

```ts
// FIXED — .exec() returns a Promise, not a reusable Query
memberCount: (parent: { _id: string }) => {
  return ProjectMember.countDocuments({ projectId: parent._id }).exec();
},

folder: (parent: { folderId?: string }) => {
  if (!parent.folderId) return null;
  return ProjectFolder.findById(parent.folderId).exec();
},

createdByUser: (parent: { createdBy?: string }) => {
  if (!parent.createdBy) return null;
  return User.findById(parent.createdBy).exec();
},

// commentResolvers.ts
author: async (parent: { authorId: string }) => {
  return User.findById(parent.authorId).exec();
},
```

### Rule

> In Mongoose v8+, **always call `.exec()`** when returning a Mongoose Query from a GraphQL field resolver. This applies to `.find()`, `.findById()`, `.findOne()`, `.countDocuments()`, etc. Resolvers that operate inside `async` functions and use `await` are safe; bare `return Model.find(...)` without `.exec()` is not.

---
