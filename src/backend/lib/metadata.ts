/**
 * metadata.ts
 *
 * Metadata extraction for image files using exifr.
 * Handles EXIF, IPTC, XMP, GPS data from standard and RAW image formats.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface ExtractedMetadata {
  // Dimensions
  width?: number;
  height?: number;
  // EXIF — capture info
  takenAt?: Date;
  cameraModel?: string;
  cameraMake?: string;
  lensModel?: string;
  iso?: number;
  aperture?: number;     // F-number (e.g. 2.8)
  shutterSpeed?: string; // Human-readable (e.g. "1/250")
  focalLength?: number;  // mm
  // GPS
  latitude?: number;
  longitude?: number;
  altitude?: number;
  // IPTC
  iptcTitle?: string;
  iptcDescription?: string;
  iptcKeywords?: string[];
  iptcCopyright?: string;
  // Raw metadata blob (everything exifr extracted)
  raw?: Record<string, unknown>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parse a shutter speed (ExposureTime in seconds) into a human-readable string.
 * e.g. 0.004 → "1/250", 2.0 → "2"
 */
function formatShutterSpeed(exposureTime: number): string {
  if (exposureTime >= 1) {
    return String(Math.round(exposureTime));
  }
  const denominator = Math.round(1 / exposureTime);
  return `1/${denominator}`;
}

/**
 * Safely coerce a value to a number, returning undefined if invalid.
 */
function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

/**
 * Safely coerce a value to an integer.
 */
function toInt(value: unknown): number | undefined {
  const n = toNumber(value);
  if (n === undefined) return undefined;
  return Math.round(n);
}

/**
 * Safely coerce a value to a Date.
 */
function toDate(value: unknown): Date | undefined {
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d;
  }
  return undefined;
}

/**
 * Coerce IPTC keywords to a string array.
 * exifr may return a string, string[], or comma-separated string.
 */
function toKeywords(value: unknown): string[] | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) {
    return value.map(String).filter(Boolean);
  }
  if (typeof value === "string") {
    // Some IPTC implementations separate with semicolons or commas
    return value.split(/[,;]/).map((k) => k.trim()).filter(Boolean);
  }
  return undefined;
}

// ── Main extraction function ─────────────────────────────────────────────────

/** Camera RAW file extensions that exifr supports */
const RAW_EXTENSIONS = new Set([
  ".cr2", ".cr3",  // Canon
  ".nef",           // Nikon
  ".arw",           // Sony
  ".orf",           // Olympus
  ".raf",           // Fujifilm
  ".dng",           // Adobe DNG
  ".rw2",           // Panasonic
  ".pef",           // Pentax
  ".srw",           // Samsung
  ".x3f",           // Sigma
  ".3fr",           // Hasselblad
  ".mef",           // Mamiya
  ".mrw",           // Minolta
]);

import * as path from "node:path";

/**
 * Extract all available metadata from an image file.
 * Uses exifr for comprehensive EXIF/IPTC/XMP/GPS support.
 * Handles both standard formats (JPEG, PNG, TIFF, WebP, HEIC) and
 * camera RAW formats (CR2, CR3, NEF, ARW, ORF, RAF, DNG, RW2, etc.)
 *
 * Returns a structured metadata object. Gracefully handles errors — if
 * extraction fails, returns empty metadata without throwing.
 */
