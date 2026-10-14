# syntax=docker/dockerfile:1
# ---- Dependencies (cached unless package.json / bun.lock change) ----
FROM oven/bun:1 AS deps
WORKDIR /usr/src/app

COPY package.json bun.lock ./
# bun applies package.json patchedDependencies (patches/) during install
COPY patches ./patches
RUN bun install --frozen-lockfile

# ---- Build & serve ----
# `vite preview` loads vite.config.ts (incl. the vite-envs plugin, which rewrites
# src/vite-env.d.ts), so the runtime image keeps the sources and node_modules.
FROM oven/bun:1 AS app
WORKDIR /usr/src/app

ENV TZ=Europe/Amsterdam

COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY . .
# Sentry release + source map upload (CI build args/secret; all optional, a local build just skips the upload)
ARG GIT_SHA
ARG SENTRY_ORG
ARG SENTRY_PROJECT
ENV GIT_SHA=${GIT_SHA}
RUN --mount=type=secret,id=sentry_auth_token,env=SENTRY_AUTH_TOKEN \
    SENTRY_ORG=${SENTRY_ORG} SENTRY_PROJECT=${SENTRY_PROJECT} bun run build

EXPOSE 80
# Inject runtime environment variables into dist/, then serve it on port 80
ENTRYPOINT ["sh", "-c", "./dist/vite-envs.sh && exec bun run preview"]
