import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { registerScrollAnimation } from "@rgbmarya/manim-scroll-runtime";
import type { ScrollRangeValue } from "@rgbmarya/manim-scroll-runtime";
import { computePropsHash } from "./hash";

// Cache manifest type
interface CacheManifest {
  version: number;
  animations: Record<string, string>;
}

// Global cache manifest (loaded once)
let cacheManifestPromise: Promise<CacheManifest | null> | null = null;

/**
 * Load the cache manifest from the public directory.
 */
async function loadCacheManifest(): Promise<CacheManifest | null> {
  if (cacheManifestPromise) {
    return cacheManifestPromise;
  }

  cacheManifestPromise = fetch("/manim-assets/cache-manifest.json")
    .then((response) => {
      if (!response.ok) {
        return null;
      }
      return response.json() as Promise<CacheManifest>;
    })
    .catch(() => null);

  return cacheManifestPromise;
}

/**
 * Resolve the manifest URL for the given animation props.
 */
async function resolveManifestUrl(
  scene: string,
  props: Record<string, unknown>
): Promise<string | null> {
  const manifest = await loadCacheManifest();
  if (!manifest) {
    return null;
  }

  const hash = computePropsHash(scene, props);
  return manifest.animations[hash] ?? null;
}

/**
 * Options for the useManimScroll hook.
 */
export interface UseManimScrollOptions {
  /** Ref to the container element */
  ref: React.RefObject<HTMLElement | null>;
  /** Explicit manifest URL (skips auto-resolution) */
  manifestUrl?: string;
  /** Scene name for auto-resolution (default: "TextScene") */
  scene?: string;
  /** Animation props for auto-resolution (hashed to find cached assets) */
  animationProps?: Record<string, unknown>;
  /** Playback mode */
  mode?: "auto" | "frames" | "video";
  /** Scroll range configuration */
  scrollRange?: ScrollRangeValue;
  /** Canvas dimensions */
  canvasDimensions?: {
    width?: number;
    height?: number;
  };
}

/**
 * Result returned by the useManimScroll hook.
 */
export interface UseManimScrollResult {
  /** Current scroll progress (0 to 1) */
  progress: number;
  /** Whether the animation is loaded and ready */
  isReady: boolean;
  /** Error if loading/resolution failed */
  error: Error | null;
  /** Ref to attach to an optional canvas element */
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  /** Imperatively seek to a specific progress (0 to 1) */
  seek: (progress: number) => void;
  /** Pause scroll-driven updates */
  pause: () => void;
  /** Resume scroll-driven updates */
  resume: () => void;
  /** Whether scroll updates are paused */
  isPaused: boolean;
}

/**
 * Hook for advanced scroll-driven Manim animation control.
 *
 * Provides fine-grained control over the animation lifecycle, progress tracking,
 * and imperative methods for seeking and pausing.
 *
 * @example
 * ```tsx
 * function CustomAnimation() {
 *   const containerRef = useRef<HTMLDivElement>(null);
 *   const { progress, isReady, error } = useManimScroll({
 *     ref: containerRef,
 *     manifestUrl: "/assets/scene/manifest.json",
 *   });
 *
 *   return (
 *     <div ref={containerRef}>
 *       {!isReady && <Spinner />}
 *       <ProgressBar value={progress} />
 *     </div>
 *   );
 * }
 * ```
 */
export function useManimScroll(
  options: UseManimScrollOptions
): UseManimScrollResult {
  const {
    ref,
    manifestUrl: explicitManifestUrl,
    scene = "TextScene",
    animationProps = {},
    mode,
    scrollRange,
    canvasDimensions,
  } = options;

  const [progress, setProgress] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [resolvedManifestUrl, setResolvedManifestUrl] = useState<string | null>(
    explicitManifestUrl ?? null
  );

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const pausedRef = useRef(isPaused);

  // Keep pausedRef in sync
  useEffect(() => {
    pausedRef.current = isPaused;
  }, [isPaused]);

  // Memoize animation props for stable dependency
  const memoizedAnimationProps = useMemo(
    () => animationProps,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(animationProps)]
  );

  // Resolve manifest URL if not explicitly provided
  useEffect(() => {
    if (explicitManifestUrl) {
      setResolvedManifestUrl(explicitManifestUrl);
      setError(null);
      return;
    }

    resolveManifestUrl(scene, memoizedAnimationProps).then((url) => {
      if (url) {
        setResolvedManifestUrl(url);
        setError(null);
      } else {
        setError(
          new Error(
            `No pre-rendered animation found for scene "${scene}". ` +
              `Make sure to run the build with @rgbmarya/manim-scroll-next.`
          )
        );
      }
    });
  }, [explicitManifestUrl, scene, memoizedAnimationProps]);

  // Handle progress updates (respects pause state)
  const handleProgress = useCallback((p: number) => {
    if (!pausedRef.current) {
      setProgress(p);
    }
  }, []);

  // Handle ready callback
  const handleReady = useCallback(() => {
    setIsReady(true);
  }, []);

  // Register scroll animation
  useEffect(() => {
    const container = ref.current;
    if (!container || !resolvedManifestUrl) return;

    let isMounted = true;

    // Create or use existing canvas
    const canvasEl = canvasRef.current ?? document.createElement("canvas");
    if (canvasDimensions?.width) canvasEl.width = canvasDimensions.width;
    if (canvasDimensions?.height) canvasEl.height = canvasDimensions.height;

    // Only append if we created the canvas
    if (!canvasRef.current) {
      container.appendChild(canvasEl);
    }

    registerScrollAnimation({
      manifestUrl: resolvedManifestUrl,
      mode,
      scrollRange,
      onReady: handleReady,
      onProgress: handleProgress,
      container,
      canvas: canvasEl,
    }).then((dispose) => {
      if (!isMounted) {
        dispose();
        return;
      }
      cleanupRef.current = dispose;
    });

    return () => {
      isMounted = false;
      cleanupRef.current?.();
      // Only remove if we created the canvas
      if (!canvasRef.current) {
        canvasEl.remove();
      }
      setIsReady(false);
    };
  }, [
    ref,
    resolvedManifestUrl,
    mode,
    scrollRange,
    canvasDimensions?.width,
    canvasDimensions?.height,
    handleProgress,
    handleReady,
  ]);

  // Imperative methods
  const seek = useCallback((targetProgress: number) => {
    const clamped = Math.min(1, Math.max(0, targetProgress));
    setProgress(clamped);
    // Note: actual seeking in the player would require extending ScrollPlayer
    // For now, this updates the progress state for UI synchronization
  }, []);

  const pause = useCallback(() => {
    setIsPaused(true);
  }, []);

  const resume = useCallback(() => {
    setIsPaused(false);
  }, []);

  return {
    progress,
    isReady,
    error,
    canvasRef,
    seek,
    pause,
    resume,
    isPaused,
  };
}

// Re-export helper functions for use by the component
export { loadCacheManifest, resolveManifestUrl };
