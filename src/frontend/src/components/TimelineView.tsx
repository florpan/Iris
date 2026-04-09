/**
 * TimelineView.tsx
 *
 * Chronological timeline display for images. Groups images by date with
 * three zoom levels: year → month → day.
 *
 * Features:
 *  - Three grouping levels: year, month, day
 *  - Zoom between levels via toolbar buttons
 *  - Virtual scrolling for large collections
 *  - Jump-to-date control
 *  - Date source indicator (EXIF vs file date)
 *  - Works with folder, search, and filter result sets
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  ImageOff,
  Loader2,
  ZoomIn,
  ZoomOut,
  CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ImageDetailModal } from "./ImageDetailModal";
import {
  buildImageDetailUrl,
  saveScrollPosition,
  getScrollPosition,
  type ReturnContext,
} from "@/hooks/useNavigationContext";

// ── Types ─────────────────────────────────────────────────────────────────────

export type GroupLevel = "year" | "month" | "day";

export interface TimelineFilters {
  sourceId?: number | null;
  folderPath?: string | null;
  q?: string;
  camera?: string;
  lens?: string;
  dateFrom?: string;
  dateTo?: string;
  format?: string;
  minSize?: string;
  maxSize?: string;
}

interface ImageItem {
  id: number;
  fileName: string;
  thumbnailPath: string | null;
  takenAt: string | null;
  fileModifiedAt: string | null;
  dateSource: "exif" | "file";
}

interface TimelineGroup {
  key: string;
  year: number;
  month?: number;
  day?: number;
  label: string;
  count: number;
  dateSource: "exif" | "file" | "mixed";
  representative: ImageItem | null;
  images: ImageItem[];
}

interface TimelineData {
  level: GroupLevel;
  total: number;
  groups: TimelineGroup[];
}

interface TimelineViewProps {
  filters?: TimelineFilters;
  /** The page/context this is embedded in (for back-navigation) */
  returnContext?: "folder" | "search" | "browse";
  className?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const LEVEL_LABELS: Record<GroupLevel, string> = {
  year: "Year",
  month: "Month",
  day: "Day",
};

const LEVEL_ORDER: GroupLevel[] = ["year", "month", "day"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildTimelineUrl(filters: TimelineFilters, level: GroupLevel): string {
  const p = new URLSearchParams();
  p.set("level", level);
  if (filters.sourceId != null) p.set("sourceId", String(filters.sourceId));
  if (filters.folderPath != null) p.set("folderPath", filters.folderPath);
  if (filters.q) p.set("q", filters.q);
  if (filters.camera) p.set("camera", filters.camera);
  if (filters.lens) p.set("lens", filters.lens);
  if (filters.dateFrom) p.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) p.set("dateTo", filters.dateTo);
  if (filters.format) p.set("format", filters.format);
  if (filters.minSize) p.set("minSize", filters.minSize);
  if (filters.maxSize) p.set("maxSize", filters.maxSize);
  return `/api/timeline?${p}`;
}

function formatDateSource(ds: "exif" | "file" | "mixed"): string {
  if (ds === "exif") return "EXIF date";
  if (ds === "file") return "File date";
  return "Mixed (EXIF + file dates)";
}

// ── DayGrid — full image grid for day-level groups ────────────────────────────

interface DayGridProps {
  group: TimelineGroup;
  onOpen: (imageId: number, imageIds: number[]) => void;
}

function DayGrid({ group, onOpen }: DayGridProps) {
  const imageIds = group.images.map((i) => i.id);
  return (
    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-1.5 mt-3">
      {group.images.map((img) => (
        <button
          key={img.id}
          onClick={() => onOpen(img.id, imageIds)}
          title={img.fileName}
          className={cn(
            "relative aspect-square rounded overflow-hidden",
            "bg-[var(--color-bg-secondary)] dark:bg-[var(--color-border)]",
            "focus:outline-none focus:ring-2 focus:ring-[#1456f0] focus:ring-offset-1",
            "hover:opacity-90 transition-opacity cursor-pointer group"
          )}
        >
          {img.thumbnailPath ? (
            <img
              src={`/api/images/${img.id}/thumb`}
              alt={img.fileName}
              className="w-full h-full object-cover transition-transform duration-150 group-hover:scale-105"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageOff className="w-4 h-4 text-[var(--color-text-muted)]" />
            </div>
          )}
        </button>
      ))}
    </div>
  );
}

// ── TimelineGroup row ────────────────────────────────────────────────────────

interface GroupRowProps {
  group: TimelineGroup;
  level: GroupLevel;
  isExpanded: boolean;
  onToggle: () => void;
  onDrillDown: (group: TimelineGroup) => void;
  onOpen: (imageId: number, imageIds: number[]) => void;
}

