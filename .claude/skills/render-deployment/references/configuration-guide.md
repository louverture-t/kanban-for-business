# Render Deployment Configuration Guide
## MERN + GraphQL + TypeScript Stack (React 18/Vite, Express 4/Apollo Server v4/Mongoose v8, MongoDB Atlas, JWT Auth, OpenRouter AI)

---

## 1. Required Environment Variables for This Stack

### 1.1 Backend Environment Variables

| Variable | Required | Type | Purpose | Example / Notes |
|----------|----------|------|---------|-----------------|
| `MONGODB_URI` | Yes | String | MongoDB Atlas connection string | `mongodb+srv://user:password@cluster.mongodb.net/dbname?retryWrites=true&w=majority` |
| `JWT_SECRET` | Yes | String | Secret key for signing JWT tokens | Use `generateValue: true` in `render.yaml` for auto-generation |
| `NODE_ENV` | Yes | String | Deployment environment | Set to `"production"` in Render; use `"development"` locally |
| `PORT` | Yes (auto-injected) | Number | Express/Apollo server port | Render injects automatically; default to `4000` for local dev |
| `OPENROUTER_API_KEY` | Yes | String | OpenRouter API authentication key | Get from OpenRouter dashboard; keep sync: false |
| `CLIENT_URL` | Yes | String | React client's public URL for CORS | Example: `https://my-frontend-service.onrender.com` |

### 1.2 Frontend Environment Variables

| Variable | Required | Type | Purpose | Example / Notes |
|----------|----------|------|---------|-----------------|
| `VITE_API_URL` | Yes | String | API base URL exposed to React | **MUST** be prefixed with `VITE_` for Vite to expose it; example: `https://my-api-service.onrender.com` |
| `VITE_APP_NAME` | No | String | Application display name | Used in UI/window title |

### 1.3 Variable Synchronization in render.yaml

```yaml
# Backend service (Express/Apollo)
envVars:
  - key: MONGODB_URI
    sync: false  # User must provide; sensitive data
  - key: JWT_SECRET
    generateValue: true  # Auto-generate a secure secret
  - key: NODE_ENV
    value: production
  - key: OPENROUTER_API_KEY
    sync: false  # User must provide
  - key: CLIENT_URL
    fromService:
      type: static
      name: app-client        # Name of your static site service
      property: url

# Frontend service (React/Vite)
envVars:
  - key: VITE_API_URL
    fromService:
      type: web
      name: app-api            # Name of your web service
      property: url
```

---

## 2. MongoDB Atlas Connection Setup

### 2.1 Obtaining the Connection String

1. **Log in to MongoDB Atlas**: https://cloud.mongodb.com/
2. **Navigate to your cluster** → Click **"Connect"**
3. **Select "Drivers" tab** → Choose **Node.js** driver
4. **Copy the connection string** (format: `mongodb+srv://...`)
5. **Template**: `mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<dbname>?retryWrites=true&w=majority`

### 2.2 Required Placeholders to Replace

| Placeholder | How to Obtain | Example |
|-------------|---------------|---------|
| `<username>` | Database user created in Atlas | `my_db_user` |
| `<password>` | Password for that user (URL-encoded) | `MyP%40ssw0rd` (special chars encoded) |
| `<cluster>` | Cluster name from Atlas | `cluster-abc123.mongodb.net` |
| `<dbname>` | Your application database name | `mern_app_db` |

**Full Example**:
```
mongodb+srv://my_db_user:MyP%40ssw0rd@cluster-abc123.mongodb.net/mern_app_db?retryWrites=true&w=majority
```

### 2.3 IP Allowlisting Strategies

#### Option A: Allow Anywhere (0.0.0.0/0)
- **Use Case**: Development/testing; credentials are the main security layer
- **Steps**:
  1. In Atlas Dashboard → **Network Access**
  2. Click **"Add IP Address"**
  3. Enter `0.0.0.0/0` (allow all)
  4. Confirm
- **Risk**: Lower security; suitable for free/shared clusters only
- **Render Context**: Works on all Render plans

#### Option B: Render Static Outbound IPs (Recommended for Production)
- **Use Case**: Production deployments; restricts access to Render IPs only
- **Requirements**: **Paid Render plan** (static outbound IPs not available on free plan)
- **Steps**:
  1. In Render Dashboard → Settings → **Static Outbound IP**
  2. Copy the static IPs provided
  3. In Atlas Dashboard → **Network Access**
  4. Click **"Add IP Address"** for each Render IP
  5. Save
- **Benefit**: High security; only Render services can connect
- **Render Context**: Free-tier deployments use shared IPs; upgrade plan to get static IPs

### 2.4 Mongoose Connection Options for Production

Add these options to your Mongoose connection in `server.ts`:

```typescript
import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI!, {
      serverSelectionTimeoutMS: 10000,  // Fail fast if cluster unreachable
      maxPoolSize: 10,                   // Connection pool size
      minPoolSize: 2,                    // Min connections to maintain
      maxIdleTimeMS: 30000,              // Close idle connections after 30s
      retryWrites: true,                 // Retry on transient failures
    });
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection failed:', error);
    process.exit(1);
  }
};

export default connectDB;
```

