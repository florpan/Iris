---
id: thumbnail-generation
title: Thumbnail Generation
status: pending
milestone: foundation
priority: high
handoff: single
dependsOn: metadata-extraction
---

## Overview

Generate thumbnails for every indexed image and store them in the work folder. Thumbnails are stored in WebP format by default (configurable) and placed in the work folder mirroring the source structure: `<work>/<source-name>/<path>/<filename>.thumb.webp`. Supports all source formats including camera RAW.

## Key Design Decisions

### Thumbnail Format
WebP by default — good compression, browser support, transparency. Configurable to JPEG or AVIF. Settings stored in app config.

### Thumbnail Sizes
Generate one standard thumbnail size (e.g., 400px on longest side) for grid views. Optionally a smaller size (150px) for dense views. Configurable via settings.

### RAW Handling
For camera RAW files, extract the embedded JPEG preview if available (most RAW files contain one). Fall back to `sharp` with `raw` input if no preview exists. Use `sharp` for all standard formats.

### Work Folder Structure
`<work-folder>/<source-name>/<relative-path>/<filename>.thumb.webp`

Example: Source "NAS" at `/mnt/nas/photos`, image at `/mnt/nas/photos/2024/vacation/IMG_001.CR2` → thumbnail at `<work>/nas/2024/vacation/IMG_001.thumb.webp`

## Requirements

- Thumbnail generation for all supported image formats
- Camera RAW thumbnail extraction (embedded preview or conversion)
- Configurable output format (WebP default, JPEG, AVIF)
- Configurable thumbnail size
- Work folder structure mirrors source folders
- Batch generation during scan
- Incremental — skip existing thumbnails for unchanged source files
- API endpoint to serve thumbnails
- Regeneration trigger (e.g., when changing format/size settings)

## Acceptance Criteria

- [ ] Thumbnails generated for JPEG, PNG, TIFF, WebP, HEIC source images
- [ ] Thumbnails generated for camera RAW files (CR2, NEF, ARW, DNG)
- [ ] Output format configurable (WebP, JPEG, AVIF)
- [ ] Thumbnail size configurable
- [ ] Thumbnails stored in correct work folder path mirroring source structure
- [ ] Unchanged images skip thumbnail regeneration
- [ ] Thumbnails served via API endpoint
- [ ] Batch regeneration available when settings change

## Tasks

- [ ] Implement thumbnail generation with sharp | backend
- [ ] Handle camera RAW thumbnail extraction (embedded preview + fallback) | backend
- [ ] Implement work folder path resolution mirroring source structure | backend
- [ ] Add thumbnail settings to app configuration (format, size) | backend
- [ ] Create thumbnail serving API endpoint | backend, api
- [ ] Integrate thumbnail generation into scan pipeline | backend
- [ ] Add regeneration endpoint for settings changes | backend, api
