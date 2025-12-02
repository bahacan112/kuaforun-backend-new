# Kuaforun app Dockerfile
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache curl && npm i -g pnpm
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .

FROM base AS build
RUN pnpm run build

FROM node:20-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache curl
COPY --from=build /app/dist /app/dist
COPY --from=base /app/node_modules /app/node_modules
COPY package.json /app/package.json
EXPOSE 4000
CMD ["node", "dist/server.js"]
