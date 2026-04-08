---
id: image-detail
title: Image Detail View
status: ready
milestone: browsing
priority: high
handoff: single
dependsOn: folder-navigation
depends_on: folder-navigation
---

## Overview

Clicking an image in the grid opens a detail view showing the full-resolution image (served from source folder) alongside all extracted metadata. The detail view supports navigating to previous/next images in the current folder context.

## Key Design Decisions

### Full Image Serving
Serve the original image from the source folder via a streaming API endpoint. Source folders are read-only but readable. For RAW files, serve the embedded JPEG preview or a converted JPEG — don't attempt to display RAW directly in the browser.

### Metadata Display
Organized metadata panels: Camera info (model, lens, settings), File info (size, dimensions, format, dates), Location (GPS coordinates + mini map if available), IPTC (title, description, keywords), and a raw metadata accordion for everything else.

## Requirements

- Full-resolution image display (original from source)
- RAW file preview (embedded JPEG or conversion)
- Complete metadata display organized by category
- Previous/next navigation within current folder
- GPS mini-map when coordinates available
- Keyboard navigation (arrow keys for prev/next, Escape to close)
- Zoom/pan support for large images

## Acceptance Criteria

- [ ] Full-resolution image displayed from source folder
- [ ] RAW files show preview image
- [ ] All extracted metadata displayed in organized sections
- [ ] Camera, file, location, IPTC sections clearly separated
- [ ] Previous/next navigation works within folder context
- [ ] GPS coordinates shown on mini-map when available
- [ ] Keyboard shortcuts work (arrows, escape)

## Tasks

- [ ] Create streaming image serving endpoint (original from source) | backend, api
- [ ] Handle RAW file preview serving | backend
- [ ] Build detail view layout with image + metadata panels | frontend
- [ ] Build metadata display components (camera, file, location, IPTC, raw) | frontend
- [ ] Add GPS mini-map component using Leaflet | frontend
- [ ] Implement prev/next navigation | frontend
- [ ] Add keyboard shortcut support | frontend
