# Render Blueprint Specification Reference

A comprehensive reference for `render.yaml` configurations in MERN + GraphQL + TypeScript deployments on Render.

## Overview

The `render.yaml` file defines your entire deployment infrastructure as code. It specifies services, databases, and environment variable groups that Render provisions and manages.

**File Location:** Place `render.yaml` in your repository root.

## Top-Level Structure

```yaml
services:
  # Web services, static sites, workers, cron jobs
  - type: web
    name: api
    # ... service configuration

databases:
  # External databases only (MongoDB Atlas not included here)
  # Managed PostgreSQL, MySQL, etc.

envVarGroups:
  # Shared environment variable configurations
  - name: shared
    envVars: []
```

### Key Sections

- **`services:`** (required) — Array of services to deploy. Includes APIs, static sites, background workers.
- **`databases:`** (optional) — Render-managed databases. MongoDB Atlas connections are configured via environment variables, not here.
- **`envVarGroups:`** (optional) — Reusable sets of environment variables shared across services.

---

## Service Configuration

### Service Type Overview

| Type | Purpose | Has startCommand | Has healthCheckPath |
|------|---------|------------------|---------------------|
| `web` | HTTP API server, accepts requests | Yes | Yes |
| `static` | Pre-built static files (React SPA) | No | No |
| `worker` | Background job processor | Yes | No |
| `cron` | Scheduled task runner | No | No |
| `pserv` | Private service (internal comms only) | Yes | No |

### Service Fields Reference

#### Core Identity

```yaml
type: web  # Required. Options: web, static, worker, cron, pserv
name: api  # Required. Lowercase, hyphens only. Becomes part of internal hostname.
```

- **`type`** — Determines service behavior and available fields.
- **`name`** — Used in service discovery. Example: `api` becomes `api.onrender.com` (web) or accessible as `api` internally.

#### Runtime & Build

```yaml
runtime: node
  # Options: node, docker, image, static
  # For static type, runtime is implicit (omit this field)

rootDir: services/api
  # Subdirectory where service source lives
  # Useful for monorepos
  # Relative to repo root

buildCommand: npm ci && npm run build
  # Runs once during deployment
  # Install dependencies and compile/bundle

startCommand: npm start
  # Runs after build succeeds (web, worker only)
  # Launches your server

staticPublishPath: dist
  # Directory containing pre-built HTML/CSS/JS (static type only)
  # Relative to rootDir
  # Served as root of web server
```

**Notes:**
- **Node runtime** — Requires `package.json` in rootDir. Render auto-installs dependencies.
- **Docker runtime** — Requires `Dockerfile` in rootDir. Fully custom build environment.
- **Image runtime** — Pulls pre-built Docker image from registry (ECR, Docker Hub, etc.).
- **Static type** — No `runtime` field needed. Runtime is implicitly static.

#### Deployment & Scaling

```yaml
plan: free
  # Options: free, starter, standard, pro
  # Determines CPU, RAM, and pricing
  # free: 0.5 CPU, 512MB RAM (Render-managed sleep)
  # starter: 0.5 CPU, 512MB RAM (always on)

region: oregon
  # Options: oregon, ohio, virginia, frankfurt, singapore
  # Default: oregon
  # Latency and compliance considerations

numInstances: 1
  # Number of concurrent instances
  # free/starter plans: max 1
  # standard+: scale horizontally
  # Default: 1

autoDeploy: true
  # Default: true
  # Redeploy on git push to tracked branch
  # Set false for manual deployments only
```

**Deployment Behavior:**
- Render triggers builds on push to linked branch (usually `main`).
- Free plan services sleep after 15 minutes of inactivity.
- Standard+ plans always active.

#### Health Checks & Monitoring

```yaml
healthCheckPath: /api/health
  # HTTP GET endpoint checked every 10s
  # Must return 2xx or 3xx
  # Service marked unhealthy if endpoint unreachable
  # web type only

pullRequestPreviewsEnabled: true
  # Default: true
  # Create preview deployments for pull requests
  # Each PR gets its own URL
```

**Health Check Recommendations:**
```javascript
// Express example
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});
```

#### Selective Builds

