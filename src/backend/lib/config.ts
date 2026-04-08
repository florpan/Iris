/**
 * Iris configuration loader.
 *
 * Config priority (highest to lowest):
 *  1. Environment variables (IRIS_SOURCES, IRIS_WORK_FOLDER)
 *  2. YAML config file (config.yaml in CWD or CONFIG_FILE env var)
 *
 * YAML format:
 * ```yaml
 * sources:
 *   - name: photos
 *     path: /data/photos
 *   - name: camera
 *     path: /data/camera
 * workFolder: /data/work
 * mapTileUrl: https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
 * mapTileAttribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
 * ```
 *
 * Env-var format:
 *   IRIS_SOURCES=photos:/data/photos,camera:/data/camera
 *   IRIS_WORK_FOLDER=/data/work
 *   IRIS_MAP_TILE_URL=https://tiles.example.com/{z}/{x}/{y}.png
 *   IRIS_MAP_TILE_ATTRIBUTION=&copy; Example Maps
 */

import * as fs from "node:fs";
import * as path from "node:path";

export interface SourceConfig {
  name: string;
  path: string;
}

export interface AppConfig {
  sources: SourceConfig[];
  workFolder: string;
  /** Leaflet tile URL template. Defaults to OpenStreetMap. */
  mapTileUrl?: string;
  /** Leaflet tile attribution HTML. */
  mapTileAttribution?: string;
}

// ── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_WORK_FOLDER = "./work";

// ── YAML Parser ───────────────────────────────────────────────────────────────

/**
 * Minimal YAML parser for Iris config format.
 * Only supports the specific structure used in config.yaml — not a full YAML parser.
 */
