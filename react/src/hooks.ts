import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { registerScrollAnimation, registerNativeAnimation } from "@mihirsarya/manim-scroll-runtime";
import type { ScrollRangeValue, NativeAnimationOptions } from "@mihirsarya/manim-scroll-runtime";
import { computePropsHash } from "./hash";

// Cache manifest type
interface CacheManifest {
  version: number;
  animations: Record<string, string>;
}

// Global cache manifest state
let cachedManifest: CacheManifest | null = null;
let manifestFetchPromise: Promise<CacheManifest | null> | null = null;
let lastFetchTime = 0;

// In dev mode, allow manifest to be refreshed every 2 seconds
const MANIFEST_CACHE_TTL = process.env.NODE_ENV === "development" ? 2000 : Infinity;

/**
 * Load the cache manifest from the public directory.
 * In dev mode, refreshes the manifest periodically to pick up newly rendered animations.
 */
async function loadCacheManifest(forceRefresh = false): Promise<CacheManifest | null> {
  const now = Date.now();
  const isStale = now - lastFetchTime > MANIFEST_CACHE_TTL;

  // Return cached manifest if fresh
  if (cachedManifest && !isStale && !forceRefresh) {
    return cachedManifest;
  }

  // If already fetching, wait for that
  if (manifestFetchPromise && !forceRefresh) {
    return manifestFetchPromise;
  }

  lastFetchTime = now;
  manifestFetchPromise = fetch("/manim-assets/cache-manifest.json", {
    cache: forceRefresh ? "no-store" : "default",
  })
    .then((response) => {
      if (!response.ok) {
        return null;
      }
      return response.json() as Promise<CacheManifest>;
    })
    .then((manifest) => {
      cachedManifest = manifest;
      manifestFetchPromise = null;
      return manifest;
    })
    .catch(() => {
      manifestFetchPromise = null;
      return null;
    });

  return manifestFetchPromise;
}

/**
 * Resolve the manifest URL for the given animation props.
 * In dev mode, retries with manifest refresh if animation not found.
 */
async function resolveManifestUrl(
  scene: string,
  props: Record<string, unknown>,
  retryCount = 0
): Promise<string | null> {
  const manifest = await loadCacheManifest(retryCount > 0);
  if (!manifest) {
    return null;
  }

  const hash = computePropsHash(scene, props);
  const url = manifest.animations[hash];

  if (url) {
    return url;
  }

  // In dev mode, retry a few times as animations might still be rendering
  if (process.env.NODE_ENV === "development" && retryCount < 5) {
    await new Promise((resolve) => setTimeout(resolve, 1000 * (retryCount + 1)));
    return resolveManifestUrl(scene, props, retryCount + 1);
  }

  return null;
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
  /** Whether the hook is enabled (default: true) */
  enabled?: boolean;
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
    enabled = true,
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
    if (!enabled) return;

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
              `Make sure to run the build with @mihirsarya/manim-scroll-next.`
          )
        );
      }
    });
  }, [enabled, explicitManifestUrl, scene, memoizedAnimationProps]);

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
    if (!enabled) return;

    const container = ref.current;
    if (!container || !resolvedManifestUrl) return;

    let isMounted = true;

    // Create or use existing canvas
    const canvasEl = canvasRef.current ?? document.createElement("canvas");
    if (canvasDimensions?.width) canvasEl.width = canvasDimensions.width;
    if (canvasDimensions?.height) canvasEl.height = canvasDimensions.height;

    // Check if inline mode
    const isInline = animationProps.inline === true;

    // Only append if we created the canvas
    if (!canvasRef.current) {
      if (!isInline) {
        // Block mode: fill container
        canvasEl.style.width = "100%";
        canvasEl.style.height = "100%";
        canvasEl.style.objectFit = "contain";
        canvasEl.style.display = "block";
      }
      // For inline mode, let the player set styles based on manifest data
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
    enabled,
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

/**
 * Options for the useNativeAnimation hook.
 */
export interface UseNativeAnimationOptions {
  /** Ref to the container element */
  ref: React.RefObject<HTMLElement | null>;
  /** The text to animate */
  text: string;
  /** Font size in pixels. If not specified, inherits from parent element. */
  fontSize?: number;
  /** Text color (hex or CSS color) */
  color?: string;
  /** URL to a font file (woff, woff2, ttf, otf) for opentype.js */
  fontUrl?: string;
  /** Stroke width for the drawing phase */
  strokeWidth?: number;
  /** Scroll range configuration */
  scrollRange?: ScrollRangeValue;
  /** Whether the hook is enabled (default: true) */
  enabled?: boolean;
}

/**
 * Result returned by the useNativeAnimation hook.
 */
export interface UseNativeAnimationResult {
  /** Current scroll progress (0 to 1) */
  progress: number;
  /** Whether the animation is loaded and ready */
  isReady: boolean;
  /** Error if initialization failed */
  error: Error | null;
  /** Pause scroll-driven updates */
  pause: () => void;
  /** Resume scroll-driven updates */
  resume: () => void;
  /** Whether scroll updates are paused */
  isPaused: boolean;
}

/**
 * Hook for native text animation that renders directly in the browser
 * using SVG, replicating Manim's Write/DrawBorderThenFill effect.
 *
 * This hook bypasses the manifest resolution and pre-rendered assets,
 * instead animating text natively using opentype.js and SVG.
 *
 * @example
 * ```tsx
 * function NativeTextAnimation() {
 *   const containerRef = useRef<HTMLDivElement>(null);
 *   const { progress, isReady } = useNativeAnimation({
 *     ref: containerRef,
 *     text: "Hello World",
 *     fontSize: 48,
 *     color: "#ffffff",
 *   });
 *
 *   return (
 *     <div ref={containerRef} style={{ height: "100vh" }}>
 *       {!isReady && <div>Loading...</div>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useNativeAnimation(
  options: UseNativeAnimationOptions
): UseNativeAnimationResult {
  const {
    ref,
    text,
    fontSize, // undefined means inherit from parent
    color = "#ffffff",
    fontUrl,
    strokeWidth = 2, // Manim's DrawBorderThenFill default
    scrollRange,
    enabled = true,
  } = options;

  const [progress, setProgress] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  const cleanupRef = useRef<(() => void) | null>(null);
  const pausedRef = useRef(isPaused);

  // Keep pausedRef in sync
  useEffect(() => {
    pausedRef.current = isPaused;
  }, [isPaused]);

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

  // Register native animation
  useEffect(() => {
    if (!enabled) return;

    const container = ref.current;
    if (!container || !text) return;

    let isMounted = true;

    const nativeOptions: NativeAnimationOptions = {
      container,
      text,
      fontSize,
      color,
      fontUrl,
      strokeWidth,
      scrollRange,
      onReady: handleReady,
      onProgress: handleProgress,
    };

    registerNativeAnimation(nativeOptions)
      .then((dispose: () => void) => {
        if (!isMounted) {
          dispose();
          return;
        }
        cleanupRef.current = dispose;
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      });

    return () => {
      isMounted = false;
      cleanupRef.current?.();
      setIsReady(false);
    };
  }, [enabled, ref, text, fontSize, color, fontUrl, strokeWidth, scrollRange, handleProgress, handleReady]);

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
    pause,
    resume,
    isPaused,
  };
}
