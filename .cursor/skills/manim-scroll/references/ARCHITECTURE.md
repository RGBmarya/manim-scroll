# Manim Scroll Architecture

This document describes the internal architecture of the manim-scroll packages.

## Package Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          @mihirsarya/manim-scroll                       │
│                         (Unified Entry Point)                           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          ▼                         ▼                         ▼
┌─────────────────────┐   ┌─────────────────────┐   ┌─────────────────────┐
│   manim-scroll-next │   │  manim-scroll-react │   │ manim-scroll-runtime│
│   (Build Plugin)    │   │  (React Bindings)   │   │  (Core Runtime)     │
└─────────────────────┘   └─────────────────────┘   └─────────────────────┘
          │                         │                         │
          │                         │                         │
          ▼                         │                         │
┌─────────────────────┐             │                         │
│   render/cli.py     │             │                         │
│   (Python CLI)      │             │                         │
└─────────────────────┘             │                         │
          │                         │                         │
          ▼                         ▼                         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              Browser                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │  ScrollPlayer (video/frames)  │  NativeTextPlayer (SVG animation)  ││
│  └─────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
```

## Next.js Plugin Flow

The `@mihirsarya/manim-scroll-next` package integrates with Next.js build:

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         Next.js Build Process                            │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  1. EXTRACTION (extractor.ts)                                            │
│     - Scans source files matching include/exclude patterns               │
│     - Parses JSX with Babel to find <ManimScroll> components             │
│     - Extracts props (literals, objects, arrays, children text)          │
│     - Skips mode="native" components (browser-rendered)                  │
│     - Generates unique IDs: {filePath}:{lineNumber}                      │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  2. CACHING (cache.ts)                                                   │
│     - Computes deterministic hash for each animation's props             │
│     - Hash algorithm: djb2 on sorted JSON                                │
│     - Checks if animation already cached (manifest.json exists)          │
│     - Writes cache-manifest.json immediately for runtime availability    │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  3. RENDERING (renderer.ts)                                              │
│     - Spawns Python CLI for each uncached animation                      │
│     - Runs in parallel with configurable concurrency                     │
│     - Passes props via temp JSON file                                    │
│     - Collects frames and video to public/manim-assets/{hash}/           │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  4. CLEANUP                                                              │
│     - Updates cache-manifest.json with rendered animations               │
│     - Removes orphaned cache directories (if cleanOrphans: true)         │
└──────────────────────────────────────────────────────────────────────────┘
```

### Cache Structure

```
public/manim-assets/
├── cache-manifest.json          # Runtime lookup map
│   {
│     "version": 1,
│     "animations": {
│       "a1b2c3d4": "/manim-assets/a1b2c3d4/manifest.json",
│       "e5f6g7h8": "/manim-assets/e5f6g7h8/manifest.json"
│     }
│   }
│
└── {hash}/
    ├── manifest.json            # Animation manifest
    │   {
    │     "scene": "TextScene",
    │     "fps": 30,
    │     "width": 1920,
    │     "height": 1080,
    │     "frames": ["frames/0001.png", "frames/0002.png", ...],
    │     "video": "video.mp4",
    │     "transparent": false,
    │     "inline": false,
    │     "aspectRatio": null
    │   }
    │
    ├── frames/
    │   ├── 0001.png
    │   ├── 0002.png
    │   └── ...
    │
    └── video.mp4 (or video.webm for transparent)
```

### Hash Algorithm

The djb2 hash ensures consistent cache lookups between build-time and runtime:

```typescript
function computePropsHash(scene: string, props: Record<string, unknown>): string {
  // 1. Recursively sort object keys for determinism
  const sortedProps = sortObjectKeys(props);
  
  // 2. Create JSON string
  const json = JSON.stringify({ scene, props: sortedProps });
  
  // 3. Compute djb2 hash
  let hash = 5381;
  for (const char of json) {
    hash = ((hash << 5) + hash + char.charCodeAt(0)) | 0;
  }
  
  // 4. Convert to 8-character hex string
  return (hash >>> 0).toString(16).padStart(8, "0");
}
```

## Runtime Architecture

### ScrollPlayer (Pre-rendered Mode)

The `ScrollPlayer` class handles video and frame-based playback:

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           ScrollPlayer                                    │
├──────────────────────────────────────────────────────────────────────────┤
│  init()                                                                   │
│    ├── Load manifest.json                                                 │
│    ├── Initialize FrameCache or video element                            │
│    ├── Set up canvas (create or use provided)                            │
│    ├── Configure IntersectionObserver for visibility                     │
│    └── Draw initial frame                                                 │
├──────────────────────────────────────────────────────────────────────────┤
│  tick() (called on scroll)                                               │
│    ├── Calculate scroll progress (0-1)                                   │
│    ├── Skip if change < 0.1% (performance optimization)                  │
│    ├── Video mode: seek to targetTime = progress * duration              │
│    └── Frame mode: load frame[index] and draw to canvas                  │
├──────────────────────────────────────────────────────────────────────────┤
│  Performance Optimizations                                                │
│    ├── RAF throttling for scroll events                                  │
│    ├── IntersectionObserver (pause when not visible)                     │
│    ├── Frame preloading (5 frames ahead/behind)                          │
│    ├── Progress change threshold (0.1%)                                  │
│    └── Frame index caching (avoid redundant draws)                       │
└──────────────────────────────────────────────────────────────────────────┘
```

### NativeTextPlayer (SVG Animation)

The `NativeTextPlayer` class renders text animations directly in the browser:

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        NativeTextPlayer                                   │
├──────────────────────────────────────────────────────────────────────────┤
│  init()                                                                   │
│    ├── Load font with opentype.js (if fontUrl provided)                  │
│    ├── Create SVG container                                              │
│    ├── Generate character paths                                          │
│    │     ├── Convert text to SVG paths using font metrics                │
│    │     ├── Split paths into stroke segments (sub-paths)                │
│    │     ├── Create fill paths for closed contours                       │
│    │     └── Sort segments left-to-right                                 │
│    ├── Set up IntersectionObserver                                       │
│    └── Render initial state                                              │
├──────────────────────────────────────────────────────────────────────────┤
│  render(progress: number)                                                 │
│    ├── Calculate lag ratio: min(4.0 / max(1.0, segmentCount), 0.2)       │
│    ├── Use Manim's integer_interpolate for phase/subalpha                │
│    │                                                                      │
│    │   Phase 0 (progress 0-0.5): Draw strokes progressively              │
│    │     └── Update stroke-dashoffset for each segment                   │
│    │                                                                      │
│    │   Phase 1 (progress 0.5-1.0): Transition to fill                    │
│    │     ├── Fade stroke opacity                                         │
│    │     └── Reveal fill paths                                           │
│    │                                                                      │
│    └── Apply per-segment staggering with lag_ratio                       │
├──────────────────────────────────────────────────────────────────────────┤
│  Manim Rate Functions                                                     │
│    ├── smooth(t, inflection=10): Sigmoid-based easing                    │
│    ├── doubleSmooth(t): Smooth for both halves                           │
│    └── linear(t): No easing (used for Write animation)                   │
└──────────────────────────────────────────────────────────────────────────┘
```

