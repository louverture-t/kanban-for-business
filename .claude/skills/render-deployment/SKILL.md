---
name: render-deploy
description: >
  Deploy MERN + GraphQL + TypeScript applications to Render with MongoDB Atlas integration.
  Generates render.yaml Blueprints, configures Express/Apollo Server V4 web services and
  React/Vite static sites, handles per-user API key onboarding and workspace selection,
  and provides Dashboard deeplinks. Use whenever the user wants to deploy, host, publish,
  ship, or set up their application on Render — even if they don't say "Render" explicitly
  but mention deploying a Node/Express/Apollo/React/MERN app to the cloud. Also triggers
  for render.yaml generation, Render database setup, Render environment variable configuration,
  MongoDB Atlas connection from Render, or CI/CD pipeline setup with GitHub Actions targeting Render.
---

# Deploy to Render

This skill deploys **MERN + GraphQL + TypeScript** full-stack applications to Render's cloud platform. It's optimized for this stack but works with other Node.js configurations too:

- **Frontend:** React 18, Vite, Tailwind CSS, Shadcn UI, Apollo Client v3
- **Backend:** Express 4, Apollo Server v4 (`expressMiddleware`), Mongoose v8, JWT auth
- **Database:** MongoDB Atlas (external, M0 free tier supported)
- **AI/APIs:** OpenRouter or similar external API keys
- **CI/CD:** GitHub Actions

Render supports **Git-backed** services and **prebuilt Docker image** services. This skill covers **Git-backed** flows:

1. **Blueprint Method** — Generate `render.yaml` for Infrastructure-as-Code deployments
2. **Direct Creation** — Create services instantly via MCP tools

## Per-User Onboarding

Every user needs their own Render credentials. Before any deployment operation, run through this checklist:

### 1. Render API Key

Ask the user for their Render API key. Direct them to:
```
https://dashboard.render.com/u/*/settings#api-keys
```

### 2. Configure MCP (Preferred) or CLI

Detect which AI tool the user is in and provide matching MCP setup:

**Claude Code:**
```bash
claude mcp add --transport http render https://mcp.render.com/mcp \
  --header "Authorization: Bearer <API_KEY>"
```

**Cursor** — add to `~/.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "render": {
      "url": "https://mcp.render.com/mcp",
      "headers": { "Authorization": "Bearer <API_KEY>" }
    }
  }
}
```

**Codex:**
```bash
export RENDER_API_KEY="<API_KEY>"
codex mcp add render --url https://mcp.render.com/mcp --bearer-token-env-var RENDER_API_KEY
```

**CLI fallback** (if MCP unavailable):
```bash
# macOS
brew install render
# Linux/macOS
curl -fsSL https://raw.githubusercontent.com/render-oss/cli/main/bin/install.sh | sh
# Then authenticate
export RENDER_API_KEY="rnd_xxxxx"
# or
render login
```

### 3. Workspace Selection

After MCP/CLI is configured, set the active workspace:
```
get_selected_workspace()     # MCP
render workspace current -o json  # CLI
```

If multiple workspaces exist, have the user select one before proceeding.

## Deployment Decision Tree

### Step 1: Determine Source Path

```bash
git remote -v
```

If no remote → stop and guide the user to create a GitHub/GitLab/Bitbucket repo and push.

### Step 2: Choose Method

**Use Direct Creation (MCP) when ALL are true:**
- Single service (just the API, or just a static site)
- No separate worker/cron services
- Simple env vars only

**Use Blueprint when ANY are true:**
- Multiple services (React frontend + Apollo API)
- Background workers or cron jobs needed
- You want reproducible IaC committed to the repo
- Monorepo setup

Default to **Blueprint** when in doubt — it covers everything and is version-controlled.

## Architecture Patterns

This stack typically deploys as **two services**:

| Service | Type | Runtime | What It Serves |
|---------|------|---------|----------------|
| `api` | `web` | `node` | Express + Apollo Server v4 GraphQL endpoint |
| `client` | `static` | — | React + Vite built assets via Render CDN |

