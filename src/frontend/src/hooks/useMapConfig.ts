/**
 * useMapConfig.ts
 *
 * Fetches the Leaflet tile configuration from the server (/api/config).
 * Returns tileUrl and tileAttribution, falling back to OpenStreetMap defaults
 * if the server returns null (no custom tile source configured).
 *
 * Results are cached at module level — the config is fetched once per session.
 */

import { useState, useEffect } from "react";

export interface MapConfig {
  tileUrl: string;
  tileAttribution: string;
}

const DEFAULT_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const DEFAULT_TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// Module-level cache so all components share one fetch
let _cache: MapConfig | null = null;
let _promise: Promise<MapConfig> | null = null;

async function fetchMapConfig(): Promise<MapConfig> {
  if (_cache) return _cache;
  if (_promise) return _promise;

  _promise = fetch("/api/config")
    .then((r) => (r.ok ? r.json() : null))
    .then((json) => {
      const mapSection = json?.data?.map;
      const config: MapConfig = {
        tileUrl: mapSection?.tileUrl ?? DEFAULT_TILE_URL,
        tileAttribution: mapSection?.tileAttribution ?? DEFAULT_TILE_ATTRIBUTION,
      };
      _cache = config;
      return config;
    })
    .catch(() => {
      const fallback: MapConfig = {
        tileUrl: DEFAULT_TILE_URL,
        tileAttribution: DEFAULT_TILE_ATTRIBUTION,
      };
      _cache = fallback;
      return fallback;
    });

  return _promise;
}

export function useMapConfig(): MapConfig {
  const [config, setConfig] = useState<MapConfig>(_cache ?? {
    tileUrl: DEFAULT_TILE_URL,
    tileAttribution: DEFAULT_TILE_ATTRIBUTION,
  });

  useEffect(() => {
    if (_cache) return; // Already resolved
    fetchMapConfig().then(setConfig);
  }, []);

  return config;
}
