# Architecture — Iris

Self-hosted image search and organizer with metadata extraction, thumbnails, and smart browsing.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Bun |
| Backend Framework | Hono |
| Database | PostgreSQL 16 |
| ORM | Drizzle ORM |
| Frontend | React 19, Vite |
| Styling | Tailwind CSS 4, shadcn/ui (Radix UI) |
| Maps | Leaflet + leaflet.markercluster |
| Image Processing | sharp (thumbnails/conversion), exifr (EXIF/IPTC/GPS extraction) |
| Icons | lucide-react |
| Containerization | Docker (multi-stage build) |

## Directory Structure

```
/
├── src/
│   ├── backend/
│   │   ├── index.ts              # Server entry point
│   │   ├── db/
│   │   │   ├── schema.ts         # Drizzle table definitions
│   │   │   ├── client.ts         # Database connection
│   │   │   └── migrate.ts        # Migration runner
│   │   ├── lib/
│   │   │   ├── config.ts         # YAML + env config loader
│   │   │   ├── metadata.ts       # EXIF/IPTC/GPS extraction
│   │   │   ├── scanner.ts        # Directory scanner + indexer
│   │   │   ├── thumbnailer.ts    # Thumbnail generation
│   │   │   ├── sync-scheduler.ts # Background sync scheduler
│   │   │   └── pagination.ts     # Pagination helpers
│   │   ├── routes/
│   │   │   ├── api.ts            # Route aggregation
│   │   │   ├── health.ts         # GET /api/health
│   │   │   ├── config.ts         # GET /api/config
│   │   │   ├── sources.ts        # Source folder management
│   │   │   ├── images.ts         # Image metadata + streaming
│   │   │   ├── search.ts         # Full-text + structured search
│   │   │   ├── tags.ts           # Tag CRUD + bulk ops
│   │   │   ├── folders.ts        # Folder tree + browsing
│   │   │   ├── sync.ts           # Scan triggers + status
│   │   │   ├── thumbnails.ts     # Thumbnail settings + regen
│   │   │   ├── stats.ts          # Collection statistics
│   │   │   ├── facets.ts         # Faceted filtering
│   │   │   └── timeline.ts       # Timeline grouped view
│   │   └── middleware/
│   │       └── error.ts          # Global error handler
│   └── frontend/
│       └── src/
│           ├── App.tsx            # Root component + routing
│           ├── main.tsx           # Vite entry
│           ├── components/        # UI components
│           ├── pages/             # Page-level components
│           ├── hooks/             # Custom React hooks
│           ├── lib/               # Utilities
│           └── styles/            # Global styles
├── drizzle/                       # Generated migrations
├── dist/                          # Built frontend output
├── data/                          # Runtime data
├── work/                          # Thumbnails + generated files
├── docs/                          # Documentation (Design.md)
└── .specs/                        # Waymark specs
```

## Database Schema

8 tables in PostgreSQL:

### `source_folders`
Configured image source directories (read-only mounts).

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| path | text UNIQUE | Absolute filesystem path |
| name | text | User-friendly name |
| enabled | boolean | Enable/disable scanning |
| created_at, updated_at | timestamp | |

### `images`
Core image metadata — one row per file discovered during scanning.

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| source_folder_id | integer FK | CASCADE delete |
| relative_path | text | Path relative to source root |
| file_name | text | Filename only |
| file_size | bigint | Bytes |
| mime_type | text | e.g. "image/jpeg" |
| width, height | integer | Pixels |
| thumbnail_path | text | Path in work folder |
| taken_at | timestamp | EXIF capture time (indexed) |
| camera_model | text | Make + Model (indexed) |
| lens_model | text | (indexed) |
| iso | integer | |
| aperture | real | F-number |
| shutter_speed | text | Human-readable |
| focal_length | real | mm |
| latitude, longitude, altitude | real | GPS coordinates |
| iptc_title, iptc_description | text | IPTC fields |
| iptc_keywords | jsonb | string[] |
| iptc_copyright | text | |
| metadata | jsonb | Raw exifr output |
| file_modified_at | timestamp | File mtime (date fallback) |
| missing | boolean | File not found on disk (indexed) |
| indexed | boolean | Has metadata been extracted |
| indexed_at | timestamp | |

