import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { and, eq, ilike, sql, asc, desc, inArray } from "drizzle-orm";
import { db } from "../db/client";
import { tags, imageTags, images, tagManagementLog } from "../db/schema";

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

  // Log rename if name changed
  if (updates.name && updates.name !== existing.name) {
    await db.insert(tagManagementLog).values({
      operation: "rename",
      details: { tagId: id, oldName: existing.name, newName: updates.name },
    });
  }

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
    .select({ id: tags.id, name: tags.name })
    .from(tags)
    .where(eq(tags.id, id));

  if (!existing) {
    throw new HTTPException(404, { message: "Tag not found" });
  }

  await db.delete(tags).where(eq(tags.id, id));

  // Log the delete operation
  await db.insert(tagManagementLog).values({
    operation: "delete",
    details: { tagId: id, tagName: existing.name },
  });

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

/**
 * GET /api/tags/export?format=csv|json — export all tags as CSV or JSON.
 *
 * Query params:
 *   format — "csv" | "json" (default: "json")
 */
tagsRouter.get("/export", async (c) => {
  const format = c.req.query("format") ?? "json";

  const rows = await db
    .select()
    .from(tags)
    .orderBy(desc(tags.usageCount), asc(tags.name));

  if (format === "csv") {
    const lines = ["id,name,color,usage_count,created_at"];
    for (const tag of rows) {
      const escapedName = tag.name.includes(",") ? `"${tag.name}"` : tag.name;
      const color = tag.color ?? "";
      lines.push(
        `${tag.id},${escapedName},${color},${tag.usageCount},${tag.createdAt?.toISOString() ?? ""}`
      );
    }
    c.header("Content-Type", "text/csv");
    c.header("Content-Disposition", 'attachment; filename="iris-tags.csv"');
    return c.body(lines.join("\n"));
  }

  // JSON export
  c.header("Content-Type", "application/json");
  c.header("Content-Disposition", 'attachment; filename="iris-tags.json"');
  return c.body(
    JSON.stringify({ exported_at: new Date().toISOString(), tags: rows }, null, 2)
  );
});

/**
 * POST /api/tags/import — import tags from JSON or CSV.
 *
 * Body: { tags: Array<{ name: string, color?: string }> }
 *
 * Returns counts of created, skipped (duplicate), and failed tags.
 */
tagsRouter.post("/import", async (c) => {
  const body = await c.req.json().catch(() => {
    throw new HTTPException(400, { message: "Invalid JSON body" });
  });

  const tagList: Array<{ name: string; color?: string }> = Array.isArray(body.tags)
    ? body.tags
    : [];

  if (tagList.length === 0) {
    throw new HTTPException(400, { message: "No tags provided in import body" });
  }

  let created = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const item of tagList) {
    try {
      const name = validateTagName(item.name ?? "");
      const color = item.color ?? null;

      const existing = await db
        .select({ id: tags.id })
        .from(tags)
        .where(eq(tags.name, name))
        .limit(1);

      if (existing.length > 0) {
        skipped++;
        continue;
      }

      await db.insert(tags).values({ name, color });
      created++;
    } catch (e) {
      failed++;
      errors.push(e instanceof Error ? e.message : "Unknown error");
    }
  }

  // Log the import operation
  await db.insert(tagManagementLog).values({
    operation: "import",
    details: { created, skipped, failed, total: tagList.length },
  });

  return c.json({ data: { created, skipped, failed, errors } });
});

/**
 * POST /api/tags/merge — merge source tags into a target tag.
 *
 * Body: { sourceTagIds: number[], targetTagId: number }
 *
 * All image associations from source tags are moved to the target tag,
 * then source tags are deleted.
 */
