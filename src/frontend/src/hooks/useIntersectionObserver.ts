/**
 * useIntersectionObserver.ts
 *
 * Performance hook that uses the Intersection Observer API to detect when
 * an element enters/exits the viewport. Used by image grid thumbnails to
 * defer loading until the image is near the viewport.
 *
 * Returns:
 *   - ref: attach to the element you want to observe
 *   - isVisible: true when the element is within the rootMargin of the viewport
 *   - hasBeenVisible: true once the element has been visible (sticky — won't revert)
 *
 * Motivation: Although <img loading="lazy"> provides browser-native lazy loading,
 * this hook enables finer-grained control for:
 *   - Deferred rendering of complex thumbnail overlays
 *   - Progressive image enhancement
 *   - Scroll performance in large grids via content-visibility optimization
 */

import { useEffect, useRef, useState } from "react";

interface UseIntersectionObserverOptions {
  /** How far outside the viewport to start loading (CSS margin syntax) */
  rootMargin?: string;
  /** Fraction of element that must be visible to trigger */
  threshold?: number | number[];
  /** Once visible, stay visible (don't revert when scrolled away) */
  once?: boolean;
}

export function useIntersectionObserver<T extends Element = HTMLDivElement>({
  rootMargin = "200px",
  threshold = 0,
  once = true,
}: UseIntersectionObserverOptions = {}) {
  const ref = useRef<T>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [hasBeenVisible, setHasBeenVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Fallback for environments without IntersectionObserver (SSR, old browsers)
    if (typeof IntersectionObserver === "undefined") {
      setIsVisible(true);
      setHasBeenVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          setIsVisible(true);
          setHasBeenVisible(true);
          if (once) {
            observer.disconnect();
          }
        } else if (!once) {
          setIsVisible(false);
        }
      },
      { rootMargin, threshold }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin, threshold, once]);

  return { ref, isVisible, hasBeenVisible };
}
