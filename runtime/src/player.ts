import { FrameCache, loadManifest } from "./loader";
import type {
  RenderManifest,
  ScrollAnimationOptions,
  ScrollRange,
  ScrollRangeValue,
} from "./types";

type PlayerMode = "frames" | "video";

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/**
 * Parse a relative unit string (e.g., "100vh", "-50%") to pixels.
 * - "vh" units are relative to viewport height
 * - "%" units are relative to element height
 * - Numbers without units are treated as pixels
 */
function parseRelativeUnit(
  value: string | number,
  viewportHeight: number,
  elementHeight: number
): number {
  if (typeof value === "number") {
    return value;
  }

  const trimmed = value.trim();

  // Handle viewport height units
  if (trimmed.endsWith("vh")) {
    const num = parseFloat(trimmed.slice(0, -2));
    return (num / 100) * viewportHeight;
  }

  // Handle percentage (relative to element height)
  if (trimmed.endsWith("%")) {
    const num = parseFloat(trimmed.slice(0, -1));
    return (num / 100) * elementHeight;
  }

  // Handle pixel units or plain numbers
  if (trimmed.endsWith("px")) {
    return parseFloat(trimmed.slice(0, -2));
  }

  return parseFloat(trimmed);
}

/**
 * Resolve a ScrollRangeValue to a normalized { start, end } object in pixels.
 * Supports presets, tuple format, and legacy object format.
 */
function resolveScrollRange(
  range: ScrollRangeValue | undefined,
  viewportHeight: number,
  elementHeight: number,
  documentHeight: number
): ScrollRange {
  // Default: viewport preset behavior
  if (range === undefined || range === "viewport") {
    return {
      start: viewportHeight,
      end: -elementHeight,
    };
  }

  // Element preset: animation tied to element's scroll position
  if (range === "element") {
    return {
      start: viewportHeight * 0.8,
      end: viewportHeight * 0.2 - elementHeight,
    };
  }

  // Full preset: spans entire document scroll
  if (range === "full") {
    return {
      start: documentHeight - viewportHeight,
      end: 0,
    };
  }

  // Tuple format: [start, end] with relative units
  if (Array.isArray(range)) {
    const [startVal, endVal] = range;
    return {
      start: parseRelativeUnit(startVal, viewportHeight, elementHeight),
      end: parseRelativeUnit(endVal, viewportHeight, elementHeight),
    };
  }

  // Legacy object format
  return {
    start: range.start ?? viewportHeight,
    end: range.end ?? -elementHeight,
  };
}

function resolveScrollProgress(
  rect: DOMRect,
  viewportHeight: number,
  range?: ScrollRangeValue
): number {
  const documentHeight = document.documentElement.scrollHeight;
  const resolved = resolveScrollRange(range, viewportHeight, rect.height, documentHeight);
  const start = resolved.start ?? viewportHeight;
  const end = resolved.end ?? -rect.height;
  const progress = (start - rect.top) / (start - end);
  return clamp(progress, 0, 1);
}

export class ScrollPlayer {
  private readonly container: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private manifest?: RenderManifest;
  private frameCache?: FrameCache;
  private videoEl?: HTMLVideoElement;
  private mode: PlayerMode = "video";
  private isActive = false;
  private rafId: number | null = null;
  private observer?: IntersectionObserver;
  private lastProgress = -1;
  private lastFrameIndex = -1;
  private scrollHandler?: () => void;
  private resizeHandler?: () => void;
  private pendingDraw = false;
  private pendingResize = false;
  private isTransparent = false;

  constructor(private readonly options: ScrollAnimationOptions) {
    this.container = options.container;
    this.canvas = options.canvas ?? document.createElement("canvas");
    // Use willReadFrequently: false for better performance with transparent compositing
    this.ctx = this.canvas.getContext("2d", { alpha: true }) as CanvasRenderingContext2D;

    if (!options.canvas) {
      this.container.appendChild(this.canvas);
    }
  }

  async init(): Promise<void> {
    this.manifest = await loadManifest(this.options.manifestUrl);
    this.frameCache = new FrameCache(this.manifest.frames);
    this.mode = this.selectMode(this.manifest, this.options.mode);
    this.isTransparent = this.manifest.transparent ?? false;

    this.canvas.width = this.manifest.width;
    this.canvas.height = this.manifest.height;

    // For inline mode, style the canvas to match text flow
    if (this.manifest.inline) {
      this.canvas.style.background = "transparent";
      this.canvas.style.display = "inline-block";
      this.canvas.style.verticalAlign = "middle";
      // Height matches line height (set in em units for text scaling)
      this.canvas.style.height = "1em";
      // Width is calculated from aspect ratio
      if (this.manifest.aspectRatio) {
        this.canvas.style.width = `${this.manifest.aspectRatio}em`;
      } else {
        this.canvas.style.width = "auto";
      }
    } else if (this.isTransparent) {
      // Non-inline transparent mode
      this.canvas.style.background = "transparent";
    }

    if (this.mode === "video" && this.manifest.video) {
      const video = document.createElement("video");
      video.src = this.manifest.video;
      video.muted = true;
      video.playsInline = true;
      video.preload = "auto";
      // Wait for enough data to be loaded to allow seeking
      await new Promise<void>((resolve, reject) => {
        video.addEventListener("canplaythrough", () => resolve(), { once: true });
        video.addEventListener("error", () => reject(new Error("Failed to load video")), { once: true });
        // Fallback timeout
        setTimeout(() => resolve(), 5000);
      });
      this.videoEl = video;
    }

    this.setupObserver();
    this.setupResizeHandling();
    
    // Draw the first frame immediately so the canvas isn't blank
    await this.drawInitialFrame();
    
    this.options.onReady?.();
  }

