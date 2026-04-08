---
id: metadata-filtering
title: Metadata Filtering & Faceted Browse
status: complete
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

- [x] Camera model facet shows all models with image counts
- [x] Lens facet shows all lenses with counts
- [x] Year/month facet allows date-based drilling
- [x] Selecting one facet updates others to reflect the filtered set
- [x] Combined facets produce correct results
- [x] Stats dashboard shows collection overview

## Tasks

- [x] Create faceted query API with dynamic count updates | backend, api
- [x] Build facet panel components | frontend
- [x] Build stats dashboard component | frontend
- [x] Integrate faceted results with thumbnail grid | frontend
