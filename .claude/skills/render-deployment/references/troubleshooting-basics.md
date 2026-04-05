# Render Deployment Troubleshooting Guide
## Common Failures, Symptoms, Root Causes, and Fixes

---

## Issue 1: Deploy Stuck "In Progress"

### Symptom
- Deploy shows status "In Progress" for more than 5 minutes
- No "Server listening on port" message in logs
- Render health check times out with 504 error

### Log Pattern to Identify
```
[STDERR] Error: EADDRINUSE: address already in use :::4000
[STDERR] Server failed to start on port 4000
[STDERR] listen EACCES: permission denied 0.0.0.0:4000
```

### Root Cause
Apollo Server or Express is not binding to `0.0.0.0:$PORT`, or is binding to an unavailable port. Render expects the service to bind to all interfaces (0.0.0.0) and listen on the PORT environment variable.

### Fix

**Step 1**: Verify server binding in `src/server.ts`:
```typescript
import express from 'express';

const app = express();
const port = process.env.PORT || 4000;

// ✅ Correct
app.listen({ port, host: '0.0.0.0' }, () => {
  console.log(`Server listening on port ${port}`);
});

// ❌ Wrong (localhost binding)
app.listen(port, 'localhost', () => {
  console.log(`Server listening on port ${port}`);
});

// ❌ Wrong (no explicit host)
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
```

**Step 2**: Check `render.yaml` service configuration:
```yaml
services:
  - type: web
    name: api
    startCommand: npm run start  # Or: node dist/server.js
    healthCheckPath: /health
    healthCheckTimeout: 30
```

**Step 3**: Test locally:
```bash
PORT=4000 npm run start
# Should output: "Server listening on port 4000"
```

**Step 4**: Check Render logs:
```bash
# Using Render CLI (if available) or dashboard logs
# Look for: "Server listening on port" or error messages
```

---

## Issue 2: MongoDB Connection Timeout

### Symptom
- Logs show: `MongooseError: connection timeout` or `ECONNREFUSED`
- API queries fail with 500 errors
- No error after "connecting to MongoDB..."

### Log Pattern to Identify
```
[STDERR] Mongoose connection timeout to mongodb+srv://...
[STDERR] getaddrinfo ENOTFOUND cluster-abc123.mongodb.net
[STDERR] connect ETIMEDOUT
[STDERR] Error: connect ECONNREFUSED 127.0.0.1:27017
```

### Root Cause
1. MongoDB Atlas IP allowlist does not include Render deployment IPs
2. Connection string is incorrect or cluster is down
3. MongoDB Atlas free tier limitations (e.g., suspended after 30 days of inactivity)

### Fix

**Step 1**: Verify connection string format:
```
mongodb+srv://username:password@cluster.mongodb.net/dbname?retryWrites=true&w=majority
```
- Replace `<password>` with actual password (URL-encoded)
- Replace `<username>` with database user
- Replace `cluster` with your cluster name from Atlas
- Replace `dbname` with your database name

**Step 2**: Check IP allowlist in MongoDB Atlas:
1. Go to **Cluster** → **Network Access**
2. Verify `0.0.0.0/0` is added, OR
3. Add Render static outbound IPs:
   - In Render Dashboard → **Settings** → **Static Outbound IP** (paid plan only)
   - Copy the IP addresses
   - Add them to MongoDB Atlas Network Access

**Step 3**: Verify user has correct role:
1. In MongoDB Atlas → **Database Access**
2. Find your database user
3. Edit and ensure role is **readWriteAnyDatabase** or specific database readWrite
4. Save changes

**Step 4**: Check Mongoose connection options:
```typescript
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI!, {
      serverSelectionTimeoutMS: 10000,  // Fail faster
      maxPoolSize: 10,
      retryWrites: true,
    });
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection failed:', error);
    process.exit(1);
  }
};
```

**Step 5**: Test locally with the same connection string:
```bash
MONGODB_URI="mongodb+srv://..." npm run start
# Should show: "MongoDB connected"
```

---

## Issue 3: MongoDB Authentication Failed

### Symptom
- Logs show: `MongoError: authentication failed` or `bad auth`
- Password-related errors in connection string
- API works locally but fails on Render

### Log Pattern to Identify
```
[STDERR] MongoAuthenticationError: authentication failed
[STDERR] "SCRAM-SHA-1 authentication failed"
[STDERR] 13 Authentication failed
```

### Root Cause
1. Password in connection string is incorrect or missing
2. Password contains special characters that are not URL-encoded
3. Database user doesn't have access to the target database
4. User was deleted or password was changed

