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
    t.scale(0.7)
    fit(t, config.frame_width * 0.86)
    return t.to_edge(UP, buff=0.35)


def caption_text(theme, text, size=0.42):
    t = Text(clean(text, 70), font=theme.font, color=theme.muted).scale(size)
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
