import * as fs from "fs";
import * as path from "path";
import type { ExtractedAnimation } from "./extractor";

export interface CacheEntry {
  /** The hash of the animation props */
  hash: string;
  /** Scene name */
  scene: string;
  /** Original props */
  props: Record<string, unknown>;
  /** Path to the manifest.json file */
  manifestPath: string;
  /** URL path for runtime use */
  manifestUrl: string;
}

export interface CacheManifest {
  /** Version of the cache format */
  version: number;
  /** Map of animation hash to manifest URL */
  animations: Record<string, string>;
}

const CACHE_VERSION = 1;

/**
 * Compute a deterministic hash for animation props.
 * This hash is used as the cache key and for runtime lookup.
 *
 * Note: This uses a simple hash function that works identically
 * in both Node.js and browser environments.
 */
export function computePropsHash(scene: string, props: Record<string, unknown>): string {
  // Create a deterministic string representation
  // Sort keys to ensure consistent ordering
  const sortedProps = sortObjectKeys(props);
  const data = JSON.stringify({ scene, props: sortedProps });

  // Use djb2 hash algorithm - fast and produces good distribution
  let hash = 5381;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) + hash + data.charCodeAt(i)) | 0;
  }

  // Convert to positive hex string, padded to 8 chars
  const hexHash = (hash >>> 0).toString(16).padStart(8, "0");
  return hexHash;
}

/**
 * Recursively sort object keys for deterministic JSON stringification.
 */
function sortObjectKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }

  const sorted: Record<string, unknown> = {};
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  for (const key of keys) {
    sorted[key] = sortObjectKeys((obj as Record<string, unknown>)[key]);
  }
  return sorted;
}

/**
 * Check if an animation is already cached.
 */
export function isCached(hash: string, publicDir: string): boolean {
  const manifestPath = path.join(publicDir, "manim-assets", hash, "manifest.json");
  return fs.existsSync(manifestPath);
}

/**
 * Get the cache entry for an animation if it exists.
 */
export function getCacheEntry(hash: string, publicDir: string): CacheEntry | null {
  const assetDir = path.join(publicDir, "manim-assets", hash);
  const manifestPath = path.join(assetDir, "manifest.json");

  if (!fs.existsSync(manifestPath)) {
    return null;
  }

  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    return {
      hash,
      scene: manifest.scene,
      props: {},
      manifestPath,
      manifestUrl: `/manim-assets/${hash}/manifest.json`,
    };
  } catch {
    return null;
  }
}

/**
 * Determine which animations need to be rendered (not in cache).
 */
export function getAnimationsToRender(
  animations: ExtractedAnimation[],
  publicDir: string
): { cached: CacheEntry[]; toRender: ExtractedAnimation[] } {
  const cached: CacheEntry[] = [];
  const toRender: ExtractedAnimation[] = [];

  for (const animation of animations) {
    const hash = computePropsHash(animation.scene, animation.props);
    const entry = getCacheEntry(hash, publicDir);

    if (entry) {
      cached.push(entry);
    } else {
      toRender.push(animation);
    }
  }

  return { cached, toRender };
}

/**
 * Ensure the manim-assets directory exists.
 */
export function ensureAssetDir(publicDir: string): string {
  const assetDir = path.join(publicDir, "manim-assets");
  if (!fs.existsSync(assetDir)) {
    fs.mkdirSync(assetDir, { recursive: true });
  }
  return assetDir;
}

/**
 * Get the output directory for a specific animation hash.
 */
export function getOutputDir(hash: string, publicDir: string): string {
  return path.join(publicDir, "manim-assets", hash);
}

/**
 * Write the runtime cache manifest that maps hashes to manifest URLs.
 * This is used by the React component to look up animations at runtime.
 */
export function writeCacheManifest(
  animations: ExtractedAnimation[],
  publicDir: string
): void {
  const manifest: CacheManifest = {
    version: CACHE_VERSION,
    animations: {},
  };

  for (const animation of animations) {
    const hash = computePropsHash(animation.scene, animation.props);
    manifest.animations[hash] = `/manim-assets/${hash}/manifest.json`;
  }

  const manifestPath = path.join(publicDir, "manim-assets", "cache-manifest.json");
  ensureAssetDir(publicDir);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

/**
 * Read the existing cache manifest if it exists.
 */
export function readCacheManifest(publicDir: string): CacheManifest | null {
  const manifestPath = path.join(publicDir, "manim-assets", "cache-manifest.json");

  if (!fs.existsSync(manifestPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(manifestPath, "utf-8");
    const manifest = JSON.parse(content) as CacheManifest;

    if (manifest.version !== CACHE_VERSION) {
      return null;
    }

    return manifest;
  } catch {
    return null;
  }
}

/**
 * Clean up orphaned cache entries that are no longer referenced.
 */
export function cleanOrphanedCache(
  animations: ExtractedAnimation[],
  publicDir: string
): void {
  const assetDir = path.join(publicDir, "manim-assets");

  if (!fs.existsSync(assetDir)) {
    return;
  }

  // Get all valid hashes
  const validHashes = new Set(
    animations.map((a) => computePropsHash(a.scene, a.props))
  );

  // Check each directory in manim-assets
  const entries = fs.readdirSync(assetDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory() && !validHashes.has(entry.name)) {
      // This hash is no longer used, remove it
      const dirPath = path.join(assetDir, entry.name);
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  }
}
