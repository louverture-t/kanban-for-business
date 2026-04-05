# Codebase Analysis Reference for Render Deployment

This guide helps analyze a MERN + GraphQL + TypeScript codebase to determine correct deployment configuration on Render. Use this checklist to systematically identify project structure, build/start commands, and environment setup.

## 1. Project Structure Detection

### Monorepo vs Single Repository

**Monorepo (workspace) detection:**
- Look for `package.json` at root with `"workspaces"` field
- Check if `client/` and `server/` directories exist at root level
- Each workspace has its own `package.json`

**Single repository detection:**
- One `package.json` at root
- Frontend code in `src/` or `client/src/`
- Backend code may be in `src/` (with `src/server/`, `src/api/`, or mixed)

**To check:**
```bash
# Check for workspaces in root package.json
cat package.json | grep -A 5 "workspaces"

# Look for directory structure
ls -la | grep -E "^d.*client|^d.*server"

# If monorepo, each service has its own package.json
ls client/package.json server/package.json 2>&1
```

**Decision logic:**
- **If workspaces found:** Deploy as two separate Render services (frontend and backend)
- **If single repo:** Check if Express serves static files from frontend build (single service) or if they need separate services

---

## 2. Frontend Detection

### Vite + React 18 Stack

**Key files to check:**
- `vite.config.ts` or `vite.config.js` — confirms Vite setup
- `package.json` — look for `react`, `@vitejs/plugin-react`
- `tailwind.config.ts` or `tailwind.config.js` — Tailwind CSS v3
- `tsconfig.json` — TypeScript configuration

**Search patterns:**
```bash
# Check for Vite config
find . -maxdepth 2 -name "vite.config.*"

# Check for React and Vite plugin in dependencies
cat client/package.json | grep -E '"react"|"@vitejs/plugin-react"'

# Check for Tailwind
cat client/package.json | grep -i "tailwind"

# Verify build output directory
grep -r "outDir" vite.config.ts
```

**Expected findings:**
- `vite.config.ts` contains `@vitejs/plugin-react`
- `outDir` in Vite config is typically `"dist"`
- `shadcn/ui` and `@apollo/client` in dependencies
- `react-router-dom` for routing

**Build command:**
```bash
npm ci && npm run build
```

**Output verification:**
- Vite produces `dist/` directory with `index.html` and bundled assets
- Check `package.json` scripts: `"build": "vite build"`

---

## 3. Backend Detection

### Express + Apollo Server v4 + Mongoose + TypeScript

**Key files to check:**
- `src/index.ts`, `src/server.ts`, or `server/src/index.ts` — entry point
- `package.json` — look for `express`, `@apollo/server`, `mongoose`
- `tsconfig.json` — TypeScript compilation config
- Build output: check for `dist/` or `build/` directory

**Search patterns:**
```bash
# Find entry point
find . -maxdepth 3 -name "index.ts" -o -name "server.ts" | grep -v node_modules | head -5

# Check backend package.json for dependencies
cat server/package.json | grep -E '"express"|"@apollo/server"|"mongoose"'

# Check tsconfig.json for outDir
cat server/tsconfig.json | grep -E '"outDir"'

# Check build script
cat server/package.json | grep -A 1 '"build"'
```

**Expected findings:**
- `@apollo/server` version 4.x
- `express` version 4.x
- `mongoose` version 8.x
- Build script runs TypeScript compiler: `"build": "tsc"` or similar
- `outDir` in `tsconfig.json` is typically `"dist"` or `"build"`

**Build command:**
```bash
npm ci && npm run build
```

**Example tsconfig.json (backend):**
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## 4. Build Commands

### Monorepo (Separate Frontend & Backend Services)

**Frontend service:**
```bash
# In client/ directory
npm ci && npm run build
```

**Backend service:**
```bash
# In server/ directory
npm ci && npm run build
```

### Single Repository (One Service)

**Determine if Express serves static files:**
```bash
# Search for static serving middleware
grep -r "express.static" src/ server/

# Look for build output reference
grep -r "dist" server/index.ts src/index.ts
```

**If Express serves frontend build (unified service):**
```bash
# Root package.json may have a script like:
{
  "scripts": {
    "build": "npm run build --workspace=client && npm run build --workspace=server"
  }
}

# OR multiple separate builds:
npm ci && npm run build:client && npm run build:server
```

**If separate services:**
```bash
# Build frontend (in client/ or frontend/ directory)
cd client && npm ci && npm run build

# Build backend (in server/ or backend/ directory)
cd server && npm ci && npm run build
```

---

## 5. Start Commands

### Express/Apollo Server (Backend)

**Determine compiled entry point:**
```bash
# Check tsconfig.json for rootDir and outDir
cat server/tsconfig.json | grep -E '"rootDir"|"outDir"'

# Check main entry in package.json
cat server/package.json | grep '"main"'

# Common pattern:
# tsconfig: rootDir = "src", outDir = "dist"
# entry file: src/index.ts → compiled to dist/index.js
```

**Start command:**
```bash
node dist/index.js
```

