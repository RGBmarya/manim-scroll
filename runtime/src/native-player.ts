import opentype from "opentype.js";
import type { NativeAnimationOptions, ScrollRangeValue, ScrollRange } from "./types";

const SVG_NS = "http://www.w3.org/2000/svg";

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

// ============================================================================
// Manim Rate Functions (ported from manim/utils/rate_functions.py)
// ============================================================================

/**
 * Sigmoid function used by Manim's smooth rate function.
 */
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/**
 * Manim's smooth rate function.
 * Uses a sigmoid-based curve for smooth acceleration/deceleration.
 * @param t - Progress value (0 to 1)
 * @param inflection - Controls the steepness of the curve (default: 10)
 */
function smooth(t: number, inflection: number = 10): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const error = sigmoid(-inflection / 2);
  const value = (sigmoid(inflection * (t - 0.5)) - error) / (1 - 2 * error);
  return Math.min(Math.max(value, 0), 1);
}

/**
 * Manim's double_smooth rate function.
 * Applies smooth easing to both halves of the animation.
 * Used by DrawBorderThenFill animation.
 * @param t - Progress value (0 to 1)
 */
function doubleSmooth(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  if (t < 0.5) {
    return 0.5 * smooth(2 * t);
  } else {
    return 0.5 * (1 + smooth(2 * t - 1));
  }
}

/**
 * Linear rate function (no easing).
 * Used by Write animation.
 */
function linear(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t;
}

/**
 * Manim's integer_interpolate function.
 * Returns (index, subalpha) where index is the current phase
 * and subalpha is the progress within that phase.
 */
function integerInterpolate(start: number, end: number, alpha: number): [number, number] {
  if (alpha >= 1) {
    return [end - 1, 1];
  }
  if (alpha <= 0) {
    return [start, 0];
  }
  const numPhases = end - start;
  const scaledAlpha = alpha * numPhases;
  const index = Math.floor(scaledAlpha);
  const subalpha = scaledAlpha - index;
  return [start + index, subalpha];
}

/**
 * Parse a relative unit string (e.g., "100vh", "-50%") to pixels.
 */
function parseRelativeUnit(
  value: string | number,
  viewportHeight: number,
  elementHeight: number
): number {
  if (typeof value === "number") {
    return value;
  }

  const trimmed = value.trim();

  if (trimmed.endsWith("vh")) {
    const num = parseFloat(trimmed.slice(0, -2));
    return (num / 100) * viewportHeight;
  }

  if (trimmed.endsWith("%")) {
    const num = parseFloat(trimmed.slice(0, -1));
    return (num / 100) * elementHeight;
  }

  if (trimmed.endsWith("px")) {
    return parseFloat(trimmed.slice(0, -2));
  }

  return parseFloat(trimmed);
}

/**
 * Resolve a ScrollRangeValue to a normalized { start, end } object in pixels.
 */
function resolveScrollRange(
  range: ScrollRangeValue | undefined,
  viewportHeight: number,
  elementHeight: number,
  documentHeight: number
): ScrollRange {
  if (range === undefined || range === "viewport") {
    return {
      start: viewportHeight,
      end: -elementHeight,
    };
  }

  if (range === "element") {
    return {
      start: viewportHeight * 0.8,
      end: viewportHeight * 0.2 - elementHeight,
    };
  }

  if (range === "full") {
    return {
      start: documentHeight - viewportHeight,
      end: 0,
    };
  }

  if (Array.isArray(range)) {
    const [startVal, endVal] = range;
    return {
      start: parseRelativeUnit(startVal, viewportHeight, elementHeight),
      end: parseRelativeUnit(endVal, viewportHeight, elementHeight),
    };
  }

  return {
    start: range.start ?? viewportHeight,
    end: range.end ?? -elementHeight,
  };
}

function resolveScrollProgress(
  rect: DOMRect,
  viewportHeight: number,
  range?: ScrollRangeValue
): number {
  const documentHeight = document.documentElement.scrollHeight;
  const resolved = resolveScrollRange(range, viewportHeight, rect.height, documentHeight);
  const start = resolved.start ?? viewportHeight;
  const end = resolved.end ?? -rect.height;
  const progress = (start - rect.top) / (start - end);
  return clamp(progress, 0, 1);
}

/**
 * Sub-path data for animation.
 * In Manim, the lag_ratio is applied to ALL submobjects including individual
 * contours within each character. We split each character into its contours
 * to replicate this behavior.
 */
interface SubPath {
  element: SVGPathElement | HTMLSpanElement;
  pathLength: number;
  /** Character index this sub-path belongs to */
  charIndex: number;
  /** Starting x-coordinate for sorting (left-to-right animation) */
  startX: number;
}

