# Implementation Summary: Image Metadata Extraction & Indexing

## Overview

Built a complete metadata extraction and image indexing system for Iris. The implementation provides recursive directory scanning across all supported image formats (standard rasters + 14 camera RAW formats), full EXIF/IPTC/GPS metadata extraction via `exifr`, incremental scanning with change detection, missing file flagging, and three REST API endpoints for triggering and monitoring scans. All work was done on 2026-04-08.

## Decisions Made

- **exifr over sharp for metadata**: `exifr` was chosen per the spec. It supports RAW formats natively via TIFF IFD parsing, making it the right tool for both standard and RAW metadata extraction.
- **Singleton scan state in memory**: Scan progress is tracked in a module-level singleton rather than the database. This keeps the progress API fast (no DB query) and avoids schema complexity. The tradeoff is that progress resets on server restart.
- **Fire-and-forget async scan**: Scans run as background async IIFE. The API returns 202 immediately. This matches the spec's requirement for progress polling via GET /api/sync/status.
- **1-second mtime tolerance**: Incremental scan uses `Math.abs(mtime difference) < 1000ms` to avoid spurious re-indexing due to filesystem timestamp precision differences (FAT32, SMB shares, etc.).
- **jsonb for IPTC keywords**: Keywords are stored as a JSON array in a `jsonb` column rather than a separate join table, since keywords are primarily used for search/display and don't need relational integrity.
- **RAW dimension handling**: For RAW files, `ExifImageWidth`/`ExifImageHeight` is preferred over `ImageWidth`/`ImageHeight` because the TIFF IFD dimensions in RAW containers typically refer to the embedded thumbnail, not the full-resolution image.
- **Binary data filtering**: The raw metadata JSON blob strips `Uint8Array`, `ArrayBuffer`, and `Buffer` values before storing to PostgreSQL to avoid jsonb serialization errors.

## Files Created

- `src/backend/lib/metadata.ts` — Metadata extraction using exifr. Handles EXIF (camera, lens, exposure, GPS), IPTC (title, description, keywords, copyright), and RAW-specific dimension parsing. Returns structured fields + raw JSON blob.
- `src/backend/lib/scanner.ts` — Recursive directory scanner. Walks source folder trees, detects supported formats, drives incremental scan logic (skip unchanged, update changed, insert new), flags missing files.
- `drizzle/0000_initial_schema.sql` — Full initial database migration SQL covering all tables and indexes.
- `drizzle/meta/_journal.json` — Drizzle migration journal file.
- `drizzle/meta/0000_snapshot.json` — Drizzle migration snapshot.

## Files Modified

- `src/backend/db/schema.ts` — Added fields to the `images` table: `iptc_title`, `iptc_description`, `iptc_keywords` (jsonb), `iptc_copyright`, `file_modified_at` (for incremental scan), `missing` (boolean flag). Added type exports: `Image`, `NewImage`, `SourceFolder`.
- `src/backend/routes/sync.ts` — Replaced placeholder with full scan API: `POST /api/sync/scan`, `POST /api/sync/scan/:id`, `GET /api/sync/status`.
- `package.json` — Added `exifr@7.1.3` as a runtime dependency.

## Dependencies Added

- `exifr@7.1.3` — Comprehensive image metadata extraction supporting JPEG, PNG, TIFF, WebP, HEIC, AVIF, and camera RAW formats (CR2, CR3, NEF, ARW, ORF, RAF, DNG, RW2, etc.)

## Issues Encountered

- **Dead code in initial scanner write**: The initial write of scanner.ts included a redundant `missingPaths` loop alongside the correct `missingRecords` approach. Cleaned up in a follow-up edit.
- **No drizzle migration folder**: The project had no `./drizzle` directory yet. Created the migration SQL manually (can't run `drizzle-kit generate` without a database in the build environment).

## Acceptance Criteria Verification

- [x] Scanning discovers all images in source folder hierarchy — `walkDirectory()` in scanner.ts recursively walks directories using `fs.readdirSync` with `withFileTypes: true`, collecting all files with matching extensions from `ALL_SUPPORTED_EXTENSIONS`.
- [x] EXIF data extracted (camera model, lens, exposure, ISO, focal length, date) — `extractMetadata()` in metadata.ts reads `Make`, `Model`, `LensModel`, `ISO`, `FNumber`, `ExposureTime`, `FocalLength`, `DateTimeOriginal` from exifr output.
- [x] GPS coordinates extracted when available — `latitude`, `longitude`, `GPSAltitude` are extracted with `reviveValues: true` so exifr returns decimal degrees directly.
- [x] IPTC data extracted (title, description, keywords) — `ObjectName`/`title`, `Caption`/`Caption-Abstract`/`description`, `Keywords` are mapped to `iptcTitle`, `iptcDescription`, `iptcKeywords`.
- [x] File metadata stored (size, dimensions, format, modification date) — `stat.size`, `stat.mtime`, MIME type from extension map, and image dimensions from EXIF are all stored per record.
- [x] Camera RAW files (CR2, NEF, ARW, DNG) are supported — 14 RAW extensions in `RAW_EXTENSIONS` set; exifr parses TIFF-based RAW containers natively.
- [x] Incremental scan skips unchanged files — File size + mtime comparison (within 1s tolerance) determines if a file needs reprocessing.
- [x] Missing files flagged but not deleted from database — `inArray` update sets `missing: true` on records whose `relativePath` was not discovered in the current scan pass.
- [x] Scan progress reported via API — `GET /api/sync/status` returns the `ScanProgress` object with status, counts (scanned, total, added, updated, skipped, missing), errors, and timestamps.

## Known Limitations

- Scan progress resets on server restart (in-memory state only).
- Concurrent scan requests return 409 — only one scan can run at a time.
- `exifr` does not support all RAW formats equally: some lesser-known formats (X3F, 3FR, MEF, MRW) may have partial metadata. The code gracefully handles extraction failures by storing empty metadata.
- Dimensions for some HEIC/AVIF files may not be available if exifr cannot parse the container header; dimensions will be null in that case.

## Skipped Tasks

None — no test-related tasks were in the spec.

## Testing

Test runner is disabled in the build environment. The implementation was validated by:
1. TypeScript compilation via `bun build --target=bun` (0 errors, 182 modules bundled)
2. `bun x tsc --noEmit --strict` (0 type errors; 1 pre-existing deprecation warning about `baseUrl`)
3. Code review of all implemented modules for correctness
