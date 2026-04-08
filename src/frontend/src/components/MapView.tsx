/**
 * MapView.tsx
 *
 * Full-featured Leaflet map view for displaying GPS-tagged images.
 *
 * Features:
 *  - Leaflet map with OpenStreetMap tiles (configurable tile source)
 *  - Marker clustering via Leaflet.markercluster
 *  - Thumbnail popup on marker click with link to image detail view
 *  - Auto-fits map bounds to show all markers on load
 *  - GPS count indicator ("Showing X of Y images, Z have no GPS")
 *
 * Usage:
 *   <MapView
 *     sourceId={42}
 *     folderPath="2023/summer"
 *     tileUrl="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
 *   />
 */

import { useEffect, useRef, useState, useMemo } from "react";
import { MapPin, Loader2, AlertCircle } from "lucide-react";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

// ── Types ─────────────────────────────────────────────────────────────────────

interface GpsImage {
  id: number;
  fileName: string;
  thumbnailPath: string | null;
  latitude: number;
  longitude: number;
}

interface GpsResponse {
  data: GpsImage[];
  total: number;
  gpsCount: number;
  limit: number;
  truncated: boolean;
}

export interface MapViewProps {
  /** Filter: restrict to a specific source folder DB id */
  sourceId?: number | null;
  /** Filter: restrict to a specific folder path within the source */
  folderPath?: string | null;
  /** Filter: full-text search query */
  searchQuery?: string;
  /** Filter: camera model (partial, case-insensitive) */
  camera?: string;
  /** Filter: lens model (partial, case-insensitive) */
  lens?: string;
  /** Filter: date range start ISO string */
  dateFrom?: string;
  /** Filter: date range end ISO string */
  dateTo?: string;
  /** Filter: MIME type */
  format?: string;
  /** Filter: minimum file size in bytes (as string) */
  minSize?: string;
  /** Filter: maximum file size in bytes (as string) */
  maxSize?: string;
  /** Tile server URL template (default: OpenStreetMap) */
  tileUrl?: string;
  /** Tile server attribution HTML */
  tileAttribution?: string;
}

const DEFAULT_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const DEFAULT_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// ── GPS API fetch ─────────────────────────────────────────────────────────────

function buildGpsUrl(props: MapViewProps): string {
  const params = new URLSearchParams();
  if (props.sourceId != null) params.set("sourceId", String(props.sourceId));
  if (props.folderPath != null) params.set("folderPath", props.folderPath);
  if (props.searchQuery) params.set("q", props.searchQuery);
  if (props.camera) params.set("camera", props.camera);
  if (props.lens) params.set("lens", props.lens);
  if (props.dateFrom) params.set("dateFrom", props.dateFrom);
  if (props.dateTo) params.set("dateTo", props.dateTo);
  if (props.format) params.set("format", props.format);
  if (props.minSize) params.set("minSize", props.minSize);
  if (props.maxSize) params.set("maxSize", props.maxSize);
  return `/api/images/gps?${params}`;
}

// ── HTML escape ───────────────────────────────────────────────────────────────

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── MapView Component ─────────────────────────────────────────────────────────