### Fix

**Step 1**: Verify password encoding in connection string:
- Special chars must be URL-encoded: `!` → `%21`, `@` → `%40`, `#` → `%23`, `$` → `%24`, `%` → `%25`, etc.
- Use an online URL encoder if unsure
- Example: password `My@Pass#123` → `My%40Pass%23123`

**Step 2**: Reset database user password:
1. In MongoDB Atlas → **Database Access**
2. Find your user → **Edit**
3. Change password or generate a new one
4. Copy the new password
5. Update `MONGODB_URI` in Render environment variables

**Step 3**: Verify user has access:
1. In MongoDB Atlas → **Database Access**
2. Edit the user
3. Under **Built-in Role** → ensure **readWriteAnyDatabase** is selected
4. Or add a custom role scoped to your database with readWrite permissions
5. Save and wait for changes to propagate (1-2 minutes)

**Step 4**: Test the connection string:
```bash
# Use mongosh to test
mongosh "mongodb+srv://username:password@cluster.mongodb.net/dbname"
# Should connect without authentication errors
```

---

## Issue 4: Static Site 404 on Page Refresh

### Symptom
- React app loads initially at `/`
- Clicking links works (client-side routing)
- Refreshing page at `/dashboard` or other routes → 404 Not Found
- Only affects the static site service, not API

### Log Pattern to Identify
```
[HTTP] GET /dashboard 404 Not Found
[HTTP] GET /users/123 404 Not Found
[HTTP] GET / 200 OK
```

### Root Cause
Render's static site server is treating deep routes as file paths instead of SPA routes. It needs a rewrite rule to send all non-file requests to `index.html`.

### Fix

**Update render.yaml** for the frontend service:
```yaml
services:
  - type: web
    name: client
    buildCommand: npm run build
    startCommand: npm run preview  # or: python -m http.server
    routes:
      - path: /*
        matchType: path
        destination: /index.html
```

**Alternative: Use a simple HTTP server**:
```bash
# In package.json scripts
"preview": "vite preview --host 0.0.0.0 --port $PORT"
```

**Or with Python (if available in build image)**:
```bash
"start": "cd dist && python3 -m http.server ${PORT:-5173}"
```

**Or with Node + Express**:
```typescript
// server.ts (for frontend serving)
import express from 'express';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 5173;

app.use(express.static(path.join(__dirname, 'dist')));

// Fallback: send index.html for all routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Frontend server running on port ${PORT}`);
});
```

---

## Issue 5: VITE_API_URL Undefined in Production

### Symptom
- React code: `import.meta.env.VITE_API_URL` returns `undefined`
- API calls fail with malformed URLs
- Works locally but broken after deploy
- Network requests show `/graphql` instead of `https://api-service.onrender.com/graphql`

### Log Pattern to Identify
```
[Browser Console] Error: Cannot read property 'split' of undefined
[Browser Console] POST http://undefined/graphql 404 Not Found
```

### Root Cause
Vite only exposes environment variables prefixed with `VITE_` to client-side code. The variable must be:
1. Named with `VITE_` prefix
2. Set in Render environment variables
3. Available at build time (not runtime)

### Fix

**Step 1**: Rename environment variable in render.yaml:
```yaml
# ❌ Wrong: API_URL (not accessible in browser)
envVars:
  - key: API_URL
    value: https://api-service.onrender.com

# ✅ Correct: VITE_API_URL (accessible in Vite)
envVars:
  - key: VITE_API_URL
    fromService:
      type: web_service_name
      property: url
```

**Step 2**: Update React code to use the correct variable name:
```typescript
// src/config/apiConfig.ts
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export const client = new ApolloClient({
  link: createHttpLink({
    uri: `${API_URL}/graphql`,
  }),
  cache: new InMemoryCache(),
});
```

**Step 3**: Verify vite.config.ts doesn't filter env vars:
```typescript
// ✅ Default Vite config (exposes VITE_ vars automatically)
export default defineConfig({
  plugins: [react()],
});

// ❌ Don't explicitly filter (unless intentional)
export default defineConfig({
  define: {
    __API_URL__: JSON.stringify(process.env.API_URL),  // Wrong
  },
});
```

**Step 4**: Rebuild and redeploy:
```bash
npm run build
# Should show env vars being loaded
```

---

## Issue 6: CORS Errors

### Symptom
- Browser console: `Access to XMLHttpRequest blocked by CORS policy`
- API response includes: `No 'Access-Control-Allow-Origin' header is present`
- GraphQL queries fail with 403 or 0 status
- Only happens in production, works locally

