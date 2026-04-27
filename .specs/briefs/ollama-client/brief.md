# Implementation Brief: Ollama Client

> **Implement this feature using the Waymark workflow.** Read `.specs/agents.md` for the full process. You MUST: update the spec status to `in-progress`, mark tasks `[x]` as you complete them, verify acceptance criteria, write an implementation summary to `.specs/briefs/ollama-client/implementation-summary.md`, and update status to `complete` when done.

## What to Build
Shared HTTP client for communicating with an Ollama instance. Provides a configured, reusable client for making inference requests to vision-language models, used by semantic image search and facial recognition. Handles endpoint configuration, request/response typing, error handling, and retries.

## Requirements
- Configurable Ollama endpoint URL (env var + config.yaml)
- Typed request/response wrappers for Ollama's generate and embed APIs
- Retry logic with exponential backoff for transient failures
- Health check to verify Ollama availability on startup
- Timeout configuration for long-running inference requests
- Graceful error handling — surface clear messages when Ollama is unreachable or a model is missing

## Technical Design
Single module at `src/backend/lib/ollama.ts` exporting a configured client instance. Reads `IRIS_OLLAMA_URL` from environment (default: `http://localhost:11434`). Wraps `fetch` with typed helpers for the endpoints used downstream (`/api/generate`, `/api/embed`). No external SDK dependency — Ollama's API is simple enough to wrap directly.

## Acceptance Criteria
Defined in `.specs/features/ollama-client.md` § Acceptance Criteria. Mark them `[x]` in the spec file as you verify them.

## Tasks
Defined in `.specs/features/ollama-client.md` § Tasks. Mark each `[x]` in the spec file immediately after completing it.

## Context
- This feature blocks:
  - Semantic Image Search (semantic-image-search) — ready
  - Facial Recognition (facial-recognition) — ready

## Constraints
### DO NOT implement (planned features — out of scope)
- Semantic Image Search (semantic-image-search)
- Admin Settings Page (admin-settings)
- Facial Recognition (facial-recognition)
