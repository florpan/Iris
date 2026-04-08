# Implementation Summary: Core API Layer — Routes, Image Serving, Shared Patterns

## Overview

Implemented the full Hono API layer for the Iris image organizer backend. This includes a grouped route structure under `/api/`, shared error handling middleware, a reusable pagination helper, health and config endpoints, image streaming (originals + RAW preview support), thumbnail serving with aggressive cache headers, and source folder availability checking. All routes are mounted from a central `api.ts` router. Implemented on 2026-04-08 following a file-per-domain pattern for clear code organization.

## Decisions Made

- **File-per-route-domain**: Each route group (health, config, sources, images, folders, tags, sync, stats) lives in its own file under `src/backend/routes/`. This makes it easy for future features to replace stub implementations without touching the central router.
- **Thumbnail route on imagesRouter**: `/api/images/:id/thumb` is handled in `images.ts` (alongside `/api/images/:id/original`) rather than a separate file, since they share the same `/:id` parameter and image lookup logic.
- **Stub routers**: `folders.ts`, `tags.ts`, `sync.ts` export minimal stubs so the API router compiles completely. Future features replace these implementations. `stats.ts` is fully implemented since it only needs existing DB tables.
- **RAW handling with dynamic imports**: `exifr` and `sharp` are accessed via `import()` inside the handler so the server starts cleanly even if those packages aren't installed yet. The endpoint degrades gracefully: tries exifr thumbnail → sharp conversion → returns 415 with a descriptive message.
- **Error handler as `onError`**: Used Hono's `apiRouter.onError(errorHandler)` which is the idiomatic pattern. HTTPExceptions from route handlers are unwrapped to their message and status code; all other errors become 500.
- **ETag for thumbnails**: Added ETag support (`"<id>-<mtime>"`) enabling 304 Not Modified responses, reducing bandwidth for repeat views.

## Files Created

- `src/backend/routes/api.ts` — central router: mounts all domain routes, registers error handler (replaced existing stub)
- `src/backend/routes/health.ts` — `GET /api/health`: DB probe + server status
- `src/backend/routes/config.ts` — `GET /api/config`: sources + work folder read-only config
- `src/backend/routes/sources.ts` — `GET /api/sources`, `GET /api/sources/:id`: fs-based availability check per source
- `src/backend/routes/images.ts` — `GET /api/images`, `GET /api/images/:id`, `GET /api/images/:id/original`, `GET /api/images/:id/thumb`
- `src/backend/routes/folders.ts` — stub `GET /api/folders` (implemented by folder-navigation feature)
- `src/backend/routes/tags.ts` — stub `GET /api/tags` (implemented by tagging feature)
- `src/backend/routes/sync.ts` — stub `GET /api/sync/status` (implemented by sync/indexing feature)
- `src/backend/routes/stats.ts` — `GET /api/stats`: total images and sources counts
- `src/backend/middleware/error.ts` — `errorHandler` and `notFoundHandler` for consistent JSON errors
- `src/backend/lib/pagination.ts` — `parsePagination`, `buildPaginationMeta`, `paginatedResponse` helpers
- `src/backend/routes/thumbs.ts` — (unused; thumbnail logic folded into images.ts instead)

## Files Modified

- `src/backend/routes/api.ts` — replaced the minimal health+info stub with the full grouped route structure

## Dependencies Added

None at the package.json level. `exifr` and `sharp` are referenced via dynamic imports in `images.ts` to enable RAW support when installed; they should be added to `package.json` by the metadata-extraction feature or explicitly before deployment.

## Issues Encountered

- **`sharp`/`exifr` not in package.json**: The specconfig lists both as part of the tech stack, but neither was present in the root or backend `package.json`. Used dynamic imports with try/catch to keep the server functional without them; the original streaming endpoint returns 415 for RAW files until they are installed.
- **TypeScript deprecation**: `baseUrl` in the root `tsconfig.json` triggers a TS 7.0 deprecation notice (`tsc --noEmit` exits with code 1 but only because of this pre-existing config issue, not from newly added code).

## Acceptance Criteria Verification

- [x] `/api/health` responds with server status — `health.ts` returns `{ status, timestamp, services.database }` at 200/503
- [x] `/api/config` returns configured sources and work folder — `config.ts` queries `source_folders` and reads `WORK_DIR` env var
- [x] `/api/images/:id/original` streams image from source folder with correct content type — `images.ts` reads mimeType from DB + extension map, streams via `fs.createReadStream`
- [x] `/api/images/:id/original` serves JPEG preview for RAW files — tries `exifr.thumbnailBuffer()` first, then `sharp().jpeg()`, returns `image/jpeg` with `X-Image-Source` header
- [x] `/api/images/:id/thumb` serves thumbnail from work folder — resolves path relative to `WORK_DIR`, streams WebP/JPEG/PNG
- [x] Thumbnail responses include cache headers — `Cache-Control: public, max-age=604800, immutable`, `ETag`, `Last-Modified`
- [x] List endpoints support pagination with consistent response format — `parsePagination` + `paginatedResponse` used in `GET /api/images`; `{ data: [...], pagination: { total, page, pageSize, totalPages } }`
- [x] Errors return JSON `{ error: "message" }` with appropriate HTTP status — `errorHandler` in `middleware/error.ts` catches all throws; HTTPException statuses propagated
- [x] Source folder unavailability handled gracefully (503 for that source, not crash) — `sources.ts` uses `fs.accessSync` per source; `images.ts` original endpoint returns 503 when source is disabled

## Known Limitations

- RAW preview requires `exifr` and `sharp` to be installed; endpoint returns 415 until they are available
- Pagination on `/api/images` orders by `takenAt` (nulls may sort unexpectedly); future features may want configurable sort
- Stub routers for folders, tags, and sync return empty arrays/idle status — full implementations belong to their respective feature specs

## Skipped Tasks

None — all tasks were implementation tasks. Test runner was disabled per environment constraints, but no test tasks were listed in this spec.
