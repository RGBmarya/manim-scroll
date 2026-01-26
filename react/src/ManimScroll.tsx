import React, { useRef, useMemo, useEffect } from "react";
import type { ScrollRangeValue } from "@rgbmarya/manim-scroll-runtime";
import { useManimScroll } from "./hooks";
import { extractChildrenText } from "./hash";

/**
 * Animation props that are passed to the Manim scene.
 * These are used for auto-resolution when manifestUrl is not provided.
 */
export interface ManimAnimationProps {
  /** Scene name (default: "TextScene") */
  scene?: string;
  /** Font size for text animations */
  fontSize?: number;
  /** Color for the animation (hex string) */
  color?: string;
  /** Font family for text animations */
  font?: string;
  /** Additional custom props for the scene */
  [key: string]: unknown;
}

export type ManimScrollProps = ManimAnimationProps & {
  /** Explicit manifest URL (overrides auto-resolution) */
  manifestUrl?: string;
  /** Playback mode */
  mode?: "auto" | "frames" | "video";
  /** Scroll range configuration (preset, tuple, or legacy object) */
  scrollRange?: ScrollRangeValue;
  /** Called when animation is loaded and ready */
  onReady?: () => void;
  /** Called on scroll progress updates */
  onProgress?: (progress: number) => void;
  /** Canvas dimensions */
  canvas?: {
    width?: number;
    height?: number;
  };
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
};

/**
 * Scroll-driven Manim animation component.
 *
 * Automatically resolves pre-rendered animation assets based on props,
 * or use an explicit `manifestUrl` for manual control.
 *
 * @example
 * ```tsx
 * // Auto-resolution (with Next.js plugin)
 * <ManimScroll scene="TextScene" fontSize={72} color="#ffffff">
 *   Welcome to my site
 * </ManimScroll>
 *
 * // Manual mode
 * <ManimScroll manifestUrl="/assets/scene/manifest.json">
 *   Scroll-driven text
 * </ManimScroll>
 * ```
 */
export function ManimScroll({
  className,
  style,
  children,
  canvas,
  manifestUrl,
  mode,
  scrollRange,
  onReady,
  onProgress,
  // Animation props
  scene = "TextScene",
  fontSize,
  color,
  font,
  ...customProps
}: ManimScrollProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Extract text from children
  const childrenText = useMemo(() => extractChildrenText(children), [children]);

  // Build animation props for hashing
  const animationProps = useMemo(() => {
    const props: Record<string, unknown> = { ...customProps };
    if (childrenText) props.text = childrenText;
    if (fontSize !== undefined) props.fontSize = fontSize;
    if (color !== undefined) props.color = color;
    if (font !== undefined) props.font = font;
    return props;
  }, [childrenText, fontSize, color, font, customProps]);

  // Use the hook for all animation logic
  const { isReady, error, progress } = useManimScroll({
    ref: containerRef,
    manifestUrl,
    scene,
    animationProps,
    mode,
    scrollRange,
    canvasDimensions: canvas,
  });

  // Forward callbacks
  useEffect(() => {
    if (isReady) {
      onReady?.();
    }
  }, [isReady, onReady]);

  useEffect(() => {
    onProgress?.(progress);
  }, [progress, onProgress]);

  return (
    <div
      className={className}
      style={{ position: "relative", ...style }}
      ref={containerRef}
    >
      {/* Semantic text for accessibility and SEO */}
      <span style={{ position: "absolute", opacity: 0 }}>{children}</span>
      {/* Error message for development */}
      {error && process.env.NODE_ENV === "development" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0, 0, 0, 0.8)",
            color: "#ff6b6b",
            padding: "1rem",
            fontSize: "0.875rem",
            textAlign: "center",
          }}
        >
          {error.message}
        </div>
      )}
    </div>
  );
}
