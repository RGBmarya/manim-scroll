# Troubleshooting

Common issues and solutions for manim-scroll.

## Build-Time Issues

### "Python not found" or "Manim not installed"

**Symptoms:**
- Build fails with "python3: command not found"
- "ModuleNotFoundError: No module named 'manim'"

**Solutions:**

1. Verify Python is installed and in PATH:
   ```bash
   python3 --version
   which python3
   ```

2. Install Manim if missing:
   ```bash
   pip install manim
   ```

3. Configure the correct Python path in next.config.js:
   ```js
   module.exports = withManimScroll({
     manimScroll: {
       pythonPath: "/usr/local/bin/python3",  // Full path
     },
   });
   ```

4. If using a virtual environment:
   ```js
   module.exports = withManimScroll({
     manimScroll: {
       pythonPath: "./venv/bin/python",
     },
   });
   ```

### "Scene not found" or "Template missing"

**Symptoms:**
- "No scene file found for: CustomScene"
- "FileNotFoundError: text_scene.py"

**Solutions:**

1. Check scene file naming convention:
   - `TextScene` → `text_scene.py`
   - `MyScene` → `my_scene.py`

2. Verify the templates directory exists:
   ```
   render/templates/text_scene.py
   ```

3. Specify custom templates directory:
   ```js
   module.exports = withManimScroll({
     manimScroll: {
       templatesDir: "./custom-templates",
     },
   });
   ```

### "Extraction found 0 animations"

**Symptoms:**
- Build completes but no animations are rendered
- Cache manifest is empty

**Solutions:**

1. Check include patterns match your files:
   ```js
   module.exports = withManimScroll({
     manimScroll: {
       include: ["src/**/*.tsx", "app/**/*.tsx"],
       verbose: true,  // See what's being scanned
     },
   });
   ```

2. Ensure components use static props (not runtime variables):
   ```tsx
   // Good - static props
   <ManimScroll fontSize={72} color="#fff">Hello</ManimScroll>
   
   // Bad - dynamic props (can't be extracted at build time)
   <ManimScroll fontSize={size} color={themeColor}>Hello</ManimScroll>
   ```

3. Check that components aren't using `mode="native"` (these are skipped):
   ```tsx
   // This is skipped (rendered in browser)
   <ManimScroll mode="native">Hello</ManimScroll>
   ```

### Cache not updating

**Symptoms:**
- Changed props but still seeing old animation
- Build completes instantly (cached)

**Solutions:**

1. Clear the cache manually:
   ```bash
   rm -rf public/manim-assets/
   ```

2. Check that cleanOrphans is enabled:
   ```js
   module.exports = withManimScroll({
     manimScroll: {
       cleanOrphans: true,
     },
   });
   ```

3. Verify props actually changed (hash is based on sorted props).

## Runtime Issues

### "Manifest 404" in Development

**Symptoms:**
- "Failed to load manifest" error in console
- Animation shows loading state indefinitely

**Solutions:**

1. Wait for rendering to complete - in dev mode, animations render asynchronously.

2. Check the cache manifest exists:
   ```bash
   cat public/manim-assets/cache-manifest.json
   ```

3. The React hook automatically retries up to 5 times with exponential backoff. Check browser console for retry messages.

4. Restart the dev server if cache manifest is stuck.

### Animation not responding to scroll

**Symptoms:**
- Animation stuck at 0% or 100%
- No scroll progress updates

**Solutions:**

1. Ensure the container has proper height:
   ```tsx
   <ManimScroll style={{ height: "100vh" }}>
   ```

2. Check scrollRange configuration:
   ```tsx
   // Try explicit viewport preset
   <ManimScroll scrollRange="viewport">
   ```

3. Verify the element is visible in viewport:
   ```tsx
   // Add padding above/below to create scroll room
   <div style={{ height: "100vh" }} />
   <ManimScroll>...</ManimScroll>
   <div style={{ height: "100vh" }} />
   ```

4. Check for CSS issues preventing scroll:
   - `overflow: hidden` on parent
   - `position: fixed` on container

### Video not playing (frames fallback)

