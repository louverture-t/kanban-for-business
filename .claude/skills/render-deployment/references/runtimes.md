# Render Runtime Options

## Node.js Runtime

### Default Behavior (`node` runtime)

The `node` runtime is the standard choice for Node.js applications and is almost always correct for MERN + GraphQL + TypeScript stacks.

**How it works:**
- Render auto-detects the Node version from your project configuration
- Checks `engines.node` field in `package.json` first
- Falls back to `.node-version` file if present
- If neither exists, uses Render's default Node version (typically the latest LTS)

**Recommended configuration in package.json:**

```json
{
  "engines": {
    "node": "20.x"
  }
}
```

**Package manager support:**
- npm (default)
- yarn
- pnpm

Render auto-detects which package manager to use based on lock files present in your repo (package-lock.json, yarn.lock, pnpm-lock.yaml).

### Node Version Pinning Best Practices

For production deployments, specify an exact or minor version:

```json
{
  "engines": {
    "node": "20.11.1"
  }
}
```

Or use major.minor versioning for more flexibility:

```json
{
  "engines": {
    "node": "20.x"
  }
}
```

**Why pinning matters:**
- Ensures consistency between local development and production
- Prevents unexpected breaking changes from major version upgrades
- Aligns with your testing and CI/CD pipeline

## Docker Runtime

Use the `docker` runtime when you need custom build environments or special dependencies.

**When to use Docker for MERN + GraphQL + TypeScript:**
- Custom native dependencies (libpq, ImageMagick, etc.) not available in standard Node image
- Multi-stage builds for optimized production images
- Custom build scripts beyond npm/yarn install and build

**Requirements:**
- Must have a `Dockerfile` in your repository root (or specify `rootDir` in render.yaml)
- Build process must result in a runnable application

**Typical multi-stage Dockerfile pattern:**

```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runtime stage
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

**Note:** For most MERN stacks, the default `node` runtime is simpler and faster. Use Docker only when you have specific custom requirements.

## Image Runtime

The `image` runtime uses a pre-built Docker image from a container registry.

**Configuration required:**
- `runtime: image` in render.yaml
- `image.url` pointing to your image (Docker Hub, ECR, GCR, etc.)

**When to use:**
- Already have a container image in a registry
- Complex build pipelines managed separately from Render
- Sharing images across multiple services

**Example render.yaml:**

```yaml
services:
  - type: web
    name: api
    runtime: image
    image:
      url: your-registry/your-image:latest
```

## Build Cache Behavior

Render maintains a build cache between deployments:

- `node_modules` directory is cached to speed up subsequent installs
- Cache is automatically invalidated when `package-lock.json` or `yarn.lock` changes
- Typically saves 30-60 seconds per deploy after the first build

**Cache invalidation triggers:**
- Changes to dependency lock files
- Manual cache clear via Render dashboard
- Changes to Node version or runtime configuration

## Recommendation for MERN + GraphQL + TypeScript

**Use the `node` runtime in almost all cases:**

✓ Simpler setup with no Dockerfile needed
✓ Faster deployments with native Render build system
✓ Automatic package manager detection
✓ Built-in build caching
✓ Easy Node version management via engines field

**Switch to Docker only if you need:**
- Custom native libraries
- Multi-stage build optimization for bundle size
- Integration with external build systems
