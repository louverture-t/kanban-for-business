# CLAUDE.md — Optimized Progressive Disclosure Structure

This structure prevents bloat in your main `CLAUDE.md` by using Claude Code's native `.claude/` directory system. Instead of one massive file, you will have a clean root file that points to specialized subdirectories.

## Root Level: `.claude/CLAUDE.md`

This file is loaded on every session start. Keep it under 100 lines. It should contain only the most critical, universal rules that apply to every file in the project.

```markdown
# Kanban for Business (K4B)

**Project:** MERN + GraphQL Kanban app for Atlas Infectious Disease Practice (AIDP).
**Stack:** React 18, Vite, Tailwind, Apollo Client/Server, Express, MongoDB Atlas.
**Core Rule:** NO-PHI Policy. Never generate or use patient health information in tests, mocks, or code.

## Global Conventions
- **TypeScript:** Strict mode enabled. Use path aliases (`@client/*`, `@server/*`, `@shared/*`).
- **Testing:** Vitest for unit/integration (server=node, client=jsdom). Playwright for E2E.
- **Git:** Feature branches (`feat/<scope>`). Conventional Commits.

## Architecture Highlights
- Single GraphQL endpoint (`/graphql`).
- JWT auth: 15m access token (memory), 2h refresh token (HttpOnly cookie).
- 3-tier RBAC: Superadmin, Manager, User.

> **Note to Claude:** Detailed instructions for specific domains (testing, UI, database) are located in the `.claude/rules/` directory. Load them when working on those areas.
```

---

## Directory Structure

Run this command to create the necessary directories:
```bash
mkdir -p .claude/{rules,hooks,skills,agents,mcp}
```

### 1. Rules (`.claude/rules/`)
*These files are automatically loaded by Claude Code when you work on related files.*

- **`.claude/rules/ui-components.md`**
  - **Scope:** `client/src/components/**/*.tsx`
  - **Content:** Instructions to use Shadcn UI primitives, Tailwind utility classes, Framer Motion for animations, and the requirement for the No-PHI banner.

- **`.claude/rules/graphql-resolvers.md`**
  - **Scope:** `server/schemas/resolvers/**/*.ts`
  - **Content:** Enforce RBAC guards (`requireAuth`, `requireManagerOrAbove`, `requireSuperadmin`). Ensure Mongoose is used for DB operations and errors throw custom GraphQL error classes.

- **`.claude/rules/testing-standards.md`**
  - **Scope:** `**/__tests__/**/*.ts`, `e2e/**/*.ts`
  - **Content:** Instructions to use `mongodb-memory-server` for backend tests, `@testing-library/react` for frontend, and Playwright for E2E.

### 2. Hooks (`.claude/hooks/`)
*Scripts that run automatically during Claude Code's lifecycle.*

- **`.claude/hooks/post-edit-format.sh`**
  - **Event:** `PostToolUse` (Matcher: `Edit|Write`)
  - **Action:** Runs `npx prettier --write <file>` and `npx eslint --fix <file>` on every file Claude edits to ensure CI passes.

- **`.claude/hooks/pre-commit-test.sh`**
  - **Event:** `PreToolUse` (Matcher: `Bash(git commit *)`)
  - **Action:** Runs `npm run check` and `npm run test` before allowing Claude to commit.

- **`.claude/hooks/session-start-context.sh`**
  - **Event:** `SessionStart` (Matcher: `compact`)
  - **Action:** Re-injects the current sprint goal or active branch name after Claude compacts its memory.

### 3. Skills (`.claude/skills/`)
*Reusable prompts and workflows invoked with `/skill_name`.*

- **`.claude/skills/generate-mongoose-schema/SKILL.md`**
  - **Content:** Step-by-step instructions for Claude to design a MongoDB schema following best practices (indexing, validation, references).

- **`.claude/skills/scaffold-resolver/SKILL.md`**
  - **Content:** Boilerplate and instructions for creating a new GraphQL resolver with corresponding integration tests.

- **`.claude/skills/parallel-worktree/SKILL.md`**
  - **Content:** The SpillwaveSolutions skill for managing parallel git worktrees.

### 4. Agents (`.claude/agents/`)
*Specialized subagents for specific domains.*

- **`.claude/agents/test-automator.md`**
  - **Role:** Writes Vitest and Playwright tests. Has deep knowledge of `@testing-library` and `mongodb-memory-server`.

- **`.claude/agents/graphql-architect.md`**
  - **Role:** Designs the Apollo Server schema and ensures RBAC guards are correctly applied to all mutations.

- **`.claude/agents/deployment-engineer.md`**
  - **Role:** Manages the `render.yaml` configuration and GitHub Actions CI/CD pipelines.

### 5. MCP (`.claude/mcp/`)
*Configuration for Model Context Protocol servers.*

- **`.claude/.mcp.json`** (Root of `.claude/`)
  - **Content:** The JSON configuration linking Claude to your MCP servers.

```json
{
  "mcpServers": {
    "GitHub": {
      "command": "npx",
      "args": ["-y", "@github/github-mcp-server"]
    },
    "Playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp-server"]
    },
    "MongoDB": {
      "command": "npx",
      "args": ["-y", "mongodb-mcp-server@latest", "--readOnly"],
      "env": {
        "MDB_MCP_CONNECTION_STRING": "mongodb+srv://..."
      }
    },
    "Render": {
      "command": "npx",
      "args": ["-y", "@render/mcp-server"],
      "env": {
        "RENDER_API_KEY": "..."
      }
    }
  }
}
```

---

## ⚙️ `settings.json` Configuration

Create `.claude/settings.json` to wire up your hooks and permissions:

```json
{
  "permissions": {
    "allow": [
      "Bash(npm run *)",
      "Bash(git status)",
      "Bash(git diff *)"
    ]
  },
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "jq -r '.tool_input.file_path' | xargs npx prettier --write"
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Bash(git commit *)",
        "hooks": [
          {
            "type": "command",
            "command": "npm run check && npm run test"
          }
        ]
      }
    ]
  }
}
```

## 🔄 `.worktreeinclude`

Create a `.worktreeinclude` file in your project root to ensure parallel agents have access to necessary ignored files:

```text
.env
.claude/settings.local.json
```
