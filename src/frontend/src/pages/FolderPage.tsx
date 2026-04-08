/**
 * FolderPage.tsx
 *
 * Main folder-browsing page. Combines:
 *  - FolderTree (left panel): navigate source folders and directories
 *  - FolderBreadcrumb (top): show current path with clickable ancestors
 *  - ImageGrid (main area): thumbnail grid with sort and density controls
 *
 * Layout:
 *  - Desktop: [FolderTree panel] | [breadcrumb + grid]
 *  - Mobile:  collapsible tree (toggleable via hamburger)
 */

import { useState, useEffect } from "react";
import { FolderOpen, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { FolderTree, type SelectedFolder } from "@/components/FolderTree";
import { FolderBreadcrumb } from "@/components/FolderBreadcrumb";
import { ImageGrid, type GridDensity } from "@/components/ImageGrid";
import { MapView } from "@/components/MapView";
import { TimelineView } from "@/components/TimelineView";
import { popFolderRestoreState } from "@/hooks/useNavigationContext";
import { useAppState } from "@/hooks/useAppState";
import { useMapConfig } from "@/hooks/useMapConfig";

export function FolderPage() {
  const [selected, setSelected] = useState<SelectedFolder | null>(null);
  const [density, setDensity] = useState<GridDensity>("medium");
  const [treeOpen, setTreeOpen] = useState(true);
  // Pending folder restore from sessionStorage (set when navigating back from image detail)
  const [pendingRestore, setPendingRestore] = useState(() => popFolderRestoreState());
  const { viewMode } = useAppState();
  const mapConfig = useMapConfig();

  // Apply pending folder restore on mount (navigating back from image detail)
  useEffect(() => {
    if (pendingRestore) {
      setSelected({
        sourceId: pendingRestore.sourceId,
        path: pendingRestore.path,
        sourceName: pendingRestore.sourceName,
      });
      setPendingRestore(null);
    }
  }, [pendingRestore]);

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Folder tree panel ──────────────────────────────────────────────── */}
      <aside
        className={cn(
          "flex flex-col border-r border-[var(--color-border)] bg-[var(--color-bg)] transition-all duration-200 shrink-0 overflow-hidden",
          // Desktop: always rendered, toggleable width
          treeOpen ? "w-60" : "w-0",
          // Mobile: absolute overlay when open
          "md:relative md:flex"
        )}
        aria-label="Folder tree"
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-3 h-12 border-b border-[var(--color-border)] shrink-0">
          <FolderOpen className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
          <span className="text-sm font-medium text-[var(--color-text-heading)] truncate">
            Folders
          </span>
        </div>

        {/* Tree content */}
        <div className="flex-1 overflow-y-auto py-2">
          <FolderTree selected={selected} onSelect={setSelected} />
        </div>
      </aside>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header bar */}
        <div className="flex items-center gap-2 px-3 h-12 border-b border-[var(--color-border)] shrink-0">
          {/* Tree toggle */}
          <button
            onClick={() => setTreeOpen((v) => !v)}
            className="flex items-center justify-center w-8 h-8 rounded-[var(--radius-md)] text-[var(--color-text-muted)] hover:bg-black/5 hover:text-[var(--color-text-heading)] dark:hover:bg-white/5 transition-colors shrink-0"
            title={treeOpen ? "Hide folder tree" : "Show folder tree"}
            aria-label={treeOpen ? "Hide folder tree" : "Show folder tree"}
          >
            {treeOpen ? (
              <PanelLeftClose className="w-4 h-4" />
            ) : (
              <PanelLeftOpen className="w-4 h-4" />
            )}
          </button>

          {/* Breadcrumb */}
          <FolderBreadcrumb
            selected={selected}
            onNavigate={setSelected}
            className="flex-1 min-w-0"
          />
        </div>

        {/* Image grid, Map view, or Timeline view */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {viewMode === "map" ? (
            <MapView
              sourceId={selected?.sourceId ?? null}
              folderPath={selected?.path ?? null}
              tileUrl={mapConfig.tileUrl}
              tileAttribution={mapConfig.tileAttribution}
            />
          ) : viewMode === "timeline" ? (
            <TimelineView
              filters={{
                sourceId: selected?.sourceId ?? null,
                folderPath: selected?.path ?? null,
              }}
              returnContext="folder"
            />
          ) : (
            <ImageGrid
              selected={selected}
              density={density}
              onDensityChange={setDensity}
            />
          )}
        </div>
      </div>
    </div>
  );
}
