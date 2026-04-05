# Render Deployment Details

Operational and maintenance details for managing MERN + GraphQL + TypeScript applications after initial deployment on Render.

---

## Service Discovery

### Internal Networking Basics

All services in the same Render workspace are automatically connected via an internal network. Services can discover and communicate with each other using environment variables or Render's internal DNS.

### Environment Variable Service Discovery

The recommended approach is to use `fromService` references in render.yaml to automatically inject service URLs into environment variables.

**Example render.yaml:**

```yaml
services:
  - type: web
    name: api
    runtime: node
    buildCommand: npm ci && npm run build
    startCommand: npm start
    envVars:
      - key: MONGODB_URI
        scope: runtime
        value: mongodb+srv://user:pass@cluster.mongodb.net/dbname
      - key: REDIS_URL
        fromService:
          name: queue-service
          type: pserv
          property: host

  - type: worker
    name: queue-processor
    runtime: node
    buildCommand: npm ci && npm run build
    startCommand: npm run worker
    envVars:
      - key: API_URL
        fromService:
          name: api
          type: web
          property: host
      - key: MONGODB_URI
        scope: runtime
        value: mongodb+srv://user:pass@cluster.mongodb.net/dbname

  - type: pserv
    name: queue-service
    runtime: node
    buildCommand: npm ci && npm run build
    startCommand: npm start
    envVars:
      - key: REDIS_PORT
        scope: runtime
        value: 6379
```

### Internal URL Format

When using `fromService`, Render injects URLs in this format:

```
http://[service-name].onrender.com
```

Example in your Node.js code:

```javascript
// For public web services
const apiUrl = process.env.API_URL; // https://api.onrender.com
const response = await fetch(`${apiUrl}/graphql`);

// For private services (pserv)
const internalApiUrl = process.env.INTERNAL_API_URL; // http://internal-api.onrender.com
const internalResponse = await fetch(`${internalApiUrl}/admin/data`);
```

### DNS Resolution

Services can also be discovered via Render's internal DNS:

```javascript
// Direct DNS lookup (alternative to environment variables)
const response = await fetch('http://api.onrender.com/graphql');
```

This works for both public and private services within the same workspace.

### Important Notes

- **Private services (pserv):** Only accessible from other services in the same workspace, not from the public internet
- **Cross-workspace access:** Services in different Render workspaces cannot communicate via internal network
- **Startup order:** Render doesn't enforce service startup order; configure retry logic in your services
- **Network isolation:** External services (MongoDB Atlas, Redis) must be accessible from Render (IP allowlisting if needed)

---

## Custom Domains

### Adding a Custom Domain

Render supports custom domains for web and static services.

**Via Dashboard:**
1. Navigate to your service
2. Settings → Custom Domain
3. Enter your domain (e.g., `api.example.com`)
4. Follow DNS configuration instructions

**DNS Configuration:**

For `api.example.com`, create a CNAME record pointing to Render:

```
Name:   api
Type:   CNAME
Value:  api.onrender.com
TTL:    3600
```

Or use an A record if CNAME isn't available:

```
Name:   api
Type:   A
Value:  [IP provided by Render]
TTL:    3600
```

### Multiple Custom Domains

A single service can have multiple custom domains:

```yaml
services:
  - type: web
    name: api
    customDomains:
      - api.example.com
      - api.myapp.io
      - graphql.example.com
```

### SSL Certificates

Render automatically provisions and renews SSL/TLS certificates:

- **Provider:** Let's Encrypt
- **Renewal:** Automatic before expiration
- **Coverage:** Includes main domain and www subdomain if applicable
- **Cost:** Included, no extra charge

HTTPS is mandatory for all public services; HTTP requests are automatically redirected.

### Apex Domain Configuration

For apex domains (e.g., `example.com` without `www`), use an A record or ALIAS record (if supported by your DNS provider):

```
Name:   @
Type:   A
Value:  [IP provided by Render]
TTL:    3600
```

Some registrars also support ALIAS records (similar to CNAME for apex):

```
Name:   @
Type:   ALIAS
Value:  api.onrender.com
TTL:    3600
```

### Testing Domain Resolution

Verify DNS propagation before relying on custom domains:

```bash
# Check DNS resolution
nslookup api.example.com

# Test HTTPS connectivity
curl -v https://api.example.com/health
```

---

## Scaling

### Horizontal Scaling (Multiple Instances)