```yaml
buildFilter:
  paths:
    - services/api/**
  ignoredPaths:
    - services/client/**
    - "*.md"
  # Trigger build only if changes in paths
  # Ignore certain paths even if changed
  # Useful for monorepos
```

**Use Case:** Skip rebuilding the API when only frontend assets change.

#### Pull Request Previews

```yaml
pullRequestPreviewsEnabled: true
  # Create temporary deployments for each PR
  # Preview URL available in PR checks
  # Auto-destroyed when PR closes
```

---

## Static Site Configuration

For React/Vue/Svelte SPAs built with Vite or Create React App.

### Example: React Frontend Service

```yaml
- type: static
  name: web
  rootDir: services/client
  buildCommand: npm ci && npm run build
  staticPublishPath: dist
  headers:
    - path: "/**"
      name: "Cache-Control"
      value: "public, max-age=3600"
    - path: "/index.html"
      name: "Cache-Control"
      value: "no-cache"
    - path: "/**"
      name: "X-Content-Type-Options"
      value: "nosniff"
    - path: "/**"
      name: "Referrer-Policy"
      value: "strict-origin-when-cross-origin"
  routes:
    - type: rewrite
      source: "/*"
      destination: "/index.html"
  pullRequestPreviewsEnabled: true
```

### Routes & Rewrites

**Single Page Application (SPA):**
```yaml
routes:
  - type: rewrite
    source: "/*"
    destination: "/index.html"
```

All unmatchted paths rewritten to `index.html`, allowing React Router to handle client-side navigation.

**Redirect Example:**
```yaml
routes:
  - type: redirect
    source: "/old-path"
    destination: "/new-path"
    code: 301  # Permanent redirect
```

### Cache Headers

**Strategy:**
- Bundle files (with hashes): Cache long-term (1 year)
- `index.html`: Cache short or disable caching
- API responses: Set via backend headers

**Example:**
```yaml
headers:
  - path: "/static/**"
    name: "Cache-Control"
    value: "public, max-age=31536000, immutable"
  - path: "/index.html"
    name: "Cache-Control"
    value: "public, max-age=0, must-revalidate"
```

---

## Environment Variables

### Syntax & Variants

#### 1. Static Value

```yaml
envVars:
  - key: NODE_ENV
    value: production
  - key: LOG_LEVEL
    value: info
```

Hardcoded values. Visible in Render Dashboard. Use for non-sensitive configuration.

#### 2. User-Filled Secret

```yaml
envVars:
  - key: DATABASE_PASSWORD
    sync: false
```

Placeholder only. User must fill in Dashboard. `sync: false` prevents overwriting user values on redeploy.

**Workflow:**
1. Deploy with `sync: false` variable.
2. User fills value in Render Dashboard (Environment tab).
3. Value persists across redeployments.

#### 3. Auto-Generated Value

```yaml
envVars:
  - key: JWT_SECRET
    generateValue: true
```

Render generates a random string. Useful for secrets that don't need manual setup.

#### 4. Reference Another Service

```yaml
envVars:
  - key: API_URL
    fromService:
      name: api
      type: web
      property: url
  - key: DB_HOST
    fromService:
      name: postgres
      type: pserv
      property: host
```

**Available Properties:**
- `url` — Full public URL (web type only). Example: `https://api.onrender.com`
- `host` — Internal hostname. Example: `api.onrender.com` or `postgres`
- `port` — Internal port. Example: `5432`

**Common Pattern (MERN):**
```yaml
# In API service
envVars:
  - key: FRONTEND_URL
    fromService:
      name: web
      type: static
      property: url

# In frontend service (vite.config.ts)
envVars:
  - key: VITE_API_URL
    fromService:
      name: api
      type: web
      property: url
```

#### 5. Reference Environment Variable Group

```yaml
envVars:
  - key: SHARED_CONFIG
    fromGroup: shared
```

**Define the group:**
```yaml
envVarGroups:
  - name: shared
    envVars:
      - key: NODE_ENV
        value: production
      - key: LOG_LEVEL
        value: info
```

Avoids duplication across multiple services.

#### 6. Database Connection (External)

For MongoDB Atlas, PostgreSQL, etc., use static values or user-filled variables:

