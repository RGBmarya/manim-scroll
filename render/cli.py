#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from dataclasses import dataclass, asdict, field
from pathlib import Path
from typing import List, Optional


@dataclass
class RenderManifest:
    scene: str
    fps: int
    width: int
    height: int
    frames: List[str]
    video: Optional[str]
    transparent: bool = False
    inline: bool = False
    aspectRatio: Optional[float] = None


def _parse_resolution(value: str) -> tuple[int, int]:
    if "x" in value:
        w, h = value.split("x", 1)
    elif "," in value:
        w, h = value.split(",", 1)
    else:
        raise argparse.ArgumentTypeError("Resolution must be WxH or W,H")
    return int(w), int(h)


def _find_latest(files: List[Path]) -> Optional[Path]:
    if not files:
        return None
    return max(files, key=lambda p: p.stat().st_mtime)


def _collect_assets(media_dir: Path) -> tuple[List[str], Optional[str]]:
    frames = sorted(
        [p.relative_to(media_dir).as_posix() for p in media_dir.rglob("*.png")]
    )
    video = _find_latest([*media_dir.rglob("*.mp4"), *media_dir.rglob("*.webm")])
    return frames, video.relative_to(media_dir).as_posix() if video else None


def _run_manim(cmd: List[str], env: dict[str, str]) -> None:
    result = subprocess.run(cmd, check=False, env=env)
    if result.returncode != 0:
        raise RuntimeError("Manim render failed. Check the command and logs.")


def _load_props_file(props_path: Optional[str]) -> dict:
    """Load props from a JSON file."""
    if not props_path:
        return {}
    path = Path(props_path)
    if not path.exists():
        return {}
    return json.loads(path.read_text())


def main() -> int:
    parser = argparse.ArgumentParser(description="Render Manim scenes for scroll playback.")
    parser.add_argument("--scene-file", required=True, help="Path to Manim scene file.")
    parser.add_argument("--scene-name", required=True, help="Scene class name.")
    parser.add_argument("--output-dir", required=True, help="Directory for render outputs.")
    parser.add_argument("--format", choices=["frames", "video", "both"], default="both")
    parser.add_argument("--fps", type=int, default=30)
    parser.add_argument("--resolution", type=_parse_resolution, default=(1920, 1080))
    parser.add_argument("--quality", default="k", help="Manim quality preset (l, m, h, k).")
    parser.add_argument("--video-format", choices=["mp4", "webm"], default="mp4")
    parser.add_argument(
        "--props",
        help="Path to JSON props for the scene (exposed as MANIM_SCROLL_PROPS).",
    )
    parser.add_argument(
        "--transparent",
        action="store_true",
        help="Render with transparent background (for inline mode).",
    )

    args = parser.parse_args()
    output_dir = Path(args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    # Load props to check for inline mode
    props = _load_props_file(args.props)
    inline = props.get("inline", False) or args.transparent

    width, height = args.resolution
    base_cmd = [
        "manim",
        f"-q{args.quality}",
        "--media_dir",
        str(output_dir),
        "--fps",
        str(args.fps),
        "--resolution",
        f"{width},{height}",
        args.scene_file,
        args.scene_name,
    ]

    # Add transparent flag for inline mode
    if inline or args.transparent:
        base_cmd.insert(1, "--transparent")

    env = os.environ.copy()
    if args.props:
        props_path = Path(args.props).resolve()
        env["MANIM_SCROLL_PROPS"] = str(props_path)

    # Set up bounds output file for inline mode
    bounds_path = output_dir / "bounds.json"
    env["MANIM_SCROLL_BOUNDS_OUT"] = str(bounds_path)

    if args.format in ("frames", "both"):
        _run_manim(base_cmd + ["--write_all", "--format", "png"], env)

    if args.format in ("video", "both"):
        # For transparent video, use webm which supports alpha
        video_format = "webm" if (inline or args.transparent) else args.video_format
        _run_manim(base_cmd + ["--format", video_format], env)

    frames, video = _collect_assets(output_dir)
    
    # For inline mode, try to read bounds info to get aspect ratio
    aspect_ratio = None
    if bounds_path.exists():
        try:
            bounds_data = json.loads(bounds_path.read_text())
            aspect_ratio = bounds_data.get("aspectRatio")
        except Exception:
            pass
    
    manifest = RenderManifest(
        scene=args.scene_name,
        fps=args.fps,
        width=width,
        height=height,
        frames=frames,
        video=video,
        transparent=inline or args.transparent,
        inline=inline,
        aspectRatio=aspect_ratio,
    )
    manifest_path = output_dir / "manifest.json"
    manifest_path.write_text(json.dumps(asdict(manifest), indent=2))

    print(f"Wrote manifest to {manifest_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
