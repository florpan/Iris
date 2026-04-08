/**
 * thumbnailer.ts
 *
 * Thumbnail generation for Iris. Uses sharp for standard formats and
 * exifr for camera RAW embedded preview extraction.
 *
 * Work folder structure:
 *   <work>/<source-name>/<relative-path>/<filename>.thumb.<ext>
 *
 * Example:
 *   Source "NAS" at /mnt/nas/photos
 *   Image  /mnt/nas/photos/2024/vacation/IMG_001.CR2
 *   Thumb  <work>/nas/2024/vacation/IMG_001.thumb.webp
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { db } from "../db/client";
import { images, settings, sourceFolders } from "../db/schema";
import { eq, isNull, or } from "drizzle-orm";

// ── Thumbnail settings ────────────────────────────────────────────────────────

export type ThumbnailFormat = "webp" | "jpeg" | "avif";

export interface ThumbnailSettings {
  format: ThumbnailFormat;
  /** Longest side in pixels */
  size: number;
}

const DEFAULT_SETTINGS: ThumbnailSettings = {
  format: "webp",
  size: 400,
};

/** Load thumbnail settings from the DB settings table. Falls back to defaults. */
export async function loadThumbnailSettings(): Promise<ThumbnailSettings> {
  try {
    const rows = await db
      .select({ key: settings.key, value: settings.value })
      .from(settings)
      .where(
        eq(settings.key, "thumbnails")
      );

    if (rows.length > 0 && rows[0].value && typeof rows[0].value === "object") {
      const stored = rows[0].value as Partial<ThumbnailSettings>;
      return {
        format: isValidFormat(stored.format) ? stored.format : DEFAULT_SETTINGS.format,
        size: typeof stored.size === "number" && stored.size > 0 ? stored.size : DEFAULT_SETTINGS.size,
      };
    }
  } catch {
    // DB error — use defaults
  }
  return { ...DEFAULT_SETTINGS };
}

/** Persist thumbnail settings to the DB. */
export async function saveThumbnailSettings(s: ThumbnailSettings): Promise<void> {
  await db
    .insert(settings)
    .values({ key: "thumbnails", value: s, updatedAt: new Date() })
    .onConflictDoUpdate({ target: settings.key, set: { value: s, updatedAt: new Date() } });
}

function isValidFormat(v: unknown): v is ThumbnailFormat {
  return v === "webp" || v === "jpeg" || v === "avif";
}

// ── Path resolution ───────────────────────────────────────────────────────────

/**
 * Compute the thumbnail path (relative to work folder) for a given image.
 *
 * Pattern: <source-name-lower>/<relative-path-dir>/<basename>.thumb.<format>
 *
 * Example:
 *   sourceName   = "NAS"
 *   relativePath = "2024/vacation/IMG_001.CR2"
 *   format       = "webp"
 *   → "nas/2024/vacation/IMG_001.thumb.webp"
 */
export function resolveThumbnailRelativePath(
  sourceName: string,
  relativePath: string,
  format: ThumbnailFormat
): string {
  const sourceSlug = sourceName.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  const dir = path.dirname(relativePath);
  const base = path.basename(relativePath, path.extname(relativePath));
  const thumbName = `${base}.thumb.${format}`;
  const relDir = dir === "." ? sourceSlug : path.join(sourceSlug, dir);
  return path.join(relDir, thumbName);
}

/**
 * Compute the absolute path to a thumbnail file.
 */
export function resolveThumbnailAbsPath(
  workFolder: string,
  sourceName: string,
  relativePath: string,
  format: ThumbnailFormat
): string {
  const rel = resolveThumbnailRelativePath(sourceName, relativePath, format);
  return path.join(workFolder, rel);
}

// ── Camera RAW extension set ──────────────────────────────────────────────────

const RAW_EXTENSIONS = new Set([
  ".cr2", ".cr3",
  ".nef",
  ".arw",
  ".orf",
  ".raf",
  ".dng",
  ".rw2",
  ".pef",
  ".srw",
  ".x3f",
  ".3fr",
  ".mef",
  ".mrw",
]);

