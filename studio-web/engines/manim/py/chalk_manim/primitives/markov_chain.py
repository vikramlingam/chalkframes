"""manim-markov-chain: Markov state transition graph and stationary distributions."""

import math

from manim import (
    Arrow,
    Circle,
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
    title = clean(brief.get("title") or "Markov Chain State Transition Graph", 60)
    raw_states = brief.get("states")
    if isinstance(raw_states, (list, tuple)) and len(raw_states) >= 3:
        states = [clean(str(s), 12) for s in raw_states[:3]]
    else:
        states = ["State A", "State B", "State C"]

    # 3 nodes in triangle layout
    center = [0, -0.4, 0]
    r_node = 0.65
    positions = [
        [-2.2, -1.0, 0],
        [2.2, -1.0, 0],
        [0, 1.2, 0],
    ]

    nodes = VGroup()
    labels = VGroup()
    colors = [theme.accent, theme.accent_alt, theme.border]

    for i in range(3):
        c = Circle(
            radius=r_node,
            stroke_width=3,
            stroke_color=colors[i],
            fill_color=theme.card,
            fill_opacity=0.95,
        ).move_to(positions[i])
        txt = Text(states[i], font=theme.mono, weight="BOLD", color=theme.text).scale(0.22).move_to(positions[i])
        nodes.add(c)
        labels.add(txt)

    # Transition arrows
    # S0 -> S1, S1 -> S2, S2 -> S0
    def edge_arrow(p1, p2, col):
        dx = p2[0] - p1[0]
        dy = p2[1] - p1[1]
        dist = math.hypot(dx, dy)
        ux = dx / dist
        uy = dy / dist
        start = [p1[0] + ux * r_node, p1[1] + uy * r_node, 0]
        end = [p2[0] - ux * r_node, p2[1] - uy * r_node, 0]
        return Arrow(start, end, color=col, stroke_width=3, buff=0)

    arr01 = edge_arrow(positions[0], positions[1], theme.accent)
    arr12 = edge_arrow(positions[1], positions[2], theme.accent_alt)
    arr20 = edge_arrow(positions[2], positions[0], theme.border)

    p01_lbl = Text("p=0.7", font=theme.mono, color=theme.accent).scale(0.2).next_to(arr01, [0, -1, 0], buff=0.1)
    p12_lbl = Text("p=0.5", font=theme.mono, color=theme.accent_alt).scale(0.2).next_to(arr12, RIGHT, buff=0.1)
    p20_lbl = Text("p=0.6", font=theme.mono, color=theme.text).scale(0.2).next_to(arr20, [-1, 0, 0], buff=0.1)

    arrows = VGroup(arr01, arr12, arr20)
    prob_labels = VGroup(p01_lbl, p12_lbl, p20_lbl)

    # Token moving from S0 -> S1 -> S2
    token = Dot(positions[0], radius=0.14, color=theme.accent)

    badge_bg = RoundedRectangle(corner_radius=0.1, width=5.0, height=0.5, stroke_width=2, stroke_color=theme.border, fill_color=theme.card, fill_opacity=1).move_to([0, 2.0, 0])
    badge_txt1 = Text("State Graph: Discrete Time Transitions", font=theme.mono, weight="BOLD", color=theme.text).scale(0.25).move_to(badge_bg.get_center())
    badge_txt2 = Text("Transition Dynamics -> Stationary Vector π", font=theme.mono, weight="BOLD", color=theme.accent).scale(0.25).move_to(badge_bg.get_center())

    stages = 3
    frames = stage_frames(budget.total, [3, 4, 3], beat_frames if beat_frames and len(beat_frames) == stages else None)

    scene.add(title_text(theme, title))

    # Stage 1: Render state circles and labels
    run_stage(budget, frames[0], FadeIn(nodes), FadeIn(labels), FadeIn(badge_bg), FadeIn(badge_txt1))

    # Stage 2: Render transition arrows and probabilities
    run_stage(budget, frames[1], Create(arrows), FadeIn(prob_labels), FadeIn(token))

    # Stage 3: Step token transition around the loop
    run_stage(budget, frames[2], badge_txt1.animate.become(badge_txt2), token.animate.move_to(positions[1]))

    budget.fill()
