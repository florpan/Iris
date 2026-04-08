---
id: metadata-filtering
title: Metadata Filtering & Faceted Browse
status: ready
milestone: browsing
priority: medium
handoff: single
dependsOn: search
depends_on: search
---

## Overview

Beyond search, provide faceted browsing where users can explore images by metadata dimensions: by camera, by lens, by date, by format, by location. Each facet shows available values with counts, letting users drill down interactively. Think of it as "browse by camera" showing all camera models found in the collection with image counts.

## Requirements

- Facet panels for: camera model, lens model, file format, year/month, focal length ranges, ISO ranges
- Each facet value shows image count
- Facets combinable (camera + year = images from that camera in that year)
- Faceted browse results in the same thumbnail grid
- Facet values update dynamically based on current selection (selecting a camera updates lens counts to show only lenses used with that camera)
- Quick stats dashboard: total images, images by format, date range span, most-used camera, storage size

## Acceptance Criteria

- [ ] Camera model facet shows all models with image counts
- [ ] Lens facet shows all lenses with counts
- [ ] Year/month facet allows date-based drilling
- [ ] Selecting one facet updates others to reflect the filtered set
- [ ] Combined facets produce correct results
- [ ] Stats dashboard shows collection overview

## Tasks

- [ ] Create faceted query API with dynamic count updates | backend, api
- [ ] Build facet panel components | frontend
- [ ] Build stats dashboard component | frontend
- [ ] Integrate faceted results with thumbnail grid | frontend
