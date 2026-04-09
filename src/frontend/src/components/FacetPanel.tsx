/**
 * FacetPanel.tsx
 *
 * Sidebar panel for faceted browsing. Displays available facet values with
 * image counts. Selecting a facet value updates other facet counts to reflect
 * only images matching the current selection.
 *
 * Also includes a tag filter section with multi-select, search, AND/OR logic toggle.
 */

import { useState, useEffect, useRef } from "react";
import { ChevronDown, ChevronUp, X, Tag, Search } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FacetValue {
  value: string;
  count: number;
}

export interface DateFacetValue {
  year: number;
  month?: number;
  count: number;
}

export interface RangeFacetValue {
  label: string;
  min: number | null;
  max: number | null;
  count: number;
}

export interface FacetData {
  total: number;
  camera: FacetValue[];
  lens: FacetValue[];
  format: FacetValue[];
  year: DateFacetValue[];
  month: DateFacetValue[];
  focalLength: RangeFacetValue[];
  iso: RangeFacetValue[];
}

export interface FacetFilters {
  camera: string;
  lens: string;
  format: string;
  dateFrom: string;
  dateTo: string;
  focalLengthMin: string;
  focalLengthMax: string;
  isoMin: string;
  isoMax: string;
  /** Comma-separated tag names for filtering */
  tags: string;
  /** "and" = image must have ALL selected tags; "or" = image must have ANY selected tag */
  tagLogic: "and" | "or";
}

// ── Tag types ─────────────────────────────────────────────────────────────────

interface TagItem {
  id: number;
  name: string;
  usageCount: number;
  color: string | null;
}

interface FacetPanelProps {
  facets: FacetData | null;
  filters: FacetFilters;
  onFilterChange: (filters: FacetFilters) => void;
  loading?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Parse comma-separated tags string to array, filtering empty strings */
function parseTags(tagsStr: string): string[] {
  return tagsStr
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

/** Serialize tag array to comma-separated string */
function serializeTags(tags: string[]): string {
  return tags.join(",");
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface FacetSectionProps {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function FacetSection({ title, count, defaultOpen = true, children }: FacetSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-[var(--color-border)]">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-black/3 dark:hover:bg-white/3 transition-colors"
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          {title}
          {count !== undefined && count > 0 && (
            <span className="ml-1.5 text-[var(--color-text-muted)] font-normal normal-case tracking-normal">
              ({count})
            </span>
          )}
        </span>
        {open ? (
          <ChevronUp className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
        )}
      </button>
      {open && <div className="pb-1">{children}</div>}
    </div>
  );
}

interface FacetItemProps {
  label: string;
  count: number;
  selected?: boolean;
  onClick: () => void;
}

function FacetItem({ label, count, selected = false, onClick }: FacetItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center justify-between px-3 py-1.5 text-left text-sm transition-colors group rounded-[var(--radius-sm)] mx-0.5",
        selected
          ? "bg-[#1456f0]/10 text-[#1456f0] dark:bg-[#1456f0]/20 dark:text-[#60a5fa]"
          : "text-[var(--color-text-secondary)] hover:bg-black/5 hover:text-[var(--color-text-heading)] dark:hover:bg-white/5"
      )}
    >
      <span className="truncate flex-1 mr-2">{label}</span>
      <span
        className={cn(
          "text-xs flex-shrink-0 tabular-nums",
          selected
            ? "text-[#1456f0]/80 dark:text-[#60a5fa]/80"
            : "text-[var(--color-text-muted)]"
        )}
      >
        {formatCount(count)}
      </span>
    </button>
  );
}

// ── TagFilterSection ──────────────────────────────────────────────────────────

interface TagFilterSectionProps {
  selectedTags: string[];
  tagLogic: "and" | "or";
  onTagToggle: (tagName: string) => void;
  onTagLogicChange: (logic: "and" | "or") => void;
  onTagRemove: (tagName: string) => void;
}

