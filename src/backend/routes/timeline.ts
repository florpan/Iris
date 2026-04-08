import { Hono } from "hono";
import { and, eq, gte, isNotNull, lte, sql, ilike, like, type SQL } from "drizzle-orm";
import { db } from "../db/client";
import { images } from "../db/schema";

export const timelineRouter = new Hono();

/**
 * GET /api/timeline — Return images grouped by date for the timeline view.
 *
 * Accepts the same filter params as /api/images/gps and /api/search:
 *   sourceId   — restrict to a single source folder (integer)
 *   folderPath — restrict to a specific folder within the source (requires sourceId)
 *   q          — full-text search query
 *   camera     — camera model filter (partial, case-insensitive)
 *   lens       — lens model filter (partial, case-insensitive)
 *   dateFrom   — ISO date filter: takenAt >= dateFrom
 *   dateTo     — ISO date filter: takenAt <= dateTo
 *   format     — MIME type filter (exact)
 *   minSize    — minimum file size in bytes
 *   maxSize    — maximum file size in bytes
 *   level      — grouping level: "year" | "month" | "day" (default: "month")
 *
 * Response shape:
 *   {
 *     level: "year" | "month" | "day",
 *     total: number,
 *     groups: Array<{
 *       key: string,           // "2023" | "2023-04" | "2023-04-15"
 *       year: number,
 *       month?: number,        // 1-12 (only for month/day level)
 *       day?: number,          // 1-31 (only for day level)
 *       label: string,         // human-readable label
 *       count: number,
 *       dateSource: "exif" | "file" | "mixed",
 *       representative: ImageItem | null,   // for year/month levels
 *       images: ImageItem[],               // full list for day level
 *     }>
 *   }
 */

interface ImageItem {
  id: number;
  fileName: string;
  thumbnailPath: string | null;
  takenAt: string | null;
  fileModifiedAt: string | null;
  dateSource: "exif" | "file";
}

type GroupLevel = "year" | "month" | "day";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function buildBaseConditions(params: {
  sourceId: number | null;
  folderPath: string | null;
  q: string;
  camera: string;
  lens: string;
  dateFrom: string;
  dateTo: string;
  format: string;
  minSize: number | null;
  maxSize: number | null;
}): SQL[] {
  const conditions: SQL[] = [];

  if (params.sourceId !== null && Number.isFinite(params.sourceId)) {
    conditions.push(eq(images.sourceFolderId, params.sourceId));

    if (params.folderPath !== null) {
      if (params.folderPath === "") {
        conditions.push(sql`${images.relativePath} NOT LIKE '%/%'`);
      } else {
        conditions.push(like(images.relativePath, `${params.folderPath}/%`));
        conditions.push(
          sql`${images.relativePath} NOT LIKE ${params.folderPath + "/%/%"}`
        );
      }
    }
  }

  if (params.camera) {
    conditions.push(ilike(images.cameraModel, `%${params.camera}%`));
  }
  if (params.lens) {
    conditions.push(ilike(images.lensModel, `%${params.lens}%`));
  }
  if (params.dateFrom) {
    conditions.push(gte(images.takenAt, new Date(params.dateFrom)));
  }
  if (params.dateTo) {
    conditions.push(lte(images.takenAt, new Date(params.dateTo)));
  }
  if (params.format) {
    conditions.push(eq(images.mimeType, params.format));
  }
  if (params.minSize !== null && Number.isFinite(params.minSize)) {
    conditions.push(gte(images.fileSize, params.minSize));
  }
  if (params.maxSize !== null && Number.isFinite(params.maxSize)) {
    conditions.push(lte(images.fileSize, params.maxSize));
  }

  if (params.q) {
    const searchVector = sql<string>`(
      setweight(to_tsvector('simple', coalesce(${images.fileName}, '')), 'B') ||
      setweight(to_tsvector('simple', coalesce(${images.iptcTitle}, '')), 'A') ||
      setweight(to_tsvector('simple', coalesce(${images.iptcDescription}, '')), 'B') ||
      setweight(to_tsvector('simple', coalesce(
        (SELECT string_agg(kw, ' ') FROM jsonb_array_elements_text(${images.iptcKeywords}) AS kw),
        ''
      )), 'B')
    )`;
    const tsQuery = params.q
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w.replace(/[^a-zA-Z0-9_]/g, "") + ":*")
      .join(" & ");
    if (tsQuery) {
      conditions.push(sql`${searchVector} @@ to_tsquery('simple', ${tsQuery})`);
    }
  }

  return conditions;
}

