---
id: metadata-extraction
title: Image Metadata Extraction & Indexing
status: pending
milestone: foundation
priority: high
handoff: single
dependsOn: source-management
---

## Overview

Scan source folders recursively, discover all image files, and extract every available piece of metadata: EXIF (camera, lens, exposure, ISO, focal length, etc.), IPTC (title, description, keywords, copyright), GPS coordinates, file metadata (size, dimensions, format, dates). Store everything in the database alongside the file path.

## Key Design Decisions

### Supported Formats
All common image formats: JPEG, PNG, TIFF, WebP, HEIC/HEIF, AVIF, BMP, GIF. Camera RAW formats: CR2, CR3 (Canon), NEF (Nikon), ARW (Sony), ORF (Olympus), RAF (Fuji), DNG, RW2 (Panasonic). Use `exifr` for metadata extraction — it handles most formats including RAW.

### Comprehensive Metadata
Extract and store all available metadata fields. Don't pre-filter — store the raw metadata JSON blob alongside structured fields for the most commonly queried values (date, camera, lens, GPS, dimensions, file size). This allows filtering on common fields while preserving access to everything.

### Incremental Scanning
Track file modification time and size. On rescan, skip files that haven't changed. New files get indexed, removed files get flagged (not deleted from DB — the image might be on an unmounted network share).

## Requirements

- Recursive directory scanning for all supported image formats
- Full EXIF, IPTC, XMP, GPS metadata extraction
- Camera RAW format support
- Structured storage for common fields (date, camera, lens, GPS, dimensions, file size, format)
- Raw metadata JSON blob for complete access
- Incremental scanning — only process new/changed files
- File removal detection (mark as missing, don't delete)
- Progress reporting during scan
- API endpoint to trigger scan per source or all sources

## Acceptance Criteria

- [ ] Scanning discovers all images in source folder hierarchy
- [ ] EXIF data extracted (camera model, lens, exposure, ISO, focal length, date)
- [ ] GPS coordinates extracted when available
- [ ] IPTC data extracted (title, description, keywords)
- [ ] File metadata stored (size, dimensions, format, modification date)
- [ ] Camera RAW files (CR2, NEF, ARW, DNG) are supported
- [ ] Incremental scan skips unchanged files
- [ ] Missing files flagged but not deleted from database
- [ ] Scan progress reported via API

## Tasks

- [ ] Create database schema for images and metadata | backend, database
- [ ] Implement recursive directory scanner with format detection | backend
- [ ] Implement metadata extraction using exifr | backend
- [ ] Handle camera RAW metadata extraction | backend
- [ ] Implement incremental scan with change detection | backend
- [ ] Create scan API endpoints (trigger, progress, status) | backend, api
- [ ] Add missing file detection on rescan | backend
