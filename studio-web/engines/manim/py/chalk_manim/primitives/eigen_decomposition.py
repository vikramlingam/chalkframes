"""manim-eigen-decomposition: Eigenvalues and eigenvectors geometric action."""

import math

from manim import (
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
)

from ..common import clean, run_stage, stage_frames, title_text


def run(scene, theme, brief, budget, beat_frames):
    title = clean(brief.get("title") or "Eigen Decomposition (A * v = λ * v)", 60)
    raw_ev = brief.get("eigenvalues")
    try:
        l1 = float(raw_ev[0]) if isinstance(raw_ev, (list, tuple)) and len(raw_ev) >= 1 else 2.0
        l2 = float(raw_ev[1]) if isinstance(raw_ev, (list, tuple)) and len(raw_ev) >= 2 else 0.7
    except (TypeError, ValueError):
        l1, l2 = 2.0, 0.7

    l1 = max(0.5, min(3.0, l1))
    l2 = max(0.3, min(2.0, l2))
    show_grid = bool(brief.get("showGrid") if "showGrid" in brief else True)

    center = [0, -0.3, 0]

    # Grid / Axes
    axes = VGroup()
    ax_x = Line([center[0] - 3.6, center[1], 0], [center[0] + 3.6, center[1], 0], stroke_width=1.5, stroke_color=theme.border)
    ax_y = Line([center[0], center[1] - 2.2, 0], [center[0], center[1] + 2.2, 0], stroke_width=1.5, stroke_color=theme.border)
    axes.add(ax_x, ax_y)

    if show_grid:
        for offset in [-2.4, -1.2, 1.2, 2.4]:
            axes.add(Line([center[0] + offset, center[1] - 2.2, 0], [center[0] + offset, center[1] + 2.2, 0], stroke_width=0.8, stroke_color=theme.border, stroke_opacity=0.3))
            axes.add(Line([center[0] - 3.6, center[1] + offset, 0], [center[0] + 3.6, center[1] + offset, 0], stroke_width=0.8, stroke_color=theme.border, stroke_opacity=0.3))

    # Eigenvector angles (e.g. 25 deg and 115 deg)
    ang1 = math.radians(25)
    ang2 = math.radians(115)

    base_len = 1.2

    # Initial eigenvectors v1, v2
    v1_init_end = [center[0] + base_len * math.cos(ang1), center[1] + base_len * math.sin(ang1), 0]
    v2_init_end = [center[0] + base_len * math.cos(ang2), center[1] + base_len * math.sin(ang2), 0]

    v1_arrow = Arrow(center, v1_init_end, color=theme.accent, stroke_width=4, buff=0)
    v2_arrow = Arrow(center, v2_init_end, color=theme.accent_alt, stroke_width=4, buff=0)

    lbl_v1 = Text("v_1", font=theme.mono, weight="BOLD", color=theme.accent).scale(0.28).next_to(v1_init_end, UP + RIGHT, buff=0.1)
    lbl_v2 = Text("v_2", font=theme.mono, weight="BOLD", color=theme.accent_alt).scale(0.28).next_to(v2_init_end, UP, buff=0.1)

    # Stretched eigenvectors (scaled by lambda1 and lambda2, preserving direction!)
    v1_scaled_end = [center[0] + base_len * l1 * math.cos(ang1), center[1] + base_len * l1 * math.sin(ang1), 0]
    v2_scaled_end = [center[0] + base_len * l2 * math.cos(ang2), center[1] + base_len * l2 * math.sin(ang2), 0]

    v1_scaled_arrow = Arrow(center, v1_scaled_end, color=theme.accent, stroke_width=4, buff=0)
    v2_scaled_arrow = Arrow(center, v2_scaled_end, color=theme.accent_alt, stroke_width=4, buff=0)

    lbl_l1 = Text(f"λ_1 v_1 ({l1:.1f}x)", font=theme.mono, weight="BOLD", color=theme.accent).scale(0.28).next_to(v1_scaled_end, UP + RIGHT, buff=0.1)
    lbl_l2 = Text(f"λ_2 v_2 ({l2:.1f}x)", font=theme.mono, weight="BOLD", color=theme.accent_alt).scale(0.28).next_to(v2_scaled_end, UP, buff=0.1)

    # Unit circle stretching to ellipse along eigen-axes
    circ = Circle(radius=base_len, stroke_width=2, stroke_color=theme.muted, stroke_opacity=0.7).move_to(center)
    ellipse = Circle(radius=base_len, stroke_width=2.5, stroke_color=theme.accent, stroke_opacity=0.8).move_to(center)
    ellipse.stretch(l1, 0).stretch(l2, 1).rotate(ang1, about_point=center)

    # Header badge
    badge_bg = RoundedRectangle(corner_radius=0.1, width=4.8, height=0.5, stroke_width=2, stroke_color=theme.border, fill_color=theme.card, fill_opacity=1).move_to([0, 1.9, 0])
    badge_txt1 = Text("Eigenvectors: Invariant Spatial Spans", font=theme.mono, weight="BOLD", color=theme.text).scale(0.26).move_to(badge_bg.get_center())
    badge_txt2 = Text(f"Pure Scaling: λ_1 = {l1:.1f}, λ_2 = {l2:.1f}", font=theme.mono, weight="BOLD", color=theme.accent).scale(0.26).move_to(badge_bg.get_center())

    stages = 3
    frames = stage_frames(budget.total, [3, 4, 3], beat_frames if beat_frames and len(beat_frames) == stages else None)

    scene.add(title_text(theme, title))

    # Stage 1: Setup axes, circle, and eigenvectors
    run_stage(budget, frames[0], Create(axes), Create(circ), FadeIn(v1_arrow), FadeIn(v2_arrow), FadeIn(lbl_v1), FadeIn(lbl_v2), FadeIn(badge_bg), FadeIn(badge_txt1))

    # Stage 2: Stretched eigen action
    run_stage(budget, frames[1], badge_txt1.animate.become(badge_txt2), circ.animate.become(ellipse), v1_arrow.animate.become(v1_scaled_arrow), v2_arrow.animate.become(v2_scaled_arrow), lbl_v1.animate.become(lbl_l1), lbl_v2.animate.become(lbl_l2))

    # Stage 3: Hold and emphasize invariant span lines
    span1 = DashedLine([center[0] - 3.2 * math.cos(ang1), center[1] - 3.2 * math.sin(ang1), 0], [center[0] + 3.2 * math.cos(ang1), center[1] + 3.2 * math.sin(ang1), 0], stroke_width=1.5, stroke_color=theme.accent, stroke_opacity=0.6)
    span2 = DashedLine([center[0] - 2.2 * math.cos(ang2), center[1] - 2.2 * math.sin(ang2), 0], [center[0] + 2.2 * math.cos(ang2), center[1] + 2.2 * math.sin(ang2), 0], stroke_width=1.5, stroke_color=theme.accent_alt, stroke_opacity=0.6)
    run_stage(budget, frames[2], Create(span1), Create(span2))

    budget.fill()
