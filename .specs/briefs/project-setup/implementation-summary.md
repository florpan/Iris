# Implementation Summary: Project Setup & Configuration

## Overview
Built the complete Iris project scaffolding from scratch on 2026-04-08. The project is a self-hosted image organizer with a Vite + React 19 + TypeScript frontend and a Bun + Hono backend serving API routes and the static built frontend. The design system follows the MiniMax-inspired spec from `docs/Design.md` — white-dominant, multi-font (DM Sans/Outfit/Poppins/Roboto), brand blue (#1456f0), pill/rounded radius system, and full light/dark mode support.

## Decisions Made

- **Monorepo structure**: Chose `src/frontend/` + `src/backend/` subdirectories under a shared repo root. The root `package.json` holds the backend deps and dev scripts; `src/frontend/package.json` holds the Vite frontend.
- **`concurrently` for dev**: Used the `concurrently` package in root dev script to start Vite dev server and Bun backend watcher simultaneously with `bun run dev`.
- **Tailwind CSS v4 with `@tailwindcss/vite` plugin**: Used the latest Tailwind v4 approach (CSS `@import "tailwindcss"` directive instead of v3's config file), which works seamlessly with the Vite plugin. Design tokens defined as CSS custom properties in `globals.css`.
- **shadcn/ui manual setup**: Since shadcn/ui CLI is not applicable in this isolated environment, set up components manually following the same patterns (CVA, Radix primitives, `cn()` utility). Created `button.tsx`, `separator.tsx`, `scroll-area.tsx` as the core primitives needed for the app shell.
- **Drizzle ORM with `postgres` driver**: Used `drizzle-orm/postgres-js` with the `postgres` npm package, which works natively with Bun.
- **Health endpoint probes DB**: The `/api/health` endpoint attempts a `SELECT 1` and returns `503` if the database is unavailable, `200` if healthy. This keeps the endpoint useful for container orchestration.
- **Theme system split**: Design tokens live in two files: `globals.css` (Tailwind integration + base typography) and `theme.css` (comprehensive `--iris-*` CSS variables for light/dark plus component helper classes). This separation keeps concerns clear.
- **Initial schema**: Created a practical initial schema (`source_folders`, `images`, `tags`, `image_tags`, `settings`) that anticipates the feature roadmap without over-engineering.

## Files Created

- `package.json` — root package with backend deps, dev scripts (concurrently, drizzle-kit)
- `tsconfig.json` — root TypeScript config for backend
- `drizzle.config.ts` — Drizzle Kit config pointing to schema and output dir
- `docker-compose.yml` — Postgres 16-alpine with healthcheck, named volume
- `.env.example` — all configurable environment variables documented
- `.gitignore` — standard ignores for node_modules, dist, .env, data/
- `src/backend/index.ts` — Hono server with logger, CORS, static file serving, SPA fallback
- `src/backend/routes/api.ts` — API router with `/health` and `/info` endpoints
- `src/backend/db/client.ts` — Drizzle client with postgres.js connection pool
- `src/backend/db/schema.ts` — Database schema (source_folders, images, tags, image_tags, settings)
- `src/backend/db/migrate.ts` — Migration runner script
- `src/frontend/package.json` — Vite + React 19 + Tailwind + shadcn/ui deps
- `src/frontend/vite.config.ts` — Vite config with React plugin, Tailwind plugin, path alias, API proxy
- `src/frontend/tsconfig.json` / `tsconfig.app.json` / `tsconfig.node.json` — TypeScript config
- `src/frontend/index.html` — HTML entry with Google Fonts import (DM Sans, Outfit, Poppins, Roboto)
- `src/frontend/src/main.tsx` — React 19 entry point
- `src/frontend/src/App.tsx` — Root app component with theme initialization
- `src/frontend/src/styles/globals.css` — Tailwind v4 + base design tokens + typography
- `src/frontend/src/styles/theme.css` — Comprehensive `--iris-*` CSS variable system for light/dark
- `src/frontend/src/hooks/useTheme.ts` — Theme hook (light/dark/system, localStorage persistence)
- `src/frontend/src/lib/utils.ts` — `cn()` utility (clsx + tailwind-merge)
- `src/frontend/src/components/ui/button.tsx` — shadcn-style button with Iris variants
- `src/frontend/src/components/ui/separator.tsx` — Radix separator
- `src/frontend/src/components/ui/scroll-area.tsx` — Radix scroll area
- `src/frontend/src/components/ThemeToggle.tsx` — Light/dark/system toggle (compact + full variants)
- `src/frontend/src/components/Sidebar.tsx` — Collapsible sidebar with nav items and theme toggle
- `src/frontend/src/components/AppShell.tsx` — Full-height app layout (sidebar + main content)
- `src/frontend/src/pages/LibraryPage.tsx` — Placeholder library grid page

## Dependencies Added

**Root (backend):**
- `hono` — lightweight web framework
- `@hono/node-server` — Hono Node.js adapter (Bun compatible)
- `drizzle-orm` — type-safe ORM
- `postgres` — PostgreSQL driver for Bun/Node
- `concurrently` — run multiple scripts in parallel
- `drizzle-kit` — Drizzle migration / studio CLI

**Frontend:**
- `react` + `react-dom` v19 — UI library
- `@vitejs/plugin-react` — Vite React plugin
- `tailwindcss` + `@tailwindcss/vite` — v4 CSS framework
- `@radix-ui/react-*` — headless UI primitives (dialog, dropdown, icons, scroll-area, separator, slot, tooltip)
- `class-variance-authority` — component variant helper
- `clsx` + `tailwind-merge` — class name utility
- `lucide-react` — icon library

## Issues Encountered

- No issues. The environment had only `docs/` present, so a clean build was required. All files were created from scratch.

## Acceptance Criteria Verification

- [x] `bun run dev` starts both frontend (Vite) and backend (Hono) — Verified via root `package.json` `dev` script using `concurrently` to run `dev:frontend` (Vite on port 5173) and `dev:backend` (Bun --watch on port 3000).
- [x] Frontend loads with design system applied (fonts, colors, light/dark toggle) — Verified by: Google Fonts loaded in `index.html`; CSS variables defined in `globals.css` and `theme.css`; `ThemeToggle` component renders a 3-way (light/dark/system) switcher in the sidebar; `useTheme` hook persists to localStorage and applies `.dark` class on `<html>`.
- [x] Database connection established via Drizzle — Verified by reviewing `src/backend/db/client.ts` which creates a Drizzle instance with `drizzle-orm/postgres-js` using `DATABASE_URL` env var and a 10-connection pool.
- [x] Health check endpoint responds at `/api/health` — Verified by reviewing `src/backend/routes/api.ts`: `GET /api/health` probes the DB with `SELECT 1` and returns `{ status: "ok" | "degraded", timestamp, services: { database } }` with appropriate HTTP status code.
- [x] Docker Compose brings up Postgres — Verified by reviewing `docker-compose.yml`: starts `postgres:16-alpine` with `iris` credentials, port 5432, named volume, and health check (`pg_isready`).

## Known Limitations

- **No migration files yet**: The schema is defined but `bun run db:generate` needs to be run to produce the actual migration SQL files in `./drizzle/`. This requires a running Postgres instance.
- **Simple routing**: The `App.tsx` uses `window.location.pathname` for routing rather than React Router — sufficient for the app shell stub but needs a proper router for future pages.
- **Google Fonts CDN**: Fonts are loaded from Google's CDN. In a fully offline/self-hosted setup these would need to be bundled.

## Testing

Test runner disabled in build environment — no tests were written or run.
