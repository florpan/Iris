---
id: context-aware-return-navigation
title: Context-aware return navigation
status: in-progress
milestone: browsing
priority: medium
depends_on: image-detail, search, metadata-filtering
handoff: single
---

## Overview

Implements intelligent return navigation from image detail views that preserves the user's browsing context. When viewing an image detail, users can return to their previous context (search results, filtered results, folder view, etc.) with all previous state preserved including scroll position, selected filters, and search terms.

## Requirements

- Track navigation context when entering image detail view (search, filter, folder browse)
- Preserve search query, active filters, and view state when navigating to detail
- Provide contextual back button with appropriate label ("Back to search", "Back to folder")
- Maintain scroll position and selection state when returning to previous context
- Handle browser back button correctly to return to preserved context
- Support deep linking to images while gracefully handling missing context

## Technical Design

**Context Tracking:**
- URL structure: `/image/:id?from=search&q=sunset&filters=...` 
- Context types: 'folder', 'search', 'filter', 'timeline', 'map'
- Store context in URL params and session storage as backup

**State Preservation:**
- Encode search query, active filters, view mode in URL
- Use sessionStorage for scroll position and selection state
- Implement custom history navigation to restore state correctly

**Back Button Implementation:**
- Dynamic button label based on context type
- Use `window.history.back()` with state restoration
- Fallback to main interface if context is unavailable

**URL Examples:**
- From search: `/image/123?from=search&q=vacation&page=2`
- From filter: `/image/123?from=filter&tags=sunset,beach&location=hawaii`
- From folder: `/image/123?from=folder&path=/photos/2023`

## Acceptance Criteria

- [x] Back button shows correct context label ("Back to search results", "Back to Hawaii photos")
- [x] Returning from image detail preserves search query and results
- [x] Active filters remain applied when returning from image detail
- [x] Scroll position is restored to where user was before viewing detail
- [x] Browser back button works correctly and maintains context
- [x] Deep links to images work even without full context (graceful degradation)
- [x] Context is preserved across page refreshes using URL parameters

## Tasks

- [x] Implement URL parameter encoding for navigation context | frontend
- [x] Add context tracking to image detail navigation entry points | frontend
- [x] Build dynamic back button with context-aware labels | frontend
- [x] Implement state restoration for scroll position and selection | frontend
- [x] Handle browser back button with custom history management | frontend
- [x] Add graceful fallbacks for missing or invalid context | frontend
- [ ] (skipped — test runner disabled) Test deep linking and context preservation across browser refresh | testing

## Open Questions

- [ ] Should we limit how much context state we store in URLs to avoid overly long URLs?
- [ ] How long should we preserve context in sessionStorage before clearing it?