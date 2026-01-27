/**
 * @mihirsarya/manim-scroll
 *
 * Unified package for scroll-driven Manim animations.
 * Re-exports from runtime, React, and Next.js packages.
 *
 * @example
 * ```tsx
 * import { ManimScroll, useManimScroll, useNativeAnimation } from "@mihirsarya/manim-scroll";
 * import { withManimScroll } from "@mihirsarya/manim-scroll/next";
 * ```
 */

// Runtime exports
export {
  registerScrollAnimation,
  registerNativeAnimation,
  NativeTextPlayer,
} from "@mihirsarya/manim-scroll-runtime";
export type {
  RenderManifest,
  ScrollAnimationOptions,
  ScrollRange,
  ScrollRangePreset,
  ScrollRangeValue,
  NativeAnimationOptions,
} from "@mihirsarya/manim-scroll-runtime";

// React exports
export {
  ManimScroll,
  useManimScroll,
  useNativeAnimation,
} from "@mihirsarya/manim-scroll-react";
export type {
  ManimScrollProps,
  ManimAnimationProps,
  UseManimScrollOptions,
  UseManimScrollResult,
  UseNativeAnimationOptions,
  UseNativeAnimationResult,
} from "@mihirsarya/manim-scroll-react";
