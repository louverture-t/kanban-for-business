# Render Deployment — MCP Direct Service Creation

This guide covers creating Render services directly via MCP tools, without using `render.yaml`. This approach is useful for quick deployments, manual service management, or when you prefer explicit control over each service.

## Prerequisites

- GitHub repository connected to your Render account (Account Settings → Git)
- Git provider credentials authorized in Render Dashboard
- For MERN stack: separate directories for `./server` and `./client`

## 1. Creating a Web Service (Apollo API + Express + Mongoose)

The web service hosts your backend GraphQL API built with Express, Apollo Server v4, and Mongoose v8 connected to MongoDB Atlas.

```javascript
create_web_service({
  name: "app-api",
  repo: "https://github.com/user/repo",
  branch: "main",
  rootDir: "./server",
  runtime: "node",
  buildCommand: "npm ci && npm run build",
  startCommand: "node dist/index.js",
  plan: "free",
  envVars: [
    { key: "NODE_ENV", value: "production" },
    { key: "PORT", value: "4000" },
    { key: "MONGODB_URI", value: "mongodb+srv://user:password@cluster.mongodb.net/dbname" },
    { key: "JWT_SECRET", value: "your-secure-jwt-secret-here" },
    { key: "ALLOWED_ORIGINS", value: "https://app-client.onrender.com" }
  ]
})
```

**Key Parameters:**
- **name**: Unique service identifier (used in URL)
- **rootDir**: Path to server directory relative to repo root
- **buildCommand**: Installs dependencies and compiles TypeScript
- **startCommand**: Runs compiled JavaScript from dist folder
- **PORT**: Default 4000 for Apollo Server
- **MONGODB_URI**: Full MongoDB Atlas connection string (include credentials)
- **JWT_SECRET**: Used for token signing; generate a secure random value
- **ALLOWED_ORIGINS**: CORS whitelist; use static site URL after frontend deployment

## 2. Creating a Static Site (React + Vite + Apollo Client)

The static site hosts your frontend—React 18 with Vite, Apollo Client for GraphQL, and TypeScript.

```javascript
create_static_site({
  name: "app-client",
  repo: "https://github.com/user/repo",
  branch: "main",
  rootDir: "./client",
  buildCommand: "npm ci && npm run build",
  publishPath: "./dist",
  envVars: [
    { key: "VITE_API_URL", value: "https://app-api.onrender.com" }
  ]
})
```

**Key Parameters:**
- **name**: Unique service identifier (used in URL)
- **rootDir**: Path to client directory relative to repo root
- **buildCommand**: Installs dependencies and builds Vite distribution
- **publishPath**: Vite outputs to `./dist`; Render serves files from this directory
- **VITE_API_URL**: Backend GraphQL endpoint; update after API deployment completes

**Static Site Configuration (Post-Deployment):**
After creation, configure via Dashboard:
- **Redirects**: Add SPA rewrite rule to serve `index.html` for all routes (necessary for client-side routing)
  ```
  /* → /index.html (200)
  ```
- **Headers**: Add security headers for production
  ```
  X-Content-Type-Options: nosniff
  X-Frame-Options: SAMEORIGIN
  Referrer-Policy: strict-origin-when-cross-origin
  ```

## 3. Adding or Updating Environment Variables After Creation

If you need to add or modify environment variables after a service is created:

```javascript
update_env_vars({
  serviceId: "srv_abc123def456",
  envVars: [
    { key: "VITE_API_URL", value: "https://app-api.onrender.com" },
    { key: "VITE_ANALYTICS_ID", value: "G-XXXXXX" }
  ]
})
```

**Note:** Use the service ID returned from `create_web_service` or `create_static_site`, or retrieve it via `list_services()`.

## 4. Listing and Managing Services

### List All Services
```javascript
list_services()
```

Returns all services in your Render account with IDs, names, types, and status.

### Get Service Details
```javascript
get_service({
  serviceId: "srv_abc123def456"
})
```

Returns full service configuration, including environment variables, build command, and deployment history.

### View Recent Deployments
```javascript
list_deploys({
  serviceId: "srv_abc123def456",
  limit: 5
})
```

Shows the 5 most recent deployments with timestamps and status (success/failed).

## 5. Checking Logs

View deployment and runtime logs to debug issues:

```javascript
list_logs({
  resource: ["srv_abc123def456"],
  level: ["error"],
  limit: 20
})
```

