import { describe, it, expect } from "vitest";
import { computePropsHash, extractChildrenText } from "./hash";

describe("computePropsHash", () => {
  it("should produce consistent hashes for same input", () => {
    const hash1 = computePropsHash("TextScene", { text: "Hello", fontSize: 72 });
    const hash2 = computePropsHash("TextScene", { text: "Hello", fontSize: 72 });
    expect(hash1).toBe(hash2);
  });

  it("should produce different hashes for different scenes", () => {
    const hash1 = computePropsHash("TextScene", { text: "Hello" });
    const hash2 = computePropsHash("CustomScene", { text: "Hello" });
    expect(hash1).not.toBe(hash2);
  });

  it("should produce different hashes for different props", () => {
    const hash1 = computePropsHash("TextScene", { text: "Hello" });
    const hash2 = computePropsHash("TextScene", { text: "World" });
    expect(hash1).not.toBe(hash2);
  });

  it("should normalize key order (produce same hash regardless of key order)", () => {
    const hash1 = computePropsHash("TextScene", { a: 1, b: 2, c: 3 });
    const hash2 = computePropsHash("TextScene", { c: 3, a: 1, b: 2 });
    expect(hash1).toBe(hash2);
  });

  it("should handle empty props", () => {
    const hash = computePropsHash("TextScene", {});
    expect(hash).toHaveLength(8);
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it("should handle nested objects", () => {
    const hash1 = computePropsHash("Scene", { config: { theme: "dark", size: 10 } });
    const hash2 = computePropsHash("Scene", { config: { size: 10, theme: "dark" } });
    expect(hash1).toBe(hash2);
  });

  it("should handle arrays in props", () => {
    const hash1 = computePropsHash("Scene", { items: [1, 2, 3] });
    const hash2 = computePropsHash("Scene", { items: [1, 2, 3] });
    expect(hash1).toBe(hash2);

    // Different array order should produce different hash
    const hash3 = computePropsHash("Scene", { items: [3, 2, 1] });
    expect(hash1).not.toBe(hash3);
  });

  it("should handle null values", () => {
    const hash = computePropsHash("Scene", { value: null });
    expect(hash).toHaveLength(8);
  });

  it("should handle boolean values", () => {
    const hash1 = computePropsHash("Scene", { enabled: true });
    const hash2 = computePropsHash("Scene", { enabled: false });
    expect(hash1).not.toBe(hash2);
  });

  it("should handle string values", () => {
    const hash1 = computePropsHash("Scene", { color: "#ffffff" });
    const hash2 = computePropsHash("Scene", { color: "#000000" });
    expect(hash1).not.toBe(hash2);
  });

  it("should handle number values", () => {
    const hash1 = computePropsHash("Scene", { size: 72 });
    const hash2 = computePropsHash("Scene", { size: 48 });
    expect(hash1).not.toBe(hash2);
  });

  it("should produce valid hex string", () => {
    const hash = computePropsHash("TextScene", { text: "Test", fontSize: 72 });
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it("should handle unicode characters", () => {
    const hash1 = computePropsHash("Scene", { text: "Hello 👋 World" });
    const hash2 = computePropsHash("Scene", { text: "Hello 👋 World" });
    expect(hash1).toBe(hash2);
  });

  it("should handle special characters", () => {
    const hash = computePropsHash("Scene", { text: "Hello\n\t\"World\"" });
    expect(hash).toHaveLength(8);
  });
});

describe("extractChildrenText", () => {
  it("should extract string children", () => {
    expect(extractChildrenText("Hello World")).toBe("Hello World");
  });

  it("should trim string children", () => {
    expect(extractChildrenText("  Hello World  ")).toBe("Hello World");
  });

  it("should convert number children to string", () => {
    expect(extractChildrenText(42)).toBe("42");
    expect(extractChildrenText(3.14)).toBe("3.14");
    expect(extractChildrenText(0)).toBe("0");
  });

  it("should extract text from array of strings", () => {
    expect(extractChildrenText(["Hello", " ", "World"])).toBe("Hello World");
  });

  it("should handle array with numbers", () => {
    expect(extractChildrenText(["Value: ", 42])).toBe("Value: 42");
  });

  it("should filter out empty strings from arrays", () => {
    expect(extractChildrenText(["Hello", "", "World"])).toBe("Hello World");
  });

  it("should return null for non-extractable children", () => {
    expect(extractChildrenText(null)).toBeNull();
    expect(extractChildrenText(undefined)).toBeNull();
  });

  it("should return null for empty array", () => {
    expect(extractChildrenText([])).toBeNull();
  });

  it("should return null for array of empty strings", () => {
    expect(extractChildrenText(["", "  ", ""])).toBeNull();
  });

  it("should handle mixed array with non-string elements", () => {
    // Objects in array should be treated as empty
    expect(extractChildrenText(["Hello", {}, "World"] as React.ReactNode)).toBe("Hello World");
  });

  it("should handle objects (not extractable)", () => {
    expect(extractChildrenText({} as React.ReactNode)).toBeNull();
  });

  it("should handle boolean children", () => {
    expect(extractChildrenText(true as unknown as React.ReactNode)).toBeNull();
    expect(extractChildrenText(false as unknown as React.ReactNode)).toBeNull();
  });
});

describe("sortObjectKeys (via computePropsHash)", () => {
  // Test the sortObjectKeys function indirectly through computePropsHash

  it("should handle deeply nested objects", () => {
    const props1 = {
      level1: {
        level2: {
          level3: {
            b: 2,
            a: 1,
          },
        },
      },
    };

    const props2 = {
      level1: {
        level2: {
          level3: {
            a: 1,
            b: 2,
          },
        },
      },
    };

    const hash1 = computePropsHash("Scene", props1);
    const hash2 = computePropsHash("Scene", props2);
    expect(hash1).toBe(hash2);
  });

  it("should handle arrays of objects", () => {
    const props1 = {
      items: [
        { z: 3, y: 2, x: 1 },
        { c: 3, b: 2, a: 1 },
      ],
    };

    const props2 = {
      items: [
        { x: 1, y: 2, z: 3 },
        { a: 1, b: 2, c: 3 },
      ],
    };

    const hash1 = computePropsHash("Scene", props1);
    const hash2 = computePropsHash("Scene", props2);
    expect(hash1).toBe(hash2);
  });

  it("should preserve array order", () => {
    const hash1 = computePropsHash("Scene", { items: ["a", "b", "c"] });
    const hash2 = computePropsHash("Scene", { items: ["c", "b", "a"] });
    expect(hash1).not.toBe(hash2);
  });

  it("should handle null values in nested objects", () => {
    const hash = computePropsHash("Scene", {
      config: {
        value: null,
        other: "test",
      },
    });
    expect(hash).toHaveLength(8);
  });
});
