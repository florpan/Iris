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
- **Library** (`/`) — main grid view of all images with facet filtering, bulk selection, and tag filtering; includes multi-select capabilities with checkbox overlays, Select All/None controls, and bulk action toolbar for batch operations like tagging multiple images
- **Folders** (`/folders`, `/folders/:path`) — folder tree navigation mirroring source directory structure; sidebar folder tree with breadcrumb navigation, configurable thumbnail grid density, pagination/virtual scrolling, sort controls, and per-folder image counts; supports bulk selection and batch operations on images within folders
- **Search** (`/search`) — text search with metadata filters; includes bulk selection capabilities for search results; features always-visible search bar with full-text search across filename and metadata fields, advanced filter panel for structured filtering by camera model, lens, date range, file format, dimensions, and file size; search results display in thumbnail grid with result count and sorting by relevance, date, name, or size; supports autocomplete suggestions for camera models and lenses
- **Browse** (`/browse`) — browse/explore mode with bulk selection support
- **Tags** (`/tags`) — tag management: create, rename, merge, delete, bulk operations, import from IPTC keywords; audit log
- **Image Detail** (`/image/:id`) — full metadata panel, GPS mini-map, tagging, keyboard navigation between images; accessible as modal overlay or deep link; displays full-resolution original images from source folders with organized metadata sections for camera info, file details, location, and IPTC data; includes zoom/pan support and RAW file preview handling
- **Map View** — Leaflet map showing geotagged images with marker clustering
- **Timeline View** — images grouped by date

## API Surface
- **Health** (`/api/health`) — readiness check
- **Config** (`/api/config`) — application settings (work dir, thumbnail format)
- **Sources** (`/api/sources`) — CRUD for source folders (register, enable/disable, list)
- **Images** (`/api/images`) — list/get images with pagination, filtering, sorting; bulk selection support; bulk tag operations for multiple images with progress tracking and error handling
- **Image Serving** (`/api/images/:id/original`) — stream original images from source folders with RAW preview support for non-JPEG formats
- **Thumbnails** (`/api/thumbnails`, `/api/images/:id/thumb`) — serve generated thumbnail files with caching headers; regeneration endpoint for settings changes
- **Folders** (`/api/folders`) — folder tree listing and contents for folder-based navigation; folder tree structure with image counts (direct and recursive); paginated images within specific folders
- **Tags** (`/api/tags`) — tag CRUD, rename, merge, bulk delete, import from IPTC; per-image tag assignment (`/api/images/:id/tags`) with autocomplete/suggestion functionality, validation, and usage tracking; bulk tag operations across multiple images
- **Sync** (`/api/sync`) — trigger scans, view sync run history and status per source; incremental sync with change detection
- **Stats** (`/api/stats`) — dashboard statistics (counts, storage, camera/lens breakdowns)
- **Search** (`/api/search`) — full-text and metadata search with pagination; PostgreSQL full-text search with GIN indexes across filename, IPTC title/description/keywords, camera model, lens model, and tags; structured filtering for camera model, lens, date range, file format, dimensions, file size; combined text and filter queries; result sorting by relevance, date, name, size; autocomplete suggestions for camera and lens values
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
- **Browse by folder** — navigate folder tree -> select subfolder -> view paginated image grid for that folder; use sidebar tree navigation with image counts to explore directory structure, adjust grid density and sorting options
- **Search images** — enter text query and/or metadata filters -> results displayed in grid with pagination; use always-visible search bar for full-text search across filename, IPTC title/description/keywords, camera model, lens model, and tags -> expand advanced filters for structured filtering by camera, lens, date range, file format, dimensions, file size -> results display in thumbnail grid with count and relevance sorting -> autocomplete assists with camera/lens values
- **View image detail** — click image in any grid -> modal/deep-link detail view with full metadata, GPS map, tags -> keyboard arrow navigation between images; full-resolution image display with organized metadata sections (camera, file, location, IPTC); zoom/pan support for large images; RAW files show embedded JPEG preview
- **Tag images** — open image detail -> add/remove tags; or use bulk selection in grid -> apply tags to multiple images
- **Manage tags** — go to tag management page -> rename, merge, delete tags; import IPTC keywords as tags; view audit log
- **Filter by facets** — use facet panel to filter by camera, lens, date range, tags, file type
- **Map exploration** — switch to map view -> see geotagged images as clustered markers on Leaflet map
- **Timeline browsing** — switch to timeline view -> images grouped chronologically
- **Thumbnail regeneration** — change thumbnail format/size settings -> trigger regeneration -> all thumbnails rebuilt with new settings
- **Scheduled sync** — background sync engine runs on configurable interval -> incrementally scans sources for changes -> processes new/modified files, marks removed files as missing -> progress visible in UI with sync history
- **Bulk operations** — select multiple images using checkboxes in grid view -> Select All/None controls or keyboard shortcuts (Ctrl+A, Shift+click for range selection) -> bulk action toolbar appears -> apply batch operations like adding/removing tags -> progress feedback and error handling for failed operations

## External Integrations
- None (fully self-hosted, no external API calls)

## Known Limitations
- No user authentication (single-user only)
- Source folders are read-only — no file management/editing
- No image editing or RAW processing
- Custom routing (pushState-based) rather than a router library
- Docker compose only provides PostgreSQL; the app itself runs directly via Bun
- One feature is spec'd but not yet implemented: empty state/loading screens