```yaml
envVars:
  - key: MONGODB_URI
    sync: false  # User fills in Dashboard
```

**Note:** `fromDatabase` is NOT used for external databases like MongoDB Atlas. Render's `fromDatabase` is only for Render-managed databases in the `databases:` section.

---

## Common Patterns for MERN + Apollo + Mongoose

### Pattern 1: Two-Service Monorepo

```yaml
services:
  - type: web
    name: api
    runtime: node
    rootDir: services/api
    buildCommand: cd services/api && npm ci && npm run build
    startCommand: npm start
    plan: starter
    region: oregon
    healthCheckPath: /graphql
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: "3001"
      - key: MONGODB_URI
        sync: false
      - key: FRONTEND_URL
        fromService:
          name: web
          type: static
          property: url
      - key: JWT_SECRET
        generateValue: true
    autoDeploy: true
    pullRequestPreviewsEnabled: true

  - type: static
    name: web
    rootDir: services/client
    buildCommand: cd services/client && npm ci && npm run build
    staticPublishPath: dist
    plan: free
    routes:
      - type: rewrite
        source: "/*"
        destination: "/index.html"
    headers:
      - path: "/**"
        name: "Cache-Control"
        value: "public, max-age=3600"
    envVars:
      - key: VITE_API_URL
        fromService:
          name: api
          type: web
          property: url
    pullRequestPreviewsEnabled: true
```

**Key Details:**
- `rootDir` specifies subdirectory for each service.
- API references frontend URL for CORS.
- Frontend references API URL for Vite env vars.
- Health check points to GraphQL endpoint.
- Both pull request previews enabled.

### Pattern 2: Shared Configuration via envVarGroups

```yaml
envVarGroups:
  - name: shared
    envVars:
      - key: NODE_ENV
        value: production
      - key: LOG_LEVEL
        value: info
      - key: CORS_ORIGIN
        value: https://myapp.onrender.com

services:
  - type: web
    name: api
    runtime: node
    rootDir: services/api
    buildCommand: cd services/api && npm ci && npm run build
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: LOG_LEVEL
        value: info
      - key: MONGODB_URI
        sync: false
      - key: JWT_SECRET
        generateValue: true
    autoDeploy: true

  - type: static
    name: web
    rootDir: services/client
    buildCommand: cd services/client && npm ci && npm run build
    staticPublishPath: dist
    envVars:
      - key: VITE_API_URL
        fromService:
          name: api
          type: web
          property: url
    autoDeploy: true
```

**Benefit:** Define shared vars once, avoid duplication.

### Pattern 3: Health Check Endpoint

```javascript
// services/api/src/health.ts
import express from 'express';

const router = express.Router();

router.get('/', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date() });
});

export default router;
```

```yaml
healthCheckPath: /api/health
```

**Response Requirements:**
- Status code: 2xx or 3xx (success)
- Body: JSON object (optional, but recommended)
- Timeout: 10 seconds

### Pattern 4: Build Filter for Selective Redeployment

```yaml
services:
  - type: web
    name: api
    runtime: node
    rootDir: services/api
    buildCommand: npm ci && npm run build
    startCommand: npm start
    buildFilter:
      paths:
        - services/api/**
        - package.json
      ignoredPaths:
        - services/client/**
        - "*.md"
        - ".github/**"
    autoDeploy: true
```

**Behavior:** API redeploys only when files in `services/api/` or root `package.json` change. Frontend changes alone don't trigger API rebuild.

### Pattern 5: Environment Variables for Apollo & Mongoose

```yaml
services:
  - type: web
    name: api
    runtime: node
    rootDir: services/api
    buildCommand: npm ci && npm run build
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: MONGODB_URI
        sync: false  # User fills: mongodb+srv://username:password@cluster.mongodb.net/dbname
      - key: APOLLO_INTROSPECTION
        value: "false"  # Disable GraphQL introspection in production
      - key: APOLLO_DEBUG
        value: "false"
      - key: CORS_ORIGIN
        value: https://myapp.onrender.com
      - key: JWT_SECRET
        generateValue: true
      - key: JWT_EXPIRY
        value: 7d
      - key: LOG_LEVEL
        value: info
```

