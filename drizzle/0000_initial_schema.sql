-- Initial schema for Iris image organizer

CREATE TABLE IF NOT EXISTS "source_folders" (
  "id" serial PRIMARY KEY NOT NULL,
  "path" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "enabled" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "images" (
  "id" serial PRIMARY KEY NOT NULL,
  "source_folder_id" integer NOT NULL REFERENCES "source_folders"("id") ON DELETE CASCADE,
  "relative_path" text NOT NULL,
  "file_name" text NOT NULL,
  "file_size" bigint,
  "mime_type" text,
  "width" integer,
  "height" integer,
  "thumbnail_path" text,
  "taken_at" timestamp,
  "camera_model" text,
  "lens_model" text,
  "iso" integer,
  "aperture" real,
  "shutter_speed" text,
  "focal_length" real,
  "latitude" real,
  "longitude" real,
  "altitude" real,
  "iptc_title" text,
  "iptc_description" text,
  "iptc_keywords" jsonb,
  "iptc_copyright" text,
  "metadata" jsonb,
  "file_modified_at" timestamp,
  "missing" boolean NOT NULL DEFAULT false,
  "indexed" boolean NOT NULL DEFAULT false,
  "indexed_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "tags" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL UNIQUE,
  "color" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "image_tags" (
  "image_id" integer NOT NULL REFERENCES "images"("id") ON DELETE CASCADE,
  "tag_id" integer NOT NULL REFERENCES "tags"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "settings" (
  "key" text PRIMARY KEY NOT NULL,
  "value" jsonb,
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS "images_source_folder_idx" ON "images" ("source_folder_id");
CREATE INDEX IF NOT EXISTS "images_taken_at_idx" ON "images" ("taken_at");
CREATE INDEX IF NOT EXISTS "images_relative_path_idx" ON "images" ("relative_path");
CREATE INDEX IF NOT EXISTS "image_tags_image_idx" ON "image_tags" ("image_id");
CREATE INDEX IF NOT EXISTS "image_tags_tag_idx" ON "image_tags" ("tag_id");