export function MapView(props: MapViewProps) {
  const {
    tileUrl = DEFAULT_TILE_URL,
    tileAttribution = DEFAULT_ATTRIBUTION,
  } = props;

  const mapContainerRef = useRef<HTMLDivElement>(null);

  // References to Leaflet objects — managed by imperative effects
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clusterGroupRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leafletRef = useRef<any>(null);
  const mapReadyRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gpsData, setGpsData] = useState<GpsResponse | null>(null);

  // Build GPS URL; memoize so it only changes when filter props change
  const gpsUrl = useMemo(() => buildGpsUrl(props), [
    // eslint-disable-next-line react-hooks/exhaustive-deps
    props.sourceId,
    props.folderPath,
    props.searchQuery,
    props.camera,
    props.lens,
    props.dateFrom,
    props.dateTo,
    props.format,
    props.minSize,
    props.maxSize,
  ]);

  // ── Fetch GPS data ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(gpsUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<GpsResponse>;
      })
      .then((data) => {
        if (!cancelled) setGpsData(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message ?? "Failed to load GPS data");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [gpsUrl]);

  // ── Initialize Leaflet map ──────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current) return;
    let destroyed = false;

    const init = async () => {
      const [L, LMC] = await Promise.all([
        import("leaflet"),
        import("leaflet.markercluster"),
      ]);
      // LMC is a side-effect import that extends L globally
      void LMC;

      if (destroyed || !mapContainerRef.current) return;

      // Fix Leaflet default icon paths broken by Vite asset bundling
      // @ts-expect-error — private Leaflet method
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl: new URL(
          "leaflet/dist/images/marker-icon.png",
          import.meta.url
        ).href,
        iconRetinaUrl: new URL(
          "leaflet/dist/images/marker-icon-2x.png",
          import.meta.url
        ).href,
        shadowUrl: new URL(
          "leaflet/dist/images/marker-shadow.png",
          import.meta.url
        ).href,
      });

      const map = L.map(mapContainerRef.current, {
        center: [20, 0],
        zoom: 2,
      });

      L.tileLayer(tileUrl, {
        attribution: tileAttribution,
        maxZoom: 19,
      }).addTo(map);

      const clusterGroup = L.markerClusterGroup({
        maxClusterRadius: 60,
        chunkedLoading: true,
      });
      map.addLayer(clusterGroup);

      leafletRef.current = L;
      mapRef.current = map;
      clusterGroupRef.current = clusterGroup;
      mapReadyRef.current = true;
    };

    init();

    return () => {
      destroyed = true;
      mapReadyRef.current = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        clusterGroupRef.current = null;
        leafletRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tileUrl, tileAttribution]);

  // ── Update markers when GPS data or map changes ─────────────────────────────
  useEffect(() => {
    if (!gpsData) return;

    // Poll for map readiness (handles race between GPS fetch and map init)
    let attempts = 0;
    const MAX_ATTEMPTS = 50; // 5 seconds total

    const tryUpdate = () => {
      if (!mapRef.current || !clusterGroupRef.current || !leafletRef.current) {
        if (++attempts < MAX_ATTEMPTS) {
          setTimeout(tryUpdate, 100);
        }
        return;
      }

      const L = leafletRef.current;
      const map = mapRef.current;
      const clusterGroup = clusterGroupRef.current;

      clusterGroup.clearLayers();

      const points = gpsData.data;
      if (points.length === 0) return;

      const bounds: [number, number][] = [];

      for (const img of points) {
        bounds.push([img.latitude, img.longitude]);

        const marker = L.marker([img.latitude, img.longitude]);

        // Popup: thumbnail + filename + link to detail view
        const thumbHtml = img.thumbnailPath
          ? `<a href="/image/${img.id}" style="display:block;">
               <img
                 src="/api/images/${img.id}/thumb"
                 alt="${esc(img.fileName)}"
                 style="width:100%;height:120px;object-fit:cover;display:block;border-radius:4px 4px 0 0;"
                 loading="lazy"
               />
             </a>`
          : `<div style="width:100%;height:80px;background:#f3f4f6;border-radius:4px 4px 0 0;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:11px;">No thumbnail</div>`;

        const popupHtml = `
          <div style="width:180px;font-family:-apple-system,BlinkMacSystemFont,'DM Sans',sans-serif;">
            ${thumbHtml}
            <div style="padding:8px 8px 6px;">
              <p style="margin:0 0 5px;font-size:12px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#18181b;" title="${esc(img.fileName)}">
                ${esc(img.fileName)}
              </p>
              <a href="/image/${img.id}" style="font-size:11px;color:#1456f0;text-decoration:none;font-weight:500;">
                View detail →
              </a>
            </div>
          </div>
        `;

        marker.bindPopup(popupHtml, { maxWidth: 200, minWidth: 180 });
        clusterGroup.addLayer(marker);
      }

      // Auto-fit bounds to show all markers
      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      }
    };

    tryUpdate();
  }, [gpsData]);

  // ── Render ──────────────────────────────────────────────────────────────────

  const noGps =
    gpsData && gpsData.total > 0 && gpsData.gpsCount === 0;

  const noImages = gpsData && gpsData.total === 0;

  return (
    <div className="relative w-full h-full min-h-[400px]">
      {/* Leaflet map container — always mounted so Leaflet can attach */}
      <div ref={mapContainerRef} className="absolute inset-0 z-0" />

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 z-[1001] flex items-center justify-center bg-[var(--color-bg)]/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-7 h-7 animate-spin text-[#1456f0]" />
            <span className="text-sm text-[var(--color-text-muted)]">
              Loading map data…
            </span>
          </div>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="absolute inset-0 z-[1001] flex items-center justify-center bg-[var(--color-bg)]/90">
          <div className="flex flex-col items-center gap-3 p-6 text-center">
            <AlertCircle className="w-8 h-8 text-red-500" />
            <p className="text-sm font-medium text-[var(--color-text-heading)]">
              Failed to load map data
            </p>
            <p className="text-xs text-[var(--color-text-muted)]">{error}</p>
          </div>
        </div>
      )}

      {/* No images in this view */}
      {!loading && !error && noImages && (
        <div className="absolute inset-0 z-[1001] flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-center p-8 bg-[var(--color-bg)]/95 backdrop-blur-sm rounded-[var(--radius-lg)] shadow border border-[var(--color-border)]">
            <MapPin className="w-10 h-10 text-[var(--color-text-muted)]" />
            <p className="text-sm font-medium text-[var(--color-text-heading)]">
              No images found
            </p>
            <p className="text-xs text-[var(--color-text-muted)] max-w-[240px]">
              No images match the current filter.
            </p>
          </div>
        </div>
      )}

      {/* No GPS data (but images exist) */}
      {!loading && !error && noGps && (
        <div className="absolute inset-0 z-[1001] flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-center p-8 bg-[var(--color-bg)]/95 backdrop-blur-sm rounded-[var(--radius-lg)] shadow border border-[var(--color-border)]">
            <MapPin className="w-10 h-10 text-[var(--color-text-muted)]" />
            <p className="text-sm font-medium text-[var(--color-text-heading)]">
              No GPS data found
            </p>
            <p className="text-xs text-[var(--color-text-muted)] max-w-[260px]">
              None of the {gpsData!.total.toLocaleString()} images in this view
              have GPS coordinates embedded in their metadata.
            </p>
          </div>
        </div>
      )}

      {/* GPS count indicator — shown when there are GPS-tagged images */}
      {!loading && !error && gpsData && gpsData.gpsCount > 0 && (
        <GpsCountBadge response={gpsData} />
      )}
    </div>
  );
}

