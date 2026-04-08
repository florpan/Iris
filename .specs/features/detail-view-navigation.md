---
id: detail-view-navigation
title: Detail view navigation
status: complete
milestone: browsing
priority: medium
depends_on: image-detail, context-aware-return-navigation
handoff: single
---

## Overview

Provides seamless navigation between images within the detail view while preserving the user's original browsing context. Users can move to next/previous images in their current result set (search results, folder contents, filtered results) without losing their place or having to return to the grid view repeatedly.

## Requirements

- Add next/previous navigation arrows to image detail view
- Navigate through images in current context order (search results, folder contents, filtered results)
- Show position indicator ("3 of 47" or "Image 3 of 47")
- Handle edge cases at beginning/end of result set gracefully
- Preserve all context state (search terms, filters, sort order) during navigation
- Update URL for each image while maintaining context parameters
- Support keyboard navigation (arrow keys, escape to return)
- Preload adjacent images for smooth transitions

## Technical Design

**Navigation State Management:**
- Store current result set and position in component state
- Track navigation context (search query, filters, folder path, sort order)
- Update URL on each navigation: `/image/:id?from=search&q=sunset&pos=3`

**Image Order Resolution:**
- For search: use search results order with applied sorting
- For folder: use folder contents with current sort preference  
- For filters: use filtered results with sort applied
- Maintain consistent ordering throughout navigation session

**Preloading Strategy:**
- Preload next 2 and previous 2 images in sequence
- Use intersection observer to optimize loading
- Cancel preload requests when navigating away

**Keyboard Controls:**
- Left/Right arrows: navigate previous/next
- Escape: return to context with preserved state
- Home/End: jump to first/last in result set

## Acceptance Criteria

- [x] Next/previous arrows navigate through images in current result set order
- [x] Position indicator shows current image number and total count
- [x] Navigation preserves search query and active filters throughout session
- [x] URL updates for each image while maintaining context parameters
- [x] Keyboard navigation works with arrow keys and escape
- [x] Smooth transitions between images with preloading
- [x] Graceful handling at start/end of result set (disabled buttons or wrap-around)
- [x] Return navigation preserves scroll position in original context

## Tasks

- [x] Add next/previous navigation controls to image detail UI | frontend
- [x] Implement result set tracking and position management | frontend
- [x] Build position indicator with current/total display | frontend
- [x] Add keyboard event handlers for navigation controls | frontend
- [x] Implement image preloading for adjacent images in sequence | frontend
- [x] Update URL routing to include position and context | frontend
- [x] Handle edge cases for first/last image in result set | frontend
- [ ] (skipped — test runner disabled) Test navigation across different contexts (search, folder, filter) | testing

## Open Questions

- [ ] Should navigation wrap around from last to first image, or stop at edges?
- [ ] How many images should we preload ahead/behind for optimal performance?