# @mihirsarya/manim-scroll-react

React components and hooks for scroll-driven Manim animations.

## Installation

```bash
npm install @mihirsarya/manim-scroll-react
```

Or use the unified package (recommended):

```bash
npm install @mihirsarya/manim-scroll
```

## Requirements

- React 18+
- `@mihirsarya/manim-scroll-runtime` (peer dependency, installed automatically)

## Quick Start

### With Next.js Plugin (Recommended)

When using with `@mihirsarya/manim-scroll-next`, animations are automatically resolved:

```tsx
import { ManimScroll } from "@mihirsarya/manim-scroll-react";

export default function Page() {
  return (
    <ManimScroll
      scene="TextScene"
      fontSize={72}
      color="#ffffff"
      scrollRange="viewport"
    >
      Welcome to my site
    </ManimScroll>
  );
}
```

### Manual Mode

Without the Next.js plugin, provide an explicit manifest URL:

```tsx
import { ManimScroll } from "@mihirsarya/manim-scroll-react";

export default function Page() {
  return (
    <ManimScroll
      manifestUrl="/assets/scene/manifest.json"
      scrollRange="viewport"
    >
      Scroll-driven text
    </ManimScroll>
  );
}
```

### Native Mode

For text animations without pre-rendered assets:

```tsx
<ManimScroll mode="native" fontSize={48} color="#ffffff">
  Animate this text
</ManimScroll>
```

## Exports

### Components

- **`ManimScroll`** - Scroll-driven animation component

### Hooks

- **`useManimScroll`** - Hook for custom integrations with pre-rendered assets
- **`useNativeAnimation`** - Hook for native SVG text animation

### Utilities

- **`computePropsHash`** - Compute hash for animation props
- **`extractChildrenText`** - Extract text from React children

### Types

- `ManimScrollProps`, `ManimAnimationProps`
- `UseManimScrollOptions`, `UseManimScrollResult`
- `UseNativeAnimationOptions`, `UseNativeAnimationResult`

## ManimScroll Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `scene` | `string` | `"TextScene"` | Manim scene name |
| `fontSize` | `number` | - | Font size for text animations |
| `color` | `string` | - | Color as hex string |
| `font` | `string` | - | Font family |
| `inline` | `boolean` | `false` | Enable inline mode |
| `padding` | `number` | `0.2` | Padding in inline mode (Manim units) |
| `mode` | `"auto" \| "video" \| "frames" \| "native"` | `"auto"` | Playback mode |
| `scrollRange` | `ScrollRangeValue` | `"viewport"` | Scroll range configuration |
| `manifestUrl` | `string` | - | Explicit manifest URL |
| `fontUrl` | `string` | - | Font file URL for native mode |
| `strokeWidth` | `number` | `2` | Stroke width for native mode |
| `onReady` | `() => void` | - | Called when animation is loaded |
| `onProgress` | `(progress: number) => void` | - | Called on scroll progress |
| `canvas` | `{ width?, height? }` | - | Canvas dimensions |
| `className` | `string` | - | CSS class |
| `style` | `CSSProperties` | - | Inline styles |
| `children` | `ReactNode` | - | Text content |

## useManimScroll Hook

For advanced use cases requiring custom control:

```tsx
import { useRef } from "react";
import { useManimScroll } from "@mihirsarya/manim-scroll-react";

function CustomAnimation() {
  const containerRef = useRef<HTMLDivElement>(null);

  const { progress, isReady, error, pause, resume, seek } = useManimScroll({
    ref: containerRef,
    manifestUrl: "/assets/scene/manifest.json",
    scrollRange: "viewport",
  });

  return (
    <div ref={containerRef} style={{ height: "100vh" }}>
      {!isReady && <div>Loading...</div>}
      {error && <div>Error: {error.message}</div>}
      <div>Progress: {Math.round(progress * 100)}%</div>
      <button onClick={pause}>Pause</button>
      <button onClick={resume}>Resume</button>
    </div>
  );
}
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
| `enabled` | `boolean` | Whether the hook is active |

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

## useNativeAnimation Hook

For native SVG text animation without pre-rendered assets:

```tsx
import { useRef } from "react";
import { useNativeAnimation } from "@mihirsarya/manim-scroll-react";

function NativeTextAnimation() {
  const containerRef = useRef<HTMLDivElement>(null);

  const { progress, isReady } = useNativeAnimation({
    ref: containerRef,
    text: "Hello World",
    fontSize: 48,
    color: "#ffffff",
  });

  return (
    <div ref={containerRef} style={{ height: "100vh" }}>
      {!isReady && <div>Loading...</div>}
    </div>
  );
}
```

### Hook Options

| Option | Type | Description |
|--------|------|-------------|
| `ref` | `RefObject<HTMLElement>` | Container element ref (required) |
| `text` | `string` | Text to animate (required) |
| `fontSize` | `number` | Font size in pixels (inherits from parent if not set) |
| `color` | `string` | Text color |
| `fontUrl` | `string` | URL to font file for opentype.js |
| `strokeWidth` | `number` | Stroke width for drawing phase |
| `scrollRange` | `ScrollRangeValue` | Scroll range configuration |
| `enabled` | `boolean` | Whether the hook is active |

## Scroll Range Configuration

```tsx
// Presets
scrollRange="viewport"  // Animation plays as element crosses viewport
scrollRange="element"   // Tied to element's own scroll position
scrollRange="full"      // Spans entire document scroll

// Relative units
scrollRange={["100vh", "-50%"]}

// Pixel values
scrollRange={[800, -400]}
scrollRange={{ start: 800, end: -400 }}
```

## License

MIT
