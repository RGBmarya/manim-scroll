/**
 * Recursively sort object keys for deterministic JSON stringification.
 */
function sortObjectKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }

  const sorted: Record<string, unknown> = {};
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  for (const key of keys) {
    sorted[key] = sortObjectKeys((obj as Record<string, unknown>)[key]);
  }
  return sorted;
}

/**
 * Compute a deterministic hash for animation props.
 * This hash is used to look up pre-rendered assets at runtime.
 *
 * Note: This must produce the same hash as the build-time hasher.
 * Uses the djb2 algorithm for cross-environment compatibility.
 */
export function computePropsHash(
  scene: string,
  props: Record<string, unknown>
): string {
  // Create a deterministic string representation
  // Sort keys to ensure consistent ordering
  const sortedProps = sortObjectKeys(props);
  const data = JSON.stringify({ scene, props: sortedProps });

  // Use djb2 hash algorithm - matches the build-time implementation
  let hash = 5381;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) + hash + data.charCodeAt(i)) | 0;
  }

  // Convert to positive hex string, padded to 8 chars
  const hexHash = (hash >>> 0).toString(16).padStart(8, "0");
  return hexHash;
}

/**
 * Extract text content from React children.
 * Handles strings and arrays of strings.
 */
export function extractChildrenText(children: React.ReactNode): string | null {
  if (typeof children === "string") {
    return children.trim();
  }

  if (typeof children === "number") {
    return String(children);
  }

  if (Array.isArray(children)) {
    const texts = children
      .map((child) => {
        if (typeof child === "string") return child.trim();
        if (typeof child === "number") return String(child);
        return "";
      })
      .filter(Boolean);
    return texts.length > 0 ? texts.join(" ") : null;
  }

  return null;
}
