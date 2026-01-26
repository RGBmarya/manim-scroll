import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  computePropsHash,
  isCached,
  getCacheEntry,
  getAnimationsToRender,
  ensureAssetDir,
  getOutputDir,
  writeCacheManifest,
  readCacheManifest,
  cleanOrphanedCache,
} from "./cache";

// Mock fs module
vi.mock("fs");

describe("computePropsHash", () => {
  it("should produce consistent hashes for same input", () => {
    const hash1 = computePropsHash("TextScene", { text: "Hello", fontSize: 72 });
    const hash2 = computePropsHash("TextScene", { text: "Hello", fontSize: 72 });
    expect(hash1).toBe(hash2);
  });

  it("should produce different hashes for different scenes", () => {
    const hash1 = computePropsHash("TextScene", { text: "Hello" });
    const hash2 = computePropsHash("CustomScene", { text: "Hello" });
    expect(hash1).not.toBe(hash2);
  });

  it("should produce different hashes for different props", () => {
    const hash1 = computePropsHash("TextScene", { text: "Hello" });
    const hash2 = computePropsHash("TextScene", { text: "World" });
    expect(hash1).not.toBe(hash2);
  });

  it("should normalize key order", () => {
    const hash1 = computePropsHash("TextScene", { a: 1, b: 2, c: 3 });
    const hash2 = computePropsHash("TextScene", { c: 3, a: 1, b: 2 });
    expect(hash1).toBe(hash2);
  });

  it("should handle empty props", () => {
    const hash = computePropsHash("TextScene", {});
    expect(hash).toHaveLength(8);
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it("should handle nested objects with sorted keys", () => {
    const hash1 = computePropsHash("Scene", { config: { b: 2, a: 1 } });
    const hash2 = computePropsHash("Scene", { config: { a: 1, b: 2 } });
    expect(hash1).toBe(hash2);
  });

  it("should handle arrays (preserving order)", () => {
    const hash1 = computePropsHash("Scene", { items: [1, 2, 3] });
    const hash2 = computePropsHash("Scene", { items: [3, 2, 1] });
    expect(hash1).not.toBe(hash2);
  });
});

describe("isCached", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should return true when manifest exists", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);

    const result = isCached("abc12345", "/public");

    expect(result).toBe(true);
    expect(fs.existsSync).toHaveBeenCalledWith(
      path.join("/public", "manim-assets", "abc12345", "manifest.json")
    );
  });

  it("should return false when manifest does not exist", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = isCached("abc12345", "/public");

    expect(result).toBe(false);
  });
});

describe("getCacheEntry", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should return null when manifest does not exist", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = getCacheEntry("abc12345", "/public");

    expect(result).toBeNull();
  });

  it("should return cache entry when manifest exists", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ scene: "TextScene", fps: 30 })
    );

    const result = getCacheEntry("abc12345", "/public");

    expect(result).toEqual({
      hash: "abc12345",
      scene: "TextScene",
      props: {},
      manifestPath: path.join("/public", "manim-assets", "abc12345", "manifest.json"),
      manifestUrl: "/manim-assets/abc12345/manifest.json",
    });
  });

  it("should return null when manifest is invalid JSON", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue("invalid json");

    const result = getCacheEntry("abc12345", "/public");

    expect(result).toBeNull();
  });
});

describe("getAnimationsToRender", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should separate cached and uncached animations", () => {
    const animations = [
      { id: "1", filePath: "a.tsx", line: 1, scene: "TextScene", props: { text: "Hello" } },
      { id: "2", filePath: "b.tsx", line: 2, scene: "TextScene", props: { text: "World" } },
    ];

    // First animation is cached, second is not
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const pathStr = String(p);
      return pathStr.includes(computePropsHash("TextScene", { text: "Hello" }));
    });

    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ scene: "TextScene" }));

    const result = getAnimationsToRender(animations, "/public");

    expect(result.cached).toHaveLength(1);
    expect(result.toRender).toHaveLength(1);
    expect(result.toRender[0].props.text).toBe("World");
  });

  it("should return all as toRender when none are cached", () => {
    const animations = [
      { id: "1", filePath: "a.tsx", line: 1, scene: "TextScene", props: { text: "Hello" } },
    ];

    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = getAnimationsToRender(animations, "/public");

    expect(result.cached).toHaveLength(0);
    expect(result.toRender).toHaveLength(1);
  });

  it("should return all as cached when all exist", () => {
    const animations = [
      { id: "1", filePath: "a.tsx", line: 1, scene: "TextScene", props: { text: "Hello" } },
    ];

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ scene: "TextScene" }));

    const result = getAnimationsToRender(animations, "/public");

    expect(result.cached).toHaveLength(1);
    expect(result.toRender).toHaveLength(0);
  });
});

