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
    // Extra metadata as JSON
    metadata: jsonb("metadata"),
    // Indexing state
    indexed: boolean("indexed").notNull().default(false),
    indexedAt: timestamp("indexed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("images_source_folder_idx").on(table.sourceFolderId),
    index("images_taken_at_idx").on(table.takenAt),
    index("images_relative_path_idx").on(table.relativePath),
  ]
);

// ── Tags ────────────────────────────────────────────────────────────────────
export const tags = pgTable("tags", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  color: text("color"),
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
  },
  (table) => [
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