### FrameCache

Efficient frame loading with preloading and deduplication:

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           FrameCache                                      │
├──────────────────────────────────────────────────────────────────────────┤
│  Properties                                                               │
│    ├── cache: Map<number, HTMLImageElement>      // Loaded frames        │
│    ├── pending: Map<number, Promise<...>>        // In-flight loads      │
│    └── frames: string[]                          // Frame URLs           │
├──────────────────────────────────────────────────────────────────────────┤
│  load(index: number): Promise<HTMLImageElement>                          │
│    ├── Return from cache if exists                                       │
│    ├── Return pending promise if already loading                         │
│    ├── Create new load promise                                           │
│    └── Trigger preloadNearby()                                           │
├──────────────────────────────────────────────────────────────────────────┤
│  preloadNearby(currentIndex: number)                                     │
│    └── Preload 5 frames ahead and 5 frames behind                        │
│        (silently, errors ignored)                                        │
└──────────────────────────────────────────────────────────────────────────┘
```

## Scroll Progress Calculation

The scroll progress (0-1) is calculated based on the element's position:

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    Scroll Range Resolution                                │
├──────────────────────────────────────────────────────────────────────────┤
│  Presets                                                                  │
│    ├── "viewport": start = viewportHeight, end = -elementHeight          │
│    ├── "element":  start = vh * 0.8, end = vh * 0.2 - elementHeight      │
│    └── "full":     start = documentHeight - vh, end = 0                  │
├──────────────────────────────────────────────────────────────────────────┤
│  Relative Units                                                           │
│    ├── "100vh"  → viewport height                                        │
│    ├── "50%"    → 50% of element height                                  │
│    ├── "200px"  → 200 pixels                                             │
│    └── 300      → 300 pixels (plain number)                              │
├──────────────────────────────────────────────────────────────────────────┤
│  Formula                                                                  │
│    progress = (elementTop - start) / (end - start)                       │
│    progress = clamp(progress, 0, 1)                                      │
└──────────────────────────────────────────────────────────────────────────┘
```

## Python CLI Flow

The `render/cli.py` script renders Manim scenes:

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         Python CLI (cli.py)                               │
├──────────────────────────────────────────────────────────────────────────┤
│  1. Parse arguments                                                       │
│     ├── --scene-file, --scene-name, --output-dir (required)              │
│     └── --format, --fps, --resolution, --quality, --props, etc.          │
├──────────────────────────────────────────────────────────────────────────┤
│  2. Load props (if provided)                                              │
│     ├── Read JSON file from --props path                                 │
│     └── Check for inline mode (enables transparent rendering)            │
├──────────────────────────────────────────────────────────────────────────┤
│  3. Set environment variables                                             │
│     ├── MANIM_SCROLL_PROPS = path to props JSON                          │
│     └── MANIM_SCROLL_BOUNDS_OUT = path to bounds.json output             │
├──────────────────────────────────────────────────────────────────────────┤
│  4. Execute Manim                                                         │
│     ├── Frames: manim --write_all --format png                           │
│     └── Video: manim --format mp4/webm                                   │
├──────────────────────────────────────────────────────────────────────────┤
│  5. Collect assets                                                        │
│     ├── Find all PNG frames (sorted)                                     │
│     └── Find latest video file                                           │
├──────────────────────────────────────────────────────────────────────────┤
│  6. Generate manifest.json                                                │
│     ├── scene, fps, width, height                                        │
│     ├── frames (relative paths)                                          │
│     ├── video (relative path or null)                                    │
│     ├── transparent, inline flags                                        │
│     └── aspectRatio (from bounds.json if available)                      │
└──────────────────────────────────────────────────────────────────────────┘
```

## Data Flow Summary

```
Build Time:
  Source Files → Extractor → Props → Hash → Cache Check
                                           ↓ (if not cached)
                                     Python CLI → Manim → Frames/Video
                                           ↓
                                     public/manim-assets/{hash}/

Runtime:
  React Component → useManimScroll → Cache Manifest Lookup → manifest.json
                                           ↓
                    ScrollPlayer/NativeTextPlayer → Canvas/SVG → Screen
                                           ↑
                              Scroll Events (throttled via RAF)
```
