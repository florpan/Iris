---
id: timeline-view
title: Timeline View — Chronological Image Display
status: pending
milestone: views
priority: medium
handoff: single
dependsOn: folder-navigation, search
---

## Overview

Display images chronologically on a visual timeline. Groups images by date (day, month, year) with thumbnail strips for each group. Works with any result set — folder contents, search results, or filtered results. Enables fast visual scanning of "what happened when."

## Key Design Decisions

### Grouping Levels
Three zoom levels: Year → Month → Day. At year level, show one representative thumbnail per month. At month level, show a few per day. At day level, show all images as a grid. The user scrolls or zooms between levels.

### Date Source
Use EXIF DateTimeOriginal as the primary date. Fall back to file modification date if no EXIF date. Show which date source is being used.

### Virtual Scrolling
For large collections spanning years, the timeline must be virtualized. Only render visible date groups + a buffer.

## Requirements

- Chronological display grouped by year/month/day
- Zoomable between grouping levels
- Representative thumbnails per group at higher levels
- Full thumbnail grid at day level
- Works with folder, search, and filter results
- Virtual scrolling for large date ranges
- Date source indicator (EXIF vs file date)
- Jump-to-date control

## Acceptance Criteria

- [ ] Images grouped by date with year/month/day levels
- [ ] Zoom between grouping levels
- [ ] Day level shows full image grid
- [ ] Timeline works with folder, search, and filter results
- [ ] Large collections (years of images) scroll smoothly
- [ ] Jump-to-date navigates to specific date
- [ ] Date source shown (EXIF date vs file date)

## Tasks

- [ ] Create API endpoint for date-grouped image data | backend, api
- [ ] Build timeline layout component with grouping levels | frontend
- [ ] Implement zoom between year/month/day levels | frontend
- [ ] Add virtual scrolling for large timelines | frontend
- [ ] Build jump-to-date control | frontend
- [ ] Add timeline view toggle to folder/search/filter views | frontend
