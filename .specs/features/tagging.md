---
id: tagging
title: Image Tagging
status: pending
milestone: smart
priority: medium
handoff: single
dependsOn: image-detail, search
---

## Overview

Users can add custom tags to images. Tags are stored in the database (not written to image files — source folders are read-only). Tags are searchable, filterable, and can be used as a facet for browsing. Supports bulk tagging from grid view.

## Key Design Decisions

### Database-Only Tags
Tags live only in the Iris database. They are never written to image EXIF/IPTC/XMP data. This preserves the read-only source folder guarantee.

### Tag Autocomplete
As users type tags, suggest existing tags to encourage consistency. Show tag usage count to help identify common tags.

### Bulk Tagging
Select multiple images in grid view and apply/remove tags in batch.

## Requirements

- Add/remove tags on individual images from detail view
- Bulk tag/untag from grid view (multi-select)
- Tag autocomplete with usage counts
- Tags as a search filter
- Tags as a faceted browse dimension
- Tag management page (rename, merge, delete tags)
- Import IPTC keywords as tags on first index (one-time migration)

## Acceptance Criteria

- [ ] Tags addable from image detail view
- [ ] Tags addable in bulk from grid view
- [ ] Tag autocomplete suggests existing tags
- [ ] Search includes tags
- [ ] Tags appear as filterable facet
- [ ] Tags can be renamed/merged/deleted from management page
- [ ] IPTC keywords imported as initial tags during indexing

## Tasks

- [ ] Create tags database schema (tags table + image_tags junction) | backend, database
- [ ] Create tag CRUD API endpoints | backend, api
- [ ] Create bulk tagging API endpoint | backend, api
- [ ] Build tag input component with autocomplete | frontend
- [ ] Add tag display/edit to image detail view | frontend
- [ ] Add multi-select + bulk tag to grid view | frontend
- [ ] Build tag management page | frontend
- [ ] Import IPTC keywords as tags during metadata extraction | backend