**Usage in Code:**
```typescript
// services/api/src/server.ts
import mongoose from 'mongoose';
import { ApolloServer } from '@apollo/server';

const mongoUri = process.env.MONGODB_URI;
await mongoose.connect(mongoUri);

const server = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: process.env.NODE_ENV !== 'production',
});
```

---

## Complete Example: Full Stack Deployment

```yaml
services:
  - type: web
    name: api
    runtime: node
    rootDir: services/api
    plan: starter
    region: oregon
    buildCommand: cd services/api && npm ci && npm run build
    startCommand: npm start
    healthCheckPath: /api/health
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: "3001"
      - key: MONGODB_URI
        sync: false
      - key: FRONTEND_URL
        fromService:
          name: web
          type: static
          property: url
      - key: JWT_SECRET
        generateValue: true
      - key: APOLLO_INTROSPECTION
        value: "false"
      - key: LOG_LEVEL
        value: info
    autoDeploy: true
    pullRequestPreviewsEnabled: true

  - type: static
    name: web
    rootDir: services/client
    plan: free
    buildCommand: cd services/client && npm ci && npm run build
    staticPublishPath: dist
    routes:
      - type: rewrite
        source: "/*"
        destination: "/index.html"
    headers:
      - path: "/static/**"
        name: "Cache-Control"
        value: "public, max-age=31536000, immutable"
      - path: "/index.html"
        name: "Cache-Control"
        value: "public, max-age=0, must-revalidate"
      - path: "/**"
        name: "X-Content-Type-Options"
        value: "nosniff"
      - path: "/**"
        name: "Referrer-Policy"
        value: "strict-origin-when-cross-origin"
    envVars:
      - key: VITE_API_URL
        fromService:
          name: api
          type: web
          property: url
    autoDeploy: true
    pullRequestPreviewsEnabled: true
```

---

## Quick Reference: Field Availability by Service Type

| Field | web | static | worker | cron | pserv |
|-------|-----|--------|--------|------|-------|
| `buildCommand` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `startCommand` | ✓ | ✗ | ✓ | ✗ | ✓ |
| `staticPublishPath` | ✗ | ✓ | ✗ | ✗ | ✗ |
| `healthCheckPath` | ✓ | ✗ | ✗ | ✗ | ✗ |
| `routes` | ✗ | ✓ | ✗ | ✗ | ✗ |
| `headers` | ✗ | ✓ | ✗ | ✗ | ✗ |
| `envVars` | ✓ | ✓ | ✓ | ✓ | ✓ |

---

## Troubleshooting

### Build Command Fails in Monorepo

**Issue:** `npm: command not found` in `rootDir`

**Solution:** Use absolute paths or change directory first:
```yaml
buildCommand: cd services/api && npm ci && npm run build
```

### Health Check Timeout

**Issue:** Service marked unhealthy despite running

**Solution:** Ensure endpoint is accessible and responds quickly:
```javascript
app.get('/api/health', (req, res) => {
  res.status(200).json({ ok: true });
});
```

### Frontend Can't Reach API

**Issue:** CORS or fetch errors from React to API

**Solution:** Ensure `fromService` references are correct and CORS is configured:
```yaml
envVars:
  - key: VITE_API_URL
    fromService:
      name: api
      type: web
      property: url
```

Then in API:
```typescript
const corsOrigin = process.env.FRONTEND_URL || 'http://localhost:3000';
app.use(cors({ origin: corsOrigin }));
```

### MongoDB Atlas Connection Fails

**Issue:** `MONGODB_URI` not set or connection timeout

**Solution:** Ensure variable is user-filled and includes authentication:
```yaml
envVars:
  - key: MONGODB_URI
    sync: false
```

User provides: `mongodb+srv://user:password@cluster.mongodb.net/database?retryWrites=true&w=majority`

---

## Additional Resources

- [Render Documentation](https://render.com/docs)
- [Infrastructure as Code (IaC) with render.yaml](https://render.com/docs/infrastructure-as-code)
- [Environment Variables](https://render.com/docs/environment-variables)
- [Static Site Deployment](https://render.com/docs/static-sites)
