/**
 * SearchPage.tsx
 *
 * Full-page search experience. Combines:
 *  - SearchBar (top, always visible)
 *  - SearchFilterPanel (expandable advanced filters)
 *  - SearchResultGrid (thumbnail grid reusing ImageGrid patterns)
 *
 * URL state: /search?q=<query>&camera=<cam>&lens=<lens>&dateFrom=<d>&dateTo=<d>&format=<f>&sort=<s>&order=<o>&page=<n>
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Loader2,
  AlertCircle,
  ImageOff,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SearchBar } from "@/components/SearchBar";
import { SearchFilterPanel, type SearchFilters } from "@/components/SearchFilters";
import { ImageDetailModal } from "@/components/ImageDetailModal";
import { EmptyState } from "@/components/EmptyState";
import { MapView } from "@/components/MapView";
import type { GridDensity } from "@/components/ImageGrid";
import {
  buildImageDetailUrl,
  saveScrollPosition,
  getScrollPosition,
  type ReturnContext,
} from "@/hooks/useNavigationContext";
import { useAppState } from "@/hooks/useAppState";
import { useMapConfig } from "@/hooks/useMapConfig";
import { TimelineView } from "@/components/TimelineView";

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
  iptcDescription: string | null;
  iptcKeywords: string[] | null;
}

interface PaginationMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

type SortField = "relevance" | "date" | "name" | "size";
type SortOrder = "asc" | "desc";

// ── Helpers ───────────────────────────────────────────────────────────────────

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

const PAGE_SIZE = 50;

function parseUrlState() {
  const params = new URLSearchParams(window.location.search);
  return {
    q: params.get("q") ?? "",
    camera: params.get("camera") ?? "",
    lens: params.get("lens") ?? "",
    dateFrom: params.get("dateFrom") ?? "",
    dateTo: params.get("dateTo") ?? "",
    format: params.get("format") ?? "",
    minSize: params.get("minSize") ?? "",
    maxSize: params.get("maxSize") ?? "",
    sort: (params.get("sort") ?? "") as SortField | "",
    order: (params.get("order") ?? "desc") as SortOrder,
    page: Math.max(1, Number(params.get("page") ?? "1") || 1),
  };
}

function updateUrl(
  q: string,
  filters: SearchFilters,
  sort: SortField,
  order: SortOrder,
  page: number
) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (filters.camera) params.set("camera", filters.camera);
  if (filters.lens) params.set("lens", filters.lens);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  if (filters.format) params.set("format", filters.format);
  if (filters.minSize) params.set("minSize", filters.minSize);
  if (filters.maxSize) params.set("maxSize", filters.maxSize);
  if (sort) params.set("sort", sort);
  if (order !== "desc") params.set("order", order);
  if (page > 1) params.set("page", String(page));
  const newUrl = `/search${params.toString() ? `?${params}` : ""}`;
  window.history.replaceState(null, "", newUrl);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ── Thumbnail ─────────────────────────────────────────────────────────────────

interface ThumbnailProps {
  image: ImageItem;
  density: GridDensity;
  isFocused: boolean;
  onFocus: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onClick: () => void;
  query: string;
}

function Thumbnail({ image, density, isFocused, onFocus, onKeyDown, onClick }: ThumbnailProps) {
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
      onClick={onClick}
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

// ── Sort controls ─────────────────────────────────────────────────────────────

const SORT_OPTIONS: Array<{ value: SortField; label: string }> = [
  { value: "relevance", label: "Relevance" },
  { value: "date", label: "Date" },
  { value: "name", label: "Name" },
  { value: "size", label: "Size" },
];

// ── Main Component ─────────────────────────────────────────────────────────────

export function SearchPage() {
  const initialState = parseUrlState();
  const { viewMode } = useAppState();
  const mapConfig = useMapConfig();

  const [query, setQuery] = useState(initialState.q);
  const [submittedQuery, setSubmittedQuery] = useState(initialState.q);
  const [filters, setFilters] = useState<SearchFilters>({
    camera: initialState.camera,
    lens: initialState.lens,
    dateFrom: initialState.dateFrom,
    dateTo: initialState.dateTo,
    format: initialState.format,
    minSize: initialState.minSize,
    maxSize: initialState.maxSize,
  });
  const [sort, setSort] = useState<SortField>(
    (initialState.sort || (initialState.q ? "relevance" : "date")) as SortField
  );
  const [order, setOrder] = useState<SortOrder>(initialState.order);
  const [page, setPage] = useState(initialState.page);
  const [density, setDensity] = useState<GridDensity>("medium");

  const [images, setImages] = useState<ImageItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  // Detail modal state
  const [detailImageId, setDetailImageId] = useState<number | null>(null);
  const [detailContext, setDetailContext] = useState<ReturnContext | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [hasSearched, setHasSearched] = useState(
    !!(initialState.q || initialState.camera || initialState.lens ||
      initialState.dateFrom || initialState.dateTo || initialState.format)
  );

  // Check if there's anything to search
  const hasSearchCriteria = useCallback(
    (q: string, f: SearchFilters) =>
      !!(q || f.camera || f.lens || f.dateFrom || f.dateTo || f.format || f.minSize || f.maxSize),
    []
  );

  // Execute search
  const doSearch = useCallback(
    async (q: string, f: SearchFilters, s: SortField, o: SortOrder, p: number) => {
      if (!hasSearchCriteria(q, f)) {
        setImages([]);
        setPagination(null);
        setHasSearched(false);
        return;
      }

      setLoading(true);
      setError(null);
      setHasSearched(true);

      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (f.camera) params.set("camera", f.camera);
      if (f.lens) params.set("lens", f.lens);
      if (f.dateFrom) params.set("dateFrom", f.dateFrom);
      if (f.dateTo) params.set("dateTo", f.dateTo);
      if (f.format) params.set("format", f.format);
      if (f.minSize) params.set("minSize", f.minSize);
      if (f.maxSize) params.set("maxSize", f.maxSize);
      params.set("sort", s);
      params.set("order", o);
      params.set("page", String(p));
      params.set("pageSize", String(PAGE_SIZE));

      updateUrl(q, f, s, o, p);

      fetch(`/api/search?${params}`)
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then((json) => {
          setImages(json.data ?? []);
          setPagination(json.pagination ?? null);
        })
        .catch((err) => setError(err.message ?? "Search failed"))
        .finally(() => setLoading(false));
    },
    [hasSearchCriteria]
  );

  // Run search on mount if URL has params
  useEffect(() => {
    if (hasSearchCriteria(submittedQuery, filters)) {
      doSearch(submittedQuery, filters, sort, order, page);
    }
    // Only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = useCallback(
    (q: string) => {
      const trimmed = q.trim();
      setSubmittedQuery(trimmed);
      setQuery(trimmed);
      const newSort = trimmed && sort === "date" ? "relevance" : sort;
      setSort(newSort);
      setPage(1);
      setFocusedIndex(null);
      doSearch(trimmed, filters, newSort, order, 1);
    },
    [filters, sort, order, doSearch]
  );

  const handleApplyFilters = useCallback(() => {
    setPage(1);
    setFocusedIndex(null);
    doSearch(submittedQuery, filters, sort, order, 1);
  }, [submittedQuery, filters, sort, order, doSearch]);

  const handleSortChange = useCallback(
    (field: SortField) => {
      let newOrder = order;
      if (field === sort) {
        newOrder = order === "asc" ? "desc" : "asc";
        setOrder(newOrder);
      } else {
        setSort(field);
        newOrder = "desc";
        setOrder("desc");
      }
      setPage(1);
      doSearch(submittedQuery, filters, field === sort ? sort : field, newOrder, 1);
    },
    [sort, order, submittedQuery, filters, doSearch]
  );

  const handlePageChange = useCallback(
    (p: number) => {
      setPage(p);
      setFocusedIndex(null);
      doSearch(submittedQuery, filters, sort, order, p);
      window.scrollTo(0, 0);
    },
    [submittedQuery, filters, sort, order, doSearch]
  );

  // Open image detail with context tracking
  const openDetail = useCallback(
    (imageId: number) => {
      const returnUrl = `/search${window.location.search}`;
      const scrollTop = scrollContainerRef.current?.scrollTop ?? 0;

      // Build context params from current search state
      const contextParams = new URLSearchParams();
      if (submittedQuery) contextParams.set("q", submittedQuery);
      if (filters.camera) contextParams.set("camera", filters.camera);
      if (filters.lens) contextParams.set("lens", filters.lens);
      if (filters.dateFrom) contextParams.set("dateFrom", filters.dateFrom);
      if (filters.dateTo) contextParams.set("dateTo", filters.dateTo);
      if (filters.format) contextParams.set("format", filters.format);
      if (filters.minSize) contextParams.set("minSize", filters.minSize);
      if (filters.maxSize) contextParams.set("maxSize", filters.maxSize);
      if (sort) contextParams.set("sort", sort);
      if (order !== "desc") contextParams.set("order", order);
      if (page > 1) contextParams.set("page", String(page));

      const detailUrl = buildImageDetailUrl(imageId, "search", contextParams);

      // Save scroll position for restoration
      saveScrollPosition(returnUrl, scrollTop);

      // Push URL entry for browser back button support
      window.history.pushState({ imageId, from: "search" }, "", detailUrl);

      const label = submittedQuery
        ? `Back to search: "${submittedQuery}"`
        : "Back to search results";

      setDetailContext({ type: "search", label, returnUrl });
      setDetailImageId(imageId);
    },
    [submittedQuery, filters, sort, order, page]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      const cols = { small: 6, medium: 4, large: 3 }[density];
      let next: number | null = null;
      if (e.key === "ArrowRight") next = Math.min(index + 1, images.length - 1);
      else if (e.key === "ArrowLeft") next = Math.max(index - 1, 0);
      else if (e.key === "ArrowDown") next = Math.min(index + cols, images.length - 1);
      else if (e.key === "ArrowUp") next = Math.max(index - cols, 0);
      else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openDetail(images[index].id);
        return;
      }
      if (next !== null) {
        e.preventDefault();
        setFocusedIndex(next);
      }
    },
    [density, images, openDetail]
  );

  // Close modal when browser back is pressed
  useEffect(() => {
    const handlePopstate = () => {
      const path = window.location.pathname;
      if (!path.startsWith("/image/") && detailImageId !== null) {
        setDetailImageId(null);
        setDetailContext(null);
        // Restore scroll position
        const returnUrl = window.location.pathname + window.location.search;
        const scrollTop = getScrollPosition(returnUrl);
        if (scrollTop !== null && scrollContainerRef.current) {
          setTimeout(() => {
            if (scrollContainerRef.current) {
              scrollContainerRef.current.scrollTop = scrollTop;
            }
          }, 0);
        }
      }
    };
    window.addEventListener("popstate", handlePopstate);
    return () => window.removeEventListener("popstate", handlePopstate);
  }, [detailImageId]);

  const handleDetailBack = useCallback(() => {
    window.history.back();
  }, []);

  const totalImages = pagination?.total ?? 0;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ── Search header ──────────────────────────────────────────────────── */}
      <div className="border-b border-[var(--color-border)] bg-[var(--color-bg)]">
        <div className="px-4 py-3">
          <SearchBar
            value={query}
            onChange={setQuery}
            onSearch={handleSearch}
            loading={loading}
            placeholder="Search by filename, title, description, keywords…"
            className="max-w-2xl"
          />
        </div>

        {/* Advanced filters */}
        <SearchFilterPanel
          filters={filters}
          onChange={setFilters}
          onApply={handleApplyFilters}
        />
      </div>

      {/* ── Results toolbar ─────────────────────────────────────────────────── */}
      {hasSearched && (
        <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--color-border)] flex-wrap gap-y-2 shrink-0">
          {/* Result count */}
          <span className="text-sm text-[var(--color-text-muted)] mr-auto">
            {loading ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Searching…
              </span>
            ) : (
              <>
                {totalImages.toLocaleString()}{" "}
                {totalImages === 1 ? "result" : "results"}
                {submittedQuery && (
                  <span className="text-[var(--color-text-muted)]">
                    {" "}for <span className="font-medium text-[var(--color-text-heading)]">"{submittedQuery}"</span>
                  </span>
                )}
              </>
            )}
          </span>

          {/* Sort controls */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-[var(--color-text-muted)] mr-1">Sort:</span>
            {SORT_OPTIONS.map((opt) => {
              const isActive = sort === opt.value;
              // Hide relevance option when no text query
              if (opt.value === "relevance" && !submittedQuery) return null;
              return (
                <button
                  key={opt.value}
                  onClick={() => handleSortChange(opt.value)}
                  className={cn(
                    "flex items-center gap-0.5 px-2 py-1 rounded-[var(--radius-sm)] text-xs font-medium transition-colors",
                    isActive
                      ? "bg-[#1456f0]/10 text-[#1456f0] dark:bg-[#1456f0]/20 dark:text-[#60a5fa]"
                      : "text-[var(--color-text-secondary)] hover:bg-black/5 hover:text-[var(--color-text-heading)] dark:hover:bg-white/5"
                  )}
                  aria-pressed={isActive}
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
                onClick={() => setDensity(d)}
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
      )}

      {/* ── Content area ────────────────────────────────────────────────────── */}
      {/* Map view — shown when viewMode is "map" and a search has been done */}
      {viewMode === "map" && hasSearched && (
        <div className="flex-1 min-h-0 overflow-hidden">
          <MapView
            searchQuery={submittedQuery}
            camera={filters.camera}
            lens={filters.lens}
            dateFrom={filters.dateFrom}
            dateTo={filters.dateTo}
            format={filters.format}
            minSize={filters.minSize}
            maxSize={filters.maxSize}
            tileUrl={mapConfig.tileUrl}
            tileAttribution={mapConfig.tileAttribution}
          />
        </div>
      )}
      {viewMode === "map" && !hasSearched && (
        <div className="flex-1 min-h-0 overflow-hidden">
          <MapView
            tileUrl={mapConfig.tileUrl}
            tileAttribution={mapConfig.tileAttribution}
          />
        </div>
      )}

      {/* Timeline view */}
      {viewMode === "timeline" && (
        <div className="flex-1 min-h-0 overflow-hidden">
          <TimelineView
            filters={{
              q: submittedQuery || undefined,
              camera: filters.camera || undefined,
              lens: filters.lens || undefined,
              dateFrom: filters.dateFrom || undefined,
              dateTo: filters.dateTo || undefined,
              format: filters.format || undefined,
              minSize: filters.minSize || undefined,
              maxSize: filters.maxSize || undefined,
            }}
            returnContext="search"
          />
        </div>
      )}

      <div ref={scrollContainerRef} className={cn("flex-1 overflow-y-auto", (viewMode === "map" || viewMode === "timeline") && "hidden")}>
        {!hasSearched ? (
          <EmptyState.SearchPrompt />
        ) : error ? (
          <div className="flex items-center gap-2 p-6 text-sm text-red-500">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : images.length === 0 && !loading ? (
          <EmptyState.NoSearchResults
            query={submittedQuery}
            onClear={() => handleSearch("")}
          />
        ) : (
          <div className={cn("grid p-4", DENSITY_CONFIG[density].gridClass)}>
            {loading
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
              : images.map((image, i) => (
                  <Thumbnail
                    key={image.id}
                    image={image}
                    density={density}
                    isFocused={focusedIndex === i}
                    onFocus={() => setFocusedIndex(i)}
                    onKeyDown={(e) => handleKeyDown(e, i)}
                    onClick={() => openDetail(image.id)}
                    query={submittedQuery}
                  />
                ))}
          </div>
        )}
      </div>

      {/* ── Pagination ───────────────────────────────────────────────────────── */}
      {viewMode !== "map" && viewMode !== "timeline" && pagination && pagination.totalPages > 1 && (
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
                  : "text-[var(--color-text-secondary)] hover:bg-black/5 hover:text-[var(--color-text-heading)] dark:hover:bg-white/5"
              )}
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
              Prev
            </button>

            {(() => {
              const pages: number[] = [];
              const total = pagination.totalPages;
              const cur = pagination.page;
              const win = 2;
              for (let p = Math.max(1, cur - win); p <= Math.min(total, cur + win); p++) {
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

      {/* ── Image detail modal ──────────────────────────────────────────────── */}
      {detailImageId !== null && (
        <ImageDetailModal
          imageId={detailImageId}
          imageIds={images.map((img) => img.id)}
          returnContext={detailContext}
          onNavigate={(id) => setDetailImageId(id)}
          onClose={() => {
            setDetailImageId(null);
            setDetailContext(null);
            if (window.location.pathname.startsWith("/image/")) {
              window.history.back();
            }
          }}
          onBack={handleDetailBack}
        />
      )}
    </div>
  );
}
