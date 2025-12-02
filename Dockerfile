# Kuaforun app Dockerfile
FROM node:20-alpine

WORKDIR /app

# Install PNPM and curl for healthchecks
RUN apk add --no-cache curl && npm i -g pnpm tsx

# Install root dependencies for shared modules (dotenv, drizzle-orm, etc.)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# Install backend-specific dependencies (zod v4, @hono/*, pino, etc.)
COPY apps/kuaforun-backend/package.json apps/kuaforun-backend/pnpm-lock.yaml /app/apps/kuaforun-backend/
RUN cd apps/kuaforun-backend && pnpm install --frozen-lockfile --prod

# Copy monorepo sources
COPY . .

EXPOSE 4000

# Run backend from monorepo root context
# When build context is repository root, entry file resides under apps/kuaforun-backend
## IMPORTANT: Re-install backend deps after full source copy to ensure pnpm creates
## container-relative symlinks (avoids broken Windows absolute paths inside Linux image)
RUN cd apps/kuaforun-backend \
  && rm -rf node_modules \
  && pnpm install --frozen-lockfile --prod

CMD ["npx", "tsx", "apps/kuaforun-backend/src/server.ts"]