import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { and, eq, gte, lte, sql, desc, asc, ilike, type SQL } from "drizzle-orm";
import { db } from "../db/client";
import { images } from "../db/schema";
import { parsePagination, paginatedResponse } from "../lib/pagination";

export const searchRouter = new Hono();

// ── Types ─────────────────────────────────────────────────────────────────────

type SortField = "relevance" | "date" | "name" | "size";
type SortOrder = "asc" | "desc";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a tsquery from a plain text query string.
 * Splits on whitespace and joins with & (AND semantics).
 * Falls back to prefix search for partial word matching.
 */
function buildTsQuery(q: string): string {
  return q
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.replace(/[^a-zA-Z0-9_]/g, "") + ":*")
    .join(" & ");
}

/**
 * Build the tsvector expression matching what the GIN index uses.
 */
const searchVector = sql<string>`(
  setweight(to_tsvector('simple', coalesce(${images.fileName}, '')), 'B') ||
  setweight(to_tsvector('simple', coalesce(${images.iptcTitle}, '')), 'A') ||
  setweight(to_tsvector('simple', coalesce(${images.iptcDescription}, '')), 'B') ||
  setweight(to_tsvector('simple', coalesce(
    (SELECT string_agg(kw, ' ') FROM jsonb_array_elements_text(${images.iptcKeywords}) AS kw),
    ''
  )), 'B')
)`;

// ── Routes ─────────────────────────────────────────────────────────────────────

/**
 * GET /api/search — search images by text and/or structured filters.
 *
 * Query params:
 *   q          — full-text search query (filename, IPTC title, description, keywords)
 *   camera     — camera model filter (partial match, case-insensitive)
 *   lens       — lens model filter (partial match, case-insensitive)
 *   dateFrom   — ISO date string, filter takenAt >= dateFrom
 *   dateTo     — ISO date string, filter takenAt <= dateTo
 *   format     — MIME type filter (e.g. "image/jpeg")
 *   minWidth   — minimum image width in pixels
 *   maxWidth   — maximum image width in pixels
 *   minHeight  — minimum image height in pixels
 *   maxHeight  — maximum image height in pixels
 *   minSize         — minimum file size in bytes
 *   maxSize         — maximum file size in bytes
 *   focalLengthMin  — minimum focal length in mm
 *   focalLengthMax  — maximum focal length in mm
 *   isoMin          — minimum ISO value
 *   isoMax          — maximum ISO value
 *   sort       — relevance | date | name | size (default: relevance when q set, else date)
 *   order      — asc | desc (default: desc)
 *   page       — page number (default: 1)
 *   pageSize   — items per page (default: 50, max: 200)
 */
