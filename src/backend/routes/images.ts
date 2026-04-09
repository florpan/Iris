import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { and, eq, gte, isNotNull, lte, sql, ilike, like, type SQL } from "drizzle-orm";
import * as fs from "node:fs";
import * as path from "node:path";
import { db } from "../db/client";
import { images, sourceFolders } from "../db/schema";
import { parsePagination, paginatedResponse } from "../lib/pagination";
import { loadConfig } from "../lib/config";

export const imagesRouter = new Hono();

// ── GPS endpoint ──────────────────────────────────────────────────────────────

/**
 * GET /api/images/gps — return all GPS-tagged images matching optional filters.
 *
 * This endpoint is used by the map view to plot images on a Leaflet map.
 * It returns up to GPS_LIMIT images (no pagination — all needed for markers).
 *
 * Also returns:
 *   - `total`: total images matching the filter (with or without GPS)
 *   - `gpsCount`: images matching the filter that have GPS data
 *
 * Filter params:
 *   sourceId   — restrict to a single source folder (integer)
 *   folderPath — restrict to a specific folder within the source (requires sourceId)
 *   q          — full-text search query (filename, IPTC fields)
 *   camera     — camera model filter (partial, case-insensitive)
 *   lens       — lens model filter (partial, case-insensitive)
 *   dateFrom   — ISO date filter: takenAt >= dateFrom
 *   dateTo     — ISO date filter: takenAt <= dateTo
 *   format     — MIME type filter (exact)
 *   minSize    — minimum file size in bytes
 *   maxSize    — maximum file size in bytes
 */

const GPS_LIMIT = 5000;

imagesRouter.get("/gps", async (c) => {
  const sourceId = c.req.query("sourceId") ? Number(c.req.query("sourceId")) : null;
  const folderPath = c.req.query("folderPath") ?? null;
  const q = c.req.query("q") ?? "";
  const camera = c.req.query("camera") ?? "";
  const lens = c.req.query("lens") ?? "";
  const dateFrom = c.req.query("dateFrom") ?? "";
  const dateTo = c.req.query("dateTo") ?? "";
  const format = c.req.query("format") ?? "";
  const minSize = c.req.query("minSize") ? Number(c.req.query("minSize")) : null;
  const maxSize = c.req.query("maxSize") ? Number(c.req.query("maxSize")) : null;

  // Build shared filter conditions (no GPS requirement — used for total count)
  const baseConditions: SQL[] = [];

  if (sourceId !== null && Number.isFinite(sourceId)) {
    baseConditions.push(eq(images.sourceFolderId, sourceId));

    if (folderPath !== null) {
      if (folderPath === "") {
        // Root of the source: files not in any subdirectory
        baseConditions.push(
          sql`${images.relativePath} NOT LIKE '%/%'`
        );
      } else {
        // Only direct children of folderPath
        baseConditions.push(
          like(images.relativePath, `${folderPath}/%`)
        );
        baseConditions.push(
          sql`${images.relativePath} NOT LIKE ${folderPath + "/%/%"}`
        );
      }
    }
  }

  if (camera) {
    baseConditions.push(ilike(images.cameraModel, `%${camera}%`));
  }
  if (lens) {
    baseConditions.push(ilike(images.lensModel, `%${lens}%`));
  }
  if (dateFrom) {
    baseConditions.push(gte(images.takenAt, new Date(dateFrom)));
  }
  if (dateTo) {
    baseConditions.push(lte(images.takenAt, new Date(dateTo)));
  }
  if (format) {
    baseConditions.push(eq(images.mimeType, format));
  }
  if (minSize !== null && Number.isFinite(minSize)) {
    baseConditions.push(gte(images.fileSize, minSize));
  }
  if (maxSize !== null && Number.isFinite(maxSize)) {
    baseConditions.push(lte(images.fileSize, maxSize));
  }

  // Full-text search filter (simple ilike on fileName + iptcTitle)
  if (q) {
    const searchVector = sql<string>`(
      setweight(to_tsvector('simple', coalesce(${images.fileName}, '')), 'B') ||
      setweight(to_tsvector('simple', coalesce(${images.iptcTitle}, '')), 'A') ||
      setweight(to_tsvector('simple', coalesce(${images.iptcDescription}, '')), 'B') ||
      setweight(to_tsvector('simple', coalesce(
        (SELECT string_agg(kw, ' ') FROM jsonb_array_elements_text(${images.iptcKeywords}) AS kw),
        ''
      )), 'B')
    )`;
    const tsQuery = q
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w.replace(/[^a-zA-Z0-9_]/g, "") + ":*")
      .join(" & ");
    if (tsQuery) {
      baseConditions.push(sql`${searchVector} @@ to_tsquery('simple', ${tsQuery})`);
    }
  }

  const gpsConditions = [
    ...baseConditions,
    isNotNull(images.latitude),
    isNotNull(images.longitude),
  ];

  const whereBase = baseConditions.length > 0 ? and(...baseConditions) : undefined;
  const whereGps = and(...gpsConditions);

  const [totalResult, gpsCountResult, rows] = await Promise.all([
    db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(images)
      .where(whereBase),
    db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(images)
      .where(whereGps),
    db
      .select({
        id: images.id,
        fileName: images.fileName,
        thumbnailPath: images.thumbnailPath,
        latitude: images.latitude,
        longitude: images.longitude,
      })
      .from(images)
      .where(whereGps)
      .orderBy(images.takenAt)
      .limit(GPS_LIMIT),
  ]);

  const total = totalResult[0]?.count ?? 0;
  const gpsCount = gpsCountResult[0]?.count ?? 0;

  return c.json({
    data: rows,
    total,
    gpsCount,
    limit: GPS_LIMIT,
    truncated: gpsCount > GPS_LIMIT,
  });
});

