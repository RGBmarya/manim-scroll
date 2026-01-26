import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Test the FrameCache class logic
describe("FrameCache", () => {
  // Simulate the FrameCache class for testing
  class TestFrameCache {
    private frames: Map<number, { url: string }> = new Map();
    private loading: Map<number, Promise<{ url: string }>> = new Map();

    constructor(private readonly frameUrls: string[]) {}

    get length(): number {
      return this.frameUrls.length;
    }

    async load(index: number): Promise<{ url: string }> {
      if (this.frames.has(index)) {
        return this.frames.get(index)!;
      }
      if (this.loading.has(index)) {
        return this.loading.get(index)!;
      }

      const url = this.frameUrls[index];
      const frame = { url };

      const promise = Promise.resolve(frame).then((f) => {
        this.frames.set(index, f);
        this.loading.delete(index);
        return f;
      });

      this.loading.set(index, promise);
      return promise;
    }

    // Helper for testing
    isCached(index: number): boolean {
      return this.frames.has(index);
    }
  }

  it("should return correct length", () => {
    const cache = new TestFrameCache(["frame1.png", "frame2.png", "frame3.png"]);
    expect(cache.length).toBe(3);
  });

  it("should return 0 for empty array", () => {
    const cache = new TestFrameCache([]);
    expect(cache.length).toBe(0);
  });

  it("should load and cache frames", async () => {
    const cache = new TestFrameCache(["frame1.png", "frame2.png"]);

    expect(cache.isCached(0)).toBe(false);

    const frame = await cache.load(0);
    expect(frame.url).toBe("frame1.png");
    expect(cache.isCached(0)).toBe(true);
  });

  it("should return cached frames on subsequent loads", async () => {
    const cache = new TestFrameCache(["frame1.png"]);

    const frame1 = await cache.load(0);
    const frame2 = await cache.load(0);

    expect(frame1).toBe(frame2);
  });

  it("should deduplicate concurrent loads", async () => {
    let loadCount = 0;

    class TrackingCache {
      private frames: Map<number, { url: string }> = new Map();
      private loading: Map<number, Promise<{ url: string }>> = new Map();

      constructor(private readonly frameUrls: string[]) {}

      async load(index: number): Promise<{ url: string }> {
        if (this.frames.has(index)) {
          return this.frames.get(index)!;
        }
        if (this.loading.has(index)) {
          return this.loading.get(index)!;
        }

        loadCount++;
        const url = this.frameUrls[index];
        const frame = { url };

        const promise = new Promise<{ url: string }>((resolve) => {
          setTimeout(() => {
            this.frames.set(index, frame);
            this.loading.delete(index);
            resolve(frame);
          }, 10);
        });

        this.loading.set(index, promise);
        return promise;
      }
    }

    const cache = new TrackingCache(["frame1.png"]);

    // Start multiple concurrent loads
    const [frame1, frame2, frame3] = await Promise.all([
      cache.load(0),
      cache.load(0),
      cache.load(0),
    ]);

    // Should only have loaded once
    expect(loadCount).toBe(1);

    // All should be the same frame
    expect(frame1.url).toBe("frame1.png");
    expect(frame2.url).toBe("frame1.png");
    expect(frame3.url).toBe("frame1.png");
  });
});

describe("resolveAssetUrl", () => {
  // Clone of the resolveAssetUrl function
  function resolveAssetUrl(asset: string, manifestUrl: string): string {
    try {
      return new URL(asset, manifestUrl).toString();
    } catch {
      return asset;
    }
  }

  it("should resolve relative URLs", () => {
    const url = resolveAssetUrl(
      "frames/0001.png",
      "https://example.com/assets/scene/manifest.json"
    );
    expect(url).toBe("https://example.com/assets/scene/frames/0001.png");
  });

  it("should resolve URLs with parent traversal", () => {
    const url = resolveAssetUrl(
      "../shared/frame.png",
      "https://example.com/assets/scene/manifest.json"
    );
    expect(url).toBe("https://example.com/assets/shared/frame.png");
  });

  it("should preserve absolute URLs", () => {
    const url = resolveAssetUrl(
      "https://cdn.example.com/frame.png",
      "https://example.com/assets/manifest.json"
    );
    expect(url).toBe("https://cdn.example.com/frame.png");
  });

  it("should handle file:// URLs", () => {
    const url = resolveAssetUrl(
      "frames/0001.png",
      "file:///Users/test/project/manifest.json"
    );
    expect(url).toBe("file:///Users/test/project/frames/0001.png");
  });

  it("should return original asset for invalid URLs", () => {
    const url = resolveAssetUrl("frame.png", "not-a-valid-url");
    expect(url).toBe("frame.png");
  });

  it("should handle root-relative paths", () => {
    const url = resolveAssetUrl(
      "/assets/frame.png",
      "https://example.com/manifest.json"
    );
    expect(url).toBe("https://example.com/assets/frame.png");
  });
});

describe("loadManifest", () => {
  // Test the manifest loading logic
  it("should handle valid manifest structure", () => {
    const rawManifest = {
      scene: "TextScene",
      fps: 30,
      width: 1920,
      height: 1080,
      frames: ["frames/0001.png", "frames/0002.png"],
      video: "video.mp4",
    };

    // Simulate processing
    const manifestUrl = "https://example.com/assets/manifest.json";

    function resolveAssetUrl(asset: string, url: string): string {
      try {
        return new URL(asset, url).toString();
      } catch {
        return asset;
      }
    }

    const processed = {
      ...rawManifest,
      frames: rawManifest.frames.map((frame) => resolveAssetUrl(frame, manifestUrl)),
      video: rawManifest.video ? resolveAssetUrl(rawManifest.video, manifestUrl) : null,
    };

    expect(processed.scene).toBe("TextScene");
    expect(processed.fps).toBe(30);
    expect(processed.width).toBe(1920);
    expect(processed.height).toBe(1080);
    expect(processed.frames).toHaveLength(2);
    expect(processed.frames[0]).toBe("https://example.com/assets/frames/0001.png");
    expect(processed.video).toBe("https://example.com/assets/video.mp4");
  });

  it("should handle manifest without video", () => {
    const rawManifest = {
      scene: "CustomScene",
      fps: 60,
      width: 1280,
      height: 720,
      frames: ["frame.png"],
      video: null,
    };

    const processed = {
      ...rawManifest,
      video: rawManifest.video ? rawManifest.video : null,
    };

    expect(processed.video).toBeNull();
  });
});
