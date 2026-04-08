# Implementation Summary: Source Folder & Work Folder Configuration

## Overview

Implemented source folder and work folder configuration for Iris, enabling Docker-first setup-time configuration via YAML file and/or environment variables. The implementation adds a config loader (`src/backend/lib/config.ts`), a startup validation/setup module (`src/backend/lib/startup.ts`), and integrates both into the server entrypoint and config API route. Sources and work folder are now fully configurable without touching the database directly; config drives DB state at startup via a sync step.

## Decisions Made

- **No YAML library dependency**: Since no packages are installed in the build environment, a minimal YAML parser was written specifically for the Iris config format. It handles the exact YAML structure documented in the spec (sources list + workFolder key) without supporting full YAML.
- **Config caching**: Config is loaded once and cached in memory. A `resetConfig()` export allows cache invalidation for future test use.
- **DB sync on startup**: The existing codebase uses a PostgreSQL DB for sources (other routes read from `source_folders` table). To remain compatible without rewriting those routes, `runStartup()` syncs the config-file sources to the DB — inserting new sources, re-enabling removed-then-readded sources, and disabling sources no longer in config.
- **Non-fatal missing sources**: Missing or unreadable source folders log a warning but do not crash the server, matching the spec's requirement for network share resilience.
- **Fatal work folder**: If the work folder cannot be created or written to, this is logged as a fatal error. The server still starts to allow health checks, but functionality will be degraded.
- **Config endpoint updated**: The `GET /api/config` endpoint now reads from the in-memory config (file + env) rather than only from the DB, providing real-time availability status for both sources and work folder.

## Files Created

- `src/backend/lib/config.ts` — Config schema, YAML parser, env-var parser, and `loadConfig()` function
- `src/backend/lib/startup.ts` — Startup validation (readable/writable checks), work folder creation, work subdirectory creation, and DB sync

## Files Modified

- `src/backend/index.ts` — Added `runStartup()` call on server start
- `src/backend/routes/config.ts` — Updated to use `loadConfig()` and include live availability status for work folder and sources

## Dependencies Added

None — the implementation uses only Node.js built-ins (`node:fs`, `node:path`) and the existing Drizzle ORM client already in the project.

## Issues Encountered

- No YAML parsing library available in the isolated build environment. Resolved by writing a minimal parser for the exact config structure used in the spec.

## Acceptance Criteria Verification

- [x] Source folders configurable via config file — `loadConfigFile()` reads `config.yaml` (or `CONFIG_FILE` env var path) and parses sources list
- [x] Source folders configurable via environment variables — `loadEnvConfig()` parses `IRIS_SOURCES=name:/path,name2:/path2`
- [x] Work folder configurable via config file and environment — `workFolder` key in YAML; `IRIS_WORK_FOLDER` or `WORK_DIR` env vars
- [x] Startup validates source folders are readable — `isReadable()` check in `runStartup()` with `fs.accessSync(path, R_OK)`
- [x] Startup validates work folder is writable — `isWritable()` check with `fs.accessSync(path, W_OK | R_OK)`; also creates if missing
- [x] Work folder structure created as `<work>/<source-name>/` — `ensureDir(path.join(absWorkFolder, source.name))` per source in `runStartup()`
- [x] Missing source folder logs warning but doesn't crash — `console.warn()` and continues; result tracked in `StartupResult.warnings`

## Known Limitations

- The minimal YAML parser does not support full YAML spec (no anchors, aliases, multi-line strings, or flow style). It handles only the documented config format.
- Paths with commas in `IRIS_SOURCES` env var are not supported (documented in code comments).
- DB sync runs async and does not block server startup — if the DB is unavailable at startup the sync is skipped silently (non-fatal).

## Testing

- Test runner disabled in build environment. The implementation was verified by code review:
  - Config loader correctly applies env-var override over file config
  - YAML parser handles all documented config patterns
  - Startup functions use `fs.accessSync` with appropriate flags
  - Work subdirectories are created with `fs.mkdirSync({ recursive: true })`

## Skipped Tasks

None — all spec tasks were implementation tasks.
