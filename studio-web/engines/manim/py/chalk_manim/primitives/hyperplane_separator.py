"""manim-hyperplane-separator: Maximum-margin separating hyperplane and support vectors."""

from manim import (
    Create,
    DashedLine,
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
    title = clean(brief.get("title") or "Optimal Separating Boundary & Support Vectors", 60)
    margin = float(brief.get("marginWidth") or 0.6)
    margin = max(0.3, min(1.2, margin))
    show_sv = bool(brief.get("showSupportVectors") if "showSupportVectors" in brief else True)

    center = [0, -0.3, 0]

    # Two clusters of points: Class +1 (accent) and Class -1 (accent_alt)
    class_pos_pts = [
        [center[0] - 2.2, center[1] + 1.2, 0],
        [center[0] - 1.8, center[1] + 1.8, 0],
        [center[0] - 2.8, center[1] + 0.6, 0],
        [center[0] - 1.4, center[1] + 0.9, 0],  # Support vector 1
    ]

    class_neg_pts = [
        [center[0] + 2.2, center[1] - 1.0, 0],
        [center[0] + 1.8, center[1] - 1.6, 0],
        [center[0] + 2.8, center[1] - 0.4, 0],
        [center[0] + 1.2, center[1] - 0.7, 0],  # Support vector 2
    ]

    group_pos = VGroup(*[Dot(p, radius=0.11, color=theme.accent) for p in class_pos_pts])
    group_neg = VGroup(*[Dot(p, radius=0.11, color=theme.accent_alt) for p in class_neg_pts])

    lbl_c1 = Text("Class +1", font=theme.mono, weight="BOLD", color=theme.accent).scale(0.24).next_to(class_pos_pts[1], UP, buff=0.1)
    lbl_c2 = Text("Class -1", font=theme.mono, weight="BOLD", color=theme.accent_alt).scale(0.24).next_to(class_neg_pts[1], UP, buff=0.1)

    # Initial suboptimal separator line (horizontal-ish)
    subopt_line = Line([center[0] - 3.2, center[1] + 0.6, 0], [center[0] + 3.2, center[1] + 0.3, 0], stroke_width=2.5, stroke_color=theme.muted)

    # Optimal maximum-margin hyperplane: w^T x + b = 0
    # Line passing between (-1.4, 0.9) and (1.2, -0.7) with midpoint (-0.1, 0.1)
    opt_line = Line([center[0] - 2.6, center[1] - 1.8, 0], [center[0] + 2.4, center[1] + 2.0, 0], stroke_width=3.5, stroke_color=theme.text)
    opt_lbl = Text("Max-Margin Boundary: w^T x + b = 0", font=theme.mono, weight="BOLD", color=theme.text).scale(0.24).next_to([center[0] + 2.2, center[1] + 1.8, 0], RIGHT, buff=0.1)

    # Margin bounds (dashed support lines at distance margin)
    norm_dx = -0.6 * margin
    norm_dy = 0.7 * margin

    margin_pos = DashedLine(
        [center[0] - 2.6 + norm_dx, center[1] - 1.8 + norm_dy, 0],
        [center[0] + 2.4 + norm_dx, center[1] + 2.0 + norm_dy, 0],
        stroke_width=2,
        stroke_color=theme.accent,
        stroke_opacity=0.7,
    )
    margin_neg = DashedLine(
        [center[0] - 2.6 - norm_dx, center[1] - 1.8 - norm_dy, 0],
        [center[0] + 2.4 - norm_dx, center[1] + 2.0 - norm_dy, 0],
        stroke_width=2,
        stroke_color=theme.accent_alt,
        stroke_opacity=0.7,
    )

    badge_bg = RoundedRectangle(corner_radius=0.1, width=5.0, height=0.5, stroke_width=2, stroke_color=theme.border, fill_color=theme.card, fill_opacity=1).move_to([0, 1.9, 0])
    badge_txt1 = Text("Class Separation Challenge", font=theme.mono, weight="BOLD", color=theme.muted).scale(0.26).move_to(badge_bg.get_center())
    badge_txt2 = Text(f"Optimal Boundary (Margin = 2/||w||)", font=theme.mono, weight="BOLD", color=theme.accent).scale(0.26).move_to(badge_bg.get_center())

    stages = 3
    frames = stage_frames(budget.total, [3, 4, 3], beat_frames if beat_frames and len(beat_frames) == stages else None)

    scene.add(title_text(theme, title))

    # Stage 1: Scatter points and suboptimal line
    run_stage(budget, frames[0], FadeIn(group_pos), FadeIn(group_neg), FadeIn(lbl_c1), FadeIn(lbl_c2), Create(subopt_line), FadeIn(badge_bg), FadeIn(badge_txt1))

    # Stage 2: Rotate and translate into optimal hyperplane
    run_stage(budget, frames[1], badge_txt1.animate.become(badge_txt2), subopt_line.animate.become(opt_line), FadeIn(opt_lbl))

    # Stage 3: Reveal support vector margin boundaries
    if show_sv:
        run_stage(budget, frames[2], Create(margin_pos), Create(margin_neg))
    else:
        run_stage(budget, frames[2], FadeIn(opt_lbl))

    budget.fill()
