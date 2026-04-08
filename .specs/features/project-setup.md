---
id: project-setup
title: Project Setup & Configuration
status: pending
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

- [ ] `bun run dev` starts both frontend (Vite) and backend (Hono)
- [ ] Frontend loads with design system applied (fonts, colors, light/dark toggle)
- [ ] Database connection established via Drizzle
- [ ] Health check endpoint responds at `/api/health`
- [ ] Docker Compose brings up Postgres

## Tasks

- [ ] Initialize Vite + React 19 + TypeScript project | frontend
- [ ] Configure Tailwind with design system tokens from Design.md | frontend
- [ ] Set up shadcn/ui with custom theme | frontend
- [ ] Add light/dark mode toggle | frontend
- [ ] Set up Hono server with static file serving | backend
- [ ] Configure Drizzle ORM with PostgreSQL | backend
- [ ] Create Docker Compose for Postgres | infrastructure
- [ ] Create app shell with sidebar navigation | frontend
- [ ] Implement themes based on the design-spec in /docs