Paid plans support running multiple instances of the same service for load distribution and high availability.

**Configuration in render.yaml:**

```yaml
services:
  - type: web
    name: api
    numInstances: 3  # Run 3 instances
```

**How it works:**
- Render deploys and manages three independent copies of your service
- Traffic is load-balanced across all instances
- If one instance crashes, the others continue serving requests
- Health checks ensure failed instances are replaced

### Auto-Scaling

For services with variable traffic patterns, enable auto-scaling (available on paid plans):

```yaml
services:
  - type: web
    name: api
    numInstances: 2
    autoscaling:
      enabled: true
      minInstances: 2
      maxInstances: 10
      cpuThresholdPercent: 70
      memoryThresholdPercent: 80
```

Auto-scaling monitors CPU and memory usage and adjusts the number of instances based on thresholds.

### Load Balancing

Render's built-in load balancer distributes traffic round-robin style across instances:

```
Request → Load Balancer → Instance 1
                       → Instance 2
                       → Instance 3
```

### Database Connection Pooling

When running multiple instances, each instance maintains its own database connections. Use connection pooling to avoid exhausting database connection limits:

**Mongoose with connection pooling:**

```javascript
const mongoUri = process.env.MONGODB_URI;
const connection = mongoose.connect(mongoUri, {
  maxPoolSize: 5,        // Connections per instance
  minPoolSize: 2,
  maxIdleTimeMS: 45000
});
```

**Total connections** = `maxPoolSize * numInstances`

For 3 instances with maxPoolSize=5: 15 total connections to MongoDB.

### Resource Limits

Render services have default resource limits based on plan:

- **Starter Plan:** 0.5 CPU, 512 MB RAM per instance
- **Pro Plan:** 1 CPU, 1 GB RAM per instance (scalable)

Monitor resource usage in the Render dashboard and upgrade if needed.

---

## Persistent Disks

Persistent disks attach persistent storage to a service. Data survives redeploys and service restarts.

### When to Use Persistent Disks

For MERN + GraphQL + TypeScript stacks:

- **Usually not needed:** MongoDB Atlas handles data storage externally
- **May be needed for:**
  - File uploads (temporary storage before uploading to S3)
  - Local caching layers
  - Temporary work directories

### When NOT to Use Persistent Disks

- Never for the main database (use MongoDB Atlas instead)
- Avoid for high-I/O operations (use dedicated services or external storage)
- Not suitable for sharing data between multiple service instances

### Persistent Disk Configuration

```yaml
services:
  - type: web
    name: api
    disk:
      name: uploads
      mountPath: /var/uploads
      sizeGB: 10  # 10 GB persistent storage
```

### Accessing the Disk

The disk is available as a mounted directory in your service:

```javascript
const fs = require('fs');
const path = require('path');

// Write to persistent disk
const uploadDir = '/var/uploads';
fs.writeFileSync(path.join(uploadDir, 'file.txt'), 'content');

// Read from persistent disk
const content = fs.readFileSync(path.join(uploadDir, 'file.txt'), 'utf-8');
```

### Important Considerations

- **Not replicated across instances:** Each instance gets its own disk if `numInstances > 1`
- **Size limits:** Plan-dependent maximum disk size
- **Cost:** Extra charge per GB per month
- **Backup:** Not automatically backed up; implement your own backup strategy

---

## Environment Variable Management

### Setting Environment Variables

Environment variables can be set in render.yaml or via the Render dashboard.

**In render.yaml (recommended):**

```yaml
services:
  - type: web
    name: api
    envVars:
      - key: NODE_ENV
        scope: runtime
        value: production
      - key: LOG_LEVEL
        scope: runtime
        value: info
      - key: DATABASE_URL
        scope: secret
        value: mongodb+srv://...
```

**Via Render Dashboard:**
1. Service Settings → Environment
2. Add or edit variables
3. Changes trigger an automatic redeploy

### Scopes

Environment variables support different scopes:

- **runtime:** Available at runtime (visible in logs and dashboard)
- **secret:** Sensitive data (hidden in dashboard, masked in logs)
- **build:** Only available during build phase

### Secrets Best Practices

Use `scope: secret` for sensitive data:

```yaml
envVars:
  - key: DATABASE_PASSWORD
    scope: secret
    value: your-secret-password
  - key: API_KEY
    scope: secret
    value: sk-...
  - key: JWT_SECRET
    scope: secret
    value: your-jwt-secret
```

