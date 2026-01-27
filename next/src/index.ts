import * as fs from "fs";
import * as path from "path";
import type { NextConfig } from "next";
import { extractAnimations } from "./extractor";
import {
  getAnimationsToRender,
  writeCacheManifest,
  cleanOrphanedCache,
  computePropsHash,
  ensureAssetDir,
  readCacheManifest,
} from "./cache";
import { renderAnimations, RenderOptions } from "./renderer";

/**
 * Ensure a cache manifest file exists (preserving existing entries).
 * This is called synchronously so the file exists before the page loads.
 */
function ensureCacheManifestExists(publicDir: string): void {
  const manifestPath = path.join(publicDir, "manim-assets", "cache-manifest.json");

  // If manifest already exists, leave it alone
  if (fs.existsSync(manifestPath)) {
    return;
  }

  // Create the directory and an empty manifest
  ensureAssetDir(publicDir);
  fs.writeFileSync(
    manifestPath,
    JSON.stringify({ version: 1, animations: {} }, null, 2)
  );
}

export interface ManimScrollConfig {
  /** Path to the Python executable (default: "python3") */
  pythonPath?: string;
  /** Path to the render CLI script */
  cliPath?: string;
  /** Path to the scene templates directory */
  templatesDir?: string;
  /** Maximum number of parallel renders (default: CPU count - 1) */
  concurrency?: number;
  /** FPS for the animation (default: 30) */
  fps?: number;
  /** Resolution in "WIDTHxHEIGHT" format (default: "1920x1080") */
  resolution?: string;
  /** Manim quality preset: l, m, h, k (default: "h") */
  quality?: string;
  /** Output format: frames, video, both (default: "both") */
  format?: string;
  /** Glob patterns to include (default: ["**\/*.tsx", "**\/*.jsx"]) */
  include?: string[];
  /** Glob patterns to exclude (default: ["node_modules/**", ".next/**"]) */
  exclude?: string[];
  /** Clean up orphaned cache entries (default: true) */
  cleanOrphans?: boolean;
  /** Verbose logging (default: false) */
  verbose?: boolean;
}

export interface NextConfigWithManimScroll extends NextConfig {
  manimScroll?: ManimScrollConfig;
}

let hasProcessed = false;

/**
 * Process ManimScroll components: extract, cache, and render.
 */
async function processManimScroll(
  projectDir: string,
  config: ManimScrollConfig
): Promise<void> {
  if (hasProcessed) {
    return;
  }
  hasProcessed = true;

  const publicDir = path.join(projectDir, "public");
  const verbose = config.verbose ?? false;

  if (verbose) {
    console.log("[manim-scroll] Scanning for ManimScroll components...");
  }

  // Extract all ManimScroll usages from source files
  const animations = await extractAnimations({
    rootDir: projectDir,
    include: config.include,
    exclude: config.exclude,
  });

  if (animations.length === 0) {
    if (verbose) {
      console.log("[manim-scroll] No ManimScroll components found.");
    }
    return;
  }

  if (verbose) {
    console.log(`[manim-scroll] Found ${animations.length} ManimScroll component(s).`);
    for (const animation of animations) {
      const hash = computePropsHash(animation.scene, animation.props);
      console.log(`  - ${animation.id} (hash: ${hash})`);
    }
  }

  // Write the cache manifest IMMEDIATELY after extraction, before rendering.
  // This ensures the manifest is available when the page loads, even if
  // rendering is still in progress. The runtime will gracefully handle
  // missing animation files.
  writeCacheManifest(animations, publicDir);

  // Determine which need rendering
  const { cached, toRender } = getAnimationsToRender(animations, publicDir);

  if (verbose && cached.length > 0) {
    console.log(`[manim-scroll] ${cached.length} animation(s) already cached.`);
  }

  // Render new animations
  if (toRender.length > 0) {
    console.log(`[manim-scroll] Rendering ${toRender.length} animation(s)...`);

    const renderOptions: RenderOptions = {
      pythonPath: config.pythonPath,
      cliPath: config.cliPath,
      templatesDir: config.templatesDir,
      concurrency: config.concurrency,
      fps: config.fps,
      resolution: config.resolution,
      quality: config.quality,
      format: config.format,
    };

    const results = await renderAnimations(toRender, publicDir, renderOptions);
    const failed = results.filter((r) => !r.success);

    if (failed.length > 0) {
      console.error(
        `[manim-scroll] Warning: ${failed.length} animation(s) failed to render.`
      );
    }
  } else if (verbose) {
    console.log("[manim-scroll] All animations are cached, skipping render.");
  }

  // Clean up orphaned cache entries
  if (config.cleanOrphans !== false) {
    cleanOrphanedCache(animations, publicDir);
  }

  console.log("[manim-scroll] Build complete.");
}

