-- Tag management audit log: track rename, merge, delete, import operations

CREATE TABLE IF NOT EXISTS "tag_management_log" (
  "id" serial PRIMARY KEY,
  "operation" text NOT NULL,
  "details" jsonb NOT NULL DEFAULT '{}',
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "tag_mgmt_log_created_at_idx" ON "tag_management_log" ("created_at");
CREATE INDEX IF NOT EXISTS "tag_mgmt_log_operation_idx" ON "tag_management_log" ("operation");