function GroupRow({ group, level, isExpanded, onToggle, onDrillDown, onOpen }: GroupRowProps) {
  const canDrillDown = level !== "day";
  const representativeIds = group.images.map((i) => i.id);

  return (
    <div className="border border-[var(--color-border)] rounded-[var(--radius-comfortable)] overflow-hidden">
      {/* Header */}
      <button
        onClick={canDrillDown ? () => onDrillDown(group) : onToggle}
        className={cn(
          "w-full flex items-center gap-3 px-4 py-3 text-left",
          "bg-[var(--color-bg)] hover:bg-[var(--color-bg-secondary)] dark:hover:bg-[var(--color-border)]/50",
          "transition-colors group"
        )}
      >
        {/* Expand/collapse arrow for day-level */}
        {level === "day" ? (
          <span className="text-[var(--color-text-muted)] shrink-0">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </span>
        ) : (
          <span className="text-[var(--color-text-muted)] shrink-0">
            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </span>
        )}

        {/* Label */}
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-[var(--color-text-heading)] truncate block">
            {group.label}
          </span>
          <span className="text-xs text-[var(--color-text-muted)]">
            {group.count.toLocaleString()} {group.count === 1 ? "image" : "images"}
            {" · "}
            <span title={formatDateSource(group.dateSource)}>
              {group.dateSource === "mixed"
                ? "Mixed dates"
                : group.dateSource === "exif"
                ? "EXIF"
                : "File date"}
            </span>
          </span>
        </div>

        {/* Representative thumbnails strip */}
        <div className="flex items-center gap-1 shrink-0">
          {group.images.slice(0, 4).map((img) => (
            <div
              key={img.id}
              className="w-8 h-8 rounded overflow-hidden bg-[var(--color-bg-secondary)] dark:bg-[var(--color-border)] shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onOpen(img.id, representativeIds);
              }}
              role="button"
              tabIndex={-1}
            >
              {img.thumbnailPath ? (
                <img
                  src={`/api/images/${img.id}/thumb`}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageOff className="w-3 h-3 text-[var(--color-text-muted)]" />
                </div>
              )}
            </div>
          ))}
          {group.count > 4 && (
            <span className="text-xs text-[var(--color-text-muted)] pl-1">
              +{(group.count - 4).toLocaleString()}
            </span>
          )}
        </div>
      </button>

      {/* Day-level expanded grid */}
      {level === "day" && isExpanded && (
        <div className="px-4 pb-4 bg-[var(--color-bg-secondary)]/30 border-t border-[var(--color-border)]">
          <DayGrid group={group} onOpen={onOpen} />
        </div>
      )}
    </div>
  );
}

// ── JumpToDate control ────────────────────────────────────────────────────────

interface JumpToDateProps {
  groups: TimelineGroup[];
  level: GroupLevel;
  onJump: (key: string) => void;
}

