# Post-Deployment Verification Checklist
## MERN + GraphQL Stack on Render

After deploying your services to Render, follow this checklist to ensure everything is working correctly.

---

## 1. Deploy Status

### What to Check
Verify that both the backend API and frontend React app have been deployed successfully and are live.

### MCP Command
```bash
# List all services in your Render account
# Using Render Dashboard API (if available via MCP)
render_service status <service-id>

# Or check via Render CLI
render logs <service-name> --tail 20
```

### Manual Check (Dashboard)
1. Go to https://dashboard.render.com
2. Find your services (API and frontend)
3. Verify status shows **"Live"** (green indicator)
4. Check "Last deployed" timestamp is recent

### Success Criteria
- Both services show status: **Live**
- No error indicators or red badges
- Deployment completed without manual intervention

### Remediation
If status is "Building", "Deploying", or "Failed":
- Wait for build to complete (can take 2-5 minutes)
- If "Failed", click the service and view logs for errors
- Refer to [troubleshooting-basics.md](./troubleshooting-basics.md) for common errors

---

## 2. GraphQL Endpoint

### What to Check
Verify the GraphQL API is responding and accepting requests.

### curl Command (Simple Health Check)
```bash
# Get the API service URL from Render Dashboard
API_URL="https://your-api-service.onrender.com"

# Test basic connectivity
curl -X POST ${API_URL}/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __typename }"}' \
  -v

# Expected response: HTTP 200
# Body should contain: {"data":{"__typename":"Query"}}
```

### curl Command (Full GraphQL Query)
```bash
# If you have a simple query in your schema
curl -X POST https://your-api-service.onrender.com/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"query { users { id name email } }"}' \
  -w "\nHTTP Status: %{http_code}\n"
```

### Browser Test
1. Go to `https://your-api-service.onrender.com/graphql`
2. If Apollo Studio is enabled, you should see the Apollo Studio interface
3. Try running a test query in the explorer

### Success Criteria
- HTTP 200 response
- GraphQL returns valid JSON with `data` field
- No CORS errors (if testing from frontend domain)
- No authentication errors for public queries

### Remediation
- HTTP 500: Server error — check logs with `render logs api-service --tail 50`
- HTTP 403/401: Authentication issue — verify JWT secret is set
- HTTP 404: Endpoint not found — verify Apollo Server is listening on `/graphql`
- No response: Server not running — verify health check passes (Section 1)

---

## 3. Error Logs

### What to Check
Inspect recent error logs to catch any warnings, crashes, or issues that might cause problems later.

### Render CLI Command
```bash
# View last 20 error-level logs
render logs <service-name> --level error --lines 20

# Or watch logs in real-time
render logs <service-name> --follow
```

### Render Dashboard
1. Click your service (API or frontend)
2. Click **"Logs"** tab
3. Scroll through recent entries
4. Look for lines with `ERROR`, `FATAL`, `failed`, `timeout`, `refused`

### Log Patterns to Check For (Backend)
```
✅ Good:
  "Server listening on port 4000"
  "MongoDB connected successfully"
  "Apollo Server started at /graphql"

❌ Bad (fix before continuing):
  "MongooseError: connection timeout"
  "EADDRINUSE: address already in use"
  "Error: JWT_SECRET is not defined"
  "CORS: origin not allowed"
```

### Log Patterns to Check For (Frontend)
```
✅ Good:
  "Server listening on port 5173"  (or your port)
  "Frontend running successfully"

❌ Bad (fix before continuing):
  "EADDRINUSE: address already in use"
  "Cannot find module"
  "Failed to build"
```

### Success Criteria
- No ERROR level logs in the last 100 entries
- No FATAL crashes or crashes within past 10 minutes
- Application logs show normal startup messages

### Remediation
- See [troubleshooting-basics.md](./troubleshooting-basics.md) for specific error messages
- Check Configuration variables (Section 4)
- Review recent code changes for new errors

---

## 4. Environment Variables

### What to Check
Verify all required environment variables are set and correct, especially sensitive ones that are easy to misconfigure.

