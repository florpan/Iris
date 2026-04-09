/**
 * SearchBar.tsx
 *
 * Always-visible search input for finding images across the library.
 * Supports:
 *  - Immediate text input with debounced submission
 *  - Enter key to search
 *  - Clear button
 *  - Navigate to /search on submit
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchBarProps {
  /** Current query value (controlled) */
  value?: string;
  /** Called when query changes */
  onChange?: (q: string) => void;
  /** Called when user submits a search (Enter or button click) */
  onSearch?: (q: string) => void;
  /** Show loading indicator */
  loading?: boolean;
  /** Placeholder text */
  placeholder?: string;
  className?: string;
}

export function SearchBar({
  value,
  onChange,
  onSearch,
  loading = false,
  placeholder = "Search images…",
  className,
}: SearchBarProps) {
  const [internalValue, setInternalValue] = useState(value ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external value changes
  useEffect(() => {
    if (value !== undefined) {
      setInternalValue(value);
    }
  }, [value]);

  const currentValue = value !== undefined ? value : internalValue;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      if (value === undefined) setInternalValue(v);
      onChange?.(v);
    },
    [value, onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onSearch?.(currentValue);
      }
      if (e.key === "Escape") {
        handleClear();
        inputRef.current?.blur();
      }
    },
    [currentValue, onSearch]
  );

  const handleClear = useCallback(() => {
    if (value === undefined) setInternalValue("");
    onChange?.("");
    onSearch?.("");
    inputRef.current?.focus();
  }, [value, onChange, onSearch]);

  return (
    <div
      className={cn(
        "relative flex items-center group",
        className
      )}
    >
      {/* Search icon or loading spinner */}
      <div className="absolute left-3 flex items-center pointer-events-none">
        {loading ? (
          <Loader2 className="w-4 h-4 text-[var(--color-text-muted)] animate-spin" />
        ) : (
          <Search className="w-4 h-4 text-[var(--color-text-muted)]" />
        )}
      </div>

      <input
        ref={inputRef}
        type="search"
        value={currentValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        className={cn(
          "w-full pl-9 pr-9 py-2 text-sm rounded-[var(--radius-md)]",
          "bg-[var(--color-bg-secondary)] dark:bg-[var(--color-border)]",
          "border border-[var(--color-border)]",
          "text-[var(--color-text-heading)] placeholder:text-[var(--color-text-muted)]",
          "focus:outline-none focus:ring-2 focus:ring-[#1456f0]/40 focus:border-[#1456f0]",
          "transition-colors"
        )}
        aria-label="Search images"
      />

      {/* Clear button */}
      {currentValue && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-3 flex items-center text-[var(--color-text-muted)] hover:text-[var(--color-text-heading)] transition-colors"
          aria-label="Clear search"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

/**
 * TopSearchBar — standalone search bar that navigates to /search on submit.
 * Designed to be placed in the app header or sidebar.
 */
export function TopSearchBar({ className }: { className?: string }) {
  const [query, setQuery] = useState(() => {
    // Pre-fill from URL if already on search page
    if (window.location.pathname === "/search") {
      const params = new URLSearchParams(window.location.search);
      return params.get("q") ?? "";
    }
    return "";
  });

  const handleSearch = useCallback((q: string) => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    const url = `/search${params.toString() ? `?${params}` : ""}`;
    window.location.href = url;
  }, []);

  return (
    <SearchBar
      value={query}
      onChange={setQuery}
      onSearch={handleSearch}
      placeholder="Search images…"
      className={className}
    />
  );
}
