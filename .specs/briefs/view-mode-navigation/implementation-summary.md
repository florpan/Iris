# Implementation Summary: View mode navigation

## Overview

Implemented view mode navigation state management and transitions for the Iris image application. The feature resolves the flow analysis finding "Navigation between view modes undefined" by adding map view support to `BrowsePage`, making all three primary pages (FolderPage, SearchPage, BrowsePage) consistently support all four view modes (grid, list, timeline, map) while preserving the active filter/search context across mode transitions. Implemented on 2026-04-08.

## Decisions Made

- **Scope focused on BrowsePage gap**: Analysis of the codebase confirmed that `FolderPage` and `SearchPage` already fully supported all view modes (grid/list, timeline, map). Only `BrowsePage` was missing the map view. Rather than rebuilding view mode infrastructure, the fix was targeted.
- **Filter context preservation approach**: Passed the active `FacetFilters` state (camera, lens, format, dateFrom, dateTo) directly to `MapView` props. Fields not supported by MapView (focalLengthMin, focalLengthMax, isoMin, isoMax) are browse-specific facets not covered by the GPS image API, so they are silently omitted — consistent with how SearchPage handles its non-GPS-relevant filters.
- **useMapConfig hook**: Added `useMapConfig` to BrowsePage (same pattern as FolderPage and SearchPage) to provide configurable tile URL and attribution for the MapView component.
- **Grid/pagination hiding**: Extended the existing pattern (hide grid when `viewMode === "timeline"`) to also hide when `viewMode === "map"`, and updated the pagination condition to match.

## Files Created

_None_

## Files Modified

- `src/frontend/src/pages/BrowsePage.tsx` — Added `MapView` and `useMapConfig` imports; added `mapConfig` from `useMapConfig()` hook; added `MapView` render block when `viewMode === "map"` with active filter props; updated image grid and pagination conditions to hide in map mode.

## Dependencies Added

_None_ — all dependencies (`MapView`, `useMapConfig`) already existed in the project.

## Issues Encountered

_None_ — the implementation was straightforward, following the exact pattern used by FolderPage and SearchPage.

## Acceptance Criteria Verification

- [x] Gap identified by flow analysis is resolved — Verified by code review: BrowsePage now renders `MapView` when `viewMode === "map"`, passing the active filter context (camera, lens, format, dateFrom, dateTo). All three primary content pages now consistently handle all four view modes. The global `viewMode` state in `useAppState` is stored in localStorage, ensuring the selected mode persists across page navigations. Filter state is preserved within each page's React state and passed to the appropriate view component on mode switch.

## Known Limitations

- ISO and focal length range filters (BrowsePage-specific facets) are not forwarded to MapView since the GPS images API does not support those filter parameters. This matches the behavior of FolderPage (which has no such filters) and is acceptable.
- The `viewMode` is stored globally (applies across all pages), which is the existing design. A user switching to map mode on FolderPage will also see map mode when navigating to BrowsePage. This is intentional — single-user app behavior.

## Testing

- Code review verified the implementation matches the patterns used in FolderPage and SearchPage for map/timeline view modes.
- Test runner disabled in build environment — no automated tests were run.

## Skipped Tasks

_(none — only one implementation task was defined)_
