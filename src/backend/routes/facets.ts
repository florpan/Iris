import { Hono } from "hono";
import { and, eq, gte, lte, isNotNull, ne, sql, type SQL } from "drizzle-orm";
import { db } from "../db/client";
import { images } from "../db/schema";

export const facetsRouter = new Hono();

// ── Types ─────────────────────────────────────────────────────────────────────

interface FacetValue {
  value: string;
  count: number;
}

interface DateFacetValue {
  year: number;
  month?: number;
  count: number;
}

interface RangeFacetValue {
  label: string;
  min: number | null;
  max: number | null;
  count: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build the base WHERE conditions from filter params.
 * Same filters as the search endpoint, used to make facet counts context-sensitive.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildBaseConditions(params: {
  camera?: string;
  lens?: string;
  dateFrom?: string;
  dateTo?: string;
  format?: string;
  focalLengthMin?: string;
  focalLengthMax?: string;
  isoMin?: string;
  isoMax?: string;
}): SQL[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: SQL<any>[] = [eq(images.missing, false)];

  if (params.camera) {
    conditions.push(eq(images.cameraModel, params.camera));
  }
  if (params.lens) {
    conditions.push(eq(images.lensModel, params.lens));
  }
  if (params.dateFrom) {
    const d = new Date(params.dateFrom);
    if (!isNaN(d.getTime())) conditions.push(gte(images.takenAt, d));
  }
  if (params.dateTo) {
    const d = new Date(params.dateTo);
    if (!isNaN(d.getTime())) {
      d.setHours(23, 59, 59, 999);
      conditions.push(lte(images.takenAt, d));
    }
  }
  if (params.format) {
    conditions.push(eq(images.mimeType, params.format));
  }
  if (params.focalLengthMin) {
    const v = Number(params.focalLengthMin);
    if (Number.isFinite(v)) conditions.push(gte(images.focalLength, v));
  }
  if (params.focalLengthMax) {
    const v = Number(params.focalLengthMax);
    if (Number.isFinite(v)) conditions.push(lte(images.focalLength, v));
  }
  if (params.isoMin) {
    const v = Number(params.isoMin);
    if (Number.isFinite(v)) conditions.push(gte(images.iso, v));
  }
  if (params.isoMax) {
    const v = Number(params.isoMax);
    if (Number.isFinite(v)) conditions.push(lte(images.iso, v));
  }

  return conditions;
}

// ── Routes ────────────────────────────────────────────────────────────────────

/**
 * GET /api/facets — returns facet counts for browsing.
 *
 * Accepts the same filter parameters as search. Facet counts reflect the
 * currently applied filters (minus the filter for the facet itself), so
 * selecting a camera updates lens counts to only show lenses used with that camera.
 *
 * Query params (all optional):
 *   camera         — exact camera model filter
 *   lens           — exact lens model filter
 *   dateFrom       — ISO date string
 *   dateTo         — ISO date string
 *   format         — MIME type filter
 *   focalLengthMin — minimum focal length (mm)
 *   focalLengthMax — maximum focal length (mm)
 *   isoMin         — minimum ISO
 *   isoMax         — maximum ISO
 */
facetsRouter.get("/", async (c) => {
  const params = {
    camera: c.req.query("camera")?.trim() ?? "",
    lens: c.req.query("lens")?.trim() ?? "",
    dateFrom: c.req.query("dateFrom")?.trim() ?? "",
    dateTo: c.req.query("dateTo")?.trim() ?? "",
    format: c.req.query("format")?.trim() ?? "",
    focalLengthMin: c.req.query("focalLengthMin")?.trim() ?? "",
    focalLengthMax: c.req.query("focalLengthMax")?.trim() ?? "",
    isoMin: c.req.query("isoMin")?.trim() ?? "",
    isoMax: c.req.query("isoMax")?.trim() ?? "",
  };

  // Base conditions without any specific facet's own filter
  // When computing counts for facet X, we exclude X's own filter so users
  // can see all available values for X given the other selected filters.

  const baseWithoutCamera = buildBaseConditions({ ...params, camera: "" });
  const baseWithoutLens = buildBaseConditions({ ...params, lens: "" });
  const baseWithoutFormat = buildBaseConditions({ ...params, format: "" });
  const baseWithoutDate = buildBaseConditions({ ...params, dateFrom: "", dateTo: "" });
  const baseWithoutFocalLength = buildBaseConditions({ ...params, focalLengthMin: "", focalLengthMax: "" });
  const baseWithoutIso = buildBaseConditions({ ...params, isoMin: "", isoMax: "" });

  // ── Camera facet ─────────────────────────────────────────────────────────

  const cameraRows = await db
    .select({
      value: images.cameraModel,
      count: sql<number>`cast(count(*) as integer)`,
    })
    .from(images)
    .where(and(...baseWithoutCamera, isNotNull(images.cameraModel), ne(images.cameraModel, "")))
    .groupBy(images.cameraModel)
    .orderBy(sql`count(*) DESC`)
    .limit(50);

  const cameraFacets: FacetValue[] = cameraRows
    .filter((r): r is { value: string; count: number } => r.value !== null && r.value !== "")
    .map((r) => ({ value: r.value, count: r.count }));

  // ── Lens facet ───────────────────────────────────────────────────────────

  const lensRows = await db
    .select({
      value: images.lensModel,
      count: sql<number>`cast(count(*) as integer)`,
    })
    .from(images)
    .where(and(...baseWithoutLens, isNotNull(images.lensModel), ne(images.lensModel, "")))
    .groupBy(images.lensModel)
    .orderBy(sql`count(*) DESC`)
    .limit(50);

  const lensFacets: FacetValue[] = lensRows
    .filter((r): r is { value: string; count: number } => r.value !== null && r.value !== "")
    .map((r) => ({ value: r.value, count: r.count }));

  // ── Format facet ─────────────────────────────────────────────────────────

  const formatRows = await db
    .select({
      value: images.mimeType,
      count: sql<number>`cast(count(*) as integer)`,
    })
    .from(images)
    .where(and(...baseWithoutFormat, isNotNull(images.mimeType), ne(images.mimeType, "")))
    .groupBy(images.mimeType)
    .orderBy(sql`count(*) DESC`);

  const formatFacets: FacetValue[] = formatRows
    .filter((r): r is { value: string; count: number } => r.value !== null && r.value !== "")
    .map((r) => ({ value: r.value, count: r.count }));

  // ── Year/Month facet ──────────────────────────────────────────────────────
  // Group by year, then if a year is selected also by month

  const yearRows = await db
    .select({
      year: sql<number>`EXTRACT(YEAR FROM ${images.takenAt})::integer`,
      count: sql<number>`cast(count(*) as integer)`,
    })
    .from(images)
    .where(and(...baseWithoutDate, isNotNull(images.takenAt)))
    .groupBy(sql`EXTRACT(YEAR FROM ${images.takenAt})`)
    .orderBy(sql`EXTRACT(YEAR FROM ${images.takenAt}) DESC`);

  const yearFacets: DateFacetValue[] = yearRows
    .filter((r) => r.year !== null)
    .map((r) => ({ year: r.year, count: r.count }));

  // If dateFrom and dateTo narrow to a single year, also return monthly breakdown
  let monthFacets: DateFacetValue[] = [];
  const fromYear = params.dateFrom ? new Date(params.dateFrom).getFullYear() : null;
  const toYear = params.dateTo ? new Date(params.dateTo).getFullYear() : null;
  const singleYearSelected = fromYear !== null && toYear !== null && fromYear === toYear;
  const yearFilterOnly = params.dateFrom && !params.dateTo && !params.dateTo;
  if (singleYearSelected || (yearFilterOnly && fromYear)) {
    const baseForMonths = buildBaseConditions({ ...params, dateFrom: "", dateTo: "" });
    const targetYear = fromYear!;
    const monthRows = await db
      .select({
        year: sql<number>`EXTRACT(YEAR FROM ${images.takenAt})::integer`,
        month: sql<number>`EXTRACT(MONTH FROM ${images.takenAt})::integer`,
        count: sql<number>`cast(count(*) as integer)`,
      })
      .from(images)
      .where(
        and(
          ...baseForMonths,
          isNotNull(images.takenAt),
          sql`EXTRACT(YEAR FROM ${images.takenAt}) = ${targetYear}`
        )
      )
      .groupBy(
        sql`EXTRACT(YEAR FROM ${images.takenAt})`,
        sql`EXTRACT(MONTH FROM ${images.takenAt})`
      )
      .orderBy(sql`EXTRACT(MONTH FROM ${images.takenAt}) DESC`);

    monthFacets = monthRows
      .filter((r) => r.year !== null && r.month !== null)
      .map((r) => ({ year: r.year, month: r.month, count: r.count }));
  }

  // ── Focal length facet (bucketed ranges) ──────────────────────────────────

  const focalLengthBuckets: Array<{ label: string; min: number | null; max: number | null }> = [
    { label: "Ultra-wide (< 18mm)", min: null, max: 18 },
    { label: "Wide (18–35mm)", min: 18, max: 35 },
    { label: "Normal (35–70mm)", min: 35, max: 70 },
    { label: "Short tele (70–135mm)", min: 70, max: 135 },
    { label: "Tele (135–300mm)", min: 135, max: 300 },
    { label: "Super-tele (> 300mm)", min: 300, max: null },
  ];

  const focalLengthFacets: RangeFacetValue[] = await Promise.all(
    focalLengthBuckets.map(async (bucket) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const conds: SQL<any>[] = [
        ...baseWithoutFocalLength,
        isNotNull(images.focalLength),
      ];
      if (bucket.min !== null) conds.push(gte(images.focalLength, bucket.min));
      if (bucket.max !== null) conds.push(sql`${images.focalLength} < ${bucket.max}`);

      const [row] = await db
        .select({ count: sql<number>`cast(count(*) as integer)` })
        .from(images)
        .where(and(...conds));
      return { ...bucket, count: row?.count ?? 0 };
    })
  );

  // ── ISO facet (bucketed ranges) ───────────────────────────────────────────

  const isoBuckets: Array<{ label: string; min: number | null; max: number | null }> = [
    { label: "Low (≤ 200)", min: null, max: 200 },
    { label: "Base (200–400)", min: 200, max: 400 },
    { label: "Medium (400–800)", min: 400, max: 800 },
    { label: "High (800–3200)", min: 800, max: 3200 },
    { label: "Very high (> 3200)", min: 3200, max: null },
  ];

  const isoFacets: RangeFacetValue[] = await Promise.all(
    isoBuckets.map(async (bucket) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const conds: SQL<any>[] = [
        ...baseWithoutIso,
        isNotNull(images.iso),
      ];
      if (bucket.min !== null) conds.push(gte(images.iso, bucket.min));
      if (bucket.max !== null) conds.push(sql`${images.iso} < ${bucket.max}`);

      const [row] = await db
        .select({ count: sql<number>`cast(count(*) as integer)` })
        .from(images)
        .where(and(...conds));
      return { ...bucket, count: row?.count ?? 0 };
    })
  );

  // ── Total count with all filters applied ─────────────────────────────────

  const allConditions = buildBaseConditions(params);
  const [totalRow] = await db
    .select({ count: sql<number>`cast(count(*) as integer)` })
    .from(images)
    .where(and(...allConditions));

  return c.json({
    data: {
      total: totalRow?.count ?? 0,
      camera: cameraFacets,
      lens: lensFacets,
      format: formatFacets,
      year: yearFacets,
      month: monthFacets,
      focalLength: focalLengthFacets.filter((f) => f.count > 0),
      iso: isoFacets.filter((f) => f.count > 0),
    },
  });
});