**Common Queries:**
- **All logs**: `level: ["info", "warning", "error"]`
- **Errors only**: `level: ["error"]`
- **Build issues**: Check logs during build phase; look for npm/TypeScript errors
- **Runtime errors**: Check after deployment; look for Express or Apollo Server errors

## 6. Triggering a Manual Deploy

To redeploy a service without pushing new code:

```javascript
create_deploy({
  serviceId: "srv_abc123def456"
})
```

Useful for:
- Picking up newly added environment variables
- Retrying a failed deploy
- Forcing a rebuild after upstream dependency updates

## 7. Follow-on Configuration in Render Dashboard

After successfully creating services via MCP, complete these steps in the Render Dashboard:

### For Web Service (API):
1. **Custom Domain** (optional)
   - Services → API → Settings → Custom Domains
   - Point your domain (e.g., `api.example.com`) to the Render URL

2. **Auto-Deploy Settings**
   - By default, services deploy on every push to the specified branch
   - Disable under Settings if you prefer manual deploys

3. **Deploy Notifications** (optional)
   - Settings → Notifications
   - Receive alerts on deployment success/failure via email or webhook

### For Static Site:
1. **SPA Rewrite Rule** (required for client-side routing)
   - Services → Client → Settings → Redirects and Rewrites
   - Add: `/* → /index.html (200)`

2. **Security Headers** (recommended)
   - Services → Client → Settings → Headers
   - Add CORS and security headers

3. **Custom Domain** (optional)
   - Services → Client → Settings → Custom Domains
   - Point your domain (e.g., `example.com`) to the Render URL

4. **PR Preview Deployments** (optional)
   - Services → Client → Settings → Preview Deployments
   - Enable to generate preview URLs for pull requests

5. **Cache Control** (recommended)
   - Configure cache-busting via query parameters or headers
   - Set appropriate cache headers for assets in your Vite config

## 8. Troubleshooting MCP Errors

### Error: "Git credentials not connected"
**Solution:**
1. Go to Render Dashboard → Account Settings → Git
2. Click "Connect" next to GitHub (or your provider)
3. Authorize Render to access your repositories
4. Retry the MCP call

### Error: "Repository not found"
**Solution:**
- Verify the GitHub URL is correct and public (or Render has access)
- Ensure your Git provider is connected in Account Settings

### Error: "Build failed"
**Solution:**
1. Run `list_deploys()` for the service to get deployment ID
2. Use `list_logs()` to view full build output
3. Common issues:
   - Missing dependencies: Verify `package.json` in root of `rootDir`
   - TypeScript errors: Check `npm run build` runs locally
   - Environment variables: Ensure `VITE_API_URL` is set for client if it uses the API

### Error: "Service creation timed out"
**Solution:**
- Check Render Dashboard → Services to see if the service was created
- Use `list_services()` to confirm, then `update_env_vars()` if needed

## 9. Environment Variables for MERN Stack

### Backend (Web Service) Essential Variables:
- `NODE_ENV`: `production`
- `PORT`: `4000` (or your chosen port)
- `MONGODB_URI`: MongoDB Atlas connection string
- `JWT_SECRET`: Secure random string for token signing
- `ALLOWED_ORIGINS`: Static site URL for CORS

### Frontend (Static Site) Essential Variables:
- `VITE_API_URL`: Web service URL (e.g., `https://app-api.onrender.com`)

### Optional Advanced Variables:
- **Backend**: `LOG_LEVEL`, `GRAPHQL_DEBUG`, `RATE_LIMIT_*`
- **Frontend**: `VITE_ANALYTICS_ID`, `VITE_APP_TITLE`, `VITE_FEATURE_FLAGS`

## 10. Deployment Workflow Summary

1. **Create Web Service** (API)
   - Gets a Render URL: `https://app-api.onrender.com`

2. **Create Static Site** (Frontend)
   - Gets a Render URL: `https://app-client.onrender.com`

3. **Update Client Environment Variables**
   - Set `VITE_API_URL` to the web service URL

4. **Update Backend CORS**
   - Add static site URL to `ALLOWED_ORIGINS`

5. **Configure Static Site Settings**
   - Add SPA rewrite rule and security headers

6. **Test End-to-End**
   - Visit static site URL
   - Verify Apollo Client connects to backend
   - Check Network tab for successful GraphQL requests

---

**For render.yaml templates**, see `monorepo-render.yaml` and `single-service-render.yaml` in the assets directory.
