from __future__ import annotations

import json
import os
from pathlib import Path

from manim import ORIGIN, Scene, Text, Write


def _load_props() -> dict:
    props_path = os.environ.get("MANIM_SCROLL_PROPS")
    if not props_path:
        return {}
    path = Path(props_path)
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


class TextScene(Scene):
    def construct(self) -> None:
        props = _load_props()
        text_value = props.get("text", "Hello Manim")
        font_size = props.get("fontSize", props.get("font_size", 64))
        color = props.get("color", "#FFFFFF")
        font = props.get("font")

        if font:
            text_mob = Text(text_value, font_size=font_size, color=color, font=font)
        else:
            text_mob = Text(text_value, font_size=font_size, color=color)

        text_mob.move_to(ORIGIN)
        self.play(Write(text_mob))
        self.wait(0.5)
