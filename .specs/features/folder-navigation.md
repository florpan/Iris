---
id: folder-navigation
title: Folder-Based Navigation & Image Grid
status: complete
milestone: browsing
priority: high
handoff: single
dependsOn: thumbnail-generation
depends_on: sync-engine
---

## Overview

The primary way to browse images. The UI presents the folder structure from source folders as a navigable tree/breadcrumb. Selecting a folder shows its images as a thumbnail grid. Subfolders are shown as navigable items within the grid or as a sidebar tree. Content is limited to the selected folder to avoid overwhelming the user.

## Key Design Decisions

### Folder Tree vs Breadcrumb
Sidebar folder tree for deep navigation + breadcrumb bar at the top for current path context. Tree shows all sources at root level, then their directory structure below.

### Image Grid
Thumbnail grid with configurable density. Shows thumbnail, filename, and key metadata (date, dimensions) on hover or in a subtitle. Paginated or virtualized — never load all thumbnails at once.

### Folder Counts
Each folder in the tree shows the number of images (direct + recursive). This helps users find where their images are concentrated.

## Requirements

- Sidebar folder tree showing all sources and their directory structure
- Breadcrumb navigation showing current path
- Thumbnail grid for selected folder
- Image count per folder (direct and recursive)
- Configurable grid density (small/medium/large thumbnails)
- Pagination or virtual scrolling for large folders
- Sort options (name, date, size, format)
- Keyboard navigation support

## Acceptance Criteria

- [x] Folder tree displays all configured sources with their directory hierarchy
- [x] Clicking a folder shows its images as a thumbnail grid
- [x] Breadcrumb shows current navigation path
- [x] Image count displayed per folder
- [x] Grid density adjustable
- [x] Large folders paginated/virtualized — no performance degradation at 1000+ images
- [x] Sort by name, date, size works correctly
- [x] Folder tree is responsive — collapses on mobile

## Tasks

- [x] Create API endpoint for folder tree structure with image counts | backend, api
- [x] Create API endpoint for paginated images in a folder | backend, api
- [x] Build sidebar folder tree component | frontend
- [x] Build breadcrumb navigation component | frontend
- [x] Build image thumbnail grid with configurable density | frontend
- [x] Implement virtual scrolling or pagination for large folders | frontend
- [x] Add sort controls | frontend
