/**
 * BrowsePage.tsx
 *
 * Faceted browsing experience. Combines:
 *  - FacetPanel (left sidebar) — facets with live-updating counts
 *  - StatsDashboard (top of sidebar) — collection overview
 *  - Thumbnail grid (main area) — paginated image results matching filters
 *
 * URL state: /browse?camera=<cam>&lens=<lens>&dateFrom=<d>&dateTo=<d>&format=<f>
 *            &focalLengthMin=<fl>&focalLengthMax=<fl>&isoMin=<iso>&isoMax=<iso>&page=<n>
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, ImageOff, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { FacetPanel, type FacetFilters, type FacetData } from "@/components/FacetPanel";
import { StatsDashboard } from "@/components/StatsDashboard";
import type { GridDensity } from "@/components/ImageGrid";

// ── Types ─────────────────────────────────────────────────────────────────────

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
  cameraModel: string | null;
  lensModel: string | null;
  iptcTitle: string | null;
}

interface PaginationMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

const DENSITY_CONFIG: Record<GridDensity, { gridClass: string; thumbClass: string }> = {
  small: {
    gridClass: "grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-1",
    thumbClass: "aspect-square",
  },
  medium: {
    gridClass: "grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2",
    thumbClass: "aspect-square",
  },
  large: {
    gridClass: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3",
    thumbClass: "aspect-square",
  },
};

function parseUrlState(): { filters: FacetFilters; page: number } {
  const p = new URLSearchParams(window.location.search);
  return {
    filters: {
      camera: p.get("camera") ?? "",
      lens: p.get("lens") ?? "",
      format: p.get("format") ?? "",
      dateFrom: p.get("dateFrom") ?? "",
      dateTo: p.get("dateTo") ?? "",
      focalLengthMin: p.get("focalLengthMin") ?? "",
      focalLengthMax: p.get("focalLengthMax") ?? "",
      isoMin: p.get("isoMin") ?? "",
      isoMax: p.get("isoMax") ?? "",
    },
    page: Math.max(1, Number(p.get("page") ?? "1") || 1),
  };
}

function buildQueryString(filters: FacetFilters, page: number): URLSearchParams {
  const p = new URLSearchParams();
  if (filters.camera) p.set("camera", filters.camera);
  if (filters.lens) p.set("lens", filters.lens);
  if (filters.format) p.set("format", filters.format);
  if (filters.dateFrom) p.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) p.set("dateTo", filters.dateTo);
  if (filters.focalLengthMin) p.set("focalLengthMin", filters.focalLengthMin);
  if (filters.focalLengthMax) p.set("focalLengthMax", filters.focalLengthMax);
  if (filters.isoMin) p.set("isoMin", filters.isoMin);
  if (filters.isoMax) p.set("isoMax", filters.isoMax);
  if (page > 1) p.set("page", String(page));
  return p;
}

function hasAnyFilter(filters: FacetFilters): boolean {
  return !!(
    filters.camera || filters.lens || filters.format ||
    filters.dateFrom || filters.dateTo ||
    filters.focalLengthMin || filters.focalLengthMax ||
    filters.isoMin || filters.isoMax
  );
}

function formatDate(s: string | null): string {
  if (!s) return "";
  return new Date(s).toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric",
  });
}

// ── Thumbnail ─────────────────────────────────────────────────────────────────

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

      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent",
          "opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity duration-150",
          "flex flex-col justify-end p-1.5 gap-0.5"
        )}
      >
        {showLabel && (
          <p className="text-white text-xs font-medium truncate leading-tight">
            {image.iptcTitle || image.fileName}
          </p>
        )}
        {density === "large" && (
          <p className="text-white/70 text-xs truncate leading-tight">
            {formatDate(image.takenAt)}
            {image.cameraModel ? ` · ${image.cameraModel}` : ""}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function BrowsePage() {
  const initial = parseUrlState();

  const [filters, setFilters] = useState<FacetFilters>(initial.filters);
  const [page, setPage] = useState(initial.page);
  const [density, setDensity] = useState<GridDensity>("medium");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Facet data
  const [facets, setFacets] = useState<FacetData | null>(null);
  const [facetsLoading, setFacetsLoading] = useState(false);

  // Image grid data
  const [imageList, setImageList] = useState<ImageItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [imagesError, setImagesError] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  // ── Load facets ─────────────────────────────────────────────────────────────

  const loadFacets = useCallback((f: FacetFilters) => {
    setFacetsLoading(true);
    const qs = buildQueryString(f, 1);
    // Remove page from facets query
    qs.delete("page");
    fetch(`/api/facets?${qs}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => setFacets(json.data ?? null))
      .catch(() => {/* facets are best-effort */})
      .finally(() => setFacetsLoading(false));
  }, []);

  // ── Load images ─────────────────────────────────────────────────────────────

  const loadImages = useCallback((f: FacetFilters, p: number) => {
    if (!hasAnyFilter(f)) {
      // Load all images (sorted by date) when no filters
      const params = new URLSearchParams();
      params.set("sort", "date");
      params.set("order", "desc");
      params.set("page", String(p));
      params.set("pageSize", String(PAGE_SIZE));

      // Use search endpoint with a broad date filter hack, or just use images API
      // For "browse all" we can use the images listing endpoint
      setImagesLoading(true);
      setImagesError(null);
      fetch(`/api/images?${params}`)
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then((json) => {
          setImageList(json.data ?? []);
          setPagination(json.pagination ?? null);
        })
        .catch((e) => setImagesError(e.message ?? "Failed to load images"))
        .finally(() => setImagesLoading(false));
      return;
    }

    setImagesLoading(true);
    setImagesError(null);

    const qs = buildQueryString(f, p);
    qs.set("pageSize", String(PAGE_SIZE));
    qs.set("sort", "date");
    qs.set("order", "desc");

    fetch(`/api/search?${qs}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => {
        setImageList(json.data ?? []);
        setPagination(json.pagination ?? null);
      })
      .catch((e) => setImagesError(e.message ?? "Search failed"))
      .finally(() => setImagesLoading(false));
  }, []);

  // ── Effects ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    loadFacets(filters);
    loadImages(filters, page);
    // Only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleFilterChange = useCallback(
    (newFilters: FacetFilters) => {
      setFilters(newFilters);
      setPage(1);
      setFocusedIndex(null);

      // Update URL
      const qs = buildQueryString(newFilters, 1);
      window.history.replaceState(null, "", `/browse${qs.toString() ? `?${qs}` : ""}`);

      loadFacets(newFilters);
      loadImages(newFilters, 1);
    },
    [loadFacets, loadImages]
  );

  const handlePageChange = useCallback(
    (p: number) => {
      setPage(p);
      setFocusedIndex(null);

      const qs = buildQueryString(filters, p);
      window.history.replaceState(null, "", `/browse${qs.toString() ? `?${qs}` : ""}`);

      loadImages(filters, p);
      window.scrollTo(0, 0);
    },
    [filters, loadImages]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      const cols = { small: 6, medium: 4, large: 3 }[density];
      let next: number | null = null;
      if (e.key === "ArrowRight") next = Math.min(index + 1, imageList.length - 1);
      else if (e.key === "ArrowLeft") next = Math.max(index - 1, 0);
      else if (e.key === "ArrowDown") next = Math.min(index + cols, imageList.length - 1);
      else if (e.key === "ArrowUp") next = Math.max(index - cols, 0);
      if (next !== null) {
        e.preventDefault();
        setFocusedIndex(next);
      }
    },
    [density, imageList.length]
  );

  const totalImages = pagination?.total ?? facets?.total ?? 0;
  const activeFilterCount = [
    filters.camera, filters.lens, filters.format,
    filters.dateFrom || filters.dateTo,
    filters.focalLengthMin || filters.focalLengthMax,
    filters.isoMin || filters.isoMax,
  ].filter(Boolean).length;

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* ── Facet sidebar ───────────────────────────────────────────────────── */}
      <aside
        className={cn(
          "flex flex-col bg-[var(--color-bg)] border-r border-[var(--color-border)] transition-all duration-200 flex-shrink-0 overflow-hidden",
          sidebarOpen ? "w-56" : "w-0"
        )}
      >
        {sidebarOpen && (
          <>
            {/* Stats dashboard */}
            <div className="p-3 border-b border-[var(--color-border)]">
              <StatsDashboard />
            </div>

            {/* Facet panel */}
            <div className="flex-1 overflow-y-auto min-h-0">
              <FacetPanel
                facets={facets}
                filters={filters}
                onFilterChange={handleFilterChange}
                loading={facetsLoading}
              />
            </div>
          </>
        )}
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg)] shrink-0">
          {/* Toggle sidebar */}
          <button
            onClick={() => setSidebarOpen((o) => !o)}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1.5 rounded-[var(--radius-md)] text-xs font-medium transition-colors",
              sidebarOpen
                ? "bg-[#1456f0]/10 text-[#1456f0] dark:bg-[#1456f0]/20 dark:text-[#60a5fa]"
                : "text-[var(--color-text-secondary)] hover:bg-black/5 dark:hover:bg-white/5"
            )}
            aria-pressed={sidebarOpen}
            title={sidebarOpen ? "Hide filters" : "Show filters"}
          >
            <Filter className="w-3.5 h-3.5" />
            Filters
            {activeFilterCount > 0 && (
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#1456f0] text-white text-[10px] font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Result count */}
          <span className="text-sm text-[var(--color-text-muted)] ml-1">
            {imagesLoading ? (
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

          {/* Density controls */}
          <div className="flex items-center gap-0.5 border border-[var(--color-border)] rounded-[var(--radius-md)] p-0.5 ml-auto">
            {(["small", "medium", "large"] as GridDensity[]).map((d) => (
              <button
                key={d}
                onClick={() => setDensity(d)}
                className={cn(
                  "px-2 py-0.5 rounded text-xs font-medium transition-colors capitalize",
                  density === d
                    ? "bg-[var(--color-bg)] text-[var(--color-text-heading)] shadow-sm"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                )}
                aria-pressed={density === d}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Image grid */}
        <div className="flex-1 overflow-y-auto">
          {imagesError ? (
            <div className="flex items-center justify-center h-48 text-sm text-red-500">
              {imagesError}
            </div>
          ) : imageList.length === 0 && !imagesLoading ? (
            <div className="flex flex-col items-center justify-center h-64 text-[var(--color-text-muted)]">
              <ImageOff className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                No images found
              </p>
              {activeFilterCount > 0 && (
                <p className="text-xs mt-1">Try adjusting or clearing your filters</p>
              )}
            </div>
          ) : (
            <div className={cn("grid p-4", DENSITY_CONFIG[density].gridClass)}>
              {imagesLoading
                ? Array.from({ length: PAGE_SIZE }).map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        "rounded-[var(--radius-comfortable)] bg-[var(--color-bg-secondary)] dark:bg-[var(--color-border)] animate-pulse",
                        DENSITY_CONFIG[density].thumbClass
                      )}
                      style={{ animationDelay: `${(i % 20) * 30}ms` }}
                    />
                  ))
                : imageList.map((image, i) => (
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

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-[var(--color-border)] text-sm shrink-0">
            <span className="text-[var(--color-text-muted)]">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePageChange(Math.max(1, page - 1))}
                disabled={pagination.page <= 1}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1.5 rounded-[var(--radius-md)] text-sm font-medium transition-colors",
                  pagination.page <= 1
                    ? "text-[var(--color-text-muted)] cursor-not-allowed opacity-50"
                    : "text-[var(--color-text-secondary)] hover:bg-black/5 dark:hover:bg-white/5"
                )}
              >
                <ChevronLeft className="w-4 h-4" />
                Prev
              </button>

              {(() => {
                const pages: number[] = [];
                const total = pagination.totalPages;
                const cur = pagination.page;
                for (let p = Math.max(1, cur - 2); p <= Math.min(total, cur + 2); p++) {
                  pages.push(p);
                }
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
                        onClick={() => handlePageChange(p)}
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
                onClick={() => handlePageChange(Math.min(pagination.totalPages, page + 1))}
                disabled={pagination.page >= pagination.totalPages}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1.5 rounded-[var(--radius-md)] text-sm font-medium transition-colors",
                  pagination.page >= pagination.totalPages
                    ? "text-[var(--color-text-muted)] cursor-not-allowed opacity-50"
                    : "text-[var(--color-text-secondary)] hover:bg-black/5 dark:hover:bg-white/5"
                )}
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
