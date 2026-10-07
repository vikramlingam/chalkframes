"""manim-residual-stream: Transformer residual stream central highway."""

from manim import (
    Arrow,
    Circle,
    Create,
    DOWN,
    FadeIn,
    LEFT,
    Line,
    RIGHT,
    RoundedRectangle,
    Text,
    UP,
    VGroup,
    config,
)

from ..common import clean, fit, run_stage, stage_frames, title_text

DEFAULT_STAGES = ["Attention 1", "MLP 1", "Attention 2", "MLP 2"]


def run(scene, theme, brief, budget, beat_frames):
    title = clean(brief.get("title") or "The Residual Stream Highway", 60)
    raw_stages = brief.get("stages")
    stages = [clean(s, 16) for s in (raw_stages if isinstance(raw_stages, list) else DEFAULT_STAGES)][:4]
    if len(stages) < 2:
        stages = DEFAULT_STAGES

    fw, fh = config.frame_width, config.frame_height
    stream_w = 0.5
    stream_h = min(fh * 0.72, 5.0)

    # 1. Central stream highway (prominent high-contrast trunk)
    stream_color = getattr(theme, "teal", theme.accent)
    highway_line = Line([0, stream_h / 2 - 0.2, 0], [0, -stream_h / 2 - 0.2, 0], stroke_width=8, color=stream_color)
    highway_arrow = Arrow([0, stream_h / 2 - 0.2, 0], [0, -stream_h / 2 - 0.2, 0], stroke_width=8, color=stream_color, buff=0)
    stream_tag = Text("Residual Stream Highway", font=theme.mono, weight="BOLD", color=theme.text).scale(0.42).next_to([0, stream_h / 2 - 0.1, 0], UP, buff=0.15)

    # Sub-blocks alternating left and right
    n = len(stages)
    y_step = stream_h / (n + 1)
    block_w, block_h = 2.4, 0.82

    block_mobs = []
    read_arrows = []
    write_arrows = []
    add_badges = []

    for i, st_name in enumerate(stages):
        y = stream_h / 2 - 0.2 - (i + 1) * y_step
        is_left = (i % 2 == 0)
        bx = -2.4 if is_left else 2.4

        block_bg = RoundedRectangle(
            corner_radius=0.12,
            width=block_w,
            height=block_h,
            stroke_width=2.5,
            stroke_color=getattr(theme, "accent", theme.border),
            fill_color=theme.card,
            fill_opacity=1,
        ).move_to([bx, y, 0])
        block_txt = Text(st_name, font=theme.font, weight="BOLD", color=theme.text).scale(0.40)
        fit(block_txt, block_w * 0.88)
        block_txt.move_to(block_bg.get_center())
        block_mobs.append(VGroup(block_bg, block_txt))

        # Read arrow: stream -> block
        r_start = [0, y + 0.12, 0]
        r_end = [bx + block_w / 2 if is_left else bx - block_w / 2, y + 0.12, 0]
        arr_read = Arrow(r_start, r_end, color=getattr(theme, "axis", theme.muted), stroke_width=3.5, buff=0.05)
        read_arrows.append(arr_read)

        # Write arrow: block -> stream
        w_start = [bx + block_w / 2 if is_left else bx - block_w / 2, y - 0.12, 0]
        w_end = [0, y - 0.12, 0]
        arr_write = Arrow(w_start, w_end, color=getattr(theme, "gold", theme.accent), stroke_width=4.0, buff=0.15)
        write_arrows.append(arr_write)

        # Addition badge at connection point on stream
        circ = Circle(radius=0.20, color=getattr(theme, "gold", theme.accent), fill_color=theme.background, fill_opacity=1, stroke_width=2.5).move_to([0, y - 0.12, 0])
        plus = Text("+", font=theme.font, color=getattr(theme, "gold", theme.accent), weight="BOLD").scale(0.34).move_to(circ.get_center())
        add_badges.append(VGroup(circ, plus))

    stage_count = 3
    frames = stage_frames(budget.total, [3, 4, 3], beat_frames if beat_frames and len(beat_frames) == stage_count else None)

    scene.add(title_text(theme, title))

    # Stage 1: Central highway stream appears
    run_stage(budget, frames[0], Create(highway_arrow), FadeIn(stream_tag))

    # Stage 2: Sub-blocks fade in, read arrows connect
    first_half = [FadeIn(b) for b in block_mobs] + [Create(a) for a in read_arrows]
    run_stage(budget, frames[1], *first_half)

    # Stage 3: Write arrows write accumulated state back into stream with (+) badges
    second_half = [Create(w) for w in write_arrows] + [FadeIn(bg) for bg in add_badges]
    run_stage(budget, frames[2], *second_half)

    budget.fill()
