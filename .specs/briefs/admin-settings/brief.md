# Implementation Brief: Admin Settings Page

> **Implement this feature using the Waymark workflow.** Read `.specs/agents.md` for the full process. You MUST: update the spec status to `in-progress`, mark tasks `[x]` as you complete them, verify acceptance criteria, write an implementation summary to `.specs/briefs/admin-settings/implementation-summary.md`, and update status to `complete` when done.

## What to Build
A settings page at `/settings` in the frontend, providing a tabbed layout that downstream features can add panels to. Includes a navigation entry point in the app shell sidebar. Acts as a pure frontend shell — no backend required. The first two consumers are semantic-image-search (embedding management panel) and facial-recognition (face detection config + privacy controls panel).

## Requirements
- Route `/settings` added to the React Router config
- Sidebar navigation includes a "Settings" link (gear icon) pointing to `/settings`
- Page uses a tabbed layout (shadcn/ui Tabs) with a "General" tab as the default placeholder
- General tab shows basic read-only app info (app name, version from `/api/health`, work folder path from `/api/config`)
- Tab slots for "Embeddings" and "Face Detection" are defined as named sections so downstream features can add their panels without modifying this feature's core layout
- Active tab persists in the URL hash (e.g. `/settings#embeddings`) for deep-linking

## Technical Design
New page component `src/frontend/src/pages/SettingsPage.tsx` using shadcn/ui `Tabs`. Each tab is a named slot — downstream features implement and register their own tab panel components.

Route added to `App.tsx`. Sidebar link added to the navigation section in `AppShell.tsx` using a `Settings` lucide icon.

No new API routes required. General tab fetches from existing `/api/health` and `/api/config`.

## Acceptance Criteria
Defined in `.specs/features/admin-settings.md` § Acceptance Criteria. Mark them `[x]` in the spec file as you verify them.

## Tasks
Defined in `.specs/features/admin-settings.md` § Tasks. Mark each `[x]` in the spec file immediately after completing it.

## Context
- This feature blocks:
  - Semantic Image Search (semantic-image-search) — ready
  - Facial Recognition (facial-recognition) — ready

## Constraints
### DO NOT implement (planned features — out of scope)
- Semantic Image Search (semantic-image-search)
- Ollama Client (ollama-client)
- Facial Recognition (facial-recognition)
