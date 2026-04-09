-- Tags enhancement: add usage_count to tags, created_at + composite PK to image_tags

-- Add usage_count to tags table for tracking how many images use each tag
ALTER TABLE "tags" ADD COLUMN IF NOT EXISTS "usage_count" integer NOT NULL DEFAULT 0;

-- Add created_at to image_tags table
ALTER TABLE "image_tags" ADD COLUMN IF NOT EXISTS "created_at" timestamp NOT NULL DEFAULT now();

-- Add composite primary key to image_tags (image_id, tag_id)
-- First drop any existing PK or unique constraint if present, then add the composite PK
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'image_tags'::regclass
      AND contype = 'p'
  ) THEN
    ALTER TABLE "image_tags" ADD CONSTRAINT "image_tags_pkey" PRIMARY KEY ("image_id", "tag_id");
  END IF;
END $$;

-- Backfill usage_count for existing data
UPDATE "tags" t
SET "usage_count" = (
  SELECT count(*) FROM "image_tags" it WHERE it.tag_id = t.id
);

-- Index on usage_count for sorting by popularity
CREATE INDEX IF NOT EXISTS "tags_name_idx" ON "tags" ("name");
CREATE INDEX IF NOT EXISTS "tags_usage_count_idx" ON "tags" ("usage_count");
