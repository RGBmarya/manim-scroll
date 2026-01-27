---
name: manim-scroll
description: Build and integrate scroll-driven Manim animations with pre-rendered assets, manifest generation, and the web runtime in this repo. Use when users ask about Manim scroll playback, render pipelines, or integrating the runtime.
globs:
  - "**/*.tsx"
  - "**/*.ts"
  - "**/*.jsx"
  - "**/*.js"
  - "**/next.config.*"
alwaysApply: false
---

# Manim Scroll

Scroll-driven Manim animations for the web. Pre-render mathematical animations with Manim and play them back smoothly as users scroll.

## Quick start (Next.js)

The recommended approach uses the Next.js plugin for automatic build-time rendering.

1. Install the unified package:

```bash
npm install @mihirsarya/manim-scroll
```

2. Configure `next.config.js`:

```js
const { withManimScroll } = require("@mihirsarya/manim-scroll/next");

module.exports = withManimScroll({
  manimScroll: {
    pythonPath: "python3",
    quality: "h",
    fps: 30,
    resolution: "1920x1080",
  },
});
```

3. Use the component with inline props:

```tsx
import { ManimScroll } from "@mihirsarya/manim-scroll";

export default function Page() {
  return (
    <ManimScroll
      scene="TextScene"
      fontSize={72}
      color="#ffffff"
      scrollRange="viewport"
      style={{ height: "100vh", background: "#111" }}
    >
      Welcome to my site
    </ManimScroll>
  );
}
```

The plugin automatically extracts props, renders animations, and caches them.

## Native mode (no pre-rendered assets)

For text animations without pre-rendered video/frames, use native mode. This renders text directly in the browser using SVG, replicating Manim's Write/DrawBorderThenFill animation.

```tsx
<ManimScroll
  mode="native"
  fontSize={48}
  color="#ffffff"
  scrollRange="viewport"
  style={{ height: "100vh", background: "#111" }}
>
  Currently building
</ManimScroll>
```