### Log Pattern to Identify
```
[Browser] CORS Error: The response had HTTP status code 403
[Server] No CORS headers added to response
[Server] Origin 'https://frontend.onrender.com' not allowed
```

### Root Cause
1. Apollo Server/Express not configured with correct `CLIENT_URL` origin
2. `CLIENT_URL` environment variable not set or incorrect
3. CORS middleware not applied to `/graphql` endpoint
4. Credentials mode mismatch (need `credentials: 'include'` on both sides)

### Fix

**Step 1**: Verify CORS configuration in Express/Apollo:
```typescript
import cors from 'cors';

const clientUrl = process.env.CLIENT_URL;

if (!clientUrl) {
  console.error('CLIENT_URL environment variable not set');
  process.exit(1);
}

app.use(cors({
  origin: clientUrl,
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
}));

// If using Apollo expressMiddleware
app.use('/graphql', expressMiddleware(server, {
  context: async ({ req }) => {
    // req.headers.origin is validated by cors() above
    return { req };
  },
}));
```

**Step 2**: Set CLIENT_URL in Render environment:
```yaml
# render.yaml
envVars:
  - key: CLIENT_URL
    fromService:
      type: web_service_name  # Frontend service name
      property: url
      # Results in: https://my-frontend-service.onrender.com
```

Or manually:
```yaml
envVars:
  - key: CLIENT_URL
    value: https://my-frontend-service.onrender.com
```

**Step 3**: Verify client-side Apollo configuration:
```typescript
const client = new ApolloClient({
  link: createHttpLink({
    uri: `${import.meta.env.VITE_API_URL}/graphql`,
    credentials: 'include',  // Important for cookies
  }),
  cache: new InMemoryCache(),
});
```

**Step 4**: Test CORS with curl:
```bash
curl -H "Origin: https://my-frontend-service.onrender.com" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     https://my-api-service.onrender.com/graphql -v
# Should return 200 with Access-Control headers
```

---

## Issue 7: Build Fails: TypeScript Errors

### Symptom
- Deploy fails during build phase
- Errors like: `Type 'X' is not assignable to type 'Y'`
- Works locally with `npm run dev` but fails with `npm run build`
- TypeScript strict mode errors not caught in development

### Log Pattern to Identify
```
[Build] error TS2339: Property 'X' does not exist on type 'Y'
[Build] error TS2345: Argument of type 'X' is not assignable to parameter of type 'Y'
[Build] Build failed with exit code 1
```

### Root Cause
1. TypeScript in build mode (`tsc`) is stricter than Vite dev mode
2. `tsconfig.json` has `strict: true` which catches issues not visible in development
3. Type mismatches in resolvers, middleware, or utilities
4. Missing type definitions for third-party packages

### Fix

**Step 1**: Run build locally to catch errors early:
```bash
npm run build
# Fix any TypeScript errors before deploying
```

**Step 2**: Check tsconfig.json:
```json
{
  "compilerOptions": {
    "strict": true,           // Catches all type issues
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

**Step 3**: Fix common TypeScript issues:
```typescript
// ❌ Wrong: implicit any
const resolver = (parent, args, context) => {
  return args.id;
};

// ✅ Correct: explicit types
const resolver = (parent: any, args: { id: string }, context: any) => {
  return args.id;
};

// Or use GraphQL code generator for generated types
```

**Step 4**: Install missing type definitions:
```bash
npm install --save-dev @types/node @types/express
```

---

## Issue 8: Out of Memory During Build

### Symptom
- Build process hangs or gets killed
- Error: `FATAL ERROR: CALL_AND_RETRY_LAST Allocation failed`
- Memory usage spikes to 100%
- Only on Render, not locally

### Log Pattern to Identify
```
[Build] <--- JS stacktrace --->
[Build] FATAL ERROR: CALL_AND_RETRY_LAST Allocation failed - JavaScript heap out of memory
[Build] 1: 0x00...
```

### Root Cause
1. Render free/starter plan has limited build memory (512 MB default)
2. Large dependencies or bundling takes more memory than available
3. No garbage collection happening during build

### Fix

**Step 1**: Increase Node memory in build command:
```yaml
# render.yaml
services:
  - type: web
    name: api
    buildCommand: NODE_OPTIONS=--max_old_space_size=4096 npm run build
```

Or for frontend:
```yaml
buildCommand: NODE_OPTIONS=--max_old_space_size=4096 npm run build
```

**Step 2**: Optimize dependencies:
```bash
# Find large packages
npm list --depth=0 | sort -k2 -rn

