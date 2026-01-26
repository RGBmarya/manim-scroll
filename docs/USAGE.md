# Manim Scroll Library Usage

## Quick Start with Next.js (Recommended)

The easiest way to use Manim scroll animations is with the Next.js plugin.
Animations are automatically rendered at build time with smart caching.

### 1. Install the packages

```bash
# Unified package (recommended)
npm install @mihirsarya/manim-scroll

# Or install individual packages
npm install @mihirsarya/manim-scroll-react @mihirsarya/manim-scroll-next
```

### 2. Configure Next.js

```js
// next.config.js
const { withManimScroll } = require("@mihirsarya/manim-scroll/next");
// Or: const { withManimScroll } = require("@mihirsarya/manim-scroll-next");

module.exports = withManimScroll({
  // Optional configuration
  manimScroll: {
    pythonPath: "python3",  // Python executable
    quality: "h",           // Manim quality (l, m, h, k)
    fps: 30,                // Frames per second
    resolution: "1920x1080",
  },
});
```

### 3. Use the component

```tsx
// app/page.tsx
import { ManimScroll } from "@mihirsarya/manim-scroll";
// Or: import { ManimScroll } from "@mihirsarya/manim-scroll-react";

export default function Home() {
  return (
    <main>
      <div style={{ height: "100vh" }} />
      
      <ManimScroll
        scene="TextScene"
        fontSize={72}
        color="#ffffff"
        style={{ height: "100vh", background: "#111" }}
      >
        Welcome to my site
      </ManimScroll>
      
      <div style={{ height: "100vh" }} />
    </main>
  );
}
```

### 4. Run your app

```bash
next dev   # or next build
```

The plugin automatically:
- Scans your source files for `<ManimScroll>` components
- Extracts props and children text
- Renders animations with Manim (cached by props hash)
- Serves assets from `public/manim-assets/`

### Configuration Options

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

---

## Scroll Range Configuration

Control when the animation plays relative to scroll position using presets,
relative units, or pixel values.

### Presets (Recommended)

```tsx
// Animation plays as element crosses the viewport (default)
<ManimScroll scrollRange="viewport">...</ManimScroll>

// Animation tied to element's own scroll position
<ManimScroll scrollRange="element">...</ManimScroll>

// Animation spans entire document scroll
<ManimScroll scrollRange="full">...</ManimScroll>
```

### Relative Units

Use viewport height (`vh`) or element percentage (`%`) for responsive ranges:

```tsx
// Start when element is 100vh from top, end at -50% of element height
<ManimScroll scrollRange={["100vh", "-50%"]}>...</ManimScroll>

// Mix units as needed
<ManimScroll scrollRange={["80vh", "-100%"]}>...</ManimScroll>
```

### Pixel Values (Legacy)

For precise control, use pixel values:

```tsx
<ManimScroll scrollRange={{ start: 800, end: -400 }}>...</ManimScroll>

// Or as a tuple
<ManimScroll scrollRange={[800, -400]}>...</ManimScroll>
```

---

## useManimScroll Hook

For advanced use cases requiring custom control, use the `useManimScroll` hook
instead of the component.

### Basic Usage

```tsx
import { useRef } from "react";
import { useManimScroll } from "@mihirsarya/manim-scroll";

function CustomAnimation() {
  const containerRef = useRef<HTMLDivElement>(null);

  const { progress, isReady, error } = useManimScroll({
    ref: containerRef,
    manifestUrl: "/assets/scene/manifest.json",
    scrollRange: "viewport",
  });

  return (
    <div ref={containerRef} style={{ height: "100vh" }}>
      {!isReady && <div>Loading...</div>}
      {error && <div>Error: {error.message}</div>}
      <div>Progress: {Math.round(progress * 100)}%</div>
    </div>
  );
}
```

### With Auto-Resolution

```tsx
const { progress, isReady } = useManimScroll({
  ref: containerRef,
  scene: "TextScene",
  animationProps: { text: "Hello", fontSize: 72, color: "#fff" },
});
```

### Imperative Control

```tsx
const { progress, pause, resume, seek, isPaused } = useManimScroll({
  ref: containerRef,
  manifestUrl: "/assets/scene/manifest.json",
});

// Pause scroll-driven updates
<button onClick={pause}>Pause</button>
<button onClick={resume}>Resume</button>

// Seek to specific progress
<input
  type="range"
  min={0}
  max={1}
  step={0.01}
  value={progress}
  onChange={(e) => seek(Number(e.target.value))}
/>
```