Native mode benefits:
- **No build step required** - works immediately without Python/Manim
- **Perfect sizing** - text renders at exact pixel size (no scaling artifacts)
- **Smaller bundle** - no video/frame assets to download
- **Authentic Manim animation** - replicates Write/DrawBorderThenFill exactly:
  - Uses Manim's exact `lag_ratio = min(4.0 / length, 0.2)` formula
  - Two-phase animation via `integer_interpolate(0, 2, alpha)`
  - Phase 0: Draw stroke progressively (0-50%)
  - Phase 1: Interpolate from outline to filled (50-100%)
  - Stroke width defaults to 2 (matching Manim's DrawBorderThenFill)
  - Uses `linear` rate function for Write animation
  - **Progressive outlines**: Each character is split into individual contours (sub-paths), and the lag_ratio is applied to ALL contours across all characters, so outlines appear progressively rather than all at once (matching Manim's behavior)
- **Scroll-driven** - same scroll progress behavior as pre-rendered mode

### useNativeAnimation hook

For programmatic control:

```tsx
import { useRef } from "react";
import { useNativeAnimation } from "@mihirsarya/manim-scroll";

function NativeDemo() {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { progress, isReady } = useNativeAnimation({
    ref: containerRef,
    text: "Hello World",
    fontSize: 72,
    color: "#ffffff",
    scrollRange: "viewport",
  });

  return (
    <div ref={containerRef} style={{ height: "100vh" }}>
      {!isReady && <div>Loading...</div>}
    </div>
  );
}
```

### Vanilla JS usage

```ts
import { registerNativeAnimation } from "@mihirsarya/manim-scroll-runtime";

const container = document.querySelector("#hero") as HTMLElement;

registerNativeAnimation({
  container,
  text: "Animate this",
  fontSize: 72,
  color: "#ffffff",
  scrollRange: "viewport",
  onReady: () => console.log("ready"),
});
```

### Custom fonts

For authentic Manim typography, provide a font URL (woff, woff2, ttf, otf):

```tsx
<ManimScroll
  mode="native"
  fontSize={48}
  color="#ffffff"
  fontUrl="/fonts/CMUSerif-Roman.woff2"
>
  Mathematical text
</ManimScroll>
```

## Inline mode

For animations that flow with surrounding text (like within a paragraph), use inline mode:

```tsx
<p>
  I'm building{" "}
  <ManimScroll
    scene="TextScene"
    fontSize={24}
    color="#667eea"
    inline
    style={{ width: "150px", height: "30px" }}
  >
    the future
  </ManimScroll>{" "}
  today.
</p>
```

Inline mode:
- Renders with a **transparent background**
- Uses `display: inline-block` for flow with text
- Adjusts the Manim camera to fit text tightly with minimal padding
- Outputs WebM with alpha channel (for video mode) or transparent PNGs (for frames mode)

## Package structure

- `packages/manim-scroll/` - Unified package (`@mihirsarya/manim-scroll`)
- `next/` - Next.js build plugin (`@mihirsarya/manim-scroll-next`)
- `react/` - React component and hook (`@mihirsarya/manim-scroll-react`)
- `runtime/` - Core scroll runtime (`@mihirsarya/manim-scroll-runtime`)
- `render/` - Python CLI for Manim rendering

## Next.js plugin configuration

| Option | Default | Description |
|--------|---------|-------------|
| `pythonPath` | `"python3"` | Path to Python executable |
| `quality` | `"h"` | Manim quality preset (l, m, h, k) |
| `fps` | `30` | Frames per second |
| `resolution` | `"1920x1080"` | Output resolution |
| `format` | `"both"` | Output format (frames, video, both) |
| `concurrency` | CPU count - 1 | Max parallel renders |
| `verbose` | `false` | Enable verbose logging |
| `cleanOrphans` | `true` | Remove unused cached assets |

## Scroll range configuration

Control when the animation plays relative to scroll position.

### Presets (recommended)

```tsx
<ManimScroll scrollRange="viewport">...</ManimScroll>  // Default: plays as element crosses viewport
<ManimScroll scrollRange="element">...</ManimScroll>   // Tied to element's own scroll position
<ManimScroll scrollRange="full">...</ManimScroll>      // Spans entire document scroll
```

### Relative units

```tsx
<ManimScroll scrollRange={["100vh", "-50%"]}>...</ManimScroll>
<ManimScroll scrollRange={["80vh", "-100%"]}>...</ManimScroll>
```

### Pixel values (legacy)

```tsx
<ManimScroll scrollRange={{ start: 800, end: -400 }}>...</ManimScroll>
<ManimScroll scrollRange={[800, -400]}>...</ManimScroll>
```

## useManimScroll hook

For advanced use cases requiring custom control:

```tsx
import { useRef } from "react";
import { useManimScroll } from "@mihirsarya/manim-scroll";

function CustomAnimation() {
  const containerRef = useRef<HTMLDivElement>(null);

  const { progress, isReady, error, pause, resume, seek, isPaused } = useManimScroll({
    ref: containerRef,
    manifestUrl: "/assets/scene/manifest.json",
    scrollRange: "viewport",
  });

  return (
    <div ref={containerRef} style={{ height: "100vh" }}>
      {!isReady && <div>Loading...</div>}
      <div>Progress: {Math.round(progress * 100)}%</div>
      <button onClick={pause}>Pause</button>
      <button onClick={resume}>Resume</button>
    </div>
  );
}
```

### Hook options

| Option | Type | Description |
|--------|------|-------------|
| `ref` | `RefObject<HTMLElement>` | Container element ref (required) |
| `manifestUrl` | `string` | Explicit manifest URL |
| `scene` | `string` | Scene name for auto-resolution |
| `animationProps` | `Record<string, unknown>` | Props for auto-resolution |
| `mode` | `"auto" \| "frames" \| "video"` | Playback mode |
| `scrollRange` | `ScrollRangeValue` | Scroll range configuration |
| `canvasDimensions` | `{ width?, height? }` | Canvas size |

### Hook return value

| Property | Type | Description |
|----------|------|-------------|
| `progress` | `number` | Current scroll progress (0 to 1) |
| `isReady` | `boolean` | Whether animation is loaded |
| `error` | `Error \| null` | Loading error, if any |
| `canvasRef` | `RefObject<HTMLCanvasElement>` | Canvas element ref |
| `seek` | `(progress: number) => void` | Seek to specific progress |
| `pause` | `() => void` | Pause scroll-driven updates |
| `resume` | `() => void` | Resume scroll-driven updates |
| `isPaused` | `boolean` | Whether updates are paused |

## Manual rendering (non-Next.js)

For custom workflows:

```bash
python render/cli.py \
  --scene-file path/to/scene.py \
  --scene-name MyScene \
  --output-dir ./dist/scene \
  --format both \
  --fps 30 \
  --resolution 1920x1080 \
  --quality k
```

### With props

```bash
echo '{"text": "Hello World", "fontSize": 72, "color": "#ffffff"}' > props.json

python render/cli.py \
  --scene-file render/templates/text_scene.py \
  --scene-name TextScene \
  --props props.json \
  --output-dir ./dist/scene \
  --format both
```

## Vanilla JS usage

```ts
import { registerScrollAnimation } from "@mihirsarya/manim-scroll-runtime";

const container = document.querySelector("#hero") as HTMLElement;

registerScrollAnimation({
  container,
  manifestUrl: "/dist/scene/manifest.json",
  mode: "auto",
  scrollRange: "viewport",
  onReady: () => console.log("ready"),
});
```

## Component props reference

| Prop | Type | Description |
|------|------|-------------|
| `scene` | `string` | Scene name (default: `"TextScene"`) |
| `fontSize` | `number` | Font size for text animations |
| `color` | `string` | Color as hex string (e.g., `"#ffffff"`) |
| `font` | `string` | Font family for text |
| `inline` | `boolean` | Enable inline mode with transparent background and tight bounds |
| `padding` | `number` | Padding around text in inline mode (Manim units, default: `0.2`) |
| `manifestUrl` | `string` | Explicit manifest URL (overrides auto-resolution) |
| `mode` | `"auto" \| "video" \| "frames" \| "native"` | Playback mode (`native` for SVG animation) |
| `fontUrl` | `string` | URL to font file for native mode (woff, woff2, ttf, otf) |
| `strokeWidth` | `number` | Stroke width for native mode drawing phase (default: `2`, matches Manim) |
| `scrollRange` | `ScrollRangeValue` | Scroll range: preset, tuple, or object |
| `onReady` | `() => void` | Called when animation is loaded |
| `onProgress` | `(progress: number) => void` | Called on scroll progress |
| `className` | `string` | CSS class for the container |
| `style` | `CSSProperties` | Inline styles for the container |
| `children` | `ReactNode` | Text content (becomes `text` prop) |

## Additional resources

- Usage docs: [docs/USAGE.md](docs/USAGE.md)
- Example page: [examples/index.html](examples/index.html)