timelineRouter.get("/", async (c) => {
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
  const levelParam = c.req.query("level") ?? "month";
  const level: GroupLevel =
    levelParam === "year" || levelParam === "month" || levelParam === "day"
      ? levelParam
      : "month";

  const baseConditions = buildBaseConditions({
    sourceId, folderPath, q, camera, lens,
    dateFrom, dateTo, format, minSize, maxSize,
  });

  const whereClause = baseConditions.length > 0 ? and(...baseConditions) : undefined;

  // Fetch all matching images with just the fields we need
  // We use the effective date: takenAt if available, else fileModifiedAt
  const rows = await db
    .select({
      id: images.id,
      fileName: images.fileName,
      thumbnailPath: images.thumbnailPath,
      takenAt: images.takenAt,
      fileModifiedAt: images.fileModifiedAt,
    })
    .from(images)
    .where(whereClause)
    .orderBy(
      // Order by effective date ascending (oldest first)
      sql`COALESCE(${images.takenAt}, ${images.fileModifiedAt}) ASC NULLS LAST`
    );

  // Group images by the requested level
  type GroupKey = string;

  interface GroupData {
    key: GroupKey;
    year: number;
    month?: number;
    day?: number;
    label: string;
    count: number;
    exifCount: number;
    fileCount: number;
    representative: ImageItem | null;
    images: ImageItem[];
  }

  const groupMap = new Map<GroupKey, GroupData>();

  for (const row of rows) {
    const effectiveDate = row.takenAt ?? row.fileModifiedAt;
    const dateSource: "exif" | "file" = row.takenAt ? "exif" : "file";

    // Images with no date at all go into an "unknown" group
    let key: GroupKey;
    let year: number;
    let month: number | undefined;
    let day: number | undefined;
    let label: string;

    if (!effectiveDate) {
      key = "unknown";
      year = 0;
      label = "Unknown Date";
    } else {
      const d = new Date(effectiveDate);
      year = d.getFullYear();
      month = d.getMonth() + 1; // 1-12
      day = d.getDate();

      if (level === "year") {
        key = String(year);
        label = String(year);
        month = undefined;
        day = undefined;
      } else if (level === "month") {
        key = `${year}-${String(month).padStart(2, "0")}`;
        label = `${MONTH_NAMES[month - 1]} ${year}`;
        day = undefined;
      } else {
        // day level
        key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        label = new Date(year, month - 1, day).toLocaleDateString(undefined, {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
      }
    }

    const item: ImageItem = {
      id: row.id,
      fileName: row.fileName,
      thumbnailPath: row.thumbnailPath,
      takenAt: row.takenAt ? row.takenAt.toISOString() : null,
      fileModifiedAt: row.fileModifiedAt ? row.fileModifiedAt.toISOString() : null,
      dateSource,
    };

    if (!groupMap.has(key)) {
      groupMap.set(key, {
        key,
        year,
        month,
        day,
        label,
        count: 0,
        exifCount: 0,
        fileCount: 0,
        representative: null,
        images: [],
      });
    }

    const group = groupMap.get(key)!;
    group.count++;
    if (dateSource === "exif") {
      group.exifCount++;
    } else {
      group.fileCount++;
    }

    // For day level — collect all images (up to a reasonable limit per group)
    if (level === "day") {
      group.images.push(item);
    } else {
      // For year/month levels — keep a few representative thumbnails
      if (group.images.length < 6) {
        group.images.push(item);
      }
    }

    // First image with a thumbnail is the representative
    if (group.representative === null && item.thumbnailPath) {
      group.representative = item;
    }
  }

  // Convert map to sorted array
  const groups = Array.from(groupMap.values()).map((g) => ({
    key: g.key,
    year: g.year,
    month: g.month,
    day: g.day,
    label: g.label,
    count: g.count,
    dateSource: (
      g.exifCount > 0 && g.fileCount > 0 ? "mixed"
      : g.exifCount > 0 ? "exif"
      : "file"
    ) as "exif" | "file" | "mixed",
    representative: g.representative,
    images: g.images,
  }));

  // Sort: unknown group at end, rest by key
  groups.sort((a, b) => {
    if (a.key === "unknown") return 1;
    if (b.key === "unknown") return -1;
    return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
  });

  return c.json({
    level,
    total: rows.length,
    groups,
  });
});
