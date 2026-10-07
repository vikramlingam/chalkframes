"""manim-gradient-descent-3d: Optimization loss contours and particle descent."""

from manim import (
    Arrow,
    Circle,
    Create,
    Dot,
    FadeIn,
    Line,
    RoundedRectangle,
    Text,
    UP,
    VGroup,
    config,
)

from ..common import clean, fit, info_badge, run_stage, stage_frames, title_text


def run(scene, theme, brief, budget, beat_frames):
    title = clean(brief.get("title") or "Gradient Descent with Momentum", 60)
    try:
        steps_count = max(3, min(7, int(brief.get("steps", 5))))
    except (TypeError, ValueError):
        steps_count = 5
    has_momentum = bool(brief.get("momentum", True))

    center = [0.3, -0.3, 0]

    # Concentric loss contour ellipses
    contours = VGroup()
    contour_radii = [0.6, 1.2, 1.9, 2.7, 3.6]
    contour_color = getattr(theme, "axis", "#6A7590")
    for r in contour_radii:
        c = Circle(radius=r, stroke_width=2.5, stroke_color=contour_color, stroke_opacity=0.85).move_to(center)
        c.stretch(1.35, 0)  # stretch horizontally into ellipse
        contours.add(c)

    min_dot = Dot(center, radius=0.16, color=getattr(theme, "gold", theme.accent))
    min_lbl = Text("Loss Minimum", font=theme.mono, weight="BOLD", color=theme.text).scale(0.38).next_to(min_dot, UP, buff=0.12)

    # Waypoints for descent trajectory
    # Starting high loss top-left
    start_pt = [-3.0, 1.8, 0]
    waypoints = [start_pt]

    cur = list(start_pt)
    velocity = [0.0, 0.0]
    lr = 0.55 / steps_count
    gamma = 0.6 if has_momentum else 0.0

    for _ in range(steps_count):
        # Gradient vector pointing uphill away from center
        grad = [(cur[0] - center[0]) * 1.2, (cur[1] - center[1]) * 1.8]
        velocity[0] = gamma * velocity[0] - lr * grad[0]
        velocity[1] = gamma * velocity[1] - lr * grad[1]
        cur[0] += velocity[0]
        cur[1] += velocity[1]
        waypoints.append([cur[0], cur[1], 0])
    waypoints[-1] = center

    # Path segments
    path_lines = VGroup()
    dots = [Dot(start_pt, radius=0.14, color=theme.accent_alt)]
    for i in range(len(waypoints) - 1):
        p_a, p_b = waypoints[i], waypoints[i + 1]
        line = Line(p_a, p_b, stroke_width=4.5, color=getattr(theme, "yellow", theme.accent))
        path_lines.add(line)
        dots.append(Dot(p_b, radius=0.10, color=getattr(theme, "gold", theme.accent)))

    particle = Dot(start_pt, radius=0.18, color=getattr(theme, "gold", theme.accent))

    # Info badge
    mode_text = "Optimizer: Momentum SGD" if has_momentum else "Optimizer: Vanilla SGD"
    badge = info_badge(theme, mode_text, pos=[-config.frame_width * 0.28, 1.6, 0], font_size=0.34)

    # Convergence pulse
    final_ring = Circle(radius=0.35, color=theme.accent, stroke_width=3).move_to(center)

    stages = 3
    frames = stage_frames(budget.total, [3, 4, 3], beat_frames if beat_frames and len(beat_frames) == stages else None)

    scene.add(title_text(theme, title))

    # Stage 1: Contours and minimum fade in
    run_stage(budget, frames[0], Create(contours), FadeIn(min_dot), FadeIn(min_lbl), FadeIn(badge), FadeIn(particle))

    # Stage 2: Trajectory path lines draw as particle steps down
    run_stage(budget, frames[1], Create(path_lines), particle.animate.move_to(center))

    # Stage 3: Convergence pulse ring at minimum
    run_stage(budget, frames[2], Create(final_ring), final_ring.animate.scale(1.8).set_opacity(0))

    budget.fill()