  destroy(): void {
    this.stop();
    this.observer?.disconnect();
    if (this.resizeHandler) {
      window.removeEventListener("resize", this.resizeHandler);
      this.resizeHandler = undefined;
    }
    if (!this.options.canvas) {
      this.canvas.remove();
    }
  }

  private selectMode(
    manifest: RenderManifest,
    mode: ScrollAnimationOptions["mode"]
  ): PlayerMode {
    if (mode === "frames") return "frames";
    if (mode === "video" && manifest.video) return "video";
    if (mode === "video" && !manifest.video) return "frames";
    return manifest.video ? "video" : "frames";
  }

  private async drawInitialFrame(): Promise<void> {
    if (!this.manifest || !this.frameCache) return;
    
    try {
      // Clear canvas for transparent mode
      if (this.isTransparent) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      }

      if (this.mode === "video" && this.videoEl) {
        // Seek to start and draw first frame
        this.videoEl.currentTime = 0;
        // Wait for seek to complete
        await new Promise<void>((resolve) => {
          this.videoEl!.addEventListener("seeked", () => resolve(), { once: true });
          setTimeout(() => resolve(), 100); // Fallback
        });
        this.ctx.drawImage(this.videoEl, 0, 0, this.canvas.width, this.canvas.height);
      } else if (this.frameCache.length > 0) {
        const frame = await this.frameCache.load(0);
        this.ctx.drawImage(frame, 0, 0, this.canvas.width, this.canvas.height);
      }
    } catch (e) {
      console.warn("[manim-scroll] Failed to draw initial frame:", e);
    }
  }

  private setupObserver(): void {
    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            this.start();
          } else {
            this.stop();
          }
        }
      },
      { root: null, threshold: 0 }
    );
    this.observer.observe(this.container);
  }

  /**
   * Set up window resize handling for responsive scroll progress calculation.
   * When the viewport height changes, scroll progress needs to be recalculated.
   */
  private setupResizeHandling(): void {
    this.resizeHandler = () => {
      if (!this.pendingResize) {
        this.pendingResize = true;
        requestAnimationFrame(() => {
          this.pendingResize = false;
          // Force recalculation of scroll progress by resetting last progress
          this.lastProgress = -1;
          if (this.isActive) {
            this.tick();
          }
        });
      }
    };
    window.addEventListener("resize", this.resizeHandler, { passive: true });
  }

  private start(): void {
    if (this.isActive) return;
    this.isActive = true;

    // Use scroll event listener with RAF throttling for efficiency
    this.scrollHandler = () => {
      if (!this.pendingDraw) {
        this.pendingDraw = true;
        this.rafId = requestAnimationFrame(() => {
          this.pendingDraw = false;
          this.tick();
        });
      }
    };

    window.addEventListener("scroll", this.scrollHandler, { passive: true });
    // Initial tick
    this.tick();
  }

  private stop(): void {
    if (!this.isActive) return;
    this.isActive = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
    }
    if (this.scrollHandler) {
      window.removeEventListener("scroll", this.scrollHandler);
      this.scrollHandler = undefined;
    }
  }

  private async tick(): Promise<void> {
    if (!this.manifest || !this.frameCache) return;
    
    const rect = this.container.getBoundingClientRect();
    const progress = resolveScrollProgress(rect, window.innerHeight, this.options.scrollRange);
    
    // Skip if progress hasn't changed significantly (threshold: 0.1%)
    if (Math.abs(progress - this.lastProgress) < 0.001) {
      return;
    }
    this.lastProgress = progress;
    this.options.onProgress?.(progress);

    if (this.mode === "video" && this.videoEl) {
      const duration = this.videoEl.duration || 0;
      const targetTime = duration * progress;
      // Only seek if time changed by more than half a frame (assuming 30fps)
      if (Math.abs(this.videoEl.currentTime - targetTime) > 0.016) {
        this.videoEl.currentTime = targetTime;
        // Clear before drawing for transparent mode
        if (this.isTransparent) {
          this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
        this.ctx.drawImage(this.videoEl, 0, 0, this.canvas.width, this.canvas.height);
      }
      return;
    }

    const index = Math.round(progress * (this.frameCache.length - 1));
    // Skip if same frame
    if (index === this.lastFrameIndex) {
      return;
    }
    this.lastFrameIndex = index;
    
    // Clear before drawing for transparent mode
    if (this.isTransparent) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    const frame = await this.frameCache.load(index);
    this.ctx.drawImage(frame, 0, 0, this.canvas.width, this.canvas.height);
  }
}
