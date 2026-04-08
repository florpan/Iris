---
id: folder-navigation
title: Folder-Based Navigation & Image Grid
status: pending
milestone: browsing
priority: high
handoff: single
dependsOn: thumbnail-generation
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

- [ ] Folder tree displays all configured sources with their directory hierarchy
- [ ] Clicking a folder shows its images as a thumbnail grid
- [ ] Breadcrumb shows current navigation path
- [ ] Image count displayed per folder
- [ ] Grid density adjustable
- [ ] Large folders paginated/virtualized — no performance degradation at 1000+ images
- [ ] Sort by name, date, size works correctly
- [ ] Folder tree is responsive — collapses on mobile

## Tasks

- [ ] Create API endpoint for folder tree structure with image counts | backend, api
- [ ] Create API endpoint for paginated images in a folder | backend, api
- [ ] Build sidebar folder tree component | frontend
- [ ] Build breadcrumb navigation component | frontend
- [ ] Build image thumbnail grid with configurable density | frontend
- [ ] Implement virtual scrolling or pagination for large folders | frontend
- [ ] Add sort controls | frontend
