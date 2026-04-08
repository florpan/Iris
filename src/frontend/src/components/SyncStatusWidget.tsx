/**
 * SyncStatusWidget.tsx
 *
 * Displays sync status in the sidebar: last sync time, current scan progress,
 * and a button to trigger a manual sync.
 *
 * Polling strategy:
 *  - Idle: poll every 30s to refresh last-sync info
 *  - Scanning: poll every 2s for progress updates
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { RefreshCw, CheckCircle, AlertCircle, Loader2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

interface ScanProgress {
  status: "idle" | "scanning" | "error";
  scanned: number;
  total: number;
  added: number;
  updated: number;
  skipped: number;
  missing: number;
  errors: string[];
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
}

interface LastRun {
  id: number;
  startedAt: string;
  completedAt: string | null;
  status: string;
  added: number;
  updated: number;
  missing: number;
  errorCount: number;
}

interface SyncStatus {
  scan: ScanProgress;
  scheduler: {
    intervalMinutes: number | null;
    nextRunAt: string | null;
    lastRunAt: string | null;
  };
  lastRun: LastRun | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "Never";
  const date = new Date(dateStr);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface SyncStatusWidgetProps {
  collapsed?: boolean;
}

export function SyncStatusWidget({ collapsed = false }: SyncStatusWidgetProps) {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [triggerError, setTriggerError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/sync/status");
      if (res.ok) {
        const json = await res.json();
        setStatus(json.data);
      }
    } catch {
      // Silently ignore network errors — show stale data
    }
  }, []);

  // Schedule the next poll based on current scan state
  const schedulePoll = useCallback(
    (isScanning: boolean) => {
      if (pollRef.current) clearTimeout(pollRef.current);
      const delay = isScanning ? 2000 : 30000;
      pollRef.current = setTimeout(async () => {
        await fetchStatus();
      }, delay);
    },
    [fetchStatus]
  );

  // Initial fetch
  useEffect(() => {
    fetchStatus();
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [fetchStatus]);

  // Re-schedule poll whenever status changes
  useEffect(() => {
    if (status) {
      schedulePoll(status.scan.status === "scanning");
    }
  }, [status, schedulePoll]);

  const handleTriggerScan = async () => {
    if (triggering || status?.scan.status === "scanning") return;
    setTriggering(true);
    setTriggerError(null);
    try {
      const res = await fetch("/api/sync/scan", { method: "POST" });
      if (res.ok) {
        // Immediately fetch updated status
        await fetchStatus();
      } else {
        const json = await res.json().catch(() => ({}));
        setTriggerError(json.error ?? "Failed to start scan");
      }
    } catch {
      setTriggerError("Network error");
    } finally {
      setTriggering(false);
    }
  };

  const isScanning = status?.scan.status === "scanning";
  const hasError = status?.scan.status === "error";
  const lastSyncAt =
    status?.lastRun?.completedAt ?? status?.scheduler?.lastRunAt ?? null;

  // Collapsed mode: just show an icon button
  if (collapsed) {
    return (
      <button
        onClick={handleTriggerScan}
        disabled={isScanning || triggering}
        className={cn(
          "flex items-center justify-center w-8 h-8 rounded-[var(--radius-md)] transition-colors",
          isScanning
            ? "text-[var(--brand-blue)] cursor-default"
            : hasError
            ? "text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
            : "text-[var(--color-text-muted)] hover:bg-black/5 hover:text-[var(--color-text-heading)] dark:hover:bg-white/5 dark:hover:text-white"
        )}
        title={
          isScanning
            ? `Scanning… ${status.scan.scanned}/${status.scan.total}`
            : hasError
            ? `Sync error: ${status.scan.errorMessage ?? "Unknown error"}`
            : `Last sync: ${formatRelativeTime(lastSyncAt)}`
        }
        aria-label="Sync status"
      >
        {isScanning ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : hasError ? (
          <AlertCircle className="h-4 w-4" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
      </button>
    );
  }

  // Expanded mode: full widget
  return (
    <div className="px-3 py-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
          Sync
        </span>
        <button
          onClick={handleTriggerScan}
          disabled={isScanning || triggering}
          className={cn(
            "flex items-center gap-1 text-xs px-1.5 py-0.5 rounded transition-colors",
            isScanning || triggering
              ? "text-[var(--color-text-muted)] cursor-default"
              : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-heading)] hover:bg-black/5 dark:hover:bg-white/5"
          )}
          title={isScanning ? "Scan in progress…" : "Trigger manual sync"}
        >
          {isScanning || triggering ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          <span>{isScanning ? "Scanning…" : "Sync now"}</span>
        </button>
      </div>

      {/* Status line */}
      <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
        {isScanning ? (
          <>
            <Loader2 className="h-3 w-3 shrink-0 animate-spin text-[var(--brand-blue)]" />
            <span className="truncate">
              {status.scan.total > 0
                ? `${status.scan.scanned}/${status.scan.total} files`
                : "Scanning…"}
            </span>
          </>
        ) : hasError ? (
          <>
            <AlertCircle className="h-3 w-3 shrink-0 text-red-500" />
            <span className="truncate text-red-500">
              {status?.scan.errorMessage ?? "Sync error"}
            </span>
          </>
        ) : (
          <>
            {status?.lastRun?.errorCount ? (
              <AlertCircle className="h-3 w-3 shrink-0 text-amber-500" />
            ) : (
              <CheckCircle className="h-3 w-3 shrink-0 text-emerald-500" />
            )}
            <span className="truncate">
              {lastSyncAt ? formatRelativeTime(lastSyncAt) : "Never synced"}
            </span>
          </>
        )}
      </div>

      {/* Progress bar when scanning */}
      {isScanning && status.scan.total > 0 && (
        <div className="mt-1.5 h-1 w-full rounded-full bg-[var(--color-bg-secondary)] dark:bg-[var(--color-border)] overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--brand-blue)] transition-all duration-300"
            style={{
              width: `${Math.min(
                100,
                Math.round((status.scan.scanned / status.scan.total) * 100)
              )}%`,
            }}
          />
        </div>
      )}

      {/* Next scheduled run */}
      {!isScanning && status?.scheduler.nextRunAt && (
        <div className="flex items-center gap-1 mt-1 text-xs text-[var(--color-text-muted)]">
          <Clock className="h-3 w-3 shrink-0" />
          <span className="truncate">
            Next: {formatRelativeTime(status.scheduler.nextRunAt)}
          </span>
        </div>
      )}

      {/* Last run stats */}
      {!isScanning && status?.lastRun && (
        <div className="flex gap-2 mt-1 text-xs text-[var(--color-text-muted)]">
          {status.lastRun.added > 0 && (
            <span className="text-emerald-600 dark:text-emerald-400">+{status.lastRun.added}</span>
          )}
          {status.lastRun.updated > 0 && (
            <span className="text-blue-500">~{status.lastRun.updated}</span>
          )}
          {status.lastRun.missing > 0 && (
            <span className="text-amber-500">−{status.lastRun.missing}</span>
          )}
          {status.lastRun.errorCount > 0 && (
            <span className="text-red-500">{status.lastRun.errorCount} err</span>
          )}
          {status.lastRun.added === 0 &&
            status.lastRun.updated === 0 &&
            status.lastRun.missing === 0 &&
            status.lastRun.errorCount === 0 && (
              <span>No changes</span>
            )}
        </div>
      )}

      {/* Trigger error */}
      {triggerError && (
        <p className="mt-1 text-xs text-red-500 truncate">{triggerError}</p>
      )}
    </div>
  );
}