### Render Dashboard Check
1. Click your API service
2. Click **"Environment"** tab
3. Verify these variables are present:
   - `MONGODB_URI` — should not be blank
   - `JWT_SECRET` — should have a value (auto-generated or provided)
   - `NODE_ENV` — should be `"production"`
   - `PORT` — auto-injected by Render (may not appear)
   - `CLIENT_URL` — should match your frontend service URL
   - `OPENROUTER_API_KEY` — should be present

### Verify Variable Values
```bash
# Log a startup message showing variables (DO NOT log sensitive values in production)
# Add to your server.ts temporarily:
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('CLIENT_URL:', process.env.CLIENT_URL);
console.log('MONGODB_URI:', process.env.MONGODB_URI ? 'SET' : 'NOT SET');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'SET' : 'NOT SET');
```

### Frontend Variables
1. Click your frontend service
2. Click **"Environment"** tab
3. Verify:
   - `VITE_API_URL` — should be your API service URL (e.g., `https://api.onrender.com`)

### Test Variable Availability in Frontend
```javascript
// In React console, check if API URL is available:
console.log('API URL:', import.meta.env.VITE_API_URL);
// Should output: API URL: https://your-api-service.onrender.com
```

### Success Criteria
- All required variables are present
- No variables show "NOT SET"
- `NODE_ENV` is `"production"`
- Sensitive vars (JWT_SECRET, API keys) are masked in UI but show "SET"

### Remediation
1. If variable is missing: click **"Add Environment Variable"** and set it
2. If value is wrong: click the variable and **Edit**
3. After changes, deploy again for changes to take effect
4. Render will restart your service automatically

---

## 5. Port Binding

### What to Check
Verify the API server is listening on the correct port and responding.

### Log Check
```bash
# In Render logs, look for the startup message:
render logs api-service --tail 10 | grep -i "listening\|port"

# Expected: "Server listening on port 4000" (or your PORT)
```

### Test with curl
```bash
API_URL="https://your-api-service.onrender.com"

# Test if server is responding
curl -I ${API_URL}/health

# Expected: HTTP 200
```

### Check Render Service Configuration
```yaml
# In render.yaml, verify the service is configured to expose a port:
services:
  - type: web
    name: api
    startCommand: npm run start
    # Render automatically exposes port 8080, 10000, or uses PORT env var
```

### Success Criteria
- Health check returns HTTP 200
- Logs show "Server listening" message
- No "EADDRINUSE" or "permission denied" errors

### Remediation
- If no listening message: check logs for startup errors (Section 3)
- If port error: ensure `host: '0.0.0.0'` in server configuration
- Restart service from Render Dashboard

---

## 6. MongoDB Connection

### What to Check
Verify the application has successfully connected to MongoDB Atlas and can perform basic queries.

### Log Check
```bash
# Look for MongoDB connection confirmation:
render logs api-service --tail 50 | grep -i "mongo\|connected\|database"

# Expected: "MongoDB connected successfully"
# Or: "Mongoose connected to MongoDB"
```

### Test a Simple Query
```bash
# Query your GraphQL API for any data (example: users list)
curl -X POST https://your-api-service.onrender.com/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"query { users { id } }"}' \
  -s | jq '.'

# Expected: {"data":{"users":[...]}} or {"data":{"users":[]}}
# NOT: {"errors":[...]} with database/connection errors
```

### Verify in MongoDB Atlas
1. Go to https://cloud.mongodb.com
2. Click your cluster
3. Click **"Monitoring"** → **"Connection Logs"**
4. Look for recent successful connections from Render IP
5. Should show recent authentication successes

### Success Criteria
- Logs show "connected" message
- GraphQL queries return data (not connection errors)
- Atlas shows successful connections
- No "authentication failed" errors

### Remediation
- "Connection timeout": Check IP allowlist (MongoDB Atlas Network Access)
- "Authentication failed": Verify password and user credentials
- "Database not found": Check database name in connection string
- See Section 2 of [troubleshooting-basics.md](./troubleshooting-basics.md)

---

## 7. Static Site (Frontend)

### What to Check
Verify the React app loads correctly and all assets are served.

### Test in Browser
1. Go to `https://your-frontend-service.onrender.com`
2. Verify the React app loads (not a blank page or error)
3. Check that styling is applied (CSS loaded, not unstyled HTML)
4. Verify images load correctly (if any)

