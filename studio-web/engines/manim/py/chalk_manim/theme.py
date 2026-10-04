"""Design-token bridge: Chalk Frames palette -> Manim configuration and colours.

Palette tokens may arrive in CSS syntax (``rgba(255, 255, 255, 0.12)``, ``#rrggbbaa``).
Manim rejects those, so every token goes through ``parse_color`` first.
"""

import logging
import re

from manim import ManimColor, config

log = logging.getLogger("chalk_manim.theme")

_RGB_RE = re.compile(
    r"^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)(?:\s*,\s*([\d\.]+%?))?\s*\)$",
    re.IGNORECASE,
)
_HEX_RE = re.compile(r"^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$", re.IGNORECASE)

DEFAULT_PALETTE = {
    "background": "#09090d",
    "text": "#f4f4f7",
    "textMuted": "#9898ab",
    "muted": "#888899",
    "accent": "#8b5cf6",
    "accentDark": "#a78bfa",
    "accentText": "#ffffff",
    "card": "#13131c",
    "border": "#20202e",
}


def _clamp(value):
    return max(0, min(255, int(round(value))))


def _split(color_val):
    """Return ((r, g, b), alpha) for a CSS colour string, or None if unrecognised."""
    text = str(color_val).strip()
    match = _HEX_RE.match(text)
    if match:
        digits = match.group(1)
        if len(digits) <= 4:
            digits = "".join(c * 2 for c in digits)
        rgb = tuple(int(digits[i : i + 2], 16) for i in (0, 2, 4))
        alpha = int(digits[6:8], 16) / 255 if len(digits) == 8 else 1.0
        return rgb, alpha
    match = _RGB_RE.match(text)
    if match:
        r, g, b, a = match.groups()
        alpha = 1.0
        if a is not None:
            alpha = float(a[:-1]) / 100 if a.endswith("%") else float(a)
        return (float(r), float(g), float(b)), max(0.0, min(1.0, alpha))
    return None


def parse_color(color_val, default="#FFFFFF", background=None):
    """Normalise any palette colour to a ``#rrggbb`` string Manim accepts.

    - ``#rgb`` / ``#rrggbb`` / ``#rrggbbaa``  -> 6-digit hex
    - ``rgb(...)`` / ``rgba(...)``            -> 6-digit hex
    - alpha < 1 is composited over ``background`` (default black), so a 12% white border
      stays a subtle border instead of becoming solid white
    - anything Manim still rejects logs a warning and returns ``default``
    """
    try:
        parts = _split(color_val) if color_val is not None else None
        if parts is None:
            raise ValueError(f"unrecognised colour {color_val!r}")
        (r, g, b), alpha = parts
        if alpha < 1.0:
            bg = _split(background) if background else None
            br, bgg, bb = bg[0] if bg else (0, 0, 0)
            r, g, b = (
                r * alpha + br * (1 - alpha),
                g * alpha + bgg * (1 - alpha),
                b * alpha + bb * (1 - alpha),
            )
        solid = "#{:02x}{:02x}{:02x}".format(_clamp(r), _clamp(g), _clamp(b))
        ManimColor(solid)  # final guard: the exact check that used to raise ValueError
        return solid
    except (ValueError, TypeError) as exc:
        log.warning("parse_color: %s; using default %s", exc, default)
        return default


class Theme:
    """Resolved colours + fonts. Primitives must never hardcode a colour."""

    def __init__(self, palette=None, fonts=None):
        p = {**DEFAULT_PALETTE, **(palette or {})}
        self.background = parse_color(p["background"], DEFAULT_PALETTE["background"])
        bg = self.background

        def tone(key):
            return parse_color(p.get(key), DEFAULT_PALETTE[key], background=bg)

        self.text = tone("text")
        self.muted = parse_color(
            p.get("textMuted") or p.get("muted"), DEFAULT_PALETTE["textMuted"], background=bg
        )
        self.accent = tone("accent")
        self.accent_alt = parse_color(
            p.get("accentDark") or p.get("accent"), DEFAULT_PALETTE["accentDark"], background=bg
        )
        self.accent_text = tone("accentText")
        self.card = tone("card")
        self.border = tone("border")
        f = fonts or {}
        self.font = f.get("sans") or "Helvetica Neue"
        self.mono = f.get("mono") or "Menlo"

    def apply(self):
        """Override Manim's global defaults (black background, white strokes)."""
        config.background_color = self.background
        return self