/**
 * Fill path for the final filled state.
 * These are the original closed contours that can be filled.
 */
interface FillPath {
  element: SVGPathElement;
  charIndex: number;
}

/**
 * Parse SVG path data into individual drawing commands.
 * This is more granular than contour splitting - each line/curve becomes a separate segment.
 * This matches Manim's behavior where each stroke segment is animated independently.
 */
function parsePathCommands(pathData: string): Array<{ type: string; args: number[] }> {
  const commands: Array<{ type: string; args: number[] }> = [];
  
  // Match SVG path commands: letter followed by numbers (with optional decimals and negatives)
  const regex = /([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g;
  let match;
  
  while ((match = regex.exec(pathData)) !== null) {
    const type = match[1];
    const argsStr = match[2].trim();
    
    // Parse the numeric arguments
    const args: number[] = [];
    if (argsStr) {
      // Split on comma or whitespace, handling negative numbers
      const numRegex = /-?[\d.]+(?:e[-+]?\d+)?/gi;
      let numMatch;
      while ((numMatch = numRegex.exec(argsStr)) !== null) {
        args.push(parseFloat(numMatch[0]));
      }
    }
    
    commands.push({ type, args });
  }
  
  return commands;
}

/**
 * Estimate the length of a path segment without creating an SVG element.
 * This is approximate but fast for grouping purposes.
 */
function estimateSegmentLength(segment: string): number {
  // Extract start and end points from the segment
  // Segments are in the form: M<x> <y><cmd><...args>
  const moveMatch = segment.match(/^M([-\d.]+)\s+([-\d.]+)/);
  if (!moveMatch) return 0;
  
  const startX = parseFloat(moveMatch[1]);
  const startY = parseFloat(moveMatch[2]);
  
  // Find the end point based on command type
  let endX = startX, endY = startY;
  
  if (segment.includes('L')) {
    const lineMatch = segment.match(/L([-\d.]+)\s+([-\d.]+)/);
    if (lineMatch) {
      endX = parseFloat(lineMatch[1]);
      endY = parseFloat(lineMatch[2]);
    }
  } else if (segment.includes('C')) {
    // For cubic bezier, get the final point (last 2 numbers)
    const nums = segment.match(/C([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)/);
    if (nums) {
      endX = parseFloat(nums[5]);
      endY = parseFloat(nums[6]);
    }
  } else if (segment.includes('Q')) {
    // For quadratic bezier, get the final point (last 2 numbers)
    const nums = segment.match(/Q([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)/);
    if (nums) {
      endX = parseFloat(nums[3]);
      endY = parseFloat(nums[4]);
    }
  }
  
  // Simple distance estimate (actual curve length is longer, but this is good enough for grouping)
  return Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2);
}

/**
 * Get the start point of a segment.
 */
function getSegmentStart(segment: string): { x: number; y: number } | null {
  const match = segment.match(/^M([-\d.]+)\s+([-\d.]+)/);
  if (!match) return null;
  return { x: parseFloat(match[1]), y: parseFloat(match[2]) };
}

/**
 * Get the end point of a segment.
 */
function getSegmentEnd(segment: string): { x: number; y: number } | null {
  const match = segment.match(/^M([-\d.]+)\s+([-\d.]+)/);
  if (!match) return null;
  
  const startX = parseFloat(match[1]);
  const startY = parseFloat(match[2]);
  
  if (segment.includes('L')) {
    const lineMatch = segment.match(/L([-\d.]+)\s+([-\d.]+)/);
    if (lineMatch) {
      return { x: parseFloat(lineMatch[1]), y: parseFloat(lineMatch[2]) };
    }
  } else if (segment.includes('C')) {
    const nums = segment.match(/C([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)/);
    if (nums) {
      return { x: parseFloat(nums[5]), y: parseFloat(nums[6]) };
    }
  } else if (segment.includes('Q')) {
    const nums = segment.match(/Q([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)/);
    if (nums) {
      return { x: parseFloat(nums[3]), y: parseFloat(nums[4]) };
    }
  }
  
  return { x: startX, y: startY };
}

/**
 * Combine multiple segments into a single path.
 * Removes redundant M commands when segments are contiguous.
 */
function combineSegments(segments: string[]): string {
  if (segments.length === 0) return "";
  if (segments.length === 1) return segments[0];
  
  let combined = segments[0];
  
  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i];
    // Remove the M command from subsequent segments (they continue from previous endpoint)
    const withoutMove = seg.replace(/^M[-\d.]+\s+[-\d.]+/, "");
    combined += withoutMove;
  }
  
  return combined;
}

// Minimum segment length in pixels to be visible at the start of animation
const MIN_SEGMENT_LENGTH = 32;

/**
 * Split an SVG path into individual stroke segments for animation.
 * Each segment is a complete path that can be drawn independently.
 * This matches Manim's behavior where strokes appear one at a time.
 * 
 * Adjacent short segments are grouped together to ensure they're visually
 * substantial when they first appear (avoiding tiny dots).
 */
function splitPathIntoSegments(pathData: string): string[] {
  const commands = parsePathCommands(pathData);
  const rawSegments: string[] = [];
  
  let currentX = 0;
  let currentY = 0;
  let startX = 0;
  let startY = 0;
  
  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    const type = cmd.type;
    const args = cmd.args;
    
    switch (type) {
      case 'M': // Absolute moveto
        if (args.length >= 2) {
          currentX = args[0];
          currentY = args[1];
          startX = currentX;
          startY = currentY;
          // Process implicit lineto commands after M
          for (let j = 2; j < args.length; j += 2) {
            const x = args[j];
            const y = args[j + 1];
            rawSegments.push(`M${currentX} ${currentY}L${x} ${y}`);
            currentX = x;
            currentY = y;
          }
        }
        break;
        
      case 'm': // Relative moveto
        if (args.length >= 2) {
          currentX += args[0];
          currentY += args[1];
          startX = currentX;
          startY = currentY;
          for (let j = 2; j < args.length; j += 2) {
            const x = currentX + args[j];
            const y = currentY + args[j + 1];
            rawSegments.push(`M${currentX} ${currentY}L${x} ${y}`);
            currentX = x;
            currentY = y;
          }
        }
        break;
        
      case 'L': // Absolute lineto
        for (let j = 0; j < args.length; j += 2) {
          const x = args[j];
          const y = args[j + 1];
          rawSegments.push(`M${currentX} ${currentY}L${x} ${y}`);
          currentX = x;
          currentY = y;
        }
        break;
        
      case 'l': // Relative lineto
        for (let j = 0; j < args.length; j += 2) {
          const x = currentX + args[j];
          const y = currentY + args[j + 1];
          rawSegments.push(`M${currentX} ${currentY}L${x} ${y}`);
          currentX = x;
          currentY = y;
        }
        break;
        
      case 'H': // Absolute horizontal lineto
        for (const x of args) {
          rawSegments.push(`M${currentX} ${currentY}L${x} ${currentY}`);
          currentX = x;
        }
        break;
        
      case 'h': // Relative horizontal lineto
        for (const dx of args) {
          const x = currentX + dx;
          rawSegments.push(`M${currentX} ${currentY}L${x} ${currentY}`);
          currentX = x;
        }
        break;
        
      case 'V': // Absolute vertical lineto
        for (const y of args) {
          rawSegments.push(`M${currentX} ${currentY}L${currentX} ${y}`);
          currentY = y;
        }
        break;
        
      case 'v': // Relative vertical lineto
        for (const dy of args) {
          const y = currentY + dy;
          rawSegments.push(`M${currentX} ${currentY}L${currentX} ${y}`);
          currentY = y;
        }
        break;
        
      case 'C': // Absolute cubic bezier
        for (let j = 0; j < args.length; j += 6) {
          const x1 = args[j], y1 = args[j + 1];
          const x2 = args[j + 2], y2 = args[j + 3];
          const x = args[j + 4], y = args[j + 5];
          rawSegments.push(`M${currentX} ${currentY}C${x1} ${y1} ${x2} ${y2} ${x} ${y}`);
          currentX = x;
          currentY = y;
        }
        break;
        
      case 'c': // Relative cubic bezier
        for (let j = 0; j < args.length; j += 6) {
          const x1 = currentX + args[j], y1 = currentY + args[j + 1];
          const x2 = currentX + args[j + 2], y2 = currentY + args[j + 3];
          const x = currentX + args[j + 4], y = currentY + args[j + 5];
          rawSegments.push(`M${currentX} ${currentY}C${x1} ${y1} ${x2} ${y2} ${x} ${y}`);
          currentX = x;
          currentY = y;
        }
        break;
        
      case 'Q': // Absolute quadratic bezier
        for (let j = 0; j < args.length; j += 4) {
          const x1 = args[j], y1 = args[j + 1];
          const x = args[j + 2], y = args[j + 3];
          rawSegments.push(`M${currentX} ${currentY}Q${x1} ${y1} ${x} ${y}`);
          currentX = x;
          currentY = y;
        }
        break;
        
      case 'q': // Relative quadratic bezier
        for (let j = 0; j < args.length; j += 4) {
          const x1 = currentX + args[j], y1 = currentY + args[j + 1];
          const x = currentX + args[j + 2], y = currentY + args[j + 3];
          rawSegments.push(`M${currentX} ${currentY}Q${x1} ${y1} ${x} ${y}`);
          currentX = x;
          currentY = y;
        }
        break;
        
      case 'Z':
      case 'z': // Closepath - draw line back to start
        if (currentX !== startX || currentY !== startY) {
          rawSegments.push(`M${currentX} ${currentY}L${startX} ${startY}`);
        }
        currentX = startX;
        currentY = startY;
        break;
        
      // S, s, T, t, A, a are less common - add if needed
      case 'S': // Smooth cubic bezier
        for (let j = 0; j < args.length; j += 4) {
          const x2 = args[j], y2 = args[j + 1];
          const x = args[j + 2], y = args[j + 3];
          // For smooth curves, control point is reflection of previous
          rawSegments.push(`M${currentX} ${currentY}C${currentX} ${currentY} ${x2} ${y2} ${x} ${y}`);
          currentX = x;
          currentY = y;
        }
        break;
        
      case 's': // Relative smooth cubic bezier
        for (let j = 0; j < args.length; j += 4) {
          const x2 = currentX + args[j], y2 = currentY + args[j + 1];
          const x = currentX + args[j + 2], y = currentY + args[j + 3];
          rawSegments.push(`M${currentX} ${currentY}C${currentX} ${currentY} ${x2} ${y2} ${x} ${y}`);
          currentX = x;
          currentY = y;
        }
        break;
    }
  }
  
  // Group adjacent short segments together until they meet minimum length
  const groupedSegments: string[] = [];
  let currentGroup: string[] = [];
  let currentGroupLength = 0;
  
  for (let i = 0; i < rawSegments.length; i++) {
    const seg = rawSegments[i];
    const segLength = estimateSegmentLength(seg);
    
    // Check if this segment connects to the previous one (contiguous)
    let isContiguous = false;
    if (currentGroup.length > 0) {
      const prevEnd = getSegmentEnd(currentGroup[currentGroup.length - 1]);
      const currStart = getSegmentStart(seg);
      if (prevEnd && currStart) {
        const dist = Math.sqrt((currStart.x - prevEnd.x) ** 2 + (currStart.y - prevEnd.y) ** 2);
        isContiguous = dist < 0.1; // Allow tiny floating point differences
      }
    }
    
    if (currentGroup.length === 0) {
      // Start a new group
      currentGroup.push(seg);
      currentGroupLength = segLength;
    } else if (isContiguous && currentGroupLength < MIN_SEGMENT_LENGTH) {
      // Add to current group (still building up to minimum length)
      currentGroup.push(seg);
      currentGroupLength += segLength;
    } else if (isContiguous && segLength < MIN_SEGMENT_LENGTH && currentGroupLength + segLength < MIN_SEGMENT_LENGTH * 3) {
      // This segment is too small on its own, add it to current group
      currentGroup.push(seg);
      currentGroupLength += segLength;
    } else {
      // Finalize current group and start a new one
      if (currentGroup.length > 0) {
        groupedSegments.push(combineSegments(currentGroup));
      }
      currentGroup = [seg];
      currentGroupLength = segLength;
    }
  }
  
  // Don't forget the last group
  if (currentGroup.length > 0) {
    groupedSegments.push(combineSegments(currentGroup));
  }
  
  return groupedSegments;
}

/**
 * NativeTextPlayer - Renders text animation natively in the browser
 * using SVG paths, replicating Manim's Write/DrawBorderThenFill animation.
 *
 * Phase 1 (progress 0 to 0.5): Draw the stroke progressively
 * Phase 2 (progress 0.5 to 1.0): Fill in the text
 *
 * Key difference from naive implementations: we split each character into
 * individual contours (sub-paths) and apply the lag_ratio to ALL contours
 * across all characters. This matches Manim's behavior where outlines
 * appear progressively rather than all at once.
 */
export class NativeTextPlayer {
  private readonly container: HTMLElement;
  private readonly options: NativeAnimationOptions;
  private svg: SVGSVGElement | null = null;
  private fallbackWrapper: HTMLElement | null = null;
  /** All sub-paths (segments) across all characters, for stroke animation */
  private subPaths: SubPath[] = [];
  /** Fill paths (original closed contours) for the filled state */
  private fillPaths: FillPath[] = [];
  private isActive = false;
  private rafId: number | null = null;
  private observer?: IntersectionObserver;
  private resizeObserver?: ResizeObserver;
  private lastProgress = -1;
  private scrollHandler?: () => void;
  private resizeHandler?: () => void;
  private pendingDraw = false;
  private pendingResize = false;
  private font: opentype.Font | null = null;
  /** Last known font size, used to detect changes for inherited sizing */
  private lastComputedFontSize = 0;

  constructor(options: NativeAnimationOptions) {
    // Manim defaults: DrawBorderThenFill stroke_width = 2
    // fontSize: undefined means inherit from parent element
    this.options = {
      color: "#ffffff",
      strokeWidth: 2, // Manim's DrawBorderThenFill default
      ...options,
    };
    this.container = options.container;
  }

  async init(): Promise<void> {
    // Load font
    if (this.options.fontUrl) {
      this.font = await opentype.load(this.options.fontUrl);
    } else {
      // Use a default system font path - for now we'll create simple text paths
      // In production, you'd bundle a default font or use a CDN
      // For now, fallback to creating paths from text metrics
      this.font = null;
    }

    // Track initial font size for inherited sizing
    this.lastComputedFontSize = this.getInheritedFontSize();

    // Create SVG container
    this.svg = document.createElementNS(SVG_NS, "svg");
    this.svg.style.overflow = "visible";
    // Use inline display to flow naturally with surrounding text
    this.svg.style.display = "inline";
    // Vertical alignment will be set after font metrics are calculated

    // Create paths for each character
    await this.createCharacterPaths();

    // Add SVG to container (only if still using SVG mode, not fallback)
    if (this.svg) {
      this.container.appendChild(this.svg);
    }

    // Setup intersection observer
    this.setupObserver();

    // Setup resize handling for responsiveness
    this.setupResizeHandling();

    // Draw initial state (progress = 0)
    this.render(0);

    this.options.onReady?.();
  }

  private async createCharacterPaths(): Promise<void> {
    if (!this.svg) return;

    const text = this.options.text;
    // If fontSize is not specified, inherit from the container's computed style
    const fontSize = this.options.fontSize ?? this.getInheritedFontSize();
    const color = this.options.color!;
    const strokeWidth = this.options.strokeWidth!;

    let currentX = 0;
    const allSubPaths: SubPath[] = [];
    const allFillPaths: FillPath[] = [];
    let charIndex = 0;

    if (this.font) {
      // Use opentype.js to convert text to paths
      for (const char of text) {
        if (char === " ") {
          // Handle space - just advance x position
          const glyph = this.font.charToGlyph(char);
          const scale = fontSize / this.font.unitsPerEm;
          currentX += (glyph.advanceWidth || this.font.unitsPerEm * 0.3) * scale;
          charIndex++;
          continue;
        }

        const path = this.font.getPath(char, currentX, fontSize, fontSize);
        const pathData = path.toPathData(2);

        if (!pathData || pathData === "M0 0") {
          // Empty glyph, skip
          const glyph = this.font.charToGlyph(char);
          const scale = fontSize / this.font.unitsPerEm;
          currentX += (glyph.advanceWidth || fontSize * 0.5) * scale;
          charIndex++;
          continue;
        }

        // Create fill path (original closed contours) - hidden initially
        // This will be shown during the fill phase
        const fillPath = document.createElementNS(SVG_NS, "path");
        fillPath.setAttribute("d", pathData);
        fillPath.setAttribute("fill", color);
        fillPath.setAttribute("stroke", "none");
        fillPath.style.opacity = "0"; // Hidden initially
        this.svg.appendChild(fillPath);
        allFillPaths.push({ element: fillPath, charIndex });

        // Split the character's path into individual stroke segments
        // Each segment is a single line/curve that can be animated independently
        // This matches Manim's behavior where strokes appear one at a time
        const segments = splitPathIntoSegments(pathData);

        for (const segmentData of segments) {
          const svgPath = document.createElementNS(SVG_NS, "path");
          svgPath.setAttribute("d", segmentData);
          svgPath.setAttribute("fill", "none"); // Segments are strokes only
          svgPath.setAttribute("stroke", color);
          svgPath.setAttribute("stroke-width", String(strokeWidth));
          svgPath.setAttribute("stroke-linecap", "round");
          svgPath.setAttribute("stroke-linejoin", "round");

          this.svg.appendChild(svgPath);

          // Get path length for stroke animation
          const pathLength = svgPath.getTotalLength();
          
          // Skip very short segments (less than minimum visible length)
          // This should rarely happen now since we group short segments together
          if (pathLength < MIN_SEGMENT_LENGTH / 2) {
            svgPath.remove();
            continue;
          }
          
          svgPath.style.strokeDasharray = String(pathLength);
          svgPath.style.strokeDashoffset = String(pathLength);

          // Extract starting x-coordinate for sorting
          const segmentStart = getSegmentStart(segmentData);
          const startX = segmentStart?.x ?? currentX;

          allSubPaths.push({
            element: svgPath,
            pathLength,
            charIndex,
            startX,
          });
        }

        const glyph = this.font.charToGlyph(char);
        const scale = fontSize / this.font.unitsPerEm;
        const charWidth = (glyph.advanceWidth || fontSize * 0.5) * scale;

        currentX += charWidth;
        charIndex++;
      }
    } else {
      // Fallback: Create simple rectangles or use CSS text
      // This is a simplified fallback when no font is loaded
      // Pass the original fontSize option (may be undefined for inheritance)
      this.createFallbackTextAnimation(text, this.options.fontSize, color);
      return;
    }

    // Sort segments by x-coordinate for left-to-right animation order
    // This matches Manim's behavior where strokes appear progressively left-to-right
    allSubPaths.sort((a, b) => a.startX - b.startX);
    
    this.subPaths = allSubPaths;
    this.fillPaths = allFillPaths;

    // Update SVG viewBox to fit content
    // The y-coordinate in opentype.js uses baseline as y=0, with glyphs drawn upward (negative y)
    // We need to account for both ascender (above baseline) and descender (below baseline)
    const unitsPerEm = this.font.unitsPerEm;
    const ascender = (this.font.ascender / unitsPerEm) * fontSize;
    const descender = (this.font.descender / unitsPerEm) * fontSize;
    const totalHeight = ascender - descender; // descender is typically negative
    
    // viewBox: x, y (top-left), width, height
    // y starts at negative ascender to capture everything above baseline
    // The baseline is at y=fontSize in the path coordinates
    const viewBoxY = fontSize - ascender;
    const viewBoxHeight = totalHeight;
    
    this.svg.setAttribute("viewBox", `0 ${viewBoxY} ${currentX} ${viewBoxHeight}`);
    this.svg.setAttribute("preserveAspectRatio", "xMinYMid meet");
    
    // Calculate font metrics as ratios for proper sizing
    // ascenderRatio: how much of the font height is above the baseline
    // descenderRatio: how much is below (descender is negative, so we negate it)
    const ascenderRatio = this.font.ascender / unitsPerEm;
    const descenderRatio = -this.font.descender / unitsPerEm;
    const totalHeightRatio = ascenderRatio + descenderRatio;
    
    // Set explicit width/height based on content
    // The SVG height should match the full font metrics (not just 1em) to avoid scaling
    // This ensures the rendered text is the same size as surrounding text
    if (this.options.fontSize) {
      // Explicit fontSize: use pixel values for accurate sizing
      this.svg.style.height = `${totalHeight}px`;
      this.svg.style.width = `${currentX}px`;
      // Align baseline: move SVG down by descender height
      // With vertical-align: baseline, the SVG's bottom aligns with text baseline,
      // but our internal baseline is descenderHeight above the bottom
      this.svg.style.verticalAlign = `-${descenderRatio * fontSize}px`;
    } else {
      // Inherited fontSize: use em units to scale with parent
      // Height is the full font metric height (ascender + descender extent)
      this.svg.style.height = `${totalHeightRatio}em`;
      // Width is the text width relative to the font size
      this.svg.style.width = `${currentX / fontSize}em`;
      // Align baseline: offset by descender ratio
      this.svg.style.verticalAlign = `-${descenderRatio}em`;
    }
  }

  /**
   * Get the inherited font size from the container's computed style.
   */
  private getInheritedFontSize(): number {
    const computed = window.getComputedStyle(this.container);
    return parseFloat(computed.fontSize) || 16; // Fallback to browser default
  }

  private createFallbackTextAnimation(text: string, fontSize: number | undefined, color: string): void {
    // Fallback using HTML/CSS when opentype.js font is not available
    // Creates character-by-character opacity animation
    if (!this.svg) return;

    // Remove SVG and use a div-based approach
    this.svg.remove();
    this.svg = null;

    const wrapper = document.createElement("span");
    wrapper.style.display = "inline";
    // If fontSize is undefined, inherit from parent; otherwise use the specified value
    wrapper.style.fontSize = fontSize !== undefined ? `${fontSize}px` : "inherit";
    wrapper.style.color = color;
    wrapper.style.fontFamily = "inherit";
    // Use white-space: pre to preserve spaces and ensure proper text flow
    wrapper.style.whiteSpace = "pre";

    let charIndex = 0;
    for (const char of text) {
      const span = document.createElement("span");
      span.textContent = char;
      // Use inline display to flow naturally with surrounding text
      span.style.display = "inline";
      span.style.transition = "none"; // We control the animation manually
      
      if (char === " ") {
        // Space characters: preserve the space, start fully visible
        // Spaces don't need animation - they're just spacing
        span.style.opacity = "1";
      } else {
        // Non-space characters: animate them
        span.style.opacity = "0";
        // Add a subtle scale effect for the "write" feel (only for non-spaces)
        span.style.display = "inline-block";
        span.style.transform = "scale(0.8)";
        span.style.transformOrigin = "center baseline";
      }
      
      wrapper.appendChild(span);

      // Only add non-space characters to subPaths for animation
      if (char !== " ") {
        this.subPaths.push({
          element: span,
          pathLength: 1,
          charIndex,
          startX: charIndex, // Use charIndex as proxy for x position in fallback mode
        });
      }
      charIndex++;
    }

    this.fallbackWrapper = wrapper;
    this.container.appendChild(wrapper);
  }

  private render(progress: number): void {
    const n = this.subPaths.length;
    if (n === 0) return;

    // Manim's Write animation lag_ratio formula: min(4.0 / max(1.0, length), 0.2)
    // This creates a staggered effect where each sub-path starts slightly after the previous.
    // By applying this to ALL sub-paths (contours) across all characters, we replicate
    // Manim's behavior where outlines don't all appear at once.
    const lagRatio = Math.min(4.0 / Math.max(1.0, n), 0.2);

    // Manim's exact formula from Animation.get_sub_alpha():
    // full_length = (num_submobjects - 1) * lag_ratio + 1
    // sub_alpha = clip((alpha * full_length - index * lag_ratio), 0, 1)
    const fullLength = (n - 1) * lagRatio + 1;

    // Track max progress for each character's fill animation
    const charFillProgress: Record<number, number> = {};

    for (let i = 0; i < n; i++) {
      const subPath = this.subPaths[i];
      const element = subPath.element;

      // Calculate per-subpath progress using Manim's exact formula
      // This ensures proper staggering where each sub-path starts after the previous
      // has progressed by lag_ratio amount
      const rawSubPathProgress = clamp(progress * fullLength - i * lagRatio, 0, 1);

      // Manim's Write animation uses linear rate function (not double_smooth)
      // double_smooth is only used for standalone DrawBorderThenFill
      // For Write (text animation), we use linear progression
      const subPathProgress = linear(rawSubPathProgress);

      // Use Manim's integer_interpolate to determine phase and subalpha
      // Phase 0 (first half): Draw the stroke/outline progressively
      // Phase 1 (second half): Interpolate from outline to filled
      const [phaseIndex, subalpha] = integerInterpolate(0, 2, subPathProgress);

      // Check if this is an SVG path or HTML span (fallback mode)
      if (element instanceof SVGPathElement) {
        const pathLength = subPath.pathLength;

        if (phaseIndex === 0) {
          // Phase 0: Draw stroke progressively (pointwise_become_partial equivalent)
          element.style.strokeDashoffset = String(pathLength * (1 - subalpha));
          element.style.strokeOpacity = "1";
        } else {
          // Phase 1: Stroke fully drawn, fade out as fill takes over
          element.style.strokeDashoffset = "0";
          element.style.strokeOpacity = String(1 - subalpha);
        }

        // Track max fill progress for this character
        if (!charFillProgress[subPath.charIndex] || subPathProgress > charFillProgress[subPath.charIndex]) {
          charFillProgress[subPath.charIndex] = subPathProgress;
        }
      } else if (element instanceof HTMLSpanElement) {
        // Fallback mode: Replicate DrawBorderThenFill visually with CSS
        // Since we can't draw strokes on HTML text, we simulate with opacity and transform
        if (phaseIndex === 0) {
          // Phase 0: "Drawing" effect - fade in with slight scale
          const drawProgress = smooth(subalpha);
          element.style.opacity = String(0.3 + 0.3 * drawProgress); // Partial visibility
          element.style.transform = `scale(${0.95 + 0.05 * drawProgress})`;
          // Add a text-stroke effect to simulate outline phase
          element.style.webkitTextStroke = `1px ${this.options.color}`;
          element.style.color = "transparent";
        } else {
          // Phase 1: Fill in - full opacity, color fills in
          const fillProgress = smooth(subalpha);
          element.style.opacity = String(0.6 + 0.4 * fillProgress);
          element.style.transform = "scale(1)";
          // Transition from stroke-only to filled
          const strokeOpacity = 1 - fillProgress;
          if (strokeOpacity > 0.01) {
            element.style.webkitTextStroke = `${strokeOpacity}px ${this.options.color}`;
          } else {
            element.style.webkitTextStroke = "0";
          }
          element.style.color = this.options.color!;
        }
      }
    }

    // Update fill paths based on character progress
    // Fill starts appearing when a character enters phase 1 (progress > 0.5)
    for (const fillPath of this.fillPaths) {
      const charProgress = charFillProgress[fillPath.charIndex] || 0;
      // Use integer_interpolate to get the fill phase
      const [fillPhase, fillSubalpha] = integerInterpolate(0, 2, charProgress);
      
      if (fillPhase === 0) {
        // Still in stroke phase, fill hidden
        fillPath.element.style.opacity = "0";
      } else {
        // In fill phase, fade in the fill
        fillPath.element.style.opacity = String(fillSubalpha);
      }
    }
  }

  destroy(): void {
    this.stop();
    this.observer?.disconnect();
    this.resizeObserver?.disconnect();
    if (this.resizeHandler) {
      window.removeEventListener("resize", this.resizeHandler);
      this.resizeHandler = undefined;
    }
    if (this.svg) {
      this.svg.remove();
      this.svg = null;
    }
    if (this.fallbackWrapper) {
      this.fallbackWrapper.remove();
      this.fallbackWrapper = null;
    }
    this.subPaths = [];
    this.fillPaths = [];
  }

  private setupObserver(): void {
    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            this.start();
          } else {
            this.stop();
          }
        }
      },
      { root: null, threshold: 0 }
    );
    this.observer.observe(this.container);
  }

  /**
   * Set up resize handling for responsive behavior:
   * 1. Window resize - recalculate scroll progress (viewport height changes)
   * 2. Container resize - detect font-size changes when using inherited sizing
   */
  private setupResizeHandling(): void {
    // Window resize handler - recalculate scroll progress
    this.resizeHandler = () => {
      if (!this.pendingResize) {
        this.pendingResize = true;
        requestAnimationFrame(() => {
          this.pendingResize = false;
          // Force recalculation of scroll progress
          this.lastProgress = -1;
          if (this.isActive) {
            this.tick();
          }
        });
      }
    };
    window.addEventListener("resize", this.resizeHandler, { passive: true });

    // ResizeObserver for container - detect font-size changes when inherited
    // Only needed when fontSize is not explicitly set
    if (this.options.fontSize === undefined) {
      this.resizeObserver = new ResizeObserver(() => {
        // Check if computed font size has changed
        const currentFontSize = this.getInheritedFontSize();
        if (Math.abs(currentFontSize - this.lastComputedFontSize) > 0.5) {
          this.lastComputedFontSize = currentFontSize;
          // Rebuild the animation with new font size
          this.rebuildAnimation();
        }
      });
      this.resizeObserver.observe(this.container);
    }
  }

  /**
   * Rebuild the animation when font size changes (for inherited sizing).
   * This clears and recreates all character paths with the new size.
   */
  private async rebuildAnimation(): Promise<void> {
    // Store current progress to restore after rebuild
    const currentProgress = this.lastProgress;

    // Clear existing paths
    if (this.svg) {
      this.svg.remove();
      this.svg = document.createElementNS(SVG_NS, "svg");
      this.svg.style.overflow = "visible";
      this.svg.style.display = "inline";
    }
    if (this.fallbackWrapper) {
      this.fallbackWrapper.remove();
      this.fallbackWrapper = null;
    }
    this.subPaths = [];
    this.fillPaths = [];

    // Recreate paths with new font size
    await this.createCharacterPaths();

    // Re-add SVG to container
    if (this.svg) {
      this.container.appendChild(this.svg);
    }

    // Restore progress
    if (currentProgress >= 0) {
      this.lastProgress = -1; // Force re-render
      this.render(currentProgress);
    }
  }

  private start(): void {
    if (this.isActive) return;
    this.isActive = true;

    this.scrollHandler = () => {
      if (!this.pendingDraw) {
        this.pendingDraw = true;
        this.rafId = requestAnimationFrame(() => {
          this.pendingDraw = false;
          this.tick();
        });
      }
    };

    window.addEventListener("scroll", this.scrollHandler, { passive: true });
    // Initial tick
    this.tick();
  }

  private stop(): void {
    if (!this.isActive) return;
    this.isActive = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
    }
    if (this.scrollHandler) {
      window.removeEventListener("scroll", this.scrollHandler);
      this.scrollHandler = undefined;
    }
  }

  private tick(): void {
    const rect = this.container.getBoundingClientRect();
    const progress = resolveScrollProgress(rect, window.innerHeight, this.options.scrollRange);

    // Skip if progress hasn't changed significantly (threshold: 0.1%)
    if (Math.abs(progress - this.lastProgress) < 0.001) {
      return;
    }
    this.lastProgress = progress;
    this.options.onProgress?.(progress);

    this.render(progress);
  }
}

/**
 * Register a native text animation on a container element.
 * This creates scroll-driven text animation without pre-rendered assets.
 */
export async function registerNativeAnimation(
  options: NativeAnimationOptions
): Promise<() => void> {
  const player = new NativeTextPlayer(options);
  await player.init();
  return () => player.destroy();
}
