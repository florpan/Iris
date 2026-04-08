/**
 * scanner.ts
 *
 * Recursive directory scanner that discovers all supported image files within
 * a source folder hierarchy. Handles format detection, incremental change
 * tracking, and missing file detection.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { db } from "../db/client";
import { images, sourceFolders } from "../db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { extractMetadata } from "./metadata";

// ── Supported formats ────────────────────────────────────────────────────────

/** Standard raster image extensions */
const STANDARD_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".tiff",
  ".tif",
  ".webp",
  ".heic",
  ".heif",
  ".avif",
  ".bmp",
  ".gif",
]);

/** Camera RAW file extensions */
const RAW_EXTENSIONS = new Set([
  ".cr2",  // Canon
  ".cr3",  // Canon (newer)
  ".nef",  // Nikon
  ".arw",  // Sony
  ".orf",  // Olympus
  ".raf",  // Fujifilm
  ".dng",  // Adobe DNG (universal RAW)
  ".rw2",  // Panasonic
  ".pef",  // Pentax
  ".srw",  // Samsung
  ".x3f",  // Sigma
  ".3fr",  // Hasselblad
  ".mef",  // Mamiya
  ".mrw",  // Minolta
]);

const ALL_SUPPORTED_EXTENSIONS = new Set([
  ...STANDARD_EXTENSIONS,
  ...RAW_EXTENSIONS,
]);

/** MIME type mapping for standard extensions */
const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".tiff": "image/tiff",
  ".tif": "image/tiff",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".avif": "image/avif",
  ".bmp": "image/bmp",
  ".gif": "image/gif",
  ".cr2": "image/x-canon-cr2",
  ".cr3": "image/x-canon-cr3",
  ".nef": "image/x-nikon-nef",
  ".arw": "image/x-sony-arw",
  ".orf": "image/x-olympus-orf",
  ".raf": "image/x-fuji-raf",
  ".dng": "image/x-adobe-dng",
  ".rw2": "image/x-panasonic-rw2",
  ".pef": "image/x-pentax-pef",
  ".srw": "image/x-samsung-srw",
  ".x3f": "image/x-sigma-x3f",
  ".3fr": "image/x-hasselblad-3fr",
  ".mef": "image/x-mamiya-mef",
  ".mrw": "image/x-minolta-mrw",
};

// ── Scan state ───────────────────────────────────────────────────────────────

export type ScanStatus = "idle" | "scanning" | "error";

export interface ScanProgress {
  status: ScanStatus;
  sourceId?: number;
  sourceName?: string;
  scanned: number;
  total: number;
  added: number;
  updated: number;
  skipped: number;
  missing: number;
  errors: string[];
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
}

// Singleton scan state — tracks the currently running scan
let currentScan: ScanProgress = { status: "idle", scanned: 0, total: 0, added: 0, updated: 0, skipped: 0, missing: 0, errors: [] };
let scanRunning = false;

export function getScanProgress(): ScanProgress {
  return { ...currentScan };
}

// ── File discovery ───────────────────────────────────────────────────────────

/**
 * Recursively walk a directory and collect all supported image files.
 * Returns an array of absolute file paths.
 */
function walkDirectory(dir: string): string[] {
  const results: string[] = [];

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results; // Directory not readable — skip silently
  }

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue; // Skip hidden files/dirs

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      results.push(...walkDirectory(fullPath));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (ALL_SUPPORTED_EXTENSIONS.has(ext)) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

/**
 * Check whether a file is a camera RAW format.
 */
export function isRawFile(filePath: string): boolean {
  return RAW_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

/**
 * Get MIME type for a given file path.
 */
export function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] ?? "application/octet-stream";
}

// ── Scan a single source folder ──────────────────────────────────────────────

/**
 * Scan a single source folder: discover images, extract metadata, upsert
 * records, detect missing files.
 */
