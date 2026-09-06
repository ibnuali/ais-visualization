# syntax=docker/dockerfile:1

FROM oven/bun:1.3.14 AS base
WORKDIR /app

FROM base AS dependencies
COPY package.json bun.lock turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/api-client/package.json packages/api-client/package.json
RUN bun install --frozen-lockfile

FROM dependencies AS web-build
COPY apps/web apps/web
COPY packages/api-client packages/api-client
RUN bun run --filter @ais-anomaly/web build

FROM base AS production-dependencies
COPY package.json bun.lock turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/api-client/package.json packages/api-client/package.json
RUN bun install --frozen-lockfile --production

FROM oven/bun:1.3.14 AS api
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY apps/api ./apps/api
USER bun
EXPOSE 3000
CMD ["bun", "apps/api/index.ts"]

FROM nginx:1.27-alpine AS web
COPY --from=web-build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