### Hook Options

| Option | Type | Description |
|--------|------|-------------|
| `ref` | `RefObject<HTMLElement>` | Container element ref (required) |
| `manifestUrl` | `string` | Explicit manifest URL |
| `scene` | `string` | Scene name for auto-resolution |
| `animationProps` | `Record<string, unknown>` | Props for auto-resolution |
| `mode` | `"auto" \| "frames" \| "video"` | Playback mode |
| `scrollRange` | `ScrollRangeValue` | Scroll range configuration |
| `canvasDimensions` | `{ width?, height? }` | Canvas size |

### Hook Return Value

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

---

## Manual Rendering (Advanced)

For non-Next.js projects or custom workflows, you can render scenes manually.

### Render a scene

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

This writes:
- `dist/scene/manifest.json`
- Frame PNGs (nested under the Manim media tree)
- An MP4/WebM video (nested under the Manim media tree)

### Render text with props

Create a props JSON file and pass it to the CLI:

```bash
# Create props file
echo '{"text": "Hello World", "fontSize": 72, "color": "#ffffff"}' > props.json

# Render with props
python render/cli.py \
  --scene-file render/templates/text_scene.py \
  --scene-name TextScene \
  --props props.json \
  --output-dir ./dist/scene \
  --format both
```

---

## Use in the browser (Vanilla JS)

```ts
import { registerScrollAnimation } from "@mihirsarya/manim-scroll-runtime";

const container = document.querySelector("#hero") as HTMLElement;

registerScrollAnimation({
  container,
  manifestUrl: "/dist/scene/manifest.json",
  mode: "auto",
  onReady: () => console.log("ready"),
});
```

For custom scroll ranges, pass `scrollRange` using presets, relative units, or pixels:

```ts
// Preset
registerScrollAnimation({
  container,
  manifestUrl: "/dist/scene/manifest.json",
  scrollRange: "viewport",  // or "element" or "full"
});

// Relative units
registerScrollAnimation({
  container,
  manifestUrl: "/dist/scene/manifest.json",
  scrollRange: ["100vh", "-50%"],
});

// Pixel values (legacy)
registerScrollAnimation({
  container,
  manifestUrl: "/dist/scene/manifest.json",
  scrollRange: { start: window.innerHeight, end: -container.offsetHeight },
});
```

---

## React component (Manual Mode)

If you're not using the Next.js plugin, you can provide an explicit `manifestUrl`:

```tsx
import { ManimScroll } from "@mihirsarya/manim-scroll-react";

export function Hero() {
  return (
    <ManimScroll manifestUrl="/dist/scene/manifest.json" mode="auto">
      Scroll-driven text
    </ManimScroll>
  );
}
```

Note: when using manual mode, the component children are semantic text for
accessibility. Make sure to render the same text in your Manim scene.

---

## Component Props Reference

| Prop | Type | Description |
|------|------|-------------|
| `scene` | `string` | Scene name (default: `"TextScene"`) |
| `fontSize` | `number` | Font size for text animations |
| `color` | `string` | Color as hex string (e.g., `"#ffffff"`) |
| `font` | `string` | Font family for text |
| `manifestUrl` | `string` | Explicit manifest URL (overrides auto-resolution) |
| `mode` | `"auto" \| "video" \| "frames"` | Playback mode |
| `scrollRange` | `ScrollRangeValue` | Scroll range: preset, tuple, or object (see above) |
| `onReady` | `() => void` | Called when animation is loaded |
| `onProgress` | `(progress: number) => void` | Called on scroll progress |
| `className` | `string` | CSS class for the container |
| `style` | `CSSProperties` | Inline styles for the container |
| `children` | `ReactNode` | Text content (becomes `text` prop) |

### ScrollRangeValue Type

```ts
type ScrollRangeValue =
  | "viewport" | "element" | "full"           // Presets
  | [start: string | number, end: string | number]  // Tuple
  | { start?: number; end?: number };         // Legacy object
```

---

## Requirements

- Python 3.8+ with Manim installed
- Node.js 18+
- Next.js 13+ (for the plugin)
