import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// We need to test the internal functions, so we'll extract them for testing
// The player module doesn't export these, so we'll create unit tests for the logic

/**
 * Clone of parseRelativeUnit for testing
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
 * Clone of resolveScrollRange for testing
 */
type ScrollRangePreset = "viewport" | "element" | "full";
type ScrollRange = { start?: number; end?: number };
type ScrollRangeValue =
  | ScrollRangePreset
  | [start: string | number, end: string | number]
  | ScrollRange;

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

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

function resolveScrollProgress(
  rectTop: number,
  rectHeight: number,
  viewportHeight: number,
  documentHeight: number,
  range?: ScrollRangeValue
): number {
  const resolved = resolveScrollRange(range, viewportHeight, rectHeight, documentHeight);
  const start = resolved.start ?? viewportHeight;
  const end = resolved.end ?? -rectHeight;
  const progress = (start - rectTop) / (start - end);
  return clamp(progress, 0, 1);
}

describe("parseRelativeUnit", () => {
  const viewportHeight = 1000;
  const elementHeight = 500;

  it("should return number values directly", () => {
    expect(parseRelativeUnit(100, viewportHeight, elementHeight)).toBe(100);
    expect(parseRelativeUnit(-50, viewportHeight, elementHeight)).toBe(-50);
    expect(parseRelativeUnit(0, viewportHeight, elementHeight)).toBe(0);
  });

  it("should parse viewport height units (vh)", () => {
    expect(parseRelativeUnit("100vh", viewportHeight, elementHeight)).toBe(1000);
    expect(parseRelativeUnit("50vh", viewportHeight, elementHeight)).toBe(500);
    expect(parseRelativeUnit("0vh", viewportHeight, elementHeight)).toBe(0);
    expect(parseRelativeUnit("-25vh", viewportHeight, elementHeight)).toBe(-250);
  });

  it("should parse percentage units (relative to element height)", () => {
    expect(parseRelativeUnit("100%", viewportHeight, elementHeight)).toBe(500);
    expect(parseRelativeUnit("50%", viewportHeight, elementHeight)).toBe(250);
    expect(parseRelativeUnit("-50%", viewportHeight, elementHeight)).toBe(-250);
  });

  it("should parse pixel units", () => {
    expect(parseRelativeUnit("100px", viewportHeight, elementHeight)).toBe(100);
    expect(parseRelativeUnit("-200px", viewportHeight, elementHeight)).toBe(-200);
  });

  it("should parse plain numbers as strings", () => {
    expect(parseRelativeUnit("100", viewportHeight, elementHeight)).toBe(100);
    expect(parseRelativeUnit("-50", viewportHeight, elementHeight)).toBe(-50);
  });

  it("should handle whitespace", () => {
    expect(parseRelativeUnit("  100vh  ", viewportHeight, elementHeight)).toBe(1000);
    expect(parseRelativeUnit("  50%  ", viewportHeight, elementHeight)).toBe(250);
  });
});

