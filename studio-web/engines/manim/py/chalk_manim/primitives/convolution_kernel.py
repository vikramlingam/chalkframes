"""manim-convolution-kernel: 2D Convolution sliding filter and feature map."""

from manim import (
    Arrow,
    Create,
    DOWN,
    FadeIn,
    LEFT,
    Rectangle,
    RIGHT,
    RoundedRectangle,
    Square,
    Text,
    UP,
    VGroup,
    config,
)

from ..common import clean, fit, run_stage, stage_frames, title_text


def run(scene, theme, brief, budget, beat_frames):
    title = clean(brief.get("title") or "2D Convolutional Kernel Operation", 60)
    try:
        k_size = max(2, min(3, int(brief.get("kernelSize", 3))))
    except (TypeError, ValueError):
        k_size = 3

    fw, fh = config.frame_width, config.frame_height

    # 1. Input Image Grid (5x5)
    in_dim = 5
    in_cell = 0.52
    in_origin = [-fw * 0.28, -0.2, 0]

    in_cells = []
    for r in range(in_dim):
        for c in range(in_dim):
            x = in_origin[0] + (c - (in_dim - 1) / 2) * in_cell
            y = in_origin[1] + ((in_dim - 1) / 2 - r) * in_cell
            sq = Square(
                side_length=in_cell,
                stroke_width=1.5,
                stroke_color=theme.border,
                fill_color=theme.card,
                fill_opacity=0.9,
            ).move_to([x, y, 0])
            in_cells.append(sq)
    in_grid = VGroup(*in_cells)
    in_tag = Text(f"Input ({in_dim}x{in_dim})", font=theme.mono, weight="BOLD", color=theme.muted).scale(0.28).next_to(in_grid, UP, buff=0.15)

    # 2. Output Feature Map (3x3)
    out_dim = in_dim - k_size + 1
    out_cell = 0.58
    out_origin = [fw * 0.28, -0.2, 0]

    out_cells = []
    for r in range(out_dim):
        for c in range(out_dim):
            x = out_origin[0] + (c - (out_dim - 1) / 2) * out_cell
            y = out_origin[1] + ((out_dim - 1) / 2 - r) * out_cell
            sq = Square(
                side_length=out_cell,
                stroke_width=1.8,
                stroke_color=theme.border,
                fill_color=theme.card,
                fill_opacity=0.6,
            ).move_to([x, y, 0])
            out_cells.append(sq)
    out_grid = VGroup(*out_cells)
    out_tag = Text(f"Feature Map ({out_dim}x{out_dim})", font=theme.mono, weight="BOLD", color=theme.muted).scale(0.28).next_to(out_grid, UP, buff=0.15)

    # Connecting arrow between input and output
    conn_arrow = Arrow([-fw * 0.08, -0.2, 0], [fw * 0.08, -0.2, 0], color=theme.accent, stroke_width=3, buff=0)
    kernel_badge = Text(f"{k_size}x{k_size} Kernel", font=theme.mono, weight="BOLD", color=theme.accent).scale(0.26).next_to(conn_arrow, UP, buff=0.1)

    # Kernel sliding overlay frame on input
    k_frame_len = k_size * in_cell
    # Position (0, 0)
    pos0 = [
        in_origin[0] + ((k_size - 1) / 2 - (in_dim - 1) / 2) * in_cell,
        in_origin[1] + ((in_dim - 1) / 2 - (k_size - 1) / 2) * in_cell,
        0,
    ]
    # Position (0, 1)
    pos1 = [pos0[0] + in_cell, pos0[1], 0]

    kernel_box = Square(
        side_length=k_frame_len,
        stroke_width=3.5,
        stroke_color=theme.accent,
        fill_color=theme.accent,
        fill_opacity=0.25,
    ).move_to(pos0)

    stages = 3
    frames = stage_frames(budget.total, [3, 4, 3], beat_frames if beat_frames and len(beat_frames) == stages else None)

    scene.add(title_text(theme, title))

    # Stage 1: Input and output grids appear
    run_stage(budget, frames[0], Create(in_grid), FadeIn(in_tag), Create(out_grid), FadeIn(out_tag), Create(conn_arrow), FadeIn(kernel_badge))

    # Stage 2: Kernel locks on position (0, 0), output cell (0, 0) lights up
    out_active0 = out_cells[0].animate.set_fill(theme.accent, opacity=0.85).set_stroke(theme.accent_alt, width=3)
    run_stage(budget, frames[1], FadeIn(kernel_box), out_active0)

    # Stage 3: Kernel slides to position (0, 1), output cell (0, 1) lights up
    out_active1 = out_cells[1].animate.set_fill(theme.accent, opacity=0.85).set_stroke(theme.accent_alt, width=3)
    run_stage(budget, frames[2], kernel_box.animate.move_to(pos1), out_active1)

    budget.fill()