**Indexes:** source_folder_id, taken_at, relative_path, camera_model, lens_model, mime_type, GIN on full-text search vector.

### `tags`
User-defined tags for organizing images.

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| name | text UNIQUE | Lowercase |
| color | text | Optional hex color |
| usage_count | integer | Cached count of tagged images |

### `image_tags`
Many-to-many join. PK: (image_id, tag_id). Both FK CASCADE.

### `settings`
Key-value store. Key: text PK, Value: jsonb. Keys: `thumbnails`, `sync_interval_minutes`.

### `sync_runs`
Audit log of each scan execution. Tracks scanned/added/updated/skipped/missing/error counts per run.

### `source_sync_status`
Per-source sync tracking. PK: source_folder_id FK. Tracks last_sync_at, availability.

### `tag_management_log`
Audit trail of tag operations (rename, merge, delete, import). Indexed on operation and created_at.

## API Surface

Base path: `/api`. Framework: Hono.

### Health & Config
| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/health | Server + DB health check |
| GET | /api/config | App config (sources, work folder, map settings) |

### Sources
| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/sources | List all source folders with availability |
| GET | /api/sources/:id | Single source status |

### Images
| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/images | Paginated image listing |
| GET | /api/images/:id | Single image metadata |
| GET | /api/images/:id/original | Stream original file (supports RAW preview) |
| GET | /api/images/:id/thumb | Serve thumbnail (WebP, cached) |
| GET | /api/images/gps | All GPS-tagged images for map view (limit 5000) |

### Search & Filtering
| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/search | Full-text + structured search with pagination |
| GET | /api/search/suggestions | Autocomplete for camera/lens/format fields |
| GET | /api/facets | Facet counts (camera, lens, format, date, focal length, ISO) |

### Tags
| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/tags | List all tags |
| GET | /api/tags/autocomplete | Tag autocomplete (top 10 by usage) |
| POST | /api/tags | Create tag |
| GET/PUT/DELETE | /api/tags/:id | Single tag CRUD |
| POST | /api/tags/bulk/add | Add tags to multiple images |
| POST | /api/tags/bulk/remove | Remove tags from multiple images |
| POST | /api/tags/merge | Merge source tags into target |
| DELETE | /api/tags/bulk | Delete multiple tags |
| GET | /api/tags/export | Export tags as CSV/JSON |
| POST | /api/tags/import | Import tags from JSON |
| GET | /api/tags/log | Tag operation audit log |
| GET | /api/tags/:id/images | Images with specific tag |
| GET/POST | /api/images/:id/tags | Image tag management |
| DELETE | /api/images/:id/tags/:tagId | Remove tag from image |

### Folders
| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/folders | Folder tree with image counts |
| GET | /api/folders/:sourceId/images | Paginated images in folder |

### Sync
| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/sync/status | Current scan progress + scheduler state |
| POST | /api/sync/scan | Trigger full scan (async) |
| POST | /api/sync/scan/:id | Trigger scan of specific source |
| GET | /api/sync/history | Past sync runs |
| GET | /api/sync/sources | Per-source sync status |
| PUT | /api/sync/settings | Update sync interval |

### Timeline & Stats
| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/timeline | Images grouped by date (year/month/day) |
| GET | /api/stats | Collection statistics |

### Thumbnails
| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/thumbnails/settings | Current thumbnail settings |
| PUT | /api/thumbnails/settings | Update format/size |
| POST | /api/thumbnails/regenerate | Trigger batch regeneration |
| GET | /api/thumbnails/regenerate/status | Regeneration progress |

## Key Systems

### Sync & Scanning
- Background scheduler runs every N minutes (default 60, configurable, min 5)
- Recursive directory walk, skips hidden files/dirs
- Incremental: compares file size + mtime, skips unchanged
- Per-file: extract metadata via exifr, generate thumbnail via sharp
- Missing files flagged (not deleted) — may be on unmounted share
- Each scan creates audit record in `sync_runs`

