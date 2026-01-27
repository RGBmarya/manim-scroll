import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import { extractAnimationsFromFile } from "./extractor";

// Mock fs module
vi.mock("fs");

// Mock glob module
vi.mock("glob", () => ({
  glob: vi.fn().mockResolvedValue([]),
}));

describe("extractAnimationsFromFile", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should return empty array for non-existent file", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = extractAnimationsFromFile("/path/to/missing.tsx");

    expect(result).toEqual([]);
  });

  it("should extract basic ManimScroll component", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(`
      import { ManimScroll } from "@mihirsarya/manim-scroll";

      export default function Page() {
        return (
          <ManimScroll fontSize={72} color="#ffffff">
            Hello World
          </ManimScroll>
        );
      }
    `);

    const result = extractAnimationsFromFile("/app/page.tsx");

    expect(result).toHaveLength(1);
    expect(result[0].scene).toBe("TextScene"); // default
    expect(result[0].props.fontSize).toBe(72);
    expect(result[0].props.color).toBe("#ffffff");
    expect(result[0].props.text).toBe("Hello World");
  });

  it("should extract custom scene name", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(`
      <ManimScroll scene="CustomScene" value={42} />
    `);

    const result = extractAnimationsFromFile("/app/page.tsx");

    expect(result).toHaveLength(1);
    expect(result[0].scene).toBe("CustomScene");
    expect(result[0].props.value).toBe(42);
  });

  it("should extract multiple ManimScroll components", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(`
      function Page() {
        return (
          <div>
            <ManimScroll fontSize={48}>First</ManimScroll>
            <ManimScroll fontSize={72}>Second</ManimScroll>
          </div>
        );
      }
    `);

    const result = extractAnimationsFromFile("/app/page.tsx");

    expect(result).toHaveLength(2);
    expect(result[0].props.text).toBe("First");
    expect(result[1].props.text).toBe("Second");
  });

  it("should skip components with manifestUrl (explicit mode)", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(`
      <ManimScroll manifestUrl="/assets/scene/manifest.json">
        This should be skipped
      </ManimScroll>
    `);

    const result = extractAnimationsFromFile("/app/page.tsx");

    expect(result).toHaveLength(1);
    // manifestUrl should not be in props
    expect(result[0].props.manifestUrl).toBeUndefined();
  });

  it("should extract boolean attributes", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(`
      <ManimScroll enabled loop />
    `);

    const result = extractAnimationsFromFile("/app/page.tsx");

    expect(result).toHaveLength(1);
    expect(result[0].props.enabled).toBe(true);
    expect(result[0].props.loop).toBe(true);
  });

  it("should extract object props", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(`
      <ManimScroll config={{ theme: "dark", size: 10 }} />
    `);

    const result = extractAnimationsFromFile("/app/page.tsx");

    expect(result).toHaveLength(1);
    expect(result[0].props.config).toEqual({ theme: "dark", size: 10 });
  });

  it("should extract array props", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(`
      <ManimScroll items={[1, 2, 3]} />
    `);

    const result = extractAnimationsFromFile("/app/page.tsx");

    expect(result).toHaveLength(1);
    expect(result[0].props.items).toEqual([1, 2, 3]);
  });

  it("should extract null props", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(`
      <ManimScroll value={null} />
    `);

    const result = extractAnimationsFromFile("/app/page.tsx");

    expect(result).toHaveLength(1);
    expect(result[0].props.value).toBeNull();
  });

  it("should handle template literals in children", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(`
      <ManimScroll>{\`Hello World\`}</ManimScroll>
    `);

    const result = extractAnimationsFromFile("/app/page.tsx");

    expect(result).toHaveLength(1);
    expect(result[0].props.text).toBe("Hello World");
  });

  it("should handle JSX expression with string literal in children", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(`
      <ManimScroll>{"Hello World"}</ManimScroll>
    `);

    const result = extractAnimationsFromFile("/app/page.tsx");

    expect(result).toHaveLength(1);
    expect(result[0].props.text).toBe("Hello World");
  });

  it("should handle ManimScroll as member expression", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(`
      import * as Components from "@mihirsarya/manim-scroll";

      <Components.ManimScroll fontSize={72}>Test</Components.ManimScroll>
    `);

    const result = extractAnimationsFromFile("/app/page.tsx");

    expect(result).toHaveLength(1);
    expect(result[0].scene).toBe("TextScene");
    expect(result[0].props.fontSize).toBe(72);
  });

  it("should return empty array for files with no ManimScroll", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(`
      function Page() {
        return <div>No animations here</div>;
      }
    `);

    const result = extractAnimationsFromFile("/app/page.tsx");

    expect(result).toEqual([]);
  });

  it("should return empty array for unparseable files", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(`
      this is not valid javascript/typescript
      <ManimScroll>Test</ManimScroll>
      !!!syntax error!!!
    `);

    const result = extractAnimationsFromFile("/app/page.tsx");

    // Should return empty array, not throw
    expect(result).toEqual([]);
  });

  it("should include file path and line number", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(`
      // Line 1
      // Line 2
      <ManimScroll>Test</ManimScroll>
    `);

    const result = extractAnimationsFromFile("/app/page.tsx");

    expect(result).toHaveLength(1);
    expect(result[0].filePath).toBe("/app/page.tsx");
    expect(result[0].line).toBeGreaterThan(0);
    expect(result[0].id).toContain("/app/page.tsx:");
  });

  it("should handle nested objects in props", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(`
      <ManimScroll 
        config={{ 
          theme: { primary: "#fff", secondary: "#000" },
          sizes: [10, 20, 30]
        }} 
      />
    `);

    const result = extractAnimationsFromFile("/app/page.tsx");

    expect(result).toHaveLength(1);
    expect(result[0].props.config).toEqual({
      theme: { primary: "#fff", secondary: "#000" },
      sizes: [10, 20, 30],
    });
  });

  it("should handle numeric string keys in objects", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(`
      <ManimScroll data={{ "123": "value" }} />
    `);

    const result = extractAnimationsFromFile("/app/page.tsx");

    expect(result).toHaveLength(1);
    expect(result[0].props.data).toEqual({ "123": "value" });
  });

  it("should exclude display/scroll-related props from animation props", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(`
      <ManimScroll
        fontSize={72}
        color="#ffffff"
        scrollRange="viewport"
        style={{ width: "100%", height: "100%" }}
        className="animation-container"
        mode="frames"
        onReady={() => {}}
        onProgress={(p) => console.log(p)}
        canvas={{ width: 1920, height: 1080 }}
      >
        Hello World
      </ManimScroll>
    `);

    const result = extractAnimationsFromFile("/app/page.tsx");

    expect(result).toHaveLength(1);
    // Animation props should be included
    expect(result[0].props.fontSize).toBe(72);
    expect(result[0].props.color).toBe("#ffffff");
    expect(result[0].props.text).toBe("Hello World");
    // Display/scroll props should be excluded
    expect(result[0].props.scrollRange).toBeUndefined();
    expect(result[0].props.style).toBeUndefined();
    expect(result[0].props.className).toBeUndefined();
    expect(result[0].props.mode).toBeUndefined();
    expect(result[0].props.onReady).toBeUndefined();
    expect(result[0].props.onProgress).toBeUndefined();
    expect(result[0].props.canvas).toBeUndefined();
  });
});

