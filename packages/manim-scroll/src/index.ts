/**
 * @mihirsarya/manim-scroll
 *
 * Unified package for scroll-driven Manim animations.
 * Re-exports from runtime, React, and Next.js packages.
 *
 * @example
 * ```tsx
 * import { ManimScroll, useManimScroll } from "@mihirsarya/manim-scroll";
 * import { withManimScroll } from "@mihirsarya/manim-scroll/next";
 * ```
 */

// Runtime exports
export { registerScrollAnimation } from "@mihirsarya/manim-scroll-runtime";
export type {
  RenderManifest,
  ScrollAnimationOptions,
  ScrollRange,
  ScrollRangePreset,
  ScrollRangeValue,
} from "@mihirsarya/manim-scroll-runtime";

// React exports
export { ManimScroll, useManimScroll } from "@mihirsarya/manim-scroll-react";
export type {
  ManimScrollProps,
  ManimAnimationProps,
  UseManimScrollOptions,
  UseManimScrollResult,
} from "@mihirsarya/manim-scroll-react";