export function isRawFile(filePath: string): boolean {
  return RAW_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

// ── Sharp-based generation ────────────────────────────────────────────────────

/**
 * Generate a thumbnail from a standard image file using sharp.
 * Resizes to fit within `size` × `size` pixels (maintaining aspect ratio).
 */
async function generateWithSharp(
  sourcePath: string,
  destPath: string,
  thumbSettings: ThumbnailSettings
): Promise<void> {
  // Dynamic import — server starts even if sharp is not installed
  const sharp = (await import("sharp")).default;

  const pipeline = sharp(sourcePath).resize(thumbSettings.size, thumbSettings.size, {
    fit: "inside",
    withoutEnlargement: true,
  });

  switch (thumbSettings.format) {
    case "webp":
      pipeline.webp({ quality: 82, effort: 4 });
      break;
    case "jpeg":
      pipeline.jpeg({ quality: 85, mozjpeg: true });
      break;
    case "avif":
      pipeline.avif({ quality: 60, effort: 4 });
      break;
  }

  await pipeline.toFile(destPath);
}

// ── RAW thumbnail extraction ──────────────────────────────────────────────────

/**
 * Generate a thumbnail for a camera RAW file.
 *
 * Strategy:
 * 1. Try to extract the embedded JPEG preview using exifr.thumbnailBuffer().
 *    Most RAW files include a full-size or half-size JPEG preview in their
 *    EXIF/TIFF structure. This is fast and lossless for the preview.
 * 2. If no embedded preview is available, fall back to sharp (which uses
 *    libvips and can handle DNG / some RAW variants). Not all RAW formats
 *    are supported by sharp/libvips natively.
 * 3. If both fail, throw an error so the caller can decide whether to skip.
 */
async function generateRawThumbnail(
  sourcePath: string,
  destPath: string,
  thumbSettings: ThumbnailSettings
): Promise<void> {
  // ── Step 1: embedded JPEG preview via exifr ──────────────────────────────
  try {
    const exifr = await import("exifr");
    const previewBuffer = await exifr.thumbnailBuffer(sourcePath);

    if (previewBuffer && previewBuffer.byteLength > 0) {
      // We have an embedded JPEG preview — resize it with sharp
      const sharp = (await import("sharp")).default;
      const pipeline = sharp(Buffer.from(previewBuffer)).resize(
        thumbSettings.size,
        thumbSettings.size,
        { fit: "inside", withoutEnlargement: true }
      );

      applyFormat(pipeline, thumbSettings.format);
      await pipeline.toFile(destPath);
      return;
    }
  } catch {
    // exifr unavailable or preview extraction failed — fall through
  }

  // ── Step 2: sharp direct decode (works for DNG, some ARW/NEF) ──────────
  try {
    await generateWithSharp(sourcePath, destPath, thumbSettings);
    return;
  } catch {
    // sharp can't handle this RAW variant — give up
  }

  throw new Error(`No thumbnail strategy available for RAW file: ${path.basename(sourcePath)}`);
}

/** Apply output format to a sharp pipeline (mutates in place). */
function applyFormat(
  pipeline: import("sharp").Sharp,
  format: ThumbnailFormat
): void {
  switch (format) {
    case "webp":
      pipeline.webp({ quality: 82, effort: 4 });
      break;
    case "jpeg":
      pipeline.jpeg({ quality: 85, mozjpeg: true });
      break;
    case "avif":
      pipeline.avif({ quality: 60, effort: 4 });
      break;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface GenerateThumbnailOptions {
  /** Absolute path to the source image */
  sourcePath: string;
  /** Source folder name (used for work folder path) */
  sourceName: string;
  /** Path of the image relative to the source folder root */
  relativePath: string;
  /** Absolute path to the work folder */
  workFolder: string;
  /** Thumbnail settings (format, size) */
  thumbSettings: ThumbnailSettings;
  /** If true, regenerate even if thumb already exists (default: false) */
  force?: boolean;
}

export interface ThumbnailResult {
  /** Path of the generated thumbnail, relative to work folder */
  relativePath: string;
  /** True if the thumbnail was skipped (already exists, force=false) */
  skipped: boolean;
}

/**
 * Generate a thumbnail for a single image file.
 *
 * Returns the relative path (from work folder) where the thumbnail was written,
 * or where it already exists when skipped.
 */
export async function generateThumbnail(
  opts: GenerateThumbnailOptions
): Promise<ThumbnailResult> {
  const { sourcePath, sourceName, relativePath, workFolder, thumbSettings, force = false } = opts;

  const thumbRelPath = resolveThumbnailRelativePath(sourceName, relativePath, thumbSettings.format);
  const thumbAbsPath = path.join(workFolder, thumbRelPath);

  // ── Incremental: skip if already exists ─────────────────────────────────
  if (!force && fs.existsSync(thumbAbsPath)) {
    return { relativePath: thumbRelPath, skipped: true };
  }

  // Ensure destination directory exists
  fs.mkdirSync(path.dirname(thumbAbsPath), { recursive: true });

  // ── Generate ─────────────────────────────────────────────────────────────
  if (isRawFile(sourcePath)) {
    await generateRawThumbnail(sourcePath, thumbAbsPath, thumbSettings);
  } else {
    await generateWithSharp(sourcePath, thumbAbsPath, thumbSettings);
  }

  return { relativePath: thumbRelPath, skipped: false };
}

// ── Batch regeneration ────────────────────────────────────────────────────────

export interface RegenerationProgress {
  status: "idle" | "running" | "error";
  processed: number;
  total: number;
  errors: string[];
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
}

let regenState: RegenerationProgress = {
  status: "idle",
  processed: 0,
  total: 0,
  errors: [],
};
let regenRunning = false;

export function getRegenerationProgress(): RegenerationProgress {
  return { ...regenState };
}

/**
 * Trigger batch thumbnail regeneration for all indexed images.
 * Runs in the background. Call getRegenerationProgress() to poll status.
 *
 * @param force   Regenerate even if thumbnail already exists (default: true)
 */
export async function triggerRegeneration(force = true): Promise<{ started: boolean; reason?: string }> {
  if (regenRunning) {
    return { started: false, reason: "Regeneration already in progress" };
  }

  regenState = {
    status: "running",
    processed: 0,
    total: 0,
    errors: [],
    startedAt: new Date(),
  };
  regenRunning = true;

  // Fire-and-forget
  (async () => {
    try {
      const thumbSettings = await loadThumbnailSettings();

      // Fetch all indexed images with their source folder info
      const rows = await db
        .select({
          imageId: images.id,
          relativePath: images.relativePath,
          sourcePath: sourceFolders.path,
          sourceName: sourceFolders.name,
        })
        .from(images)
        .innerJoin(sourceFolders, eq(images.sourceFolderId, sourceFolders.id))
        .where(eq(images.indexed, true));

      regenState.total = rows.length;

      // Determine work folder from config
      const { loadConfig } = await import("./config");
      const config = loadConfig();
      const workFolder = path.resolve(config.workFolder);

      for (const row of rows) {
        const sourcePath = path.join(row.sourcePath, row.relativePath);

        if (!fs.existsSync(sourcePath)) {
          regenState.processed++;
          continue;
        }

        try {
          const result = await generateThumbnail({
            sourcePath,
            sourceName: row.sourceName,
            relativePath: row.relativePath,
            workFolder,
            thumbSettings,
            force,
          });

          // Update DB with thumbnail path
          await db
            .update(images)
            .set({ thumbnailPath: result.relativePath, updatedAt: new Date() })
            .where(eq(images.id, row.imageId));
        } catch (err) {
          regenState.errors.push(
            `Image ${row.imageId}: ${err instanceof Error ? err.message : String(err)}`
          );
        }

        regenState.processed++;
      }

      regenState.status = "idle";
      regenState.completedAt = new Date();
    } catch (err) {
      regenState.status = "error";
      regenState.errorMessage = err instanceof Error ? err.message : String(err);
      regenState.completedAt = new Date();
    } finally {
      regenRunning = false;
    }
  })();

  return { started: true };
}
