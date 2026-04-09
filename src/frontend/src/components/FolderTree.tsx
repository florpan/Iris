/**
 * FolderTree.tsx
 *
 * Sidebar folder tree component. Displays all source folders and their
 * directory hierarchy with image counts. Supports collapse/expand per node.
 */

import { useState, useEffect } from "react";
import {
  HardDrive,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FolderNode {
  name: string;
  path: string;
  directCount: number;
  totalCount: number;
  children: FolderNode[];
}

export interface SourceFolderTree {
  id: number;
  name: string;
  sourcePath: string;
  enabled: boolean;
  directCount: number;
  totalCount: number;
  children: FolderNode[];
}

export interface SelectedFolder {
  sourceId: number;
  path: string;
  sourceName: string;
  folderName?: string;
}

interface FolderTreeProps {
  selected: SelectedFolder | null;
  onSelect: (folder: SelectedFolder) => void;
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface FolderRowProps {
  node: FolderNode;
  sourceId: number;
  sourceName: string;
  depth: number;
  selected: SelectedFolder | null;
  onSelect: (folder: SelectedFolder) => void;
}

function FolderRow({
  node,
  sourceId,
  sourceName,
  depth,
  selected,
  onSelect,
}: FolderRowProps) {
  const hasChildren = node.children.length > 0;
  const isSelected =
    selected?.sourceId === sourceId && selected?.path === node.path;

  // Auto-expand if selected or contains selected
  const containsSelected =
    selected?.sourceId === sourceId &&
    selected.path.startsWith(node.path + "/");

  const [expanded, setExpanded] = useState(containsSelected || isSelected);

  // Keep expanded in sync when selection changes from outside
  useEffect(() => {
    if (containsSelected || isSelected) {
      setExpanded(true);
    }
  }, [containsSelected, isSelected]);

  const handleClick = () => {
    onSelect({
      sourceId,
      sourceName,
      path: node.path,
      folderName: node.name,
    });
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded((v) => !v);
  };

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1.5 rounded-[var(--radius-md)] px-2 py-1.5 cursor-pointer text-sm transition-colors group",
          isSelected
            ? "bg-[#1456f0]/10 text-[#1456f0] dark:bg-[#1456f0]/20 dark:text-[#60a5fa]"
            : "text-[var(--color-text-secondary)] hover:bg-black/5 hover:text-[var(--color-text-heading)] dark:hover:bg-white/5 dark:hover:text-white"
        )}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={handleClick}
        role="button"
        aria-selected={isSelected}
      >
        {/* Expand toggle */}
        <span
          className={cn(
            "flex items-center justify-center w-4 h-4 rounded shrink-0",
            hasChildren
              ? "hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
              : "opacity-0 pointer-events-none"
          )}
          onClick={hasChildren ? handleToggle : undefined}
          aria-label={expanded ? "Collapse folder" : "Expand folder"}
        >
          {hasChildren &&
            (expanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            ))}
        </span>

        {/* Folder icon */}
        {isSelected || expanded ? (
          <FolderOpen className="w-4 h-4 shrink-0" />
        ) : (
          <Folder className="w-4 h-4 shrink-0" />
        )}

        {/* Name */}
        <span className="flex-1 truncate min-w-0">{node.name}</span>

        {/* Count badge */}
        <span
          className={cn(
            "text-xs shrink-0 tabular-nums",
            isSelected
              ? "text-[#1456f0]/70 dark:text-[#60a5fa]/70"
              : "text-[var(--color-text-muted)]"
          )}
          title={`${node.directCount} direct, ${node.totalCount} total`}
        >
          {node.totalCount > 0 ? node.totalCount.toLocaleString() : ""}
        </span>
      </div>

      {/* Children */}
      {hasChildren && expanded && (
        <div>
          {node.children.map((child) => (
            <FolderRow
              key={child.path}
              node={child}
              sourceId={sourceId}
              sourceName={sourceName}
              depth={depth + 1}
              selected={selected}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface SourceRowProps {
  source: SourceFolderTree;
  selected: SelectedFolder | null;
  onSelect: (folder: SelectedFolder) => void;
}

function SourceRow({ source, selected, onSelect }: SourceRowProps) {
  const isSelectedRoot =
    selected?.sourceId === source.id && selected?.path === "";
  const containsSelected = selected?.sourceId === source.id;

  const [expanded, setExpanded] = useState(containsSelected);

  useEffect(() => {
    if (containsSelected) setExpanded(true);
  }, [containsSelected]);

  const handleClick = () => {
    onSelect({
      sourceId: source.id,
      sourceName: source.name,
      path: "",
      folderName: source.name,
    });
  };

  const hasChildren = source.children.length > 0;

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1.5 rounded-[var(--radius-md)] px-2 py-1.5 cursor-pointer text-sm font-medium transition-colors",
          isSelectedRoot
            ? "bg-[#1456f0]/10 text-[#1456f0] dark:bg-[#1456f0]/20 dark:text-[#60a5fa]"
            : "text-[var(--color-text-heading)] hover:bg-black/5 dark:hover:bg-white/5"
        )}
        onClick={handleClick}
        role="button"
        aria-selected={isSelectedRoot}
      >
        {/* Expand toggle */}
        <span
          className={cn(
            "flex items-center justify-center w-4 h-4 rounded shrink-0",
            hasChildren
              ? "hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
              : "opacity-0 pointer-events-none"
          )}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
        >
          {hasChildren &&
            (expanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            ))}
        </span>

        <HardDrive className="w-4 h-4 shrink-0" />

        <span className="flex-1 truncate min-w-0">{source.name}</span>

        {!source.enabled && (
          <AlertCircle
            className="w-3.5 h-3.5 text-amber-500 shrink-0"
          />
        )}

        <span
          className={cn(
            "text-xs shrink-0 tabular-nums",
            isSelectedRoot
              ? "text-[#1456f0]/70 dark:text-[#60a5fa]/70"
              : "text-[var(--color-text-muted)]"
          )}
        >
          {source.totalCount > 0 ? source.totalCount.toLocaleString() : ""}
        </span>
      </div>

      {/* Source children (subdirectories) */}
      {hasChildren && expanded && (
        <div>
          {source.children.map((child) => (
            <FolderRow
              key={child.path}
              node={child}
              sourceId={source.id}
              sourceName={source.name}
              depth={0}
              selected={selected}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function FolderTree({ selected, onSelect }: FolderTreeProps) {
  const [sources, setSources] = useState<SourceFolderTree[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch("/api/folders")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => {
        setSources(json.data ?? []);
      })
      .catch((err) => {
        setError(err.message ?? "Failed to load folders");
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-24 text-[var(--color-text-muted)]">
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
        <span className="text-sm">Loading…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-3 py-4 text-sm text-red-500 flex items-center gap-2">
        <AlertCircle className="w-4 h-4 shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  if (sources.length === 0) {
    return (
      <div className="px-3 py-4 text-sm text-[var(--color-text-muted)]">
        No source folders configured.
      </div>
    );
  }

  return (
    <div className="space-y-0.5 px-1">
      {sources.map((source) => (
        <SourceRow
          key={source.id}
          source={source}
          selected={selected}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