// RAW file extensions that need preview extraction / conversion
const RAW_EXTENSIONS = new Set([
  ".cr2",
  ".cr3",
  ".nef",
  ".arw",
  ".orf",
  ".rw2",
  ".dng",
  ".raf",
  ".pef",
  ".srw",
  ".x3f",
  ".3fr",
  ".mef",
  ".mrw",
]);

/**
 * Determine whether a file path is a RAW image format.
 */
function isRawFile(filePath: string): boolean {
  return RAW_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

/**
 * GET /api/images — paginated image listing.
 */
imagesRouter.get("/", async (c) => {
  const pagination = parsePagination(c);

  const [countResult, rows] = await Promise.all([
    db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(images),
    db
      .select()
      .from(images)
      .orderBy(images.takenAt)
      .limit(pagination.pageSize)
      .offset(pagination.offset),
  ]);

  const total = countResult[0]?.count ?? 0;
  return paginatedResponse(c, rows, total, pagination);
});

/**
 * GET /api/images/:id — single image metadata.
 */
imagesRouter.get("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) {
    throw new HTTPException(400, { message: "Invalid image ID" });
  }

  const [image] = await db.select().from(images).where(eq(images.id, id));
  if (!image) {
    throw new HTTPException(404, { message: "Image not found" });
  }

  return c.json({ data: image });
});

/**
 * GET /api/images/:id/original — stream original file from source folder.
 * For RAW files, attempts to extract the embedded JPEG preview via exifr,
 * or converts using sharp if available. Falls back to streaming the raw binary
 * only for non-RAW formats.
 */
