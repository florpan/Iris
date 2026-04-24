---
id: admin-settings
title: Admin Settings Page
status: ready
milestone: smart
priority: high
handoff: single
---
## Overview

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

- [ ] Navigating to `/settings` renders the settings page without errors
- [ ] Sidebar contains a "Settings" link that navigates to `/settings`
- [ ] Page renders a tabbed layout with at least a "General" tab visible
- [ ] General tab displays app name, version, and work folder path sourced from the API
- [ ] Tab selection is reflected in the URL hash and survives a page refresh
- [ ] "Embeddings" and "Face Detection" tab slots are defined (can render as empty/placeholder until downstream features add content)
- [ ] Light and dark mode render correctly

## Tasks

- [ ] Add `/settings` route to `App.tsx` | frontend
- [ ] Create `SettingsPage.tsx` with shadcn/ui Tabs layout and named tab slots | frontend
- [ ] Add "Settings" sidebar link to `AppShell.tsx` | frontend
- [ ] Implement General tab: fetch and display app info from `/api/health` and `/api/config` | frontend
- [ ] Persist active tab in URL hash | frontend

## Open Questions

- [ ] {Question 1}