**Monorepo layout** (common):
```
project/
├── server/          # Express + Apollo + Mongoose
│   ├── src/
│   ├── package.json
│   └── tsconfig.json
├── client/          # React + Vite + Apollo Client
│   ├── src/
│   ├── package.json
│   └── vite.config.ts
├── package.json     # Root (workspaces)
└── render.yaml
```

**Multi-repo layout**: Each repo gets its own `render.yaml` or uses Direct Creation.

---

# Method 1: Blueprint Deployment

## Step 1: Analyze Codebase

Use [references/codebase-analysis.md](references/codebase-analysis.md) to detect:
- Framework (React/Vite, Express, Apollo Server version)
- Build and start commands
- Required environment variables (MongoDB URI, JWT secrets, OpenRouter key)
- Port binding configuration
- Monorepo vs single-repo structure

## Step 2: Generate render.yaml

Full specification: [references/blueprint-spec.md](references/blueprint-spec.md)

**Typical MERN + GraphQL Blueprint:**

```yaml
services:
  # Apollo Server V4 + Express API
  - type: web
    name: my-app-api
    runtime: node
    plan: free
    rootDir: ./server
    buildCommand: npm ci && npm run build
    startCommand: node dist/index.js
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: "4000"
      - key: MONGODB_URI
        sync: false  # User provides Atlas connection string
      - key: JWT_SECRET
        generateValue: true
      - key: OPENROUTER_API_KEY
        sync: false
      - key: CLIENT_URL
        fromService:
          type: static
          name: my-app-client
          property: url

  # React + Vite Static Site
  - type: static
    name: my-app-client
    rootDir: ./client
    buildCommand: npm ci && npm run build
    staticPublishPath: ./dist
    pullRequestPreviewsEnabled: true
    headers:
      - path: /*
        name: X-Frame-Options
        value: SAMEORIGIN
    routes:
      - type: rewrite
        source: /*
        destination: /index.html
    envVars:
      - key: VITE_API_URL
        fromService:
          type: web
          name: my-app-api
          property: url
```

**Key points:**
- `plan: free` unless user specifies otherwise
- `MONGODB_URI` uses `sync: false` because MongoDB Atlas is external — the user pastes their Atlas connection string in the Render Dashboard
- `JWT_SECRET` uses `generateValue: true` for auto-generation
- `fromService` links the client to the API URL and vice versa
- Static site gets a rewrite rule for SPA client-side routing
- `rootDir` for monorepo subdirectory targeting

Runtime options: [references/runtimes.md](references/runtimes.md)
Service types: [references/service-types.md](references/service-types.md)
Template examples: [assets/](assets/)

## Step 3: Validate

If the Render CLI is installed:
```bash
render whoami -o json
render blueprints validate
```

Fix any errors before proceeding. Common issues: [references/configuration-guide.md](references/configuration-guide.md)

## Step 4: Commit and Push

The `render.yaml` **must be merged and pushed** to the remote before the Dashboard deeplink will work:

```bash
git add render.yaml
git commit -m "Add Render deployment configuration"
git push origin main
```

## Step 5: Generate Dashboard Deeplink

```bash
git remote get-url origin
```

Convert SSH URLs to HTTPS:
- `git@github.com:user/repo.git` → `https://github.com/user/repo`

Build the deeplink:
```
https://dashboard.render.com/blueprint/new?repo=<HTTPS_REPO_URL>
```

## Step 6: Guide User Through Dashboard

1. Verify `render.yaml` exists in the remote repo
2. Click the deeplink
3. Complete Git provider OAuth if prompted
4. Fill in secret env vars (`MONGODB_URI`, `OPENROUTER_API_KEY`, any other `sync: false` vars)
5. Review services and click "Apply"

### MongoDB Atlas Connection Setup

This is the step users most commonly get wrong. Guide them through it:

