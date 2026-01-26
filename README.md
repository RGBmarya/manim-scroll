# Manim Scroll

Scroll-driven Manim animations for the web. Pre-render mathematical animations with Manim and play them back smoothly as users scroll.

## Features

- **Automatic rendering** - Next.js plugin scans your code and renders animations at build time
- **Smart caching** - Animations are cached by props hash, only re-rendered when changed
- **Flexible playback** - Video or frame-by-frame modes with automatic fallback
- **Scroll presets** - Configure scroll ranges with presets, relative units, or pixels
- **React hooks** - Full control with `useManimScroll` for custom integrations

## Quick Start

### Installation

```bash
npm install @mihirsarya/manim-scroll
```

### Next.js Setup

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

### Usage

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

## Package Structure

| Package | npm | Description |
|---------|-----|-------------|
| `packages/manim-scroll` | `@mihirsarya/manim-scroll` | Unified package (recommended) |
| `react/` | `@mihirsarya/manim-scroll-react` | React component and hooks |
| `next/` | `@mihirsarya/manim-scroll-next` | Next.js build plugin |
| `runtime/` | `@mihirsarya/manim-scroll-runtime` | Core scroll runtime |
| `render/` | - | Python CLI for Manim rendering |

## Documentation

- [Usage Guide](docs/USAGE.md) - Comprehensive usage documentation
- [Examples](examples/) - Vanilla JS example

## Requirements

- Python 3.8+ with [Manim](https://www.manim.community/) installed
- Node.js 18+
- Next.js 13+ (for the plugin)

## Development

```bash
# Install dependencies
npm install

# Build all packages
npm run build
```

---

## Agent Skills

This repository includes an **Agent Skill** that helps AI coding assistants (Cursor, GitHub Copilot, Windsurf, etc.) understand and work with the codebase.

### Install with skills.sh (All IDEs)

Install the skill instantly using [skills.sh](https://skills.sh):

```bash
npx skills add rgbmarya/manim-scroll
```

This works with:
- **Cursor**
- **GitHub Copilot**
- **Windsurf**
- **Cline**
- **Aider**
- **Claude Code**
- And other AI coding assistants that support the Agent Skills standard

### What are Agent Skills?

Agent Skills are **reusable capabilities for AI coding agents**. Once installed, your AI assistant automatically gains access to:

- Domain-specific best practices
- Working code examples
- Common patterns and API references
- Framework-specific knowledge

Skills follow the [Agent Skills open standard](https://skills.sh) and work across multiple AI tools.

### When the Skill Activates

The manim-scroll skill automatically loads when you:
- Import from `@mihirsarya/manim-scroll`
- Work with `<ManimScroll>` components
- Configure `next.config.js` with `withManimScroll`
- Ask about scroll-driven animations or Manim rendering

### Manual Installation

If you prefer manual installation:

**For Cursor:**
```bash
# Copy to your project
cp -r skills/ .cursor/skills/
```

**For other IDEs:**
```bash
# Copy to project root
cp -r skills/ ./skills/
```

### Skill Location

```
skills/
└── manim-scroll/
    └── SKILL.md
```

### What the Skill Covers

- Quick start with Next.js plugin
- Package structure and imports
- Scroll range configuration (presets, relative units, pixels)
- `useManimScroll` hook API
- Manual rendering with the Python CLI
- Component props reference

---

## License

MIT
