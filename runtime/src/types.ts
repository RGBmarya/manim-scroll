export type RenderManifest = {
  scene: string;
  fps: number;
  width: number;
  height: number;
  frames: string[];
  video: string | null;
  /** Whether the animation was rendered with transparent background */
  transparent?: boolean;
  /** Whether this is an inline animation with tight bounds */
  inline?: boolean;
  /** Aspect ratio of the text content (for inline sizing) */
  aspectRatio?: number | null;
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

/**
 * Options for native text animation (no pre-rendered assets).
 * Replicates Manim's Write/DrawBorderThenFill animation in the browser.
 */
/** Easing function type: takes a progress value (0 to 1) and returns eased progress */
export type EasingFunction = (t: number) => number;

/** Pre-built easing presets */
export type EasingPreset = "linear" | "ease-in" | "ease-out" | "ease-in-out" | "smooth";

/** Options for duration-based animation playback */
export type PlaybackOptions = {
  /** Animation duration in milliseconds */
  duration?: number;
  /** Delay before starting in milliseconds */
  delay?: number;
  /** Easing function or preset */
  easing?: EasingPreset | EasingFunction;
  /** Whether to loop the animation */
  loop?: boolean;
  /** Play direction: 1 for forward, -1 for reverse */
  direction?: 1 | -1;
  /** Callback when playback completes (not called if loop is true) */
  onComplete?: () => void;
};

export type NativeAnimationOptions = {
  /** The container element to render the animation into */
  container: HTMLElement;
  /** The text to animate */
  text: string;
  /** Font size in pixels. If not specified, inherits from parent element. */
  fontSize?: number;
  /** Text color (hex or CSS color) */
  color?: string;
  /** URL to a font file (woff, woff2, ttf, otf) for opentype.js */
  fontUrl?: string;
  /** Stroke width for the drawing phase (default: 2, matches Manim's DrawBorderThenFill) */
  strokeWidth?: number;
  /** Scroll range configuration. Ignored when progress is provided. */
  scrollRange?: ScrollRangeValue;
  /** 
   * Explicit progress value (0 to 1). When provided, disables scroll-based control
   * and renders the animation at this exact progress.
   */
  progress?: number;
  /** Called when animation is loaded and ready */
  onReady?: () => void;
  /** Called on scroll progress updates */
  onProgress?: (progress: number) => void;
};
