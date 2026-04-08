/**
 * MetadataPanel.tsx
 *
 * Displays organized metadata for an image:
 *  - Camera Info  (model, lens, ISO, aperture, shutter, focal length)
 *  - File Info    (file name, size, dimensions, format, dates)
 *  - Location     (GPS coordinates + optional OpenStreetMap mini-map)
 *  - IPTC         (title, description, keywords, copyright)
 *  - Raw Metadata (collapsible JSON accordion for extra fields)
 */

import { useState } from "react";
import {
  Camera,
  FileImage,
  MapPin,
  Tag,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GpsMiniMap } from "./GpsMiniMap";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ImageDetail {
  id: number;
  fileName: string;
  relativePath: string;
  fileSize: number | null;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  thumbnailPath: string | null;
  takenAt: string | null;
  fileModifiedAt: string | null;
  // Camera
  cameraModel: string | null;
  lensModel: string | null;
  iso: number | null;
  aperture: number | null;
  shutterSpeed: string | null;
  focalLength: number | null;
  // GPS
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  // IPTC
  iptcTitle: string | null;
  iptcDescription: string | null;
  iptcKeywords: string[] | null;
  iptcCopyright: string | null;
  // Raw
  metadata: Record<string, unknown> | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAperture(aperture: number | null): string {
  if (aperture == null) return "—";
  return `f/${aperture.toFixed(1)}`;
}

function formatFocalLength(mm: number | null): string {
  if (mm == null) return "—";
  return `${mm % 1 === 0 ? mm : mm.toFixed(1)} mm`;
}

function formatCoord(coord: number | null, pos: "N" | "S" | "E" | "W"): string {
  if (coord == null) return "—";
  const abs = Math.abs(coord);
  const deg = Math.floor(abs);
  const minFull = (abs - deg) * 60;
  const min = Math.floor(minFull);
  const sec = ((minFull - min) * 60).toFixed(1);
  return `${deg}° ${min}' ${sec}" ${coord >= 0 ? pos : (pos === "N" ? "S" : "W")}`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface SectionProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function Section({ icon, title, children, defaultOpen = true }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-[var(--color-border)] last:border-b-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 w-full px-4 py-3 text-left hover:bg-black/3 dark:hover:bg-white/3 transition-colors"
        aria-expanded={open}
      >
        <span className="text-[var(--color-text-muted)] shrink-0">{icon}</span>
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)] flex-1">
          {title}
        </span>
        {open ? (
          <ChevronDown className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-3">
          {children}
        </div>
      )}
    </div>
  );
}

interface RowProps {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}

