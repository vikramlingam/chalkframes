"""manim-latent-manifold: Latent space manifold interpolation."""

import math

from manim import (
    Arc,
    Circle,
    Create,
    DashedLine,
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
    title = clean(brief.get("title") or "Latent Space Manifold & Geodesic Interpolation", 60)
    steps = max(3, min(7, int(brief.get("interpolationSteps") or 5)))
    show_geodesic = bool(brief.get("showGeodesic") if "showGeodesic" in brief else True)

    center = [0, -0.3, 0]

    # Curved manifold wireframe / contour lines
    contours = VGroup()
    for offset_y, curv in [(-1.5, 0.4), (-0.7, 0.6), (0.1, 0.8), (0.9, 0.6), (1.7, 0.4)]:
        pts = []
        for x_step in range(-35, 36, 5):
            x = x_step * 0.1
            y = offset_y + curv * math.sin(x * 0.8) * 0.5 + curv * 0.2
            pts.append([x, y - 0.3, 0])
        wire = Line(pts[0], pts[1], stroke_width=1.2, stroke_color=theme.border, stroke_opacity=0.4)
        for i in range(1, len(pts) - 1):
            wire = VGroup(wire, Line(pts[i], pts[i + 1], stroke_width=1.2, stroke_color=theme.border, stroke_opacity=0.4))
        contours.add(wire)

    # Latent endpoints z1 and z2
    p1 = [-2.4, -0.6, 0]
    p2 = [2.4, 0.8, 0]

    dot_z1 = Dot(p1, radius=0.14, color=theme.accent)
    dot_z2 = Dot(p2, radius=0.14, color=theme.accent_alt)
    lbl_z1 = Text("z_1 (Source)", font=theme.mono, weight="BOLD", color=theme.accent).scale(0.26).next_to(dot_z1, UP + RIGHT, buff=0.1)
    lbl_z2 = Text("z_2 (Target)", font=theme.mono, weight="BOLD", color=theme.accent_alt).scale(0.26).next_to(dot_z2, UP + RIGHT, buff=0.1)

    # Euclidean chord vs Geodesic path
    chord = DashedLine(p1, p2, stroke_width=1.8, stroke_color=theme.muted, stroke_opacity=0.6)
    chord_lbl = Text("Euclidean Shortcut (Off-Manifold)", font=theme.mono, color=theme.muted).scale(0.22).next_to(chord.get_center(), UP, buff=0.1)

    # Curved Geodesic path along the manifold
    geodesic_pts = []
    for step in range(steps + 1):
        t = step / steps
        # Non-linear curve
        gx = p1[0] + (p2[0] - p1[0]) * t
        gy = p1[1] + (p2[1] - p1[1]) * t + 0.9 * math.sin(t * math.pi)
        geodesic_pts.append([gx, gy, 0])

    geo_lines = VGroup()
    sample_dots = VGroup()
    sample_labels = VGroup()
    for i in range(len(geodesic_pts) - 1):
        geo_lines.add(Line(geodesic_pts[i], geodesic_pts[i + 1], stroke_width=3.5, stroke_color=theme.accent))

    for idx, pt in enumerate(geodesic_pts[1:-1], start=1):
        d = Dot(pt, radius=0.09, color=theme.accent_alt)
        s_lbl = Text(f"t={idx/steps:.2f}", font=theme.mono, color=theme.text).scale(0.2).next_to(d, UP, buff=0.08)
        sample_dots.add(d)
        sample_labels.add(s_lbl)

    # Banner / Badge
    badge_bg = RoundedRectangle(corner_radius=0.1, width=5.0, height=0.5, stroke_width=2, stroke_color=theme.border, fill_color=theme.card, fill_opacity=1).move_to([0, 2.0, 0])
    badge_txt1 = Text("Non-Linear Latent Geometry M", font=theme.mono, weight="BOLD", color=theme.text).scale(0.26).move_to(badge_bg.get_center())
    badge_txt2 = Text("Geodesic Path Preserves Realistic Topology", font=theme.mono, weight="BOLD", color=theme.accent).scale(0.26).move_to(badge_bg.get_center())

    stages = 3
    frames = stage_frames(budget.total, [3, 4, 3], beat_frames if beat_frames and len(beat_frames) == stages else None)

    scene.add(title_text(theme, title))

    # Stage 1: Render manifold surface contours and anchor points
    run_stage(budget, frames[0], Create(contours), FadeIn(dot_z1), FadeIn(dot_z2), FadeIn(lbl_z1), FadeIn(lbl_z2), FadeIn(badge_bg), FadeIn(badge_txt1))

    # Stage 2: Euclidean chord vs Geodesic path
    run_stage(budget, frames[1], Create(chord), FadeIn(chord_lbl), Create(geo_lines) if show_geodesic else FadeIn(chord))

    # Stage 3: Intermediate decoded samples along geodesic
    run_stage(budget, frames[2], badge_txt1.animate.become(badge_txt2), FadeIn(sample_dots), FadeIn(sample_labels))

    budget.fill()
