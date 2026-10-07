"""manim-function-plot: 2D graph, tangent line, shaded area, parameter evolution.

brief: { expr, expr2?, xRange:[a,b], yRange?:[a,b], tangentAt?, area?:[a,b], title? }
"""

import math

from manim import (
    Axes,
    Create,
    Dot,
    FadeIn,
    FadeOut,
    Line,
    ReplacementTransform,
    Text,
    VGroup,
    config,
)

from ..common import clean, fit, run_stage, stage_frames, title_text
from ..expr import compile_expr

SAMPLES = 240


def _num(v, default):
    try:
        v = float(v)
        return v if math.isfinite(v) else default
    except (TypeError, ValueError):
        return default


def _range(r, default):
    if isinstance(r, (list, tuple)) and len(r) >= 2:
        a, b = _num(r[0], default[0]), _num(r[1], default[1])
        if a < b:
            return a, b
    return default


def _y_range(f, x0, x1, given):
    if given:
        return _range(given, (-5.0, 5.0))
    ys = sorted(
        y
        for y in (f(x0 + (x1 - x0) * i / SAMPLES) for i in range(SAMPLES + 1))
        if math.isfinite(y)
    )
    if not ys:
        return -5.0, 5.0
    lo = ys[int(len(ys) * 0.02)]
    hi = ys[int(len(ys) * 0.98)]
    pad = max((hi - lo) * 0.15, 0.5)
    lo, hi = max(lo - pad, -50.0), min(hi + pad, 50.0)
    return (lo, hi) if lo < hi else (lo - 1, hi + 1)


def _segments(f, x0, x1, ylim):
    """Split the domain wherever f is undefined or leaves the viewport (tan, 1/x, ...)."""
    span = ylim[1] - ylim[0]
    segs, cur = [], None
    for i in range(SAMPLES + 1):
        x = x0 + (x1 - x0) * i / SAMPLES
        y = f(x)
        ok = math.isfinite(y) and ylim[0] - span <= y <= ylim[1] + span
        if ok:
            cur = [x, x] if cur is None else [cur[0], x]
        elif cur is not None:
            segs.append(cur)
            cur = None
    if cur is not None:
        segs.append(cur)
    return [s for s in segs if s[1] - s[0] > (x1 - x0) / SAMPLES * 2]


def _curve(axes, f, segs, color, width=5):
    group = VGroup()
    for a, b in segs:
        group.add(axes.plot(f, x_range=[a, b, (b - a) / 200], color=color, stroke_width=width))
    return group


def run(scene, theme, brief, budget, beat_frames):
    x0, x1 = _range(brief.get("xRange"), (-5.0, 5.0))
    f = compile_expr(brief.get("expr", "x"))
    f2 = compile_expr(brief["expr2"]) if brief.get("expr2") else None
    y0, y1 = _y_range(f, x0, x1, brief.get("yRange"))

    fw, fh = config.frame_width, config.frame_height
    axes = Axes(
        x_range=[x0, x1, max((x1 - x0) / 8, 0.1)],
        y_range=[y0, y1, max((y1 - y0) / 6, 0.1)],
        x_length=fw * 0.82,
        y_length=fh * 0.58,
        axis_config={"color": getattr(theme, "axis", "#8894ae"), "stroke_width": 3.5, "include_ticks": True},
        tips=False,
    ).shift([0, -0.35, 0])
    segs = _segments(f, x0, x1, (y0, y1))
    curve = _curve(axes, f, segs, getattr(theme, "blue", theme.accent), width=6)
    label = Text("f(x) = " + clean(brief.get("expr", "x"), 40), font=theme.mono, weight="BOLD", color=theme.text)
    label.scale(0.48)
    fit(label, fw * 0.8)
    label.move_to(axes.get_corner([-1, 1, 0]) + [label.width / 2 + 0.1, 0.28, 0])

    stages = [("axes", 3)]
    tx = brief.get("tangentAt")
    if tx is not None:
        stages.append(("tangent", 2))
    area = brief.get("area")
    if isinstance(area, (list, tuple)) and len(area) >= 2:
        stages.append(("area", 2))
    if f2 is not None:
        stages.append(("evolve", 3))
    frames = stage_frames(budget.total, [w for _, w in stages], beat_frames)

    scene.add(title_text(theme, brief.get("title") or ""))
    keep = VGroup()
    for (name, _), n in zip(stages, frames):
        if name == "axes":
            run_stage(budget, n, FadeIn(axes), Create(curve), FadeIn(label))
        elif name == "tangent":
            xt = min(max(_num(tx, (x0 + x1) / 2), x0), x1)
            h = (x1 - x0) * 1e-4
            slope = (f(xt + h) - f(xt - h)) / (2 * h)
            if not math.isfinite(slope):
                slope = 0.0
            half = (x1 - x0) * 0.18
            p0 = axes.c2p(xt - half, f(xt) - slope * half)
            p1 = axes.c2p(xt + half, f(xt) + slope * half)
            tangent = Line(p0, p1, color=getattr(theme, "gold", theme.accent_alt), stroke_width=5)
            dot = Dot(axes.c2p(xt, f(xt)), color=getattr(theme, "yellow", theme.text), radius=0.14)
            keep.add(tangent, dot)
            run_stage(budget, n, Create(tangent), FadeIn(dot))
        elif name == "area":
            a, b = _range(area, (x0, x1))
            shade = axes.get_area(
                axes.plot(f, x_range=[max(a, x0), min(b, x1)]),
                x_range=[max(a, x0), min(b, x1)],
                color=getattr(theme, "teal", theme.accent),
                opacity=0.32,
            )
            keep.add(shade)
            run_stage(budget, n, FadeIn(shade))
        elif name == "evolve":
            segs2 = _segments(f2, x0, x1, (y0, y1))
            curve2 = _curve(axes, f2, segs2, getattr(theme, "gold", theme.accent_alt))
            run_stage(budget, n, FadeOut(keep), ReplacementTransform(curve, curve2))
    budget.fill()
