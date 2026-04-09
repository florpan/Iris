# ── Build stage: frontend ──────────────────────────────────
FROM oven/bun:1 AS frontend-build
WORKDIR /app

# Install frontend deps
COPY src/frontend/package.json src/frontend/bun.lock* src/frontend/
RUN cd src/frontend && bun install --frozen-lockfile

# Copy frontend source + build
COPY src/frontend/ src/frontend/
RUN cd src/frontend && bun run build

# ── Build stage: backend deps ─────────────────────────────
FROM oven/bun:1 AS backend-deps
WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production

# ── Runtime ───────────────────────────────────────────────
FROM oven/bun:1 AS runtime
WORKDIR /app

# Copy backend deps
COPY --from=backend-deps /app/node_modules ./node_modules
COPY package.json ./

# Copy backend source
COPY src/backend/ src/backend/
COPY drizzle.config.ts ./
COPY drizzle/ drizzle/

# Copy built frontend
COPY --from=frontend-build /app/dist/public ./dist/public

# Default env
ENV PORT=3000
ENV PUBLIC_DIR=./dist/public
ENV NODE_ENV=production

EXPOSE 3000

CMD ["bun", "run", "src/backend/index.ts"]
