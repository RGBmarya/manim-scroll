# Vanilla JS Example

This example demonstrates using the runtime directly without React or Next.js.

## Setup

1. Build the runtime:

```bash
npm install
npm run build
```

2. Render a scene manually:

```bash
python render/cli.py \
  --scene-file render/templates/text_scene.py \
  --scene-name TextScene \
  --output-dir ./public/dist/scene \
  --format both
```

3. Serve the project root and open `examples/index.html`.

## Note

For React/Next.js projects, use the `@mihirsarya/manim-scroll-next` plugin instead.
See [docs/USAGE.md](../docs/USAGE.md) for details.