function Row({ label, value, mono = false }: RowProps) {
  return (
    <div className="flex items-start gap-2 py-0.5">
      <span className="text-xs text-[var(--color-text-muted)] w-28 shrink-0 mt-0.5">
        {label}
      </span>
      <span
        className={cn(
          "text-xs text-[var(--color-text-primary)] flex-1 break-all",
          mono && "font-mono"
        )}
      >
        {value ?? "—"}
      </span>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

interface MetadataPanelProps {
  image: ImageDetail;
}

export function MetadataPanel({ image }: MetadataPanelProps) {
  const [rawOpen, setRawOpen] = useState(false);

  const hasCameraInfo =
    image.cameraModel ||
    image.lensModel ||
    image.iso != null ||
    image.aperture != null ||
    image.shutterSpeed ||
    image.focalLength != null;

  const hasGps = image.latitude != null && image.longitude != null;

  const hasIptc =
    image.iptcTitle ||
    image.iptcDescription ||
    (image.iptcKeywords && image.iptcKeywords.length > 0) ||
    image.iptcCopyright;

  const hasRaw = image.metadata && Object.keys(image.metadata).length > 0;

  return (
    <div className="flex flex-col overflow-y-auto h-full text-sm">
      {/* ── Camera Info ─────────────────────────────────────────────────── */}
      {hasCameraInfo && (
        <Section
          icon={<Camera className="w-3.5 h-3.5" />}
          title="Camera"
          defaultOpen={true}
        >
          {image.cameraModel && <Row label="Camera" value={image.cameraModel} />}
          {image.lensModel && <Row label="Lens" value={image.lensModel} />}
          {image.iso != null && <Row label="ISO" value={`ISO ${image.iso}`} />}
          {image.aperture != null && (
            <Row label="Aperture" value={formatAperture(image.aperture)} />
          )}
          {image.shutterSpeed && (
            <Row label="Shutter" value={image.shutterSpeed} />
          )}
          {image.focalLength != null && (
            <Row label="Focal Length" value={formatFocalLength(image.focalLength)} />
          )}
        </Section>
      )}

      {/* ── File Info ───────────────────────────────────────────────────── */}
      <Section
        icon={<FileImage className="w-3.5 h-3.5" />}
        title="File"
        defaultOpen={true}
      >
        <Row label="File Name" value={image.fileName} />
        <Row label="Path" value={image.relativePath} mono />
        <Row label="Size" value={formatFileSize(image.fileSize)} />
        {image.width != null && image.height != null && (
          <Row label="Dimensions" value={`${image.width} × ${image.height} px`} />
        )}
        {image.mimeType && <Row label="Format" value={image.mimeType} />}
        {image.takenAt && (
          <Row label="Taken" value={formatDate(image.takenAt)} />
        )}
        {image.fileModifiedAt && (
          <Row label="Modified" value={formatDate(image.fileModifiedAt)} />
        )}
      </Section>

      {/* ── Location ────────────────────────────────────────────────────── */}
      {hasGps && (
        <Section
          icon={<MapPin className="w-3.5 h-3.5" />}
          title="Location"
          defaultOpen={true}
        >
          <Row
            label="Latitude"
            value={formatCoord(image.latitude, "N")}
            mono
          />
          <Row
            label="Longitude"
            value={formatCoord(image.longitude, "E")}
            mono
          />
          {image.altitude != null && (
            <Row label="Altitude" value={`${image.altitude.toFixed(1)} m`} />
          )}
          <GpsMiniMap
            latitude={image.latitude!}
            longitude={image.longitude!}
            altitude={image.altitude}
          />
        </Section>
      )}

      {/* ── IPTC ────────────────────────────────────────────────────────── */}
      {hasIptc && (
        <Section
          icon={<Tag className="w-3.5 h-3.5" />}
          title="IPTC"
          defaultOpen={true}
        >
          {image.iptcTitle && <Row label="Title" value={image.iptcTitle} />}
          {image.iptcDescription && (
            <Row label="Description" value={image.iptcDescription} />
          )}
          {image.iptcCopyright && (
            <Row label="Copyright" value={image.iptcCopyright} />
          )}
          {image.iptcKeywords && image.iptcKeywords.length > 0 && (
            <div className="flex items-start gap-2 py-0.5">
              <span className="text-xs text-[var(--color-text-muted)] w-28 shrink-0 mt-0.5">
                Keywords
              </span>
              <div className="flex flex-wrap gap-1 flex-1">
                {image.iptcKeywords.map((kw) => (
                  <span
                    key={kw}
                    className="inline-flex items-center px-1.5 py-0.5 rounded-[var(--radius-sm)] bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] text-xs"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Section>
      )}

      {/* ── Raw Metadata ────────────────────────────────────────────────── */}
      {hasRaw && (
        <div className="border-b border-[var(--color-border)] last:border-b-0">
          <button
            onClick={() => setRawOpen((v) => !v)}
            className="flex items-center gap-2 w-full px-4 py-3 text-left hover:bg-black/3 dark:hover:bg-white/3 transition-colors"
            aria-expanded={rawOpen}
          >
            <span className="text-[var(--color-text-muted)] shrink-0">
              <span className="text-[10px] font-mono font-bold">{"{}"}</span>
            </span>
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)] flex-1">
              Raw Metadata
            </span>
            {rawOpen ? (
              <ChevronDown className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
            )}
          </button>
          {rawOpen && (
            <div className="px-4 pb-3">
              <pre className="text-[10px] font-mono text-[var(--color-text-secondary)] overflow-x-auto whitespace-pre-wrap break-all bg-[var(--color-bg-secondary)] rounded-[var(--radius-md)] p-3">
                {JSON.stringify(image.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