Or if entry is different:
```bash
node dist/server.js
# or
node build/index.js
```

**Verify by checking package.json:**
```json
{
  "scripts": {
    "start": "node dist/index.js",
    "dev": "ts-node src/index.ts"
  }
}
```

### Frontend (Static)

For monorepo with separate frontend service:
- No start command needed — Render serves static files from `dist/` via static site configuration
- Or configure to serve using a simple HTTP server if needed

For unified service:
- Express static middleware serves the frontend build automatically

---

## 6. Environment Variables

### Identify Required Variables

**Search for environment references:**
```bash
# Backend
grep -r "process.env\." server/src/ | grep -v node_modules

# Frontend
grep -r "import.meta.env\|process.env\." client/src/ | grep -v node_modules
```

**Expected backend variables:**
- `PORT` — Express server port (e.g., 5000)
- `MONGODB_URI` — MongoDB Atlas connection string
- `JWT_SECRET` — JWT signing secret
- `NODE_ENV` — "development" or "production"
- `CLIENT_URL` — Frontend URL (for CORS)
- `OPENROUTER_API_KEY` — OpenRouter API key for AI features

**Expected frontend variables:**
- `VITE_API_URL` — GraphQL endpoint URL (e.g., `https://api.example.com/graphql`)
- `NODE_ENV` — "development" or "production" (via Vite)

**Look for .env.example:**
```bash
# Check for environment template
find . -name ".env.example" -o -name ".env.sample" | head -5

# Review contents
cat server/.env.example
```

**Example .env.example (backend):**
```
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/dbname
JWT_SECRET=your-secret-key-here
PORT=5000
NODE_ENV=production
CLIENT_URL=https://yourfrontend.com
OPENROUTER_API_KEY=your-openrouter-key
```

**For Render deployment:**
1. Set environment variables in Render service settings
2. Backend service gets all `MONGODB_URI`, `JWT_SECRET`, `PORT`, `NODE_ENV`, `CLIENT_URL`, `OPENROUTER_API_KEY`
3. Frontend service gets `VITE_API_URL` (pointing to backend service URL)

---

## 7. Port Detection

### Find Where Server Listens

**Search for listen() calls:**
```bash
# Look for port configuration
grep -r "listen\|\.listen" server/src/ | grep -v node_modules

# Check for port assignment
grep -r "process.env.PORT\|PORT =" server/src/ | grep -v node_modules
```

**Expected pattern:**
```typescript
// src/index.ts
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

**Decision logic:**
- If `process.env.PORT` is used: ✅ Good for Render (respects PORT env var)
- If hardcoded port: ❌ Problem — Render assigns a random port, need to update code to use `process.env.PORT`
- If no explicit listen(): Check if Express middleware is passed to Apollo Server

---

## 8. Database Detection

### MongoDB Connection

**Search for connection string:**
```bash
# Look for mongoose connection
grep -r "mongoose.connect\|connectDB" server/src/ | grep -v node_modules

# Check for MongoDB URL patterns
grep -r "mongodb\+srv\|mongodb://" server/src/ | grep -v node_modules
```

**Expected pattern:**
```typescript
// src/db.ts or src/index.ts
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/dbname";

await mongoose.connect(MONGODB_URI);
```

**Production vs Testing:**
```bash
# Check for mongodb-memory-server in devDependencies (test database)
cat server/package.json | grep "mongodb-memory-server"

# Check test setup files
find server/src -name "*.test.ts" -o -name "*.spec.ts" | head -3
```

**Verify connection:**
- Confirm `MONGODB_URI` uses `mongodb+srv://` for Atlas
- Check if connection URL is parameterized with username/password (should use env vars)

---

## 9. Apollo Server v4 Setup

### Detect Apollo Server Configuration

**Check for Apollo Server v4 patterns:**
```bash
# Look for expressMiddleware import (v4 indicator)
grep -r "expressMiddleware" server/src/ | grep -v node_modules

# Check Apollo Server instantiation
grep -r "new ApolloServer\|ApolloServer(" server/src/ | grep -v node_modules

# Look for typeDefs and resolvers
grep -r "typeDefs\|resolvers" server/src/ | grep -v node_modules
```

**Expected v4 setup:**
```typescript
// src/server.ts
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";

const server = new ApolloServer({
  typeDefs,
  resolvers,
  plugins: [ApolloServerPluginDrainHttpServer({ httpServer: app })],
});

await server.start();

app.use("/graphql", expressMiddleware(server, {
  context: async ({ req }) => ({ user: req.user }),
}));
```

**GraphQL endpoint:**
- Typically at `/graphql` path
- Frontend Apollo Client connects to: `https://api.example.com/graphql`

**Verify:**
```bash
# Check for graphql route/path
grep -r '"/graphql"' server/src/ | grep -v node_modules

# Confirm Apollo Server import source
grep "from.*@apollo/server" server/src/*.ts
```

---

## 10. Static Asset Serving

### Determine Service Architecture