### Check Console for Errors
1. Open browser DevTools (F12)
2. Click **"Console"** tab
3. Look for red errors
4. Errors like "VITE_API_URL is undefined" indicate environment variable issues

### Check Network Tab
1. Open DevTools → **"Network"** tab
2. Reload the page
3. Verify:
   - `index.html` loads with 200 status
   - JS/CSS files load with 200 status
   - No 404 errors for assets

### Success Criteria
- React app renders (not blank)
- No red errors in console
- All assets load with 200 status
- Styling is visible

### Remediation
- Blank page: Check logs for build errors
- Red errors: Check environment variables (Section 4)
- 404 on assets: Ensure `npm run build` was successful
- Check logs: `render logs frontend-service --tail 20`

---

## 8. SPA Routing

### What to Check
Verify that page refreshes on deep routes don't result in 404 errors (common SPA issue).

### Test Navigation
1. Load the app: `https://your-frontend-service.onrender.com`
2. Navigate to a deep route (e.g., `/dashboard`, `/settings`, `/users/123`)
3. Refresh the page (Ctrl+R or Cmd+R)
4. Verify you stay on that page (no 404 error)

### Check HTTP Status
```bash
# Test a deep route
curl -I https://your-frontend-service.onrender.com/dashboard

# Expected: HTTP 200 (serves index.html)
# NOT: HTTP 404
```

### Success Criteria
- Deep routes return 200 and show the app
- Page refresh keeps you on the same route
- No 404 errors for non-existent routes

### Remediation
- 404 on refresh: Add SPA rewrite rule in render.yaml
  ```yaml
  routes:
    - path: /*
      matchType: path
      destination: /index.html
  ```
- Or use a custom server that rewrites all requests to index.html
- See [troubleshooting-basics.md](./troubleshooting-basics.md) Issue 4

---

## 9. CORS Configuration

### What to Check
Verify that the frontend can make GraphQL requests to the API without CORS errors.

### Test from Browser Console
1. Open the React app: `https://your-frontend-service.onrender.com`
2. Open DevTools → **"Console"**
3. Run a test query:
```javascript
fetch('https://your-api-service.onrender.com/graphql', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    query: 'query { __typename }'
  }),
  credentials: 'include'
})
.then(r => r.json())
.then(d => console.log(d))
.catch(e => console.error(e));

// Expected: {"data":{"__typename":"Query"}} in console
// NOT: CORS error
```

### Test with curl
```bash
curl -X POST https://your-api-service.onrender.com/graphql \
  -H "Origin: https://your-frontend-service.onrender.com" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __typename }"}' \
  -v | grep -i "access-control"

# Expected: Access-Control-Allow-Origin header in response
```

### Success Criteria
- Browser fetch succeeds (no CORS error)
- GraphQL query returns data
- curl shows `Access-Control-Allow-Origin` header

### Remediation
- CORS error in browser: Check `CLIENT_URL` environment variable
- Verify API has CORS middleware configured with correct origin
- See [troubleshooting-basics.md](./troubleshooting-basics.md) Issue 6

---

## 10. Health Metrics

### What to Check
Monitor CPU, memory, and request throughput to ensure the services are healthy.

### Render Dashboard Metrics
1. Click your API service
2. Scroll down to **"Metrics"** section
3. Verify:
   - **CPU**: Below 80% average (spikes OK, but not sustained)
   - **Memory**: Below 80% of available (watch for memory leaks)
   - **Requests**: Reasonable rate for your traffic

### Example Metrics Check
```
CPU: 5% — ✅ Good
Memory: 120 MB / 512 MB (23%) — ✅ Good
Requests/min: 10 — ✅ Good
Response time: 50ms avg — ✅ Good
```

### Check for Memory Leaks
1. Monitor memory over 1-2 hours
2. Verify memory doesn't steadily increase
3. If memory grows continuously, check for:
   - Unresolved promises
   - Event listener leaks
   - Circular references in caches

### Success Criteria
- CPU stays below 80%
- Memory doesn't show steady increase
- Response times are acceptable (<500ms avg)
- Error rate is low

### Remediation
- High CPU: Optimize queries or indexes
- High memory: Check for memory leaks in code
- Slow responses: Add caching or database indexes
- Upgrade to paid plan for more resources if needed

---

## 11. SSL Certificate

