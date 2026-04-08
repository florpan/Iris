---
id: search
title: Search — Metadata & Filename
status: pending
milestone: browsing
priority: high
handoff: single
dependsOn: metadata-extraction
---

## Overview

Search across all indexed images by filename and metadata. Search results display in the same thumbnail grid as folder browsing, with the search query highlighted where applicable. Search covers: filename, IPTC title/description/keywords, camera model, lens model, and tags.

## Key Design Decisions

### Search Scope
Full-text search over filename and text metadata fields. Structured filtering for numeric/enum fields (camera model, lens, date range, dimensions, file format). These can combine: search "vacation" + filter camera="Canon R5" + date range.

### Search UI
Top-level search bar always visible. Results replace the main content area. Advanced filters available via expandable panel below search bar.

### Performance
PostgreSQL full-text search with GIN indexes on searchable text fields. For large collections (100k+ images), this should remain fast without external search infrastructure.

## Requirements

- Full-text search across filename, title, description, keywords
- Structured filters: camera model, lens, date range, file format, dimensions, file size
- Combined search + filter
- Search results in thumbnail grid (reuse folder-navigation grid)
- Search result count
- Sort results by relevance, date, name, size
- Search suggestions/autocomplete for camera models and lenses

## Acceptance Criteria

- [ ] Text search finds images by filename
- [ ] Text search finds images by IPTC title, description, keywords
- [ ] Camera model filter works
- [ ] Date range filter works
- [ ] Filters combine with text search
- [ ] Results display in thumbnail grid with count
- [ ] Results sortable by relevance, date, name
- [ ] Search performs well with 10k+ indexed images

## Tasks

- [ ] Add full-text search indexes to database schema | backend, database
- [ ] Create search API endpoint with text + structured filters | backend, api
- [ ] Build search bar component (always visible) | frontend
- [ ] Build advanced filter panel (camera, lens, date, format, size) | frontend
- [ ] Connect search results to thumbnail grid component | frontend
- [ ] Add search suggestions for camera/lens values | backend, api