**Single service (Express serves frontend):**
```bash
# Look for static middleware
grep -r "express.static\|static(" server/src/ | grep -v node_modules

# Check for client build path reference
grep -r "client/dist\|../client/dist\|frontend/dist" server/src/ | grep -v node_modules
```

**Expected single-service pattern:**
```typescript
// src/index.ts
import express from "express";
import path from "path";

const app = express();

// Serve static frontend build
app.use(express.static(path.join(__dirname, "../client/dist")));

// Apollo Server middleware
app.use("/graphql", expressMiddleware(server));

// SPA fallback: serve index.html for all other routes
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/dist/index.html"));
});
```

**Two separate services (frontend + backend):**
- No static serving in backend
- Frontend is standalone Vite build served by Render static site
- Backend only provides GraphQL API

**To determine:**
```bash
# If no static serving found and frontend/backend are separate
# Count directories at root
ls -d client server frontend backend 2>&1 | wc -l

# If workspaces in package.json, likely separate services
grep -c "workspaces" package.json
```

**Decision logic:**
- **Single service:** One Render web service, build backend (which includes frontend), start Node server
- **Separate services:** One Render web service (Node/Express for backend API), one static site (frontend build)

---

## 11. Deployment Checklist

### Pre-Deployment Verification

- [ ] **Project structure identified** — Monorepo vs single repo
- [ ] **Frontend:** Vite config found, build output is `dist/`
- [ ] **Backend:** Express + Apollo Server v4, TypeScript compiles to `dist/` or `build/`
- [ ] **Build commands work locally** — `npm ci && npm run build` succeeds
- [ ] **Start command correct** — `node dist/index.js` or equivalent
- [ ] **Port uses `process.env.PORT`** — Not hardcoded
- [ ] **Environment variables listed** — Render settings include all required vars
- [ ] **MongoDB URI configured** — `MONGODB_URI` env var set in Render
- [ ] **Apollo Server on `/graphql`** — Frontend Apollo Client points to correct URL
- [ ] **CORS configured** — Backend allows frontend URL in `CLIENT_URL`
- [ ] **Frontend API URL set** — `VITE_API_URL` points to backend service URL

### Common Issues & Fixes

| Issue | Solution |
|-------|----------|
| `Port already in use` | Ensure code uses `process.env.PORT` |
| `Cannot find module` | Check `outDir` in `tsconfig.json`, verify build script |
| `Apollo graphql endpoint 404` | Confirm `expressMiddleware` mounted at `/graphql` |
| `CORS errors on frontend` | Set `CLIENT_URL` env var, configure Apollo Server context |
| `MongoDB connection failed` | Verify `MONGODB_URI` format, check Atlas IP whitelist |
| `Frontend can't reach API` | Confirm `VITE_API_URL` in frontend env var, check service URLs |
| `Static files 404` | For single service: check Express static path, verify SPA fallback |

---

## 12. Configuration Examples

### Monorepo Render Deployment (Two Services)

**Frontend Service:**
- **Root Directory:** `client`
- **Build Command:** `npm ci && npm run build`
- **Start Command:** (None — static site)
- **Environment:** `VITE_API_URL=https://api-service-url.onrender.com`

**Backend Service:**
- **Root Directory:** `server`
- **Build Command:** `npm ci && npm run build`
- **Start Command:** `node dist/index.js`
- **Environment:**
  - `MONGODB_URI=...`
  - `JWT_SECRET=...`
  - `PORT=5000`
  - `NODE_ENV=production`
  - `CLIENT_URL=https://frontend-service-url.onrender.com`
  - `OPENROUTER_API_KEY=...`

### Single Service Render Deployment

**Combined Service:**
- **Root Directory:** `.` (root)
- **Build Command:** `npm ci && npm run build`
- **Start Command:** `node dist/index.js`
- **Environment:** (All vars: MONGODB_URI, JWT_SECRET, etc.)

---

## Quick Reference: Grep Commands

Use these commands to quickly gather codebase info:

```bash
# Full analysis in one go
echo "=== MONOREPO CHECK ===" && grep "workspaces" package.json
echo "=== FRONTEND ===" && cat client/package.json | grep -E '"react"|"@vitejs"'
echo "=== BACKEND ===" && cat server/package.json | grep -E '"express"|"@apollo"'
echo "=== ENTRY POINT ===" && find . -name "index.ts" | grep -v node_modules
echo "=== ENVIRONMENT VARS ===" && grep -r "process.env\." server/src | cut -d: -f2 | sort -u
echo "=== PORT ===" && grep -r "listen" server/src | grep -v node_modules
echo "=== GRAPHQL PATH ===" && grep -r "/graphql" server/src | grep -v node_modules
echo "=== STATIC SERVING ===" && grep -r "express.static" server/src | grep -v node_modules
```

---

## Notes

- Always verify findings by checking actual source code, not just relying on grep
- Test build and start commands locally before deploying to Render
- MongoDB Atlas M0 free tier has limitations; monitor usage in production
- JWT secrets should be generated randomly and never committed to version control
- Frontend `VITE_API_URL` must include full URL path (e.g., `https://api.example.com`, not just `api.example.com`)
