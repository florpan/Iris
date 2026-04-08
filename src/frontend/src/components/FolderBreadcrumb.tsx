/**
 * FolderBreadcrumb.tsx
 *
 * Breadcrumb navigation showing the current folder path.
 * Clicking any ancestor segment navigates up to that folder.
 */

import { HardDrive, ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SelectedFolder } from "./FolderTree";

interface FolderBreadcrumbProps {
  selected: SelectedFolder | null;
  onNavigate: (folder: SelectedFolder) => void;
  className?: string;
}

export function FolderBreadcrumb({
  selected,
  onNavigate,
  className,
}: FolderBreadcrumbProps) {
  if (!selected) {
    return (
      <nav
        className={cn(
          "flex items-center gap-1 text-sm text-[var(--color-text-muted)]",
          className
        )}
        aria-label="Folder navigation"
      >
        <Home className="w-4 h-4" />
        <span>Select a folder</span>
      </nav>
    );
  }

  // Build breadcrumb segments from path
  // e.g. path "2023/summer/vacation" → ["2023", "2023/summer", "2023/summer/vacation"]
  const segments: Array<{ name: string; path: string }> = [];

  // Root segment (source folder)
  segments.push({ name: selected.sourceName, path: "" });

  // Path segments
  if (selected.path) {
    const parts = selected.path.split("/");
    parts.forEach((part, i) => {
      segments.push({
        name: part,
        path: parts.slice(0, i + 1).join("/"),
      });
    });
  }

  return (
    <nav
      className={cn(
        "flex items-center gap-0.5 text-sm min-w-0 flex-wrap",
        className
      )}
      aria-label="Folder navigation"
    >
      {segments.map((seg, i) => {
        const isLast = i === segments.length - 1;
        const isRoot = i === 0;

        return (
          <span key={seg.path + "-" + i} className="flex items-center gap-0.5 min-w-0">
            {i > 0 && (
              <ChevronRight className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0 mx-0.5" />
            )}

            {isLast ? (
              // Current segment — not clickable
              <span
                className={cn(
                  "font-medium truncate max-w-[200px]",
                  isRoot
                    ? "flex items-center gap-1 text-[var(--color-text-heading)]"
                    : "text-[var(--color-text-heading)]"
                )}
                aria-current="page"
              >
                {isRoot && <HardDrive className="w-3.5 h-3.5 shrink-0" />}
                {seg.name}
              </span>
            ) : (
              // Ancestor segment — clickable
              <button
                className={cn(
                  "truncate max-w-[160px] transition-colors hover:text-[var(--color-text-heading)]",
                  isRoot
                    ? "flex items-center gap-1 text-[var(--color-text-secondary)]"
                    : "text-[var(--color-text-secondary)]"
                )}
                onClick={() =>
                  onNavigate({
                    sourceId: selected.sourceId,
                    sourceName: selected.sourceName,
                    path: seg.path,
                    folderName: seg.name,
                  })
                }
                title={seg.path || selected.sourceName}
              >
                {isRoot && <HardDrive className="w-3.5 h-3.5 shrink-0" />}
                {seg.name}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}
