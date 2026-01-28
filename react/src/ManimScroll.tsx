import React, { useRef, useMemo, useEffect } from "react";
import type { ScrollRangeValue } from "@mihirsarya/manim-scroll-runtime";
import { useManimScroll, useNativeAnimation } from "./hooks";
import { extractChildrenText } from "./hash";

/**
 * Animation props that are passed to the Manim scene.
 * These are used for auto-resolution when manifestUrl is not provided.
 */
export interface ManimAnimationProps {
  /** Scene name (default: "TextScene") */
  scene?: string;
  /** Font size for text animations. If not specified in native mode, inherits from parent. */
  fontSize?: number;
  /** Color for the animation (hex string) */
  color?: string;
  /** Font family for text animations */
  font?: string;
  /** 
   * Enable inline mode for text that flows with surrounding content.
   * When true, renders with transparent background and tight bounds.
   */
  inline?: boolean;
  /** Padding around the text in inline mode (Manim units, default: 0.2) */
  padding?: number;
  /** Additional custom props for the scene */
  [key: string]: unknown;
}

export type ManimScrollProps = ManimAnimationProps & {
  /** Explicit manifest URL (overrides auto-resolution) */
  manifestUrl?: string;
  /** 
   * Playback mode:
   * - "auto": Uses pre-rendered video or frames
   * - "frames": Forces frame-by-frame playback
   * - "video": Forces video playback
   * - "native": Uses native SVG animation (no pre-rendered assets)
   */
  mode?: "auto" | "frames" | "video" | "native";
  /** Scroll range configuration (preset, tuple, or legacy object). Ignored when progress is provided. */
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
  /** URL to a font file for native mode (woff, woff2, ttf, otf) */
  fontUrl?: string;
  /** Stroke width for native mode drawing phase */
  strokeWidth?: number;
  /**
   * Explicit progress value (0 to 1). When provided, disables scroll-based control
   * and renders the animation at this exact progress (controlled mode).
   * Works with native mode. For advanced control, use useNativeAnimation hook.
   */
  progress?: number;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
};

/**
 * Scroll-driven Manim animation component.
 *
 * Automatically resolves pre-rendered animation assets based on props,
 * or use an explicit `manifestUrl` for manual control.
 * Use `mode="native"` for native SVG animation without pre-rendered assets.
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
 *
 * // Native mode (no pre-rendered assets)
 * <ManimScroll mode="native" fontSize={48} color="#ffffff">
 *   Animate this text
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
  fontUrl,
  strokeWidth,
  progress: controlledProgress,
  // Animation props
  scene = "TextScene",
  fontSize,
  color,
  font,
  inline,
  padding,
  ...customProps
}: ManimScrollProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Extract text from children
  const childrenText = useMemo(() => extractChildrenText(children), [children]);

  // Determine if we're using native mode
  const isNativeMode = mode === "native";

  // Build animation props for hashing (used for pre-rendered mode)
  const animationProps = useMemo(() => {
    const props: Record<string, unknown> = { ...customProps };
    if (childrenText) props.text = childrenText;
    if (fontSize !== undefined) props.fontSize = fontSize;
    if (color !== undefined) props.color = color;
    if (font !== undefined) props.font = font;
    if (inline !== undefined) props.inline = inline;
    if (padding !== undefined) props.padding = padding;
    return props;
  }, [childrenText, fontSize, color, font, inline, padding, customProps]);

  // Use appropriate hook based on mode
  // Only one hook will be active at a time based on the enabled flag
  const preRenderedResult = useManimScroll({
    ref: containerRef,
    manifestUrl,
    scene,
    animationProps,
    mode: isNativeMode ? undefined : mode,
    scrollRange,
    canvasDimensions: canvas,
    enabled: !isNativeMode,
  });

  const nativeResult = useNativeAnimation({
    ref: containerRef,
    text: childrenText || "",
    fontSize, // undefined means inherit from parent
    color: color ?? "#ffffff",
    fontUrl,
    strokeWidth,
    scrollRange,
    progress: controlledProgress, // Pass progress for controlled mode
    enabled: isNativeMode,
  });

  // Select the appropriate result based on mode
  const { isReady, error, progress } = isNativeMode ? nativeResult : preRenderedResult;

  // Forward callbacks
  useEffect(() => {
    if (isReady) {
      onReady?.();
    }
  }, [isReady, onReady]);

  useEffect(() => {
    onProgress?.(progress);
  }, [progress, onProgress]);

  // Compute container styles based on inline mode and native mode
  const containerStyle: React.CSSProperties = useMemo(() => {
    const baseStyle: React.CSSProperties = {
      position: "relative",
      ...style,
    };

    if (inline || isNativeMode) {
      return {
        ...baseStyle,
        // Use inline display for natural text flow
        display: "inline",
        // Align with surrounding text baseline for seamless integration
        verticalAlign: "baseline",
        // Ensure background is transparent for inline mode
        background: "transparent",
        // Inherit font properties for seamless text flow
        fontFamily: "inherit",
        lineHeight: "inherit",
      };
    }

    return baseStyle;
  }, [inline, isNativeMode, style]);

  // Use span for inline mode or native mode to avoid invalid HTML (div inside p)
  // Native mode typically flows inline with text, so use span for proper semantics
  const Container = inline || isNativeMode ? "span" : "div";

  return (
    <Container
      className={className}
      style={containerStyle}
      ref={containerRef as React.RefObject<HTMLSpanElement & HTMLDivElement>}
    >
      {/* Semantic text for accessibility and SEO (hidden in native mode since text is rendered) */}
      {!isNativeMode && (
        <span style={{ position: "absolute", opacity: 0 }}>{children}</span>
      )}
      {/* Error message for development */}
      {error && process.env.NODE_ENV === "development" && (
        <span
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
        </span>
      )}
    </Container>
  );
}
