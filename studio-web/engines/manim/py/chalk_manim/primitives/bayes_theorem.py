"""manim-bayes-theorem: Visual geometric probability partitioning for Bayes theorem."""

from manim import (
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
    title = clean(brief.get("title") or "Bayesian Probability Update: P(A|B)", 60)
    p_a = float(brief.get("priorA") or 0.35)
    p_a = max(0.1, min(0.9, p_a))

    p_b_given_a = float(brief.get("likelihoodBGivenA") or 0.8)
    p_b_given_a = max(0.1, min(0.95, p_b_given_a))

    p_b_given_not_a = 0.2
    # P(B) = P(A)*P(B|A) + P(~A)*P(B|~A)
    p_b = p_a * p_b_given_a + (1 - p_a) * p_b_given_not_a
    # Posterior P(A|B) = P(A)*P(B|A) / P(B)
    posterior = (p_a * p_b_given_a) / p_b if p_b > 0 else 0.5

    center = [-0.8, -0.4, 0]
    w = 3.6
    h = 2.6

    # Unit space box
    box = RoundedRectangle(
        corner_radius=0.06,
        width=w,
        height=h,
        stroke_width=2.5,
        stroke_color=theme.border,
        fill_color=theme.card,
        fill_opacity=0.3,
    ).move_to(center)

    # Vertical split for P(A) vs P(~A)
    split_x = center[0] - w / 2 + w * p_a
    split_line = Line([split_x, center[1] - h / 2, 0], [split_x, center[1] + h / 2, 0], stroke_width=2.5, stroke_color=theme.border)

    # Shaded region P(A)
    w_a = w * p_a
    box_a = RoundedRectangle(
        corner_radius=0.04,
        width=w_a,
        height=h,
        stroke_width=0,
        fill_color=theme.accent,
        fill_opacity=0.2,
    ).move_to([center[0] - w / 2 + w_a / 2, center[1], 0])

    lbl_prior_a = Text(f"Prior P(A) = {p_a:.2f}", font=theme.mono, weight="BOLD", color=theme.accent).scale(0.22).next_to(box_a, UP, buff=0.1)
    lbl_prior_not_a = Text(f"P(~A) = {1 - p_a:.2f}", font=theme.mono, color=theme.muted).scale(0.22).next_to([center[0] + w / 2 - (w - w_a) / 2, center[1] + h / 2, 0], UP, buff=0.1)

    # Horizontal split representing evidence B: height * likelihood
    h_b_a = h * p_b_given_a
    joint_box = RoundedRectangle(
        corner_radius=0.04,
        width=w_a,
        height=h_b_a,
        stroke_width=2,
        stroke_color=theme.accent,
        fill_color=theme.accent,
        fill_opacity=0.7,
    ).move_to([center[0] - w / 2 + w_a / 2, center[1] - h / 2 + h_b_a / 2, 0])

    lbl_joint = Text(f"P(A ∩ B) = {p_a * p_b_given_a:.2f}", font=theme.mono, weight="BOLD", color=theme.text).scale(0.2).move_to(joint_box.get_center())

    # Right side stats / Bayes formula card
    stat_bg = RoundedRectangle(
        corner_radius=0.1,
        width=3.6,
        height=2.8,
        stroke_width=2,
        stroke_color=theme.border,
        fill_color=theme.card,
        fill_opacity=0.9,
    ).move_to([2.8, -0.4, 0])

    s_title = Text("Bayes Rule Update", font=theme.mono, weight="BOLD", color=theme.text).scale(0.24).next_to(stat_bg.get_top(), [0, -1, 0], buff=0.25)
    s_prior = Text(f"Prior P(A): {p_a * 100:.0f}%", font=theme.mono, color=theme.muted).scale(0.22).next_to(s_title, [0, -1, 0], buff=0.22)
    s_lik = Text(f"Likelihood P(B|A): {p_b_given_a * 100:.0f}%", font=theme.mono, color=theme.accent_alt).scale(0.22).next_to(s_prior, [0, -1, 0], buff=0.2)
    s_post_lbl = Text("Posterior Probability:", font=theme.mono, color=theme.text).scale(0.22).next_to(s_lik, [0, -1, 0], buff=0.25)
    s_post_val = Text(f"P(A|B) = {posterior * 100:.1f}%", font=theme.mono, weight="BOLD", color=theme.accent).scale(0.28).next_to(s_post_lbl, [0, -1, 0], buff=0.18)

    badge_bg = RoundedRectangle(corner_radius=0.1, width=5.0, height=0.5, stroke_width=2, stroke_color=theme.border, fill_color=theme.card, fill_opacity=1).move_to([0, 1.9, 0])
    badge_txt = Text("Bayesian Inference: Geometric Conditioning", font=theme.mono, weight="BOLD", color=theme.accent).scale(0.25).move_to(badge_bg.get_center())

    stages = 3
    frames = stage_frames(budget.total, [3, 4, 3], beat_frames if beat_frames and len(beat_frames) == stages else None)

    scene.add(title_text(theme, title))

    # Stage 1: Prior split
    run_stage(budget, frames[0], Create(box), FadeIn(box_a), Create(split_line), FadeIn(lbl_prior_a), FadeIn(lbl_prior_not_a), FadeIn(stat_bg), FadeIn(s_title), FadeIn(badge_bg), FadeIn(badge_txt))

    # Stage 2: Evidence conditioning
    run_stage(budget, frames[1], FadeIn(joint_box), FadeIn(lbl_joint), FadeIn(s_prior), FadeIn(s_lik))

    # Stage 3: Posterior ratio isolation
    run_stage(budget, frames[2], FadeIn(s_post_lbl), FadeIn(s_post_val))

    budget.fill()
