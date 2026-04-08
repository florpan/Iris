/**
 * sync-scheduler.ts
 *
 * Background scheduler that triggers periodic scans of all source folders.
 * The interval is configurable via the app settings (key: "sync_interval_minutes").
 * Defaults to 60 minutes if not configured. Set to 0 to disable auto-sync.
 *
 * Usage:
 *   startSyncScheduler()  — called once at startup
 *   stopSyncScheduler()   — called on graceful shutdown
 *   getSyncSchedulerStatus() — returns current scheduler state
 */

import { db } from "../db/client";
import { settings } from "../db/schema";
import { eq } from "drizzle-orm";
import { triggerScan } from "./scanner";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Default sync interval in minutes */
const DEFAULT_INTERVAL_MINUTES = 60;

/** Minimum allowed interval (minutes). Prevents runaway polling. */
const MIN_INTERVAL_MINUTES = 5;

/** Settings key for the sync interval */
export const SYNC_INTERVAL_SETTING_KEY = "sync_interval_minutes";

// ── Scheduler state ───────────────────────────────────────────────────────────

interface SchedulerStatus {
  running: boolean;
  intervalMinutes: number | null;
  nextRunAt: Date | null;
  lastRunAt: Date | null;
}

let schedulerTimer: ReturnType<typeof setTimeout> | null = null;
let schedulerRunning = false;
let intervalMinutes: number | null = null;
let nextRunAt: Date | null = null;
let lastRunAt: Date | null = null;

export function getSyncSchedulerStatus(): SchedulerStatus {
  return {
    running: schedulerRunning,
    intervalMinutes,
    nextRunAt: nextRunAt ? new Date(nextRunAt) : null,
    lastRunAt: lastRunAt ? new Date(lastRunAt) : null,
  };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Load the sync interval from the database settings.
 * Returns null if auto-sync is disabled (interval = 0).
 */
async function loadIntervalMinutes(): Promise<number | null> {
  try {
    const [row] = await db
      .select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, SYNC_INTERVAL_SETTING_KEY));

    if (row?.value !== undefined && row.value !== null) {
      const parsed = Number(row.value);
      if (!isNaN(parsed)) {
        if (parsed === 0) return null; // 0 means disabled
        return Math.max(parsed, MIN_INTERVAL_MINUTES);
      }
    }
  } catch {
    // DB not available — fall through to default
  }
  return DEFAULT_INTERVAL_MINUTES;
}

/**
 * Schedule the next scan run. Clears any existing timer first.
 */
async function scheduleNextRun(): Promise<void> {
  // Clear any existing timer
  if (schedulerTimer !== null) {
    clearTimeout(schedulerTimer);
    schedulerTimer = null;
  }

  // Reload interval (may have changed in settings)
  intervalMinutes = await loadIntervalMinutes();

  if (intervalMinutes === null) {
    // Auto-sync disabled
    schedulerRunning = false;
    nextRunAt = null;
    console.log("[sync-scheduler] Auto-sync disabled (interval = 0)");
    return;
  }

  const delayMs = intervalMinutes * 60 * 1000;
  nextRunAt = new Date(Date.now() + delayMs);
  schedulerRunning = true;

  console.log(
    `[sync-scheduler] Next auto-sync in ${intervalMinutes} minute(s) at ${nextRunAt.toISOString()}`
  );

  schedulerTimer = setTimeout(async () => {
    schedulerTimer = null;
    await runScheduledSync();
  }, delayMs);
}

/**
 * Execute the scheduled scan, then re-schedule.
 */
async function runScheduledSync(): Promise<void> {
  lastRunAt = new Date();
  console.log(`[sync-scheduler] Running scheduled sync at ${lastRunAt.toISOString()}`);

  try {
    const result = await triggerScan(undefined, "scheduled");
    if (!result.started) {
      console.log(`[sync-scheduler] Scheduled sync skipped: ${result.reason}`);
    } else {
      console.log(`[sync-scheduler] Scheduled scan started (runId=${result.syncRunId ?? "unknown"})`);
    }
  } catch (err) {
    console.error(
      "[sync-scheduler] Scheduled scan error:",
      err instanceof Error ? err.message : err
    );
  }

  // Re-schedule the next run regardless of outcome
  await scheduleNextRun();
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Start the sync scheduler. Safe to call multiple times — only one timer
 * runs at a time.
 */
export async function startSyncScheduler(): Promise<void> {
  console.log("[sync-scheduler] Starting...");
  await scheduleNextRun();
}

/**
 * Stop the sync scheduler and cancel any pending timer.
 */
export function stopSyncScheduler(): void {
  if (schedulerTimer !== null) {
    clearTimeout(schedulerTimer);
    schedulerTimer = null;
  }
  schedulerRunning = false;
  nextRunAt = null;
  console.log("[sync-scheduler] Stopped");
}

/**
 * Reload the scheduler with the latest interval from settings.
 * Call this after updating the sync_interval_minutes setting.
 */
export async function reloadSyncScheduler(): Promise<void> {
  console.log("[sync-scheduler] Reloading with updated interval...");
  await scheduleNextRun();
}
