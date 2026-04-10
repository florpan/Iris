# Project State

## System Overview
Iris is a self-hosted image search and organizer. Users register local filesystem folders as "sources," which are scanned to extract EXIF/IPTC metadata and generate WebP thumbnails. Images can then be browsed by folder structure, searched by text/metadata, viewed on a map or timeline, filtered by facets (camera, lens, date, tags), and organized with a tagging system. It is a single-user application with no authentication.

## Tech Stack
- Runtime: Bun
- Backend: Hono (REST API)
- Database: PostgreSQL 16 (Docker), Drizzle ORM
- Frontend: React 19, Vite 6, Tailwind CSS 4, shadcn/ui (Radix primitives + Lucide icons)
- Maps: Leaflet + MarkerCluster
- Image processing: sharp (thumbnails/conversion), exifr (EXIF/IPTC extraction)

## User Roles
- Single user — full access, no auth required

## Screens / Pages
- **Library** (`/`) — main grid view of all images with facet filtering, bulk selection, and tag filtering
- **Folders** (`/folders`, `/folders/:path`) — folder tree navigation mirroring source directory structure
- **Search** (`/search`) — text search with metadata filters
- **Browse** (`/browse`) — browse/explore mode
- **Tags** (`/tags`) — tag management: create, rename, merge, delete, bulk operations, import from IPTC keywords; audit log
- **Image Detail** (`/image/:id`) — full metadata panel, GPS mini-map, tagging, keyboard navigation between images; accessible as modal overlay or deep link
- **Map View** — Leaflet map showing geotagged images with marker clustering
- **Timeline View** — images grouped by date

## API Surface
- **Health** (`/api/health`) — readiness check
- **Config** (`/api/config`) — application settings (work dir, thumbnail format)
- **Sources** (`/api/sources`) — CRUD for source folders (register, enable/disable, list)
- **Images** (`/api/images`) — list/get images with pagination, filtering, sorting; bulk selection support
- **Folders** (`/api/folders`) — folder tree listing and contents for folder-based navigation
- **Tags** (`/api/tags`) — tag CRUD, rename, merge, bulk delete, import from IPTC; per-image tag assignment (`/api/images/:id/tags`)
- **Sync** (`/api/sync`) — trigger scans, view sync run history and status per source
- **Stats** (`/api/stats`) — dashboard statistics (counts, storage, camera/lens breakdowns)
- **Thumbnails** (`/api/thumbnails`) — serve generated thumbnail files
- **Search** (`/api/search`) — full-text and metadata search with pagination
- **Facets** (`/api/facets`) — aggregated filter values (cameras, lenses, dates, tags, mime types)
- **Timeline** (`/api/timeline`) — images grouped by time period

## Data Model
- **SourceFolder** — registered filesystem directory to scan; has many Images
- **Image** — single image file with extracted metadata (EXIF, IPTC, GPS), thumbnail path, missing/indexed status; belongs to SourceFolder, has many Tags via ImageTag
- **Tag** — named label with optional color and usage count; many-to-many with Images
- **ImageTag** — join table linking Images and Tags
- **SyncRun** — audit record of a scan execution (counts: scanned, added, updated, skipped, missing, errors)
- **SourceSyncStatus** — per-source last sync time and availability
- **TagManagementLog** — audit log for tag operations (rename, merge, delete, import)
- **Settings** — key-value application configuration

## User Flows
- **Add source and sync** — register a folder path as source -> trigger sync -> scanner walks filesystem, extracts metadata with exifr, generates thumbnails with sharp -> images appear in library
- **Browse by folder** — navigate folder tree -> select subfolder -> view paginated image grid for that folder
- **Search images** — enter text query and/or metadata filters -> results displayed in grid with pagination
- **View image detail** — click image in any grid -> modal/deep-link detail view with full metadata, GPS map, tags -> keyboard arrow navigation between images
- **Tag images** — open image detail -> add/remove tags; or use bulk selection in grid -> apply tags to multiple images
- **Manage tags** — go to tag management page -> rename, merge, delete tags; import IPTC keywords as tags; view audit log
- **Filter by facets** — use facet panel to filter by camera, lens, date range, tags, file type
- **Map exploration** — switch to map view -> see geotagged images as clustered markers on Leaflet map
- **Timeline browsing** — switch to timeline view -> images grouped chronologically

## External Integrations
- None (fully self-hosted, no external API calls)

## Known Limitations
- No user authentication (single-user only)
- Source folders are read-only — no file management/editing
- No image editing or RAW processing
- Custom routing (pushState-based) rather than a router library
- Docker compose only provides PostgreSQL; the app itself runs directly via Bun
- Three features are spec'd but not yet implemented: empty state/loading screens, missing file status indicators, and the tagging spec (separate from the implemented tagging system)
