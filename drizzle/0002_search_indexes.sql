-- Full-text search indexes for Iris search feature
-- GIN index on tsvector for fast full-text search across filename, IPTC fields

-- Combined tsvector expression:
--   file_name: weight B
--   iptc_title: weight A (highest priority)
--   iptc_description: weight B
--   iptc_keywords (jsonb array → text): weight B
CREATE INDEX IF NOT EXISTS "images_search_vector_idx"
  ON "images"
  USING GIN (
    (
      setweight(to_tsvector('simple', coalesce("file_name", '')), 'B') ||
      setweight(to_tsvector('simple', coalesce("iptc_title", '')), 'A') ||
      setweight(to_tsvector('simple', coalesce("iptc_description", '')), 'B') ||
      setweight(to_tsvector('simple', coalesce(
        (SELECT string_agg(kw, ' ') FROM jsonb_array_elements_text("iptc_keywords") AS kw),
        ''
      )), 'B')
    )
  );

-- Index for camera model filter (case-insensitive queries)
CREATE INDEX IF NOT EXISTS "images_camera_model_idx" ON "images" ("camera_model");

-- Index for lens model filter
CREATE INDEX IF NOT EXISTS "images_lens_model_idx" ON "images" ("lens_model");

-- Index for mime_type filter
CREATE INDEX IF NOT EXISTS "images_mime_type_idx" ON "images" ("mime_type");
