/**
 * useNavigationContext.ts
 *
 * Utilities for context-aware return navigation from image detail views.
 *
 * Features:
 *  - Encode navigation context (search, folder, browse) into URL parameters
 *  - Decode context from URL params to reconstruct return URL and label
 *  - Save and restore scroll position via sessionStorage
 */

export type ContextType = "search" | "folder" | "browse" | "library";

export interface ReturnContext {
  type: ContextType;
  /** Human-readable label for the back button (e.g. "Back to search: vacation") */
  label: string;
  /** The URL to return to */
  returnUrl: string;
}

// ── sessionStorage helpers ────────────────────────────────────────────────────

const SCROLL_KEY_PREFIX = "iris-scroll:";

/**
 * Save scroll position keyed by the return URL so it can be restored later.
 */
export function saveScrollPosition(returnUrl: string, scrollTop: number): void {
  try {
    sessionStorage.setItem(`${SCROLL_KEY_PREFIX}${returnUrl}`, String(scrollTop));
  } catch {
    // sessionStorage may be unavailable in some environments
  }
}

/**
 * Retrieve a previously saved scroll position for a return URL.
 * Returns null if not found.
 */
export function getScrollPosition(returnUrl: string): number | null {
  try {
    const value = sessionStorage.getItem(`${SCROLL_KEY_PREFIX}${returnUrl}`);
    if (value === null) return null;
    const n = parseInt(value, 10);
    return isNaN(n) ? null : n;
  } catch {
    return null;
  }
}

// ── Context label generation ──────────────────────────────────────────────────

/**
 * Generate a human-readable back button label from context type and URL params.
 */
function buildContextLabel(from: ContextType, params: URLSearchParams): string {
  if (from === "search") {
    const q = params.get("q");
    if (q) return `Back to search: "${q}"`;
    return "Back to search results";
  }

  if (from === "folder") {
    const folderPath = params.get("folderPath");
    if (folderPath) {
      // Get just the last non-empty path segment
      const name = folderPath.split("/").filter(Boolean).pop();
      if (name) return `Back to ${name}`;
    }
    return "Back to folder";
  }

  if (from === "browse") {
    const camera = params.get("camera");
    if (camera) return `Back to browse: ${camera}`;
    return "Back to browse";
  }

  return "Back to library";
}

// ── Return URL reconstruction ─────────────────────────────────────────────────

/**
 * Reconstruct the return URL from the context params embedded in the
 * image detail URL. This is used both for the back button and for restoring
 * scroll position after returning.
 */
function buildReturnUrl(from: ContextType, params: URLSearchParams): string {
  if (from === "search") {
    const p = new URLSearchParams();
    const copy = (key: string) => {
      const v = params.get(key);
      if (v) p.set(key, v);
    };
    copy("q");
    copy("camera");
    copy("lens");
    copy("dateFrom");
    copy("dateTo");
    copy("format");
    copy("minSize");
    copy("maxSize");
    copy("sort");
    const order = params.get("order");
    if (order && order !== "desc") p.set("order", order);
    const page = params.get("page");
    if (page && page !== "1") p.set("page", page);
    const qs = p.toString();
    return `/search${qs ? `?${qs}` : ""}`;
  }

  if (from === "folder") {
    return "/folders";
  }

  if (from === "browse") {
    const p = new URLSearchParams();
    const copy = (key: string) => {
      const v = params.get(key);
      if (v) p.set(key, v);
    };
    copy("camera");
    copy("lens");
    copy("format");
    copy("dateFrom");
    copy("dateTo");
    copy("focalLengthMin");
    copy("focalLengthMax");
    copy("isoMin");
    copy("isoMax");
    const page = params.get("page");
    if (page && page !== "1") p.set("page", page);
    const qs = p.toString();
    return `/browse${qs ? `?${qs}` : ""}`;
  }

  return "/";
}

// ── Context encoding ──────────────────────────────────────────────────────────

/**
 * Build the URL for navigating to an image detail with full context information
 * encoded as URL parameters so state is preserved across page refreshes.
 *
 * @param imageId  - The image ID
 * @param from     - The context type (search / folder / browse)
 * @param contextParams - URLSearchParams from the originating page
 */
export function buildImageDetailUrl(
  imageId: number,
  from: ContextType,
  contextParams: URLSearchParams
): string {
  const params = new URLSearchParams();
  params.set("from", from);

  // Copy all context-specific params
  for (const [key, value] of contextParams.entries()) {
    params.set(key, value);
  }

  return `/image/${imageId}?${params.toString()}`;
}

// ── Context decoding ──────────────────────────────────────────────────────────

/**
 * Parse the return context from the current URL (used when on /image/:id).
 * Returns null if no context is available (e.g. direct deep link without params).
 */
export function parseReturnContext(): ReturnContext | null {
  const params = new URLSearchParams(window.location.search);
  const from = params.get("from") as ContextType | null;

  if (!from || !["search", "folder", "browse", "library"].includes(from)) {
    return null;
  }

  const returnUrl = buildReturnUrl(from, params);
  const label = buildContextLabel(from, params);

  return { type: from, label, returnUrl };
}

// ── Folder state preservation ─────────────────────────────────────────────────

const FOLDER_RESTORE_KEY = "iris-restore-folder";

export interface FolderRestoreState {
  sourceId: number;
  path: string;
  sourceName: string;
  sort: string;
  order: string;
  page: number;
}

/**
 * Save folder selection state so it can be restored when navigating back.
 */
export function saveFolderState(state: FolderRestoreState): void {
  try {
    sessionStorage.setItem(FOLDER_RESTORE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

/**
 * Retrieve saved folder state (used on FolderPage mount when returning from detail).
 * Clears the stored state after reading so it's only applied once.
 */
export function popFolderRestoreState(): FolderRestoreState | null {
  try {
    const raw = sessionStorage.getItem(FOLDER_RESTORE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(FOLDER_RESTORE_KEY);
    return JSON.parse(raw) as FolderRestoreState;
  } catch {
    return null;
  }
}
