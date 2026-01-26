#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from dataclasses import dataclass, asdict
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

    args = parser.parse_args()
    output_dir = Path(args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

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

    env = os.environ.copy()
    if args.props:
        props_path = Path(args.props).resolve()
        env["MANIM_SCROLL_PROPS"] = str(props_path)

    if args.format in ("frames", "both"):
        _run_manim(base_cmd + ["--write_all_frames", "--format", "png"], env)

    if args.format in ("video", "both"):
        _run_manim(base_cmd + ["--format", args.video_format], env)

    frames, video = _collect_assets(output_dir)
    manifest = RenderManifest(
        scene=args.scene_name,
        fps=args.fps,
        width=width,
        height=height,
        frames=frames,
        video=video,
    )
    manifest_path = output_dir / "manifest.json"
    manifest_path.write_text(json.dumps(asdict(manifest), indent=2))

    print(f"Wrote manifest to {manifest_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
