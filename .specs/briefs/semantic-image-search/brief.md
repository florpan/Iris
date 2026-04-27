# Implementation Brief: Semantic Image Search

> **Implement this feature using the Waymark workflow.** Read `.specs/agents.md` for the full process. You MUST: update the spec status to `in-progress`, mark tasks `[x]` as you complete them, verify acceptance criteria, write an implementation summary to `.specs/briefs/semantic-image-search/implementation-summary.md`, and update status to `complete` when done.

## What to Build
Enable semantic search of images using vision-language embeddings. Users can search using natural language queries like "sunset over mountains", "dog playing in park", or "people celebrating" and find visually similar images. Uses Ollama for embedding generation and pgvector for similarity search.

## Requirements
- Generate semantic embeddings for all images using vision models
- Natural language search queries converted to embeddings
- Similarity search using cosine distance
- Configurable similarity thresholds
- Batch embedding generation during sync
- Embedding regeneration when models change
- Search result ranking by semantic similarity
- Support for complex queries combining visual and text concepts
- Efficient storage and indexing of high-dimensional vectors
- Fallback to metadata search when embeddings unavailable

## Technical Design
**Embedding Strategy:**
- One embedding per image using vision-language models (CLIP-style)
- Models via Ollama: llava, bakllava, or custom vision encoders
- Embeddings stored as vectors (typically 512-1024 dimensions)
- pgvector extension for efficient similarity search

**Processing Pipeline:**
- During image sync, generate embeddings for new/changed images
- Send image + optional IPTC description to Ollama for multimodal embedding
- Store embeddings in dedicated table with image foreign key
- Batch processing to optimize Ollama API calls

**Search Architecture:**
- Convert user query to embedding using same Ollama model
- Vector similarity search using pgvector's <-> operator
- Combine semantic results with traditional metadata search
- Configurable weighting between semantic and metadata relevance

**Storage Considerations:**
- ~4KB per embedding (1024 float32 values)
- 10k images = ~40MB embedding storage
- Index size depends on dimension and HNSW parameters

**API Design:**
- GET /api/search/semantic?q=query - semantic search endpoint
- POST /api/embeddings/regenerate - rebuild embeddings with new model
- GET /api/embeddings/stats - embedding coverage and model info

## Acceptance Criteria
Defined in `.specs/features/semantic-image-search.md` § Acceptance Criteria. Mark them `[x]` in the spec file as you verify them.

## Tasks
Defined in `.specs/features/semantic-image-search.md` § Tasks. Mark each `[x]` in the spec file immediately after completing it.

## Context
- Dependencies:
  - ⏳ Ollama Client (ollama-client) — ready
  - ⏳ Admin Settings Page (admin-settings) — ready

## Constraints
### DO NOT implement (planned features — out of scope)
- Admin Settings Page (admin-settings)
- Ollama Client (ollama-client)
- Facial Recognition (facial-recognition)