// ── GPS Count Badge ───────────────────────────────────────────────────────────

function GpsCountBadge({ response }: { response: GpsResponse }) {
  const { total, gpsCount, truncated, limit } = response;
  const noGpsCount = total - gpsCount;

  return (
    <div className="absolute bottom-8 left-2 z-[1000] flex items-center gap-1.5 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm rounded-[var(--radius-md)] px-2.5 py-1.5 text-xs shadow border border-[var(--color-border)] pointer-events-none">
      <MapPin className="w-3 h-3 text-[#1456f0] shrink-0" />
      <span className="text-[var(--color-text-secondary)]">
        Showing{" "}
        <strong className="text-[var(--color-text-heading)]">
          {truncated
            ? `${limit.toLocaleString()}+`
            : gpsCount.toLocaleString()}
        </strong>{" "}
        of{" "}
        <strong className="text-[var(--color-text-heading)]">
          {total.toLocaleString()}
        </strong>{" "}
        images
        {noGpsCount > 0 && (
          <span className="text-[var(--color-text-muted)]">
            {" "}({noGpsCount.toLocaleString()} have no GPS)
          </span>
        )}
        {truncated && (
          <span className="text-amber-600 dark:text-amber-400 ml-1">
            · limit reached
          </span>
        )}
      </span>
    </div>
  );
}
