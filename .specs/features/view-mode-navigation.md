---
id: view-mode-navigation
title: View mode navigation
status: complete
milestone: views
priority: medium
handoff: single
depends_on: detail-view-navigation
---

## Overview

State management and transitions between grid, map, and timeline display modes while preserving search and filter context

## Requirements

- Resolves flow analysis finding: "Navigation between view modes undefined"
- Users need to switch between grid cards (folder-navigation), map view, and timeline view using dedicated toggle buttons, but no feature specs define how these transitions work or maintain search/filter state across view changes.

## Acceptance Criteria

- [x] Gap identified by flow analysis is resolved

## Tasks

- [x] Implement feature | backend
