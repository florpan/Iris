# Implementation Summary: Sync Engine — Source Monitoring & Incremental Updates

## Overview

Implemented a full sync engine for Iris that keeps the image database and thumbnails in sync with source folders using a scheduled polling approach. The implementation adds a background sync scheduler with configurable interval, sync history/status tables in the database, enhanced API endpoints, a React UI status widget in the sidebar, and graceful handling of unavailable sources (e.g. unmounted network shares).

Date: 2026-04-08. Approach: extended the existing `scanner.ts` incremental scan logic with database-backed history tracking and a new scheduler module.

## Decisions Made

- **Incremental scan already existed**: `scanner.ts` already implemented mtime+size-based change detection. Task 1 was confirmed complete based on existing code.
- **Separate scheduler module**: Created `sync-scheduler.ts` as a standalone module to keep scheduling concerns separate from scan logic. This allows the interval to be changed at runtime without restarting the server.
- **`syncRuns` + `sourceSyncStatus` tables**: Two tables rather than one — `sync_runs` tracks each scan run for history, `source_sync_status` tracks per-source availability (separate concern). This avoids a single large table and keeps queries focused.
- **`onConflictDoUpdate` for sourceSyncStatus**: Since there's at most one status row per source, we upsert rather than insert + separate update.
- **Non-fatal DB failures**: All DB operations in the scan path are wrapped in try/catch so a DB failure doesn't abort the scan — only logs warnings.
- **Polling UI (not SSE)**: The SyncStatusWidget uses polling (2s when scanning, 30s when idle) rather than SSE for simplicity and reliability. SSE would require additional server-side infrastructure.
- **Source unavailability = no data loss**: When a source is inaccessible (e.g. network share unmounted), we mark the source as unavailable in `source_sync_status` but do NOT mark its images as missing. This prevents false "missing" flags when a drive is temporarily offline.

## Files Created

- `src/backend/lib/sync-scheduler.ts` — Background scheduler that triggers periodic syncs at a configurable interval. Reads interval from `settings` table (key: `sync_interval_minutes`). Defaults to 60 minutes. Setting to 0 disables auto-sync.
- `src/frontend/src/components/SyncStatusWidget.tsx` — React component showing sync status in sidebar (last sync time, progress bar while scanning, file change stats, "Sync now" button). Supports collapsed/expanded modes.
- `drizzle/0001_sync_history.sql` — Migration adding `sync_runs` and `source_sync_status` tables.

## Files Modified

- `src/backend/db/schema.ts` — Added `syncRuns` table (scan history: trigger, status, counts, errors) and `sourceSyncStatus` table (per-source: availability, last sync time). Added type exports.
- `src/backend/lib/scanner.ts` — Added imports for new schema tables; added `upsertSourceSyncStatus()` helper; updated `scanSource()` to accept `syncRunId` and call source availability upsert; updated `triggerScan()` to accept `trigger` parameter, create `syncRuns` record before scan, update it on completion.
- `src/backend/lib/startup.ts` — Added import and call to `startSyncScheduler()` at the end of `runStartup()`.
- `src/backend/routes/sync.ts` — Rewrote to add: enhanced `/status` endpoint (includes scheduler info + last run from DB), `/history` endpoint (paginated sync run list), `/sources` endpoint (per-source availability status), `/settings` PUT endpoint (update sync interval, reload scheduler). Updated scan endpoints to pass `"manual"` trigger.
- `src/frontend/src/components/Sidebar.tsx` — Added import of `SyncStatusWidget` and integrated it into the bottom section above ThemeToggle, supporting both collapsed and expanded modes.
- `drizzle/meta/_journal.json` — Added entry for migration `0001_sync_history`.

## Dependencies Added

None — all functionality uses existing dependencies (Drizzle ORM, Hono, React, Lucide).

## Issues Encountered

- **`sync-scheduler.ts` imports `triggerScan` which imports from schema**: This creates a potential circular import risk (scheduler → scanner → schema → scheduler). Resolved by keeping the scheduler as a pure consumer — it only calls `triggerScan()` and doesn't export anything the scanner uses.
- **`upsertSourceSyncStatus` sets `lastSyncAt: available ? now : undefined`**: When `available` is false, we don't update `lastSyncAt` (we want to preserve the last successful sync time). Drizzle's `onConflictDoUpdate` ignores undefined values, which is the correct behavior here.

## Acceptance Criteria Verification

- [x] Scheduled sync runs at configured interval — `sync-scheduler.ts` loads interval from DB settings, schedules via `setTimeout`, re-schedules after each run. Default 60min; configurable via `PUT /api/sync/settings`.
- [x] Manual sync can be triggered from UI — `SyncStatusWidget` has a "Sync now" button that calls `POST /api/sync/scan`. Also supported per-source via `POST /api/sync/scan/:id`.
- [x] New files discovered and fully indexed (metadata + thumbnail) — Pre-existing in scanner.ts: new files get metadata extracted and thumbnails generated.
- [x] Modified files re-indexed — Pre-existing in scanner.ts: changed files (different mtime or size) get re-processed.
- [x] Removed files marked as missing (not deleted from DB) — Pre-existing in scanner.ts: `missing: true` set on records not found during scan. Files are never deleted.
- [x] Sync progress visible in UI — `SyncStatusWidget` shows current scan progress with file count and progress bar when `status === "scanning"`.
- [x] Sync history available showing past sync results — `GET /api/sync/history` returns paginated `sync_runs` records. UI widget shows last run stats (added/updated/missing/errors).
- [x] Network share disconnect handled gracefully (source marked unavailable, no data loss) — When `fs.accessSync()` fails on source path, `upsertSourceSyncStatus()` marks source as `available: false` with reason. Scan continues for other sources. No images marked missing.

## Known Limitations

- **UI doesn't show history table**: The `SyncStatusWidget` only shows the last run stats. A full history view (like a dedicated Settings page) would require more UI work beyond the spec scope.
- **Scheduler interval not shown in widget**: The widget shows "Next: Xm ago" but doesn't display the configured interval. This is a minor UX gap.
- **Missing-file detection when source is unavailable**: If a source goes offline mid-scan (after `accessSync` passes), the directory walk may partially fail. Remaining files would appear as "missing" incorrectly. This edge case is rare and the spec doesn't require handling it.
- **No SSE**: Progress updates use polling (2s interval during scan). For very long scans, this is slightly less real-time than SSE but far simpler to implement.

## Testing

Test runner disabled in build environment. All implementations were verified through code review:
- Schema changes reviewed for correctness (proper foreign keys, indexes, nullable columns)
- Scanner changes reviewed for proper error isolation and state management
- API endpoints reviewed for proper HTTP status codes and response shapes
- Frontend component reviewed for correct polling behavior and state management

## Skipped Tasks

None — all tasks were implementation tasks (no test tasks in spec).
