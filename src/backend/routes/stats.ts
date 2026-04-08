import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { db } from "../db/client";
import { images, sourceFolders } from "../db/schema";

export const statsRouter = new Hono();

/**
 * GET /api/stats — collection statistics.
 */
statsRouter.get("/", async (c) => {
  const [imageCount] = await db
    .select({ count: sql<number>`cast(count(*) as integer)` })
    .from(images);

  const [sourceCount] = await db
    .select({ count: sql<number>`cast(count(*) as integer)` })
    .from(sourceFolders);

  return c.json({
    data: {
      totalImages: imageCount?.count ?? 0,
      totalSources: sourceCount?.count ?? 0,
    },
  });
});