describe("ensureAssetDir", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should create directory if it does not exist", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.mkdirSync).mockReturnValue(undefined);

    const result = ensureAssetDir("/public");

    expect(result).toBe(path.join("/public", "manim-assets"));
    expect(fs.mkdirSync).toHaveBeenCalledWith(
      path.join("/public", "manim-assets"),
      { recursive: true }
    );
  });

  it("should not create directory if it exists", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);

    const result = ensureAssetDir("/public");

    expect(result).toBe(path.join("/public", "manim-assets"));
    expect(fs.mkdirSync).not.toHaveBeenCalled();
  });
});

describe("getOutputDir", () => {
  it("should return correct output directory path", () => {
    const result = getOutputDir("abc12345", "/public");
    expect(result).toBe(path.join("/public", "manim-assets", "abc12345"));
  });
});

describe("writeCacheManifest", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should write cache manifest with correct content", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.writeFileSync).mockReturnValue(undefined);

    const animations = [
      { id: "1", filePath: "a.tsx", line: 1, scene: "TextScene", props: { text: "Hello" } },
      { id: "2", filePath: "b.tsx", line: 2, scene: "TextScene", props: { text: "World" } },
    ];

    writeCacheManifest(animations, "/public");

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      path.join("/public", "manim-assets", "cache-manifest.json"),
      expect.stringContaining('"version":')
    );
  });

  it("should generate correct hash for each animation", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    let writtenContent = "";
    vi.mocked(fs.writeFileSync).mockImplementation((_, content) => {
      writtenContent = String(content);
    });

    const animations = [
      { id: "1", filePath: "a.tsx", line: 1, scene: "TextScene", props: { text: "Test" } },
    ];

    writeCacheManifest(animations, "/public");

    const manifest = JSON.parse(writtenContent);
    const hash = computePropsHash("TextScene", { text: "Test" });

    expect(manifest.version).toBe(1);
    expect(manifest.animations[hash]).toBe(`/manim-assets/${hash}/manifest.json`);
  });
});

describe("readCacheManifest", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should return null when manifest does not exist", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = readCacheManifest("/public");

    expect(result).toBeNull();
  });

  it("should return manifest when it exists and is valid", () => {
    const manifest = {
      version: 1,
      animations: { abc123: "/manim-assets/abc123/manifest.json" },
    };

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(manifest));

    const result = readCacheManifest("/public");

    expect(result).toEqual(manifest);
  });

  it("should return null for wrong version", () => {
    const manifest = {
      version: 999, // Wrong version
      animations: {},
    };

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(manifest));

    const result = readCacheManifest("/public");

    expect(result).toBeNull();
  });

  it("should return null for invalid JSON", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue("invalid json");

    const result = readCacheManifest("/public");

    expect(result).toBeNull();
  });
});

describe("cleanOrphanedCache", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should do nothing if asset directory does not exist", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    cleanOrphanedCache([], "/public");

    expect(fs.readdirSync).not.toHaveBeenCalled();
  });

  it("should remove orphaned directories", () => {
    const animations = [
      { id: "1", filePath: "a.tsx", line: 1, scene: "TextScene", props: { text: "Keep" } },
    ];

    const validHash = computePropsHash("TextScene", { text: "Keep" });
    const orphanHash = "deadbeef";

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue([
      { name: validHash, isDirectory: () => true },
      { name: orphanHash, isDirectory: () => true },
      { name: "cache-manifest.json", isDirectory: () => false },
    ] as any);
    vi.mocked(fs.rmSync).mockReturnValue(undefined);

    cleanOrphanedCache(animations, "/public");

    expect(fs.rmSync).toHaveBeenCalledWith(
      path.join("/public", "manim-assets", orphanHash),
      { recursive: true, force: true }
    );
    expect(fs.rmSync).toHaveBeenCalledTimes(1);
  });

  it("should not remove valid cache entries", () => {
    const animations = [
      { id: "1", filePath: "a.tsx", line: 1, scene: "TextScene", props: { text: "Keep" } },
    ];

    const validHash = computePropsHash("TextScene", { text: "Keep" });

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue([
      { name: validHash, isDirectory: () => true },
    ] as any);
    vi.mocked(fs.rmSync).mockReturnValue(undefined);

    cleanOrphanedCache(animations, "/public");

    expect(fs.rmSync).not.toHaveBeenCalled();
  });
});