describe("extractChildrenText (via extractor)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should combine multiple JSX text nodes", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    // When text spans multiple lines, JSX parser treats it as a single text node
    // with internal whitespace preserved (only leading/trailing trimmed)
    vi.mocked(fs.readFileSync).mockReturnValue(`
      <ManimScroll>Hello World</ManimScroll>
    `);

    const result = extractAnimationsFromFile("/app/page.tsx");

    expect(result).toHaveLength(1);
    expect(result[0].props.text).toBe("Hello World");
  });

  it("should handle multiline text (preserves internal whitespace)", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(`
      <ManimScroll>
        Hello
        World
      </ManimScroll>
    `);

    const result = extractAnimationsFromFile("/app/page.tsx");

    expect(result).toHaveLength(1);
    // Multiline JSX text preserves internal newlines after trimming
    expect(result[0].props.text).toContain("Hello");
    expect(result[0].props.text).toContain("World");
  });

  it("should handle whitespace-only children as no text", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(`
      <ManimScroll>   </ManimScroll>
    `);

    const result = extractAnimationsFromFile("/app/page.tsx");

    expect(result).toHaveLength(1);
    expect(result[0].props.text).toBeUndefined();
  });

  it("should trim whitespace from text", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(`
      <ManimScroll>  Hello World  </ManimScroll>
    `);

    const result = extractAnimationsFromFile("/app/page.tsx");

    expect(result).toHaveLength(1);
    expect(result[0].props.text).toBe("Hello World");
  });
});
