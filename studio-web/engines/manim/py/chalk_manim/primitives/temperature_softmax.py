"""manim-temperature-softmax: Softmax distribution under temperature scaling."""

import math

from manim import (
    DOWN,
    FadeIn,
    LEFT,
    Rectangle,
    RIGHT,
    RoundedRectangle,
    Text,
    UP,
    VGroup,
    config,
)

from ..common import clean, fit, run_stage, stage_frames, title_text


def _softmax(logits, temp):
    t = max(temp, 0.05)
    scaled = [z / t for z in logits]
    max_z = max(scaled)
    exps = [math.exp(z - max_z) for z in scaled]
    total = sum(exps) or 1.0
    return [e / total for e in exps]


def run(scene, theme, brief, budget, beat_frames):
    title = clean(brief.get("title") or "Softmax Temperature Scaling", 60)
    raw_logits = brief.get("logits")
    logits = [float(z) for z in (raw_logits if isinstance(raw_logits, list) else [2.0, 1.0, 0.5, 3.2])][:5]
    if len(logits) < 2:
        logits = [2.0, 1.0, 0.5, 3.2]
    try:
        target_temp = float(brief.get("temperature", 0.5))
    except (TypeError, ValueError):
        target_temp = 0.5

    fw, fh = config.frame_width, config.frame_height
    n = len(logits)

    p_base = _softmax(logits, 1.0)
    p_target = _softmax(logits, target_temp)

    # 1. Temperature Header / Badge
    temp_box = RoundedRectangle(corner_radius=0.1, width=3.8, height=0.55, stroke_width=2, stroke_color=theme.border, fill_color=theme.card, fill_opacity=1).move_to([0, 1.6, 0])
    temp_init_txt = Text("Temperature T = 1.0", font=theme.mono, weight="BOLD", color=theme.text).scale(0.3).move_to(temp_box.get_center())
    temp_target_txt = Text(f"Temperature T = {target_temp:.2f}", font=theme.mono, weight="BOLD", color=theme.accent).scale(0.3).move_to(temp_box.get_center())

    # 2. Probability Bar Chart
    chart_w = min(fw * 0.72, 6.4)
    bar_w = (chart_w / n) * 0.65
    gap_x = chart_w / max(n - 1, 1) if n > 1 else chart_w
    start_x = -chart_w / 2
    base_y = -1.2
    max_h = 2.2

    bars_base = []
    bars_target = []
    labels = []

    for i in range(n):
        x = start_x + i * gap_x
        h1 = max(0.08, p_base[i] * max_h)
        h2 = max(0.08, p_target[i] * max_h)

        b1 = Rectangle(
            width=bar_w,
            height=h1,
            stroke_width=2,
            stroke_color=theme.border,
            fill_color=theme.accent_alt,
            fill_opacity=0.75,
        ).move_to([x, base_y + h1 / 2, 0])

        is_max = p_target[i] == max(p_target)
        b2 = Rectangle(
            width=bar_w,
            height=h2,
            stroke_width=2.5 if is_max else 2,
            stroke_color=theme.accent if is_max else theme.border,
            fill_color=theme.accent if is_max else theme.card,
            fill_opacity=0.9 if is_max else 0.5,
        ).move_to([x, base_y + h2 / 2, 0])

        lbl = Text(f"z_{i}={logits[i]:.1f}", font=theme.mono, color=theme.muted).scale(0.25).next_to([x, base_y, 0], DOWN, buff=0.15)

        bars_base.append(b1)
        bars_target.append(b2)
        labels.append(lbl)

    stages = 3
    frames = stage_frames(budget.total, [3, 3, 4], beat_frames if beat_frames and len(beat_frames) == stages else None)

    scene.add(title_text(theme, title))

    # Stage 1: Initial distribution at T = 1.0
    run_stage(budget, frames[0], FadeIn(temp_box), FadeIn(temp_init_txt), *[FadeIn(b) for b in bars_base], *[FadeIn(l) for l in labels])

    # Stage 2: Temperature parameter shifts to target_temp
    run_stage(budget, frames[1], temp_init_txt.animate.become(temp_target_txt))

    # Stage 3: Bars morph dynamically to scaled distribution p_target
    transforms = [bars_base[i].animate.become(bars_target[i]) for i in range(n)]
    run_stage(budget, frames[2], *transforms)

    budget.fill()
