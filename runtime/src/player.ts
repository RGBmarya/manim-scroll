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

  constructor(private readonly options: ScrollAnimationOptions) {
    this.container = options.container;
    this.canvas = options.canvas ?? document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d") as CanvasRenderingContext2D;

    if (!options.canvas) {
      this.container.appendChild(this.canvas);
    }
  }

  async init(): Promise<void> {
    this.manifest = await loadManifest(this.options.manifestUrl);
    this.frameCache = new FrameCache(this.manifest.frames);
    this.mode = this.selectMode(this.manifest, this.options.mode);

    this.canvas.width = this.manifest.width;
    this.canvas.height = this.manifest.height;

    if (this.mode === "video" && this.manifest.video) {
      const video = document.createElement("video");
      video.src = this.manifest.video;
      video.muted = true;
      video.playsInline = true;
      await new Promise<void>((resolve) => {
        video.addEventListener("loadedmetadata", () => resolve(), { once: true });
      });
      this.videoEl = video;
    }

    this.setupObserver();
    this.options.onReady?.();
  }

  destroy(): void {
    this.stop();
    this.observer?.disconnect();
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

  private start(): void {
    if (this.isActive) return;
    this.isActive = true;
    const loop = () => {
      this.tick();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  private stop(): void {
    if (!this.isActive) return;
    this.isActive = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
    }
  }

  private async tick(): Promise<void> {
    if (!this.manifest || !this.frameCache) return;
    const rect = this.container.getBoundingClientRect();
    const progress = resolveScrollProgress(rect, window.innerHeight, this.options.scrollRange);
    this.options.onProgress?.(progress);

    if (this.mode === "video" && this.videoEl) {
      const duration = this.videoEl.duration || 0;
      this.videoEl.currentTime = duration * progress;
      this.ctx.drawImage(this.videoEl, 0, 0, this.canvas.width, this.canvas.height);
      return;
    }

    const index = Math.round(progress * (this.frameCache.length - 1));
    const frame = await this.frameCache.load(index);
    this.ctx.drawImage(frame, 0, 0, this.canvas.width, this.canvas.height);
  }
}