1. **Get the connection string** from Atlas: `Database` → `Connect` → `Drivers` → copy the `mongodb+srv://` URI
2. **Replace `<password>`** with their actual database user password
3. **Replace `<dbname>`** with the target database name (e.g., `myapp`)
4. **Configure network access** — two options:

   **Option A: Allow from anywhere (simplest for Render)**
   Atlas → `Network Access` → `Add IP Address` → `Allow Access from Anywhere` (adds `0.0.0.0/0`)
   Relies on strong credentials. Standard for PaaS with dynamic IPs.

   **Option B: Static outbound IPs (more restrictive)**
   Requires Render paid plan. Find your service's outbound IPs in the Render Dashboard under the service's `Connect` tab. Add each IP to Atlas `Network Access`. More secure but breaks if Render rotates IPs.

5. **Paste the full URI** as the `MONGODB_URI` value in Render Dashboard

Full details: [references/configuration-guide.md](references/configuration-guide.md)

## Step 7: Verify Deployment

After the user clicks "Apply" in the Dashboard:

**Via MCP:**
```
list_deploys(serviceId: "<service-id>", limit: 1)
```
Look for `status: "live"`.

**Check for errors:**
```
list_logs(resource: ["<service-id>"], level: ["error"], limit: 20)
```

**Verify GraphQL endpoint:**
The Apollo Server health check should respond at `https://<service-url>/graphql` with a 200 status when the landing page is enabled, or accept a simple query.

Full verification checklist: [references/post-deploy-checks.md](references/post-deploy-checks.md)

---

# Method 2: Direct Service Creation (MCP)

For single-service quick deployments without `render.yaml`. Full MCP command reference: [references/direct-creation.md](references/direct-creation.md)

### Quick API Service

```
create_web_service(
  name: "my-app-api",
  repo: "https://github.com/user/repo",
  branch: "main",
  rootDir: "./server",
  runtime: "node",
  buildCommand: "npm ci && npm run build",
  startCommand: "node dist/index.js",
  plan: "free",
  envVars: [
    { key: "NODE_ENV", value: "production" },
    { key: "MONGODB_URI", value: "<atlas-connection-string>" }
  ]
)
```

### Quick Static Site

```
create_static_site(
  name: "my-app-client",
  repo: "https://github.com/user/repo",
  branch: "main",
  rootDir: "./client",
  buildCommand: "npm ci && npm run build",
  publishPath: "./dist"
)
```

---

# GitHub Actions CI/CD

For projects using GitHub Actions alongside Render's auto-deploy:

```yaml
# .github/workflows/ci.yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run build
```

Render auto-deploys on push to `main` by default. The CI pipeline runs tests first — if CI fails, the push doesn't happen (if using branch protection), preventing broken deploys.

---

# Post-Deploy Verification and Triage

1. Confirm latest deploy is `live` and serving traffic
2. Hit the GraphQL endpoint and verify a 200 response
3. Scan recent error logs for failure signatures
4. Verify env vars are set (especially `MONGODB_URI` and `PORT`)
5. Confirm the Express server binds to `0.0.0.0:$PORT` (Render requirement)

Detailed checklist: [references/post-deploy-checks.md](references/post-deploy-checks.md)
Troubleshooting: [references/troubleshooting-basics.md](references/troubleshooting-basics.md)

## Common Failures

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Deploy stuck "In Progress" | Apollo Server not binding to `$PORT` | Ensure `listen(process.env.PORT \|\| 4000, '0.0.0.0')` |
| MongoDB connection timeout | Atlas IP allowlist missing | Add `0.0.0.0/0` or Render's outbound IPs to Atlas |
| Static site 404 on refresh | Missing SPA rewrite rule | Add `/* → /index.html` rewrite in render.yaml |
| `VITE_API_URL` undefined | Env var not prefixed with `VITE_` | Vite only exposes vars prefixed with `VITE_` to client |
| CORS errors | API not allowing client origin | Set `CLIENT_URL` env var and configure CORS in Express |

## Escalated Network Access

If deployment fails due to sandbox network restrictions:
```
The deploy needs escalated network access. Rerun with sandbox_permissions=require_escalated.
```
