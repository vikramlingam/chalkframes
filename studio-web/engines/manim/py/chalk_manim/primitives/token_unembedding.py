"""manim-token-unembedding: Hidden-state projection into Softmax token distribution."""

from manim import (
    Arrow,
    Create,
    FadeIn,
    LEFT,
    Line,
    Rectangle,
    RIGHT,
    RoundedRectangle,
    Text,
    VGroup,
    config,
)

from ..common import clean, fit, run_stage, stage_frames, title_text

DEFAULT_TOKENS = [
    {"token": "intelligence", "prob": 0.68},
    {"token": "learning", "prob": 0.18},
    {"token": "networks", "prob": 0.09},
    {"token": "systems", "prob": 0.05},
]


def run(scene, theme, brief, budget, beat_frames):
    title = clean(brief.get("title") or "Language Model Head (Unembedding)", 60)
    raw_tokens = brief.get("topTokens")
    tokens_data = raw_tokens if isinstance(raw_tokens, list) and len(raw_tokens) >= 2 else DEFAULT_TOKENS
    tokens_data = tokens_data[:5]

    fw, fh = config.frame_width, config.frame_height

    # 1. Left: Hidden-state vector h
    vec_w, vec_h = 0.6, min(fh * 0.55, 3.4)
    vec_box = RoundedRectangle(
        corner_radius=0.08,
        width=vec_w,
        height=vec_h,
        stroke_width=2.5,
        stroke_color=theme.border,
        fill_color=theme.card,
        fill_opacity=1,
    ).move_to([-fw * 0.32, -0.1, 0])
    vec_lbl = Text("h (d_model)", font=theme.mono, weight="BOLD", color=theme.muted).scale(0.28).next_to(vec_box, LEFT, buff=0.15)

    # Sub-slices inside the vector
    slices = VGroup()
    n_slices = 6
    for i in range(1, n_slices):
        y = vec_box.get_top()[1] - i * (vec_h / n_slices)
        slices.add(Line([vec_box.get_left()[0], y, 0], [vec_box.get_right()[0], y, 0], stroke_width=1, color=theme.border))

    # 2. Middle: Projection Matrix Funnel (W_u)
    funnel_top = Line(vec_box.get_top(), [vec_box.get_center()[0] + 1.8, 1.3, 0], stroke_width=2, color=theme.border)
    funnel_bot = Line(vec_box.get_bottom(), [vec_box.get_center()[0] + 1.8, -1.5, 0], stroke_width=2, color=theme.border)
    proj_lbl = Text("W_unembed", font=theme.mono, weight="BOLD", color=theme.accent).scale(0.3).move_to([vec_box.get_center()[0] + 0.9, -0.1, 0])
    proj_arrow = Arrow([vec_box.get_center()[0] + 0.3, -0.1, 0], [vec_box.get_center()[0] + 1.5, -0.1, 0], color=theme.accent, stroke_width=3, buff=0)

    # 3. Right: Softmax Probability Distribution (Horizontal Bars)
    bar_start_x = 0.2
    n_bars = len(tokens_data)
    bar_h = min(0.48, (fh * 0.5) / n_bars)
    max_bar_w = fw * 0.36

    bar_group = VGroup()
    top_idx = max(range(n_bars), key=lambda i: float(tokens_data[i].get("prob", 0)))

    for i, item in enumerate(tokens_data):
        y = 1.0 - i * (bar_h + 0.22)
        prob = max(0.01, min(1.0, float(item.get("prob", 0.1))))
        w = max(0.2, prob * max_bar_w)
        is_top = i == top_idx

        token_str = clean(str(item.get("token", f"T_{i}")), 14)
        txt = Text(token_str, font=theme.mono, weight="BOLD" if is_top else "NORMAL", color=theme.text if is_top else theme.muted).scale(0.28)
        txt.next_to([bar_start_x, y, 0], LEFT, buff=0.15)

        bar = Rectangle(
            width=w,
            height=bar_h,
            stroke_width=2 if is_top else 1.5,
            stroke_color=theme.accent if is_top else theme.border,
            fill_color=theme.accent if is_top else theme.card,
            fill_opacity=0.9 if is_top else 0.7,
        )
        bar.move_to([bar_start_x + w / 2, y, 0])

        pct_txt = Text(f"{int(round(prob * 100))}%", font=theme.mono, weight="BOLD", color=theme.accent_text if is_top else theme.muted).scale(0.26)
        pct_txt.next_to(bar, RIGHT, buff=0.12)

        bar_group.add(VGroup(txt, bar, pct_txt))

    stages = 3
    frames = stage_frames(budget.total, [3, 3, 4], beat_frames if beat_frames and len(beat_frames) == stages else None)

    scene.add(title_text(theme, title))

    # Stage 1: Hidden state vector fades in
    run_stage(budget, frames[0], FadeIn(vec_box), FadeIn(slices), FadeIn(vec_lbl))

    # Stage 2: Funnel projection matrix activates
    run_stage(budget, frames[1], Create(funnel_top), Create(funnel_bot), FadeIn(proj_lbl), Create(proj_arrow))

    # Stage 3: Softmax probability distribution bars expand
    run_stage(budget, frames[2], *[FadeIn(m) for m in bar_group])

    budget.fill()
