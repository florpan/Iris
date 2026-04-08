import { Hono } from "hono";
import { eq, sql, isNotNull, ne } from "drizzle-orm";
import { db } from "../db/client";
import { images, sourceFolders } from "../db/schema";

export const statsRouter = new Hono();

/**
 * GET /api/stats — collection statistics.
 *
 * Returns:
 *   totalImages        — total non-missing images
 *   totalSources       — total source folders
 *   byFormat           — image counts grouped by MIME type
 *   dateRange          — { earliest, latest } timestamps of takenAt
 *   topCamera          — most-used camera model
 *   totalStorageBytes  — sum of all file sizes
 */
statsRouter.get("/", async (c) => {
  const [
    imageCountRow,
    sourceCountRow,
    formatRows,
    dateRangeRow,
    topCameraRow,
    storageRow,
  ] = await Promise.all([
    // Total non-missing images
    db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(images)
      .where(eq(images.missing, false))
      .then((r) => r[0]),

    // Total source folders
    db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(sourceFolders)
      .then((r) => r[0]),

    // Images grouped by MIME type
    db
      .select({
        mimeType: images.mimeType,
        count: sql<number>`cast(count(*) as integer)`,
      })
      .from(images)
      .where(eq(images.missing, false))
      .groupBy(images.mimeType)
      .orderBy(sql`count(*) DESC`),

    // Date range
    db
      .select({
        earliest: sql<string>`min(${images.takenAt})`,
        latest: sql<string>`max(${images.takenAt})`,
      })
      .from(images)
      .where(eq(images.missing, false))
      .then((r) => r[0]),

    // Top camera
    db
      .select({
        cameraModel: images.cameraModel,
        count: sql<number>`cast(count(*) as integer)`,
      })
      .from(images)
      .where(
        sql`${images.missing} = false AND ${images.cameraModel} IS NOT NULL AND ${images.cameraModel} != ''`
      )
      .groupBy(images.cameraModel)
      .orderBy(sql`count(*) DESC`)
      .limit(1)
      .then((r) => r[0]),

    // Total storage
    db
      .select({
        total: sql<number>`coalesce(sum(${images.fileSize}), 0)::bigint`,
      })
      .from(images)
      .where(eq(images.missing, false))
      .then((r) => r[0]),
  ]);

  // Build byFormat map
  const byFormat: Record<string, number> = {};
  for (const row of formatRows) {
    const key = row.mimeType ?? "unknown";
    byFormat[key] = row.count;
  }

  return c.json({
    data: {
      totalImages: imageCountRow?.count ?? 0,
      totalSources: sourceCountRow?.count ?? 0,
      byFormat,
      dateRange: {
        earliest: dateRangeRow?.earliest ?? null,
        latest: dateRangeRow?.latest ?? null,
      },
      topCamera: topCameraRow?.cameraModel ?? null,
      totalStorageBytes: Number(storageRow?.total ?? 0),
    },
  });
});
