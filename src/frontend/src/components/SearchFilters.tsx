/**
 * SearchFilters.tsx
 *
 * Expandable advanced filter panel for search.
 * Supports: camera model, lens model, date range, file format, file size.
 *
 * Implemented as a controlled component — filters are passed in/out via props.
 */

import { useState, useEffect, useRef } from "react";
import { SlidersHorizontal, ChevronDown, ChevronUp, X } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SearchFilters {
  camera?: string;
  lens?: string;
  dateFrom?: string;
  dateTo?: string;
  format?: string;
  minSize?: string;
  maxSize?: string;
}

interface SearchFiltersProps {
  filters: SearchFilters;
  onChange: (filters: SearchFilters) => void;
  /** Called when user hits Apply or presses Enter in a field */
  onApply?: () => void;
  className?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const FILE_FORMATS = [
  { value: "", label: "Any format" },
  { value: "image/jpeg", label: "JPEG" },
  { value: "image/png", label: "PNG" },
  { value: "image/webp", label: "WebP" },
  { value: "image/gif", label: "GIF" },
  { value: "image/avif", label: "AVIF" },
  { value: "image/heic", label: "HEIC" },
  { value: "image/tiff", label: "TIFF" },
];

function countActiveFilters(filters: SearchFilters): number {
  return Object.values(filters).filter((v) => v && v.trim()).length;
}

// ── AutocompleteInput ─────────────────────────────────────────────────────────

interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  field: "camera" | "lens" | "format";
  placeholder?: string;
  label: string;
}

