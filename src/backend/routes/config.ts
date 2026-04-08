import { Hono } from "hono";
import { db } from "../db/client";
import { sourceFolders } from "../db/schema";

export const configRouter = new Hono();

/**
 * GET /api/config — read-only app configuration.
 * Returns configured sources and work folder path.
 */
configRouter.get("/", async (c) => {
  const sources = await db
    .select({
      id: sourceFolders.id,
      name: sourceFolders.name,
      path: sourceFolders.path,
      enabled: sourceFolders.enabled,
    })
    .from(sourceFolders)
    .orderBy(sourceFolders.name);

  const workFolder = process.env.WORK_DIR ?? "./work";

  return c.json({
    data: {
      workFolder,
      sources,
      app: {
        name: "Iris",
        version: "0.1.0",
      },
    },
  });
});