### Metadata Extraction
- Uses `exifr` for EXIF, IPTC, XMP, GPS, ICC parsing
- Supports standard formats (JPEG, PNG, TIFF, WEBP, HEIC) and RAW (CR2, CR3, NEF, ARW, ORF, RAF, DNG, RW2, PEF, etc.)
- Graceful failure — files indexed even if metadata extraction fails
- Raw exifr output stored as JSON blob for future use

### Thumbnail Generation
- Standard images: sharp resize to fit within configurable size (default 400px)
- RAW files: extract embedded JPEG preview via exifr, fallback to sharp decode
- Output format: WebP (default), JPEG, or AVIF
- Stored in work folder mirroring source folder structure
- Served with Cache-Control + ETag headers

### Full-Text Search
- PostgreSQL tsvector built from: fileName, iptcTitle, iptcDescription, iptcKeywords
- Weighted: Title (A), FileName (B), Description (B), Keywords (B)
- GIN index for fast matching
- Prefix matching enabled (e.g. "sun" matches "sunset")
- Combined with structured filters (camera, lens, date, size, ISO, focal length, tags)
- Faceted filtering returns context-sensitive counts

### Maps & Geo
- Leaflet with OpenStreetMap tiles (configurable)
- Marker clustering for dense GPS data
- GPS endpoint returns up to 5000 points with filter support
- Mini-map in image detail view for single-image GPS preview

## Frontend Architecture

### State Management
- No Redux/Zustand — module-level singleton pattern via `useAppState` hook
- Components subscribe to shared state via listener callbacks
- localStorage persistence for viewMode and sidebar state
- Component-local state for view-specific data

### Key Components
- **AppShell** — Main layout with header, collapsible sidebar, content area
- **ImageGrid** — Grid/list view with lazy loading (IntersectionObserver)
- **MapView** — Leaflet map with marker clustering
- **TimelineView** — Chronological grouping by year/month/day
- **FolderTree** — Hierarchical folder navigation
- **FacetPanel** — Drill-down filters (camera, lens, format, date, focal length, ISO)
- **ImageDetailModal** — Full metadata display + GPS mini-map + prev/next navigation
- **BulkActionToolbar** — Multi-select tagging
- **TagManagementPage** — Tag CRUD, merge, import/export

### Pages
- **BrowsePage** — Main view (sidebar + filters + grid)
- **SearchPage** — Search results
- **FolderPage** — Folder browsing
- **TagManagementPage** — Tag editor
- **ImageDetailDeepLink** — Deep-linkable image detail

### Design System
- DM Sans for UI text, Outfit for display headings
- Light/dark mode via ThemeToggle
- Responsive: mobile drawer for sidebar navigation
- Accessible: shadcn/ui components (Radix UI primitives)

## Configuration

### Environment Variables
| Variable | Default | Purpose |
|----------|---------|---------|
| DATABASE_URL | postgres://iris:iris@localhost:5432/iris | PostgreSQL connection |
| IRIS_SOURCES | (none) | Comma-separated "name:/path" pairs |
| IRIS_WORK_FOLDER | ./work | Thumbnail/generated file storage |
| IRIS_MAP_TILE_URL | OpenStreetMap | Leaflet tile URL template |
| IRIS_MAP_TILE_ATTRIBUTION | OSM contributors | Tile attribution |
| CONFIG_FILE | ./config.yaml | Path to YAML config |
| PORT | 3000 | Server port (production) |
| PUBLIC_DIR | ./dist/public | Built frontend path |

### Config Priority
Environment variables > config.yaml > Defaults

## Key Architecture Decisions

1. **Source folders are read-only** — Iris never writes to source directories
2. **Separate work folder** — Thumbnails and generated data stored outside sources
3. **Incremental scanning** — Skip unchanged files based on size + mtime
4. **Graceful degradation** — Files indexed even if metadata extraction fails
5. **Missing file tracking** — Files flagged, not deleted (supports unmounted shares)
6. **Single-user application** — No authentication or role management
7. **Background async scanning** — Scans don't block the UI
8. **Configurable thumbnails** — Format and size adjustable, batch regeneration supported
9. **PostgreSQL full-text search** — No external search engine required
