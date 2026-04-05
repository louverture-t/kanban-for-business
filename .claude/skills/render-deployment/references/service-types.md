# Render Service Types

## Service Type Overview

Render offers five service types, each designed for different workload patterns. This guide covers how to use each type in a MERN + GraphQL + TypeScript stack.

---

## Web Service

**Purpose:** HTTP services with public endpoints

### Use Cases for MERN Stack
- Express + Apollo Server backend API
- Any service that needs to accept HTTP requests
- REST APIs, GraphQL endpoints, webhooks

### Key Characteristics
- **Public URL:** Automatically gets a `.onrender.com` domain
- **Port Binding:** Must bind to `0.0.0.0:$PORT` (Render injects PORT via environment variable)
- **Health Checks:** Render monitors health at `/health` or root path
- **SSL:** Automatic HTTPS with free SSL certificates
- **Auto-scaling:** Available on paid plans

### Configuration Example

```yaml
services:
  - type: web
    name: api
    runtime: node
    buildCommand: npm ci && npm run build
    startCommand: npm start
    envVars:
      - key: PORT
        scope: runtime
        value: 3000
```

### Binding to the PORT Variable

```javascript
// Express + Apollo Server example
const port = process.env.PORT || 3000;
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});
```

---

## Static Service

**Purpose:** Static site hosting via Render CDN

### Use Cases for MERN Stack
- React 18 + Vite frontend
- Pre-built SPA distributions
- Documentation sites

### Key Characteristics
- **No Server Process:** Pure static file serving
- **CDN:** Content served from edge locations globally
- **Build Output:** Publishes contents of `dist/` directory (or configured build directory)
- **SPA Rewrite:** Needs configuration to handle client-side routing

### SPA Rewrite Rules

React Router and similar client-side routers require fallback to index.html:

**render.yaml:**

```yaml
services:
  - type: static
    name: frontend
    buildCommand: npm ci && npm run build
    publishPath: ./dist
    routes:
      - path: /*
        destination: /index.html
        status: 200
```

This tells Render to serve `index.html` for all routes not matching actual files, allowing React Router to handle routing.

### Custom Domain Support
- Static services support custom domains
- Auto-provisioned SSL certificates
- Domain configuration via Render dashboard

### Zero Cold Starts
- No initialization delay like serverless
- Files cached at edge globally

---

## Worker Service

**Purpose:** Background job processing without public HTTP access

### Use Cases for MERN Stack
- Queue consumers (Bull, BullMQ with Redis)
- Data processing pipelines
- Email sending workers
- Microservices internal to your infrastructure

### Key Characteristics
- **No Public URL:** Only accessible within Render's private network
- **Private Network:** Can communicate with other services via service discovery
- **Environment Variables:** Shared with other services in the same workspace
- **No Health Checks:** Runs as long as process is alive

### Configuration Example

```yaml
services:
  - type: worker
    name: queue-processor
    runtime: node
    buildCommand: npm ci && npm run build
    startCommand: npm run worker
    envVars:
      - key: REDIS_URL
        fromService:
          name: redis
          type: pserv
          property: connectionString
```

### Service Discovery
Workers discover other services via environment variables or Render's internal DNS:

```javascript
// Internal service URL pattern
const apiUrl = process.env.INTERNAL_API_URL || 'http://api.onrender.com';
```

---

## Cron Service

**Purpose:** Scheduled task execution

### Use Cases for MERN Stack
- Database cleanup (old sessions, expired tokens)
- Report generation
- Periodic data synchronization
- Batch processing

### Key Characteristics
- **Scheduled Execution:** Runs on cron schedule, then stops
- **No Persistent Process:** Not running 24/7
- **Exit Code Monitoring:** Render tracks success/failure
- **No Public URL:** Background task only

### Configuration Example

```yaml
services:
  - type: cron
    name: cleanup-job
    runtime: node
    buildCommand: npm ci && npm run build
    startCommand: npm run cleanup
    schedule: "0 2 * * *"  # Daily at 2 AM UTC
```

### Schedule Format
Uses standard cron syntax:

```
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of week (0 - 6) (Sunday to Saturday)
│ │ │ │ │
│ │ │ │ │
* * * * *
```

