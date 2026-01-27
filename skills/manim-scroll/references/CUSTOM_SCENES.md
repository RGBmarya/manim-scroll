# Creating Custom Manim Scenes

This guide explains how to create custom Manim scenes for use with manim-scroll.

## Overview

Custom scenes allow you to create complex animations beyond the built-in TextScene. Your scene receives props from the build plugin and renders an animation that can be played back via scroll.

## Basic Structure

A custom scene is a Python file containing a Manim Scene class:

```python
from manim import *
import json
import os

class MyCustomScene(Scene):
    def construct(self):
        # Load props from environment
        props = self._load_props()
        
        # Create your animation
        text = Text(props.get("text", "Default"))
        self.play(Write(text))
        self.wait(0.5)
    
    def _load_props(self):
        props_path = os.environ.get("MANIM_SCROLL_PROPS")
        if props_path and os.path.exists(props_path):
            with open(props_path) as f:
                return json.load(f)
        return {}
```

## Props Loading

The build plugin passes props via the `MANIM_SCROLL_PROPS` environment variable, which contains a path to a JSON file.

### Standard Props Helper

```python
def _load_props(self):
    """Load props from the MANIM_SCROLL_PROPS environment variable."""
    props_path = os.environ.get("MANIM_SCROLL_PROPS")
    if not props_path:
        return {}
    
    try:
        with open(props_path, "r") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}
```

### Accessing Props

```python
def construct(self):
    props = self._load_props()
    
    # With defaults
    text = props.get("text", "Hello World")
    font_size = props.get("fontSize", 64)
    color = props.get("color", "#FFFFFF")
    
    # Support both camelCase and snake_case
    font_size = props.get("fontSize") or props.get("font_size", 64)
```

## Inline Mode Support

For animations that flow with surrounding text, you need to:
1. Detect inline mode from props
2. Adjust the frame size to fit content
3. Write bounds info for the manifest

### Bounds Writing

```python
def _write_bounds_info(self, text_width, text_height, aspect_ratio, inline, padding):
    """Write bounds information for the manifest."""
    bounds_path = os.environ.get("MANIM_SCROLL_BOUNDS_OUT")
    if not bounds_path:
        return
    
    bounds = {
        "textWidth": text_width,
        "textHeight": text_height,
        "aspectRatio": aspect_ratio,
        "inline": inline,
        "padding": padding,
    }
    
    with open(bounds_path, "w") as f:
        json.dump(bounds, f)
```

### Frame Adjustment

```python
def construct(self):
    props = self._load_props()
    inline = props.get("inline", False)
    padding = props.get("padding", 0.1)
    
    # Create your content
    content = Text(props.get("text", "Hello"))
    
    if inline:
        # Measure content
        content_width = content.width
        content_height = content.height
        
        # Add padding
        padded_width = content_width + padding * 2
        padded_height = content_height + padding * 2
        
        # Calculate aspect ratio
        aspect_ratio = padded_width / padded_height
        
        # Adjust Manim frame
        config.frame_width = padded_width
        config.frame_height = padded_height
        
        # Write bounds for manifest
        self._write_bounds_info(
            content_width,
            content_height,
            aspect_ratio,
            inline,
            padding
        )
    
    # Center and animate
    content.move_to(ORIGIN)
    self.play(Write(content))
    self.wait(0.5)
```

## Scene File Naming

The build plugin maps scene names to files using this convention:

```
SceneName → scene_name.py (lowercase with underscores)
```

Examples:
- `TextScene` → `text_scene.py`
- `MathScene` → `math_scene.py`
- `MyCustomScene` → `my_custom_scene.py`

Place your scene file in the templates directory (default: `render/templates/`).

## Complete Example

Here's a complete custom scene that supports all features:

```python
from manim import *
import json
import os

class EquationScene(Scene):
    """Animate a mathematical equation with custom styling."""
    
    def construct(self):
        props = self._load_props()
        
        # Extract props with defaults
        equation = props.get("equation", "E = mc^2")
        font_size = props.get("fontSize", 72)
        color_hex = props.get("color", "#FFFFFF")
        inline = props.get("inline", False)
        padding = props.get("padding", 0.2)
        
        # Convert hex color to Manim color
        color = color_hex
        
        # Create the equation
        tex = MathTex(equation, font_size=font_size, color=color)
        
        # Handle inline mode
        if inline:
            self._setup_inline_frame(tex, padding)
        
        # Center and animate
        tex.move_to(ORIGIN)
        self.play(Write(tex))
        self.wait(0.5)
    
    def _load_props(self):
        props_path = os.environ.get("MANIM_SCROLL_PROPS")
        if not props_path:
            return {}
        try:
            with open(props_path, "r") as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return {}
    
    def _setup_inline_frame(self, mobject, padding):
        """Adjust frame for inline mode and write bounds."""
        width = mobject.width
        height = mobject.height
        
        padded_width = width + padding * 2
        padded_height = height + padding * 2
        aspect_ratio = padded_width / padded_height
        
        # Adjust frame
        config.frame_width = padded_width
        config.frame_height = padded_height
        
        # Write bounds
        self._write_bounds_info(width, height, aspect_ratio, True, padding)
    
    def _write_bounds_info(self, width, height, aspect_ratio, inline, padding):
        bounds_path = os.environ.get("MANIM_SCROLL_BOUNDS_OUT")
        if not bounds_path:
            return
        
        with open(bounds_path, "w") as f:
            json.dump({
                "textWidth": width,
                "textHeight": height,
                "aspectRatio": aspect_ratio,
                "inline": inline,
                "padding": padding,
            }, f)
```

## Using Custom Scenes

### With Next.js Plugin

```tsx
<ManimScroll
  scene="EquationScene"
  equation="\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}"
  fontSize={48}
  color="#667eea"
  style={{ height: "100vh" }}
>
  {/* Fallback/accessibility text */}
  Gaussian integral equals square root of pi over 2
</ManimScroll>
```

### With Manual CLI

```bash
echo '{"equation": "E = mc^2", "fontSize": 72, "color": "#ffffff"}' > props.json

python render/cli.py \
  --scene-file render/templates/equation_scene.py \
  --scene-name EquationScene \
  --props props.json \
  --output-dir ./dist/equation \
  --format both
```

## Tips

1. **Always provide defaults** - Your scene should work even without props.

2. **Support both camelCase and snake_case** - JavaScript uses camelCase, Python uses snake_case.

3. **Handle inline mode** - If your scene might be used inline, implement frame adjustment.

4. **End with wait()** - Always include a short `self.wait()` at the end to ensure the final frame is captured.

5. **Test locally first** - Run your scene with Manim directly before integrating with the build plugin:
   ```bash
   manim -pql my_scene.py MyScene
   ```

6. **Check the manifest** - After rendering, verify the manifest.json has the expected structure.
