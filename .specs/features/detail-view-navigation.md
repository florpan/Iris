---
id: detail-view-navigation
title: Detail view navigation
status: ready
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

- [ ] Next/previous arrows navigate through images in current result set order
- [ ] Position indicator shows current image number and total count
- [ ] Navigation preserves search query and active filters throughout session
- [ ] URL updates for each image while maintaining context parameters
- [ ] Keyboard navigation works with arrow keys and escape
- [ ] Smooth transitions between images with preloading
- [ ] Graceful handling at start/end of result set (disabled buttons or wrap-around)
- [ ] Return navigation preserves scroll position in original context

## Tasks

- [ ] Add next/previous navigation controls to image detail UI | frontend
- [ ] Implement result set tracking and position management | frontend
- [ ] Build position indicator with current/total display | frontend
- [ ] Add keyboard event handlers for navigation controls | frontend
- [ ] Implement image preloading for adjacent images in sequence | frontend
- [ ] Update URL routing to include position and context | frontend
- [ ] Handle edge cases for first/last image in result set | frontend
- [ ] Test navigation across different contexts (search, folder, filter) | testing

## Open Questions

- [ ] Should navigation wrap around from last to first image, or stop at edges?
- [ ] How many images should we preload ahead/behind for optimal performance?