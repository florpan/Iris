/**
 * ImageDetailModal.tsx
 *
 * Full-screen overlay showing:
 *  - Original image (from /api/images/:id/original) with zoom/pan support
 *  - Metadata panel (camera, file, location, IPTC, raw)
 *  - Previous/next navigation buttons
 *  - Keyboard shortcuts: ArrowLeft/Right = prev/next, Escape = close
 *
 * Usage:
 *   <ImageDetailModal
 *     imageId={selectedId}
 *     imageIds={[1, 2, 3, ...]}   // ordered list for navigation
 *     onNavigate={(id) => setSelectedId(id)}
 *     onClose={() => setSelectedId(null)}
 *   />
 */

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type WheelEvent,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize,
  Loader2,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MetadataPanel, type ImageDetail } from "./MetadataPanel";
import type { ReturnContext } from "@/hooks/useNavigationContext";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ImageDetailModalProps {
  imageId: number;
  imageIds: number[];
  /** Optional context for the back button (where the user came from) */
  returnContext?: ReturnContext | null;
  onNavigate: (id: number) => void;
  onClose: () => void;
  /** Called when the back button is clicked; uses onClose if not provided */
  onBack?: () => void;
}

// ── Image Viewer (zoom/pan) ───────────────────────────────────────────────────

interface ImageViewerProps {
  src: string;
  alt: string;
}

