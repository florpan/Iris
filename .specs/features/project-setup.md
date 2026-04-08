---
id: project-setup
title: Project Setup & Configuration
status: complete
milestone: foundation
priority: high
handoff: single
---

## Overview

Initialize the Iris project with Vite + React 19 + Tailwind CSS + shadcn/ui frontend and Bun + Hono + Drizzle ORM backend. Single-user application — no authentication or role system. The app serves the built frontend and API from one Hono server.
There is a design file at docs/design.md that specifies how the gui should look. Use that to create suitable tailwind themes

## Requirements

- Vite + React 19 + TypeScript frontend
- Tailwind CSS with the design system from `docs/Design.md` (DM Sans, Outfit, Poppins, Roboto fonts, color palette, light/dark mode)
- shadcn/ui components
- Bun + Hono backend serving API routes and static frontend
- PostgreSQL via Drizzle ORM
- Docker Compose for local development (Postgres)
- Environment configuration via `.env` file (DATABASE_URL, port, etc.)

## Acceptance Criteria

- [x] `bun run dev` starts both frontend (Vite) and backend (Hono)
- [x] Frontend loads with design system applied (fonts, colors, light/dark toggle)
- [x] Database connection established via Drizzle
- [x] Health check endpoint responds at `/api/health`
- [x] Docker Compose brings up Postgres

## Tasks

- [x] Initialize Vite + React 19 + TypeScript project | frontend
- [x] Configure Tailwind with design system tokens from Design.md | frontend
- [x] Set up shadcn/ui with custom theme | frontend
- [x] Add light/dark mode toggle | frontend
- [x] Set up Hono server with static file serving | backend
- [x] Configure Drizzle ORM with PostgreSQL | backend
- [x] Create Docker Compose for Postgres | infrastructure
- [x] Create app shell with sidebar navigation | frontend
- [x] Implement themes based on the design-spec in /docs
