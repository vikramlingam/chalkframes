"""manim-kv-cache: Autoregressive KV Cache memory visualization."""

from manim import (
    Arrow,
    Create,
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


def run(scene, theme, brief, budget, beat_frames):
    title = clean(brief.get("title") or "Key-Value Cache", 60)
    raw_prompt = brief.get("promptTokens")
    prompt = [clean(t, 10) for t in (raw_prompt if isinstance(raw_prompt, list) else ["The", "quick", "brown"])][:4]
    raw_gen = brief.get("generatedTokens")
    generated = [clean(t, 10) for t in (raw_gen if isinstance(raw_gen, list) else ["fox", "jumps"])][:3]
    all_tokens = prompt + generated
    total_tokens = len(all_tokens)

    fw, fh = config.frame_width, config.frame_height
    col_w = min(fw * 0.72 / max(total_tokens, 1), 1.45)
    row_h = 0.72
    start_x = -((total_tokens - 1) * col_w) / 2

    # Top row: Tokens
    token_mobs = []
    for idx, tok in enumerate(all_tokens):
        x = start_x + idx * col_w
        is_prompt = idx < len(prompt)
        bg = RoundedRectangle(
            corner_radius=0.12,
            width=col_w * 0.88,
            height=row_h,
            stroke_width=3,
            stroke_color=theme.accent if not is_prompt else theme.border,
            fill_color=theme.card if is_prompt else theme.background,
            fill_opacity=1,
        ).move_to([x, 1.5, 0])
        t = Text(tok, font=theme.font, weight="BOLD", color=theme.text if is_prompt else theme.accent).scale(0.42)
        fit(t, col_w * 0.8, row_h * 0.75)
        t.move_to(bg.get_center())
        token_mobs.append(VGroup(bg, t))

    # K Cache and V Cache rows
    axis_col = getattr(theme, "axis", theme.muted)
    k_label = Text("K-Cache", font=theme.mono, weight="BOLD", color=axis_col).scale(0.44).move_to([-fw * 0.38, 0.45, 0])
    v_label = Text("V-Cache", font=theme.mono, weight="BOLD", color=axis_col).scale(0.44).move_to([-fw * 0.38, -0.45, 0])

    k_cells = []
    v_cells = []
    for idx in range(total_tokens):
        x = start_x + idx * col_w
        is_prompt = idx < len(prompt)

        k_box = Rectangle(
            width=col_w * 0.88,
            height=row_h,
            stroke_width=3,
            stroke_color=theme.accent_alt if is_prompt else theme.border,
            fill_color=theme.card,
            fill_opacity=1,
        ).move_to([x, 0.45, 0])
        k_txt = Text(f"k_{idx}", font=theme.mono, weight="BOLD", color=theme.accent if not is_prompt else theme.text).scale(0.38)
        k_cells.append(VGroup(k_box, k_txt.move_to(k_box.get_center())))

        v_box = Rectangle(
            width=col_w * 0.88,
            height=row_h,
            stroke_width=3,
            stroke_color=theme.accent_alt if is_prompt else theme.border,
            fill_color=theme.card,
            fill_opacity=1,
        ).move_to([x, -0.45, 0])
        v_txt = Text(f"v_{idx}", font=theme.mono, weight="BOLD", color=theme.accent if not is_prompt else theme.text).scale(0.38)
        v_cells.append(VGroup(v_box, v_txt.move_to(v_box.get_center())))

    # Efficiency badge at the bottom
    badge_bg = RoundedRectangle(corner_radius=0.14, width=4.6, height=0.68, stroke_width=3, stroke_color=theme.accent, fill_color=theme.card, fill_opacity=0.98).move_to([0, -1.6, 0])
    badge_txt = Text("O(1) Step: Recompute = 0", font=theme.mono, weight="BOLD", color=theme.text).scale(0.38).move_to(badge_bg.get_center())
    badge = VGroup(badge_bg, badge_txt)

    stages = 2 + len(generated)
    weights = [3, 2] + [3] * len(generated)
    frames = stage_frames(budget.total, weights, beat_frames if beat_frames and len(beat_frames) == stages else None)

    scene.add(title_text(theme, title))

    # Stage 1: Prompt tokens and initial KV Cache appear
    prompt_group = [token_mobs[i] for i in range(len(prompt))]
    prompt_k = [k_cells[i] for i in range(len(prompt))]
    prompt_v = [v_cells[i] for i in range(len(prompt))]
    run_stage(budget, frames[0], FadeIn(k_label), FadeIn(v_label), *[FadeIn(m) for m in prompt_group], *[FadeIn(c) for c in prompt_k], *[FadeIn(c) for c in prompt_v])

    # Stage 2: Efficiency badge reveal
    run_stage(budget, frames[1], FadeIn(badge))

    # Stage 3+: Incrementally append generated tokens and new K/V slots
    for g_idx in range(len(generated)):
        tok_idx = len(prompt) + g_idx
        t_mob = token_mobs[tok_idx]
        k_mob = k_cells[tok_idx]
        v_mob = v_cells[tok_idx]
        t_mob[0].set_stroke(theme.accent, width=3)
        k_mob[0].set_stroke(theme.accent, width=3).set_fill(theme.accent, opacity=0.25)
        v_mob[0].set_stroke(theme.accent, width=3).set_fill(theme.accent, opacity=0.25)

        run_stage(budget, frames[2 + g_idx], FadeIn(t_mob), FadeIn(k_mob), FadeIn(v_mob))

    budget.fill()
