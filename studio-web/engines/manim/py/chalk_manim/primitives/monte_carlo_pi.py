"""manim-monte-carlo-pi: Monte Carlo stochastic estimation of Pi."""

import math

from manim import (
    Arc,
    Circle,
    Create,
    Dot,
    FadeIn,
    Line,
    RIGHT,
    RoundedRectangle,
    Square,
    Text,
    UP,
    VGroup,
)

from ..common import clean, run_stage, stage_frames, title_text


def run(scene, theme, brief, budget, beat_frames):
    title = clean(brief.get("title") or "Monte Carlo Approximation of Pi", 60)
    raw_pts = int(brief.get("pointCount") or 36)
    pts_count = max(20, min(50, raw_pts))

    center = [-1.0, -0.4, 0]
    side = 3.0
    radius = side

    # Square bounding box [0, 1] x [0, 1]
    sq = RoundedRectangle(
        corner_radius=0.04,
        width=side,
        height=side,
        stroke_width=2.5,
        stroke_color=theme.border,
        fill_color=theme.card,
        fill_opacity=0.4,
    ).move_to([center[0] + side / 2, center[1] + side / 2, 0])

    # Quarter circle arc r = side from center
    arc_pts = []
    for step in range(25):
        ang = (step / 24) * (math.pi / 2)
        arc_pts.append([center[0] + radius * math.cos(ang), center[1] + radius * math.sin(ang), 0])

    arc_lines = VGroup()
    for i in range(len(arc_pts) - 1):
        arc_lines.add(Line(arc_pts[i], arc_pts[i + 1], stroke_width=3.5, stroke_color=theme.accent))

    # Generate deterministic pseudo-random sample points
    # Using simple linear congruential values
    samples_in = VGroup()
    samples_out = VGroup()

    seed = 12345
    n_in = 0
    total = pts_count

    for idx in range(total):
        seed = (seed * 1103515245 + 12345) & 0x7FFFFFFF
        rx = (seed % 1000) / 1000.0
        seed = (seed * 1103515245 + 12345) & 0x7FFFFFFF
        ry = (seed % 1000) / 1000.0

        dist_sq = rx * rx + ry * ry
        px = center[0] + rx * side
        py = center[1] + ry * side

        if dist_sq <= 1.0:
            n_in += 1
            d = Dot([px, py, 0], radius=0.06, color=theme.accent)
            samples_in.add(d)
        else:
            d = Dot([px, py, 0], radius=0.06, color=theme.accent_alt)
            samples_out.add(d)

    pi_approx = 4.0 * (n_in / total) if total > 0 else 3.14

    # Right statistics card
    stats_bg = RoundedRectangle(
        corner_radius=0.1,
        width=3.6,
        height=2.8,
        stroke_width=2,
        stroke_color=theme.border,
        fill_color=theme.card,
        fill_opacity=0.9,
    ).move_to([2.8, -0.4, 0])

    stat_title = Text("Sampling Metrics", font=theme.mono, weight="BOLD", color=theme.text).scale(0.24).next_to(stats_bg.get_top(), [0, -1, 0], buff=0.25)
    stat_in = Text(f"Inside Arc: {n_in}", font=theme.mono, color=theme.accent).scale(0.22).next_to(stat_title, [0, -1, 0], buff=0.25)
    stat_tot = Text(f"Total Points: {total}", font=theme.mono, color=theme.muted).scale(0.22).next_to(stat_in, [0, -1, 0], buff=0.2)
    stat_formula = Text("π ≈ 4 × (N_in / N_tot)", font=theme.mono, color=theme.text).scale(0.22).next_to(stat_tot, [0, -1, 0], buff=0.25)
    stat_val = Text(f"Estimated π = {pi_approx:.3f}", font=theme.mono, weight="BOLD", color=theme.accent).scale(0.26).next_to(stat_formula, [0, -1, 0], buff=0.22)

    badge_bg = RoundedRectangle(corner_radius=0.1, width=4.8, height=0.5, stroke_width=2, stroke_color=theme.border, fill_color=theme.card, fill_opacity=1).move_to([0, 1.9, 0])
    badge_txt = Text("Monte Carlo Integration: Area Ratio", font=theme.mono, weight="BOLD", color=theme.accent).scale(0.26).move_to(badge_bg.get_center())

    stages = 3
    frames = stage_frames(budget.total, [3, 4, 3], beat_frames if beat_frames and len(beat_frames) == stages else None)

    scene.add(title_text(theme, title))

    # Stage 1: Domain geometry (unit square and quarter circle arc)
    run_stage(budget, frames[0], Create(sq), Create(arc_lines), FadeIn(stats_bg), FadeIn(stat_title), FadeIn(badge_bg), FadeIn(badge_txt))

    # Stage 2: Scatter points inside and outside
    run_stage(budget, frames[1], FadeIn(samples_in), FadeIn(samples_out), FadeIn(stat_in), FadeIn(stat_tot))

    # Stage 3: Formula and estimated Pi value
    run_stage(budget, frames[2], FadeIn(stat_formula), FadeIn(stat_val))

    budget.fill()
