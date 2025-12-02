# Kuaforun app Dockerfile
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache curl && npm i -g pnpm

# Copy monorepo files and install only backend deps
COPY package.json pnpm-lock.yaml ./
COPY apps/kuaforun-backend/package.json apps/kuaforun-backend/pnpm-lock.yaml /app/apps/kuaforun-backend/
RUN cd apps/kuaforun-backend && pnpm install --frozen-lockfile

# Copy sources
COPY . .

FROM base AS build
WORKDIR /app/apps/kuaforun-backend
RUN pnpm run build

FROM node:20-alpine AS runtime
WORKDIR /app
RUN npm i -g pnpm && apk add --no-cache curl
COPY --from=build /app/apps/kuaforun-backend/dist /app/dist
COPY --from=base /app/apps/kuaforun-backend/node_modules /app/node_modules
COPY apps/kuaforun-backend/package.json /app/package.json
EXPOSE 4000
CMD ["node", "dist/server.js"]
