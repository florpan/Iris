---
id: source-management
title: Source Folder & Work Folder Management
status: pending
milestone: foundation
priority: high
handoff: single
dependsOn: project-setup
---

## Overview

Users configure one or more source folders where their images live and a single work folder where Iris stores thumbnails and other generated data. Source folders are strictly read-only. The work folder mirrors the source folder structure: `<workfolder>/<source-name>/<path-in-source>/`.

## Key Design Decisions

### Multiple Sources, One Work Folder
Each source folder gets a user-assigned name (e.g., "NAS Photos", "Camera SD"). The work folder organizes by source name to avoid path collisions: `work/nas-photos/2024/vacation/thumb.webp`.

### Source Types
Initially: local filesystem paths and network shares (SMB/NFS mounted as local paths). Architecture should allow adding cloud sources (Google Drive, OneDrive) later without restructuring.

### Read-Only Sources
Iris must never write, modify, or delete anything in source folders. All generated data goes to the work folder.

## Requirements

- Settings page to add/remove/edit source folders
- Settings page to configure work folder path
- Source folder validation (exists, readable, is a directory)
- Work folder validation (exists, writable)
- Database storage for source configurations
- API endpoints for CRUD on sources and work folder config

## Acceptance Criteria

- [ ] User can add a source folder with a name and path
- [ ] User can set the work folder path
- [ ] Source folder is validated as existing and readable
- [ ] Work folder is validated as writable
- [ ] Multiple source folders can be configured
- [ ] Source configurations persist in database
- [ ] Work folder structure created as `<work>/<source-name>/`

## Tasks

- [ ] Create database schema for source folders and app settings | backend, database
- [ ] Create API endpoints for source CRUD and work folder config | backend, api
- [ ] Build settings page with source folder management UI | frontend
- [ ] Implement path validation (readable source, writable work folder) | backend
- [ ] Create work folder directory structure mirroring sources | backend
