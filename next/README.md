# @mihirsarya/manim-scroll-next

Next.js plugin for build-time Manim scroll animation rendering. Automatically scans your source files, extracts `<ManimScroll>` components, and renders animations with smart caching.

## Installation

```bash
npm install @mihirsarya/manim-scroll-next
```

Or use the unified package (recommended):

```bash
npm install @mihirsarya/manim-scroll
```

## Requirements

- Next.js 13+
- Python 3.8+ with [Manim](https://www.manim.community/) installed

## Quick Start

### 1. Configure Next.js

```js
// next.config.js
const { withManimScroll } = require("@mihirsarya/manim-scroll-next");
// Or: const { withManimScroll } = require("@mihirsarya/manim-scroll/next");

module.exports = withManimScroll({
  manimScroll: {
    pythonPath: "python3",
    quality: "h",
  },
});
```

### 2. Use ManimScroll Components

```tsx
// app/page.tsx
import { ManimScroll } from "@mihirsarya/manim-scroll-react";
// Or: import { ManimScroll } from "@mihirsarya/manim-scroll";

export default function Home() {
  return (
    <ManimScroll
      scene="TextScene"
      fontSize={72}
      color="#ffffff"
    >
      Welcome to my site
    </ManimScroll>
  );
}
```

### 3. Build

```bash
next build
```

The plugin:
1. Scans your source files for `<ManimScroll>` components
2. Extracts props and children text
3. Computes a hash for each unique animation
4. Renders only new/changed animations (cached by hash)
5. Outputs assets to `public/manim-assets/`

## Configuration

### Combined Config (Recommended)

```js
module.exports = withManimScroll({
  // Next.js config
  reactStrictMode: true,
  
  // Manim Scroll config
  manimScroll: {
    pythonPath: "python3",
    quality: "h",
    fps: 30,
    resolution: "1920x1080",
    verbose: true,
  },
});
```

### Separate Configs

```js
const nextConfig = {
  reactStrictMode: true,
};

module.exports = withManimScroll(nextConfig, {
  pythonPath: "python3",
  quality: "h",
});
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `pythonPath` | `string` | `"python3"` | Path to Python executable |
| `cliPath` | `string` | Built-in | Path to render CLI script |
| `templatesDir` | `string` | Built-in | Path to scene templates |
| `quality` | `string` | `"h"` | Manim quality preset (`l`, `m`, `h`, `k`) |
| `fps` | `number` | `30` | Frames per second |
| `resolution` | `string` | `"1920x1080"` | Output resolution (`WIDTHxHEIGHT`) |
| `format` | `string` | `"both"` | Output format (`frames`, `video`, `both`) |
| `concurrency` | `number` | CPU count - 1 | Max parallel renders |
| `include` | `string[]` | `["**/*.tsx", "**/*.jsx"]` | Glob patterns to scan |
| `exclude` | `string[]` | `["node_modules/**", ".next/**"]` | Glob patterns to exclude |
| `cleanOrphans` | `boolean` | `true` | Remove unused cached assets |
| `verbose` | `boolean` | `false` | Enable verbose logging |

## Exports

### Main Export

- **`withManimScroll(config, manimConfig?)`** - Next.js config wrapper

### Types

- `ManimScrollConfig` - Plugin configuration type
- `NextConfigWithManimScroll` - Extended Next.js config type

### Utilities (Advanced)

```ts
import {
  extractAnimations,
  renderAnimations,
  computePropsHash,
  isCached,
  getCacheEntry,
  getAnimationsToRender,
  writeCacheManifest,
  readCacheManifest,
  cleanOrphanedCache,
  processManimScroll,
} from "@mihirsarya/manim-scroll-next";
```

## How It Works

### 1. Extraction

The plugin uses Babel to parse your source files and extract `<ManimScroll>` component usages:

```tsx
<ManimScroll scene="TextScene" fontSize={72} color="#fff">
  Hello World
</ManimScroll>
```

Becomes:

```ts
{
  id: "app/page.tsx:ManimScroll:1",
  scene: "TextScene",
  props: { text: "Hello World", fontSize: 72, color: "#fff" }
}
```

### 2. Caching

Each animation is hashed based on `scene + props`. The cache manifest at `public/manim-assets/cache-manifest.json` maps hashes to rendered asset directories:

```json
{
  "version": 1,
  "animations": {
    "abc123...": "/manim-assets/abc123.../manifest.json"
  }
}
```

### 3. Rendering

New animations are rendered using the bundled Python CLI:

```bash
python render/cli.py \
  --scene-file render/templates/text_scene.py \
  --scene-name TextScene \
  --props '{"text": "Hello World", "fontSize": 72}' \
  --output-dir public/manim-assets/abc123...
```

### 4. Asset Structure

```
public/manim-assets/
├── cache-manifest.json
├── abc123.../
│   ├── manifest.json
│   ├── media/
│   │   ├── videos/...
│   │   └── images/...
└── def456.../
    └── ...
```

## Development Mode

In dev mode (`next dev`), the plugin:
- Creates an empty cache manifest immediately to prevent 404s
- Processes animations asynchronously in the background
- Retries manifest resolution if animations are still rendering

## Custom Build Scripts

For advanced workflows, use the exported utilities:

```ts
import { extractAnimations, renderAnimations } from "@mihirsarya/manim-scroll-next";

async function customBuild() {
  const animations = await extractAnimations({
    rootDir: process.cwd(),
    include: ["src/**/*.tsx"],
  });

  const results = await renderAnimations(animations, "./public", {
    pythonPath: "python3",
    quality: "h",
  });

  console.log(`Rendered ${results.filter(r => r.success).length} animations`);
}
```

## Troubleshooting

### Manim not found

Ensure Manim is installed and accessible:

```bash
python3 -c "import manim; print(manim.__version__)"
```

### Animations not updating

The cache is based on props hash. To force re-render:

1. Delete `public/manim-assets/`
2. Or change a prop value

### Slow builds

- Reduce `quality` (use `"l"` or `"m"` for development)
- Increase `concurrency` if you have more CPU cores
- Use `format: "frames"` to skip video encoding

## License

MIT
