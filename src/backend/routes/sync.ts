/**
 * sync.ts
 *
 * API routes for triggering and monitoring image scans.
 *
 * POST /api/sync/scan          — trigger a full scan of all enabled sources
 * POST /api/sync/scan/:id      — trigger a scan of a specific source
 * GET  /api/sync/status        — get current scan status and progress
 */

import { Hono } from "hono";
import { triggerScan, getScanProgress } from "../lib/scanner";

export const syncRouter = new Hono();

/**
 * GET /api/sync/status — current scan progress and state.
 *
 * Returns the current (or last completed) scan's progress details.
 * Poll this endpoint while status === "scanning" to track progress.
 */
syncRouter.get("/status", (c) => {
  const progress = getScanProgress();
  return c.json({ data: progress });
});

/**
 * POST /api/sync/scan — trigger a full scan of all enabled source folders.
 *
 * Scans run in the background. Returns immediately with 202 Accepted if
 * the scan started, or 409 Conflict if one is already running.
 */
syncRouter.post("/scan", async (c) => {
  const result = await triggerScan();

  if (!result.started) {
    const status = result.reason?.includes("already in progress") ? 409 : 400;
    return c.json({ error: result.reason ?? "Could not start scan" }, status);
  }

  return c.json(
    {
      data: {
        message: "Scan started",
        status: "scanning",
      },
    },
    202
  );
});

/**
 * POST /api/sync/scan/:id — trigger a scan of a specific source folder.
 *
 * Path parameter :id is the source folder ID.
 * Returns 202 Accepted if started, 404 if source not found, 409 if busy.
 */
syncRouter.post("/scan/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id) || id <= 0) {
    return c.json({ error: "Invalid source ID" }, 400);
  }

  const result = await triggerScan(id);

  if (!result.started) {
    if (result.reason?.includes("already in progress")) {
      return c.json({ error: result.reason }, 409);
    }
    if (result.reason?.includes("not found") || result.reason?.includes("disabled")) {
      return c.json({ error: result.reason }, 404);
    }
    return c.json({ error: result.reason ?? "Could not start scan" }, 400);
  }

  return c.json(
    {
      data: {
        message: `Scan started for source ${id}`,
        sourceId: id,
        status: "scanning",
      },
    },
    202
  );
});
