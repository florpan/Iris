import { Hono } from "hono";
import * as fs from "node:fs";
import { db } from "../db/client";
import { sourceFolders } from "../db/schema";

export const sourcesRouter = new Hono();

/**
 * GET /api/sources — list all source folders with availability status.
 * A source is "available" if its path exists and is accessible on disk.
 * Returns 200 even if some sources are unavailable; individual status per source.
 */
sourcesRouter.get("/", async (c) => {
  const sources = await db
    .select()
    .from(sourceFolders)
    .orderBy(sourceFolders.name);

  const data = sources.map((source) => {
    let available = false;
    let accessError: string | undefined;

    if (!source.enabled) {
      accessError = "Source is disabled";
    } else {
      try {
        fs.accessSync(source.path, fs.constants.R_OK);
        available = true;
      } catch (err) {
        accessError =
          err instanceof Error ? err.message : "Path not accessible";
      }
    }

    return {
      id: source.id,
      name: source.name,
      path: source.path,
      enabled: source.enabled,
      available,
      ...(accessError ? { error: accessError } : {}),
    };
  });

  return c.json({ data });
});

/**
 * GET /api/sources/:id — single source folder status.
 */
sourcesRouter.get("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) {
    return c.json({ error: "Invalid source ID" }, 400);
  }

  const { eq } = await import("drizzle-orm");
  const [source] = await db
    .select()
    .from(sourceFolders)
    .where(eq(sourceFolders.id, id));

  if (!source) {
    return c.json({ error: "Source folder not found" }, 404);
  }

  let available = false;
  let accessError: string | undefined;

  if (!source.enabled) {
    accessError = "Source is disabled";
  } else {
    try {
      fs.accessSync(source.path, fs.constants.R_OK);
      available = true;
    } catch (err) {
      accessError = err instanceof Error ? err.message : "Path not accessible";
    }
  }

  const httpStatus = available ? 200 : 503;

  return c.json(
    {
      data: {
        id: source.id,
        name: source.name,
        path: source.path,
        enabled: source.enabled,
        available,
        ...(accessError ? { error: accessError } : {}),
      },
    },
    httpStatus
  );
});