---

## 3. Apollo Server v4 Production Configuration

### 3.1 Server Binding and Port

**Critical**: Apollo Server must bind to `0.0.0.0` and listen on `process.env.PORT`.

```typescript
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import express from 'express';

const app = express();
const port = process.env.PORT || 4000;

// Create Apollo Server
const server = new ApolloServer({
  typeDefs,
  resolvers,
  plugins: [
    {
      async serverWillStart() {
        console.log('Apollo Server starting...');
      },
    },
  ],
});

// Start server and apply middleware
await server.start();
app.use('/graphql', expressMiddleware(server, {
  context: async ({ req }) => {
    // Auth context here (JWT verification)
    return { req };
  },
}));

// Listen on all interfaces
app.listen({ port, host: '0.0.0.0' }, () => {
  console.log(`Server listening on port ${port}`);
});
```

### 3.2 CORS Configuration

```typescript
import cors from 'cors';

const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

app.use(cors({
  origin: clientUrl,
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
}));

// Or, inline in expressMiddleware context:
app.use('/graphql', expressMiddleware(server, {
  context: async ({ req, res }) => {
    res.setHeader('Access-Control-Allow-Origin', clientUrl);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    return { req };
  },
}));
```

### 3.3 Apollo Studio/Landing Page in Production

By default, Apollo Server v4 serves Apollo Studio on the GraphQL endpoint.

**Option 1: Disable for Production**
```typescript
const server = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: false,  // Disable introspection queries
  plugins: [
    {
      async serverWillStart() {
        // Disable landing page
      },
    },
  ],
});
```

**Option 2: Keep for Debugging (Not Recommended in Prod)**
```typescript
const server = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: process.env.NODE_ENV !== 'production',
});
```

### 3.4 Graceful Shutdown with HTTP Server

```typescript
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import http from 'http';

const app = express();
const httpServer = http.createServer(app);

const server = new ApolloServer({
  typeDefs,
  resolvers,
  plugins: [
    ApolloServerPluginDrainHttpServer({ httpServer }),
  ],
});

await server.start();
app.use('/graphql', expressMiddleware(server));

httpServer.listen({ port: process.env.PORT || 4000 }, () => {
  console.log(`Server ready at http://localhost:${process.env.PORT || 4000}/graphql`);
});

// Handle shutdown signals
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await server.stop();
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
```

### 3.5 Health Check Endpoint

```typescript
// Render checks the health of web services
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Or include in Apollo Server config
app.get('/health', (req, res) => {
  res.json({ alive: true });
});
```

---

## 4. Vite Build Configuration (Frontend)

### 4.1 VITE_ Prefix Requirement

Vite only exposes environment variables prefixed with `VITE_` to client-side code. Variables without the prefix are **not** available in the browser.

```typescript
// ✅ Correct: Accessible in browser
const apiUrl = import.meta.env.VITE_API_URL;

// ❌ Wrong: Undefined in browser
const apiUrl = import.meta.env.API_URL;
```

### 4.2 vite.config.ts Configuration

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,  // Disable for production
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
```

### 4.3 Environment Variable Usage in React

```typescript
// src/config/apiConfig.ts
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export const createApolloClient = () => {
  return new ApolloClient({
    link: createHttpLink({
      uri: `${API_URL}/graphql`,
      credentials: 'include',
    }),
    cache: new InMemoryCache(),
  });
};
```

### 4.4 Build Output

- Output directory: `dist/`
- Index file: `dist/index.html`
- Assets: `dist/assets/`

---

## 5. envVarGroups for Shared Configuration

Use `envVarGroups` in your `render.yaml` to share environment variables across multiple services:

```yaml
envVarGroups:
  - name: shared-db-config
    envVars:
      - key: MONGODB_URI
        sync: false

  - name: shared-api-config
    envVars:
      - key: JWT_SECRET
        generateValue: true
      - key: NODE_ENV
        value: production
      - key: OPENROUTER_API_KEY
        sync: false

services:
  - type: web
    name: api-service
    envVarGroups:
      - shared-db-config
      - shared-api-config

  - type: web
    name: client-service
    envVarGroups:
      - shared-api-config
```

---

## 6. Summary Checklist

- [ ] MongoDB Atlas connection string obtained and placeholders replaced
- [ ] IP allowlisting configured (Option A: 0.0.0.0/0 or Option B: Render static IPs)
- [ ] JWT_SECRET generated or set in render.yaml with `generateValue: true`
- [ ] Apollo Server binds to `0.0.0.0:$PORT`
- [ ] CORS configured with CLIENT_URL
- [ ] Health check endpoint available at `/health`
- [ ] VITE_API_URL prefixed correctly in frontend environment
- [ ] Vite build outputs to `dist/` directory
- [ ] Express/Mongoose connection options configured for production
- [ ] Graceful shutdown plugins added to Apollo Server
- [ ] envVarGroups set up for shared config across services