tagsRouter.post("/merge", async (c) => {
  const body = await c.req.json().catch(() => {
    throw new HTTPException(400, { message: "Invalid JSON body" });
  });

  const sourceTagIds: number[] = Array.isArray(body.sourceTagIds)
    ? body.sourceTagIds.map(Number).filter(Number.isFinite)
    : [];
  const targetTagId = Number(body.targetTagId);

  if (sourceTagIds.length === 0) {
    throw new HTTPException(400, { message: "sourceTagIds must be a non-empty array" });
  }
  if (!Number.isFinite(targetTagId)) {
    throw new HTTPException(400, { message: "Invalid targetTagId" });
  }
  if (sourceTagIds.includes(targetTagId)) {
    throw new HTTPException(400, { message: "targetTagId cannot be one of the sourceTagIds" });
  }

  // Verify target tag exists
  const [targetTag] = await db.select().from(tags).where(eq(tags.id, targetTagId));
  if (!targetTag) {
    throw new HTTPException(404, { message: "Target tag not found" });
  }

  // Verify all source tags exist
  const sourceTags = await db
    .select()
    .from(tags)
    .where(inArray(tags.id, sourceTagIds));

  if (sourceTags.length !== sourceTagIds.length) {
    throw new HTTPException(400, { message: "One or more source tags not found" });
  }

  const sourceNames = sourceTags.map((t) => t.name);

  await db.transaction(async (tx) => {
    // For each source tag, move its image associations to the target tag
    for (const sourceId of sourceTagIds) {
      // Find images tagged with the source tag that are NOT already tagged with target
      const sourceImageIds = await tx
        .select({ imageId: imageTags.imageId })
        .from(imageTags)
        .where(eq(imageTags.tagId, sourceId));

      for (const { imageId } of sourceImageIds) {
        // Insert into target (ignore conflicts — image may already have target tag)
        await tx
          .insert(imageTags)
          .values({ imageId, tagId: targetTagId })
          .onConflictDoNothing();
      }

      // Delete all source tag associations
      await tx.delete(imageTags).where(eq(imageTags.tagId, sourceId));

      // Delete the source tag itself
      await tx.delete(tags).where(eq(tags.id, sourceId));
    }

    // Recompute usage_count for target tag
    await tx
      .update(tags)
      .set({
        usageCount: sql`(SELECT count(*)::int FROM image_tags WHERE tag_id = ${targetTagId})`,
      })
      .where(eq(tags.id, targetTagId));
  });

  // Log the merge operation
  await db.insert(tagManagementLog).values({
    operation: "merge",
    details: {
      sourceTagIds,
      sourceNames,
      targetTagId,
      targetName: targetTag.name,
    },
  });

  const [updatedTarget] = await db.select().from(tags).where(eq(tags.id, targetTagId));
  return c.json({ data: updatedTarget });
});

/**
 * DELETE /api/tags/bulk — delete multiple tags by ID.
 *
 * Body: { tagIds: number[] }
 */
tagsRouter.delete("/bulk", async (c) => {
  const body = await c.req.json().catch(() => {
    throw new HTTPException(400, { message: "Invalid JSON body" });
  });

  const tagIds: number[] = Array.isArray(body.tagIds)
    ? body.tagIds.map(Number).filter(Number.isFinite)
    : [];

  if (tagIds.length === 0) {
    throw new HTTPException(400, { message: "tagIds must be a non-empty array" });
  }

  // Get tag names for audit log
  const existingTags = await db
    .select({ id: tags.id, name: tags.name })
    .from(tags)
    .where(inArray(tags.id, tagIds));

  if (existingTags.length === 0) {
    throw new HTTPException(404, { message: "No matching tags found" });
  }

  const foundIds = existingTags.map((t) => t.id);

  await db.delete(tags).where(inArray(tags.id, foundIds));

  // Log the bulk delete
  await db.insert(tagManagementLog).values({
    operation: "bulk_delete",
    details: {
      tagIds: foundIds,
      tagNames: existingTags.map((t) => t.name),
      count: foundIds.length,
    },
  });

  return c.json({ success: true, deleted: foundIds.length });
});

/**
 * GET /api/tags/:id/images — list images that have a specific tag.
 *
 * Query params:
 *   page     — page number (default: 1)
 *   pageSize — results per page (default: 50, max: 200)
 */
tagsRouter.get("/:id/images", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) {
    throw new HTTPException(400, { message: "Invalid tag ID" });
  }

  const pageParam = Number(c.req.query("page") ?? "1");
  const pageSizeParam = Number(c.req.query("pageSize") ?? "50");
  const page = Math.max(1, Number.isFinite(pageParam) ? pageParam : 1);
  const pageSize = Math.min(200, Math.max(1, Number.isFinite(pageSizeParam) ? pageSizeParam : 50));
  const offset = (page - 1) * pageSize;

  // Verify tag exists
  const [tag] = await db.select().from(tags).where(eq(tags.id, id));
  if (!tag) {
    throw new HTTPException(404, { message: "Tag not found" });
  }

  // Count total images for this tag
  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(imageTags)
    .where(eq(imageTags.tagId, id));

  const total = countRow?.count ?? 0;

  // Fetch paginated images
  const rows = await db
    .select({
      id: images.id,
      fileName: images.fileName,
      relativePath: images.relativePath,
      thumbnailPath: images.thumbnailPath,
      takenAt: images.takenAt,
      width: images.width,
      height: images.height,
      mimeType: images.mimeType,
    })
    .from(imageTags)
    .innerJoin(images, eq(imageTags.imageId, images.id))
    .where(eq(imageTags.tagId, id))
    .orderBy(desc(images.takenAt), asc(images.fileName))
    .limit(pageSize)
    .offset(offset);

  return c.json({
    tag,
    data: rows,
    pagination: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  });
});

/**
 * GET /api/tags/log — retrieve management operation audit log.
 *
 * Query params:
 *   limit  — max entries to return (default: 50, max: 200)
 */
tagsRouter.get("/log", async (c) => {
  const limitParam = Number(c.req.query("limit") ?? "50");
  const limit = Math.min(200, Math.max(1, Number.isFinite(limitParam) ? limitParam : 50));

  const rows = await db
    .select()
    .from(tagManagementLog)
    .orderBy(desc(tagManagementLog.createdAt))
    .limit(limit);

  return c.json({ data: rows });
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
