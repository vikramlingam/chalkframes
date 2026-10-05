"""manim-positional-rope: Rotary Position Embedding (RoPE) 2D vector rotation."""

import math

from manim import (
    Arc,
    Arrow,
    Circle,
    Create,
    DashedLine,
    FadeIn,
    Line,
    RIGHT,
    RoundedRectangle,
    Text,
    UP,
    VGroup,
    config,
)

from ..common import clean, fit, run_stage, stage_frames, title_text


def run(scene, theme, brief, budget, beat_frames):
    title = clean(brief.get("title") or "Rotary Position Embedding (RoPE)", 60)
    try:
        ang1_deg = float(brief.get("angle1", 30))
    except (TypeError, ValueError):
        ang1_deg = 30.0
    try:
        ang2_deg = float(brief.get("angle2", 75))
    except (TypeError, ValueError):
        ang2_deg = 75.0

    rad1 = math.radians(ang1_deg)
    rad2 = math.radians(ang2_deg)
    delta_deg = round(abs(ang2_deg - ang1_deg), 1)

    r = 2.2
    center = [0, -0.2, 0]

    # Coordinate axes
    ax_x = Line([center[0] - r * 1.3, center[1], 0], [center[0] + r * 1.3, center[1], 0], stroke_width=2, color=theme.border)
    ax_y = Line([center[0], center[1] - r * 1.3, 0], [center[0], center[1] + r * 1.3, 0], stroke_width=2, color=theme.border)
    circle = Circle(radius=r, stroke_width=2, stroke_color=theme.border, stroke_opacity=0.6).move_to(center)

    # Initial baseline vectors (aligned near horizontal)
    v1_init = Arrow(center, [center[0] + r * 0.95, center[1], 0], color=theme.accent, stroke_width=4, buff=0)
    v2_init = Arrow(center, [center[0] + r * 0.95, center[1], 0], color=theme.accent_alt, stroke_width=4, buff=0)

    # Target rotated vectors
    p1 = [center[0] + r * 0.95 * math.cos(rad1), center[1] + r * 0.95 * math.sin(rad1), 0]
    p2 = [center[0] + r * 0.95 * math.cos(rad2), center[1] + r * 0.95 * math.sin(rad2), 0]

    v1_rot = Arrow(center, p1, color=theme.accent, stroke_width=4, buff=0)
    v2_rot = Arrow(center, p2, color=theme.accent_alt, stroke_width=4, buff=0)

    lbl1 = Text(f"q (m*θ = {int(ang1_deg)}°)", font=theme.mono, weight="BOLD", color=theme.accent).scale(0.32).next_to(p1, UP + RIGHT, buff=0.15)
    lbl2 = Text(f"k (n*θ = {int(ang2_deg)}°)", font=theme.mono, weight="BOLD", color=theme.accent_alt).scale(0.32).next_to(p2, UP + RIGHT, buff=0.15)

    # Relative angle arc
    start_ang = min(rad1, rad2)
    diff_ang = abs(rad2 - rad1)
    arc = Arc(radius=r * 0.45, start_angle=start_ang, angle=diff_ang, arc_center=center, color=theme.accent, stroke_width=3)
    arc_lbl = Text(f"Δθ = {delta_deg}°", font=theme.mono, color=theme.text, weight="BOLD").scale(0.3).next_to(arc, RIGHT, buff=0.1)

    # Invariant dot-product banner
    banner_bg = RoundedRectangle(corner_radius=0.1, width=5.2, height=0.55, stroke_width=2, stroke_color=theme.border, fill_color=theme.card, fill_opacity=1).move_to([0, -r * 1.25, 0])
    banner_txt = Text(f"<R_m q, R_n k> = g(q, k, (m-n)θ)", font=theme.mono, weight="BOLD", color=theme.text).scale(0.28).move_to(banner_bg.get_center())
    fit(banner_txt, 4.8)
    banner = VGroup(banner_bg, banner_txt)

    stages = 3
    frames = stage_frames(budget.total, [3, 4, 3], beat_frames if beat_frames and len(beat_frames) == stages else None)

    scene.add(title_text(theme, title))

    # Stage 1: Coordinate plane and initial vectors
    run_stage(budget, frames[0], Create(ax_x), Create(ax_y), Create(circle), FadeIn(v1_init), FadeIn(v2_init))

    # Stage 2: Rotate vectors by m*theta and n*theta
    run_stage(budget, frames[1], v1_init.animate.become(v1_rot), v2_init.animate.become(v2_rot), FadeIn(lbl1), FadeIn(lbl2))

    # Stage 3: Relative distance angle arc and inner-product invariance banner
    run_stage(budget, frames[2], Create(arc), FadeIn(arc_lbl), FadeIn(banner))

    budget.fill()
