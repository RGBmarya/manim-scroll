export type RenderManifest = {
  scene: string;
  fps: number;
  width: number;
  height: number;
  frames: string[];
  video: string | null;
};

/**
 * Legacy scroll range format (pixels).
 */
export type ScrollRange = {
  start?: number;
  end?: number;
};

/**
 * Preset scroll range behaviors.
 * - "viewport": Animation plays as element crosses the viewport (most common)
 * - "element": Animation tied to element's own scroll position
 * - "full": Animation spans entire document scroll
 */
export type ScrollRangePreset = "viewport" | "element" | "full";

/**
 * Flexible scroll range value that supports:
 * - Presets: "viewport" | "element" | "full"
 * - Tuple with relative units: ["100vh", "-50%"] or [100, -200]
 * - Legacy object format: { start?: number, end?: number }
 */
export type ScrollRangeValue =
  | ScrollRangePreset
  | [start: string | number, end: string | number]
  | ScrollRange;

export type ScrollAnimationOptions = {
  container: HTMLElement;
  manifestUrl: string;
  mode?: "auto" | "frames" | "video";
  canvas?: HTMLCanvasElement;
  scrollRange?: ScrollRangeValue;
  onReady?: () => void;
  onProgress?: (progress: number) => void;
};
