/**
 * ImageGrid.tsx
 *
 * Thumbnail grid for images in the selected folder.
 * Features:
 *  - Configurable grid density (small / medium / large thumbnails)
 *  - Sort by name, date, size, or format
 *  - Pagination for large folders (never loads all at once)
 *  - Keyboard navigation (arrow keys, enter)
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  LayoutGrid,
  Loader2,
  AlertCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  ImageOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SelectedFolder } from "./FolderTree";

// ── Types ─────────────────────────────────────────────────────────────────────

export type GridDensity = "small" | "medium" | "large";
export type SortField = "date" | "name" | "size" | "format";
export type SortOrder = "asc" | "desc";

interface ImageItem {
  id: number;
  fileName: string;
  relativePath: string;
  thumbnailPath: string | null;
  takenAt: string | null;
  width: number | null;
  height: number | null;
  fileSize: number | null;
  mimeType: string | null;
}

interface PaginationMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface ImageGridProps {
  selected: SelectedFolder | null;
  density: GridDensity;
  onDensityChange: (d: GridDensity) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number | null): string {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

const PAGE_SIZE = 50;

const DENSITY_CONFIG: Record<
  GridDensity,
  { gridClass: string; thumbClass: string; label: string }
> = {
  small: {
    gridClass:
      "grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-1",
    thumbClass: "aspect-square",
    label: "Small",
  },
  medium: {
    gridClass:
      "grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2",
    thumbClass: "aspect-square",
    label: "Medium",
  },
  large: {
    gridClass:
      "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3",
    thumbClass: "aspect-square",
    label: "Large",
  },
};

const SORT_OPTIONS: Array<{ value: SortField; label: string }> = [
  { value: "date", label: "Date" },
  { value: "name", label: "Name" },
  { value: "size", label: "Size" },
  { value: "format", label: "Format" },
];

// ── Sub-components ────────────────────────────────────────────────────────────

interface ThumbnailProps {
  image: ImageItem;
  density: GridDensity;
  isFocused: boolean;
  onFocus: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

function Thumbnail({ image, density, isFocused, onFocus, onKeyDown }: ThumbnailProps) {
  const [imgError, setImgError] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isFocused) ref.current?.focus();
  }, [isFocused]);

  const showLabel = density === "large" || density === "medium";

  return (
    <div
      ref={ref}
      tabIndex={0}
      role="button"
      aria-label={image.fileName}
      className={cn(
        "group relative rounded-[var(--radius-comfortable)] overflow-hidden bg-[var(--color-bg-secondary)] dark:bg-[var(--color-border)] cursor-pointer",
        "focus:outline-none focus:ring-2 focus:ring-[#1456f0] focus:ring-offset-1",
        DENSITY_CONFIG[density].thumbClass
      )}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
    >
      {/* Thumbnail image */}
      {image.thumbnailPath && !imgError ? (
        <img
          src={`/api/images/${image.id}/thumb`}
          alt={image.fileName}
          className="w-full h-full object-cover transition-transform duration-150 group-hover:scale-105"
          loading="lazy"
          decoding="async"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <ImageOff className="w-6 h-6 text-[var(--color-text-muted)]" />
        </div>
      )}

      {/* Hover overlay with metadata */}
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent",
          "opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity duration-150",
          "flex flex-col justify-end p-1.5 gap-0.5"
        )}
      >
        {showLabel && (
          <p className="text-white text-xs font-medium truncate leading-tight">
            {image.fileName}
          </p>
        )}
        {density === "large" && (
          <p className="text-white/70 text-xs truncate leading-tight">
            {formatDate(image.takenAt)}
            {image.width && image.height
              ? ` · ${image.width}×${image.height}`
              : ""}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function ImageGrid({ selected, density, onDensityChange }: ImageGridProps) {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortField>("date");
  const [order, setOrder] = useState<SortOrder>("desc");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  // Reset page when folder or sort changes
  useEffect(() => {
    setPage(1);
    setFocusedIndex(null);
  }, [selected, sort, order]);

  // Load images when selection, page, sort change
  useEffect(() => {
    if (!selected) {
      setImages([]);
      setPagination(null);
      return;
    }

    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      path: selected.path,
      sort,
      order,
      page: String(page),
      pageSize: String(PAGE_SIZE),
    });

    fetch(`/api/folders/${selected.sourceId}/images?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => {
        setImages(json.data ?? []);
        setPagination(json.pagination ?? null);
      })
      .catch((err) => {
        setError(err.message ?? "Failed to load images");
      })
      .finally(() => setLoading(false));
  }, [selected, page, sort, order]);

  const handleSortField = (field: SortField) => {
    if (field === sort) {
      // Toggle order
      setOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSort(field);
      setOrder("desc");
    }
  };

  // Keyboard navigation through grid
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      const cols = {
        small: 6,
        medium: 4,
        large: 3,
      }[density];

      let next: number | null = null;

      if (e.key === "ArrowRight") next = Math.min(index + 1, images.length - 1);
      else if (e.key === "ArrowLeft") next = Math.max(index - 1, 0);
      else if (e.key === "ArrowDown") next = Math.min(index + cols, images.length - 1);
      else if (e.key === "ArrowUp") next = Math.max(index - cols, 0);

      if (next !== null) {
        e.preventDefault();
        setFocusedIndex(next);
      }
    },
    [density, images.length]
  );

  // ── Empty state ──────────────────────────────────────────────────────────────

  if (!selected) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-[var(--color-text-muted)]">
        <LayoutGrid className="w-10 h-10 mb-3 opacity-30" />
        <p className="text-sm">Select a folder to browse images</p>
      </div>
    );
  }

  const totalImages = pagination?.total ?? 0;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--color-border)] flex-wrap gap-y-2">
        {/* Image count */}
        <span className="text-sm text-[var(--color-text-muted)] mr-auto">
          {loading ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Loading…
            </span>
          ) : (
            <>
              {totalImages.toLocaleString()}{" "}
              {totalImages === 1 ? "image" : "images"}
            </>
          )}
        </span>

        {/* Sort controls */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-[var(--color-text-muted)] mr-1">Sort:</span>
          {SORT_OPTIONS.map((opt) => {
            const isActive = sort === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => handleSortField(opt.value)}
                className={cn(
                  "flex items-center gap-0.5 px-2 py-1 rounded-[var(--radius-sm)] text-xs font-medium transition-colors",
                  isActive
                    ? "bg-[#1456f0]/10 text-[#1456f0] dark:bg-[#1456f0]/20 dark:text-[#60a5fa]"
                    : "text-[var(--color-text-secondary)] hover:bg-black/5 hover:text-[var(--color-text-heading)] dark:hover:bg-white/5"
                )}
                aria-pressed={isActive}
                title={`Sort by ${opt.label} (${isActive ? (order === "asc" ? "ascending" : "descending") : "click to sort"})`}
              >
                {opt.label}
                {isActive ? (
                  order === "asc" ? (
                    <ArrowUp className="w-3 h-3" />
                  ) : (
                    <ArrowDown className="w-3 h-3" />
                  )
                ) : (
                  <ArrowUpDown className="w-3 h-3 opacity-40" />
                )}
              </button>
            );
          })}
        </div>

        {/* Density controls */}
        <div className="flex items-center gap-0.5 border border-[var(--color-border)] rounded-[var(--radius-md)] p-0.5">
          {(["small", "medium", "large"] as GridDensity[]).map((d) => (
            <button
              key={d}
              onClick={() => onDensityChange(d)}
              className={cn(
                "px-2 py-0.5 rounded text-xs font-medium transition-colors",
                density === d
                  ? "bg-[var(--color-bg)] text-[var(--color-text-heading)] shadow-sm"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
              )}
              aria-pressed={density === d}
            >
              {DENSITY_CONFIG[d].label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content area ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {error ? (
          <div className="flex items-center gap-2 p-6 text-sm text-red-500">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : images.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center h-48 text-[var(--color-text-muted)]">
            <ImageOff className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm">No images in this folder</p>
          </div>
        ) : (
          <div className={cn("grid p-4", DENSITY_CONFIG[density].gridClass)}>
            {loading
              ? // Skeleton placeholders
                Array.from({ length: PAGE_SIZE }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "rounded-[var(--radius-comfortable)] bg-[var(--color-bg-secondary)] dark:bg-[var(--color-border)] animate-pulse",
                      DENSITY_CONFIG[density].thumbClass
                    )}
                    style={{ animationDelay: `${(i % 20) * 30}ms` }}
                  />
                ))
              : images.map((image, i) => (
                  <Thumbnail
                    key={image.id}
                    image={image}
                    density={density}
                    isFocused={focusedIndex === i}
                    onFocus={() => setFocusedIndex(i)}
                    onKeyDown={(e) => handleKeyDown(e, i)}
                  />
                ))}
          </div>
        )}
      </div>

      {/* ── Pagination ───────────────────────────────────────────────────────── */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-[var(--color-border)] text-sm">
          <span className="text-[var(--color-text-muted)]">
            Page {pagination.page} of {pagination.totalPages}
          </span>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pagination.page <= 1}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1.5 rounded-[var(--radius-md)] text-sm font-medium transition-colors",
                pagination.page <= 1
                  ? "text-[var(--color-text-muted)] cursor-not-allowed opacity-50"
                  : "text-[var(--color-text-secondary)] hover:bg-black/5 hover:text-[var(--color-text-heading)] dark:hover:bg-white/5"
              )}
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
              Prev
            </button>

            {/* Page numbers (show a window around current page) */}
            {(() => {
              const pages: number[] = [];
              const total = pagination.totalPages;
              const cur = pagination.page;
              const window = 2;
              for (
                let p = Math.max(1, cur - window);
                p <= Math.min(total, cur + window);
                p++
              ) {
                pages.push(p);
              }
              // Always include first and last
              if (pages[0] > 1) pages.unshift(1);
              if (pages[pages.length - 1] < total) pages.push(total);

              return pages.map((p, i) => {
                const prev = pages[i - 1];
                return (
                  <span key={p} className="flex items-center gap-1">
                    {prev && p - prev > 1 && (
                      <span className="text-[var(--color-text-muted)] px-1">…</span>
                    )}
                    <button
                      onClick={() => setPage(p)}
                      className={cn(
                        "w-8 h-8 flex items-center justify-center rounded-[var(--radius-md)] text-sm font-medium transition-colors",
                        p === cur
                          ? "bg-[#1456f0] text-white"
                          : "text-[var(--color-text-secondary)] hover:bg-black/5 dark:hover:bg-white/5"
                      )}
                      aria-current={p === cur ? "page" : undefined}
                    >
                      {p}
                    </button>
                  </span>
                );
              });
            })()}

            <button
              onClick={() =>
                setPage((p) => Math.min(pagination.totalPages, p + 1))
              }
              disabled={pagination.page >= pagination.totalPages}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1.5 rounded-[var(--radius-md)] text-sm font-medium transition-colors",
                pagination.page >= pagination.totalPages
                  ? "text-[var(--color-text-muted)] cursor-not-allowed opacity-50"
                  : "text-[var(--color-text-secondary)] hover:bg-black/5 hover:text-[var(--color-text-heading)] dark:hover:bg-white/5"
              )}
              aria-label="Next page"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
