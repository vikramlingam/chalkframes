"""CLI entry: python -m chalk_manim.run plan.json

plan.json: {
  "primitive": "manim-function-plot", "brief": {...}, "palette": {...}, "fonts": {...},
  "totalFrames": 150, "beatFrames": [..], "width": 1920, "height": 1080, "fps": 30,
  "outputPath": "/abs/scene.mp4", "mediaDir": "/abs/media"
}
Exit codes: 0 ok, 2 bad plan, 3 render failure. The rendered file lands at outputPath.
"""

import json
import shutil
import sys
import traceback
from pathlib import Path

from manim import Scene, config

from .primitives import PRIMITIVES
from .theme import Theme
from .timing import Budget


class ChalkScene(Scene):
    def __init__(self, plan, theme, **kwargs):
        super().__init__(**kwargs)
        self.plan, self.theme = plan, theme

    def construct(self):
        plan = self.plan
        budget = Budget(self, plan["totalFrames"], plan["fps"])
        beats = [int(b) for b in plan.get("beatFrames") or []]
        PRIMITIVES[plan["primitive"]].run(self, self.theme, plan.get("brief") or {}, budget, beats)
        budget.fill()


def _validate(plan):
    if plan.get("primitive") not in PRIMITIVES:
        raise ValueError(f"unknown primitive: {plan.get('primitive')}")
    for key in ("totalFrames", "width", "height", "fps"):
        if not isinstance(plan.get(key), int) or plan[key] <= 0:
            raise ValueError(f"plan.{key} must be a positive integer")
    if not plan.get("outputPath") or not plan.get("mediaDir"):
        raise ValueError("plan.outputPath and plan.mediaDir are required")


def main(argv):
    try:
        plan = json.loads(Path(argv[1]).read_text())
        _validate(plan)
    except Exception as exc:  # noqa: BLE001 - report any bad plan uniformly
        print(f"bad plan: {exc}", file=sys.stderr)
        return 2
    try:
        theme = Theme(plan.get("palette"), plan.get("fonts")).apply()
        config.pixel_width, config.pixel_height = plan["width"], plan["height"]
        config.frame_rate = plan["fps"]
        # Keep Manim's frame in units proportional to the pixel aspect.
        # Standard landscape (16:9) uses frame_height=8.0, frame_width=14.2222.
        # For square (1:1) or other compact aspect ratios, maintain the standard 14.2222 design width
        # so that all mathematical objects and coordinates up to [-5.5, 5.5] fit completely within the frame.
        aspect = plan["width"] / plan["height"]
        if aspect >= 16.0 / 9.0:
            config.frame_height = 8.0
            config.frame_width = 8.0 * aspect
        else:
            config.frame_width = 8.0 * (16.0 / 9.0)
            config.frame_height = config.frame_width / aspect
        config.media_dir = plan["mediaDir"]
        config.disable_caching = True
        config.progress_bar = "none"
        config.verbosity = "WARNING"
        config.write_to_movie = True
        config.output_file = "scene"
        scene = ChalkScene(plan, theme)
        scene.render()
        produced = Path(scene.renderer.file_writer.movie_file_path)
        Path(plan["outputPath"]).parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(produced, plan["outputPath"])
        return 0
    except Exception:  # noqa: BLE001 - surfaced to the Node runner, which degrades
        traceback.print_exc()
        return 3


if __name__ == "__main__":
    sys.exit(main(sys.argv))
