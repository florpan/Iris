import type { Context } from "hono";

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;

export interface PaginationParams {
  page: number;
  pageSize: number;
  offset: number;
}

export interface PaginationMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Parse pagination query params from request context.
 * Accepts ?page=1&pageSize=50 — clamps pageSize to [1, MAX_PAGE_SIZE].
 */
export function parsePagination(c: Context): PaginationParams {
  const pageRaw = Number(c.req.query("page") ?? "1");
  const pageSizeRaw = Number(
    c.req.query("pageSize") ?? String(DEFAULT_PAGE_SIZE)
  );

  const page = Math.max(1, Number.isFinite(pageRaw) ? Math.floor(pageRaw) : 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number.isFinite(pageSizeRaw) ? Math.floor(pageSizeRaw) : DEFAULT_PAGE_SIZE)
  );

  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
  };
}

/**
 * Build a pagination metadata object from total count + parsed params.
 */
export function buildPaginationMeta(
  total: number,
  params: PaginationParams
): PaginationMeta {
  return {
    total,
    page: params.page,
    pageSize: params.pageSize,
    totalPages: Math.ceil(total / params.pageSize),
  };
}

/**
 * Return a paginated JSON response: { data: T[], pagination: PaginationMeta }
 */
export function paginatedResponse<T>(
  c: Context,
  data: T[],
  total: number,
  params: PaginationParams
) {
  return c.json({
    data,
    pagination: buildPaginationMeta(total, params),
  });
}
