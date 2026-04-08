import { Hono } from "hono";
import { loadConfig } from "../lib/config";
import * as fs from "node:fs";
import * as path from "node:path";

export const configRouter = new Hono();

/**
 * GET /api/config — read-only app configuration.
 * Returns configured sources (with availability status) and the work folder path.
 *
 * This endpoint reflects the file/env-based config, not the DB state.
 * It is intended for UI status display so users can see what Iris has configured.
 */
configRouter.get("/", (c) => {
  const config = loadConfig();
  const absWorkFolder = path.resolve(config.workFolder);

  // Check work folder availability
  let workFolderAvailable = false;
  let workFolderError: string | undefined;
  try {
    fs.accessSync(absWorkFolder, fs.constants.W_OK | fs.constants.R_OK);
    workFolderAvailable = true;
  } catch (err) {
    workFolderError = err instanceof Error ? err.message : "Work folder not accessible";
  }

  // Check source folder availability
  const sources = config.sources.map((source) => {
    const absPath = path.resolve(source.path);
    let available = false;
    let accessError: string | undefined;
    try {
      fs.accessSync(absPath, fs.constants.R_OK);
      available = true;
    } catch (err) {
      accessError = err instanceof Error ? err.message : "Path not accessible";
    }
    return {
      name: source.name,
      path: source.path,
      available,
      ...(accessError ? { error: accessError } : {}),
    };
  });

  return c.json({
    data: {
      workFolder: config.workFolder,
      workFolderAvailable,
      ...(workFolderError ? { workFolderError } : {}),
      sources,
      map: {
        tileUrl: config.mapTileUrl ?? null,
        tileAttribution: config.mapTileAttribution ?? null,
      },
      app: {
        name: "Iris",
        version: "0.1.0",
      },
    },
  });
});
