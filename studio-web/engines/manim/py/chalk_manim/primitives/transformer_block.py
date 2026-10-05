"""manim-transformer-block: Transformer block architectural column with skip connections."""

from manim import (
    Arrow,
    Circle,
    Create,
    Dot,
    DOWN,
    FadeIn,
    Line,
    RIGHT,
    RoundedRectangle,
    Text,
    UP,
    VGroup,
    config,
)

from ..common import clean, fit, run_stage, stage_frames, title_text

DEFAULT_LAYERS = [
    "Input Embedding",
    "Multi-Head Attention",
    "Add & Norm",
    "Feed Forward",
    "Add & Norm",
]


def run(scene, theme, brief, budget, beat_frames):
    title = clean(brief.get("title") or "Transformer Block", 60)
    raw_layers = brief.get("layers")
    layer_names = [clean(x, 24) for x in (raw_layers if isinstance(raw_layers, list) else DEFAULT_LAYERS)][:5]
    if len(layer_names) < 3:
        layer_names = DEFAULT_LAYERS
    highlight = str(brief.get("highlight") or "attention").lower().strip()

    fw, fh = config.frame_width, config.frame_height
    box_w = min(fw * 0.46, 5.2)
    box_h = min(fh * 0.11, 0.72)
    gap = min(fh * 0.045, 0.32)

    n = len(layer_names)
    total_stack_h = n * box_h + (n - 1) * gap
    start_y = -total_stack_h / 2 + box_h / 2 - 0.2

    boxes = []
    box_labels = []
    arrows = []

    for i, name in enumerate(layer_names):
        y = start_y + (n - 1 - i) * (box_h + gap)
        box = RoundedRectangle(
            corner_radius=0.12,
            width=box_w,
            height=box_h,
            stroke_width=2.5,
            stroke_color=theme.border,
            fill_color=theme.card,
            fill_opacity=1.0,
        ).move_to([0, y, 0])

        txt = Text(name, font=theme.font, weight="BOLD", color=theme.text).scale(0.35)
        fit(txt, box_w * 0.88, box_h * 0.7)
        txt.move_to(box.get_center())

        boxes.append(box)
        box_labels.append(txt)

        if i < n - 1:
            next_y = start_y + (n - 2 - i) * (box_h + gap)
            arr = Arrow(
                start=[0, y - box_h / 2, 0],
                end=[0, next_y + box_h / 2, 0],
                buff=0.04,
                stroke_width=2,
                max_tip_length_to_length_ratio=0.25,
                color=theme.muted,
            )
            arrows.append(arr)

    # Residual skip connection bypassing layer 1 (Attention) into layer 2 (Add & Norm)
    skip_x = box_w / 2 + 0.65
    y_pre = boxes[0].get_center()[1]
    y_norm = boxes[2].get_center()[1] if n >= 3 else boxes[-1].get_center()[1]

    skip_path = VGroup(
        Line([box_w / 2, y_pre, 0], [skip_x, y_pre, 0], color=theme.accent, stroke_width=2.5),
        Line([skip_x, y_pre, 0], [skip_x, y_norm, 0], color=theme.accent, stroke_width=2.5),
        Arrow([skip_x, y_norm, 0], [box_w / 2, y_norm, 0], color=theme.accent, stroke_width=2.5, buff=0),
    )
    skip_badge = VGroup(
        Circle(radius=0.18, color=theme.accent, fill_color=theme.background, fill_opacity=1, stroke_width=2).move_to([skip_x, (y_pre + y_norm) / 2, 0]),
        Text("+", font=theme.font, color=theme.accent, weight="BOLD").scale(0.3).move_to([skip_x, (y_pre + y_norm) / 2, 0]),
    )
    pulse_dot = Dot([skip_x, y_pre, 0], radius=0.12, color=theme.accent_alt)

    # Frame budget stages
    stages = 3
    frames = stage_frames(budget.total, [3, 4, 3], beat_frames if beat_frames and len(beat_frames) == stages else None)

    scene.add(title_text(theme, title))

    # Stage 1: Entrance of architectural column
    scene_mobs = [FadeIn(b) for b in boxes] + [FadeIn(l) for l in box_labels] + [Create(a) for a in arrows]
    run_stage(budget, frames[0], *scene_mobs)

    # Stage 2: Processing pulse on target layer
    target_idx = 1 if highlight == "attention" else (3 if highlight == "ffn" and n >= 4 else 1)
    target_box = boxes[target_idx]
    target_pulse = target_box.animate.set_fill(theme.accent, opacity=0.35).set_stroke(theme.accent, width=4)
    run_stage(budget, frames[1], target_pulse)

    # Stage 3: Residual skip connection drawing and signal injection
    run_stage(budget, frames[2], Create(skip_path), FadeIn(skip_badge), pulse_dot.animate.move_to([skip_x, y_norm, 0]))

    budget.fill()
