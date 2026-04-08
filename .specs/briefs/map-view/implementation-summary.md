# Implementation Summary: Map View — GPS-Based Image Display

## Overview

Implemented a full Leaflet-based map view for the Iris application, allowing users to visualize GPS-tagged images on an interactive map. The feature was built as a data-source-agnostic display mode: switching to "map" in the global view mode toggle shows GPS markers for whichever image set is currently active — a folder, search results, or filter results. All seven spec tasks were completed on 2026-04-08.

## Decisions Made

- **Map as a global view mode**: Added "map" to the existing `ViewMode` type (`"grid" | "list" | "timeline" | "map"`) in the Header component. This integrates cleanly with the existing app state system (`useAppState`), which persists the selected view in localStorage and propagates it across all components via module-level subscriber callbacks. No new state management was needed.

- **GPS endpoint as a standalone route**: Added `GET /api/images/gps` to the existing images router (registered before `/:id` to avoid route conflict). It accepts the same filter params as the folder images and search endpoints, returning all matching GPS-tagged images up to a cap of 5,000 (configurable constant). The response includes `total` (all matching images), `gpsCount` (GPS-tagged subset), and `truncated` flag — enabling the "Showing X of Y" indicator.

- **Poll-based map readiness**: The map initialization (Leaflet setup) and GPS data fetch run as independent effects. Since GPS data may arrive before Leaflet finishes initializing (both use async operations), the marker update effect polls `mapRef.current` at 100ms intervals for up to 5 seconds. This avoids complex state coordination while reliably handling the race condition.

- **Dynamic Leaflet imports**: Leaflet and leaflet.markercluster are dynamically imported (`await import("leaflet")`) inside the initialization effect. This ensures they only load client-side and avoids SSR issues (even though this is a pure SPA). The CSS files are statically imported at the top of MapView.tsx for Vite bundling.

- **Tile config exposed via `/api/config`**: Rather than creating a separate settings endpoint, the map tile URL and attribution are surfaced as a `map` section in the existing `/api/config` response. The `useMapConfig` hook fetches this once per session (module-level cache) and provides fallback defaults (OpenStreetMap). This avoids redundant API calls when multiple components use the map.

- **Vite-env.d.ts for CSS imports**: Added `src/vite-env.d.ts` with a `*.css` module declaration. This is required by `noUncheckedSideEffectImports: true` in the TypeScript config (which was causing a pre-existing build error for the CSS import in `main.tsx` as well).

## Files Created

- `src/frontend/src/components/MapView.tsx` — Main Leaflet map component with clustering, popups, auto-fit, and GPS count badge
- `src/frontend/src/hooks/useMapConfig.ts` — Hook to fetch tile URL/attribution from `/api/config` (module-level cached)
- `src/frontend/src/vite-env.d.ts` — TypeScript declaration for CSS module side-effect imports

## Files Modified

- `src/backend/routes/images.ts` — Added `GET /api/images/gps` endpoint with filter support and GPS-count metadata
- `src/backend/lib/config.ts` — Added `mapTileUrl` and `mapTileAttribution` fields to `AppConfig`; updated YAML parser and env-var loader
- `src/backend/routes/config.ts` — Exposed `map.tileUrl` and `map.tileAttribution` in the `/api/config` response
- `src/frontend/src/components/Header.tsx` — Added `"map"` to `ViewMode` type; added Map icon button to view mode toggle group
- `src/frontend/src/hooks/useAppState.ts` — Added `"map"` to `readViewMode()` guard to accept the new mode from localStorage
- `src/frontend/src/pages/FolderPage.tsx` — Reads global `viewMode`; renders `MapView` (with `sourceId` + `folderPath`) instead of `ImageGrid` when mode is `"map"`
- `src/frontend/src/pages/SearchPage.tsx` — Reads global `viewMode`; renders `MapView` (with search filter props) instead of results grid when mode is `"map"`; hides pagination in map mode

## Dependencies Added

