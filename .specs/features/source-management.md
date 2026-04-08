---
id: source-management
title: Source Folder & Work Folder Configuration
status: complete
milestone: foundation
priority: high
handoff: single
dependsOn: project-setup
depends_on: api-layer
---

## Overview

Configure source folders (where images live) and a work folder (where Iris stores thumbnails and generated data). This is a setup-time configuration, not a runtime UI feature. Configuration lives in a settings file or environment variables, making it easy to set up in Docker via volume mounts and env vars.

## Key Design Decisions

### Configuration, Not UI
Source and work folders are configured once at setup time. No settings page needed — this is infrastructure config, like a database URL. A `config.yaml` or environment variables handle it.

### Docker-First
In a typical Docker deployment, source folders are mounted as read-only volumes and the work folder as a read-write volume. Config maps directly:

```yaml
# config.yaml
sources:
  - name: photos
    path: /data/photos
  - name: camera
    path: /data/camera
workFolder: /data/work
```

Or via environment: `IRIS_SOURCES=photos:/data/photos,camera:/data/camera` and `IRIS_WORK_FOLDER=/data/work`.

### Read-Only Sources
Source folders are strictly read-only. Iris never writes to them.

### Work Folder Structure
Work folder mirrors source structure: `<work>/<source-name>/<relative-path>/`. This avoids path collisions when multiple sources have identical subfolder names.

## Requirements

- Configuration via YAML file and/or environment variables
- One or more named source folders
- One work folder
- Startup validation: sources exist and are readable, work folder exists and is writable
- Work folder subdirectories created per source name on startup
- Graceful error on missing/unreadable source (log warning, skip, don't crash)

## Acceptance Criteria

- [x] Source folders configurable via config file
- [x] Source folders configurable via environment variables
- [x] Work folder configurable via config file and environment
- [x] Startup validates source folders are readable
- [x] Startup validates work folder is writable
- [x] Work folder structure created as `<work>/<source-name>/`
- [x] Missing source folder logs warning but doesn't crash (network share may be temporarily unavailable)

## Tasks

- [x] Create config schema and loader (YAML file + env var fallback) | backend
- [x] Implement startup validation for source and work folders | backend
- [x] Create work folder directory structure on startup | backend
- [x] Create API endpoint to read current config (for UI status display) | backend, api
