/**
 * GpsMiniMap.tsx
 *
 * Renders a small interactive map centered on GPS coordinates using an
 * OpenStreetMap iframe embed. No external package required.
 */

interface GpsMiniMapProps {
  latitude: number;
  longitude: number;
  altitude?: number | null;
}

export function GpsMiniMap({ latitude, longitude }: GpsMiniMapProps) {
  const delta = 0.005; // ~500 m bounding box per side
  const bbox = `${longitude - delta},${latitude - delta},${longitude + delta},${latitude + delta}`;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${latitude},${longitude}`;

  return (
    <div
      className="mt-2 rounded-[var(--radius-md)] overflow-hidden border border-[var(--color-border)]"
      style={{ height: 160 }}
    >
      <iframe
        title="Location on map"
        width="100%"
        height="100%"
        src={src}
        style={{ border: 0 }}
        loading="lazy"
        referrerPolicy="no-referrer"
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  );
}
