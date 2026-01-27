from __future__ import annotations

import json
import os
from pathlib import Path

from manim import ORIGIN, Scene, Text, Write, config


def _load_props() -> dict:
    props_path = os.environ.get("MANIM_SCROLL_PROPS")
    if not props_path:
        return {}
    path = Path(props_path)
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _write_bounds_info(width: float, height: float, aspect_ratio: float, props: dict) -> None:
    """Write text bounds info to a file for the manifest generator."""
    bounds_path = os.environ.get("MANIM_SCROLL_BOUNDS_OUT")
    if not bounds_path:
        return
    bounds = {
        "textWidth": width,
        "textHeight": height,
        "aspectRatio": aspect_ratio,
        "inline": props.get("inline", False),
        "padding": props.get("padding", 0),
    }
    Path(bounds_path).write_text(json.dumps(bounds))


class TextScene(Scene):
    def construct(self) -> None:
        props = _load_props()
        text_value = props.get("text", "Hello Manim")
        font_size = props.get("fontSize", props.get("font_size", 64))
        color = props.get("color", "#FFFFFF")
        font = props.get("font")
        inline = props.get("inline", False)
        padding = props.get("padding", 0.1)  # Small padding in Manim units

        if font:
            text_mob = Text(text_value, font_size=font_size, color=color, font=font)
        else:
            text_mob = Text(text_value, font_size=font_size, color=color)

        if inline:
            # For inline mode, adjust the camera frame to fit the text tightly
            # This makes the text fill the entire frame
            text_width = text_mob.width
            text_height = text_mob.height

            # Add minimal padding
            padded_width = text_width + padding * 2
            padded_height = text_height + padding * 2

            # Calculate aspect ratio
            aspect_ratio = padded_width / padded_height if padded_height > 0 else 1

            # Adjust the Manim frame to match text bounds
            # This sets the "virtual" frame size in Manim units
            config.frame_width = padded_width
            config.frame_height = padded_height

            # Write bounds info for the manifest
            _write_bounds_info(text_width, text_height, aspect_ratio, props)

        text_mob.move_to(ORIGIN)
        self.play(Write(text_mob))
        self.wait(0.5)
