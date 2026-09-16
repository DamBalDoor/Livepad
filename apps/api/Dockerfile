# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.15.1 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter @livepad/api...

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
RUN pnpm --filter @livepad/api build

FROM base AS migrate
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY packages/shared ./packages/shared
COPY apps/api/drizzle.config.ts apps/api/drizzle.config.ts
COPY apps/api/package.json apps/api/package.json
COPY apps/api/src/db ./apps/api/src/db
WORKDIR /app/apps/api
ENTRYPOINT ["pnpm", "exec", "drizzle-kit", "push", "--force"]

FROM base AS prod-deploy
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared ./packages/shared
COPY --from=build /app/apps/api/dist ./apps/api/dist
RUN pnpm deploy --filter @livepad/api --prod --legacy /prod/api

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=prod-deploy /prod/api/dist ./dist
COPY --from=prod-deploy /prod/api/node_modules ./node_modules
COPY --from=prod-deploy /prod/api/package.json ./package.json
EXPOSE 3001 1234
CMD ["node", "dist/index.js"]
