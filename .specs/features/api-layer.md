---
id: api-layer
title: Core API Layer — Routes, Image Serving, Shared Patterns
status: in-progress
milestone: foundation
priority: high
handoff: single
dependsOn: project-setup, source-management
depends_on: project-setup
---

## Overview

The Hono API server that all frontend features depend on. Defines the route structure, image/thumbnail serving endpoints, shared middleware, response patterns, and error handling. This is the backbone that metadata-extraction, folder-navigation, search, and all other features mount their routes onto.

## Key Design Decisions

### Route Structure
All API routes under `/api/`. Grouped by domain:

```
/api/health              — health check
/api/config              — read-only app config (sources, work folder)
/api/sources             — source folder status
/api/images              — image listing, search, metadata
/api/images/:id          — single image metadata
/api/images/:id/original — stream original from source folder (read-only)
/api/images/:id/thumb    — serve thumbnail from work folder
/api/folders             — folder tree, folder contents
/api/tags                — tag CRUD
/api/sync                — trigger sync, sync status/history
/api/stats               — collection statistics
```

### Image Serving
Two distinct serving patterns:
- **Originals**: Streamed directly from source folders. For RAW files, serve the embedded JPEG preview or a server-side conversion — never the raw binary. Source folders are read-only; this endpoint only reads.
- **Thumbnails**: Served from the work folder as static files. WebP by default. Fast, cacheable.

Both endpoints set appropriate cache headers and content types.

### No Authentication
Single-user app — no auth middleware, no sessions, no tokens. All endpoints are open. If needed later, a simple shared-secret middleware can be added.

### Response Format
Consistent JSON responses:
- Success: `{ data: ... }` or `{ data: [...], pagination: { total, page, pageSize } }`
- Error: `{ error: "message" }`
- Image endpoints return binary streams with correct `Content-Type`

### Pagination
All list endpoints support `?page=1&pageSize=50`. Default page size 50, max 200. Returns `pagination` object with total count.

### Shared Middleware
- Request logging (dev mode)
- Error handler (catches throws, returns JSON error)
- CORS (permissive for local use, configurable for remote)

## Requirements

- Hono router with grouped route structure under `/api/`
- Image streaming endpoint (originals from source, with RAW preview support)
- Thumbnail serving endpoint (from work folder, cacheable)
- Consistent pagination pattern for list endpoints
- JSON error handling middleware
- Config endpoint exposing source folders and app settings (read-only)
- Source status endpoint (available/unavailable per source)
- Health check endpoint

## Acceptance Criteria

- [x] `/api/health` responds with server status
- [x] `/api/config` returns configured sources and work folder
- [x] `/api/images/:id/original` streams image from source folder with correct content type
- [x] `/api/images/:id/original` serves JPEG preview for RAW files
- [x] `/api/images/:id/thumb` serves thumbnail from work folder
- [x] Thumbnail responses include cache headers
- [x] List endpoints support pagination with consistent response format
- [x] Errors return JSON `{ error: "message" }` with appropriate HTTP status
- [x] Source folder unavailability handled gracefully (503 for that source, not crash)

## Tasks

- [x] Set up Hono route groups and mount points | backend
- [x] Implement shared error handling middleware | backend
- [x] Implement pagination helper for list endpoints | backend
- [x] Create health check and config endpoints | backend, api
- [x] Create image original streaming endpoint with RAW preview support | backend, api
- [x] Create thumbnail serving endpoint with cache headers | backend, api
- [x] Create source status endpoint | backend, api
