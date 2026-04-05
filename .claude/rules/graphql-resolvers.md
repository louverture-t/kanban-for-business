---
description: GraphQL resolver patterns — RBAC guards, error handling, Mongoose operations
globs:
  - "server/schemas/resolvers/**/*.ts"
  - "server/schemas/typeDefs.ts"
  - "server/schemas/index.ts"
---

# GraphQL Resolver Standards

## RBAC Guards

Every mutation and sensitive query MUST use the appropriate guard:
- `requireAuth` — any authenticated user
- `requireManagerOrAbove` — Manager or Superadmin
- `requireSuperadmin` — Superadmin only
- `requireProjectAccess` — checks project membership (Superadmin bypasses)

Guards are imported from `server/utils/auth.ts`. Apply them at the top of each resolver before any business logic.

## Error Handling

- Throw custom GraphQL error classes from `server/utils/errors.ts`.
- Never expose raw Mongoose/MongoDB errors to the client.
- Use descriptive error messages that help the frontend display meaningful feedback.
- Validate inputs using utilities from `server/utils/validators.ts` before DB operations.

## Database Operations

- Use **Mongoose v8** for all database interactions.
- Always use `ObjectId` refs (not string IDs) for relationships.
- Leverage Mongoose's built-in validation and `timestamps: true` on all models.
- For complex queries, use aggregation pipelines over multiple sequential queries.

## Resolver Organization

- Resolvers are split by domain: auth, project, task, etc.
- Each file exports its Query and Mutation resolvers separately.
- Keep resolvers thin — extract business logic into service functions if a resolver exceeds ~30 lines.

## AI Operations

- AI-powered features (task suggestions, etc.) are server-side only.
- OpenRouter API key is never exposed in resolver responses.
- Rate limit: 10 AI operations per hour per user.
- Always preview AI-generated content before writing to the database.
