---
id: map-view
title: Map View — GPS-Based Image Display
status: pending
milestone: views
priority: medium
handoff: single
dependsOn: folder-navigation, search
---

## Overview

Display images on a Leaflet map based on their GPS coordinates. Works with any image set — a folder's contents, search results, or filtered results. Images cluster at zoom levels where they'd overlap, expanding into individual markers as you zoom in. Clicking a marker shows the thumbnail and links to the detail view.

## Key Design Decisions

### Clustering
Use marker clustering (e.g., Leaflet.markercluster) to handle thousands of geo-tagged images without performance issues. Cluster shows count, expands on click/zoom.

### Data Source Agnostic
Map view accepts any image result set — it's a display mode, not a separate data source. Browse a folder? Toggle to map view. Run a search? Toggle to map view. Filter by camera? Toggle to map view.

### No GPS = Not Shown
Images without GPS data simply don't appear on the map. Show a count: "Showing 234 of 1,089 images (855 have no GPS data)."

## Requirements

- Leaflet map with OpenStreetMap tiles (self-hostable tile source configurable)
- Marker clustering for performance
- Thumbnail popup on marker click
- Link from marker to image detail view
- Works with folder contents, search results, and filtered results
- Auto-fit map bounds to show all markers
- Count of shown vs total images (GPS vs no-GPS)
- Configurable tile source for self-hosted setups

## Acceptance Criteria

- [ ] Map displays markers for GPS-tagged images
- [ ] Clustering groups nearby markers at low zoom
- [ ] Clicking marker shows thumbnail popup
- [ ] Popup links to image detail view
- [ ] Map works with folder, search, and filter results
- [ ] Map auto-fits to show all markers
- [ ] GPS count indicator shown
- [ ] Tile source configurable

## Tasks

- [ ] Create API endpoint for images with GPS data (paginated, with coordinates) | backend, api
- [ ] Integrate Leaflet with React | frontend
- [ ] Implement marker clustering | frontend
- [ ] Build thumbnail popup component for markers | frontend
- [ ] Add map view toggle to folder/search/filter views | frontend
- [ ] Implement auto-fit bounds | frontend
- [ ] Add tile source configuration to settings | frontend, backend