searchRouter.get("/", async (c) => {
  const q = c.req.query("q")?.trim() ?? "";
  const camera = c.req.query("camera")?.trim() ?? "";
  const lens = c.req.query("lens")?.trim() ?? "";
  const dateFrom = c.req.query("dateFrom")?.trim() ?? "";
  const dateTo = c.req.query("dateTo")?.trim() ?? "";
  const format = c.req.query("format")?.trim() ?? "";
  const minWidth = c.req.query("minWidth");
  const maxWidth = c.req.query("maxWidth");
  const minHeight = c.req.query("minHeight");
  const maxHeight = c.req.query("maxHeight");
  const minSize = c.req.query("minSize");
  const maxSize = c.req.query("maxSize");
  const focalLengthMin = c.req.query("focalLengthMin");
  const focalLengthMax = c.req.query("focalLengthMax");
  const isoMin = c.req.query("isoMin");
  const isoMax = c.req.query("isoMax");

  const defaultSort: SortField = q ? "relevance" : "date";
  const sortRaw = (c.req.query("sort") ?? defaultSort) as SortField;
  const sort: SortField = ["relevance", "date", "name", "size"].includes(sortRaw)
    ? sortRaw
    : defaultSort;
  const orderRaw = (c.req.query("order") ?? "desc") as SortOrder;
  const order: SortOrder = orderRaw === "asc" ? "asc" : "desc";

  const pagination = parsePagination(c);

  // Require at least one search parameter
  if (!q && !camera && !lens && !dateFrom && !dateTo && !format &&
    !minWidth && !maxWidth && !minHeight && !maxHeight && !minSize && !maxSize &&
    !focalLengthMin && !focalLengthMax && !isoMin && !isoMax) {
    throw new HTTPException(400, { message: "At least one search parameter is required" });
  }

  // ── Build WHERE conditions ─────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: SQL<any>[] = [];

  // Only non-missing images
  conditions.push(eq(images.missing, false));

  // Full-text search
  let tsQuery: string | null = null;
  if (q) {
    tsQuery = buildTsQuery(q);
    if (tsQuery) {
      conditions.push(
        sql`${searchVector} @@ to_tsquery('simple', ${tsQuery})`
      );
    }
  }

  // Camera model (case-insensitive partial match)
  if (camera) {
    conditions.push(ilike(images.cameraModel, `%${camera}%`));
  }

  // Lens model (case-insensitive partial match)
  if (lens) {
    conditions.push(ilike(images.lensModel, `%${lens}%`));
  }

  // Date range
  if (dateFrom) {
    const d = new Date(dateFrom);
    if (!isNaN(d.getTime())) {
      conditions.push(gte(images.takenAt, d));
    }
  }
  if (dateTo) {
    const d = new Date(dateTo);
    if (!isNaN(d.getTime())) {
      // Include end of day
      d.setHours(23, 59, 59, 999);
      conditions.push(lte(images.takenAt, d));
    }
  }

  // Format (MIME type)
  if (format) {
    conditions.push(ilike(images.mimeType, `%${format}%`));
  }

  // Dimension filters
  if (minWidth) {
    const v = Number(minWidth);
    if (Number.isFinite(v)) conditions.push(gte(images.width, v));
  }
  if (maxWidth) {
    const v = Number(maxWidth);
    if (Number.isFinite(v)) conditions.push(lte(images.width, v));
  }
  if (minHeight) {
    const v = Number(minHeight);
    if (Number.isFinite(v)) conditions.push(gte(images.height, v));
  }
  if (maxHeight) {
    const v = Number(maxHeight);
    if (Number.isFinite(v)) conditions.push(lte(images.height, v));
  }

  // File size filters
  if (minSize) {
    const v = Number(minSize);
    if (Number.isFinite(v)) conditions.push(gte(images.fileSize, v));
  }
  if (maxSize) {
    const v = Number(maxSize);
    if (Number.isFinite(v)) conditions.push(lte(images.fileSize, v));
  }

  // Focal length filters
  if (focalLengthMin) {
    const v = Number(focalLengthMin);
    if (Number.isFinite(v)) conditions.push(gte(images.focalLength, v));
  }
  if (focalLengthMax) {
    const v = Number(focalLengthMax);
    if (Number.isFinite(v)) conditions.push(sql`${images.focalLength} < ${v}`);
  }

  // ISO filters
  if (isoMin) {
    const v = Number(isoMin);
    if (Number.isFinite(v)) conditions.push(gte(images.iso, v));
  }
  if (isoMax) {
    const v = Number(isoMax);
    if (Number.isFinite(v)) conditions.push(sql`${images.iso} < ${v}`);
  }

  const whereClause = and(...conditions);

  // ── Build ORDER BY ─────────────────────────────────────────────────────────

  const sortFn = order === "asc" ? asc : desc;

  let orderByExpr;
  switch (sort) {
    case "relevance":
      if (tsQuery) {
        // Sort by ts_rank_cd for relevance
        orderByExpr = sql`ts_rank_cd(${searchVector}, to_tsquery('simple', ${tsQuery})) DESC`;
      } else {
        orderByExpr = sortFn(images.takenAt);
      }
      break;
    case "name":
      orderByExpr = sortFn(images.fileName);
      break;
    case "size":
      orderByExpr = sortFn(images.fileSize);
      break;
    default: // "date"
      orderByExpr = sortFn(images.takenAt);
      break;
  }

  // ── Execute queries ────────────────────────────────────────────────────────

  const [countResult, rows] = await Promise.all([
    db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(images)
      .where(whereClause),
    db
      .select({
        id: images.id,
        fileName: images.fileName,
        relativePath: images.relativePath,
        thumbnailPath: images.thumbnailPath,
        takenAt: images.takenAt,
        width: images.width,
        height: images.height,
        fileSize: images.fileSize,
        mimeType: images.mimeType,
        cameraModel: images.cameraModel,
        lensModel: images.lensModel,
        iptcTitle: images.iptcTitle,
        iptcDescription: images.iptcDescription,
        iptcKeywords: images.iptcKeywords,
      })
      .from(images)
      .where(whereClause)
      .orderBy(orderByExpr)
      .limit(pagination.pageSize)
      .offset(pagination.offset),
  ]);

  const total = countResult[0]?.count ?? 0;
  return paginatedResponse(c, rows, total, pagination);
});

/**
 * GET /api/search/suggestions — get unique values for autocomplete.
 *
 * Query params:
 *   field — "camera" | "lens" | "format" (required)
 *   q     — optional prefix filter
 */
searchRouter.get("/suggestions", async (c) => {
  const field = c.req.query("field");
  const q = c.req.query("q")?.trim() ?? "";

  if (!field || !["camera", "lens", "format"].includes(field)) {
    throw new HTTPException(400, { message: "field must be one of: camera, lens, format" });
  }

  let col;
  switch (field) {
    case "camera":
      col = images.cameraModel;
      break;
    case "lens":
      col = images.lensModel;
      break;
    default: // "format"
      col = images.mimeType;
      break;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const whereConditions: SQL<any>[] = [
    eq(images.missing, false),
    sql`${col} IS NOT NULL`,
    sql`${col} != ''`,
  ];

  if (q) {
    whereConditions.push(ilike(col, `%${q}%`));
  }

  const rows = await db
    .selectDistinct({ value: col })
    .from(images)
    .where(and(...whereConditions))
    .orderBy(asc(col))
    .limit(20);

  const suggestions = rows
    .map((r) => r.value)
    .filter((v): v is string => v !== null && v !== "");

  return c.json({ data: suggestions });
});
