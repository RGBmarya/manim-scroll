# @mihirsarya/manim-scroll

Unified package for scroll-driven Manim animations. Pre-render mathematical animations with Manim and play them back smoothly as users scroll.

This is the recommended package for most users—it re-exports everything from the runtime, React, and Next.js packages.

## Installation

```bash
npm install @mihirsarya/manim-scroll
```

## Requirements

- React 18+
- Next.js 13+ (for the build plugin)
- Python 3.8+ with [Manim](https://www.manim.community/) installed

## Quick Start

### 1. Configure Next.js

```js
// next.config.js
const { withManimScroll } = require("@mihirsarya/manim-scroll/next");

module.exports = withManimScroll({
  manimScroll: {
    pythonPath: "python3",
    quality: "h",
  },
});
```

### 2. Use the Component

```tsx
import { ManimScroll } from "@mihirsarya/manim-scroll";

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

The plugin automatically scans your source files, extracts `<ManimScroll>` components, and renders animations at build time with smart caching.

## Exports

### From the main entry (`@mihirsarya/manim-scroll`)

**React Components & Hooks:**
- `ManimScroll` - Scroll-driven animation component
- `useManimScroll` - Hook for custom integrations with pre-rendered assets
- `useNativeAnimation` - Hook for native SVG text animation

**Runtime:**
- `registerScrollAnimation` - Register scroll animation (vanilla JS)
- `registerNativeAnimation` - Register native text animation (vanilla JS)
- `NativeTextPlayer` - Native text animation player class

**Types:**
- `ManimScrollProps`, `ManimAnimationProps`
- `UseManimScrollOptions`, `UseManimScrollResult`
- `UseNativeAnimationOptions`, `UseNativeAnimationResult`
- `RenderManifest`, `ScrollAnimationOptions`, `ScrollRange`, `ScrollRangePreset`, `ScrollRangeValue`
- `NativeAnimationOptions`

### From Next.js entry (`@mihirsarya/manim-scroll/next`)

- `withManimScroll` - Next.js config wrapper
- `ManimScrollConfig` - Configuration type
- `extractAnimations` - Extract animations from source files
- `renderAnimations` - Render animations with Manim CLI
- `computePropsHash`, `isCached`, `getCacheEntry`, etc.

## Component Props

| Prop | Type | Description |
|------|------|-------------|
| `scene` | `string` | Scene name (default: `"TextScene"`) |
| `fontSize` | `number` | Font size for text animations |
| `color` | `string` | Color as hex string (e.g., `"#ffffff"`) |
| `font` | `string` | Font family for text |
| `inline` | `boolean` | Enable inline mode for text that flows with content |
| `mode` | `"auto" \| "video" \| "frames" \| "native"` | Playback mode |
| `scrollRange` | `ScrollRangeValue` | Scroll range configuration |
| `manifestUrl` | `string` | Explicit manifest URL (overrides auto-resolution) |
| `onReady` | `() => void` | Called when animation is loaded |
| `onProgress` | `(progress: number) => void` | Called on scroll progress |
| `children` | `ReactNode` | Text content for the animation |

## Scroll Range Configuration

```tsx
// Presets
<ManimScroll scrollRange="viewport">...</ManimScroll>
<ManimScroll scrollRange="element">...</ManimScroll>
<ManimScroll scrollRange="full">...</ManimScroll>

// Relative units
<ManimScroll scrollRange={["100vh", "-50%"]}>...</ManimScroll>

// Pixel values
<ManimScroll scrollRange={[800, -400]}>...</ManimScroll>
```

## Next.js Plugin Options

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

## Native Mode

For text animations without pre-rendered assets, use native mode:

```tsx
<ManimScroll mode="native" fontSize={48} color="#ffffff">
  Animate this text
</ManimScroll>
```

Native mode renders directly in the browser using SVG, replicating Manim's Write/DrawBorderThenFill effect.

## Related Packages

| Package | npm | Description |
|---------|-----|-------------|
| `@mihirsarya/manim-scroll-react` | React component and hooks |
| `@mihirsarya/manim-scroll-next` | Next.js build plugin |
| `@mihirsarya/manim-scroll-runtime` | Core scroll runtime |

## License

MIT
