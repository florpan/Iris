import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { eq } from "drizzle-orm";
import * as fs from "node:fs";
import * as path from "node:path";
import { db } from "../db/client";
import { images } from "../db/schema";

export const thumbsRouter = new Hono();

const WORK_DIR = process.env.WORK_DIR ?? "./work";

// Cache for 7 days — thumbnails are immutable once generated
const THUMB_CACHE_CONTROL = "public, max-age=604800, immutable";

/**
 * GET /api/images/:id/thumb — serve thumbnail from work folder.
 * Thumbnails are WebP by default. Returns 404 if not yet generated.
 */
thumbsRouter.get("/:id/thumb", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) {
    throw new HTTPException(400, { message: "Invalid image ID" });
  }

  const [image] = await db
    .select({
      id: images.id,
      thumbnailPath: images.thumbnailPath,
    })
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

  const absoluteThumbPath = path.isAbsolute(image.thumbnailPath)
    ? image.thumbnailPath
    : path.join(WORK_DIR, image.thumbnailPath);

  if (!fs.existsSync(absoluteThumbPath)) {
    throw new HTTPException(404, {
      message: "Thumbnail file not found on disk",
    });
  }

  const ext = path.extname(absoluteThumbPath).toLowerCase();
  const mimeType = ext === ".webp" ? "image/webp"
    : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg"
    : ext === ".png" ? "image/png"
    : "image/webp";

  const stat = fs.statSync(absoluteThumbPath);
  const etag = `"${image.id}-${stat.mtimeMs}"`;

  // ETag-based conditional request support
  const ifNoneMatch = c.req.header("if-none-match");
  if (ifNoneMatch === etag) {
    return new Response(null, { status: 304 });
  }

  const fileStream = fs.createReadStream(absoluteThumbPath);

  return new Response(fileStream as unknown as ReadableStream, {
    headers: {
      "Content-Type": mimeType,
      "Content-Length": String(stat.size),
      "Cache-Control": THUMB_CACHE_CONTROL,
      ETag: etag,
      "Last-Modified": new Date(stat.mtimeMs).toUTCString(),
    },
  });
});