imagesRouter.get("/:id/original", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) {
    throw new HTTPException(400, { message: "Invalid image ID" });
  }

  // Fetch image + its source folder in one query
  const [row] = await db
    .select({
      image: images,
      source: sourceFolders,
    })
    .from(images)
    .innerJoin(sourceFolders, eq(images.sourceFolderId, sourceFolders.id))
    .where(eq(images.id, id));

  if (!row) {
    throw new HTTPException(404, { message: "Image not found" });
  }

  if (!row.source.enabled) {
    throw new HTTPException(503, {
      message: `Source folder '${row.source.name}' is currently unavailable`,
    });
  }

  const absolutePath = path.join(row.source.path, row.image.relativePath);

  // Verify the file exists and is accessible
  if (!fs.existsSync(absolutePath)) {
    throw new HTTPException(404, {
      message: "Image file not found on disk",
    });
  }

  const ext = path.extname(absolutePath).toLowerCase();

  // ── RAW file handling ──────────────────────────────────────────────────────
  if (isRawFile(absolutePath)) {
    // Attempt to extract embedded JPEG preview using exifr (if installed)
    try {
      // Dynamic import so the server starts even if exifr is not yet installed
      const exifr = await import("exifr");
      const jpegPreview = await exifr.thumbnailBuffer(absolutePath);

      if (jpegPreview) {
        return new Response(jpegPreview, {
          headers: {
            "Content-Type": "image/jpeg",
            "Content-Length": String(jpegPreview.byteLength),
            "Cache-Control": "public, max-age=3600",
            "X-Image-Source": "raw-preview",
          },
        });
      }
    } catch {
      // exifr not available or thumbnail extraction failed — fall through
    }

    // Attempt server-side conversion using sharp (if installed)
    try {
      const sharp = (await import("sharp")).default;
      const jpegBuffer = await sharp(absolutePath)
        .jpeg({ quality: 90 })
        .toBuffer();

      return new Response(jpegBuffer, {
        headers: {
          "Content-Type": "image/jpeg",
          "Content-Length": String(jpegBuffer.byteLength),
          "Cache-Control": "public, max-age=3600",
          "X-Image-Source": "raw-converted",
        },
      });
    } catch {
      // sharp not available — return 415 Unsupported Media Type
      throw new HTTPException(415, {
        message:
          "RAW file preview not available. Install 'exifr' and 'sharp' to enable RAW support.",
      });
    }
  }

  // ── Standard image file streaming ─────────────────────────────────────────
  const mimeType = row.image.mimeType ?? mimeTypeFromExt(ext) ?? "application/octet-stream";
  const stat = fs.statSync(absolutePath);
  const fileStream = fs.createReadStream(absolutePath);

  return new Response(fileStream as unknown as ReadableStream, {
    headers: {
      "Content-Type": mimeType,
      "Content-Length": String(stat.size),
      "Cache-Control": "public, max-age=3600",
      "X-Image-Source": "original",
    },
  });
});

/**
 * GET /api/images/:id/thumb — serve thumbnail from work folder with cache headers.
 * Thumbnails are WebP by default. Returns 404 if not yet generated.
 */
imagesRouter.get("/:id/thumb", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) {
    throw new HTTPException(400, { message: "Invalid image ID" });
  }

  const [image] = await db
    .select({ id: images.id, thumbnailPath: images.thumbnailPath })
    .from(images)
    .where(eq(images.id, id));

  if (!image) {
    throw new HTTPException(404, { message: "Image not found" });
  }

  if (!image.thumbnailPath) {
    throw new HTTPException(404, {
      message: "Thumbnail not yet generated for this image",
    });
  }

  const workDir = loadConfig().workFolder;
  const absoluteThumbPath = path.isAbsolute(image.thumbnailPath)
    ? image.thumbnailPath
    : path.join(workDir, image.thumbnailPath);

  if (!fs.existsSync(absoluteThumbPath)) {
    throw new HTTPException(404, { message: "Thumbnail file not found on disk" });
  }

  const ext = path.extname(absoluteThumbPath).toLowerCase();
  const mimeType =
    ext === ".webp" ? "image/webp"
    : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg"
    : ext === ".png" ? "image/png"
    : "image/webp";

  const stat = fs.statSync(absoluteThumbPath);
  const etag = `"${image.id}-${stat.mtimeMs}"`;

  // ETag-based conditional request
  const ifNoneMatch = c.req.header("if-none-match");
  if (ifNoneMatch === etag) {
    return new Response(null, { status: 304 });
  }

  const fileStream = fs.createReadStream(absoluteThumbPath);

  return new Response(fileStream as unknown as ReadableStream, {
    headers: {
      "Content-Type": mimeType,
      "Content-Length": String(stat.size),
      // Thumbnails are immutable once written — cache aggressively
      "Cache-Control": "public, max-age=604800, immutable",
      ETag: etag,
      "Last-Modified": new Date(stat.mtimeMs).toUTCString(),
    },
  });
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function mimeTypeFromExt(ext: string): string | undefined {
  const map: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".avif": "image/avif",
    ".tiff": "image/tiff",
    ".tif": "image/tiff",
    ".heic": "image/heic",
    ".heif": "image/heif",
  };
  return map[ext.toLowerCase()];
}
