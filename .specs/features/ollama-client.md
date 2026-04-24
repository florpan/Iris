---
id: ollama-client
title: Ollama Client
status: draft
milestone: smart
priority: high
handoff: single
---
## Overview

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

- [ ] Ollama URL is configurable via environment variable and config.yaml
- [ ] Client exposes typed helpers for generate and embed API calls
- [ ] Health check reports Ollama availability on server startup
- [ ] Requests time out and return a clear error when Ollama is unresponsive
- [ ] Missing or unavailable model surfaces a descriptive error message
- [ ] Retry logic handles transient network failures

## Tasks

- [ ] Add IRIS_OLLAMA_URL to config loader | backend
- [ ] Implement typed fetch wrappers for /api/generate and /api/embed | backend, ai
- [ ] Add health check call on server startup | backend
- [ ] Add timeout and retry logic | backend
- [ ] Write unit tests for error and retry paths | testing

## Open Questions

- [ ] {Question 1}
