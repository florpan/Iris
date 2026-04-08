---
id: sync-engine
title: Sync Engine — Source Monitoring & Incremental Updates
status: complete
milestone: foundation
priority: medium
handoff: single
dependsOn: metadata-extraction, thumbnail-generation
depends_on: thumbnail-generation
---

## Overview

Keep the database and thumbnails in sync with source folders. Since source folders can be local paths or network shares (and potentially cloud storage later), a filesystem watcher won't reliably work. Instead, use a scheduled polling approach: periodically scan source folders for changes and process new/modified/removed files.

## Key Design Decisions

### Polling, Not Watching
File watchers break on network shares, cloud mounts, and across restarts. A polling-based sync that runs on a configurable interval (e.g., every 30 minutes) or on manual trigger is more reliable. The scan is incremental — it checks file modification time and size, only processing changes.

### Sync Status
Track sync status per source: last synced timestamp, files added/changed/removed since last sync, any errors. Show this in the UI so users know their index is fresh.

### Background Processing
Sync runs as a background task. The UI stays responsive. Progress updates via SSE or polling.

## Requirements

- Scheduled sync on configurable interval
- Manual sync trigger (per source or all)
- Incremental: only process new/changed/removed files
- Detect removed files and mark as missing in database
- Detect new files and trigger metadata extraction + thumbnail generation
- Detect changed files (modified time/size) and re-extract metadata + regenerate thumbnail
- Progress reporting (files scanned, processed, errors)
- Sync history log (when, how many changes, errors)
- Source-level sync status in UI

## Acceptance Criteria

- [x] Scheduled sync runs at configured interval
- [x] Manual sync can be triggered from UI
- [x] New files discovered and fully indexed (metadata + thumbnail)
- [x] Modified files re-indexed
- [x] Removed files marked as missing (not deleted from DB)
- [x] Sync progress visible in UI
- [x] Sync history available showing past sync results
- [x] Network share disconnect handled gracefully (source marked unavailable, no data loss)

## Tasks

- [x] Implement incremental file change detection (mtime + size) | backend
- [x] Create background sync runner with configurable interval | backend
- [x] Create sync status tracking and history tables | backend, database
- [x] Create sync API endpoints (trigger, status, history) | backend, api
- [x] Build sync status indicator in UI | frontend
- [x] Handle source unavailability gracefully | backend