/**
 * Wrap a Next.js config with ManimScroll build-time processing.
 *
 * Supports two calling patterns:
 *
 * @example
 * ```js
 * // Pattern 1: Combined config (recommended)
 * const { withManimScroll } = require("@mihirsarya/manim-scroll-next");
 *
 * module.exports = withManimScroll({
 *   manimScroll: {
 *     pythonPath: "python3",
 *     quality: "h",
 *   },
 * });
 * ```
 *
 * @example
 * ```js
 * // Pattern 2: Separate configs
 * module.exports = withManimScroll(nextConfig, {
 *   pythonPath: "python3",
 *   quality: "h",
 * });
 * ```
 */
export function withManimScroll(
  nextConfig: NextConfigWithManimScroll = {},
  manimScrollConfig?: ManimScrollConfig
): NextConfig {
  // Support both calling patterns:
  // 1. withManimScroll({ manimScroll: {...} })
  // 2. withManimScroll(nextConfig, { pythonPath: ... })
  const manimConfig = manimScrollConfig ?? nextConfig.manimScroll ?? {};

  // Remove manimScroll from the config passed to Next.js
  const { manimScroll: _, ...restConfig } = nextConfig;

  return {
    ...restConfig,
    webpack(config, context) {
      // Only process on the server build to avoid double processing
      if (context.isServer && !context.dev) {
        // Run processing before webpack starts
        const projectDir = context.dir;

        // We need to run this synchronously before webpack continues
        // Using a sync wrapper around the async function
        const { execSync } = require("child_process");
        const scriptPath = path.join(__dirname, "process-cli.js");

        // Check if the CLI script exists, if not we'll inline the processing
        if (require("fs").existsSync(scriptPath)) {
          try {
            execSync(
              `node "${scriptPath}" --project-dir "${projectDir}" --config '${JSON.stringify(manimConfig)}'`,
              { stdio: "inherit" }
            );
          } catch (error) {
            console.error("[manim-scroll] Error during build:", error);
          }
        }
      }

      // Run in dev mode on first build
      if (context.dev && context.isServer) {
        const projectDir = context.dir;
        const publicDir = path.join(projectDir, "public");

        // Ensure a cache manifest exists SYNCHRONOUSLY before the page loads.
        // This prevents 404 errors while async processing is running.
        // The manifest will be updated with actual animations once extraction completes.
        ensureCacheManifestExists(publicDir);

        processManimScroll(projectDir, manimConfig).catch((error) => {
          console.error("[manim-scroll] Error during dev processing:", error);
        });
      }

      // Call the original webpack config if provided
      if (typeof restConfig.webpack === "function") {
        return restConfig.webpack(config, context);
      }

      return config;
    },
  };
}

// Export types and utilities for advanced usage
export { extractAnimations, type ExtractedAnimation } from "./extractor";
export {
  computePropsHash,
  isCached,
  getCacheEntry,
  getAnimationsToRender,
  writeCacheManifest,
  readCacheManifest,
  cleanOrphanedCache,
} from "./cache";
export { renderAnimations, type RenderResult, type RenderOptions } from "./renderer";

// Export a standalone processing function for custom build scripts
export { processManimScroll };
