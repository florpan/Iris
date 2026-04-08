/**
 * thumbnails.ts
 *
 * API routes for thumbnail management.
 *
 * GET  /api/thumbnails/settings            — read current thumbnail settings
 * PUT  /api/thumbnails/settings            — update thumbnail settings
 * POST /api/thumbnails/regenerate          — trigger full batch regeneration
 * GET  /api/thumbnails/regenerate/status   — poll regeneration progress
 */

import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import {
  loadThumbnailSettings,
  saveThumbnailSettings,
  triggerRegeneration,
  getRegenerationProgress,
  type ThumbnailFormat,
} from "../lib/thumbnailer";

export const thumbnailsRouter = new Hono();

const VALID_FORMATS: ThumbnailFormat[] = ["webp", "jpeg", "avif"];

// ── Settings ──────────────────────────────────────────────────────────────────

/**
 * GET /api/thumbnails/settings
 * Returns current thumbnail generation settings (format, size).
 */
thumbnailsRouter.get("/settings", async (c) => {
  const s = await loadThumbnailSettings();
  return c.json({ data: s });
});

/**
 * PUT /api/thumbnails/settings
 * Update thumbnail settings. Accepts partial updates.
 *
 * Body: { format?: "webp" | "jpeg" | "avif", size?: number }
 */
thumbnailsRouter.put("/settings", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new HTTPException(400, { message: "Invalid JSON body" });
  }

  if (!body || typeof body !== "object") {
    throw new HTTPException(400, { message: "Request body must be an object" });
  }

  const input = body as Record<string, unknown>;
  const current = await loadThumbnailSettings();

  // Validate format if provided
  if ("format" in input) {
    if (!VALID_FORMATS.includes(input.format as ThumbnailFormat)) {
      throw new HTTPException(400, {
        message: `Invalid format '${input.format}'. Must be one of: ${VALID_FORMATS.join(", ")}`,
      });
    }
    current.format = input.format as ThumbnailFormat;
  }

  // Validate size if provided
  if ("size" in input) {
    const size = Number(input.size);
    if (!Number.isFinite(size) || size < 50 || size > 3000) {
      throw new HTTPException(400, {
        message: "Invalid size. Must be a number between 50 and 3000.",
      });
    }
    current.size = Math.round(size);
  }

  await saveThumbnailSettings(current);
  return c.json({ data: current });
});

// ── Regeneration ──────────────────────────────────────────────────────────────

/**
 * POST /api/thumbnails/regenerate
 * Trigger batch thumbnail regeneration for all indexed images.
 * Runs in the background. Returns 202 Accepted immediately.
 *
 * Useful after changing format or size settings.
 */
thumbnailsRouter.post("/regenerate", async (c) => {
  const result = await triggerRegeneration(true);

  if (!result.started) {
    return c.json({ error: result.reason ?? "Could not start regeneration" }, 409);
  }

  return c.json(
    {
      data: {
        message: "Thumbnail regeneration started",
        status: "running",
      },
    },
    202
  );
});

/**
 * GET /api/thumbnails/regenerate/status
 * Poll the current regeneration progress.
 */
thumbnailsRouter.get("/regenerate/status", (c) => {
  const progress = getRegenerationProgress();
  return c.json({ data: progress });
});
