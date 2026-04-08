/**
 * sync.ts
 *
 * API routes for triggering and monitoring image scans.
 *
 * POST /api/sync/scan              — trigger a full scan of all enabled sources
 * POST /api/sync/scan/:id          — trigger a scan of a specific source
 * GET  /api/sync/status            — get current scan progress and scheduler info
 * GET  /api/sync/history           — get past sync run records
 * GET  /api/sync/sources           — get per-source sync status
 * PUT  /api/sync/settings          — update sync interval
 */

import { Hono } from "hono";
import { triggerScan, getScanProgress } from "../lib/scanner";
import {
  getSyncSchedulerStatus,
  reloadSyncScheduler,
  SYNC_INTERVAL_SETTING_KEY,
} from "../lib/sync-scheduler";
import { db } from "../db/client";
import { syncRuns, sourceSyncStatus, sourceFolders, settings } from "../db/schema";
import { desc, eq } from "drizzle-orm";

export const syncRouter = new Hono();

/**
 * GET /api/sync/status — current scan progress, scheduler state, and last run.
 *
 * Returns the current (or last completed) scan's progress details plus
 * scheduler information (next run time, interval).
 * Poll this endpoint while status === "scanning" to track progress.
 */
syncRouter.get("/status", async (c) => {
  const progress = getScanProgress();
  const scheduler = getSyncSchedulerStatus();

  // Fetch the most recent sync run from DB for last-run info
  let lastRun: {
    id: number;
    startedAt: Date;
    completedAt: Date | null;
    status: string;
    added: number;
    updated: number;
    missing: number;
    errorCount: number;
  } | null = null;

  try {
    const [row] = await db
      .select({
        id: syncRuns.id,
        startedAt: syncRuns.startedAt,
        completedAt: syncRuns.completedAt,
        status: syncRuns.status,
        added: syncRuns.added,
        updated: syncRuns.updated,
        missing: syncRuns.missing,
        errorCount: syncRuns.errorCount,
      })
      .from(syncRuns)
      .orderBy(desc(syncRuns.startedAt))
      .limit(1);
    lastRun = row ?? null;
  } catch {
    // DB unavailable — return without last run info
  }

  return c.json({
    data: {
      scan: progress,
      scheduler: {
        intervalMinutes: scheduler.intervalMinutes,
        nextRunAt: scheduler.nextRunAt,
        lastRunAt: scheduler.lastRunAt,
      },
      lastRun,
    },
  });
});

/**
 * POST /api/sync/scan — trigger a full scan of all enabled source folders.
 *
 * Scans run in the background. Returns immediately with 202 Accepted if
 * the scan started, or 409 Conflict if one is already running.
 */
syncRouter.post("/scan", async (c) => {
  const result = await triggerScan(undefined, "manual");

  if (!result.started) {
    const status = result.reason?.includes("already in progress") ? 409 : 400;
    return c.json({ error: result.reason ?? "Could not start scan" }, status);
  }

  return c.json(
    {
      data: {
        message: "Scan started",
        status: "scanning",
        syncRunId: result.syncRunId,
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

  const result = await triggerScan(id, "manual");

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
        syncRunId: result.syncRunId,
      },
    },
    202
  );
});

/**
 * GET /api/sync/history — list past sync runs, most recent first.
 *
 * Query params:
 *   limit  — max records to return (default 20, max 100)
 *   offset — pagination offset (default 0)
 */
syncRouter.get("/history", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") ?? 20), 100);
  const offset = Number(c.req.query("offset") ?? 0);

  if (!Number.isFinite(limit) || limit < 1) {
    return c.json({ error: "Invalid limit" }, 400);
  }

  try {
    const rows = await db
      .select()
      .from(syncRuns)
      .orderBy(desc(syncRuns.startedAt))
      .limit(limit)
      .offset(offset);

    return c.json({ data: rows });
  } catch (err) {
    return c.json(
      { error: `Failed to fetch history: ${err instanceof Error ? err.message : String(err)}` },
      500
    );
  }
});

/**
 * GET /api/sync/sources — per-source sync status (last sync time, availability).
 */
syncRouter.get("/sources", async (c) => {
  try {
    const rows = await db
      .select({
        sourceFolderId: sourceSyncStatus.sourceFolderId,
        lastSyncAt: sourceSyncStatus.lastSyncAt,
        lastSyncRunId: sourceSyncStatus.lastSyncRunId,
        available: sourceSyncStatus.available,
        unavailableReason: sourceSyncStatus.unavailableReason,
        updatedAt: sourceSyncStatus.updatedAt,
        // Join source info
        sourceName: sourceFolders.name,
        sourcePath: sourceFolders.path,
        sourceEnabled: sourceFolders.enabled,
      })
      .from(sourceSyncStatus)
      .leftJoin(sourceFolders, eq(sourceSyncStatus.sourceFolderId, sourceFolders.id));

    return c.json({ data: rows });
  } catch (err) {
    return c.json(
      { error: `Failed to fetch source status: ${err instanceof Error ? err.message : String(err)}` },
      500
    );
  }
});

/**
 * PUT /api/sync/settings — update sync interval.
 *
 * Body: { intervalMinutes: number }
 * Set intervalMinutes to 0 to disable automatic sync.
 */
syncRouter.put("/settings", async (c) => {
  let body: { intervalMinutes?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const { intervalMinutes } = body;
  if (
    intervalMinutes === undefined ||
    typeof intervalMinutes !== "number" ||
    !Number.isFinite(intervalMinutes) ||
    intervalMinutes < 0
  ) {
    return c.json({ error: "intervalMinutes must be a non-negative number" }, 400);
  }

  try {
    await db
      .insert(settings)
      .values({ key: SYNC_INTERVAL_SETTING_KEY, value: intervalMinutes, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: intervalMinutes, updatedAt: new Date() },
      });

    // Reload scheduler with new interval
    await reloadSyncScheduler();

    return c.json({
      data: {
        message: "Sync interval updated",
        intervalMinutes,
      },
    });
  } catch (err) {
    return c.json(
      { error: `Failed to update settings: ${err instanceof Error ? err.message : String(err)}` },
      500
    );
  }
});
