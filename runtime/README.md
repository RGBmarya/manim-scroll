# @mihirsarya/manim-scroll-runtime

Core scroll-driven playback runtime for pre-rendered Manim animations. Works in any JavaScript environment—use directly in vanilla JS or as the foundation for framework integrations.

## Installation

```bash
npm install @mihirsarya/manim-scroll-runtime
```

Or use the unified package (recommended for React/Next.js):

```bash
npm install @mihirsarya/manim-scroll
```

## Features

- **Video or frame-by-frame playback** with automatic fallback
- **Flexible scroll ranges** via presets, relative units, or pixels
- **Native text animation** using SVG (no pre-rendered assets needed)
- **Zero framework dependencies** for the core runtime

## Quick Start

### Pre-rendered Animation (Video/Frames)

```ts
import { registerScrollAnimation } from "@mihirsarya/manim-scroll-runtime";

const container = document.querySelector("#hero") as HTMLElement;

const cleanup = await registerScrollAnimation({
  container,
  manifestUrl: "/assets/scene/manifest.json",
  scrollRange: "viewport",
  onReady: () => console.log("Animation ready"),
  onProgress: (progress) => console.log(`Progress: ${progress}`),
});

// Call cleanup() when done to remove listeners
```

### Native Text Animation

```ts
import { registerNativeAnimation } from "@mihirsarya/manim-scroll-runtime";

const container = document.querySelector("#text") as HTMLElement;

const cleanup = await registerNativeAnimation({
  container,
  text: "Hello World",
  fontSize: 48,
  color: "#ffffff",
  scrollRange: "viewport",
  onReady: () => console.log("Ready"),
});
```

## Exports

### Functions

- **`registerScrollAnimation(options)`** - Register a scroll-driven animation with pre-rendered assets
- **`registerNativeAnimation(options)`** - Register a native SVG text animation

### Classes

- **`NativeTextPlayer`** - Low-level native text animation player

### Types

- `RenderManifest` - Animation manifest schema
- `ScrollAnimationOptions` - Options for `registerScrollAnimation`
- `NativeAnimationOptions` - Options for `registerNativeAnimation`
- `ScrollRange`, `ScrollRangePreset`, `ScrollRangeValue` - Scroll range types

## API Reference

### registerScrollAnimation(options)

Registers a scroll-driven animation using pre-rendered video or frame assets.

```ts
interface ScrollAnimationOptions {
  /** Container element for the animation */
  container: HTMLElement;
  /** URL to the animation manifest.json */
  manifestUrl: string;
  /** Playback mode (default: "auto") */
  mode?: "auto" | "frames" | "video";
  /** Optional canvas element (created automatically if not provided) */
  canvas?: HTMLCanvasElement;
  /** Scroll range configuration */
  scrollRange?: ScrollRangeValue;
  /** Called when animation is loaded and ready */
  onReady?: () => void;
  /** Called on scroll progress updates (0 to 1) */
  onProgress?: (progress: number) => void;
}
```

**Returns:** `Promise<() => void>` - Cleanup function to remove listeners

### registerNativeAnimation(options)

Registers a native text animation that renders in the browser using SVG, replicating Manim's Write/DrawBorderThenFill effect.

```ts
interface NativeAnimationOptions {
  /** Container element for the animation */
  container: HTMLElement;
  /** Text to animate */
  text: string;
  /** Font size in pixels (inherits from parent if not specified) */
  fontSize?: number;
  /** Text color (hex or CSS color) */
  color?: string;
  /** URL to a font file (woff, woff2, ttf, otf) */
  fontUrl?: string;
  /** Stroke width for the drawing phase (default: 2) */
  strokeWidth?: number;
  /** Scroll range configuration */
  scrollRange?: ScrollRangeValue;
  /** Called when animation is loaded and ready */
  onReady?: () => void;
  /** Called on scroll progress updates (0 to 1) */
  onProgress?: (progress: number) => void;
}
```

**Returns:** `Promise<() => void>` - Cleanup function to remove listeners

## Scroll Range Configuration

The `scrollRange` option controls when the animation plays relative to scroll position.

### Presets

```ts
// Animation plays as element crosses the viewport (most common)
scrollRange: "viewport"

// Animation tied to element's own scroll position
scrollRange: "element"

// Animation spans entire document scroll
scrollRange: "full"
```

### Relative Units

Use viewport height (`vh`) or element percentage (`%`):

```ts
// Start when element is 100vh from top, end at -50% of element height
scrollRange: ["100vh", "-50%"]

// Mix units as needed
scrollRange: ["80vh", "-100%"]
```

### Pixel Values

For precise control:

```ts
// As a tuple
scrollRange: [800, -400]

// As an object (legacy format)
scrollRange: { start: 800, end: -400 }
```

## Manifest Schema

The `manifest.json` file describes a pre-rendered animation:

```ts
interface RenderManifest {
  /** Scene name */
  scene: string;
  /** Frames per second */
  fps: number;
  /** Canvas width */
  width: number;
  /** Canvas height */
  height: number;
  /** Array of frame image URLs */
  frames: string[];
  /** Video URL (null if not available) */
  video: string | null;
  /** Whether rendered with transparent background */
  transparent?: boolean;
  /** Whether this is an inline animation */
  inline?: boolean;
  /** Aspect ratio for inline sizing */
  aspectRatio?: number | null;
}
```

## Playback Modes

| Mode | Description |
|------|-------------|
| `"auto"` | Uses video if available, falls back to frames |
| `"video"` | Forces video playback (fails if no video) |
| `"frames"` | Forces frame-by-frame playback |

## Browser Usage (CDN)

```html
<script type="module">
  import { registerScrollAnimation } from "https://esm.sh/@mihirsarya/manim-scroll-runtime";
  
  registerScrollAnimation({
    container: document.querySelector("#hero"),
    manifestUrl: "/assets/scene/manifest.json",
    scrollRange: "viewport",
  });
</script>
```

## Dependencies

- [opentype.js](https://opentype.js.org/) - For native text animation font parsing

## License

MIT
