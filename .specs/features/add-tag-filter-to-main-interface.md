---
id: add-tag-filter-to-main-interface
title: Add tag filter to main interface
status: ready
milestone: browsing
priority: medium
depends_on: main-interface-screen, image-tagging-system, metadata-filtering
handoff: single
---

## Overview

Extends the main interface sidebar with tag filtering capabilities, allowing users to filter images by tags they've applied. Provides a searchable tag list with usage counts and supports multiple tag selection with AND/OR logic options.

## Requirements

- Add tag filter section to metadata filtering panel in sidebar
- Display all available tags with usage counts (e.g., "Vacation (23)")
- Support searching/filtering the tag list for large tag collections
- Allow multi-select tag filtering with visual selection indicators
- Provide AND/OR logic toggle for multiple tag selection
- Show active tag filters with remove buttons in filter summary
- Clear individual tag filters or all tag filters at once
- Update results in real-time as tag filters are applied/removed
- Handle tag filtering combined with other metadata filters

## Technical Design

**Tag Filter Panel Layout:**
```
Tags (234 total)
┌─────────────────────┐
│ Search tags...      │ ← Filter tag list
├─────────────────────┤
│ ☐ Vacation (23)     │ ← Multi-select checkboxes
│ ☐ Family (18)       │   with usage counts
│ ☐ Beach (15)        │
│ ☐ Sunset (12)       │
│ ... (show more)     │
└─────────────────────┘
Filter Logic: ⚪ AND ⚪ OR
```

**Integration with Existing Filters:**
- Tag filters combine with metadata filters using AND logic
- Tag filter state stored in URL: `?tags=vacation,beach&tagLogic=and`
- Clear filters button clears tags along with other filter types

**Performance Optimization:**
- Lazy load tag list for collections with >100 tags
- Debounce tag search input to avoid excessive API calls
- Cache tag usage counts and refresh periodically

**API Integration:**
- `GET /api/tags?search=query&limit=50` - Get filtered tag list
- Extend existing image search API to accept tag filter parameters
- Include tag filters in metadata filtering query logic

## Acceptance Criteria

- [ ] Tag filter panel appears in sidebar with all available tags and usage counts
- [ ] Users can search/filter the tag list to find specific tags
- [ ] Multiple tags can be selected with checkboxes and visual indicators
- [ ] AND/OR toggle controls how multiple tag filters are combined
- [ ] Active tag filters display in filter summary with remove buttons
- [ ] Image results update in real-time as tag filters are applied/removed
- [ ] Tag filters work correctly in combination with other metadata filters
- [ ] Clear filters functionality removes tag filters along with others
- [ ] Tag filter state persists in URL and across page refreshes

## Tasks

- [ ] Add tag filter section to metadata filtering sidebar component | frontend
- [ ] Implement searchable tag list with usage counts | frontend
- [ ] Build multi-select tag interface with checkboxes and visual feedback | frontend
- [ ] Add AND/OR logic toggle for multiple tag selection | frontend
- [ ] Integrate tag filters with existing search/filter API calls | frontend
- [ ] Update filter summary component to display active tag filters | frontend
- [ ] Add URL state management for tag filter persistence | frontend
- [ ] Optimize tag list loading for large tag collections | frontend
- [ ] Test tag filtering combined with other filter types | testing

## Open Questions

- [ ] Should we limit the number of tags displayed initially to improve performance?
- [ ] How should we handle tag filtering when no images have tags yet?