Secrets are never displayed in logs or the dashboard UI.

### Updating Variables

**Important:** Updating environment variables triggers an automatic redeploy of affected services.

```yaml
# Change this
- key: LOG_LEVEL
  scope: runtime
  value: debug  # Changed from 'info'

# Automatic redeploy happens immediately
```

### Accessing Variables in Code

```javascript
// Node.js
const dbUrl = process.env.DATABASE_URL;
const apiKey = process.env.API_KEY;
const nodeEnv = process.env.NODE_ENV;

if (!dbUrl) {
  throw new Error('DATABASE_URL environment variable is required');
}
```

### Environment-Specific Configuration

Use different variable values for different environments (if using multiple Render services or preview environments):

```yaml
services:
  - type: web
    name: api-prod
    envVars:
      - key: NODE_ENV
        scope: runtime
        value: production
      - key: DATABASE_URL
        scope: secret
        value: mongodb+srv://prod-cluster...

  - type: web
    name: api-staging
    envVars:
      - key: NODE_ENV
        scope: runtime
        value: staging
      - key: DATABASE_URL
        scope: secret
        value: mongodb+srv://staging-cluster...
```

---

## Deploy Hooks

Deploy hooks are webhook URLs that trigger deployments from external systems like CI/CD pipelines.

### Creating a Deploy Hook

**Via Render Dashboard:**
1. Service Settings → Deploy Hook
2. Generate URL (e.g., `https://api.render.com/deploy/srv-abc123`)
3. Copy the URL

### Using Deploy Hooks with CI/CD

**GitHub Actions example:**

```yaml
name: Deploy to Render

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Run tests
        run: npm ci && npm test

      - name: Deploy to Render
        if: success()
        run: |
          curl -X POST ${{ secrets.RENDER_DEPLOY_HOOK }}
```

**GitLab CI example:**

```yaml
deploy:
  stage: deploy
  script:
    - npm ci
    - npm test
    - curl -X POST $RENDER_DEPLOY_HOOK
  only:
    - main
```

**Manual trigger from your application:**

```javascript
// Trigger deploy from Node.js
const deployHook = process.env.RENDER_DEPLOY_HOOK;

app.post('/admin/deploy', async (req, res) => {
  try {
    await fetch(deployHook, { method: 'POST' });
    res.json({ message: 'Deploy triggered' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Security Considerations

- Treat deploy hook URLs as secrets (store in GitHub Secrets, GitLab CI/CD variables)
- Don't commit webhook URLs to version control
- Use environment variables to pass hooks to your code

---

## Preview Environments

Preview environments are temporary, isolated deployments created automatically for pull requests or branches.

### Static Site Preview Environments

For static services (React frontends), Render automatically creates previews for pull requests:

```yaml
services:
  - type: static
    name: frontend
    buildCommand: npm ci && npm run build
    publishPath: ./dist
    previewBranchDeploys: true
    previewBranchPrefix: pr-
```

**How it works:**
1. Create a pull request
2. Render automatically builds and deploys the PR branch
3. Get a temporary URL (e.g., `pr-123-frontend.onrender.com`)
4. URL is valid until the PR is closed or merged

### Branch Deployments

Deploy different branches to separate services:

```yaml
services:
  - type: web
    name: api-main
    repo: https://github.com/user/repo
    branch: main
    runtime: node

  - type: web
    name: api-staging
    repo: https://github.com/user/repo
    branch: staging
    runtime: node
```

### Preview Environment Features

- **Automatic creation:** Triggered by PR/branch events
- **Isolated:** Separate resources, databases, and state from production
- **Auto-cleanup:** Deleted when PR is merged or closed
- **Full environment:** Same runtime and configuration as production

### Important Notes for MERN Stacks

- Preview environments share the same MongoDB Atlas database by default
- Consider separate database for preview environments to avoid data pollution
- Use environment variables to route preview traffic to separate services

**Recommended setup:**

```javascript
// In your Node.js code
const dbUrl = process.env.NODE_ENV === 'staging'
  ? process.env.STAGING_DATABASE_URL
  : process.env.DATABASE_URL;

