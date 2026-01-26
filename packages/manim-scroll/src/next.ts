/**
 * Next.js plugin exports.
 *
 * Separated to allow tree-shaking when not using Next.js.
 *
 * @example
 * ```js
 * // next.config.js
 * const { withManimScroll } = require("@mihirsarya/manim-scroll/next");
 *
 * module.exports = withManimScroll({
 *   manimScroll: { quality: "h" },
 * });
 * ```
 */

export {
  withManimScroll,
  processManimScroll,
  extractAnimations,
  computePropsHash,
  isCached,
  getCacheEntry,
  getAnimationsToRender,
  writeCacheManifest,
  readCacheManifest,
  cleanOrphanedCache,
  renderAnimations,
} from "@mihirsarya/manim-scroll-next";

export type {
  ManimScrollConfig,
  NextConfigWithManimScroll,
  ExtractedAnimation,
  RenderResult,
  RenderOptions,
} from "@mihirsarya/manim-scroll-next";
