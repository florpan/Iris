/**
 * TagManagementPage.tsx
 *
 * Administrative interface for managing the tag system.
 * Features:
 *  - Sortable tag table with usage statistics
 *  - Tag rename with conflict resolution
 *  - Tag merge workflow
 *  - Tag deletion with impact assessment
 *  - Bulk operations (merge, delete) on multiple tags
 *  - Usage detail view (images using each tag)
 *  - Search and filtering
 *  - Export as CSV or JSON
 *  - Import from JSON
 *  - Management audit log
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Tags,
  Search,
  Download,
  Upload,
  Pencil,
  Trash2,
  Merge,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  X,
  Check,
  AlertTriangle,
  ImageOff,
  Loader2,
  History,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Tag {
  id: number;
  name: string;
  color: string | null;
  usageCount: number;
  createdAt: string | null;
}

interface TagImage {
  id: number;
  fileName: string;
  relativePath: string;
  thumbnailPath: string | null;
  takenAt: string | null;
  width: number | null;
  height: number | null;
  mimeType: string | null;
}

interface AuditLogEntry {
  id: number;
  operation: string;
  details: Record<string, unknown>;
  createdAt: string;
}

type SortField = "name" | "usageCount" | "createdAt";
type SortDir = "asc" | "desc";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(s: string | null): string {
  if (!s) return "—";
  return new Date(s).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(s: string): string {
  return new Date(s).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function operationLabel(op: string): string {
  const labels: Record<string, string> = {
    rename: "Renamed",
    merge: "Merged",
    delete: "Deleted",
    bulk_delete: "Bulk deleted",
    import: "Imported",
  };
  return labels[op] ?? op;
}

function sortTags(tags: Tag[], field: SortField, dir: SortDir): Tag[] {
  return [...tags].sort((a, b) => {
    let cmp = 0;
    if (field === "name") {
      cmp = a.name.localeCompare(b.name);
    } else if (field === "usageCount") {
      cmp = a.usageCount - b.usageCount;
    } else if (field === "createdAt") {
      const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const db_ = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      cmp = da - db_;
    }
    return dir === "asc" ? cmp : -cmp;
  });
}

// ── Sub-components ─────────────────────────────────────────────────────────────

interface SortHeaderProps {
  label: string;
  field: SortField;
  current: SortField;
  dir: SortDir;
  onSort: (field: SortField) => void;
}

function SortHeader({ label, field, current, dir, onSort }: SortHeaderProps) {
  const isActive = current === field;
  return (
    <button
      onClick={() => onSort(field)}
      className={cn(
        "flex items-center gap-1 text-xs font-semibold uppercase tracking-wide transition-colors",
        isActive
          ? "text-[#1456f0] dark:text-[#60a5fa]"
          : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
      )}
    >
      {label}
      {isActive ? (
        dir === "asc" ? (
          <ChevronUp className="w-3 h-3" />
        ) : (
          <ChevronDown className="w-3 h-3" />
        )
      ) : (
        <ChevronsUpDown className="w-3 h-3 opacity-50" />
      )}
    </button>
  );
}

// ── Rename Dialog ─────────────────────────────────────────────────────────────

interface RenameDialogProps {
  tag: Tag;
  onSave: (newName: string) => Promise<void>;
  onClose: () => void;
}

function RenameDialog({ tag, onSave, onClose }: RenameDialogProps) {
  const [name, setName] = useState(tag.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  const handleSave = async () => {
    const trimmed = name.trim().toLowerCase();
    if (!trimmed) {
      setError("Name cannot be empty");
      return;
    }
    if (trimmed === tag.name) {
      onClose();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(trimmed);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to rename tag");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[var(--radius-comfortable)] shadow-xl w-full max-w-sm mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-[var(--color-text-heading)] mb-1">Rename tag</h2>
        <p className="text-sm text-[var(--color-text-muted)] mb-4">
          Renaming will update all image associations.
        </p>

        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") onClose();
          }}
          className={cn(
            "w-full px-3 py-2 rounded-[var(--radius-md)] border text-sm bg-[var(--color-bg)] text-[var(--color-text-heading)]",
            "focus:outline-none focus:ring-2 focus:ring-[#1456f0]",
            error
              ? "border-red-400 dark:border-red-500"
              : "border-[var(--color-border)]"
          )}
          placeholder="Tag name"
          autoFocus
        />

        {error && (
          <p className="mt-2 text-xs text-red-500 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            {error}
          </p>
        )}

        <div className="flex gap-2 mt-4 justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-[var(--radius-md)] text-sm text-[var(--color-text-secondary)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className={cn(
              "px-3 py-1.5 rounded-[var(--radius-md)] text-sm font-medium transition-colors flex items-center gap-1.5",
              saving || !name.trim()
                ? "opacity-50 cursor-not-allowed bg-[#1456f0] text-white"
                : "bg-[#1456f0] text-white hover:bg-[#1145cc]"
            )}
          >
            {saving && <Loader2 className="w-3 h-3 animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Delete Dialog ─────────────────────────────────────────────────────────────

interface DeleteDialogProps {
  tags: Tag[];
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

function DeleteDialog({ tags, onConfirm, onClose }: DeleteDialogProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalImages = tags.reduce((sum, t) => sum + t.usageCount, 0);
  const isBulk = tags.length > 1;

  const handleConfirm = async () => {
    setDeleting(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[var(--radius-comfortable)] shadow-xl w-full max-w-sm mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="flex-shrink-0 w-9 h-9 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <AlertTriangle className="w-4.5 h-4.5 text-red-500" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[var(--color-text-heading)]">
              {isBulk ? `Delete ${tags.length} tags` : `Delete "${tags[0].name}"`}
            </h2>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              {isBulk
                ? `This will remove ${tags.length} tags from ${totalImages.toLocaleString()} image${totalImages !== 1 ? "s" : ""}. This cannot be undone.`
                : `This tag is used by ${totalImages.toLocaleString()} image${totalImages !== 1 ? "s" : ""}. Deleting it will remove the tag from all those images. This cannot be undone.`}
            </p>
          </div>
        </div>

        {isBulk && tags.length <= 10 && (
          <div className="mb-4 p-3 bg-[var(--color-bg-secondary)] rounded-[var(--radius-md)] max-h-32 overflow-y-auto">
            <ul className="space-y-1">
              {tags.map((t) => (
                <li key={t.id} className="text-sm text-[var(--color-text-secondary)] flex justify-between">
                  <span>{t.name}</span>
                  <span className="text-[var(--color-text-muted)]">{t.usageCount} images</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && (
          <p className="mb-3 text-xs text-red-500 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            {error}
          </p>
        )}

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-[var(--radius-md)] text-sm text-[var(--color-text-secondary)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={deleting}
            className={cn(
              "px-3 py-1.5 rounded-[var(--radius-md)] text-sm font-medium transition-colors flex items-center gap-1.5",
              deleting
                ? "opacity-50 cursor-not-allowed bg-red-500 text-white"
                : "bg-red-500 text-white hover:bg-red-600"
            )}
          >
            {deleting && <Loader2 className="w-3 h-3 animate-spin" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Merge Dialog ──────────────────────────────────────────────────────────────

interface MergeDialogProps {
  sourceTags: Tag[];
  allTags: Tag[];
  onConfirm: (targetTagId: number) => Promise<void>;
  onClose: () => void;
}

function MergeDialog({ sourceTags, allTags, onConfirm, onClose }: MergeDialogProps) {
  const [targetTagId, setTargetTagId] = useState<number | null>(null);
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const sourceIds = new Set(sourceTags.map((t) => t.id));
  const eligibleTargets = allTags.filter(
    (t) => !sourceIds.has(t.id)
  );
  const filteredTargets = search
    ? eligibleTargets.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))
    : eligibleTargets;

  const selectedTarget = allTags.find((t) => t.id === targetTagId);
  const totalImages = sourceTags.reduce((sum, t) => sum + t.usageCount, 0);

  const handleConfirm = async () => {
    if (!targetTagId) return;
    setMerging(true);
    setError(null);
    try {
      await onConfirm(targetTagId);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to merge tags");
    } finally {
      setMerging(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[var(--radius-comfortable)] shadow-xl w-full max-w-md mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-[var(--color-text-heading)] mb-1">Merge tags</h2>
        <p className="text-sm text-[var(--color-text-muted)] mb-4">
          Merging will move all {totalImages.toLocaleString()} image associations from the selected tags into the target tag, then delete the source tags.
        </p>

        {/* Source tags */}
        <div className="mb-4">
          <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide mb-2">
            Merging ({sourceTags.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {sourceTags.map((t) => (
              <span
                key={t.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--radius-sm)] bg-[var(--color-bg-secondary)] text-sm text-[var(--color-text-secondary)]"
              >
                {t.name}
                <span className="text-[var(--color-text-muted)] text-xs">({t.usageCount})</span>
              </span>
            ))}
          </div>
        </div>

        {/* Target selection */}
        <div className="mb-4">
          <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide mb-2">
            Into target tag
          </p>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tags…"
            className="w-full px-3 py-2 rounded-[var(--radius-md)] border border-[var(--color-border)] text-sm bg-[var(--color-bg)] text-[var(--color-text-heading)] focus:outline-none focus:ring-2 focus:ring-[#1456f0] mb-2"
          />
          <div className="max-h-40 overflow-y-auto border border-[var(--color-border)] rounded-[var(--radius-md)]">
            {filteredTargets.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)] p-3 text-center">
                {search ? "No matching tags" : "No other tags available"}
              </p>
            ) : (
              filteredTargets.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTargetTagId(t.id)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 text-sm transition-colors",
                    targetTagId === t.id
                      ? "bg-[#1456f0]/10 text-[#1456f0] dark:bg-[#1456f0]/20 dark:text-[#60a5fa]"
                      : "text-[var(--color-text-secondary)] hover:bg-black/5 dark:hover:bg-white/5"
                  )}
                >
                  <span className="flex items-center gap-2">
                    {targetTagId === t.id && <Check className="w-3.5 h-3.5" />}
                    {targetTagId !== t.id && <span className="w-3.5" />}
                    {t.name}
                  </span>
                  <span className="text-xs text-[var(--color-text-muted)]">{t.usageCount} images</span>
                </button>
              ))
            )}
          </div>
        </div>

        {selectedTarget && (
          <div className="mb-4 p-3 bg-[var(--color-bg-secondary)] rounded-[var(--radius-md)] text-sm text-[var(--color-text-secondary)]">
            <strong className="text-[var(--color-text-heading)]">{selectedTarget.name}</strong> will gain{" "}
            {totalImages.toLocaleString()} additional image association{totalImages !== 1 ? "s" : ""}.
          </div>
        )}

        {error && (
          <p className="mb-3 text-xs text-red-500 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            {error}
          </p>
        )}

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-[var(--radius-md)] text-sm text-[var(--color-text-secondary)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!targetTagId || merging}
            className={cn(
              "px-3 py-1.5 rounded-[var(--radius-md)] text-sm font-medium transition-colors flex items-center gap-1.5",
              !targetTagId || merging
                ? "opacity-50 cursor-not-allowed bg-[#1456f0] text-white"
                : "bg-[#1456f0] text-white hover:bg-[#1145cc]"
            )}
          >
            {merging && <Loader2 className="w-3 h-3 animate-spin" />}
            <Merge className="w-3.5 h-3.5" />
            Merge
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tag Usage Panel ────────────────────────────────────────────────────────────

