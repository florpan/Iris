---
id: semantic-image-search
title: Semantic Image Search
status: ready
milestone: smart
priority: medium
handoff: single
depends_on: ollama-client, admin-settings
---

## Overview

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

- [ ] Embeddings generated automatically during image sync
- [ ] Natural language queries return semantically relevant images
- [ ] Similarity search returns results ranked by relevance score
- [ ] Search works with complex descriptive queries
- [ ] Vector similarity search performs well on large collections
- [ ] Users can regenerate embeddings when changing models
- [ ] Search combines semantic and metadata results effectively
- [ ] System handles embedding failures gracefully
- [ ] Embedding storage scales efficiently with image count

## Tasks

- [ ] Add embedding tables | backend, database
- [ ] Add embedding generation to image sync pipeline | backend, ai
- [ ] Create vector similarity search API | backend, ai
- [ ] Build semantic search query processing | backend, ai
- [ ] Add semantic search to main search interface | frontend
- [ ] Create search result ranking that combines semantic + metadata | backend
- [ ] Implement batch embedding regeneration | backend, ai
- [ ] Add embedding management panel to Embeddings tab in admin settings | frontend
- [ ] Optimize vector search performance with proper indexing | backend, database

## Open Questions

