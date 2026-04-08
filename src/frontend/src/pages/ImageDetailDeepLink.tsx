/**
 * ImageDetailDeepLink.tsx
 *
 * Standalone page rendered when a user navigates directly to /image/:id
 * (deep link, new tab, page refresh while viewing an image).
 *
 * Shows the image detail view with a context-aware back button derived
 * from the `from` URL param. Gracefully handles missing context by
 * providing a "Back to library" fallback.
 */

import { useCallback } from "react";
import { ImageDetailModal } from "@/components/ImageDetailModal";
import { parseReturnContext } from "@/hooks/useNavigationContext";

interface ImageDetailDeepLinkProps {
  imageId: number;
}

export function ImageDetailDeepLink({ imageId }: ImageDetailDeepLinkProps) {
  // Parse return context from URL params (may be null for bare /image/:id links)
  const returnContext = parseReturnContext();

  // Fallback context for bare deep links with no context params
  const effectiveContext = returnContext ?? {
    type: "library" as const,
    label: "Back to library",
    returnUrl: "/",
  };

  const handleBack = useCallback(() => {
    // Navigate to the return URL, replacing the current history entry
    window.history.replaceState(null, "", effectiveContext.returnUrl);
    // Trigger a page-level navigation so App.tsx re-renders
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, [effectiveContext.returnUrl]);

  const handleClose = handleBack;

  return (
    <>
      {/*
        Dark backdrop behind the modal for deep-link cases where there's
        no "real" page behind the overlay.
      */}
      <div className="fixed inset-0 bg-[var(--color-bg)]" />
      <ImageDetailModal
        imageId={imageId}
        imageIds={[imageId]}
        returnContext={effectiveContext}
        onNavigate={() => {
          // No prev/next in deep link mode — single image only
        }}
        onClose={handleClose}
        onBack={handleBack}
      />
    </>
  );
}
