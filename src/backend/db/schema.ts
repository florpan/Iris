import {
  pgTable,
  serial,
  text,
  integer,
  bigint,
  boolean,
  timestamp,
  real,
  jsonb,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";

// ── Source Folders ──────────────────────────────────────────────────────────
export const sourceFolders = pgTable("source_folders", {
  id: serial("id").primaryKey(),
  path: text("path").notNull().unique(),
  name: text("name").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── Images ──────────────────────────────────────────────────────────────────
export const images = pgTable(
  "images",
  {
    id: serial("id").primaryKey(),
    sourceFolderId: integer("source_folder_id")
      .notNull()
      .references(() => sourceFolders.id, { onDelete: "cascade" }),
    // Relative path from source folder root
    relativePath: text("relative_path").notNull(),
    fileName: text("file_name").notNull(),
    fileSize: bigint("file_size", { mode: "number" }),
    mimeType: text("mime_type"),
    width: integer("width"),
    height: integer("height"),
    // Thumbnail path relative to work directory
    thumbnailPath: text("thumbnail_path"),
    // EXIF / metadata
    takenAt: timestamp("taken_at"),
    cameraModel: text("camera_model"),
    lensModel: text("lens_model"),
    iso: integer("iso"),
    aperture: real("aperture"),
    shutterSpeed: text("shutter_speed"),
    focalLength: real("focal_length"),
    // GPS
    latitude: real("latitude"),
    longitude: real("longitude"),
    altitude: real("altitude"),
    // IPTC fields
    iptcTitle: text("iptc_title"),
    iptcDescription: text("iptc_description"),
    iptcKeywords: jsonb("iptc_keywords").$type<string[]>(),
    iptcCopyright: text("iptc_copyright"),
    // Extra metadata as JSON
    metadata: jsonb("metadata"),
    // File tracking for incremental scan
    fileModifiedAt: timestamp("file_modified_at"),
    // Indexing state
    missing: boolean("missing").notNull().default(false),
    indexed: boolean("indexed").notNull().default(false),
    indexedAt: timestamp("indexed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("images_source_folder_idx").on(table.sourceFolderId),
    index("images_taken_at_idx").on(table.takenAt),
    index("images_relative_path_idx").on(table.relativePath),
    // Search indexes — GIN index defined in migration 0002_search_indexes.sql
    index("images_camera_model_idx").on(table.cameraModel),
    index("images_lens_model_idx").on(table.lensModel),
    index("images_mime_type_idx").on(table.mimeType),
  ]
);

// ── Tags ────────────────────────────────────────────────────────────────────
export const tags = pgTable("tags", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  color: text("color"),
  usageCount: integer("usage_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const imageTags = pgTable(
  "image_tags",
  {
    imageId: integer("image_id")
      .notNull()
      .references(() => images.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.imageId, table.tagId] }),
    index("image_tags_image_idx").on(table.imageId),
    index("image_tags_tag_idx").on(table.tagId),
  ]
);

// ── App Settings ─────────────────────────────────────────────────────────────
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── Sync Runs (history) ───────────────────────────────────────────────────────
// Records each completed sync scan for audit/history purposes.
export const syncRuns = pgTable(
  "sync_runs",
  {
    id: serial("id").primaryKey(),
    // null = all-sources scan; non-null = single source scan
    sourceFolderId: integer("source_folder_id").references(
      () => sourceFolders.id,
      { onDelete: "set null" }
    ),
    trigger: text("trigger").notNull().default("manual"), // "manual" | "scheduled"
    status: text("status").notNull().default("running"), // "running" | "completed" | "error"
    scanned: integer("scanned").notNull().default(0),
    added: integer("added").notNull().default(0),
    updated: integer("updated").notNull().default(0),
    skipped: integer("skipped").notNull().default(0),
    missing: integer("missing").notNull().default(0),
    errorCount: integer("error_count").notNull().default(0),
    errors: jsonb("errors").$type<string[]>().default([]),
    startedAt: timestamp("started_at").notNull().defaultNow(),
    completedAt: timestamp("completed_at"),
  },
  (table) => [
    index("sync_runs_started_at_idx").on(table.startedAt),
    index("sync_runs_source_folder_idx").on(table.sourceFolderId),
  ]
);

// ── Source Sync Status ────────────────────────────────────────────────────────
// Tracks per-source sync status: last sync time and availability.
export const sourceSyncStatus = pgTable("source_sync_status", {
  sourceFolderId: integer("source_folder_id")
    .primaryKey()
    .references(() => sourceFolders.id, { onDelete: "cascade" }),
  lastSyncAt: timestamp("last_sync_at"),
  lastSyncRunId: integer("last_sync_run_id").references(() => syncRuns.id, {
    onDelete: "set null",
  }),
  available: boolean("available").notNull().default(true),
  unavailableReason: text("unavailable_reason"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── Tag Management Audit Log ──────────────────────────────────────────────────
// Records tag management operations: rename, merge, delete, import, etc.
export const tagManagementLog = pgTable(
  "tag_management_log",
  {
    id: serial("id").primaryKey(),
    operation: text("operation").notNull(), // "rename" | "merge" | "delete" | "bulk_delete" | "import"
    details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("tag_mgmt_log_created_at_idx").on(table.createdAt),
    index("tag_mgmt_log_operation_idx").on(table.operation),
  ]
);

// ── Type Helpers ─────────────────────────────────────────────────────────────
export type Image = typeof images.$inferSelect;
export type NewImage = typeof images.$inferInsert;
export type SourceFolder = typeof sourceFolders.$inferSelect;
export type SyncRun = typeof syncRuns.$inferSelect;
export type NewSyncRun = typeof syncRuns.$inferInsert;
export type SourceSyncStatus = typeof sourceSyncStatus.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
export type ImageTag = typeof imageTags.$inferSelect;
export type TagManagementLog = typeof tagManagementLog.$inferSelect;