function AutocompleteInput({
  value,
  onChange,
  onSubmit,
  field,
  placeholder,
  label,
}: AutocompleteInputProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Fetch suggestions when value changes
  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!value.trim()) {
      setSuggestions([]);
      return;
    }

    debounceRef.current = setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams({ field, q: value });
      fetch(`/api/search/suggestions?${params}`)
        .then((r) => r.json())
        .then((json) => {
          setSuggestions(json.data ?? []);
        })
        .catch(() => setSuggestions([]))
        .finally(() => setLoading(false));
    }, 200);

    return () => clearTimeout(debounceRef.current);
  }, [value, field]);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setShowSuggestions(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            setShowSuggestions(false);
            onSubmit?.();
          }
          if (e.key === "Escape") setShowSuggestions(false);
        }}
        placeholder={placeholder}
        className={cn(
          "w-full px-3 py-1.5 text-sm rounded-[var(--radius-sm)]",
          "bg-[var(--color-bg)] border border-[var(--color-border)]",
          "text-[var(--color-text-heading)] placeholder:text-[var(--color-text-muted)]",
          "focus:outline-none focus:ring-1 focus:ring-[#1456f0]/40 focus:border-[#1456f0]",
          "transition-colors"
        )}
      />
      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-lg overflow-hidden">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                onChange(s);
                setShowSuggestions(false);
              }}
              className="w-full text-left px-3 py-2 text-sm text-[var(--color-text-heading)] hover:bg-[var(--color-bg-secondary)] dark:hover:bg-[var(--color-border)] transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function SearchFilterPanel({
  filters,
  onChange,
  onApply,
  className,
}: SearchFiltersProps) {
  const [expanded, setExpanded] = useState(false);

  const activeCount = countActiveFilters(filters);

  const updateFilter = (key: keyof SearchFilters, value: string) => {
    onChange({ ...filters, [key]: value });
  };

  const clearAll = () => {
    onChange({});
  };

  return (
    <div className={cn("border-b border-[var(--color-border)]", className)}>
      {/* Toggle button */}
      <div className="flex items-center px-4 py-2 gap-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={cn(
            "flex items-center gap-1.5 text-xs font-medium transition-colors",
            expanded || activeCount > 0
              ? "text-[#1456f0] dark:text-[#60a5fa]"
              : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
          )}
          aria-expanded={expanded}
          aria-label="Toggle advanced filters"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Filters</span>
          {activeCount > 0 && (
            <span className="flex items-center justify-center w-4 h-4 rounded-full bg-[#1456f0] text-white text-[10px] font-bold">
              {activeCount}
            </span>
          )}
          {expanded ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Clear all */}
        {activeCount > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="ml-auto flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
            aria-label="Clear all filters"
          >
            <X className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>

      {/* Expanded filter panel */}
      {expanded && (
        <div className="px-4 pb-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {/* Camera model */}
          <AutocompleteInput
            value={filters.camera ?? ""}
            onChange={(v) => updateFilter("camera", v)}
            onSubmit={onApply}
            field="camera"
            label="Camera Model"
            placeholder="e.g. Canon R5"
          />

          {/* Lens model */}
          <AutocompleteInput
            value={filters.lens ?? ""}
            onChange={(v) => updateFilter("lens", v)}
            onSubmit={onApply}
            field="lens"
            label="Lens Model"
            placeholder="e.g. 50mm f/1.4"
          />

          {/* Date from */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
              Date From
            </label>
            <input
              type="date"
              value={filters.dateFrom ?? ""}
              onChange={(e) => updateFilter("dateFrom", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onApply?.()}
              className={cn(
                "w-full px-3 py-1.5 text-sm rounded-[var(--radius-sm)]",
                "bg-[var(--color-bg)] border border-[var(--color-border)]",
                "text-[var(--color-text-heading)]",
                "focus:outline-none focus:ring-1 focus:ring-[#1456f0]/40 focus:border-[#1456f0]",
                "transition-colors"
              )}
            />
          </div>

          {/* Date to */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
              Date To
            </label>
            <input
              type="date"
              value={filters.dateTo ?? ""}
              onChange={(e) => updateFilter("dateTo", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onApply?.()}
              className={cn(
                "w-full px-3 py-1.5 text-sm rounded-[var(--radius-sm)]",
                "bg-[var(--color-bg)] border border-[var(--color-border)]",
                "text-[var(--color-text-heading)]",
                "focus:outline-none focus:ring-1 focus:ring-[#1456f0]/40 focus:border-[#1456f0]",
                "transition-colors"
              )}
            />
          </div>

          {/* File format */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
              Format
            </label>
            <select
              value={filters.format ?? ""}
              onChange={(e) => updateFilter("format", e.target.value)}
              className={cn(
                "w-full px-3 py-1.5 text-sm rounded-[var(--radius-sm)]",
                "bg-[var(--color-bg)] border border-[var(--color-border)]",
                "text-[var(--color-text-heading)]",
                "focus:outline-none focus:ring-1 focus:ring-[#1456f0]/40 focus:border-[#1456f0]",
                "transition-colors"
              )}
            >
              {FILE_FORMATS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          {/* Min file size */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
              Min Size (MB)
            </label>
            <input
              type="number"
              min="0"
              step="0.1"
              value={
                filters.minSize
                  ? String(Math.round(Number(filters.minSize) / (1024 * 1024) * 10) / 10)
                  : ""
              }
              onChange={(e) => {
                const mb = Number(e.target.value);
                updateFilter("minSize", e.target.value ? String(Math.round(mb * 1024 * 1024)) : "");
              }}
              onKeyDown={(e) => e.key === "Enter" && onApply?.()}
              placeholder="0"
              className={cn(
                "w-full px-3 py-1.5 text-sm rounded-[var(--radius-sm)]",
                "bg-[var(--color-bg)] border border-[var(--color-border)]",
                "text-[var(--color-text-heading)] placeholder:text-[var(--color-text-muted)]",
                "focus:outline-none focus:ring-1 focus:ring-[#1456f0]/40 focus:border-[#1456f0]",
                "transition-colors"
              )}
            />
          </div>

          {/* Max file size */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
              Max Size (MB)
            </label>
            <input
              type="number"
              min="0"
              step="0.1"
              value={
                filters.maxSize
                  ? String(Math.round(Number(filters.maxSize) / (1024 * 1024) * 10) / 10)
                  : ""
              }
              onChange={(e) => {
                const mb = Number(e.target.value);
                updateFilter("maxSize", e.target.value ? String(Math.round(mb * 1024 * 1024)) : "");
              }}
              onKeyDown={(e) => e.key === "Enter" && onApply?.()}
              placeholder="∞"
              className={cn(
                "w-full px-3 py-1.5 text-sm rounded-[var(--radius-sm)]",
                "bg-[var(--color-bg)] border border-[var(--color-border)]",
                "text-[var(--color-text-heading)] placeholder:text-[var(--color-text-muted)]",
                "focus:outline-none focus:ring-1 focus:ring-[#1456f0]/40 focus:border-[#1456f0]",
                "transition-colors"
              )}
            />
          </div>

          {/* Apply button */}
          <div className="flex items-end">
            <button
              type="button"
              onClick={onApply}
              className={cn(
                "w-full px-4 py-1.5 text-sm font-medium rounded-[var(--radius-sm)]",
                "bg-[#1456f0] text-white",
                "hover:bg-[#1246d0] transition-colors",
                "focus:outline-none focus:ring-2 focus:ring-[#1456f0]/40"
              )}
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
