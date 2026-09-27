# ---- Dependencies (cached unless package.json / bun.lock change) ----
FROM oven/bun:1 AS deps
WORKDIR /usr/src/app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ---- Build & serve ----
# `vite preview` loads vite.config.ts (incl. the vite-envs plugin, which rewrites
# src/vite-env.d.ts), so the runtime image keeps the sources and node_modules.
FROM oven/bun:1 AS app
WORKDIR /usr/src/app

ENV TZ=Europe/Amsterdam

COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY . .
RUN bun run build

EXPOSE 80
# Inject runtime environment variables into dist/, then serve it on port 80
ENTRYPOINT ["sh", "-c", "./dist/vite-envs.sh && exec bun run preview"]
