import type { RenderManifest } from "./types";

/**
 * Resolve an asset URL relative to the manifest URL.
 * Handles both absolute manifest URLs (with protocol) and path-only URLs.
 */
function resolveAssetUrl(asset: string, manifestUrl: string): string {
  // If asset is already absolute, return as-is
  if (asset.startsWith("http://") || asset.startsWith("https://") || asset.startsWith("/")) {
    return asset;
  }

  // Get the directory of the manifest
  const lastSlash = manifestUrl.lastIndexOf("/");
  const baseDir = lastSlash >= 0 ? manifestUrl.substring(0, lastSlash + 1) : "";

  // Resolve relative path
  return baseDir + asset;
}

export async function loadManifest(url: string): Promise<RenderManifest> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load manifest: ${response.status}`);
  }
  const manifest = (await response.json()) as RenderManifest;
  return {
    ...manifest,
    frames: manifest.frames.map((frame) => resolveAssetUrl(frame, url)),
    video: manifest.video ? resolveAssetUrl(manifest.video, url) : null,
  };
}

export class FrameCache {
  private frames: Map<number, HTMLImageElement> = new Map();
  private loading: Map<number, Promise<HTMLImageElement>> = new Map();
  private preloadAhead = 5; // Number of frames to preload ahead

  constructor(private readonly frameUrls: string[]) {}

  get length(): number {
    return this.frameUrls.length;
  }

  async load(index: number): Promise<HTMLImageElement> {
    // Start preloading nearby frames
    this.preloadNearby(index);
    
    if (this.frames.has(index)) {
      return this.frames.get(index) as HTMLImageElement;
    }
    if (this.loading.has(index)) {
      return this.loading.get(index) as Promise<HTMLImageElement>;
    }
    return this.loadFrame(index);
  }

  private async loadFrame(index: number): Promise<HTMLImageElement> {
    if (index < 0 || index >= this.frameUrls.length) {
      throw new Error(`Frame index out of bounds: ${index}`);
    }
    
    const url = this.frameUrls[index];
    const promise = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.frames.set(index, img);
        this.loading.delete(index);
        resolve(img);
      };
      img.onerror = () => {
        this.loading.delete(index);
        reject(new Error(`Failed to load frame: ${url}`));
      };
      img.src = url;
    });
    this.loading.set(index, promise);
    return promise;
  }

  private preloadNearby(currentIndex: number): void {
    // Preload frames ahead and behind
    for (let offset = 1; offset <= this.preloadAhead; offset++) {
      const ahead = currentIndex + offset;
      const behind = currentIndex - offset;
      
      if (ahead < this.frameUrls.length && !this.frames.has(ahead) && !this.loading.has(ahead)) {
        this.loadFrame(ahead).catch(() => {}); // Silently ignore preload failures
      }
      if (behind >= 0 && !this.frames.has(behind) && !this.loading.has(behind)) {
        this.loadFrame(behind).catch(() => {}); // Silently ignore preload failures
      }
    }
  }
}
