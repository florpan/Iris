import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { and, eq, sql, desc, asc, like, notLike } from "drizzle-orm";
import { db } from "../db/client";
import { images, sourceFolders } from "../db/schema";
import { parsePagination, paginatedResponse } from "../lib/pagination";

export const foldersRouter = new Hono();

// ── Types ────────────────────────────────────────────────────────────────────

interface FolderNode {
  name: string;
  path: string;
  directCount: number;
  totalCount: number;
  children: FolderNode[];
}

interface SourceFolderTree {
  id: number;
  name: string;
  sourcePath: string;
  enabled: boolean;
  directCount: number;
  totalCount: number;
  children: FolderNode[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * SQL expression that extracts the directory portion of a relative path.
 * e.g. "2023/summer/photo.jpg" → "2023/summer"
 *      "photo.jpg"             → ""
 */
const dirPathExpr = sql<string>`
  CASE
    WHEN ${images.relativePath} LIKE '%/%'
    THEN regexp_replace(${images.relativePath}, '/[^/]+$', '')
    ELSE ''
  END
`;

/**
 * Recursively build a FolderNode tree from a flat set of directory paths.
 */
function buildFolderTree(
  parentPath: string,
  allPaths: Set<string>,
  countByPath: Map<string, number>
): FolderNode[] {
  const directChildren = Array.from(allPaths).filter((p) => {
    if (parentPath === "") {
      return !p.includes("/");
    }
    return (
      p.startsWith(parentPath + "/") &&
      !p.slice(parentPath.length + 1).includes("/")
    );
  });

  directChildren.sort();

  return directChildren.map((childPath) => {
    const childName = childPath.split("/").pop()!;
    const directCount = countByPath.get(childPath) ?? 0;
    const children = buildFolderTree(childPath, allPaths, countByPath);
    const totalCount =
      directCount + children.reduce((sum, c) => sum + c.totalCount, 0);

    return { name: childName, path: childPath, directCount, totalCount, children };
  });
}

// ── Routes ────────────────────────────────────────────────────────────────────

/**
 * GET /api/folders — folder tree with image counts for all source folders.
 *
 * Returns an array of source-level nodes. Each node contains:
 *  - id, name, sourcePath, enabled
 *  - directCount: images directly in the source root
 *  - totalCount: all images within this source (recursive)
 *  - children: recursive FolderNode tree
 */
foldersRouter.get("/", async (c) => {
  const sources = await db
    .select()
    .from(sourceFolders)
    .orderBy(sourceFolders.name);

  // Aggregate image counts by (sourceFolderId, dirPath)
  const dirCountRows = await db
    .select({
      sourceFolderId: images.sourceFolderId,
      dirPath: dirPathExpr,
      count: sql<number>`cast(count(*) as integer)`,
    })
    .from(images)
    .where(eq(images.missing, false))
    .groupBy(images.sourceFolderId, dirPathExpr);

  const result: SourceFolderTree[] = sources.map((source) => {
    const rows = dirCountRows.filter((d) => d.sourceFolderId === source.id);

    // Map path → direct image count
    const countByPath = new Map<string, number>(
      rows.map((r) => [r.dirPath, r.count])
    );

    // Collect all unique directory paths + their ancestors
    const allPaths = new Set<string>();
    for (const r of rows) {
      if (r.dirPath === "") continue;
      const parts = r.dirPath.split("/");
      for (let i = 1; i <= parts.length; i++) {
        allPaths.add(parts.slice(0, i).join("/"));
      }
    }

    const children = buildFolderTree("", allPaths, countByPath);
    const directCount = countByPath.get("") ?? 0;
    const totalCount =
      directCount + children.reduce((sum, c) => sum + c.totalCount, 0);

    return {
      id: source.id,
      name: source.name,
      sourcePath: source.path,
      enabled: source.enabled,
      directCount,
      totalCount,
      children,
    };
  });

  return c.json({ data: result });
});

/**
 * GET /api/folders/:sourceId/images — paginated images in a specific folder.
 *
 * Query params:
 *   path      — folder path within the source (default: "" = root)
 *   sort      — name | date | size | format (default: date)
 *   order     — asc | desc (default: desc)
 *   page      — page number (default: 1)
 *   pageSize  — items per page (default: 50, max: 200)
 *
 * Only direct children of `path` are returned — not recursive.
 */
foldersRouter.get("/:sourceId/images", async (c) => {
  const sourceId = Number(c.req.param("sourceId"));
  if (!Number.isFinite(sourceId) || sourceId <= 0) {
    throw new HTTPException(400, { message: "Invalid source ID" });
  }

  const [source] = await db
    .select({ id: sourceFolders.id })
    .from(sourceFolders)
    .where(eq(sourceFolders.id, sourceId));

  if (!source) {
    throw new HTTPException(404, { message: "Source folder not found" });
  }

  const folderPath = c.req.query("path") ?? "";
  const sort = c.req.query("sort") ?? "date";
  const order = c.req.query("order") ?? "desc";

  const pagination = parsePagination(c);

  // Filter to direct images only (not recursive into sub-directories)
  const pathFilter =
    folderPath === ""
      ? notLike(images.relativePath, "%/%")
      : and(
          like(images.relativePath, folderPath + "/%"),
          notLike(images.relativePath, folderPath + "/%/%")
        );

  const whereClause = and(
    eq(images.sourceFolderId, sourceId),
    eq(images.missing, false),
    pathFilter
  );

  // Build ORDER BY
  const sortFn = order === "asc" ? asc : desc;
  let orderByCol;
  switch (sort) {
    case "name":
      orderByCol = sortFn(images.fileName);
      break;
    case "size":
      orderByCol = sortFn(images.fileSize);
      break;
    case "format":
      orderByCol = sortFn(images.mimeType);
      break;
    default: // "date"
      orderByCol = sortFn(images.takenAt);
      break;
  }

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
      })
      .from(images)
      .where(whereClause)
      .orderBy(orderByCol)
      .limit(pagination.pageSize)
      .offset(pagination.offset),
  ]);

  const total = countResult[0]?.count ?? 0;
  return paginatedResponse(c, rows, total, pagination);
});