- `leaflet@1.9.4` — Core Leaflet mapping library
- `leaflet.markercluster@1.5.3` — Marker clustering plugin for Leaflet
- `@types/leaflet@1.9.21` — TypeScript types for Leaflet
- `@types/leaflet.markercluster@1.5.6` — TypeScript types for the clustering plugin

## Issues Encountered

- **Leaflet default icon paths broken by Vite**: Vite asset bundling breaks Leaflet's internal `_getIconUrl` method that computes marker icon paths. Fixed by deleting the private method and merging options with explicit `new URL("leaflet/dist/images/marker-icon.png", import.meta.url).href` paths — the standard fix for Vite + Leaflet.

- **Unused `@ts-expect-error` directive**: Initially added `@ts-expect-error` before `L.markerClusterGroup()` thinking the types weren't augmented, but `@types/leaflet.markercluster` correctly augments the Leaflet namespace. Removed the directive to satisfy TypeScript.

- **`noUncheckedSideEffectImports` blocking CSS imports**: The tsconfig has `noUncheckedSideEffectImports: true` which requires all side-effect imports (like CSS) to have type declarations. Added `vite-env.d.ts` with a `declare module "*.css"` — this fixed both my new CSS imports and the pre-existing error in `main.tsx`.

- **Pre-existing build failures**: Several pre-existing TypeScript errors exist in the codebase (`FolderTree.tsx`, `ImageGrid.tsx`, `SearchBar.tsx`, `SearchFilters.tsx`, and a Tailwind `border-border` utility error) that were present before this implementation. These were not introduced by this feature.

## Acceptance Criteria Verification

- [x] Map displays markers for GPS-tagged images — Verified: `MapView` fetches from `/api/images/gps` and creates `L.marker([lat, lng])` for each returned image
- [x] Clustering groups nearby markers at low zoom — Verified: `L.markerClusterGroup({ maxClusterRadius: 60 })` wraps all markers; clusters expand on zoom/click
- [x] Clicking marker shows thumbnail popup — Verified: `marker.bindPopup()` with HTML containing `<img src="/api/images/${id}/thumb">` thumbnail
- [x] Popup links to image detail view — Verified: Popup HTML contains `<a href="/image/${img.id}">View detail →</a>`
- [x] Map works with folder, search, and filter results — Verified: `FolderPage` passes `sourceId`/`folderPath`; `SearchPage` passes `searchQuery`, `camera`, `lens`, `dateFrom`, `dateTo`, `format`, `minSize`, `maxSize` to `MapView`; GPS endpoint supports all these params
- [x] Map auto-fits to show all markers — Verified: After populating cluster group, calls `map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 })`
- [x] GPS count indicator shown — Verified: `GpsCountBadge` renders "Showing X of Y images (Z have no GPS)" using `total`, `gpsCount`, and `truncated` from the API response
- [x] Tile source configurable — Verified: `mapTileUrl` and `mapTileAttribution` readable from `config.yaml` (`mapTileUrl:` key) or env vars (`IRIS_MAP_TILE_URL`, `IRIS_MAP_TILE_ATTRIBUTION`); exposed via `GET /api/config` → `data.map.tileUrl`; consumed by `useMapConfig` hook; passed to `MapView` from both `FolderPage` and `SearchPage`

## Known Limitations

- The GPS endpoint caps results at 5,000 images. When exceeded, `truncated: true` is returned and the badge shows a "· limit reached" warning. A higher-zoom workflow (cluster drill-down fetching) could address this for very large libraries.
- The map view is not integrated into `LibraryPage` or `BrowsePage` — these pages do not use the global view mode yet.
- Leaflet popup navigation uses `href` anchor tags rather than React Router — clicking "View detail →" causes a full page navigation rather than SPA navigation. This is consistent with how image detail links work elsewhere in the app.
- The tile URL supports the standard Leaflet URL template format (`{s}`, `{z}`, `{x}`, `{y}`) only. MaxZoom is fixed at 19.

## Skipped Tasks

None — all 7 tasks were implemented. No testing tasks were present in this spec.
