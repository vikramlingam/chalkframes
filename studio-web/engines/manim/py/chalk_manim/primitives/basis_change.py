"""manim-basis-change: Linear coordinate transformations and basis change."""

from manim import (
    Arrow,
    Create,
    Dot,
    FadeIn,
    Line,
    RIGHT,
    RoundedRectangle,
    Text,
    UP,
    VGroup,
)

from ..common import clean, run_stage, stage_frames, title_text


def run(scene, theme, brief, budget, beat_frames):
    title = clean(brief.get("title") or "Change of Basis (Coordinate Transformation)", 60)
    raw_b1 = brief.get("basis1")
    raw_b2 = brief.get("basis2")
    try:
        b1x = float(raw_b1[0]) if isinstance(raw_b1, (list, tuple)) and len(raw_b1) >= 1 else 1.5
        b1y = float(raw_b1[1]) if isinstance(raw_b1, (list, tuple)) and len(raw_b1) >= 2 else 0.5
    except (TypeError, ValueError):
        b1x, b1y = 1.5, 0.5

    try:
        b2x = float(raw_b2[0]) if isinstance(raw_b2, (list, tuple)) and len(raw_b2) >= 1 else 0.4
        b2y = float(raw_b2[1]) if isinstance(raw_b2, (list, tuple)) and len(raw_b2) >= 2 else 1.4
    except (TypeError, ValueError):
        b2x, b2y = 0.4, 1.4

    center = [0, -0.4, 0]

    # Standard Cartesian Grid
    cart_grid = VGroup()
    for offset in [-2.4, -1.2, 0, 1.2, 2.4]:
        cart_grid.add(Line([center[0] + offset, center[1] - 2.0, 0], [center[0] + offset, center[1] + 2.0, 0], stroke_width=1.0, stroke_color=theme.border, stroke_opacity=0.4))
        cart_grid.add(Line([center[0] - 3.0, center[1] + offset, 0], [center[0] + 3.0, center[1] + offset, 0], stroke_width=1.0, stroke_color=theme.border, stroke_opacity=0.4))

    # Skewed Grid under new basis
    skew_grid = VGroup()
    for k in [-2, -1, 0, 1, 2]:
        # Lines parallel to basis 1
        p_start1 = [center[0] - 2 * b1x + k * b2x, center[1] - 2 * b1y + k * b2y, 0]
        p_end1 = [center[0] + 2 * b1x + k * b2x, center[1] + 2 * b1y + k * b2y, 0]
        skew_grid.add(Line(p_start1, p_end1, stroke_width=1.0, stroke_color=theme.accent, stroke_opacity=0.35))
        # Lines parallel to basis 2
        p_start2 = [center[0] + k * b1x - 1.8 * b2x, center[1] + k * b1y - 1.8 * b2y, 0]
        p_end2 = [center[0] + k * b1x + 1.8 * b2x, center[1] + k * b1y + 1.8 * b2y, 0]
        skew_grid.add(Line(p_start2, p_end2, stroke_width=1.0, stroke_color=theme.accent_alt, stroke_opacity=0.35))

    # Initial standard basis (i_hat, j_hat)
    i_hat = Arrow(center, [center[0] + 1.2, center[1], 0], color=theme.accent, stroke_width=4, buff=0)
    j_hat = Arrow(center, [center[0], center[1] + 1.2, 0], color=theme.accent_alt, stroke_width=4, buff=0)
    lbl_i = Text("i_hat", font=theme.mono, weight="BOLD", color=theme.accent).scale(0.26).next_to(i_hat.get_end(), UP + RIGHT, buff=0.08)
    lbl_j = Text("j_hat", font=theme.mono, weight="BOLD", color=theme.accent_alt).scale(0.26).next_to(j_hat.get_end(), UP + RIGHT, buff=0.08)

    # Transformed basis vectors (v1, v2)
    v1_arr = Arrow(center, [center[0] + b1x, center[1] + b1y, 0], color=theme.accent, stroke_width=4, buff=0)
    v2_arr = Arrow(center, [center[0] + b2x, center[1] + b2y, 0], color=theme.accent_alt, stroke_width=4, buff=0)
    lbl_v1 = Text("v_1", font=theme.mono, weight="BOLD", color=theme.accent).scale(0.26).next_to(v1_arr.get_end(), UP + RIGHT, buff=0.08)
    lbl_v2 = Text("v_2", font=theme.mono, weight="BOLD", color=theme.accent_alt).scale(0.26).next_to(v2_arr.get_end(), UP + RIGHT, buff=0.08)

    # Fixed physical vector x in the space
    fixed_p = [center[0] + 1.8, center[1] + 1.4, 0]
    fixed_vec = Arrow(center, fixed_p, color=theme.text, stroke_width=4, buff=0)
    fixed_lbl = Text("Vector x (Invariant)", font=theme.mono, weight="BOLD", color=theme.text).scale(0.26).next_to(fixed_p, UP, buff=0.1)

    badge_bg = RoundedRectangle(corner_radius=0.1, width=5.0, height=0.5, stroke_width=2, stroke_color=theme.border, fill_color=theme.card, fill_opacity=1).move_to([0, 1.9, 0])
    badge_txt1 = Text("Standard Cartesian Basis: [1, 0] and [0, 1]", font=theme.mono, weight="BOLD", color=theme.text).scale(0.25).move_to(badge_bg.get_center())
    badge_txt2 = Text(f"New Basis: v_1=[{b1x:.1f},{b1y:.1f}], v_2=[{b2x:.1f},{b2y:.1f}]", font=theme.mono, weight="BOLD", color=theme.accent).scale(0.25).move_to(badge_bg.get_center())

    stages = 3
    frames = stage_frames(budget.total, [3, 4, 3], beat_frames if beat_frames and len(beat_frames) == stages else None)

    scene.add(title_text(theme, title))

    # Stage 1: Standard grid, standard basis vectors, and vector x
    run_stage(budget, frames[0], Create(cart_grid), FadeIn(i_hat), FadeIn(j_hat), FadeIn(lbl_i), FadeIn(lbl_j), FadeIn(fixed_vec), FadeIn(fixed_lbl), FadeIn(badge_bg), FadeIn(badge_txt1))

    # Stage 2: Morph basis vectors into v1, v2
    run_stage(budget, frames[1], badge_txt1.animate.become(badge_txt2), i_hat.animate.become(v1_arr), j_hat.animate.become(v2_arr), lbl_i.animate.become(lbl_v1), lbl_j.animate.become(lbl_v2))

    # Stage 3: Transform coordinate grid lines into skewed basis grid
    run_stage(budget, frames[2], cart_grid.animate.become(skew_grid))

    budget.fill()
