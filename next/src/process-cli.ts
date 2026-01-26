#!/usr/bin/env node
/**
 * CLI script for processing ManimScroll components.
 * This is called during the Next.js build process.
 */

import * as path from "path";
import { extractAnimations } from "./extractor";
import {
  getAnimationsToRender,
  writeCacheManifest,
  cleanOrphanedCache,
  computePropsHash,
} from "./cache";
import { renderAnimations, RenderOptions } from "./renderer";

interface CLIConfig {
  pythonPath?: string;
  cliPath?: string;
  templatesDir?: string;
  concurrency?: number;
  fps?: number;
  resolution?: string;
  quality?: string;
  format?: string;
  include?: string[];
  exclude?: string[];
  cleanOrphans?: boolean;
  verbose?: boolean;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let projectDir = process.cwd();
  let config: CLIConfig = {};

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--project-dir" && args[i + 1]) {
      projectDir = args[++i];
    } else if (arg === "--config" && args[i + 1]) {
      try {
        config = JSON.parse(args[++i]);
      } catch {
        console.error("Invalid JSON config");
        process.exit(1);
      }
    }
  }

  const publicDir = path.join(projectDir, "public");
  const verbose = config.verbose ?? false;

  if (verbose) {
    console.log("[manim-scroll] Scanning for ManimScroll components...");
  }

  // Extract all ManimScroll usages
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

  // Write the cache manifest
  writeCacheManifest(animations, publicDir);

  // Clean orphans
  if (config.cleanOrphans !== false) {
    cleanOrphanedCache(animations, publicDir);
  }

  console.log("[manim-scroll] Build complete.");
}

main().catch((error) => {
  console.error("[manim-scroll] Fatal error:", error);
  process.exit(1);
});