function parseConfigYaml(content: string): Partial<AppConfig> {
  const result: Partial<AppConfig> = {};
  const lines = content.split("\n");

  let inSources = false;
  let currentSource: Partial<SourceConfig> | null = null;
  const sources: SourceConfig[] = [];

  for (const rawLine of lines) {
    // Strip inline comments
    const commentIdx = rawLine.indexOf(" #");
    const line = commentIdx >= 0 ? rawLine.slice(0, commentIdx) : rawLine;
    const trimmed = line.trim();

    // Skip empty lines and comment-only lines
    if (!trimmed || trimmed.startsWith("#")) continue;

    // Top-level keys (no leading spaces)
    if (!line.startsWith(" ") && !line.startsWith("\t")) {
      // Commit any pending source
      if (currentSource) {
        if (currentSource.name && currentSource.path) {
          sources.push(currentSource as SourceConfig);
        }
        currentSource = null;
      }

      if (trimmed === "sources:") {
        inSources = true;
        continue;
      }

      inSources = false;

      const workMatch = trimmed.match(/^workFolder:\s*(.+)$/);
      if (workMatch) {
        result.workFolder = workMatch[1].trim();
        continue;
      }

      const mapTileUrlMatch = trimmed.match(/^mapTileUrl:\s*(.+)$/);
      if (mapTileUrlMatch) {
        // Strip surrounding quotes if present
        result.mapTileUrl = mapTileUrlMatch[1].trim().replace(/^['"]|['"]$/g, "");
        continue;
      }

      const mapTileAttrMatch = trimmed.match(/^mapTileAttribution:\s*(.+)$/);
      if (mapTileAttrMatch) {
        result.mapTileAttribution = mapTileAttrMatch[1].trim().replace(/^['"]|['"]$/g, "");
        continue;
      }

      // Unknown top-level key — skip
      continue;
    }

    // Indented lines
    if (inSources) {
      // Start of a new list item: "  - name: X" or "  -"
      const listItemMatch = trimmed.match(/^-\s*(.*)$/);
      if (listItemMatch) {
        // Commit previous source if complete
        if (currentSource && currentSource.name && currentSource.path) {
          sources.push(currentSource as SourceConfig);
        }
        currentSource = {};
        // Inline name after dash: "- name: X"
        const inlineNameMatch = listItemMatch[1].match(/^name:\s*(.+)$/);
        if (inlineNameMatch) {
          currentSource.name = inlineNameMatch[1].trim();
        }
        continue;
      }

      if (currentSource !== null) {
        const nameMatch = trimmed.match(/^name:\s*(.+)$/);
        if (nameMatch) {
          currentSource.name = nameMatch[1].trim();
          continue;
        }
        const pathMatch = trimmed.match(/^path:\s*(.+)$/);
        if (pathMatch) {
          currentSource.path = pathMatch[1].trim();
          continue;
        }
      }
    }
  }

  // Commit any trailing source
  if (currentSource && currentSource.name && currentSource.path) {
    sources.push(currentSource as SourceConfig);
  }

  if (sources.length > 0) {
    result.sources = sources;
  }

  return result;
}

// ── File loader ───────────────────────────────────────────────────────────────

function loadConfigFile(): Partial<AppConfig> {
  const configPath =
    process.env.CONFIG_FILE ?? path.resolve(process.cwd(), "config.yaml");

  if (!fs.existsSync(configPath)) {
    return {};
  }

  try {
    const content = fs.readFileSync(configPath, "utf-8");
    const parsed = parseConfigYaml(content);
    console.log(`[config] Loaded config from ${configPath}`);
    return parsed;
  } catch (err) {
    console.warn(
      `[config] Failed to read config file at ${configPath}:`,
      err instanceof Error ? err.message : err
    );
    return {};
  }
}

// ── Env-var loader ────────────────────────────────────────────────────────────

/**
 * Parse IRIS_SOURCES env var.
 * Format: "name1:/path/one,name2:/path/two"
 * Paths may contain colons on non-Windows systems — the first colon separates name from path.
 */
function parseSourcesEnv(raw: string): SourceConfig[] {
  const sources: SourceConfig[] = [];
  // Split on comma — but paths with commas are not supported (document limitation)
  const parts = raw.split(",");
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx <= 0) {
      console.warn(`[config] Invalid IRIS_SOURCES entry (missing colon): "${trimmed}"`);
      continue;
    }
    const name = trimmed.slice(0, colonIdx).trim();
    const sourcePath = trimmed.slice(colonIdx + 1).trim();
    if (!name || !sourcePath) {
      console.warn(`[config] Invalid IRIS_SOURCES entry: "${trimmed}"`);
      continue;
    }
    sources.push({ name, path: sourcePath });
  }
  return sources;
}

function loadEnvConfig(): Partial<AppConfig> {
  const result: Partial<AppConfig> = {};

  const sourcesEnv = process.env.IRIS_SOURCES;
  if (sourcesEnv) {
    const sources = parseSourcesEnv(sourcesEnv);
    if (sources.length > 0) {
      result.sources = sources;
    }
  }

  const workFolder = process.env.IRIS_WORK_FOLDER ?? process.env.WORK_DIR;
  if (workFolder) {
    result.workFolder = workFolder;
  }

  const mapTileUrl = process.env.IRIS_MAP_TILE_URL;
  if (mapTileUrl) {
    result.mapTileUrl = mapTileUrl;
  }

  const mapTileAttribution = process.env.IRIS_MAP_TILE_ATTRIBUTION;
  if (mapTileAttribution) {
    result.mapTileAttribution = mapTileAttribution;
  }

  return result;
}

// ── Public API ────────────────────────────────────────────────────────────────

let _cachedConfig: AppConfig | null = null;

/**
 * Load and return the application configuration.
 * Results are cached after first load — call resetConfig() in tests to clear.
 *
 * Priority: env vars > config file > defaults
 */
export function loadConfig(force = false): AppConfig {
  if (_cachedConfig && !force) return _cachedConfig;

  const fileConfig = loadConfigFile();
  const envConfig = loadEnvConfig();

  // Env vars take priority over file config
  const sources = envConfig.sources ?? fileConfig.sources ?? [];
  const workFolder =
    envConfig.workFolder ?? fileConfig.workFolder ?? DEFAULT_WORK_FOLDER;
  const mapTileUrl = envConfig.mapTileUrl ?? fileConfig.mapTileUrl;
  const mapTileAttribution = envConfig.mapTileAttribution ?? fileConfig.mapTileAttribution;

  _cachedConfig = {
    sources,
    workFolder,
    ...(mapTileUrl ? { mapTileUrl } : {}),
    ...(mapTileAttribution ? { mapTileAttribution } : {}),
  };

  if (sources.length === 0) {
    console.warn(
      "[config] No source folders configured. Set IRIS_SOURCES or add sources to config.yaml."
    );
  }

  return _cachedConfig;
}

/** Reset cached config (useful for testing). */
export function resetConfig(): void {
  _cachedConfig = null;
}