**Symptoms:**
- Animation plays but seems choppy
- Console shows "Falling back to frames mode"

**Solutions:**

1. This is expected behavior - the player automatically falls back to frames if video fails.

2. Check video file exists:
   ```bash
   ls public/manim-assets/{hash}/
   ```

3. Verify video format is supported:
   - WebM for transparent backgrounds
   - MP4 for regular backgrounds

4. Force video mode to see specific error:
   ```tsx
   <ManimScroll mode="video">
   ```

### Canvas sizing issues

**Symptoms:**
- Animation appears stretched or squished
- Canvas doesn't match container size

**Solutions:**

1. Let the component handle sizing:
   ```tsx
   <ManimScroll style={{ width: "100%", height: "100vh" }}>
   ```

2. Specify explicit canvas dimensions:
   ```tsx
   <ManimScroll canvas={{ width: 1920, height: 1080 }}>
   ```

3. Check aspect ratio matches your content.

## Native Mode Issues

### Font not loading

**Symptoms:**
- Text appears but animation doesn't work
- "Failed to load font" error

**Solutions:**

1. Verify font URL is correct and accessible:
   ```tsx
   <ManimScroll
     mode="native"
     fontUrl="/fonts/CMUSerif-Roman.woff2"  // Must be in public/
   >
   ```

2. Check font file format (woff, woff2, ttf, otf supported).

3. Ensure CORS allows font loading if hosted externally.

4. Native mode works without custom font (uses system fonts).

### Text appears but no animation

**Symptoms:**
- Text is visible but static
- Progress updates but no visual change

**Solutions:**

1. Check container has scroll room:
   ```tsx
   <div style={{ height: "200vh" }}>
     <ManimScroll mode="native">Hello</ManimScroll>
   </div>
   ```

2. Verify scrollRange allows animation:
   ```tsx
   <ManimScroll mode="native" scrollRange="viewport">
   ```

3. Check browser console for SVG errors.

### Inherited font size not working

**Symptoms:**
- Text appears wrong size
- Font size changes not reflected

**Solutions:**

1. Native mode can inherit font size from parent:
   ```tsx
   <p style={{ fontSize: "24px" }}>
     <ManimScroll mode="native">
       {/* Will inherit 24px */}
       Hello
     </ManimScroll>
   </p>
   ```

2. Or specify explicitly:
   ```tsx
   <ManimScroll mode="native" fontSize={48}>
   ```

## Performance Issues

### Animation feels laggy

**Symptoms:**
- Scroll feels janky
- Frame drops during playback

**Solutions:**

1. The player uses RAF throttling and IntersectionObserver by default.

2. Prefer video mode over frames for smoother playback:
   ```tsx
   <ManimScroll mode="video">
   ```

3. Reduce resolution if needed:
   ```js
   module.exports = withManimScroll({
     manimScroll: {
       resolution: "1280x720",
     },
   });
   ```

4. Limit concurrent animations on page.

### Large bundle size

**Symptoms:**
- Slow page load
- Large asset downloads

**Solutions:**

1. Use native mode for text-only animations:
   ```tsx
   <ManimScroll mode="native">  // No video/frame assets
   ```

2. Reduce FPS:
   ```js
   manimScroll: {
     fps: 24,  // Instead of 30
   }
   ```

3. Use video mode with compression:
   ```js
   manimScroll: {
     format: "video",  // Just video, no frames
   }
   ```

## Debugging Tips

### Enable verbose logging

```js
module.exports = withManimScroll({
  manimScroll: {
    verbose: true,
  },
});
```

### Check cache manifest

```bash
cat public/manim-assets/cache-manifest.json | jq
```

### Inspect animation manifest

```bash
cat public/manim-assets/{hash}/manifest.json | jq
```

### Test scene manually

```bash
python render/cli.py \
  --scene-file render/templates/text_scene.py \
  --scene-name TextScene \
  --output-dir ./test-output \
  --format both \
  --verbose
```

### Check React hook state

```tsx
const { progress, isReady, error, isPaused } = useManimScroll({...});

console.log({ progress, isReady, error, isPaused });
```