# Remove unused dependencies
npm prune --production
```

**Step 3**: Consider upgrading Render plan:
- **Free tier**: 512 MB build memory, no caching
- **Paid tier**: 2 GB+ build memory, faster builds

**Step 4**: Enable build caching (if available):
```yaml
buildCache: enabled
```

---

## Issue 9: Health Check Timeout

### Symptom
- Deploy shows "Health check failed"
- Render marks service as "unhealthy"
- Service keeps restarting
- Requests return 503 Service Unavailable

### Log Pattern to Identify
```
[Health Check] GET /health timeout after 30s
[Health Check] HTTP 500 returned
[Render] Service health check failed, restarting...
```

### Root Cause
1. Express/Apollo not responding to health check within 30 seconds
2. Health check endpoint not defined or not responding with 200
3. Database connection blocking health check
4. Heavy computation in server startup

### Fix

**Step 1**: Add a fast health check endpoint:
```typescript
// Must respond immediately, not depend on DB
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});
```

**Step 2**: Configure healthCheckPath in render.yaml:
```yaml
services:
  - type: web
    name: api
    healthCheckPath: /health
    healthCheckTimeout: 30
```

**Step 3**: Ensure server starts quickly:
```typescript
// ✅ Connect to DB asynchronously after server starts
const server = new ApolloServer({ typeDefs, resolvers });
await server.start();

const app = express();
app.use('/graphql', expressMiddleware(server));
app.get('/health', (req, res) => res.json({ ok: true }));

const port = process.env.PORT || 4000;
app.listen({ port, host: '0.0.0.0' }, async () => {
  console.log(`Server listening on port ${port}`);

  // Connect to DB after server starts
  try {
    await connectDB();
  } catch (error) {
    console.error('DB connection failed:', error);
  }
});
```

**Step 4**: Test locally:
```bash
npm run start
curl http://localhost:4000/health
# Should return 200 immediately
```

---

## Issue 10: Module Not Found After Deploy

### Symptom
- Error: `Cannot find module 'X'`
- App works locally but fails on Render after deploy
- Error happens at runtime, not build time
- Missing graphql, apollo-server, or mongoose errors

### Log Pattern to Identify
```
[Runtime] Error: Cannot find module '@apollo/server'
[Runtime] Error: Cannot find module 'mongoose'
[Runtime] Error: Cannot find module 'graphql'
```

### Root Cause
1. Dependency is in `devDependencies` instead of `dependencies`
2. `NODE_ENV=production` during build skips `devDependencies`
3. Modules needed at runtime are marked as dev-only

### Fix

**Step 1**: Check package.json for misplaced dependencies:
```json
{
  "dependencies": {
    "@apollo/server": "^4.0.0",      // ✅ Should be here
    "express": "^4.18.0",
    "mongoose": "^8.0.0",
    "graphql": "^16.0.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.0",    // ✅ Types are OK here
    "typescript": "^5.0.0"
  }
}
```

**Step 2**: Move runtime dependencies:
```bash
# Move from devDependencies to dependencies
npm install @apollo/server express mongoose graphql
npm uninstall @apollo/server --save-dev
```

**Step 3**: Set NODE_ENV correctly:
```yaml
# render.yaml
envVars:
  - key: NODE_ENV
    value: production

# During build, use development to install devDeps
buildCommand: NODE_ENV=development npm ci && npm run build
```

**Step 4**: Test build locally:
```bash
rm -rf node_modules dist
NODE_ENV=production npm ci
npm run build
npm run start  # Should not have module errors
```

---

## Summary of Log Inspection Commands

| Issue | Command | What to Look For |
|-------|---------|------------------|
| Server startup | Check logs 0-10s | "Server listening on port" |
| MongoDB | Check logs 0-30s | "MongoDB connected" or "connection timeout" |
| CORS | Browser console | "Access to XMLHttpRequest blocked" |
| Build | Check build logs | "error TS" or "Allocation failed" |
| Health check | Check Render dashboard | Service status: "live" or "unhealthy" |
| Env vars | Server logs | Confirm vars are read (log them safely) |

---

## Testing Checklist

- [ ] Run `npm run build` locally before deploying
- [ ] Test with `npm run start` and verify server responds
- [ ] Test GraphQL endpoint with `curl -X POST http://localhost:4000/graphql`
- [ ] Verify health check: `curl http://localhost:4000/health`
- [ ] Check logs for any warnings or errors
- [ ] Test MongoDB connection string locally
- [ ] Verify VITE_API_URL is set in frontend env vars
- [ ] Test CORS from browser console in dev tools