**Common examples:**
- `0 2 * * *` - Daily at 2:00 AM UTC
- `0 */6 * * *` - Every 6 hours
- `30 23 * * 0` - Every Sunday at 11:30 PM UTC

### Environment Variables
Cron jobs have access to the same environment variables as other services for database access, API credentials, etc.

---

## Private Service (pserv)

**Purpose:** Internal microservices only accessible within your Render workspace

### Use Cases for MERN Stack
- Internal APIs not exposed to public
- Microservices architecture
- Admin dashboards
- Internal data processing APIs

### Key Characteristics
- **No Public URL:** Only accessible from other Render services in the same workspace
- **Private Network:** Internal communication only
- **Environment Variable Linking:** Services reference each other via fromService
- **Same Runtime Support:** Can use node, docker, or image runtimes

### Configuration Example

```yaml
services:
  - type: pserv
    name: internal-api
    runtime: node
    buildCommand: npm ci && npm run build
    startCommand: npm start
    envVars:
      - key: PORT
        scope: runtime
        value: 3000
```

### Service Discovery from Other Services

From a public web service, access a private service:

```yaml
services:
  - type: web
    name: api
    envVars:
      - key: INTERNAL_API_URL
        fromService:
          name: internal-api
          type: pserv
          property: host
```

In your code:

```javascript
const internalApiUrl = process.env.INTERNAL_API_URL;
// Use for internal service calls
fetch(`${internalApiUrl}/admin/stats`)
```

---

## Decision Matrix

| Use Case | Service Type | Reason |
|----------|--------------|--------|
| Express + Apollo Server API | **web** | Needs HTTP endpoint, public access |
| React 18 + Vite frontend | **static** | Pre-built assets, no server process needed |
| BullMQ queue consumer | **worker** | Background processing, no public endpoint |
| Daily database cleanup | **cron** | Scheduled task, runs then stops |
| Internal admin API | **pserv** | Only needs internal access, not public |
| Webhook receiver | **web** | Needs public HTTP endpoint |
| Email sending service | **worker** | Background job, triggered via queue |
| Periodic report generation | **cron** | Runs on schedule, no 24/7 uptime needed |
| Microservice for auth | **pserv** | Internal-only, shared by multiple services |
| Static documentation | **static** | Pure HTML/CSS/JS, no backend |

---

## Service Communication

### Web to Web (Public to Public)
Use the public .onrender.com URLs:

```javascript
const response = await fetch('https://api.onrender.com/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query })
});
```

### Web to Private Service (Public to Private)
Use internal service URL via environment variable:

```javascript
// In web service configuration
envVars:
  - key: INTERNAL_API_URL
    fromService:
      name: internal-api
      type: pserv
      property: host

// In code
const internalResponse = await fetch(`${process.env.INTERNAL_API_URL}/admin`);
```

### Worker or Cron to Database or Web Services
Workers and cron jobs have access to all environment variables:

```javascript
// Access MongoDB Atlas
const mongoUrl = process.env.MONGODB_URI;

// Call web services (publicly or internally)
const response = await fetch(process.env.API_URL);
```

---

## Typical MERN + GraphQL Architecture on Render

```
┌─────────────────────────────────────────┐
│         Render Workspace                │
├─────────────────────────────────────────┤
│                                         │
│  Frontend (static)                      │
│  ├─ React 18 + Vite                     │
│  └─ Served via CDN                      │
│                                         │
│  API (web)                              │
│  ├─ Express + Apollo Server v4          │
│  ├─ GraphQL endpoint: /graphql          │
│  └─ Public .onrender.com URL            │
│                                         │
│  Queue Processor (worker)               │
│  ├─ BullMQ consumer                     │
│  ├─ Processes background jobs           │
│  └─ Private (no public URL)             │
│                                         │
│  Cleanup Job (cron)                     │
│  ├─ Runs daily at 2 AM                  │
│  ├─ Cleans old sessions                 │
│  └─ Scheduled execution only            │
│                                         │
│  External Services                      │
│  ├─ MongoDB Atlas (managed DB)          │
│  ├─ Redis (for queues)                  │
│  └─ External APIs                       │
│                                         │
└─────────────────────────────────────────┘
```
