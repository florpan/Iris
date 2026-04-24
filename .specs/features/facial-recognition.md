---
id: facial-recognition
title: Facial Recognition
status: draft
milestone: smart
priority: medium
handoff: single
depends_on: ollama-client, admin-settings
---

## Overview

Detect and recognize faces in images using Ollama-hosted vision models. Allow users to identify people by name, search for images containing specific individuals, and browse photos by detected faces. Uses a separate Ollama instance for GPU-accelerated inference.

## Requirements

- Detect faces in images during sync process using Ollama vision models
- Extract face embeddings for similarity matching
- Allow users to assign names to detected faces
- Merge similar face detections into person clusters
- Search images by person name
- Browse all photos containing a specific person
- Face detection confidence thresholds (configurable)
- Privacy controls for face data storage and deletion
- Handle multiple faces per image
- Face bounding box storage for UI display

## Technical Design

**Ollama Integration:**
- Separate Ollama instance running vision-capable models (llava, bakllava, or custom face detection models)
- Uses shared Ollama client from `ollama-client` feature
- Configurable Ollama endpoint URL

**Database Schema:**
- `faces` table: id, image_id, bounding_box (x,y,w,h), confidence, embedding_vector, person_id
- `persons` table: id, name, created_at, face_count, representative_face_id
- Add pgvector extension for similarity search on embeddings

**Processing Pipeline:**
- During image sync, send thumbnails to Ollama for face detection
- Store detected faces with bounding boxes and embeddings
- Automatic clustering of similar faces using cosine similarity
- Manual person assignment and merging by user

**API Design:**
- GET /api/faces - list all detected faces
- GET /api/persons - list all identified persons
- POST /api/persons/:id/assign - assign face to person
- POST /api/persons/merge - merge two persons
- GET /api/images/person/:id - images containing specific person

## Acceptance Criteria

- [ ] Face detection runs automatically during image sync
- [ ] Faces are detected with bounding boxes and confidence scores
- [ ] Similar faces are automatically clustered together
- [ ] Users can assign names to face clusters
- [ ] Search returns images containing named persons
- [ ] Person browsing shows all photos of an individual
- [ ] Face data can be deleted for privacy
- [ ] System handles images with multiple faces
- [ ] Configurable confidence thresholds work correctly
- [ ] Face detection works with Ollama API integration

## Tasks

- [ ] Create faces and persons database tables | backend, database
- [ ] Add face detection to image sync pipeline | backend, ai
- [ ] Build face embedding similarity clustering | backend, ai
- [ ] Create person management API endpoints | backend
- [ ] Build person assignment and merging UI | frontend
- [ ] Add person search to main search interface | frontend
- [ ] Create person browsing page with photo grid | frontend
- [ ] Add face detection settings panel to Face Detection tab in admin settings | frontend

## Open Questions

