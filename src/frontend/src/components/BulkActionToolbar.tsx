/**
 * BulkActionToolbar.tsx
 *
 * Toolbar shown when images are selected in the grid view.
 * Provides bulk tag add/remove operations with progress tracking.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { Tag, TagsIcon, X, Loader2, CheckCircle, AlertCircle, Plus, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TagSuggestion {
  id: number;
  name: string;
  color: string | null;
}

type BulkOp = "add" | "remove";

type OperationStatus = "idle" | "loading" | "success" | "error";

interface BulkActionToolbarProps {
  selectedCount: number;
  selectedIds: Set<number>;
  onSelectNone: () => void;
  onOperationComplete?: () => void;
}

// ── TagInput: autocomplete input for tag names ────────────────────────────────

interface TagInputProps {
  placeholder: string;
  onCommit: (name: string) => void;
  disabled?: boolean;
}

function TagInput({ placeholder, onCommit, disabled }: TagInputProps) {
  const [value, setValue] = useState("");
  const [suggestions, setSuggestions] = useState<TagSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSuggestions = useCallback((q: string) => {
    if (!q.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    fetch(`/api/tags/autocomplete?q=${encodeURIComponent(q)}&limit=8`)
      .then((r) => r.json())
      .then((json) => {
        setSuggestions(json.data ?? []);
        setShowSuggestions(true);
      })
      .catch(() => setSuggestions([]));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setValue(v);
    setActiveIndex(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(v), 150);
  };

  const commit = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onCommit(trimmed);
    setValue("");
    setSuggestions([]);
    setShowSuggestions(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && suggestions[activeIndex]) {
        commit(suggestions[activeIndex].name);
      } else {
        commit(value);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
      setActiveIndex(-1);
    }
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          "h-7 px-2 text-xs rounded-[var(--radius-sm)] border border-[var(--color-border)]",
          "bg-[var(--color-bg)] text-[var(--color-text-heading)] placeholder:text-[var(--color-text-muted)]",
          "focus:outline-none focus:ring-1 focus:ring-[#1456f0]",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "w-36"
        )}
        aria-label={placeholder}
        aria-autocomplete="list"
        aria-expanded={showSuggestions && suggestions.length > 0}
      />
      {showSuggestions && suggestions.length > 0 && (
        <ul
          className="absolute top-full left-0 mt-1 w-48 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-lg z-50 overflow-hidden"
          role="listbox"
        >
          {suggestions.map((tag, i) => (
            <li
              key={tag.id}
              role="option"
              aria-selected={i === activeIndex}
              className={cn(
                "px-3 py-1.5 text-xs cursor-pointer flex items-center gap-2",
                i === activeIndex
                  ? "bg-[#1456f0] text-white"
                  : "text-[var(--color-text-heading)] hover:bg-[var(--color-bg-secondary)]"
              )}
              onMouseDown={() => commit(tag.name)}
            >
              {tag.color && (
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: tag.color }}
                />
              )}
              {tag.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── BulkActionToolbar ─────────────────────────────────────────────────────────

export function BulkActionToolbar({
  selectedCount,
  selectedIds,
  onSelectNone,
  onOperationComplete,
}: BulkActionToolbarProps) {
  const [status, setStatus] = useState<OperationStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear status after a delay
  const showStatus = useCallback((s: OperationStatus, msg: string, autoClear = true) => {
    setStatus(s);
    setStatusMessage(msg);
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    if (autoClear && (s === "success" || s === "error")) {
      statusTimerRef.current = setTimeout(() => {
        setStatus("idle");
        setStatusMessage("");
      }, 3000);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    };
  }, []);

  /**
   * Resolve a tag name to a tag ID, creating the tag if it doesn't exist.
   */
  const resolveTagId = async (name: string): Promise<number> => {
    const normalized = name.trim().toLowerCase();

    // Try autocomplete lookup first
    const autocompleteRes = await fetch(
      `/api/tags/autocomplete?q=${encodeURIComponent(normalized)}&limit=10`
    );
    if (autocompleteRes.ok) {
      const json = await autocompleteRes.json();
      const exact = (json.data as TagSuggestion[]).find(
        (t) => t.name === normalized
      );
      if (exact) return exact.id;
    }

    // Create the tag
    const createRes = await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: normalized }),
    });
    if (!createRes.ok) {
      // May already exist due to race condition — try lookup again
      const listRes = await fetch(
        `/api/tags?q=${encodeURIComponent(normalized)}&limit=5`
      );
      if (listRes.ok) {
        const json = await listRes.json();
        const exact = (json.data as TagSuggestion[]).find(
          (t) => t.name === normalized
        );
        if (exact) return exact.id;
      }
      throw new Error(`Failed to create tag '${name}'`);
    }
    const createJson = await createRes.json();
    return createJson.data.id;
  };

  const executeBulkOp = useCallback(
    async (op: BulkOp, tagName: string) => {
      if (status === "loading") return;
      const imageIds = Array.from(selectedIds);
      if (imageIds.length === 0) return;

      showStatus("loading", `Resolving tag…`, false);
      try {
        const tagId = await resolveTagId(tagName);

        showStatus("loading", `${op === "add" ? "Adding" : "Removing"} tag to ${imageIds.length} image${imageIds.length !== 1 ? "s" : ""}…`, false);

        const endpoint = op === "add" ? "/api/tags/bulk/add" : "/api/tags/bulk/remove";
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageIds, tagIds: [tagId] }),
        });

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.message ?? `HTTP ${res.status}`);
        }

        const verb = op === "add" ? "Added" : "Removed";
        showStatus(
          "success",
          `${verb} "${tagName}" ${op === "add" ? "to" : "from"} ${imageIds.length} image${imageIds.length !== 1 ? "s" : ""}`
        );
        onOperationComplete?.();
      } catch (err) {
        showStatus(
          "error",
          err instanceof Error ? err.message : "Operation failed"
        );
      }
    },
    [selectedIds, status, showStatus, onOperationComplete]
  );

  const isLoading = status === "loading";

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 bg-[#1456f0]/8 dark:bg-[#1456f0]/15 border-b border-[#1456f0]/20",
        "flex-wrap gap-y-1.5"
      )}
      role="toolbar"
      aria-label="Bulk actions"
    >
      {/* Selection count + clear */}
      <div className="flex items-center gap-2 mr-1">
        <TagsIcon className="w-4 h-4 text-[#1456f0] dark:text-[#60a5fa] shrink-0" />
        <span className="text-sm font-semibold text-[#1456f0] dark:text-[#60a5fa]">
          {selectedCount} selected
        </span>
        <button
          onClick={onSelectNone}
          className="flex items-center gap-0.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-heading)] transition-colors"
          title="Clear selection"
          aria-label="Clear selection"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Divider */}
      <div className="w-px h-5 bg-[var(--color-border)] shrink-0" />

      {/* Add tags section */}
      <div className="flex items-center gap-1.5">
        <Plus className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" />
        <span className="text-xs text-[var(--color-text-muted)] shrink-0">Add tag:</span>
        <TagInput
          placeholder="Tag name…"
          onCommit={(name) => executeBulkOp("add", name)}
          disabled={isLoading}
        />
      </div>

      {/* Remove tags section */}
      <div className="flex items-center gap-1.5">
        <Minus className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" />
        <span className="text-xs text-[var(--color-text-muted)] shrink-0">Remove tag:</span>
        <TagInput
          placeholder="Tag name…"
          onCommit={(name) => executeBulkOp("remove", name)}
          disabled={isLoading}
        />
      </div>

      {/* Status indicator */}
      {status !== "idle" && (
        <div
          className={cn(
            "flex items-center gap-1.5 ml-auto text-xs font-medium",
            status === "loading" && "text-[var(--color-text-muted)]",
            status === "success" && "text-emerald-600 dark:text-emerald-400",
            status === "error" && "text-red-500 dark:text-red-400"
          )}
          role="status"
          aria-live="polite"
        >
          {status === "loading" && (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          )}
          {status === "success" && (
            <CheckCircle className="w-3.5 h-3.5" />
          )}
          {status === "error" && (
            <AlertCircle className="w-3.5 h-3.5" />
          )}
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Keyboard hint */}
      {status === "idle" && (
        <span className="text-[10px] text-[var(--color-text-muted)] ml-auto opacity-60 hidden sm:block">
          Ctrl+A select all · Esc clear
        </span>
      )}
    </div>
  );
}
