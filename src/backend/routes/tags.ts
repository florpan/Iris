import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { and, eq, ilike, sql, asc, desc, inArray } from "drizzle-orm";
import { db } from "../db/client";
import { tags, imageTags, images } from "../db/schema";

// ── Tag Validation ───────────────────────────────────────────────────────────

const MAX_TAG_LENGTH = 50;
const INVALID_CHARS = /[<>{}[\]\\^`|]/;

/**
 * Normalize a tag name: trim whitespace and lowercase.
 */
function normalizeTagName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Validate a tag name. Returns the normalized name or throws an HTTPException.
 */
export function validateTagName(raw: string): string {
  if (typeof raw !== "string") {
    throw new HTTPException(400, { message: "Tag name must be a string" });
  }
  const name = normalizeTagName(raw);
  if (name.length === 0) {
    throw new HTTPException(400, { message: "Tag name cannot be empty" });
  }
  if (name.length > MAX_TAG_LENGTH) {
    throw new HTTPException(400, {
      message: `Tag name too long (max ${MAX_TAG_LENGTH} characters)`,
    });
  }
  if (INVALID_CHARS.test(name)) {
    throw new HTTPException(400, {
      message: "Tag name contains invalid characters",
    });
  }
  return name;
}

// ── Tags Router (/api/tags) ──────────────────────────────────────────────────

export const tagsRouter = new Hono();

/**
 * GET /api/tags — list all tags, with optional search query for autocomplete.
 *
 * Query params:
 *   q     — partial name filter (case-insensitive)
 *   sort  — "name" | "usage" (default: "name")
 *   limit — max results (default: 50, max: 200)
 */
tagsRouter.get("/", async (c) => {
  const q = c.req.query("q") ?? "";
  const sort = c.req.query("sort") ?? "name";
  const limitParam = Number(c.req.query("limit") ?? "50");
  const limit = Math.min(
    Math.max(1, Number.isFinite(limitParam) ? limitParam : 50),
    200
  );

  let query = db.select().from(tags);

  if (q) {
    query = query.where(ilike(tags.name, `%${q}%`)) as typeof query;
  }

  if (sort === "usage") {
    query = query.orderBy(desc(tags.usageCount), asc(tags.name)) as typeof query;
  } else {
    query = query.orderBy(asc(tags.name)) as typeof query;
  }

  query = query.limit(limit) as typeof query;

  const rows = await query;
  return c.json({ data: rows });
});

/**
 * GET /api/tags/autocomplete?q=... — autocomplete suggestions for tag input.
 *
 * Returns up to 10 tags matching the query, sorted by usage then name.
 * NOTE: This route must be registered BEFORE /:id to avoid param capture.
 */
tagsRouter.get("/autocomplete", async (c) => {
  const q = c.req.query("q") ?? "";
  const limitParam = Number(c.req.query("limit") ?? "10");
  const limit = Math.min(Math.max(1, Number.isFinite(limitParam) ? limitParam : 10), 50);

  let query = db.select().from(tags);

  if (q) {
    query = query.where(ilike(tags.name, `%${q}%`)) as typeof query;
  }

  query = query
    .orderBy(desc(tags.usageCount), asc(tags.name))
    .limit(limit) as typeof query;

  const rows = await query;
  return c.json({ data: rows });
});

/**
 * POST /api/tags — create a new tag.
 *
 * Body: { name: string, color?: string }
 */
tagsRouter.post("/", async (c) => {
  const body = await c.req.json().catch(() => {
    throw new HTTPException(400, { message: "Invalid JSON body" });
  });

  const name = validateTagName(body.name ?? "");
  const color = body.color ?? null;

  // Check for duplicate (case-insensitive — normalized to lowercase)
  const existing = await db
    .select({ id: tags.id })
    .from(tags)
    .where(eq(tags.name, name))
    .limit(1);

  if (existing.length > 0) {
    throw new HTTPException(409, { message: `Tag '${name}' already exists` });
  }

  const [tag] = await db.insert(tags).values({ name, color }).returning();

  return c.json({ data: tag }, 201);
});

/**
 * GET /api/tags/:id — get a single tag by ID.
 */
tagsRouter.get("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) {
    throw new HTTPException(400, { message: "Invalid tag ID" });
  }

  const [tag] = await db.select().from(tags).where(eq(tags.id, id));
  if (!tag) {
    throw new HTTPException(404, { message: "Tag not found" });
  }

  return c.json({ data: tag });
});

/**
 * PUT /api/tags/:id — update a tag's name and/or color.
 *
 * Body: { name?: string, color?: string }
 */
tagsRouter.put("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) {
    throw new HTTPException(400, { message: "Invalid tag ID" });
  }

  const body = await c.req.json().catch(() => {
    throw new HTTPException(400, { message: "Invalid JSON body" });
  });

  // Find existing tag
  const [existing] = await db.select().from(tags).where(eq(tags.id, id));
  if (!existing) {
    throw new HTTPException(404, { message: "Tag not found" });
  }

  const updates: Partial<{ name: string; color: string | null }> = {};

  if (body.name !== undefined) {
    const newName = validateTagName(body.name);

    // Check for duplicate only if name is changing
    if (newName !== existing.name) {
      const duplicate = await db
        .select({ id: tags.id })
        .from(tags)
        .where(eq(tags.name, newName))
        .limit(1);

      if (duplicate.length > 0) {
        throw new HTTPException(409, {
          message: `Tag '${newName}' already exists`,
        });
      }
    }
    updates.name = newName;
  }

  if (body.color !== undefined) {
    updates.color = body.color ?? null;
  }

  if (Object.keys(updates).length === 0) {
    return c.json({ data: existing });
  }

  const [updated] = await db
    .update(tags)
    .set(updates)
    .where(eq(tags.id, id))
    .returning();

  return c.json({ data: updated });
});

/**
 * DELETE /api/tags/:id — delete a tag and all its image associations.
 * Cascading delete handles image_tags removal via FK constraint.
 */
tagsRouter.delete("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) {
    throw new HTTPException(400, { message: "Invalid tag ID" });
  }

  const [existing] = await db
    .select({ id: tags.id })
    .from(tags)
    .where(eq(tags.id, id));

  if (!existing) {
    throw new HTTPException(404, { message: "Tag not found" });
  }

  await db.delete(tags).where(eq(tags.id, id));

  return c.json({ success: true });
});

/**
 * POST /api/tags/bulk/add — add tags to multiple images in one request.
 *
 * Body: { imageIds: number[], tagIds: number[] }
 */
tagsRouter.post("/bulk/add", async (c) => {
  const body = await c.req.json().catch(() => {
    throw new HTTPException(400, { message: "Invalid JSON body" });
  });

  const imageIds: number[] = Array.isArray(body.imageIds)
    ? body.imageIds.map(Number).filter(Number.isFinite)
    : [];
  const tagIds: number[] = Array.isArray(body.tagIds)
    ? body.tagIds.map(Number).filter(Number.isFinite)
    : [];

  if (imageIds.length === 0) {
    throw new HTTPException(400, {
      message: "imageIds must be a non-empty array",
    });
  }
  if (tagIds.length === 0) {
    throw new HTTPException(400, {
      message: "tagIds must be a non-empty array",
    });
  }

  // Verify all tags exist
  const existingTags = await db
    .select({ id: tags.id })
    .from(tags)
    .where(inArray(tags.id, tagIds));

  if (existingTags.length !== tagIds.length) {
    throw new HTTPException(400, { message: "One or more tag IDs not found" });
  }

  await db.transaction(async (tx) => {
    const values = imageIds.flatMap((imageId) =>
      tagIds.map((tagId) => ({ imageId, tagId }))
    );

    await tx.insert(imageTags).values(values).onConflictDoNothing();

    // Recompute usage_count for all affected tags
    for (const tagId of tagIds) {
      await tx
        .update(tags)
        .set({
          usageCount: sql`(SELECT count(*)::int FROM image_tags WHERE tag_id = ${tagId})`,
        })
        .where(eq(tags.id, tagId));
    }
  });

  return c.json({ success: true, applied: { imageIds, tagIds } });
});

/**
 * POST /api/tags/bulk/remove — remove tags from multiple images in one request.
 *
 * Body: { imageIds: number[], tagIds: number[] }
 */
tagsRouter.post("/bulk/remove", async (c) => {
  const body = await c.req.json().catch(() => {
    throw new HTTPException(400, { message: "Invalid JSON body" });
  });

  const imageIds: number[] = Array.isArray(body.imageIds)
    ? body.imageIds.map(Number).filter(Number.isFinite)
    : [];
  const tagIds: number[] = Array.isArray(body.tagIds)
    ? body.tagIds.map(Number).filter(Number.isFinite)
    : [];

  if (imageIds.length === 0) {
    throw new HTTPException(400, {
      message: "imageIds must be a non-empty array",
    });
  }
  if (tagIds.length === 0) {
    throw new HTTPException(400, {
      message: "tagIds must be a non-empty array",
    });
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(imageTags)
      .where(
        and(
          inArray(imageTags.imageId, imageIds),
          inArray(imageTags.tagId, tagIds)
        )
      );

    // Recompute usage_count for all affected tags
    for (const tagId of tagIds) {
      await tx
        .update(tags)
        .set({
          usageCount: sql`(SELECT count(*)::int FROM image_tags WHERE tag_id = ${tagId})`,
        })
        .where(eq(tags.id, tagId));
    }
  });

  return c.json({ success: true, removed: { imageIds, tagIds } });
});

// ── Image Tags Router (/api/images) ─────────────────────────────────────────
// These routes handle /api/images/:imageId/tags endpoints.
// Mounted at /api/images in api.ts alongside the main imagesRouter.

export const imageTagsRouter = new Hono();

/**
 * GET /api/images/:imageId/tags — list all tags on an image.
 */
imageTagsRouter.get("/:imageId/tags", async (c) => {
  const imageId = Number(c.req.param("imageId"));
  if (!Number.isFinite(imageId)) {
    throw new HTTPException(400, { message: "Invalid image ID" });
  }

  // Verify image exists
  const [image] = await db
    .select({ id: images.id })
    .from(images)
    .where(eq(images.id, imageId));

  if (!image) {
    throw new HTTPException(404, { message: "Image not found" });
  }

  const rows = await db
    .select({
      id: tags.id,
      name: tags.name,
      color: tags.color,
      usageCount: tags.usageCount,
      createdAt: tags.createdAt,
    })
    .from(imageTags)
    .innerJoin(tags, eq(imageTags.tagId, tags.id))
    .where(eq(imageTags.imageId, imageId))
    .orderBy(asc(tags.name));

  return c.json({ data: rows });
});

/**
 * POST /api/images/:imageId/tags — add one or more tags to an image.
 *
 * Body: { tagIds?: number[], names?: string[] }
 *
 * tagIds: array of existing tag IDs to add
 * names: array of tag names — will be created if they don't exist, then added
 *
 * Returns the updated list of tags on the image.
 */
imageTagsRouter.post("/:imageId/tags", async (c) => {
  const imageId = Number(c.req.param("imageId"));
  if (!Number.isFinite(imageId)) {
    throw new HTTPException(400, { message: "Invalid image ID" });
  }

  const body = await c.req.json().catch(() => {
    throw new HTTPException(400, { message: "Invalid JSON body" });
  });

  // Verify image exists
  const [image] = await db
    .select({ id: images.id })
    .from(images)
    .where(eq(images.id, imageId));

  if (!image) {
    throw new HTTPException(404, { message: "Image not found" });
  }

  const tagIds: number[] = Array.isArray(body.tagIds)
    ? body.tagIds.map(Number).filter(Number.isFinite)
    : [];
  const names: string[] = Array.isArray(body.names) ? body.names : [];

  if (tagIds.length === 0 && names.length === 0) {
    throw new HTTPException(400, {
      message: "Provide at least one tagId or tag name",
    });
  }

  // Collect all resolved tag IDs
  const resolvedIds = new Set<number>(tagIds);

  // Resolve names — find or create tags
  for (const rawName of names) {
    const name = validateTagName(rawName);
    const [existing] = await db
      .select({ id: tags.id })
      .from(tags)
      .where(eq(tags.name, name))
      .limit(1);

    if (existing) {
      resolvedIds.add(existing.id);
    } else {
      const [created] = await db
        .insert(tags)
        .values({ name })
        .returning({ id: tags.id });
      resolvedIds.add(created.id);
    }
  }

  if (resolvedIds.size === 0) {
    throw new HTTPException(400, { message: "No valid tags to add" });
  }

  // Insert image_tags and update usage_count atomically
  await db.transaction(async (tx) => {
    for (const tagId of resolvedIds) {
      await tx
        .insert(imageTags)
        .values({ imageId, tagId })
        .onConflictDoNothing();

      await tx
        .update(tags)
        .set({
          usageCount: sql`(SELECT count(*)::int FROM image_tags WHERE tag_id = ${tagId})`,
        })
        .where(eq(tags.id, tagId));
    }
  });

  // Return updated tag list for this image
  const rows = await db
    .select({
      id: tags.id,
      name: tags.name,
      color: tags.color,
      usageCount: tags.usageCount,
      createdAt: tags.createdAt,
    })
    .from(imageTags)
    .innerJoin(tags, eq(imageTags.tagId, tags.id))
    .where(eq(imageTags.imageId, imageId))
    .orderBy(asc(tags.name));

  return c.json({ data: rows });
});

/**
 * DELETE /api/images/:imageId/tags/:tagId — remove a tag from an image.
 */
imageTagsRouter.delete("/:imageId/tags/:tagId", async (c) => {
  const imageId = Number(c.req.param("imageId"));
  const tagId = Number(c.req.param("tagId"));

  if (!Number.isFinite(imageId)) {
    throw new HTTPException(400, { message: "Invalid image ID" });
  }
  if (!Number.isFinite(tagId)) {
    throw new HTTPException(400, { message: "Invalid tag ID" });
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(imageTags)
      .where(
        and(eq(imageTags.imageId, imageId), eq(imageTags.tagId, tagId))
      );

    // Recompute usage_count
    await tx
      .update(tags)
      .set({
        usageCount: sql`(SELECT count(*)::int FROM image_tags WHERE tag_id = ${tagId})`,
      })
      .where(eq(tags.id, tagId));
  });

  return c.json({ success: true });
});
