-- Sync history and source availability tracking for Iris

CREATE TABLE IF NOT EXISTS "sync_runs" (
  "id" serial PRIMARY KEY NOT NULL,
  "source_folder_id" integer REFERENCES "source_folders"("id") ON DELETE SET NULL,
  "trigger" text NOT NULL DEFAULT 'manual',
  "status" text NOT NULL DEFAULT 'running',
  "scanned" integer NOT NULL DEFAULT 0,
  "added" integer NOT NULL DEFAULT 0,
  "updated" integer NOT NULL DEFAULT 0,
  "skipped" integer NOT NULL DEFAULT 0,
  "missing" integer NOT NULL DEFAULT 0,
  "error_count" integer NOT NULL DEFAULT 0,
  "errors" jsonb DEFAULT '[]',
  "started_at" timestamp NOT NULL DEFAULT now(),
  "completed_at" timestamp
);

CREATE TABLE IF NOT EXISTS "source_sync_status" (
  "source_folder_id" integer PRIMARY KEY NOT NULL REFERENCES "source_folders"("id") ON DELETE CASCADE,
  "last_sync_at" timestamp,
  "last_sync_run_id" integer REFERENCES "sync_runs"("id") ON DELETE SET NULL,
  "available" boolean NOT NULL DEFAULT true,
  "unavailable_reason" text,
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS "sync_runs_started_at_idx" ON "sync_runs" ("started_at");
CREATE INDEX IF NOT EXISTS "sync_runs_source_folder_idx" ON "sync_runs" ("source_folder_id");
