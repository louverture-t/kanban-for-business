---
description: Testing conventions for K4B — Vitest, React Testing Library, mongodb-memory-server, Playwright
globs:
  - "**/__tests__/**/*.ts"
  - "**/__tests__/**/*.tsx"
  - "e2e/**/*.ts"
  - "vitest.config.*"
---

# Testing Standards

## Environment Split

Vitest config defines two test projects:
- **`server`** — Node environment. Tests live in `server/__tests__/`.
- **`client`** — jsdom environment. Tests live in `client/src/__tests__/`.

## Server Tests

- Use `mongodb-memory-server` for all database tests.
- Connect in `beforeAll`, disconnect/cleanup in `afterAll`.
- Import models and test against real Mongoose operations — no mocking the DB layer.
- Test resolver logic through direct function calls with mocked context (user, auth).
- Validate RBAC: test that unauthorized roles receive appropriate GraphQL errors.

## Client Tests

- Use `@testing-library/react` with `@testing-library/jest-dom` matchers.
- Wrap components needing Apollo in `MockedProvider` with typed mock responses.
- Test user interactions (clicks, form submissions) over implementation details.
- Use `jsdom` environment — set via Vitest project config, not per-file comments.

## E2E Tests (Playwright)

- Tests live in `e2e/` directory.
- Test critical user flows: login, project CRUD, task drag-and-drop, role-based access.
- Use page object pattern for reusable selectors.

## Conventions

- Co-located `__tests__/` directories alongside source code.
- File naming: `<module>.test.ts` or `<Component>.test.tsx`.
- Each PR must include tests for new functionality.
- Run `npm run test` before committing to catch regressions.
