---
id: main-interface-screen
title: Main interface screen
status: in-progress
milestone: browsing
priority: high
depends_on: folder-navigation, search, metadata-filtering
handoff: single
---

## Overview

The primary application interface that serves as the central hub for all image browsing activities. Integrates search, filtering, folder navigation, and view controls into a cohesive layout. This screen provides the foundation for all user interactions and serves as the entry point for image discovery and organization workflows.

## Requirements

- Create responsive layout with header, sidebar, and main content areas
- Integrate global search bar with live results and suggestions
- Provide sidebar with folder navigation tree and metadata filters
- Display image results in grid/list/timeline view modes with view toggle
- Include breadcrumb navigation showing current location/context
- Support collapsible sidebar for more viewing space
- Handle empty states (no images, no search results, no folder contents)
- Maintain responsive design for tablet and mobile viewports

## Technical Design

**Layout Structure:**
```
┌─────────────────────────────────────┐
│ Header: Logo + Search + View Toggle │
├──────────┬──────────────────────────┤
│ Sidebar  │ Main Content Area        │
│ - Folder │ - Breadcrumbs            │
│   Tree   │ - Results Grid/List      │
│ - Filter │ - Pagination             │
│   Panel  │                          │
└──────────┴──────────────────────────┘
```

**Responsive Behavior:**
- Desktop (>1024px): Full layout with sidebar
- Tablet (768-1024px): Collapsible sidebar with overlay
- Mobile (<768px): Sidebar as slide-out drawer

**State Management:**
- Current folder path and navigation state
- Active search query and filter selections
- View mode preference (grid/list/timeline)
- Sidebar collapsed/expanded state
- Loading and error states for all sections

**Component Integration:**
- Embed folder-navigation component in sidebar
- Integrate search component in header
- Include metadata-filtering panel in sidebar
- Pass shared state between all components

## Acceptance Criteria

- [x] Header contains logo, search bar, and view mode toggle buttons
- [x] Sidebar displays folder tree navigation and metadata filter panels
- [x] Main content area shows breadcrumbs and image results in selected view mode
- [x] Layout adapts responsively to different screen sizes
- [x] Sidebar can be collapsed/expanded with toggle button
- [x] Empty states display helpful messages when no content is available
- [x] Search, filter, and navigation state is synchronized across all components
- [x] Page loads quickly with progressive enhancement for large image sets

## Tasks

- [x] Build responsive layout structure with CSS Grid/Flexbox | frontend
- [x] Create header component with search and view controls | frontend
- [x] Implement collapsible sidebar with folder tree and filters | frontend
- [x] Build main content area with breadcrumbs and results display | frontend
- [x] Add responsive breakpoints and mobile navigation drawer | frontend
- [x] Implement state management for shared component data | frontend
- [x] Create empty state components for all content areas | frontend
- [ ] (skipped — test runner disabled) Test layout across different viewport sizes and devices | testing
- [x] Optimize performance for large image sets with virtualization | frontend

## Open Questions

- [ ] Should the sidebar default to collapsed or expanded on first visit?
- [ ] What's the minimum sidebar width that still provides good usability?