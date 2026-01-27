import * as fs from "fs";
import * as path from "path";
import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import * as t from "@babel/types";
import { glob } from "glob";

export interface ExtractedAnimation {
  /** Unique identifier based on file path and location */
  id: string;
  /** Source file path */
  filePath: string;
  /** Line number in source */
  line: number;
  /** Scene name (defaults to "TextScene") */
  scene: string;
  /** Props to pass to the Manim scene */
  props: Record<string, unknown>;
}

interface ExtractorOptions {
  /** Root directory to scan */
  rootDir: string;
  /** Glob patterns to include (default: ["**\/*.tsx", "**\/*.jsx"]) */
  include?: string[];
  /** Glob patterns to exclude (default: ["node_modules/**", ".next/**"]) */
  exclude?: string[];
}

/**
 * Extract the text content from JSX children.
 * Handles string literals and JSX text nodes.
 */
function extractChildrenText(children: t.Node[]): string | null {
  const textParts: string[] = [];

  for (const child of children) {
    if (t.isJSXText(child)) {
      const trimmed = child.value.trim();
      if (trimmed) {
        textParts.push(trimmed);
      }
    } else if (t.isStringLiteral(child)) {
      textParts.push(child.value);
    } else if (t.isJSXExpressionContainer(child)) {
      if (t.isStringLiteral(child.expression)) {
        textParts.push(child.expression.value);
      } else if (t.isTemplateLiteral(child.expression)) {
        // Handle simple template literals without expressions
        const parts = child.expression.quasis.map((q) => q.value.cooked || q.value.raw);
        textParts.push(parts.join(""));
      }
    }
  }

  return textParts.length > 0 ? textParts.join(" ") : null;
}

/**
 * Extract a literal value from a JSX attribute value.
 */
function extractAttributeValue(value: t.JSXAttribute["value"]): unknown {
  if (value === null) {
    return true; // Boolean attribute like `disabled`
  }

  if (t.isStringLiteral(value)) {
    return value.value;
  }

  if (t.isJSXExpressionContainer(value)) {
    const expr = value.expression;

    if (t.isStringLiteral(expr)) {
      return expr.value;
    }
    if (t.isNumericLiteral(expr)) {
      return expr.value;
    }
    if (t.isBooleanLiteral(expr)) {
      return expr.value;
    }
    if (t.isNullLiteral(expr)) {
      return null;
    }
    if (t.isObjectExpression(expr)) {
      return extractObjectExpression(expr);
    }
    if (t.isArrayExpression(expr)) {
      return extractArrayExpression(expr);
    }
  }

  // Cannot statically extract, return undefined
  return undefined;
}

/**
 * Extract an object expression into a plain object.
 */
function extractObjectExpression(expr: t.ObjectExpression): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const prop of expr.properties) {
    if (t.isObjectProperty(prop)) {
      let key: string | null = null;

      if (t.isIdentifier(prop.key)) {
        key = prop.key.name;
      } else if (t.isStringLiteral(prop.key)) {
        key = prop.key.value;
      }

      if (key !== null) {
        if (t.isStringLiteral(prop.value)) {
          result[key] = prop.value.value;
        } else if (t.isNumericLiteral(prop.value)) {
          result[key] = prop.value.value;
        } else if (t.isBooleanLiteral(prop.value)) {
          result[key] = prop.value.value;
        } else if (t.isNullLiteral(prop.value)) {
          result[key] = null;
        } else if (t.isObjectExpression(prop.value)) {
          result[key] = extractObjectExpression(prop.value);
        } else if (t.isArrayExpression(prop.value)) {
          result[key] = extractArrayExpression(prop.value);
        }
      }
    }
  }

  return result;
}

/**
 * Extract an array expression into a plain array.
 */
function extractArrayExpression(expr: t.ArrayExpression): unknown[] {
  const result: unknown[] = [];

  for (const element of expr.elements) {
    if (element === null) {
      result.push(null);
    } else if (t.isStringLiteral(element)) {
      result.push(element.value);
    } else if (t.isNumericLiteral(element)) {
      result.push(element.value);
    } else if (t.isBooleanLiteral(element)) {
      result.push(element.value);
    } else if (t.isNullLiteral(element)) {
      result.push(null);
    } else if (t.isObjectExpression(element)) {
      result.push(extractObjectExpression(element));
    } else if (t.isArrayExpression(element)) {
      result.push(extractArrayExpression(element));
    }
  }

  return result;
}

