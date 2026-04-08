/**
 * Startup validation and setup for Iris.
 *
 * Called once at server startup to:
 *  1. Validate source folders (readable — logs warning, doesn't crash)
 *  2. Validate work folder (writable — fatal if inaccessible)
 *  3. Create work folder subdirectory structure: <work>/<source-name>/
 *  4. Sync configured sources to the database
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { loadConfig } from "./config";
import { db } from "../db/client";
import { sourceFolders } from "../db/schema";

export interface StartupResult {
  workFolder: string;
  sources: Array<{
    name: string;
    path: string;
    available: boolean;
    error?: string;
  }>;
  warnings: string[];
  fatalError?: string;
}

/**
 * Validate that a directory exists and is readable.
 */
function isReadable(dirPath: string): { ok: boolean; error?: string } {
  try {
    fs.accessSync(dirPath, fs.constants.R_OK);
    const stat = fs.statSync(dirPath);
    if (!stat.isDirectory()) {
      return { ok: false, error: `Path exists but is not a directory: ${dirPath}` };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : `Cannot read: ${dirPath}`,
    };
  }
}

/**
 * Validate that a directory exists and is writable.
 * Returns { ok: true } if writable, { ok: false, error } otherwise.
 */
function isWritable(dirPath: string): { ok: boolean; error?: string } {
  try {
    fs.accessSync(dirPath, fs.constants.W_OK | fs.constants.R_OK);
    const stat = fs.statSync(dirPath);
    if (!stat.isDirectory()) {
      return { ok: false, error: `Path exists but is not a directory: ${dirPath}` };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : `Cannot write: ${dirPath}`,
    };
  }
}

/**
 * Ensure a directory exists, creating it (recursively) if needed.
 * Returns { ok: true } on success or { ok: false, error } on failure.
 */
function ensureDir(dirPath: string): { ok: boolean; error?: string } {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : `Failed to create directory: ${dirPath}`,
    };
  }
}

/**
 * Run all startup checks and setup.
 *
 * - Validates work folder (creates if missing, logs fatal if cannot create/write)
 * - Creates per-source subdirectories under work folder
 * - Validates source folders (logs warning if missing, does NOT crash)
 * - Syncs sources to the database
 */
export async function runStartup(): Promise<StartupResult> {
  const config = loadConfig();
  const warnings: string[] = [];
  const result: StartupResult = {
    workFolder: config.workFolder,
    sources: [],
    warnings,
  };

  // ── Work folder ─────────────────────────────────────────────────────────────

  const absWorkFolder = path.resolve(config.workFolder);

  // Create if missing
  const mkResult = ensureDir(absWorkFolder);
  if (!mkResult.ok) {
    result.fatalError = `Work folder could not be created at "${absWorkFolder}": ${mkResult.error}`;
    console.error(`[startup] FATAL: ${result.fatalError}`);
    return result;
  }

  // Validate writable
  const writableCheck = isWritable(absWorkFolder);
  if (!writableCheck.ok) {
    result.fatalError = `Work folder "${absWorkFolder}" is not writable: ${writableCheck.error}`;
    console.error(`[startup] FATAL: ${result.fatalError}`);
    return result;
  }

  console.log(`[startup] Work folder OK: ${absWorkFolder}`);

  // ── Source folders ──────────────────────────────────────────────────────────

  for (const source of config.sources) {
    const absSourcePath = path.resolve(source.path);
    const readCheck = isReadable(absSourcePath);

    if (!readCheck.ok) {
      const warning = `Source "${source.name}" at "${absSourcePath}" is not readable: ${readCheck.error}`;
      console.warn(`[startup] WARNING: ${warning}`);
      warnings.push(warning);
      result.sources.push({
        name: source.name,
        path: source.path,
        available: false,
        error: readCheck.error,
      });
    } else {
      console.log(`[startup] Source "${source.name}" OK: ${absSourcePath}`);
      result.sources.push({
        name: source.name,
        path: source.path,
        available: true,
      });
    }

    // ── Create work subdirectory for this source (Task 3) ──────────────────
    const sourceWorkDir = path.join(absWorkFolder, source.name);
    const dirResult = ensureDir(sourceWorkDir);
    if (!dirResult.ok) {
      const warning = `Could not create work subdirectory for source "${source.name}" at "${sourceWorkDir}": ${dirResult.error}`;
      console.warn(`[startup] WARNING: ${warning}`);
      warnings.push(warning);
    } else {
      console.log(`[startup] Work subdir for "${source.name}": ${sourceWorkDir}`);
    }
  }

  // ── Sync sources to DB ──────────────────────────────────────────────────────
  await syncSourcesToDb(config.sources);

  return result;
}

/**
 * Sync the config-file sources to the database.
 * - Inserts new sources (by path)
 * - Re-enables previously disabled sources if they reappear in config
 * - Disables DB sources that are no longer in the config file
 */
async function syncSourcesToDb(
  sources: Array<{ name: string; path: string }>
): Promise<void> {
  try {
    const { eq, notInArray } = await import("drizzle-orm");

    // Get all existing DB sources
    const existing = await db.select().from(sourceFolders);
    const existingByPath = new Map(existing.map((s) => [s.path, s]));
    const configPaths = sources.map((s) => path.resolve(s.path));

    for (const source of sources) {
      const absPath = path.resolve(source.path);
      const existing = existingByPath.get(absPath);

      if (!existing) {
        // Insert new source
        await db.insert(sourceFolders).values({
          name: source.name,
          path: absPath,
          enabled: true,
        });
        console.log(`[startup] Registered new source "${source.name}" in DB`);
      } else if (!existing.enabled) {
        // Re-enable previously disabled source
        await db
          .update(sourceFolders)
          .set({ enabled: true, name: source.name })
          .where(eq(sourceFolders.id, existing.id));
        console.log(`[startup] Re-enabled source "${source.name}" in DB`);
      } else if (existing.name !== source.name) {
        // Update name if changed
        await db
          .update(sourceFolders)
          .set({ name: source.name })
          .where(eq(sourceFolders.id, existing.id));
      }
    }

    // Disable sources that are no longer in config
    if (configPaths.length > 0) {
      await db
        .update(sourceFolders)
        .set({ enabled: false })
        .where(notInArray(sourceFolders.path, configPaths));
    } else {
      // No sources configured — disable all
      await db.update(sourceFolders).set({ enabled: false });
    }
  } catch (err) {
    // DB sync failure is non-fatal — log and continue
    console.warn(
      "[startup] DB source sync failed (non-fatal):",
      err instanceof Error ? err.message : err
    );
  }
}