function ImageViewer({ src, alt }: ImageViewerProps) {
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset on src change
  useEffect(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
    setLoaded(false);
    setError(false);
  }, [src]);

  const clampTranslate = useCallback(
    (tx: number, ty: number, s: number) => {
      const container = containerRef.current;
      if (!container) return { x: tx, y: ty };
      const { width, height } = container.getBoundingClientRect();
      // Allow panning up to (scale-1)/2 of container size in each direction
      const maxX = Math.max(0, (width * (s - 1)) / 2);
      const maxY = Math.max(0, (height * (s - 1)) / 2);
      return {
        x: Math.min(maxX, Math.max(-maxX, tx)),
        y: Math.min(maxY, Math.max(-maxY, ty)),
      };
    },
    []
  );

  const handleWheel = useCallback(
    (e: WheelEvent<HTMLDivElement>) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1.1 : 0.9;
      setScale((s) => {
        const next = Math.min(8, Math.max(1, s * delta));
        if (next === 1) setTranslate({ x: 0, y: 0 });
        return next;
      });
    },
    []
  );

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (scale <= 1) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      dragStart.current = {
        x: e.clientX,
        y: e.clientY,
        tx: translate.x,
        ty: translate.y,
      };
      setDragging(true);
    },
    [scale, translate]
  );

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!dragStart.current) return;
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      const clamped = clampTranslate(
        dragStart.current.tx + dx,
        dragStart.current.ty + dy,
        scale
      );
      setTranslate(clamped);
    },
    [scale, clampTranslate]
  );

  const handlePointerUp = useCallback(() => {
    dragStart.current = null;
    setDragging(false);
  }, []);

  const handleDoubleClick = useCallback(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, []);

  const zoomIn = () => {
    setScale((s) => Math.min(8, s * 1.5));
  };

  const zoomOut = () => {
    setScale((s) => {
      const next = Math.max(1, s / 1.5);
      if (next === 1) setTranslate({ x: 0, y: 0 });
      return next;
    });
  };

  const reset = () => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  };

  return (
    <div className="relative flex flex-col h-full bg-black/95 select-none">
      {/* Image container */}
      <div
        ref={containerRef}
        className={cn(
          "flex-1 overflow-hidden flex items-center justify-center",
          scale > 1 && !dragging && "cursor-grab",
          scale > 1 && dragging && "cursor-grabbing",
          scale <= 1 && "cursor-default"
        )}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onDoubleClick={handleDoubleClick}
      >
        {!loaded && !error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-white/40 animate-spin" />
          </div>
        )}

        {error ? (
          <div className="flex flex-col items-center gap-3 text-white/50">
            <AlertCircle className="w-10 h-10" />
            <p className="text-sm">Failed to load image</p>
          </div>
        ) : (
          <img
            src={src}
            alt={alt}
            className={cn(
              "max-w-full max-h-full object-contain transition-opacity duration-200",
              loaded ? "opacity-100" : "opacity-0"
            )}
            style={{
              transform: `scale(${scale}) translate(${translate.x / scale}px, ${translate.y / scale}px)`,
              transformOrigin: "center center",
            }}
            draggable={false}
            onLoad={() => setLoaded(true)}
            onError={() => { setLoaded(true); setError(true); }}
          />
        )}
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-[var(--radius-pill)] px-2 py-1">
        <button
          onClick={zoomOut}
          disabled={scale <= 1}
          className={cn(
            "flex items-center justify-center w-7 h-7 rounded-full text-white transition-opacity",
            scale <= 1 ? "opacity-30 cursor-not-allowed" : "opacity-80 hover:opacity-100"
          )}
          title="Zoom out"
          aria-label="Zoom out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        <span className="text-white/70 text-xs min-w-[3rem] text-center font-mono">
          {Math.round(scale * 100)}%
        </span>

        <button
          onClick={zoomIn}
          disabled={scale >= 8}
          className={cn(
            "flex items-center justify-center w-7 h-7 rounded-full text-white transition-opacity",
            scale >= 8 ? "opacity-30 cursor-not-allowed" : "opacity-80 hover:opacity-100"
          )}
          title="Zoom in"
          aria-label="Zoom in"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        {scale > 1 && (
          <button
            onClick={reset}
            className="flex items-center justify-center w-7 h-7 rounded-full text-white opacity-80 hover:opacity-100 transition-opacity"
            title="Reset zoom (double-click image)"
            aria-label="Reset zoom"
          >
            <Maximize className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main Modal ─────────────────────────────────────────────────────────────────

export function ImageDetailModal({
  imageId,
  imageIds,
  returnContext,
  onNavigate,
  onClose,
  onBack,
}: ImageDetailModalProps) {
  const [detail, setDetail] = useState<ImageDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const currentIndex = imageIds.indexOf(imageId);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < imageIds.length - 1;

  // Fetch full image details when ID changes
  useEffect(() => {
    if (!imageId) return;
    setLoading(true);
    setFetchError(null);

    fetch(`/api/images/${imageId}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => setDetail(json.data))
      .catch((err) => setFetchError(err.message ?? "Failed to load image details"))
      .finally(() => setLoading(false));
  }, [imageId]);

  const goPrev = useCallback(() => {
    if (hasPrev) onNavigate(imageIds[currentIndex - 1]);
  }, [hasPrev, imageIds, currentIndex, onNavigate]);

  const goNext = useCallback(() => {
    if (hasNext) onNavigate(imageIds[currentIndex + 1]);
  }, [hasNext, imageIds, currentIndex, onNavigate]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Don't capture inside inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, goPrev, goNext]);

  // Prevent body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const handleBackdropClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch bg-black/85 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={detail?.fileName ?? "Image detail"}
      onClick={handleBackdropClick}
    >
      {/* ── Main container ──────────────────────────────────────────────── */}
      <div
        className="flex flex-1 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Image area ──────────────────────────────────────────────── */}
        <div className="relative flex-1 flex flex-col overflow-hidden">
          {/* Back button (shown when context is available) */}
          {returnContext && (
            <button
              onClick={onBack ?? onClose}
              className={cn(
                "absolute top-3 left-3 z-10 flex items-center gap-1.5",
                "px-3 py-1.5 rounded-full bg-black/50 text-white text-xs font-medium",
                "hover:bg-black/70 transition-colors max-w-[200px]",
                "focus:outline-none focus:ring-2 focus:ring-white/50"
              )}
              aria-label={returnContext.label}
              title={returnContext.label}
            >
              <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{returnContext.label}</span>
            </button>
          )}

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-10 flex items-center justify-center w-9 h-9 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
            aria-label="Close"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Image viewer */}
          {detail && (
            <ImageViewer
              src={`/api/images/${imageId}/original`}
              alt={detail.fileName}
            />
          )}

          {/* Loading state */}
          {loading && !detail && (
            <div className="flex-1 flex items-center justify-center bg-black/95">
              <Loader2 className="w-10 h-10 text-white/30 animate-spin" />
            </div>
          )}

          {/* Error state */}
          {fetchError && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-black/95 text-white/50">
              <AlertCircle className="w-10 h-10" />
              <p className="text-sm">{fetchError}</p>
            </div>
          )}

          {/* ── Prev/Next navigation ──────────────────────────────── */}
          <button
            onClick={goPrev}
            disabled={!hasPrev}
            className={cn(
              "absolute left-3 top-1/2 -translate-y-1/2 z-10",
              "flex items-center justify-center w-10 h-10 rounded-full",
              "bg-black/50 text-white transition-all",
              hasPrev
                ? "hover:bg-black/70 hover:scale-105"
                : "opacity-20 cursor-not-allowed"
            )}
            aria-label="Previous image (←)"
            title="Previous (←)"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <button
            onClick={goNext}
            disabled={!hasNext}
            className={cn(
              "absolute right-3 top-1/2 -translate-y-1/2 z-10",
              "flex items-center justify-center w-10 h-10 rounded-full",
              "bg-black/50 text-white transition-all",
              hasNext
                ? "hover:bg-black/70 hover:scale-105"
                : "opacity-20 cursor-not-allowed"
            )}
            aria-label="Next image (→)"
            title="Next (→)"
          >
            <ChevronRight className="w-6 h-6" />
          </button>

          {/* Counter */}
          {imageIds.length > 1 && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/50 text-white/70 text-xs">
              {currentIndex + 1} / {imageIds.length}
            </div>
          )}
        </div>

        {/* ── Metadata panel ──────────────────────────────────────────── */}
        <div
          className={cn(
            "w-72 shrink-0 flex flex-col border-l border-white/10",
            "bg-[var(--color-bg)] overflow-hidden"
          )}
        >
          {/* Panel header */}
          <div className="px-4 py-3 border-b border-[var(--color-border)] shrink-0">
            <p
              className="text-sm font-medium text-[var(--color-text-heading)] truncate"
              title={detail?.fileName}
            >
              {loading ? (
                <span className="flex items-center gap-2 text-[var(--color-text-muted)]">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Loading…
                </span>
              ) : (
                detail?.fileName ?? "—"
              )}
            </p>
          </div>

          {/* Metadata */}
          <div className="flex-1 overflow-hidden">
            {detail && <MetadataPanel image={detail} />}
          </div>
        </div>
      </div>
    </div>
  );
}