interface UsagePanelProps {
  tag: Tag;
  onClose: () => void;
}

function UsagePanel({ tag, onClose }: UsagePanelProps) {
  const [images, setImages] = useState<TagImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<{
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  } | null>(null);

  const loadImages = useCallback(
    (p: number) => {
      setLoading(true);
      setError(null);
      fetch(`/api/tags/${tag.id}/images?page=${p}&pageSize=24`)
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then((json) => {
          setImages(json.data ?? []);
          setPagination(json.pagination ?? null);
        })
        .catch((e) => setError(e.message ?? "Failed to load images"))
        .finally(() => setLoading(false));
    },
    [tag.id]
  );

  useEffect(() => {
    loadImages(1);
  }, [loadImages]);

  const handlePage = (p: number) => {
    setPage(p);
    loadImages(p);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[var(--radius-comfortable)] shadow-xl w-full max-w-2xl mx-4 flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
          <div>
            <h2 className="text-base font-semibold text-[var(--color-text-heading)]">
              "{tag.name}" — images ({tag.usageCount})
            </h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Images tagged with this tag
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-[var(--radius-md)] text-[var(--color-text-muted)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-5 h-5 animate-spin text-[var(--color-text-muted)]" />
            </div>
          ) : error ? (
            <div className="text-sm text-red-500 text-center py-8">{error}</div>
          ) : images.length === 0 ? (
            <div className="text-sm text-[var(--color-text-muted)] text-center py-8">
              No images with this tag
            </div>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {images.map((img) => (
                <UsageImageThumbnail key={img.id} image={img} />
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-[var(--color-border)] text-sm">
            <span className="text-[var(--color-text-muted)] text-xs">
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} images)
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="p-1 rounded text-[var(--color-text-muted)] hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => handlePage(Math.min(pagination.totalPages, page + 1))}
                disabled={page >= pagination.totalPages}
                className="p-1 rounded text-[var(--color-text-muted)] hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface UsageImageThumbnailProps {
  image: TagImage;
}

function UsageImageThumbnail({ image }: UsageImageThumbnailProps) {
  const [error, setError] = useState(false);
  return (
    <a
      href={`/image/${image.id}`}
      className="block aspect-square rounded-[var(--radius-md)] overflow-hidden bg-[var(--color-bg-secondary)] hover:ring-2 hover:ring-[#1456f0] transition-all"
      title={image.fileName}
      target="_blank"
      rel="noopener noreferrer"
    >
      {image.thumbnailPath && !error ? (
        <img
          src={`/api/images/${image.id}/thumb`}
          alt={image.fileName}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={() => setError(true)}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <ImageOff className="w-5 h-5 text-[var(--color-text-muted)]" />
        </div>
      )}
    </a>
  );
}

// ── Import Dialog ─────────────────────────────────────────────────────────────

interface ImportDialogProps {
  onImported: () => void;
  onClose: () => void;
}

function ImportDialog({ onImported, onClose }: ImportDialogProps) {
  const [text, setText] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    created: number;
    skipped: number;
    failed: number;
    errors: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleImport = async () => {
    if (!text.trim()) {
      setError("Paste JSON tag data to import");
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text.trim());
    } catch {
      setError("Invalid JSON. Expected: { \"tags\": [{ \"name\": \"...\", \"color\": \"...\" }] }");
      return;
    }

    const body =
      parsed &&
      typeof parsed === "object" &&
      "tags" in (parsed as object) &&
      Array.isArray((parsed as { tags: unknown }).tags)
        ? parsed
        : { tags: Array.isArray(parsed) ? parsed : [] };

    setImporting(true);
    setError(null);
    try {
      const resp = await fetch("/api/tags/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const msg = await resp.json().catch(() => ({ message: `HTTP ${resp.status}` }));
        throw new Error(msg.message ?? `HTTP ${resp.status}`);
      }
      const json = await resp.json();
      setResult(json.data);
      onImported();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[var(--radius-comfortable)] shadow-xl w-full max-w-lg mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-[var(--color-text-heading)] mb-1">Import tags</h2>
        <p className="text-sm text-[var(--color-text-muted)] mb-4">
          Paste JSON with tag data. Expected format:{" "}
          <code className="text-xs bg-[var(--color-bg-secondary)] px-1 py-0.5 rounded">
            {"{ \"tags\": [{ \"name\": \"...\", \"color\": \"...\" }] }"}
          </code>
          . Duplicate tags will be skipped.
        </p>

        {result ? (
          <div className="mb-4 p-4 bg-[var(--color-bg-secondary)] rounded-[var(--radius-md)]">
            <p className="text-sm font-semibold text-[var(--color-text-heading)] mb-2 flex items-center gap-1.5">
              <Check className="w-4 h-4 text-green-500" /> Import complete
            </p>
            <div className="space-y-1 text-sm text-[var(--color-text-secondary)]">
              <p>Created: <strong>{result.created}</strong></p>
              <p>Skipped (duplicates): <strong>{result.skipped}</strong></p>
              <p>Failed: <strong>{result.failed}</strong></p>
            </div>
            {result.errors.length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-red-500 font-medium mb-1">Errors:</p>
                <ul className="text-xs text-red-400 space-y-0.5">
                  {result.errors.slice(0, 5).map((e, i) => (
                    <li key={i}>• {e}</li>
                  ))}
                  {result.errors.length > 5 && (
                    <li>…and {result.errors.length - 5} more</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder='{ "tags": [{ "name": "vacation" }, { "name": "beach", "color": "#3daeff" }] }'
            rows={8}
            className="w-full px-3 py-2 rounded-[var(--radius-md)] border border-[var(--color-border)] text-sm bg-[var(--color-bg)] text-[var(--color-text-heading)] font-mono focus:outline-none focus:ring-2 focus:ring-[#1456f0] resize-y mb-3"
          />
        )}

        {error && (
          <p className="mb-3 text-xs text-red-500 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            {error}
          </p>
        )}

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-[var(--radius-md)] text-sm text-[var(--color-text-secondary)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            {result ? "Close" : "Cancel"}
          </button>
          {!result && (
            <button
              onClick={handleImport}
              disabled={importing || !text.trim()}
              className={cn(
                "px-3 py-1.5 rounded-[var(--radius-md)] text-sm font-medium transition-colors flex items-center gap-1.5",
                importing || !text.trim()
                  ? "opacity-50 cursor-not-allowed bg-[#1456f0] text-white"
                  : "bg-[#1456f0] text-white hover:bg-[#1145cc]"
              )}
            >
              {importing && <Loader2 className="w-3 h-3 animate-spin" />}
              <Upload className="w-3.5 h-3.5" />
              Import
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Audit Log Panel ───────────────────────────────────────────────────────────

interface AuditLogPanelProps {
  onClose: () => void;
}

function AuditLogPanel({ onClose }: AuditLogPanelProps) {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/tags/log?limit=100")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => setEntries(json.data ?? []))
      .catch((e) => setError(e.message ?? "Failed to load log"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[var(--radius-comfortable)] shadow-xl w-full max-w-xl mx-4 flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
          <h2 className="text-base font-semibold text-[var(--color-text-heading)]">Management history</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-[var(--radius-md)] text-[var(--color-text-muted)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-5 h-5 animate-spin text-[var(--color-text-muted)]" />
            </div>
          ) : error ? (
            <div className="text-sm text-red-500 text-center py-8">{error}</div>
          ) : entries.length === 0 ? (
            <div className="text-sm text-[var(--color-text-muted)] text-center py-8">
              No management operations recorded yet
            </div>
          ) : (
            <ul className="space-y-2">
              {entries.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-start gap-3 p-3 rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)]"
                >
                  <span
                    className={cn(
                      "mt-0.5 text-xs font-semibold px-2 py-0.5 rounded-[var(--radius-sm)] shrink-0",
                      entry.operation === "delete" || entry.operation === "bulk_delete"
                        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        : entry.operation === "merge"
                          ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                          : entry.operation === "rename"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                            : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    )}
                  >
                    {operationLabel(entry.operation)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <AuditDetails entry={entry} />
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                      {formatDateTime(entry.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function AuditDetails({ entry }: { entry: AuditLogEntry }) {
  const d = entry.details;
  if (entry.operation === "rename") {
    return (
      <p className="text-sm text-[var(--color-text-secondary)]">
        <span className="font-medium">{d.oldName as string}</span>
        {" → "}
        <span className="font-medium">{d.newName as string}</span>
      </p>
    );
  }
  if (entry.operation === "merge") {
    return (
      <p className="text-sm text-[var(--color-text-secondary)]">
        Merged {(d.sourceNames as string[])?.join(", ")} into{" "}
        <span className="font-medium">{d.targetName as string}</span>
      </p>
    );
  }
  if (entry.operation === "delete") {
    return (
      <p className="text-sm text-[var(--color-text-secondary)]">
        Deleted <span className="font-medium">{d.tagName as string}</span>
      </p>
    );
  }
  if (entry.operation === "bulk_delete") {
    return (
      <p className="text-sm text-[var(--color-text-secondary)]">
        Deleted {d.count as number} tag{(d.count as number) !== 1 ? "s" : ""}:{" "}
        {(d.tagNames as string[])?.slice(0, 3).join(", ")}
        {(d.tagNames as string[])?.length > 3 && (
          <> and {(d.tagNames as string[]).length - 3} more</>
        )}
      </p>
    );
  }
  if (entry.operation === "import") {
    return (
      <p className="text-sm text-[var(--color-text-secondary)]">
        Imported {d.created as number} tags ({d.skipped as number} skipped, {d.failed as number} failed)
      </p>
    );
  }
  return (
    <p className="text-sm text-[var(--color-text-secondary)] font-mono text-xs">
      {JSON.stringify(d)}
    </p>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function TagManagementPage() {
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("usageCount");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Dialog state
  const [renameTag, setRenameTag] = useState<Tag | null>(null);
  const [deleteTagList, setDeleteTagList] = useState<Tag[] | null>(null);
  const [mergeTagList, setMergeTagList] = useState<Tag[] | null>(null);
  const [usageTag, setUsageTag] = useState<Tag | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showLog, setShowLog] = useState(false);

  // Toast-style notification
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 3500);
  }, []);

  // ── Load tags ────────────────────────────────────────────────────────────────

  const loadTags = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/api/tags?limit=200")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => setAllTags(json.data ?? []))
      .catch((e) => setError(e.message ?? "Failed to load tags"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  // ── Sort & filter ────────────────────────────────────────────────────────────

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "usageCount" ? "desc" : "asc");
    }
  };

  const filteredTags = sortTags(
    search
      ? allTags.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))
      : allTags,
    sortField,
    sortDir
  );

  // ── Selection ────────────────────────────────────────────────────────────────

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredTags.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTags.map((t) => t.id)));
    }
  };

  const clearSelection = () => setSelectedIds(new Set());
  const selectedTags = allTags.filter((t) => selectedIds.has(t.id));
  const allVisibleSelected =
    filteredTags.length > 0 && filteredTags.every((t) => selectedIds.has(t.id));
  const someSelected = selectedIds.size > 0;

  // ── Operations ───────────────────────────────────────────────────────────────

  const handleRename = async (newName: string) => {
    if (!renameTag) return;
    const resp = await fetch(`/api/tags/${renameTag.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    if (!resp.ok) {
      const msg = await resp.json().catch(() => ({ message: `HTTP ${resp.status}` }));
      throw new Error(msg.message ?? "Rename failed");
    }
    showToast(`Tag renamed to "${newName}"`);
    loadTags();
  };

  const handleDelete = async (tagsToDelete: Tag[]) => {
    if (tagsToDelete.length === 1) {
      const resp = await fetch(`/api/tags/${tagsToDelete[0].id}`, { method: "DELETE" });
      if (!resp.ok) {
        const msg = await resp.json().catch(() => ({ message: `HTTP ${resp.status}` }));
        throw new Error(msg.message ?? "Delete failed");
      }
      showToast(`Deleted tag "${tagsToDelete[0].name}"`);
    } else {
      const resp = await fetch("/api/tags/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagIds: tagsToDelete.map((t) => t.id) }),
      });
      if (!resp.ok) {
        const msg = await resp.json().catch(() => ({ message: `HTTP ${resp.status}` }));
        throw new Error(msg.message ?? "Bulk delete failed");
      }
      showToast(`Deleted ${tagsToDelete.length} tags`);
    }
    clearSelection();
    loadTags();
  };

  const handleMerge = async (targetTagId: number) => {
    if (!mergeTagList) return;
    const resp = await fetch("/api/tags/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceTagIds: mergeTagList.map((t) => t.id),
        targetTagId,
      }),
    });
    if (!resp.ok) {
      const msg = await resp.json().catch(() => ({ message: `HTTP ${resp.status}` }));
      throw new Error(msg.message ?? "Merge failed");
    }
    showToast(`Merged ${mergeTagList.length} tags`);
    clearSelection();
    loadTags();
  };

  // ── Export ───────────────────────────────────────────────────────────────────

  const handleExport = (format: "csv" | "json") => {
    window.open(`/api/tags/export?format=${format}`, "_blank");
  };

  // ── Stats ────────────────────────────────────────────────────────────────────

  const totalTags = allTags.length;
  const totalTaggedImages = allTags.reduce((sum, t) => sum + t.usageCount, 0);
  const unusedTags = allTags.filter((t) => t.usageCount === 0).length;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden bg-[var(--color-bg)]">
      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="px-6 py-5 border-b border-[var(--color-border)] shrink-0">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold text-[var(--color-text-heading)] flex items-center gap-2.5">
              <Tags className="w-6 h-6 text-[#1456f0]" />
              Tag Management
            </h1>
            <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
              Rename, merge, delete, and organize tags
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowLog(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] text-sm text-[var(--color-text-secondary)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              title="View management history"
            >
              <History className="w-4 h-4" />
              History
            </button>
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] text-sm text-[var(--color-text-secondary)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors border border-[var(--color-border)]"
            >
              <Upload className="w-4 h-4" />
              Import
            </button>
            <div className="flex items-center gap-1 border border-[var(--color-border)] rounded-[var(--radius-md)] overflow-hidden">
              <button
                onClick={() => handleExport("csv")}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                title="Export as CSV"
              >
                <Download className="w-4 h-4" />
                CSV
              </button>
              <div className="w-px h-5 bg-[var(--color-border)]" />
              <button
                onClick={() => handleExport("json")}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                title="Export as JSON"
              >
                <Download className="w-4 h-4" />
                JSON
              </button>
            </div>
          </div>
        </div>

        {/* Stats row */}
        {!loading && (
          <div className="flex items-center gap-6 mt-4 text-sm">
            <div>
              <span className="font-semibold text-[var(--color-text-heading)]">{totalTags.toLocaleString()}</span>{" "}
              <span className="text-[var(--color-text-muted)]">total tags</span>
            </div>
            <div>
              <span className="font-semibold text-[var(--color-text-heading)]">{totalTaggedImages.toLocaleString()}</span>{" "}
              <span className="text-[var(--color-text-muted)]">tag associations</span>
            </div>
            {unusedTags > 0 && (
              <div>
                <span className="font-semibold text-amber-600 dark:text-amber-400">{unusedTags}</span>{" "}
                <span className="text-[var(--color-text-muted)]">unused</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Toolbar ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--color-border)] shrink-0 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-40 max-w-80">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)] pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter tags…"
            className="w-full pl-8 pr-3 py-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] text-sm bg-[var(--color-bg)] text-[var(--color-text-heading)] focus:outline-none focus:ring-2 focus:ring-[#1456f0]"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
              aria-label="Clear search"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Result count */}
        <span className="text-sm text-[var(--color-text-muted)] shrink-0">
          {search ? `${filteredTags.length} of ${totalTags}` : `${totalTags} tags`}
        </span>
      </div>

      {/* ── Bulk action toolbar ───────────────────────────────────────────────── */}
      {someSelected && (
        <div className="flex items-center gap-2 px-4 py-2 bg-[#1456f0]/5 border-b border-[#1456f0]/20 shrink-0">
          <span className="text-sm font-medium text-[#1456f0] dark:text-[#60a5fa]">
            {selectedIds.size} selected
          </span>
          <div className="flex-1" />
          <button
            onClick={() => {
              if (selectedTags.length < 2) {
                showToast("Select at least 2 tags to merge", "error");
                return;
              }
              setMergeTagList(selectedTags);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] text-sm text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors border border-purple-200 dark:border-purple-800"
          >
            <Merge className="w-3.5 h-3.5" />
            Merge
          </button>
          <button
            onClick={() => setDeleteTagList(selectedTags)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors border border-red-200 dark:border-red-800"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete selected
          </button>
          <button
            onClick={clearSelection}
            className="p-1.5 rounded-[var(--radius-md)] text-[var(--color-text-muted)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            aria-label="Clear selection"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── Tag table ────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-5 h-5 animate-spin text-[var(--color-text-muted)]" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-48 text-sm text-red-500">
            {error}
          </div>
        ) : filteredTags.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2">
            <Tags className="w-8 h-8 text-[var(--color-text-muted)]" />
            <p className="text-sm text-[var(--color-text-muted)]">
              {search ? "No tags match your filter" : "No tags yet"}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-[var(--color-bg)] z-10">
              <tr className="border-b border-[var(--color-border)]">
                {/* Checkbox */}
                <th className="w-10 px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAll}
                    className="rounded border-[var(--color-border)] accent-[#1456f0]"
                    aria-label="Select all tags"
                  />
                </th>
                {/* Name */}
                <th className="px-3 py-3 text-left">
                  <SortHeader
                    label="Tag"
                    field="name"
                    current={sortField}
                    dir={sortDir}
                    onSort={handleSort}
                  />
                </th>
                {/* Usage count */}
                <th className="px-3 py-3 text-left">
                  <SortHeader
                    label="Images"
                    field="usageCount"
                    current={sortField}
                    dir={sortDir}
                    onSort={handleSort}
                  />
                </th>
                {/* Created date */}
                <th className="hidden sm:table-cell px-3 py-3 text-left">
                  <SortHeader
                    label="Created"
                    field="createdAt"
                    current={sortField}
                    dir={sortDir}
                    onSort={handleSort}
                  />
                </th>
                {/* Actions */}
                <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)] w-28">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredTags.map((tag) => (
                <TagRow
                  key={tag.id}
                  tag={tag}
                  selected={selectedIds.has(tag.id)}
                  onSelect={() => toggleSelect(tag.id)}
                  onRename={() => setRenameTag(tag)}
                  onDelete={() => setDeleteTagList([tag])}
                  onViewUsage={() => setUsageTag(tag)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Dialogs ──────────────────────────────────────────────────────────── */}
      {renameTag && (
        <RenameDialog
          tag={renameTag}
          onSave={handleRename}
          onClose={() => setRenameTag(null)}
        />
      )}
      {deleteTagList && (
        <DeleteDialog
          tags={deleteTagList}
          onConfirm={() => handleDelete(deleteTagList)}
          onClose={() => setDeleteTagList(null)}
        />
      )}
      {mergeTagList && (
        <MergeDialog
          sourceTags={mergeTagList}
          allTags={allTags}
          onConfirm={handleMerge}
          onClose={() => setMergeTagList(null)}
        />
      )}
      {usageTag && (
        <UsagePanel tag={usageTag} onClose={() => setUsageTag(null)} />
      )}
      {showImport && (
        <ImportDialog
          onImported={loadTags}
          onClose={() => setShowImport(false)}
        />
      )}
      {showLog && <AuditLogPanel onClose={() => setShowLog(false)} />}

      {/* ── Toast notification ───────────────────────────────────────────────── */}
      {toast && (
        <div
          className={cn(
            "fixed bottom-4 right-4 z-[60] flex items-center gap-2 px-4 py-3 rounded-[var(--radius-comfortable)] shadow-lg text-sm font-medium transition-all",
            toast.type === "success"
              ? "bg-[#1456f0] text-white"
              : "bg-red-500 text-white"
          )}
        >
          {toast.type === "success" ? (
            <Check className="w-4 h-4" />
          ) : (
            <AlertTriangle className="w-4 h-4" />
          )}
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ── TagRow ────────────────────────────────────────────────────────────────────

interface TagRowProps {
  tag: Tag;
  selected: boolean;
  onSelect: () => void;
  onRename: () => void;
  onDelete: () => void;
  onViewUsage: () => void;
}

function TagRow({ tag, selected, onSelect, onRename, onDelete, onViewUsage }: TagRowProps) {
  const formattedDate = formatDate(tag.createdAt);

  return (
    <tr
      className={cn(
        "border-b border-[var(--color-border)] transition-colors group",
        selected
          ? "bg-[#1456f0]/5 dark:bg-[#1456f0]/10"
          : "hover:bg-[var(--color-bg-secondary)]"
      )}
    >
      {/* Checkbox */}
      <td className="w-10 px-4 py-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelect}
          className="rounded border-[var(--color-border)] accent-[#1456f0]"
          aria-label={`Select ${tag.name}`}
        />
      </td>

      {/* Tag name */}
      <td className="px-3 py-3">
        <div className="flex items-center gap-2">
          {tag.color && (
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: tag.color }}
              title={tag.color}
            />
          )}
          <span className="font-medium text-[var(--color-text-heading)]">{tag.name}</span>
          {tag.usageCount === 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              unused
            </span>
          )}
        </div>
      </td>

      {/* Usage count */}
      <td className="px-3 py-3">
        <button
          onClick={onViewUsage}
          className={cn(
            "text-sm transition-colors",
            tag.usageCount > 0
              ? "text-[#1456f0] dark:text-[#60a5fa] hover:underline"
              : "text-[var(--color-text-muted)] cursor-default"
          )}
          disabled={tag.usageCount === 0}
          title={tag.usageCount > 0 ? `View ${tag.usageCount} images` : "No images"}
        >
          {tag.usageCount.toLocaleString()}
        </button>
      </td>

      {/* Created */}
      <td className="hidden sm:table-cell px-3 py-3 text-sm text-[var(--color-text-muted)]">
        {formattedDate}
      </td>

      {/* Actions */}
      <td className="px-3 py-3">
        <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onRename}
            className="p-1.5 rounded-[var(--radius-md)] text-[var(--color-text-muted)] hover:text-[#1456f0] hover:bg-[#1456f0]/5 dark:hover:bg-[#1456f0]/10 transition-colors"
            title="Rename"
            aria-label={`Rename ${tag.name}`}
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-[var(--radius-md)] text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            title="Delete"
            aria-label={`Delete ${tag.name}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}
