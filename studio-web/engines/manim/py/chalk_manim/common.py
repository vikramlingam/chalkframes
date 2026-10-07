"""Shared helpers for primitives: safe text, fitting, stage/beat frame allocation."""

from manim import DOWN, UP, Text, config

from .timing import allocate

MAX_TEXT = 80


def clean(value, limit=MAX_TEXT):
    """Plain, length-capped display text. Primitives only ever render Text (no LaTeX)."""
    return str(value if value is not None else "").replace("\n", " ").strip()[:limit]


def fit(mobject, max_width=None, max_height=None):
    """Manim never clips: scale down anything that would leave the frame."""
    if max_width is not None and mobject.width > max_width:
        mobject.scale_to_fit_width(max_width)
    if max_height is not None and mobject.height > max_height:
        mobject.scale_to_fit_height(max_height)
    return mobject


def title_text(theme, text):
    t = Text(clean(text, 60), font=theme.font, weight="BOLD", color=theme.text)
    t.scale(0.72)
    fit(t, config.frame_width * 0.88)
    return t.to_edge(UP, buff=0.32)


def caption_text(theme, text, size=0.48):
    c = getattr(theme, "blue", theme.accent)
    t = Text(clean(text, 70), font=theme.font, weight="BOLD", color=c).scale(size)
    fit(t, config.frame_width * 0.86)
    return t.to_edge(DOWN, buff=0.35)


def stage_frames(total, weights, beat_frames=None):
    """Frames per stage. Uses director beat frames when counts match, else weights."""
    n = len(weights)
    if beat_frames and len(beat_frames) == n and sum(beat_frames) > 0:
        return allocate(total, beat_frames, minimum=1)
    return allocate(total, weights, minimum=1)


def run_stage(budget, frames, *animations):
    """Play animations over ~55% of the stage (>= 0.5s when it fits) and hold the rest."""
    frames = max(1, int(frames))
    if animations:
        anim = min(frames, max(int(frames * 0.55), min(frames, 15)))
        budget.play(*animations, frames=anim)
        budget.hold(frames - anim)
    else:
        budget.hold(frames)


def math_text(theme, text, size=0.50, color=None):
    """3b1b mathematical text formatted with mono font and thematic color."""
    c = color or theme.text
    t = Text(clean(text, 70), font=theme.mono, weight="BOLD", color=c).scale(size)
    fit(t, config.frame_width * 0.8)
    return t


def accent_box(theme, mobject, color=None, buff=0.14):
    """3b1b surrounding highlight box with rounded corners and high-visibility stroke."""
    from manim import SurroundingRectangle

    c = color or getattr(theme, "yellow", theme.accent)
    return SurroundingRectangle(mobject, color=c, buff=buff, stroke_width=3.5, corner_radius=0.12)


def info_badge(theme, text, pos=None, width=None, height=0.72, font_size=0.40, color=None):
    """Crisp, high-contrast 3b1b information badge with readable bold typography."""
    from manim import RoundedRectangle, VGroup

    c = color or theme.text
    txt = Text(clean(text, 55), font=theme.mono, weight="BOLD", color=c).scale(font_size)
    w = max(width or (txt.width + 0.65), 3.4)
    bg = RoundedRectangle(
        corner_radius=0.14,
        width=w,
        height=height,
        stroke_width=3.0,
        stroke_color=getattr(theme, "accent", theme.border),
        fill_color=theme.card,
        fill_opacity=0.98,
    )
    if pos is not None:
        bg.move_to(pos)
    txt.move_to(bg.get_center())
    return VGroup(bg, txt)

