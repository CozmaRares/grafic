# syntax=docker/dockerfile:1.7
FROM ghcr.io/pnpm/pnpm:11 AS base
RUN pnpm runtime set node 22 -g
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN --mount=type=secret,id=env,target=/app/.env pnpm build

FROM base AS runner
WORKDIR /app
COPY --from=build /app/.output/server ./server
COPY --from=build /app/.output/public ./public
CMD ["node", "server/index.mjs"]
