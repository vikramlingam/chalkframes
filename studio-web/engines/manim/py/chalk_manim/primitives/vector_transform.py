"""manim-vector-transform: a 2x2 matrix acting on the plane, its basis vectors, a sample
vector, and an optional orthogonal projection onto a line.

brief: { matrix:[[a,b],[c,d]], showBasis?, vector?:[x,y], projectOnto?:[x,y], title? }
(2D only. Matrix entries are clamped to [-4, 4] so the grid stays inside the frame.)
"""

import math

import numpy as np
from manim import (
    Arrow,
    ApplyMatrix,
    Create,
    DashedLine,
    Dot,
    FadeIn,
    NumberPlane,
    Text,
    config,
)

from ..common import clean, fit, run_stage, stage_frames, title_text


def _clamp(v, lo=-4.0, hi=4.0, default=0.0):
    try:
        v = float(v)
    except (TypeError, ValueError):
        return default
    return min(max(v, lo), hi) if math.isfinite(v) else default


def _matrix(raw):
    try:
        return [[_clamp(raw[r][c], default=1.0 if r == c else 0.0) for c in range(2)] for r in range(2)]
    except (TypeError, IndexError, KeyError):
        return [[1.0, 0.0], [0.0, 1.0]]


def _vec(raw, default):
    try:
        return [_clamp(raw[0], -6, 6), _clamp(raw[1], -6, 6)]
    except (TypeError, IndexError, KeyError):
        return default


def run(scene, theme, brief, budget, beat_frames):
    m = _matrix(brief.get("matrix"))
    fh = config.frame_height
    unit = fh * 0.075
    plane = NumberPlane(
        x_range=[-9, 9, 1],
        y_range=[-5, 5, 1],
        x_length=18 * unit,
        y_length=10 * unit,
        background_line_style={"stroke_color": theme.border, "stroke_width": 2, "stroke_opacity": 0.9},
        axis_config={"stroke_color": theme.muted, "stroke_width": 3},
    )
    plane.shift([0, -0.2, 0])

    def arrow(x, y, color):
        return Arrow(plane.c2p(0, 0), plane.c2p(x, y), buff=0, color=color, stroke_width=7, max_tip_length_to_length_ratio=0.25)

    show_basis = brief.get("showBasis", True) is not False
    i_hat = arrow(1, 0, theme.accent)
    j_hat = arrow(0, 1, theme.accent_alt)
    vec = _vec(brief.get("vector"), [1.0, 1.0])
    v_arrow = arrow(vec[0], vec[1], theme.text)

    stages = [("grid", 2), ("vectors", 2), ("transform", 4)]
    proj = brief.get("projectOnto")
    if proj is not None:
        stages.append(("project", 3))
    frames = stage_frames(budget.total, [w for _, w in stages], beat_frames)

    scene.add(title_text(theme, brief.get("title") or ""))
    label = Text(
        "[ {:g} {:g} ; {:g} {:g} ]".format(m[0][0], m[0][1], m[1][0], m[1][1]),
        font=theme.mono,
        color=theme.muted,
    ).scale(0.4)
    fit(label, config.frame_width * 0.5)
    label.to_corner([1, -1, 0], buff=0.35)

    movers = [plane]
    for (name, _), n in zip(stages, frames):
        if name == "grid":
            run_stage(budget, n, FadeIn(plane), FadeIn(label))
        elif name == "vectors":
            shown = ([i_hat, j_hat] if show_basis else []) + [v_arrow]
            movers.extend(shown)
            run_stage(budget, n, *[Create(a) for a in shown])
        elif name == "transform":
            run_stage(budget, n, *[ApplyMatrix(m, mob) for mob in movers])
        elif name == "project":
            d = _vec(proj, [1.0, 0.0])
            norm = math.hypot(*d)
            if norm < 1e-6:
                budget.hold(n)
                continue
            d = [d[0] / norm, d[1] / norm]
            tv = np.array(m).dot(vec)  # vector after the transform
            k = float(np.dot(tv, d))
            foot = [k * d[0], k * d[1]]
            line = DashedLine(plane.c2p(-6 * d[0], -6 * d[1]), plane.c2p(6 * d[0], 6 * d[1]), color=theme.muted)
            drop = DashedLine(plane.c2p(tv[0], tv[1]), plane.c2p(*foot), color=theme.accent_alt)
            dot = Dot(plane.c2p(*foot), color=theme.accent_alt, radius=0.1)
            run_stage(budget, n, Create(line), Create(drop), FadeIn(dot))
    budget.fill()
