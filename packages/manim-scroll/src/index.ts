/**
 * @rgbmarya/manim-scroll
 *
 * Unified package for scroll-driven Manim animations.
 * Re-exports from runtime, React, and Next.js packages.
 *
 * @example
 * ```tsx
 * import { ManimScroll, useManimScroll } from "@rgbmarya/manim-scroll";
 * import { withManimScroll } from "@rgbmarya/manim-scroll/next";
 * ```
 */

// Runtime exports
export { registerScrollAnimation } from "@rgbmarya/manim-scroll-runtime";
export type {
  RenderManifest,
  ScrollAnimationOptions,
  ScrollRange,
  ScrollRangePreset,
  ScrollRangeValue,
} from "@rgbmarya/manim-scroll-runtime";

// React exports
export { ManimScroll, useManimScroll } from "@rgbmarya/manim-scroll-react";
export type {
  ManimScrollProps,
  ManimAnimationProps,
  UseManimScrollOptions,
  UseManimScrollResult,
} from "@rgbmarya/manim-scroll-react";
