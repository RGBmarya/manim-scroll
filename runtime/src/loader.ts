import type { RenderManifest } from "./types";

function resolveAssetUrl(asset: string, manifestUrl: string): string {
  try {
    return new URL(asset, manifestUrl).toString();
  } catch {
    return asset;
  }
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

  constructor(private readonly frameUrls: string[]) {}

  get length(): number {
    return this.frameUrls.length;
  }

  async load(index: number): Promise<HTMLImageElement> {
    if (this.frames.has(index)) {
      return this.frames.get(index) as HTMLImageElement;
    }
    if (this.loading.has(index)) {
      return this.loading.get(index) as Promise<HTMLImageElement>;
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
}
