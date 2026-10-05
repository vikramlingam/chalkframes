"""manim-activation-functions: Non-linear neural activation curves."""

import math

from manim import (
    Circle,
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


def _eval_activation(fn_type, x):
    if fn_type == "relu":
        return max(0.0, x)
    elif fn_type == "gelu":
        # 0.5 * x * (1 + tanh(sqrt(2/pi) * (x + 0.044715 * x^3)))
        return 0.5 * x * (1.0 + math.tanh(math.sqrt(2.0 / math.pi) * (x + 0.044715 * (x ** 3))))
    elif fn_type == "swiglu":
        # SiLU(x) = x * sigmoid(x)
        sig = 1.0 / (1.0 + math.exp(-max(-20.0, min(20.0, x))))
        return x * sig
    else:  # sigmoid
        sig = 1.0 / (1.0 + math.exp(-max(-20.0, min(20.0, x))))
        return sig


def run(scene, theme, brief, budget, beat_frames):
    title = clean(brief.get("title") or "Non-Linear Activation Function", 60)
    fn_type = str(brief.get("functionType") or "gelu").lower()
    if fn_type not in ["relu", "gelu", "sigmoid", "swiglu"]:
        fn_type = "gelu"

    center = [0, -0.4, 0]
    scale_x = 0.8
    scale_y = 1.2 if fn_type == "sigmoid" else 0.7

    # Coordinate axes
    ax_x = Line([center[0] - 3.5, center[1], 0], [center[0] + 3.5, center[1], 0], stroke_width=1.5, stroke_color=theme.border)
    ax_y = Line([center[0], center[1] - 2.0, 0], [center[0], center[1] + 2.2, 0], stroke_width=1.5, stroke_color=theme.border)
    x_lbl = Text("x (pre-activation)", font=theme.mono, color=theme.muted).scale(0.22).next_to([center[0] + 3.4, center[1], 0], UP, buff=0.08)
    y_lbl = Text("σ(x) (activation)", font=theme.mono, color=theme.muted).scale(0.22).next_to([center[0], center[1] + 2.1, 0], RIGHT, buff=0.08)

    # Plot curve
    pts = []
    for step in range(-40, 41):
        x = step * 0.1
        y = _eval_activation(fn_type, x)
        px = center[0] + x * scale_x
        py = center[1] + y * scale_y
        pts.append([px, py, 0])

    curve = VGroup()
    for i in range(len(pts) - 1):
        curve.add(Line(pts[i], pts[i + 1], stroke_width=3.5, stroke_color=theme.accent))

    # Animated probe dot moving along curve
    p_neg = pts[10]  # x = -3.0
    p_zero = pts[40] # x = 0.0
    p_pos = pts[65]  # x = +2.5

    dot = Dot(p_neg, radius=0.12, color=theme.accent_alt)
    dot_lbl1 = Text("Saturated / Inactive", font=theme.mono, weight="BOLD", color=theme.accent_alt).scale(0.22).next_to(p_neg, UP, buff=0.15)
    dot_lbl2 = Text("Non-Linear Knee", font=theme.mono, weight="BOLD", color=theme.accent_alt).scale(0.22).next_to(p_zero, UP + RIGHT, buff=0.15)
    dot_lbl3 = Text("Linear Propagation", font=theme.mono, weight="BOLD", color=theme.accent).scale(0.22).next_to(p_pos, UP + RIGHT, buff=0.15)

    # Top function badge
    badge_bg = RoundedRectangle(corner_radius=0.1, width=4.4, height=0.5, stroke_width=2, stroke_color=theme.border, fill_color=theme.card, fill_opacity=1).move_to([0, 1.9, 0])
    badge_txt = Text(f"Activation: {fn_type.upper()}(x)", font=theme.mono, weight="BOLD", color=theme.accent).scale(0.28).move_to(badge_bg.get_center())

    stages = 3
    frames = stage_frames(budget.total, [3, 4, 3], beat_frames if beat_frames and len(beat_frames) == stages else None)

    scene.add(title_text(theme, title))

    # Stage 1: Axes and curve drawing
    run_stage(budget, frames[0], Create(ax_x), Create(ax_y), FadeIn(x_lbl), FadeIn(y_lbl), Create(curve), FadeIn(badge_bg), FadeIn(badge_txt))

    # Stage 2: Probe entering saturated region -> knee
    run_stage(budget, frames[1], FadeIn(dot), FadeIn(dot_lbl1), dot.animate.move_to(p_zero), dot_lbl1.animate.become(dot_lbl2))

    # Stage 3: Probe moving into active linear region
    run_stage(budget, frames[2], dot.animate.move_to(p_pos), dot_lbl2.animate.become(dot_lbl3))

    budget.fill()