/**
 * Check if a JSX element is a ManimScroll component.
 */
function isManimScrollComponent(node: t.JSXOpeningElement): boolean {
  if (t.isJSXIdentifier(node.name)) {
    return node.name.name === "ManimScroll";
  }
  if (t.isJSXMemberExpression(node.name)) {
    // Handle cases like `Components.ManimScroll`
    if (t.isJSXIdentifier(node.name.property)) {
      return node.name.property.name === "ManimScroll";
    }
  }
  return false;
}

/**
 * Props that should NOT be included in the animation hash.
 * These are display/scroll-related props, not animation-specific props.
 * This list must stay in sync with what ManimScroll.tsx excludes from animationProps.
 */
const EXCLUDED_PROPS = new Set([
  "manifestUrl",
  "mode",
  "scrollRange",
  "onReady",
  "onProgress",
  "canvas",
  "className",
  "style",
  "children", // children is handled separately as "text"
]);

/**
 * Extract ManimScroll component data from a JSX element.
 * Returns null if the component uses native mode (no pre-rendering needed).
 */
function extractManimScroll(
  jsxElement: t.JSXElement,
  filePath: string
): Omit<ExtractedAnimation, "id"> | null {
  const openingElement = jsxElement.openingElement;

  if (!isManimScrollComponent(openingElement)) {
    return null;
  }

  const props: Record<string, unknown> = {};
  let scene = "TextScene";
  let mode: string | undefined;

  // Extract attributes
  for (const attr of openingElement.attributes) {
    if (t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name)) {
      const name = attr.name.name;
      const value = extractAttributeValue(attr.value);

      if (name === "scene" && typeof value === "string") {
        scene = value;
      } else if (name === "mode" && typeof value === "string") {
        mode = value;
      } else if (EXCLUDED_PROPS.has(name)) {
        // Skip display/scroll-related props - only include animation-specific props
        continue;
      } else if (value !== undefined) {
        props[name] = value;
      }
    }
  }

  // Skip native mode components - they render in the browser without pre-rendering
  if (mode === "native") {
    return null;
  }

  // Extract children as text prop
  const childrenText = extractChildrenText(jsxElement.children);
  if (childrenText) {
    props.text = childrenText;
  }

  const line = openingElement.loc?.start.line ?? 0;

  return {
    filePath,
    line,
    scene,
    props,
  };
}

/**
 * Parse a source file and extract all ManimScroll components.
 */
function extractFromFile(filePath: string): ExtractedAnimation[] {
  const source = fs.readFileSync(filePath, "utf-8");
  const animations: ExtractedAnimation[] = [];

  let ast: t.File;
  try {
    ast = parse(source, {
      sourceType: "module",
      plugins: ["jsx", "typescript"],
    });
  } catch {
    // Skip files that cannot be parsed
    return [];
  }

  traverse(ast, {
    JSXElement(nodePath) {
      const extracted = extractManimScroll(nodePath.node, filePath);
      if (extracted) {
        // Create a unique ID based on file path and line number
        const relativePath = filePath.replace(/\\/g, "/");
        const id = `${relativePath}:${extracted.line}`;

        animations.push({
          id,
          ...extracted,
        });
      }
    },
  });

  return animations;
}

/**
 * Scan a directory for ManimScroll components and extract their configurations.
 */
export async function extractAnimations(
  options: ExtractorOptions
): Promise<ExtractedAnimation[]> {
  const {
    rootDir,
    include = ["**/*.tsx", "**/*.jsx"],
    exclude = ["node_modules/**", ".next/**", "dist/**"],
  } = options;

  const allAnimations: ExtractedAnimation[] = [];

  for (const pattern of include) {
    const files = await glob(pattern, {
      cwd: rootDir,
      ignore: exclude,
      absolute: true,
    });

    for (const file of files) {
      const animations = extractFromFile(file);
      allAnimations.push(...animations);
    }
  }

  return allAnimations;
}

/**
 * Extract animations from a single file (useful for watch mode).
 */
export function extractAnimationsFromFile(filePath: string): ExtractedAnimation[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  return extractFromFile(filePath);
}