export async function extractMetadata(filePath: string): Promise<ExtractedMetadata> {
  const ext = path.extname(filePath).toLowerCase();
  const isRaw = RAW_EXTENSIONS.has(ext);

  try {
    // Dynamic import so server starts even if exifr is not installed
    const exifr = await import("exifr");

    // Parse ALL segments: EXIF, IPTC, XMP, GPS, ICC
    // For RAW files, exifr reads the embedded EXIF from the IFD structures
    // in the RAW container (TIFF-based formats like CR2, NEF, ARW, DNG).
    const raw = await exifr.parse(filePath, {
      tiff: true,
      exif: true,
      gps: true,
      iptc: true,
      xmp: true,
      icc: false,        // ICC color profile — not useful for our purposes
      jfif: false,
      ihdr: true,        // PNG image header (dimensions)
      translateKeys: true,
      translateValues: true,
      reviveValues: true,  // Convert dates to Date objects
      sanitize: true,
      mergeOutput: true,   // Flatten all segments into one object
    });

    if (!raw) {
      return {};
    }

    // ── Dimensions ────────────────────────────────────────────────────────────
    // For RAW files: ExifImageWidth/Height is the full-resolution dimension.
    // ImageWidth/Height in TIFF IFD can be the embedded thumbnail — avoid using
    // it for RAW files unless ExifImageWidth is not available.
    let width: number | undefined;
    let height: number | undefined;
    if (isRaw) {
      width = toInt(raw.ExifImageWidth ?? raw.PixelXDimension ?? raw.ImageWidth);
      height = toInt(raw.ExifImageHeight ?? raw.PixelYDimension ?? raw.ImageHeight);
    } else {
      width = toInt(raw.ImageWidth ?? raw.ExifImageWidth ?? raw.PixelXDimension);
      height = toInt(raw.ImageHeight ?? raw.ExifImageHeight ?? raw.PixelYDimension);
    }

    // ── Date/Time ─────────────────────────────────────────────────────────────
    // Prefer DateTimeOriginal (capture time), fall back to DateTime (file time)
    const takenAt = toDate(raw.DateTimeOriginal ?? raw.CreateDate ?? raw.DateTime);

    // ── Camera info ───────────────────────────────────────────────────────────
    const cameraMake = typeof raw.Make === "string" ? raw.Make.trim() : undefined;
    const cameraModelRaw = typeof raw.Model === "string" ? raw.Model.trim() : undefined;

    // Combine make and model if make isn't already part of model string
    let cameraModel: string | undefined;
    if (cameraModelRaw && cameraMake) {
      cameraModel = cameraModelRaw.toLowerCase().startsWith(cameraMake.toLowerCase())
        ? cameraModelRaw
        : `${cameraMake} ${cameraModelRaw}`;
    } else {
      cameraModel = cameraModelRaw ?? cameraMake;
    }

    const lensModel = typeof raw.LensModel === "string"
      ? raw.LensModel.trim()
      : typeof raw.Lens === "string"
        ? raw.Lens.trim()
        : undefined;

    // ── Exposure ──────────────────────────────────────────────────────────────
    const iso = toInt(raw.ISO ?? raw.ISOSpeedRatings);

    const aperture = toNumber(raw.FNumber ?? raw.ApertureValue);

    let shutterSpeed: string | undefined;
    const exposureTime = toNumber(raw.ExposureTime);
    if (exposureTime !== undefined && exposureTime > 0) {
      shutterSpeed = formatShutterSpeed(exposureTime);
    } else if (typeof raw.ShutterSpeedValue === "number") {
      // APEX shutter speed — convert: 2^(-ShutterSpeedValue) seconds
      const seconds = Math.pow(2, -raw.ShutterSpeedValue);
      shutterSpeed = formatShutterSpeed(seconds);
    }

    const focalLength = toNumber(raw.FocalLength);

    // ── GPS ───────────────────────────────────────────────────────────────────
    // exifr returns latitude/longitude as decimal degrees when reviveValues=true
    const latitude = toNumber(raw.latitude ?? raw.GPSLatitude);
    const longitude = toNumber(raw.longitude ?? raw.GPSLongitude);
    const altitude = toNumber(raw.GPSAltitude);

    // ── IPTC ─────────────────────────────────────────────────────────────────
    const iptcTitle = typeof raw.ObjectName === "string" && raw.ObjectName.trim()
      ? raw.ObjectName.trim()
      : typeof raw.title === "string" && raw.title.trim()
        ? raw.title.trim()
        : undefined;

    const iptcDescription = typeof raw.Caption === "string" && raw.Caption.trim()
      ? raw.Caption.trim()
      : typeof raw["Caption-Abstract"] === "string" && raw["Caption-Abstract"].trim()
        ? raw["Caption-Abstract"].trim()
        : typeof raw.description === "string" && raw.description.trim()
          ? raw.description.trim()
          : undefined;

    const iptcKeywords = toKeywords(raw.Keywords ?? raw.keywords);

    const iptcCopyright = typeof raw.Copyright === "string" && raw.Copyright.trim()
      ? raw.Copyright.trim()
      : typeof raw.Rights === "string" && raw.Rights.trim()
        ? raw.Rights.trim()
        : undefined;

    // ── Build raw blob ────────────────────────────────────────────────────────
    // Strip any binary/buffer values before storing as JSON
    const rawBlob: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(raw)) {
      if (
        value instanceof Uint8Array ||
        value instanceof ArrayBuffer ||
        Buffer.isBuffer(value)
      ) {
        continue; // Skip binary data
      }
      rawBlob[key] = value;
    }

    return {
      width,
      height,
      takenAt,
      cameraModel,
      cameraMake,
      lensModel,
      iso,
      aperture,
      shutterSpeed,
      focalLength,
      latitude,
      longitude,
      altitude,
      iptcTitle,
      iptcDescription,
      iptcKeywords,
      iptcCopyright,
      raw: rawBlob,
    };
  } catch {
    // Extraction failed (file format not supported, corrupt file, etc.)
    // Return empty metadata — the file will still be indexed by path/size
    return {};
  }
}
