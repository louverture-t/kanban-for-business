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
