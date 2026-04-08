/**
 * EmptyState.tsx
 *
 * Reusable empty-state component for content areas. Renders a centered
 * illustration area with an icon, heading, description, and optional action.
 *
 * Usage:
 *   <EmptyState
 *     icon={ImageOff}
 *     title="No images found"
 *     description="Try adjusting your search or filters"
 *     action={<button>Clear filters</button>}
 *   />
 *
 * Built-in presets are available for common scenarios:
 *   <EmptyState.NoImages />
 *   <EmptyState.NoSearchResults query="dogs" onClear={...} />
 *   <EmptyState.NoFolderContents />
 *   <EmptyState.NoSources />
 *   <EmptyState.SearchPrompt />
 */

import type { ReactNode } from "react";
import { ImageOff, Search, FolderOpen, HardDrive, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Base Component ────────────────────────────────────────────────────────────

interface EmptyStateProps {
  /** Lucide icon component to display */
  icon?: React.ComponentType<{ className?: string }>;
  /** Short heading */
  title: string;
  /** Longer description / helper text */
  description?: string;
  /** Optional action element (e.g. a button) */
  action?: ReactNode;
  /** Additional classes for the root element */
  className?: string;
  /** Size variant */
  size?: "sm" | "md" | "lg";
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  size = "md",
}: EmptyStateProps) {
  const iconSize = { sm: "w-8 h-8", md: "w-10 h-10", lg: "w-14 h-14" }[size];
  const titleSize = { sm: "text-sm", md: "text-sm", lg: "text-base" }[size];
  const descSize = { sm: "text-xs", md: "text-xs", lg: "text-sm" }[size];
  const padding = { sm: "py-8", md: "py-12", lg: "py-16" }[size];

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center px-4",
        padding,
        className
      )}
      role="status"
      aria-live="polite"
    >
      {Icon && (
        <div className="mb-3 text-[var(--color-text-muted)] opacity-30">
          <Icon className={iconSize} />
        </div>
      )}
      <p className={cn("font-medium text-[var(--color-text-secondary)]", titleSize)}>
        {title}
      </p>
      {description && (
        <p className={cn("mt-1 text-[var(--color-text-muted)]", descSize)}>
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ── Preset variants ───────────────────────────────────────────────────────────

/** No images exist anywhere in the library */
EmptyState.NoImages = function NoImages({ className }: { className?: string }) {
  return (
    <EmptyState
      icon={ImageOff}
      title="No images in library"
      description="Add a source folder in Settings to start browsing your photos"
      className={className}
    />
  );
};

/** Search returned zero results */
interface NoSearchResultsProps {
  query?: string;
  onClear?: () => void;
  className?: string;
}

EmptyState.NoSearchResults = function NoSearchResults({
  query,
  onClear,
  className,
}: NoSearchResultsProps) {
  return (
    <EmptyState
      icon={Search}
      title={query ? `No results for "${query}"` : "No results found"}
      description="Try different keywords or adjust your filters"
      action={
        onClear ? (
          <button
            onClick={onClear}
            className="px-3 py-1.5 text-xs font-medium rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          >
            Clear search
          </button>
        ) : undefined
      }
      className={className}
    />
  );
};

/** Folder is empty */
EmptyState.NoFolderContents = function NoFolderContents({
  folderName,
  className,
}: { folderName?: string; className?: string }) {
  return (
    <EmptyState
      icon={FolderOpen}
      title={folderName ? `"${folderName}" is empty` : "This folder is empty"}
      description="No images found in this directory"
      className={className}
    />
  );
};

/** No source folders configured */
EmptyState.NoSources = function NoSources({ className }: { className?: string }) {
  return (
    <EmptyState
      icon={HardDrive}
      title="No source folders"
      description="Go to Settings to add a folder to your library"
      size="lg"
      action={
        <a
          href="/settings"
          className="px-4 py-2 text-sm font-medium rounded-[var(--radius-md)] bg-[#1456f0] text-white hover:bg-[#1246cc] transition-colors"
        >
          Open Settings
        </a>
      }
      className={className}
    />
  );
};

/** Search prompt — shown before the user has entered a query */
EmptyState.SearchPrompt = function SearchPrompt({ className }: { className?: string }) {
  return (
    <EmptyState
      icon={Search}
      title="Search your photo library"
      description="Search by filename, title, description, keywords, camera model, and more"
      className={className}
    />
  );
};

/** No browse results after applying filters */
EmptyState.NoFilterResults = function NoFilterResults({
  onClear,
  className,
}: { onClear?: () => void; className?: string }) {
  return (
    <EmptyState
      icon={SlidersHorizontal}
      title="No images match your filters"
      description="Try removing some filters to see more results"
      action={
        onClear ? (
          <button
            onClick={onClear}
            className="px-3 py-1.5 text-xs font-medium rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          >
            Clear all filters
          </button>
        ) : undefined
      }
      className={className}
    />
  );
};