describe("resolveScrollRange", () => {
  const viewportHeight = 1000;
  const elementHeight = 500;
  const documentHeight = 3000;

  it("should handle undefined (defaults to viewport preset)", () => {
    const result = resolveScrollRange(undefined, viewportHeight, elementHeight, documentHeight);
    expect(result.start).toBe(1000);
    expect(result.end).toBe(-500);
  });

  it("should handle viewport preset", () => {
    const result = resolveScrollRange("viewport", viewportHeight, elementHeight, documentHeight);
    expect(result.start).toBe(1000);
    expect(result.end).toBe(-500);
  });

  it("should handle element preset", () => {
    const result = resolveScrollRange("element", viewportHeight, elementHeight, documentHeight);
    expect(result.start).toBe(800); // viewportHeight * 0.8
    expect(result.end).toBe(-300); // viewportHeight * 0.2 - elementHeight
  });

  it("should handle full preset", () => {
    const result = resolveScrollRange("full", viewportHeight, elementHeight, documentHeight);
    expect(result.start).toBe(2000); // documentHeight - viewportHeight
    expect(result.end).toBe(0);
  });

  it("should handle tuple format with relative units", () => {
    const result = resolveScrollRange(
      ["100vh", "-50%"],
      viewportHeight,
      elementHeight,
      documentHeight
    );
    expect(result.start).toBe(1000);
    expect(result.end).toBe(-250);
  });

  it("should handle tuple format with numbers", () => {
    const result = resolveScrollRange(
      [800, -400],
      viewportHeight,
      elementHeight,
      documentHeight
    );
    expect(result.start).toBe(800);
    expect(result.end).toBe(-400);
  });

  it("should handle tuple format with mixed values", () => {
    const result = resolveScrollRange(
      ["80vh", -200],
      viewportHeight,
      elementHeight,
      documentHeight
    );
    expect(result.start).toBe(800);
    expect(result.end).toBe(-200);
  });

  it("should handle legacy object format", () => {
    const result = resolveScrollRange(
      { start: 600, end: -300 },
      viewportHeight,
      elementHeight,
      documentHeight
    );
    expect(result.start).toBe(600);
    expect(result.end).toBe(-300);
  });

  it("should handle partial legacy object format", () => {
    const result = resolveScrollRange(
      { start: 600 },
      viewportHeight,
      elementHeight,
      documentHeight
    );
    expect(result.start).toBe(600);
    expect(result.end).toBe(-500); // defaults to -elementHeight
  });

  it("should handle empty legacy object format", () => {
    const result = resolveScrollRange(
      {},
      viewportHeight,
      elementHeight,
      documentHeight
    );
    expect(result.start).toBe(1000); // defaults to viewportHeight
    expect(result.end).toBe(-500); // defaults to -elementHeight
  });
});

describe("resolveScrollProgress", () => {
  const viewportHeight = 1000;
  const elementHeight = 500;
  const documentHeight = 3000;

  it("should return 0 when element is below viewport", () => {
    // Element top is at viewport height (just entering from bottom)
    const progress = resolveScrollProgress(
      viewportHeight, // rectTop at bottom of viewport
      elementHeight,
      viewportHeight,
      documentHeight,
      "viewport"
    );
    expect(progress).toBe(0);
  });

  it("should return 1 when element is above viewport", () => {
    // Element top is at -elementHeight (fully exited top)
    const progress = resolveScrollProgress(
      -elementHeight,
      elementHeight,
      viewportHeight,
      documentHeight,
      "viewport"
    );
    expect(progress).toBe(1);
  });

  it("should return 0.5 when element is halfway through", () => {
    // Halfway between start (1000) and end (-500) is 250
    const progress = resolveScrollProgress(
      250,
      elementHeight,
      viewportHeight,
      documentHeight,
      "viewport"
    );
    expect(progress).toBe(0.5);
  });

  it("should clamp progress to 0-1 range", () => {
    // Way below viewport
    const progressBelow = resolveScrollProgress(
      2000, // far below
      elementHeight,
      viewportHeight,
      documentHeight,
      "viewport"
    );
    expect(progressBelow).toBe(0);

    // Way above viewport
    const progressAbove = resolveScrollProgress(
      -2000, // far above
      elementHeight,
      viewportHeight,
      documentHeight,
      "viewport"
    );
    expect(progressAbove).toBe(1);
  });

  it("should work with different scroll range presets", () => {
    // Test with element preset
    const progressElement = resolveScrollProgress(
      viewportHeight * 0.5, // middle
      elementHeight,
      viewportHeight,
      documentHeight,
      "element"
    );
    expect(progressElement).toBeGreaterThan(0);
    expect(progressElement).toBeLessThan(1);
  });
});

describe("clamp", () => {
  it("should clamp values within range", () => {
    expect(clamp(0.5, 0, 1)).toBe(0.5);
    expect(clamp(0, 0, 1)).toBe(0);
    expect(clamp(1, 0, 1)).toBe(1);
  });

  it("should clamp values below minimum", () => {
    expect(clamp(-1, 0, 1)).toBe(0);
    expect(clamp(-100, 0, 1)).toBe(0);
  });

  it("should clamp values above maximum", () => {
    expect(clamp(2, 0, 1)).toBe(1);
    expect(clamp(100, 0, 1)).toBe(1);
  });

  it("should work with different ranges", () => {
    expect(clamp(50, 0, 100)).toBe(50);
    expect(clamp(-10, 0, 100)).toBe(0);
    expect(clamp(150, 0, 100)).toBe(100);
  });
});
