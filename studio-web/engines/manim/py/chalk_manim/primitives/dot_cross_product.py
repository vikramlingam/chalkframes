"""manim-dot-cross-product: Vector projections and cross-product geometry."""

import math

from manim import (
    Arrow,
    Create,
    DashedLine,
    FadeIn,
    Line,
    Polygon,
    RIGHT,
    RoundedRectangle,
    Text,
    UP,
    VGroup,
)

from ..common import clean, run_stage, stage_frames, title_text


def run(scene, theme, brief, budget, beat_frames):
    title = clean(brief.get("title") or "Vector Dot & Cross Product Geometry", 60)
    mode = str(brief.get("mode") or "dot").lower()
    if mode not in ["dot", "cross"]:
        mode = "dot"

    raw_va = brief.get("vectorA")
    raw_vb = brief.get("vectorB")
    try:
        ax = float(raw_va[0]) if isinstance(raw_va, (list, tuple)) and len(raw_va) >= 1 else 2.6
        ay = float(raw_va[1]) if isinstance(raw_va, (list, tuple)) and len(raw_va) >= 2 else 0.4
    except (TypeError, ValueError):
        ax, ay = 2.6, 0.4

    try:
        bx = float(raw_vb[0]) if isinstance(raw_vb, (list, tuple)) and len(raw_vb) >= 1 else 1.2
        by = float(raw_vb[1]) if isinstance(raw_vb, (list, tuple)) and len(raw_vb) >= 2 else 1.8
    except (TypeError, ValueError):
        bx, by = 1.2, 1.8

    center = [-0.8, -0.6, 0]

    # Coordinate axes
    ax_x = Line([center[0] - 1.5, center[1], 0], [center[0] + 3.8, center[1], 0], stroke_width=1.5, stroke_color=theme.border)
    ax_y = Line([center[0], center[1] - 1.0, 0], [center[0], center[1] + 2.8, 0], stroke_width=1.5, stroke_color=theme.border)

    p_a = [center[0] + ax, center[1] + ay, 0]
    p_b = [center[0] + bx, center[1] + by, 0]

    arr_a = Arrow(center, p_a, color=getattr(theme, "blue", theme.accent), stroke_width=4, buff=0)
    arr_b = Arrow(center, p_b, color=getattr(theme, "green", theme.accent_alt), stroke_width=4, buff=0)

    lbl_a = Text("Vector A", font=theme.mono, weight="BOLD", color=getattr(theme, "blue", theme.accent)).scale(0.26).next_to(p_a, UP + RIGHT, buff=0.08)
    lbl_b = Text("Vector B", font=theme.mono, weight="BOLD", color=getattr(theme, "green", theme.accent_alt)).scale(0.26).next_to(p_b, UP, buff=0.08)

    # Dot Product Projection calculations
    # proj_a(b) = (a . b / |a|^2) * a
    dot_val = ax * bx + ay * by
    len_a_sq = ax * ax + ay * ay
    scalar_proj = dot_val / len_a_sq if len_a_sq > 0 else 0
    p_proj = [center[0] + scalar_proj * ax, center[1] + scalar_proj * ay, 0]

    drop_line = DashedLine(p_b, p_proj, stroke_width=2, stroke_color=theme.muted)
    proj_line = Line(center, p_proj, stroke_width=5, stroke_color=getattr(theme, "yellow", theme.accent_alt))
    proj_lbl = Text(f"Proj_A(B) = |B|cosθ (A·B = {dot_val:.2f})", font=theme.mono, weight="BOLD", color=getattr(theme, "yellow", theme.accent_alt)).scale(0.24).next_to(p_proj, UP + RIGHT, buff=0.1)

    # Cross product parallelogram area
    # p_sum = center + A + B
    p_sum = [center[0] + ax + bx, center[1] + ay + by, 0]
    cross_val = abs(ax * by - ay * bx)
    poly = Polygon(center, p_a, p_sum, p_b, stroke_width=2, stroke_color=getattr(theme, "teal", theme.accent_alt), fill_color=getattr(theme, "teal", theme.accent_alt), fill_opacity=0.25)
    cross_lbl = Text(f"Area = |A × B| = {cross_val:.2f}", font=theme.mono, weight="BOLD", color=getattr(theme, "teal", theme.accent_alt)).scale(0.26).move_to([(center[0] + p_sum[0]) / 2, (center[1] + p_sum[1]) / 2, 0])

    badge_bg = RoundedRectangle(corner_radius=0.1, width=4.8, height=0.5, stroke_width=2, stroke_color=theme.border, fill_color=theme.card, fill_opacity=1).move_to([0, 1.9, 0])
    badge_title = "Dot Product: Scalar Projection" if mode == "dot" else "Cross Product: Oriented Area"
    badge_txt = Text(badge_title, font=theme.mono, weight="BOLD", color=theme.accent).scale(0.26).move_to(badge_bg.get_center())

    stages = 3
    frames = stage_frames(budget.total, [3, 4, 3], beat_frames if beat_frames and len(beat_frames) == stages else None)

    scene.add(title_text(theme, title))

    # Stage 1: Draw axes and base vectors A and B
    run_stage(budget, frames[0], Create(ax_x), Create(ax_y), FadeIn(arr_a), FadeIn(arr_b), FadeIn(lbl_a), FadeIn(lbl_b), FadeIn(badge_bg), FadeIn(badge_txt))

    if mode == "dot":
        # Stage 2: Orthogonal drop line to vector A
        run_stage(budget, frames[1], Create(drop_line))
        # Stage 3: Projection highlight along A
        run_stage(budget, frames[2], Create(proj_line), FadeIn(proj_lbl))
    else:
        # Stage 2: Form parallelogram
        side1 = DashedLine(p_a, p_sum, stroke_width=1.5, stroke_color=theme.accent_alt)
        side2 = DashedLine(p_b, p_sum, stroke_width=1.5, stroke_color=theme.accent)
        run_stage(budget, frames[1], Create(side1), Create(side2))
        # Stage 3: Fill area and reveal magnitude
        run_stage(budget, frames[2], FadeIn(poly), FadeIn(cross_lbl))

    budget.fill()
