"""manim-svd-transform: Singular Value Decomposition geometric transformation."""

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
    config,
)

from ..common import clean, fit, run_stage, stage_frames, title_text


def run(scene, theme, brief, budget, beat_frames):
    title = clean(brief.get("title") or "Geometric SVD (A = U * Sigma * V^T)", 60)
    raw_sigma = brief.get("sigma")
    try:
        s1 = float(raw_sigma[0]) if isinstance(raw_sigma, (list, tuple)) and len(raw_sigma) >= 1 else 2.2
        s2 = float(raw_sigma[1]) if isinstance(raw_sigma, (list, tuple)) and len(raw_sigma) >= 2 else 0.8
    except (TypeError, ValueError):
        s1, s2 = 2.2, 0.8

    s1 = max(0.5, min(3.5, s1))
    s2 = max(0.2, min(2.0, s2))

    center = [0, -0.2, 0]
    r = 1.3

    # Coordinate axes
    axis_col = getattr(theme, "axis", theme.border)
    ax_x = Line([center[0] - 3.8, center[1], 0], [center[0] + 3.8, center[1], 0], stroke_width=3.5, color=axis_col)
    ax_y = Line([center[0], center[1] - 2.4, 0], [center[0], center[1] + 2.4, 0], stroke_width=3.5, color=axis_col)

    # Unit circle
    circle = Circle(radius=r, stroke_width=3.5, stroke_color=getattr(theme, "grid", theme.border), stroke_opacity=0.9).move_to(center)

    # Unit basis vectors (v1, v2)
    v1 = Arrow(center, [center[0] + r, center[1], 0], color=theme.accent, stroke_width=5.5, buff=0)
    v2 = Arrow(center, [center[0], center[1] + r, 0], color=theme.accent_alt, stroke_width=5.5, buff=0)
    v1_lbl = Text("v_1", font=theme.mono, weight="BOLD", color=theme.accent).scale(0.44).next_to(v1.get_end(), UP + RIGHT, buff=0.12)
    v2_lbl = Text("v_2", font=theme.mono, weight="BOLD", color=theme.accent_alt).scale(0.44).next_to(v2.get_end(), UP + RIGHT, buff=0.12)

    # Transformed ellipse (Sigma * circle)
    ellipse = Circle(radius=r, stroke_width=5, stroke_color=theme.accent, stroke_opacity=0.95).move_to(center)
    ellipse.stretch(s1, 0).stretch(s2, 1)

    # Rotated by U (e.g. 35 degrees)
    rot_rad = math.radians(35)
    ellipse_u = ellipse.copy().rotate(rot_rad, about_point=center)

    # Vectors stretched and rotated: sigma1 * u1, sigma2 * u2
    u1_end = [center[0] + r * s1 * math.cos(rot_rad), center[1] + r * s1 * math.sin(rot_rad), 0]
    u2_end = [center[0] - r * s2 * math.sin(rot_rad), center[1] + r * s2 * math.cos(rot_rad), 0]

    u1_arr = Arrow(center, u1_end, color=theme.accent, stroke_width=5.5, buff=0)
    u2_arr = Arrow(center, u2_end, color=theme.accent_alt, stroke_width=5.5, buff=0)
    u1_lbl = Text(f"σ₁u₁ ({s1:.1f})", font=theme.mono, weight="BOLD", color=theme.accent).scale(0.42).next_to(u1_end, UP + RIGHT, buff=0.12)
    u2_lbl = Text(f"σ₂u₂ ({s2:.1f})", font=theme.mono, weight="BOLD", color=theme.accent_alt).scale(0.42).next_to(u2_end, UP, buff=0.12)

    # Phase indicator banner with high contrast badge
    badge_bg = RoundedRectangle(corner_radius=0.14, width=5.2, height=0.68, stroke_width=3, stroke_color=theme.accent, fill_color=theme.card, fill_opacity=0.98).move_to([0, 1.9, 0])
    badge_txt1 = Text("Input Space: Basis Vectors V", font=theme.mono, weight="BOLD", color=theme.text).scale(0.38).move_to(badge_bg.get_center())
    badge_txt2 = Text(f"Singular Values: σ₁={s1:.1f}, σ₂={s2:.1f}", font=theme.mono, weight="BOLD", color=theme.accent).scale(0.38).move_to(badge_bg.get_center())
    badge_txt3 = Text("Output Space: A = U · Σ · Vᵀ", font=theme.mono, weight="BOLD", color=getattr(theme, "yellow", theme.accent)).scale(0.40).move_to(badge_bg.get_center())

    stages = 3
    frames = stage_frames(budget.total, [3, 4, 3], beat_frames if beat_frames and len(beat_frames) == stages else None)

    scene.add(title_text(theme, title))

    # Stage 1: Unit circle and initial basis vectors
    run_stage(budget, frames[0], Create(ax_x), Create(ax_y), Create(circle), FadeIn(v1), FadeIn(v2), FadeIn(v1_lbl), FadeIn(v2_lbl), FadeIn(badge_bg), FadeIn(badge_txt1))

    # Stage 2: Sigma stretching into ellipse
    run_stage(budget, frames[1], badge_txt1.animate.become(badge_txt2), circle.animate.become(ellipse))

    # Stage 3: U rotation into final output orientation with singular vectors
    run_stage(budget, frames[2], badge_txt2.animate.become(badge_txt3), circle.animate.become(ellipse_u), v1.animate.become(u1_arr), v2.animate.become(u2_arr), v1_lbl.animate.become(u1_lbl), v2_lbl.animate.become(u2_lbl))

    budget.fill()
