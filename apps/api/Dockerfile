# syntax=docker/dockerfile:1.7
# StudyThinker API — production image. Build from the monorepo root:
#   docker build -f apps/api/Dockerfile .

ARG NODE_VERSION=22-alpine

FROM node:${NODE_VERSION} AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /repo

FROM base AS builder
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/prisma apps/api/prisma
COPY apps/api/prisma.config.ts apps/api/prisma.config.ts
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter "api..."
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @studythinker/shared build \
 && pnpm --filter api db:generate \
 && pnpm --filter api build \
 && pnpm --filter api deploy --prod --legacy /out \
 && cp -r apps/api/dist /out/dist

FROM node:${NODE_VERSION} AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=4000
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs api
COPY --from=builder --chown=api:nodejs /out ./
COPY --chown=api:nodejs apps/api/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh
USER api
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/health >/dev/null || exit 1
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