function TagFilterSection({
  selectedTags,
  tagLogic,
  onTagToggle,
  onTagLogicChange,
  onTagRemove,
}: TagFilterSectionProps) {
  const [open, setOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [allTags, setAllTags] = useState<TagItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // INITIAL_DISPLAY: number of tags shown before "show more"
  const INITIAL_DISPLAY = 8;

  // ── Fetch tags with debounce ────────────────────────────────────────────────

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams({ sort: "usage", limit: "200" });
      if (searchQuery.trim()) params.set("q", searchQuery.trim());
      fetch(`/api/tags?${params}`)
        .then((r) => r.json())
        .then((json) => setAllTags(json.data ?? []))
        .catch(() => setAllTags([]))
        .finally(() => setLoading(false));
    }, searchQuery ? 200 : 0);

    return () => clearTimeout(debounceRef.current);
  }, [searchQuery]);

  const displayedTags = showAll || searchQuery ? allTags : allTags.slice(0, INITIAL_DISPLAY);
  const hasMore = !searchQuery && allTags.length > INITIAL_DISPLAY;

  return (
    <div className="border-b border-[var(--color-border)]">
      {/* Section header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-black/3 dark:hover:bg-white/3 transition-colors"
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          Tags
          {selectedTags.length > 0 && (
            <span className="ml-1.5 text-[var(--color-text-muted)] font-normal normal-case tracking-normal">
              ({selectedTags.length} selected)
            </span>
          )}
        </span>
        {open ? (
          <ChevronUp className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
        )}
      </button>

      {open && (
        <div className="pb-2">
          {/* Active tag chips */}
          {selectedTags.length > 0 && (
            <div className="px-3 pb-2 flex flex-wrap gap-1">
              {selectedTags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#1456f0]/10 text-[#1456f0] dark:bg-[#1456f0]/20 dark:text-[#60a5fa]"
                >
                  <Tag className="w-2.5 h-2.5" />
                  {tag}
                  <button
                    type="button"
                    onClick={() => onTagRemove(tag)}
                    className="ml-0.5 hover:text-[#0d3bc5] dark:hover:text-white transition-colors"
                    aria-label={`Remove tag ${tag}`}
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Search box */}
          <div className="px-3 pb-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--color-text-muted)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowAll(false);
                }}
                placeholder="Search tags…"
                className={cn(
                  "w-full pl-6 pr-2 py-1 text-xs rounded-[var(--radius-sm)]",
                  "bg-[var(--color-bg-secondary)] border border-[var(--color-border)]",
                  "text-[var(--color-text-heading)] placeholder:text-[var(--color-text-muted)]",
                  "focus:outline-none focus:ring-1 focus:ring-[#1456f0]/40 focus:border-[#1456f0]",
                  "transition-colors"
                )}
              />
            </div>
          </div>

          {/* Tag list */}
          {loading && allTags.length === 0 ? (
            <div className="px-3 pb-2 space-y-1">
              {[70, 55, 65, 45].map((w, i) => (
                <div
                  key={i}
                  className="h-6 rounded bg-[var(--color-bg-secondary)] animate-pulse"
                  style={{ width: `${w}%`, animationDelay: `${i * 40}ms` }}
                />
              ))}
            </div>
          ) : allTags.length === 0 ? (
            <div className="px-3 pb-2 text-xs text-[var(--color-text-muted)]">
              {searchQuery ? "No matching tags" : "No tags yet"}
            </div>
          ) : (
            <>
              {displayedTags.map((tag) => {
                const isSelected = selectedTags.includes(tag.name);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => onTagToggle(tag.name)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors group rounded-[var(--radius-sm)] mx-0.5",
                      isSelected
                        ? "bg-[#1456f0]/10 text-[#1456f0] dark:bg-[#1456f0]/20 dark:text-[#60a5fa]"
                        : "text-[var(--color-text-secondary)] hover:bg-black/5 hover:text-[var(--color-text-heading)] dark:hover:bg-white/5"
                    )}
                  >
                    {/* Checkbox indicator */}
                    <span
                      className={cn(
                        "flex-shrink-0 w-3.5 h-3.5 rounded border transition-colors",
                        isSelected
                          ? "bg-[#1456f0] border-[#1456f0] dark:bg-[#60a5fa] dark:border-[#60a5fa]"
                          : "border-[var(--color-border)] group-hover:border-[var(--color-text-muted)]"
                      )}
                    >
                      {isSelected && (
                        <svg viewBox="0 0 10 8" className="w-full h-full p-0.5" fill="none">
                          <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    <span className="truncate flex-1">{tag.name}</span>
                    <span
                      className={cn(
                        "text-xs flex-shrink-0 tabular-nums",
                        isSelected
                          ? "text-[#1456f0]/80 dark:text-[#60a5fa]/80"
                          : "text-[var(--color-text-muted)]"
                      )}
                    >
                      {formatCount(tag.usageCount)}
                    </span>
                  </button>
                );
              })}

              {/* Show more / less toggle */}
              {hasMore && (
                <button
                  type="button"
                  onClick={() => setShowAll((v) => !v)}
                  className="w-full px-3 py-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors text-left"
                >
                  {showAll
                    ? "Show less"
                    : `Show ${allTags.length - INITIAL_DISPLAY} more…`}
                </button>
              )}
            </>
          )}

          {/* AND / OR logic toggle — only visible when 2+ tags are selected */}
          {selectedTags.length >= 2 && (
            <div className="px-3 pt-1 pb-1 flex items-center gap-2">
              <span className="text-xs text-[var(--color-text-muted)]">Logic:</span>
              <div className="flex items-center rounded-[var(--radius-sm)] border border-[var(--color-border)] overflow-hidden">
                {(["and", "or"] as const).map((logic) => (
                  <button
                    key={logic}
                    type="button"
                    onClick={() => onTagLogicChange(logic)}
                    className={cn(
                      "px-2 py-0.5 text-xs font-medium transition-colors uppercase",
                      tagLogic === logic
                        ? "bg-[#1456f0] text-white"
                        : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                    )}
                  >
                    {logic}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function FacetPanel({ facets, filters, onFilterChange, loading = false }: FacetPanelProps) {
  // Count active filters for display
  const selectedTagsList = parseTags(filters.tags);
  const activeCount = [
    filters.camera,
    filters.lens,
    filters.format,
    filters.dateFrom || filters.dateTo,
    filters.focalLengthMin || filters.focalLengthMax,
    filters.isoMin || filters.isoMax,
    selectedTagsList.length > 0 ? "tags" : "",
  ].filter(Boolean).length;

  function clearAll() {
    onFilterChange({
      camera: "",
      lens: "",
      format: "",
      dateFrom: "",
      dateTo: "",
      focalLengthMin: "",
      focalLengthMax: "",
      isoMin: "",
      isoMax: "",
      tags: "",
      tagLogic: "and",
    });
  }

  function setCamera(value: string) {
    onFilterChange({
      ...filters,
      camera: filters.camera === value ? "" : value,
    });
  }

  function setLens(value: string) {
    onFilterChange({
      ...filters,
      lens: filters.lens === value ? "" : value,
    });
  }

  function setFormat(value: string) {
    onFilterChange({
      ...filters,
      format: filters.format === value ? "" : value,
    });
  }

  function setYear(year: number) {
    // If already filtering this year, clear
    const currentFrom = filters.dateFrom ? new Date(filters.dateFrom).getFullYear() : null;
    const currentTo = filters.dateTo ? new Date(filters.dateTo).getFullYear() : null;
    if (currentFrom === year && currentTo === year) {
      onFilterChange({ ...filters, dateFrom: "", dateTo: "" });
    } else {
      onFilterChange({
        ...filters,
        dateFrom: `${year}-01-01`,
        dateTo: `${year}-12-31`,
      });
    }
  }

  function setMonth(year: number, month: number) {
    const lastDay = new Date(year, month, 0).getDate();
    const monthStr = String(month).padStart(2, "0");
    const from = `${year}-${monthStr}-01`;
    const to = `${year}-${monthStr}-${lastDay}`;
    const sameFrom = filters.dateFrom === from;
    const sameTo = filters.dateTo === to;
    if (sameFrom && sameTo) {
      // Clear month but keep year
      onFilterChange({
        ...filters,
        dateFrom: `${year}-01-01`,
        dateTo: `${year}-12-31`,
      });
    } else {
      onFilterChange({ ...filters, dateFrom: from, dateTo: to });
    }
  }

  function setFocalLengthBucket(min: number | null, max: number | null) {
    const sameMin = (filters.focalLengthMin || "") === (min !== null ? String(min) : "");
    const sameMax = (filters.focalLengthMax || "") === (max !== null ? String(max) : "");
    if (sameMin && sameMax) {
      onFilterChange({ ...filters, focalLengthMin: "", focalLengthMax: "" });
    } else {
      onFilterChange({
        ...filters,
        focalLengthMin: min !== null ? String(min) : "",
        focalLengthMax: max !== null ? String(max) : "",
      });
    }
  }

  function setIsoBucket(min: number | null, max: number | null) {
    const sameMin = (filters.isoMin || "") === (min !== null ? String(min) : "");
    const sameMax = (filters.isoMax || "") === (max !== null ? String(max) : "");
    if (sameMin && sameMax) {
      onFilterChange({ ...filters, isoMin: "", isoMax: "" });
    } else {
      onFilterChange({
        ...filters,
        isoMin: min !== null ? String(min) : "",
        isoMax: max !== null ? String(max) : "",
      });
    }
  }

  function handleTagToggle(tagName: string) {
    const current = parseTags(filters.tags);
    const idx = current.indexOf(tagName);
    const next = idx >= 0 ? current.filter((t) => t !== tagName) : [...current, tagName];
    onFilterChange({ ...filters, tags: serializeTags(next) });
  }

  function handleTagRemove(tagName: string) {
    const current = parseTags(filters.tags);
    const next = current.filter((t) => t !== tagName);
    onFilterChange({ ...filters, tags: serializeTags(next) });
  }

  function handleTagLogicChange(logic: "and" | "or") {
    onFilterChange({ ...filters, tagLogic: logic });
  }

  // Compute selected states
  const selectedYear = filters.dateFrom ? new Date(filters.dateFrom + "T00:00:00").getFullYear() : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--color-border)]">
        <span className="text-sm font-semibold text-[var(--color-text-heading)]">
          Filters
          {activeCount > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#1456f0] text-white text-[10px] font-bold">
              {activeCount}
            </span>
          )}
        </span>
        {activeCount > 0 && (
          <button
            onClick={clearAll}
            className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
          >
            <X className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>

      {/* Facet sections */}
      <div className="flex-1 overflow-y-auto">
        {loading && !facets ? (
          // Skeleton loading state
          <div className="p-3 space-y-2">
            {[80, 60, 70, 50, 65].map((w, i) => (
              <div
                key={i}
                className="h-7 rounded bg-[var(--color-bg-secondary)] animate-pulse"
                style={{ width: `${w}%`, animationDelay: `${i * 50}ms` }}
              />
            ))}
          </div>
        ) : (
          <>
            {/* Camera */}
            {facets && facets.camera.length > 0 && (
              <FacetSection title="Camera" count={facets.camera.length} defaultOpen={true}>
                {facets.camera.map((f) => (
                  <FacetItem
                    key={f.value}
                    label={f.value}
                    count={f.count}
                    selected={filters.camera === f.value}
                    onClick={() => setCamera(f.value)}
                  />
                ))}
              </FacetSection>
            )}

            {/* Lens */}
            {facets && facets.lens.length > 0 && (
              <FacetSection title="Lens" count={facets.lens.length} defaultOpen={true}>
                {facets.lens.map((f) => (
                  <FacetItem
                    key={f.value}
                    label={f.value}
                    count={f.count}
                    selected={filters.lens === f.value}
                    onClick={() => setLens(f.value)}
                  />
                ))}
              </FacetSection>
            )}

            {/* Date */}
            {facets && facets.year.length > 0 && (
              <FacetSection title="Date" defaultOpen={true}>
                {facets.year.map((y) => {
                  const isYearSelected =
                    filters.dateFrom === `${y.year}-01-01` &&
                    filters.dateTo === `${y.year}-12-31`;
                  return (
                    <div key={y.year}>
                      <FacetItem
                        label={String(y.year)}
                        count={y.count}
                        selected={isYearSelected}
                        onClick={() => setYear(y.year)}
                      />
                      {/* Show months if this year is selected */}
                      {(isYearSelected || selectedYear === y.year) &&
                        facets.month.length > 0 &&
                        facets.month
                          .filter((m) => m.year === y.year)
                          .map((m) => {
                            const monthStr = String(m.month!).padStart(2, "0");
                            const lastDay = new Date(m.year, m.month!, 0).getDate();
                            const isMonthSelected =
                              filters.dateFrom === `${m.year}-${monthStr}-01` &&
                              filters.dateTo === `${m.year}-${monthStr}-${lastDay}`;
                            return (
                              <div key={`${m.year}-${m.month}`} className="pl-3">
                                <FacetItem
                                  label={MONTH_NAMES[(m.month ?? 1) - 1]}
                                  count={m.count}
                                  selected={isMonthSelected}
                                  onClick={() => setMonth(m.year, m.month!)}
                                />
                              </div>
                            );
                          })}
                    </div>
                  );
                })}
              </FacetSection>
            )}

            {/* Format */}
            {facets && facets.format.length > 0 && (
              <FacetSection title="Format" count={facets.format.length} defaultOpen={false}>
                {facets.format.map((f) => {
                  const label = f.value.replace("image/", "").toUpperCase();
                  return (
                    <FacetItem
                      key={f.value}
                      label={label}
                      count={f.count}
                      selected={filters.format === f.value}
                      onClick={() => setFormat(f.value)}
                    />
                  );
                })}
              </FacetSection>
            )}

            {/* Focal Length */}
            {facets && facets.focalLength.length > 0 && (
              <FacetSection title="Focal Length" defaultOpen={false}>
                {facets.focalLength.map((f) => {
                  const isSelected =
                    (filters.focalLengthMin || "") === (f.min !== null ? String(f.min) : "") &&
                    (filters.focalLengthMax || "") === (f.max !== null ? String(f.max) : "");
                  return (
                    <FacetItem
                      key={f.label}
                      label={f.label}
                      count={f.count}
                      selected={isSelected}
                      onClick={() => setFocalLengthBucket(f.min, f.max)}
                    />
                  );
                })}
              </FacetSection>
            )}

            {/* ISO */}
            {facets && facets.iso.length > 0 && (
              <FacetSection title="ISO" defaultOpen={false}>
                {facets.iso.map((f) => {
                  const isSelected =
                    (filters.isoMin || "") === (f.min !== null ? String(f.min) : "") &&
                    (filters.isoMax || "") === (f.max !== null ? String(f.max) : "");
                  return (
                    <FacetItem
                      key={f.label}
                      label={f.label}
                      count={f.count}
                      selected={isSelected}
                      onClick={() => setIsoBucket(f.min, f.max)}
                    />
                  );
                })}
              </FacetSection>
            )}

            {/* Tags */}
            <TagFilterSection
              selectedTags={selectedTagsList}
              tagLogic={filters.tagLogic}
              onTagToggle={handleTagToggle}
              onTagLogicChange={handleTagLogicChange}
              onTagRemove={handleTagRemove}
            />

            {/* Empty state */}
            {facets && facets.total === 0 && !loading && (
              <div className="p-4 text-center text-xs text-[var(--color-text-muted)]">
                No images match the current filters
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
