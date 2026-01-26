import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { spawn } from "child_process";
import type { ExtractedAnimation } from "./extractor";
import { computePropsHash, getOutputDir, ensureAssetDir } from "./cache";

export interface RenderOptions {
  /** Path to the Python executable */
  pythonPath?: string;
  /** Path to the render CLI script */
  cliPath?: string;
  /** Path to the scene templates directory */
  templatesDir?: string;
  /** Maximum number of parallel renders */
  concurrency?: number;
  /** FPS for the animation */
  fps?: number;
  /** Resolution in "WIDTHxHEIGHT" format */
  resolution?: string;
  /** Manim quality preset (l, m, h, k) */
  quality?: string;
  /** Output format (frames, video, both) */
  format?: string;
}

export interface RenderResult {
  animation: ExtractedAnimation;
  hash: string;
  success: boolean;
  manifestUrl: string;
  error?: string;
}

const DEFAULT_OPTIONS: Required<Omit<RenderOptions, "cliPath" | "templatesDir">> = {
  pythonPath: "python3",
  concurrency: Math.max(1, os.cpus().length - 1),
  fps: 30,
  resolution: "1920x1080",
  quality: "h",
  format: "both",
};

/**
 * Find the render CLI path relative to this package.
 */
function findCliPath(providedPath?: string): string {
  if (providedPath) {
    return providedPath;
  }

  // Try to find the CLI relative to the package
  // When installed, __dirname is next/dist/, render is at next/render/
  const candidates = [
    // When running from dist/, render/ is a sibling directory
    path.resolve(__dirname, "../render/cli.py"),
    // Legacy paths for development
    path.resolve(__dirname, "../../render/cli.py"),
    path.resolve(__dirname, "../../../render/cli.py"),
    // When running from project root
    path.resolve(process.cwd(), "render/cli.py"),
    // When installed in node_modules
    path.resolve(process.cwd(), "node_modules/@mihirsarya/manim-scroll-next/render/cli.py"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    "Could not find render/cli.py. Please provide the cliPath option or ensure the render directory is accessible."
  );
}

/**
 * Find the templates directory.
 */
function findTemplatesDir(providedPath?: string): string {
  if (providedPath) {
    return providedPath;
  }

  // When installed, __dirname is next/dist/, templates are at next/render/templates/
  const candidates = [
    // When running from dist/, render/ is a sibling directory
    path.resolve(__dirname, "../render/templates"),
    // Legacy paths for development
    path.resolve(__dirname, "../../render/templates"),
    path.resolve(__dirname, "../../../render/templates"),
    // When running from project root
    path.resolve(process.cwd(), "render/templates"),
    // When installed in node_modules
    path.resolve(process.cwd(), "node_modules/@mihirsarya/manim-scroll-next/render/templates"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    "Could not find render/templates directory. Please provide the templatesDir option."
  );
}

/**
 * Render a single animation using the Python CLI.
 */
async function renderAnimation(
  animation: ExtractedAnimation,
  publicDir: string,
  options: RenderOptions
): Promise<RenderResult> {
  const hash = computePropsHash(animation.scene, animation.props);
  const outputDir = getOutputDir(hash, publicDir);
  const manifestUrl = `/manim-assets/${hash}/manifest.json`;

  const pythonPath = options.pythonPath ?? DEFAULT_OPTIONS.pythonPath;
  const cliPath = findCliPath(options.cliPath);
  const templatesDir = findTemplatesDir(options.templatesDir);

  // Ensure output directory exists
  ensureAssetDir(publicDir);

  // Create a temp props file
  const propsFile = path.join(os.tmpdir(), `manim-props-${hash}.json`);
  fs.writeFileSync(propsFile, JSON.stringify(animation.props, null, 2));

  // Determine scene file path
  const sceneFile = path.join(templatesDir, `${animation.scene.toLowerCase().replace("scene", "_scene")}.py`);
  const actualSceneFile = fs.existsSync(sceneFile)
    ? sceneFile
    : path.join(templatesDir, "text_scene.py");

  const args = [
    cliPath,
    "--scene-file",
    actualSceneFile,
    "--scene-name",
    animation.scene,
    "--output-dir",
    outputDir,
    "--format",
    options.format ?? DEFAULT_OPTIONS.format,
    "--fps",
    String(options.fps ?? DEFAULT_OPTIONS.fps),
    "--resolution",
    options.resolution ?? DEFAULT_OPTIONS.resolution,
    "--quality",
    options.quality ?? DEFAULT_OPTIONS.quality,
    "--props",
    propsFile,
  ];

  return new Promise((resolve) => {
    const process = spawn(pythonPath, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...global.process.env,
        MANIM_SCROLL_PROPS: propsFile,
      },
    });

    let stdout = "";
    let stderr = "";

    process.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    process.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    process.on("close", (code) => {
      // Clean up temp props file
      try {
        fs.unlinkSync(propsFile);
      } catch {
        // Ignore cleanup errors
      }

      if (code === 0) {
        resolve({
          animation,
          hash,
          success: true,
          manifestUrl,
        });
      } else {
        resolve({
          animation,
          hash,
          success: false,
          manifestUrl,
          error: stderr || stdout || `Process exited with code ${code}`,
        });
      }
    });

    process.on("error", (err) => {
      resolve({
        animation,
        hash,
        success: false,
        manifestUrl,
        error: err.message,
      });
    });
  });
}

/**
 * Run a limited number of promises concurrently.
 */
async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  const executing: Promise<void>[] = [];

  for (const item of items) {
    const promise = fn(item).then((result) => {
      results.push(result);
    });

    executing.push(promise as unknown as Promise<void>);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
      // Remove completed promises
      for (let i = executing.length - 1; i >= 0; i--) {
        const p = executing[i];
        // Check if promise is settled by racing with resolved promise
        const settled = await Promise.race([
          p.then(() => true).catch(() => true),
          Promise.resolve(false),
        ]);
        if (settled) {
          executing.splice(i, 1);
        }
      }
    }
  }

  await Promise.all(executing);
  return results;
}

/**
 * Render multiple animations in parallel with a concurrency limit.
 */
export async function renderAnimations(
  animations: ExtractedAnimation[],
  publicDir: string,
  options: RenderOptions = {}
): Promise<RenderResult[]> {
  if (animations.length === 0) {
    return [];
  }

  const concurrency = options.concurrency ?? DEFAULT_OPTIONS.concurrency;

  console.log(`Rendering ${animations.length} animation(s) with concurrency ${concurrency}...`);

  const results = await runWithConcurrency(
    animations,
    concurrency,
    (animation) => renderAnimation(animation, publicDir, options)
  );

  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success);

  console.log(`Rendered ${successful}/${animations.length} animation(s) successfully.`);

  if (failed.length > 0) {
    console.error("Failed to render the following animations:");
    for (const result of failed) {
      console.error(`  - ${result.animation.id}: ${result.error}`);
    }
  }

  return results;
}
