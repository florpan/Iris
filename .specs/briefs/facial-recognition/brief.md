# Implementation Brief: Facial Recognition

> **Implement this feature using the Waymark workflow.** Read `.specs/agents.md` for the full process. You MUST: update the spec status to `in-progress`, mark tasks `[x]` as you complete them, verify acceptance criteria, write an implementation summary to `.specs/briefs/facial-recognition/implementation-summary.md`, and update status to `complete` when done.

## What to Build
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
Defined in `.specs/features/facial-recognition.md` § Acceptance Criteria. Mark them `[x]` in the spec file as you verify them.

## Tasks
Defined in `.specs/features/facial-recognition.md` § Tasks. Mark each `[x]` in the spec file immediately after completing it.

## Context
- Dependencies:
  - ⏳ Ollama Client (ollama-client) — ready
  - ⏳ Admin Settings Page (admin-settings) — ready

## Constraints
### DO NOT implement (planned features — out of scope)
- Ollama Client (ollama-client)
- Semantic Image Search (semantic-image-search)
- Admin Settings Page (admin-settings)
