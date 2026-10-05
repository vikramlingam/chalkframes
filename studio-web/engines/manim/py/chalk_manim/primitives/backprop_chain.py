"""manim-backprop-chain: Computation graph with forward activations and backward gradients."""

from manim import (
    Arrow,
    Circle,
    Create,
    CurvedArrow,
    DOWN,
    FadeIn,
    Line,
    RoundedRectangle,
    Text,
    UP,
    VGroup,
    config,
)

from ..common import clean, fit, run_stage, stage_frames, title_text

DEFAULT_NODES = ["Input (x, y)", "Gate (z = x * y)", "Loss (L = (z - y)^2)"]


def run(scene, theme, brief, budget, beat_frames):
    title = clean(brief.get("title") or "Backpropagation & Chain Rule", 60)
    raw_nodes = brief.get("nodeNames")
    node_names = [clean(n, 20) for n in (raw_nodes if isinstance(raw_nodes, list) else DEFAULT_NODES)][:4]
    if len(node_names) < 2:
        node_names = DEFAULT_NODES

    fw, fh = config.frame_width, config.frame_height
    n = len(node_names)
    gap_x = min(fw * 0.76 / max(n - 1, 1), 3.2)
    start_x = -((n - 1) * gap_x) / 2

    node_mobs = []
    forward_arrows = []
    backward_arrows = []

    for i, name in enumerate(node_names):
        x = start_x + i * gap_x
        box = RoundedRectangle(
            corner_radius=0.1,
            width=2.1,
            height=0.8,
            stroke_width=2.5,
            stroke_color=theme.border,
            fill_color=theme.card,
            fill_opacity=1,
        ).move_to([x, 0, 0])
        lbl = Text(name, font=theme.mono, weight="BOLD", color=theme.text).scale(0.28)
        fit(lbl, 1.9, 0.6)
        lbl.move_to(box.get_center())
        node_mobs.append(VGroup(box, lbl))

        if i < n - 1:
            next_x = start_x + (i + 1) * gap_x
            # Forward arrow (top half)
            f_arr = Arrow([x + 1.1, 0.15, 0], [next_x - 1.1, 0.15, 0], stroke_width=2.5, color=theme.muted, buff=0)
            forward_arrows.append(f_arr)

            # Backward gradient arrow (bottom half, reversed direction)
            b_arr = Arrow([next_x - 1.1, -0.15, 0], [x + 1.1, -0.15, 0], stroke_width=2.5, color=theme.accent, buff=0)
            grad_lbl = Text(f"dL/d(node_{i})", font=theme.mono, color=theme.accent).scale(0.24).next_to(b_arr, DOWN, buff=0.1)
            backward_arrows.append(VGroup(b_arr, grad_lbl))

    # Phase banners
    f_tag = Text("Forward Pass: Compute Activations", font=theme.mono, weight="BOLD", color=theme.muted).scale(0.28).move_to([0, 1.4, 0])
    b_tag = Text("Backward Pass: Apply Chain Rule dL/dx = (dL/dz)*(dz/dx)", font=theme.mono, weight="BOLD", color=theme.accent).scale(0.28).move_to([0, 1.4, 0])

    stages = 3
    frames = stage_frames(budget.total, [3, 4, 3], beat_frames if beat_frames and len(beat_frames) == stages else None)

    scene.add(title_text(theme, title))

    # Stage 1: Graph nodes appear
    run_stage(budget, frames[0], *[FadeIn(m) for m in node_mobs])

    # Stage 2: Forward activations flow left to right
    run_stage(budget, frames[1], FadeIn(f_tag), *[Create(a) for a in forward_arrows])

    # Stage 3: Backward gradients flow right to left
    run_stage(budget, frames[2], f_tag.animate.become(b_tag), *[FadeIn(b) for b in backward_arrows])

    budget.fill()