### What to Check
Verify HTTPS is working and the SSL certificate is valid.

### Browser Check
1. Go to `https://your-api-service.onrender.com`
2. Click the lock icon in address bar
3. Verify certificate is valid for your domain
4. No warnings about self-signed or expired certificates

### curl Check
```bash
# Verify SSL certificate
curl -vI https://your-api-service.onrender.com/health 2>&1 | grep -i "certificate\|issuer\|subject"

# Expected: Certificate issued by "Let's Encrypt" or similar trusted CA
# NOT: "self signed certificate" or "certificate expired"
```

### Test HTTPS Redirect
```bash
# Verify HTTP redirects to HTTPS
curl -I http://your-api-service.onrender.com/health

# Expected: 301 or 302 redirect to https://...
```

### Success Criteria
- HTTPS works (no browser warnings)
- Certificate is valid and current
- HTTP redirects to HTTPS
- API accessible over HTTPS

### Remediation
- If using custom domain: Verify DNS points to Render
- Certificate auto-provisioned by Render (no action needed)
- Wait 24-48 hours for new domains to get certificates
- Check Render Dashboard for certificate status

---

## 12. Full Integration Test

### End-to-End Test
Perform a complete user flow to ensure all services work together:

```bash
#!/bin/bash
# Example integration test

API_URL="https://your-api-service.onrender.com"
FRONTEND_URL="https://your-frontend-service.onrender.com"

echo "=== Testing API ==="
curl -X POST ${API_URL}/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __typename }"}' \
  -w "\nStatus: %{http_code}\n"

echo "\n=== Testing Frontend ==="
curl -I ${FRONTEND_URL} -w "\nStatus: %{http_code}\n"

echo "\n=== Testing CORS ==="
curl -X POST ${API_URL}/graphql \
  -H "Origin: ${FRONTEND_URL}" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __typename }"}' \
  -v 2>&1 | grep -i "access-control"

echo "\n=== Testing Health ==="
curl ${API_URL}/health
```

### Expected Output
```
=== Testing API ===
{"data":{"__typename":"Query"}}
Status: 200

=== Testing Frontend ===
Status: 200

=== Testing CORS ===
Access-Control-Allow-Origin: https://your-frontend-service.onrender.com
Access-Control-Allow-Credentials: true

=== Testing Health ===
{"status":"ok","timestamp":"2024-01-15T10:30:45.123Z"}
```

---

## Quick Checklist

Run through this checklist after each deployment:

```
✓ Deploy Status
  [ ] API service shows "Live"
  [ ] Frontend service shows "Live"

✓ API Endpoint
  [ ] curl /graphql returns 200
  [ ] GraphQL query works
  [ ] No 500 errors

✓ Logs
  [ ] No ERROR entries in logs
  [ ] "Server listening" message present
  [ ] "MongoDB connected" message present

✓ Environment
  [ ] All required variables present
  [ ] VITE_API_URL set correctly
  [ ] JWT_SECRET is set

✓ Port & Connection
  [ ] Health check responds 200
  [ ] MongoDB has recent successful connections
  [ ] No timeout/connection refused errors

✓ Frontend
  [ ] React app loads and renders
  [ ] No red errors in console
  [ ] Assets load (CSS, JS, images)

✓ Routing
  [ ] Deep routes work on refresh (/dashboard, etc.)
  [ ] No 404 on SPA routes

✓ CORS
  [ ] Browser fetch to API succeeds
  [ ] GraphQL mutations work from React
  [ ] No CORS errors in console

✓ Health
  [ ] CPU < 80%
  [ ] Memory stable (not leaking)
  [ ] Response time reasonable
  [ ] HTTPS works with valid cert

[ ] Full integration test passed
[ ] Ready for user testing
```

---

## Summary

After completing all checks, your Render deployment is ready for:
- User acceptance testing
- Load testing
- Production traffic

If any checks fail, refer to [troubleshooting-basics.md](./troubleshooting-basics.md) for solutions. Common issues are covered with specific symptoms, root causes, and fixes.

For ongoing monitoring, set up:
- Slack/Email alerts on deployment failures
- Health check monitoring (uptime checks)
- Error tracking (Sentry, Datadog, etc.)
- Application performance monitoring (APM)