mongoose.connect(dbUrl);
```

---

## Render Internal Network

### Overview

Render's internal network provides secure, private communication between services in the same workspace without exposing them to the public internet.

### How Services Find Each Other

All services in a workspace automatically have access to an internal DNS service:

```
[Service] → Internal DNS → [Other Service]
```

Services are accessible via:

```
http://[service-name].onrender.com  (internal network)
https://[service-name].onrender.com (public services only)
```

### Network Architecture

```
┌──────────────────────────────────────────────────┐
│          Render Workspace Network                │
├──────────────────────────────────────────────────┤
│                                                  │
│  API (web)              Queue (worker)           │
│  ├─ Public              ├─ Private               │
│  └─ HTTP:3000           └─ HTTP:3000             │
│      ↓                      ↑                    │
│      └──────── Internal DNS ──────┘              │
│                                                  │
│  Admin API (pserv)                               │
│  ├─ Private                                      │
│  └─ HTTP:3000                                    │
│                                                  │
│ ═════════════════════════════════════════        │
│          Render Workspace Boundary               │
│ ═════════════════════════════════════════        │
│                                                  │
│  External Services (Internet)                    │
│  ├─ MongoDB Atlas (IP allowlisting)              │
│  ├─ Redis Cloud                                  │
│  └─ Third-party APIs                            │
│                                                  │
└──────────────────────────────────────────────────┘
```

### Communication Patterns

**Public to Public (Web to External API):**

```javascript
// From web service to external API
const response = await fetch('https://api.example.com/data');
```

**Public to Private (Web to Internal Admin):**

```javascript
// From web service to private service
const adminUrl = process.env.ADMIN_API_URL; // http://admin-api.onrender.com
const response = await fetch(`${adminUrl}/stats`);
```

**Worker to Public (Background Job to API):**

```javascript
// From worker to public web service
const apiUrl = process.env.API_URL; // https://api.onrender.com
const response = await fetch(`${apiUrl}/webhooks/job-complete`, {
  method: 'POST',
  body: JSON.stringify(result)
});
```

**Worker to Private (Background Job to Private Service):**

```javascript
// From worker to private service
const internalUrl = process.env.INTERNAL_URL; // http://internal.onrender.com
const response = await fetch(`${internalUrl}/queue/acknowledge`, {
  method: 'POST'
});
```

### Security Features

- **Firewall:** Private services only accessible within the workspace
- **No Public IPs:** Private services don't have public endpoints
- **Encryption:** Internal network traffic is encrypted in transit
- **Network Isolation:** Services in different workspaces cannot communicate
- **No External Access:** External internet cannot reach private services

### Performance Considerations

- **Latency:** Internal network communication is typically sub-millisecond
- **Bandwidth:** Unlimited internal network bandwidth (same workspace)
- **No Rate Limiting:** Internal API calls don't count against rate limits

### Monitoring Network Communication

Check Render logs for service-to-service communication:

```bash
# View logs from API service calling another service
# Dashboard → Service → Logs

# Look for HTTP request logs
[2024-03-15T10:30:45.123Z] POST http://queue-processor.onrender.com/jobs
[2024-03-15T10:30:45.456Z] Response: 200 OK
```

### Troubleshooting Network Issues

**Service discovery fails:**
- Verify service names match in environment variable configuration
- Check that both services are running and healthy
- Services are case-sensitive

**Connection refused:**
- Ensure target service is healthy (check logs)
- Verify correct port number in URL
- For private services, ensure they're in the same workspace

**Timeout errors:**
- Check network connectivity from source to target service
- Verify target service is responding (test with curl from logs)
- Consider increasing timeout values in your code

---

## Typical MERN + GraphQL Deployment Checklist

After deploying your services, verify:

- [ ] Frontend static service is loading correctly
- [ ] API service is accessible at custom domain
- [ ] Apollo Server GraphQL endpoint responds to queries
- [ ] Environment variables are set (check in dashboard)
- [ ] MongoDB Atlas connection is working (check logs)
- [ ] Worker service can communicate with API
- [ ] Cron jobs are scheduled and running
- [ ] Custom domain DNS is configured
- [ ] HTTPS is active and certificate is valid
- [ ] Service-to-service communication is working
- [ ] Logs are being captured and visible
- [ ] Auto-redeploy on push is enabled (if desired)

---

## Useful Commands and Resources

**Check service status:**
```bash
# Via Render CLI (if installed)
render services list
render logs [service-name]
```

**Monitor health:**
- Dashboard → Service → Metrics (CPU, memory, requests)
- Dashboard → Service → Logs (real-time output)

**Trigger deploy:**
```bash
# Via deploy hook
curl -X POST $RENDER_DEPLOY_HOOK

# Or push to connected branch
git push origin main
```
