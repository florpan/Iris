/**
 * StatsDashboard.tsx
 *
 * Collection overview stats panel. Shows total images, storage size,
 * date range, most-used camera, and images by format.
 */

import { useEffect, useState } from "react";
import { Images, HardDrive, Calendar, Camera, FileImage } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface StatsData {
  totalImages: number;
  totalSources: number;
  byFormat: Record<string, number>;
  dateRange: { earliest: string | null; latest: string | null };
  topCamera: string | null;
  totalStorageBytes: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = bytes / Math.pow(k, i);
  return `${val < 10 ? val.toFixed(1) : Math.round(val)} ${units[i]}`;
}

function formatDateRange(earliest: string | null, latest: string | null): string {
  if (!earliest && !latest) return "No dates";
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short" });
  if (!latest) return `Since ${fmt(earliest!)}`;
  if (!earliest) return `Until ${fmt(latest)}`;
  const from = new Date(earliest);
  const to = new Date(latest);
  if (from.getFullYear() === to.getFullYear()) {
    return String(from.getFullYear());
  }
  return `${from.getFullYear()} – ${to.getFullYear()}`;
}

function formatMimeLabel(mime: string): string {
  return mime.replace("image/", "").toUpperCase();
}

// ── Sub-components ─────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
}

function StatCard({ icon: Icon, label, value, sub }: StatCardProps) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-[var(--radius-comfortable)] bg-[var(--color-bg-secondary)] dark:bg-[var(--color-border)]/30">
      <div className="flex-shrink-0 w-8 h-8 rounded-[var(--radius-md)] bg-[#1456f0]/10 dark:bg-[#1456f0]/20 flex items-center justify-center">
        <Icon className="w-4 h-4 text-[#1456f0] dark:text-[#60a5fa]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
        <p className="text-sm font-semibold text-[var(--color-text-heading)] truncate">{value}</p>
        {sub && <p className="text-xs text-[var(--color-text-muted)] truncate">{sub}</p>}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

interface StatsDashboardProps {
  /** If provided, these stats are used directly (no fetch). */
  stats?: StatsData | null;
  className?: string;
}

export function StatsDashboard({ stats: propStats, className }: StatsDashboardProps) {
  const [stats, setStats] = useState<StatsData | null>(propStats ?? null);
  const [loading, setLoading] = useState(!propStats);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (propStats !== undefined) {
      setStats(propStats);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch("/api/stats")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => {
        setStats(json.data ?? null);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message ?? "Failed to load stats");
        setLoading(false);
      });
  }, [propStats]);

  if (loading) {
    return (
      <div className={cn("grid grid-cols-2 gap-2", className)}>
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-16 rounded-[var(--radius-comfortable)] bg-[var(--color-bg-secondary)] animate-pulse"
            style={{ animationDelay: `${i * 60}ms` }}
          />
        ))}
      </div>
    );
  }

  if (error || !stats) {
    return null;
  }

  // Top formats
  const topFormats = Object.entries(stats.byFormat)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([mime, count]) => `${formatMimeLabel(mime)} (${count.toLocaleString()})`)
    .join(", ");

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)] px-1">
        Collection Overview
      </p>
      <div className="grid grid-cols-2 gap-2">
        <StatCard
          icon={Images}
          label="Total images"
          value={stats.totalImages.toLocaleString()}
        />
        <StatCard
          icon={HardDrive}
          label="Storage"
          value={formatBytes(stats.totalStorageBytes)}
        />
        <StatCard
          icon={Calendar}
          label="Date range"
          value={formatDateRange(stats.dateRange.earliest, stats.dateRange.latest)}
        />
        <StatCard
          icon={Camera}
          label="Top camera"
          value={stats.topCamera ?? "—"}
        />
      </div>
      {topFormats && (
        <div className="flex items-center gap-2 px-1 pt-1">
          <FileImage className="w-3.5 h-3.5 text-[var(--color-text-muted)] flex-shrink-0" />
          <p className="text-xs text-[var(--color-text-muted)] truncate">{topFormats}</p>
        </div>
      )}
    </div>
  );
}