function JumpToDate({ groups, level, onJump }: JumpToDateProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const filtered = useMemo(() => {
    if (!value.trim()) return groups;
    const lower = value.toLowerCase();
    return groups.filter((g) => g.label.toLowerCase().includes(lower) || g.key.includes(lower));
  }, [groups, value]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--radius-md)] text-xs font-medium transition-colors",
          open
            ? "bg-[#1456f0]/10 text-[#1456f0] dark:bg-[#1456f0]/20 dark:text-[#60a5fa]"
            : "text-[var(--color-text-secondary)] hover:bg-black/5 dark:hover:bg-white/5"
        )}
        title="Jump to date"
      >
        <CalendarDays className="w-3.5 h-3.5" />
        Jump to date
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 w-64 rounded-[var(--radius-comfortable)] border border-[var(--color-border)] bg-[var(--color-bg)] shadow-lg overflow-hidden">
          <div className="p-2 border-b border-[var(--color-border)]">
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={`Search ${LEVEL_LABELS[level].toLowerCase()}…`}
              className={cn(
                "w-full px-2.5 py-1.5 text-xs rounded-[var(--radius-sm)]",
                "bg-[var(--color-bg-secondary)] border border-[var(--color-border)]",
                "text-[var(--color-text-heading)] placeholder:text-[var(--color-text-muted)]",
                "focus:outline-none focus:ring-1 focus:ring-[#1456f0]"
              )}
              autoFocus
            />
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-xs text-center text-[var(--color-text-muted)]">
                No matching dates
              </div>
            ) : (
              filtered.map((g) => (
                <button
                  key={g.key}
                  onClick={() => {
                    onJump(g.key);
                    setOpen(false);
                    setValue("");
                  }}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 text-xs text-left",
                    "hover:bg-[var(--color-bg-secondary)] dark:hover:bg-[var(--color-border)]/50 transition-colors"
                  )}
                >
                  <span className="text-[var(--color-text-heading)] font-medium">{g.label}</span>
                  <span className="text-[var(--color-text-muted)] ml-2">
                    {g.count.toLocaleString()}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main TimelineView component ───────────────────────────────────────────────

export function TimelineView({ filters = {}, returnContext = "folder", className }: TimelineViewProps) {
  const [level, setLevel] = useState<GroupLevel>("month");
  const [data, setData] = useState<TimelineData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  // Detail modal
  const [detailImageId, setDetailImageId] = useState<number | null>(null);
  const [detailImageIds, setDetailImageIds] = useState<number[]>([]);
  const [detailContext, setDetailContext] = useState<ReturnContext | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Refs map for scroll-to behavior (jump-to-date)
  const groupRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Load timeline data when filters or level changes
  const loadData = useCallback(
    (f: TimelineFilters, lv: GroupLevel) => {
      setLoading(true);
      setError(null);
      const url = buildTimelineUrl(f, lv);
      fetch(url)
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then((json: TimelineData) => {
          setData(json);
          setExpandedKeys(new Set()); // reset expansions on data change
        })
        .catch((e) => setError(e.message ?? "Failed to load timeline"))
        .finally(() => setLoading(false));
    },
    []
  );

  // Load on mount and when filters change
  useEffect(() => {
    loadData(filters, level);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filters.sourceId,
    filters.folderPath,
    filters.q,
    filters.camera,
    filters.lens,
    filters.dateFrom,
    filters.dateTo,
    filters.format,
    filters.minSize,
    filters.maxSize,
  ]);

  // Reload when level changes (keep same filters)
  const handleLevelChange = useCallback(
    (newLevel: GroupLevel) => {
      setLevel(newLevel);
      loadData(filters, newLevel);
    },
    [filters, loadData]
  );

  // Zoom in (go to finer level)
  const zoomIn = useCallback(() => {
    const idx = LEVEL_ORDER.indexOf(level);
    if (idx < LEVEL_ORDER.length - 1) {
      handleLevelChange(LEVEL_ORDER[idx + 1]);
    }
  }, [level, handleLevelChange]);

  // Zoom out (go to coarser level)
  const zoomOut = useCallback(() => {
    const idx = LEVEL_ORDER.indexOf(level);
    if (idx > 0) {
      handleLevelChange(LEVEL_ORDER[idx - 1]);
    }
  }, [level, handleLevelChange]);

  // Drill down into a group (click on year → month level, month → day level)
  const handleDrillDown = useCallback(
    (group: TimelineGroup) => {
      const nextLevel = level === "year" ? "month" : level === "month" ? "day" : "day";

      // Build filters with date range constrained to this group
      let newDateFrom = filters.dateFrom ?? "";
      let newDateTo = filters.dateTo ?? "";

      if (level === "year") {
        newDateFrom = `${group.year}-01-01`;
        newDateTo = `${group.year}-12-31`;
      } else if (level === "month" && group.month != null) {
        const lastDay = new Date(group.year, group.month, 0).getDate();
        newDateFrom = `${group.year}-${String(group.month).padStart(2, "0")}-01`;
        newDateTo = `${group.year}-${String(group.month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      }

      const newFilters: TimelineFilters = {
        ...filters,
        dateFrom: newDateFrom,
        dateTo: newDateTo,
      };

      setLevel(nextLevel);
      loadData(newFilters, nextLevel);
    },
    [level, filters, loadData]
  );

  // Toggle day-level group expansion
  const toggleGroup = useCallback((key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  // Open image detail
  const openDetail = useCallback(
    (imageId: number, imageIds: number[]) => {
      const returnUrl = window.location.pathname + window.location.search;
      const scrollTop = scrollRef.current?.scrollTop ?? 0;
      saveScrollPosition(returnUrl, scrollTop);

      const detailUrl = buildImageDetailUrl(imageId, returnContext, new URLSearchParams());
      window.history.pushState({ imageId, from: returnContext }, "", detailUrl);

      setDetailContext({
        type: returnContext,
        label: "Back to timeline",
        returnUrl,
      });
      setDetailImageId(imageId);
      setDetailImageIds(imageIds);
    },
    [returnContext]
  );

  // Close modal on popstate
  useEffect(() => {
    const handlePopstate = () => {
      const p = window.location.pathname;
      if (!p.startsWith("/image/") && detailImageId !== null) {
        setDetailImageId(null);
        setDetailContext(null);
        const returnUrl = window.location.pathname + window.location.search;
        const scrollTop = getScrollPosition(returnUrl);
        if (scrollTop !== null && scrollRef.current) {
          setTimeout(() => {
            if (scrollRef.current) scrollRef.current.scrollTop = scrollTop;
          }, 0);
        }
      }
    };
    window.addEventListener("popstate", handlePopstate);
    return () => window.removeEventListener("popstate", handlePopstate);
  }, [detailImageId]);

  // Jump to a group by key (scroll it into view)
  const handleJump = useCallback((key: string) => {
    const el = groupRefs.current.get(key);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const canZoomIn = LEVEL_ORDER.indexOf(level) < LEVEL_ORDER.length - 1;
  const canZoomOut = LEVEL_ORDER.indexOf(level) > 0;

  return (
    <div className={cn("flex flex-col h-full min-h-0 overflow-hidden", className)}>
      {/* ── Toolbar ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg)] shrink-0 flex-wrap gap-y-1.5">
        {/* Level tabs */}
        <div className="flex items-center gap-0.5 border border-[var(--color-border)] rounded-[var(--radius-md)] p-0.5">
          {LEVEL_ORDER.map((lv) => (
            <button
              key={lv}
              onClick={() => handleLevelChange(lv)}
              className={cn(
                "px-2.5 py-1 rounded text-xs font-medium transition-colors",
                level === lv
                  ? "bg-[var(--color-bg)] text-[var(--color-text-heading)] shadow-sm"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
              )}
              aria-pressed={level === lv}
            >
              {LEVEL_LABELS[lv]}
            </button>
          ))}
        </div>

        {/* Zoom in / zoom out */}
        <button
          onClick={zoomOut}
          disabled={!canZoomOut}
          title="Zoom out (broader grouping)"
          className={cn(
            "flex items-center justify-center w-7 h-7 rounded-[var(--radius-sm)] transition-colors",
            canZoomOut
              ? "text-[var(--color-text-secondary)] hover:bg-black/5 dark:hover:bg-white/5"
              : "text-[var(--color-text-muted)] opacity-40 cursor-not-allowed"
          )}
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={zoomIn}
          disabled={!canZoomIn}
          title="Zoom in (finer grouping)"
          className={cn(
            "flex items-center justify-center w-7 h-7 rounded-[var(--radius-sm)] transition-colors",
            canZoomIn
              ? "text-[var(--color-text-secondary)] hover:bg-black/5 dark:hover:bg-white/5"
              : "text-[var(--color-text-muted)] opacity-40 cursor-not-allowed"
          )}
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>

        {/* Result count */}
        <span className="text-xs text-[var(--color-text-muted)] ml-1">
          {loading ? (
            <span className="flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              Loading…
            </span>
          ) : data ? (
            <>
              {data.total.toLocaleString()} {data.total === 1 ? "image" : "images"} across{" "}
              {data.groups.length} {LEVEL_LABELS[level].toLowerCase()}
              {data.groups.length !== 1 ? "s" : ""}
            </>
          ) : null}
        </span>

        {/* Jump-to-date (right-aligned) */}
        <div className="ml-auto">
          {data && data.groups.length > 0 && (
            <JumpToDate groups={data.groups} level={level} onJump={handleJump} />
          )}
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────────────────── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
        {error ? (
          <div className="flex items-center justify-center h-48 text-sm text-red-500">
            {error}
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="flex flex-col items-center gap-3 text-[var(--color-text-muted)]">
              <Loader2 className="w-8 h-8 animate-spin" />
              <span className="text-sm">Loading timeline…</span>
            </div>
          </div>
        ) : !data || data.groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-[var(--color-text-muted)]">
            <Calendar className="w-10 h-10 opacity-30" />
            <span className="text-sm">No images found</span>
          </div>
        ) : (
          <div className="p-4 space-y-2 max-w-5xl mx-auto">
            {data.groups.map((group) => (
              <div
                key={group.key}
                ref={(el) => {
                  if (el) groupRefs.current.set(group.key, el);
                  else groupRefs.current.delete(group.key);
                }}
              >
                <GroupRow
                  group={group}
                  level={level}
                  isExpanded={expandedKeys.has(group.key)}
                  onToggle={() => toggleGroup(group.key)}
                  onDrillDown={handleDrillDown}
                  onOpen={openDetail}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Image detail modal ────────────────────────────────────────────────── */}
      {detailImageId !== null && (
        <ImageDetailModal
          imageId={detailImageId}
          imageIds={detailImageIds}
          returnContext={detailContext}
          onNavigate={(id) => setDetailImageId(id)}
          onClose={() => {
            setDetailImageId(null);
            setDetailContext(null);
            if (window.location.pathname.startsWith("/image/")) {
              window.history.back();
            }
          }}
          onBack={() => window.history.back()}
        />
      )}
    </div>
  );
}