async function scanSource(source: { id: number; path: string; name: string }): Promise<void> {
  currentScan.sourceId = source.id;
  currentScan.sourceName = source.name;

  // Verify source is accessible
  try {
    fs.accessSync(source.path, fs.constants.R_OK);
  } catch {
    currentScan.errors.push(`Source '${source.name}' is not accessible at path: ${source.path}`);
    return;
  }

  // Discover all image files in the directory tree
  const absolutePaths = walkDirectory(source.path);
  currentScan.total += absolutePaths.length;

  // Fetch existing records for this source (for incremental scan)
  const existingRecords = await db
    .select({
      id: images.id,
      relativePath: images.relativePath,
      fileSize: images.fileSize,
      fileModifiedAt: images.fileModifiedAt,
    })
    .from(images)
    .where(eq(images.sourceFolderId, source.id));

  const existingByPath = new Map(existingRecords.map((r) => [r.relativePath, r]));

  // Track which relative paths we discovered on disk (for missing detection)
  const discoveredRelativePaths = new Set<string>();

  for (const absolutePath of absolutePaths) {
    const relativePath = path.relative(source.path, absolutePath);
    discoveredRelativePaths.add(relativePath);

    try {
      const stat = fs.statSync(absolutePath);
      const existing = existingByPath.get(relativePath);

      // Incremental scan: skip unchanged files
      if (existing && existing.fileSize === stat.size) {
        const existingMtime = existing.fileModifiedAt?.getTime();
        const currentMtime = stat.mtime.getTime();
        if (existingMtime && Math.abs(existingMtime - currentMtime) < 1000) {
          currentScan.skipped++;
          currentScan.scanned++;
          continue;
        }
      }

      // Extract metadata (new or changed file)
      const meta = await extractMetadata(absolutePath);

      const ext = path.extname(absolutePath).toLowerCase();
      const fileName = path.basename(absolutePath);
      const mimeType = getMimeType(absolutePath);

      const record = {
        sourceFolderId: source.id,
        relativePath,
        fileName,
        fileSize: stat.size,
        fileModifiedAt: stat.mtime,
        mimeType,
        // Dimensions
        width: meta.width ?? null,
        height: meta.height ?? null,
        // EXIF
        takenAt: meta.takenAt ?? null,
        cameraModel: meta.cameraModel ?? null,
        lensModel: meta.lensModel ?? null,
        iso: meta.iso ?? null,
        aperture: meta.aperture ?? null,
        shutterSpeed: meta.shutterSpeed ?? null,
        focalLength: meta.focalLength ?? null,
        // GPS
        latitude: meta.latitude ?? null,
        longitude: meta.longitude ?? null,
        altitude: meta.altitude ?? null,
        // IPTC
        iptcTitle: meta.iptcTitle ?? null,
        iptcDescription: meta.iptcDescription ?? null,
        iptcKeywords: meta.iptcKeywords ?? null,
        iptcCopyright: meta.iptcCopyright ?? null,
        // Raw metadata blob
        metadata: meta.raw ?? null,
        // Mark as indexed and not missing
        indexed: true,
        indexedAt: new Date(),
        missing: false,
        updatedAt: new Date(),
      };

      if (existing) {
        // Update existing record
        await db
          .update(images)
          .set(record)
          .where(eq(images.id, existing.id));
        currentScan.updated++;
      } else {
        // Insert new record
        await db.insert(images).values(record);
        currentScan.added++;
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      currentScan.errors.push(`Failed to process ${relativePath}: ${errMsg}`);
    }

    currentScan.scanned++;
  }

  // ── Missing file detection ──────────────────────────────────────────────────
  // Files that were previously indexed but not found on disk get flagged as
  // missing. They are NOT deleted — the image may be on an unmounted network
  // share or removable drive.
  const missingRecords = existingRecords.filter(
    (r) => !discoveredRelativePaths.has(r.relativePath)
  );

  if (missingRecords.length > 0) {
    const missingIds = missingRecords.map((r) => r.id);
    await db
      .update(images)
      .set({ missing: true, updatedAt: new Date() })
      .where(inArray(images.id, missingIds));
    currentScan.missing += missingRecords.length;
  }
}

// ── Public scan API ──────────────────────────────────────────────────────────

/**
 * Trigger a scan for a specific source folder, or all sources if sourceId
 * is not provided.
 *
 * Runs asynchronously in the background. Returns immediately.
 * Use getScanProgress() to poll status.
 */
export async function triggerScan(sourceId?: number): Promise<{ started: boolean; reason?: string }> {
  if (scanRunning) {
    return { started: false, reason: "A scan is already in progress" };
  }

  // Fetch sources to scan
  let sources: Array<{ id: number; path: string; name: string }>;
  try {
    if (sourceId !== undefined) {
      const [source] = await db
        .select({ id: sourceFolders.id, path: sourceFolders.path, name: sourceFolders.name })
        .from(sourceFolders)
        .where(and(eq(sourceFolders.id, sourceId), eq(sourceFolders.enabled, true)));
      if (!source) {
        return { started: false, reason: `Source ${sourceId} not found or disabled` };
      }
      sources = [source];
    } else {
      sources = await db
        .select({ id: sourceFolders.id, path: sourceFolders.path, name: sourceFolders.name })
        .from(sourceFolders)
        .where(eq(sourceFolders.enabled, true));
    }
  } catch (err) {
    return { started: false, reason: `Database error: ${err instanceof Error ? err.message : String(err)}` };
  }

  if (sources.length === 0) {
    return { started: false, reason: "No enabled source folders found" };
  }

  // Reset progress state
  currentScan = {
    status: "scanning",
    scanned: 0,
    total: 0,
    added: 0,
    updated: 0,
    skipped: 0,
    missing: 0,
    errors: [],
    startedAt: new Date(),
  };
  scanRunning = true;

  // Run scan in background (fire-and-forget)
  (async () => {
    try {
      for (const source of sources) {
        await scanSource(source);
      }
      currentScan.status = "idle";
      currentScan.completedAt = new Date();
    } catch (err) {
      currentScan.status = "error";
      currentScan.errorMessage = err instanceof Error ? err.message : String(err);
      currentScan.completedAt = new Date();
    } finally {
      scanRunning = false;
    }
  })();

  return { started: true };
}
