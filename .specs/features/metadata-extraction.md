---
id: metadata-extraction
title: Image Metadata Extraction & Indexing
status: in-progress
milestone: foundation
priority: high
handoff: single
dependsOn: source-management
depends_on: source-management
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

- [x] Scanning discovers all images in source folder hierarchy
- [x] EXIF data extracted (camera model, lens, exposure, ISO, focal length, date)
- [x] GPS coordinates extracted when available
- [x] IPTC data extracted (title, description, keywords)
- [x] File metadata stored (size, dimensions, format, modification date)
- [x] Camera RAW files (CR2, NEF, ARW, DNG) are supported
- [x] Incremental scan skips unchanged files
- [x] Missing files flagged but not deleted from database
- [x] Scan progress reported via API

## Tasks

- [x] Create database schema for images and metadata | backend, database
- [x] Implement recursive directory scanner with format detection | backend
- [x] Implement metadata extraction using exifr | backend
- [x] Handle camera RAW metadata extraction | backend
- [x] Implement incremental scan with change detection | backend
- [x] Create scan API endpoints (trigger, progress, status) | backend, api
- [x] Add missing file detection on rescan | backend
