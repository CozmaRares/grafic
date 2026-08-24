# syntax=docker/dockerfile:1.7
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN --mount=type=secret,id=env,target=/app/.env pnpm build

FROM base AS runner
WORKDIR /app
COPY --from=build /app/.output/server ./server
COPY --from=build /app/.output/public ./public
CMD ["node", "server/index.mjs"]
