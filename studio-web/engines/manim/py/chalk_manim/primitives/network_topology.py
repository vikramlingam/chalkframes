"""manim-network-topology: layered neural network (forward pass) or a graph traversal.

brief: { layers:[n1,n2,...], labels?:[str], title? }                       -> forward pass
       { nodes:[str], edges:[[i,j],...], start?:int, algorithm?:"bfs"|"dfs" } -> traversal
"""

import math

from manim import (
    Circle,
    Create,
    FadeIn,
    Line,
    Text,
    VGroup,
    config,
)

from ..common import clean, fit, run_stage, stage_frames, title_text

MAX_LAYERS = 6
MAX_PER_LAYER = 8
MAX_NODES = 12


def _layers(raw):
    out = []
    for n in (raw if isinstance(raw, list) else [])[:MAX_LAYERS]:
        try:
            out.append(max(1, min(int(n), MAX_PER_LAYER)))
        except (TypeError, ValueError):
            continue
    return out if len(out) >= 2 else [3, 4, 4, 2]


def _forward(scene, theme, brief, budget, beat_frames):
    sizes = _layers(brief.get("layers"))
    fw, fh = config.frame_width, config.frame_height
    gap_x = fw * 0.72 / max(len(sizes) - 1, 1)
    gap_y = min(fh * 0.62 / max(max(sizes), 1), 1.0)
    radius = min(gap_y * 0.32, 0.28)
    layers = []
    for li, n in enumerate(sizes):
        x = -fw * 0.36 + li * gap_x
        col = VGroup()
        for ni in range(n):
            y = (ni - (n - 1) / 2) * gap_y - 0.2
            col.add(Circle(radius=radius, color=theme.border, fill_color=theme.card, fill_opacity=1, stroke_width=4).move_to([x, y, 0]))
        layers.append(col)
    edges = []
    for a, b in zip(layers[:-1], layers[1:]):
        group = VGroup(*[Line(u.get_center(), v.get_center(), stroke_width=1.6, color=theme.border, stroke_opacity=0.8) for u in a for v in b])
        edges.append(group)

    labels = brief.get("labels") if isinstance(brief.get("labels"), list) else []
    label_mobs = VGroup()
    for li, col in enumerate(layers):
        if li < len(labels) and labels[li]:
            t = Text(clean(labels[li], 18), font=theme.font, color=theme.muted).scale(0.34)
            fit(t, gap_x * 0.9)
            t.next_to(col, [0, -1, 0], buff=0.25)
            label_mobs.add(t)

    n_stages = len(layers)
    frames = stage_frames(budget.total, [2] + [3] * (n_stages - 1), beat_frames if beat_frames and len(beat_frames) == n_stages else None)
    scene.add(title_text(theme, brief.get("title") or ""))
    run_stage(budget, frames[0], *[FadeIn(c) for c in layers], FadeIn(label_mobs))
    for i in range(1, n_stages):
        pulse = layers[i].copy()
        for node in pulse:
            node.set_fill(theme.accent, opacity=1).set_stroke(theme.accent_alt)
        run_stage(budget, frames[i], Create(edges[i - 1]), FadeIn(pulse))
    budget.fill()


def _graph_layout(n):
    pts = []
    fw, fh = config.frame_width, config.frame_height
    for i in range(n):
        ang = 2 * math.pi * i / max(n, 1) + math.pi / 2
        pts.append([math.cos(ang) * fw * 0.28, math.sin(ang) * fh * 0.3 - 0.2, 0])
    return pts


def _order(n, edges, start, algorithm):
    adj = {i: [] for i in range(n)}
    for a, b in edges:
        adj[a].append(b)
        adj[b].append(a)
    seen, order, frontier = {start}, [], [start]
    while frontier:
        cur = frontier.pop(0) if algorithm == "bfs" else frontier.pop()
        order.append(cur)
        for nb in sorted(adj[cur], reverse=(algorithm != "bfs")):
            if nb not in seen:
                seen.add(nb)
                frontier.append(nb)
    return order


def _traversal(scene, theme, brief, budget, beat_frames):
    names = [clean(x, 12) for x in brief["nodes"][:MAX_NODES]]
    n = len(names)
    edges = []
    for pair in brief.get("edges") or []:
        try:
            a, b = int(pair[0]), int(pair[1])
        except (TypeError, ValueError, IndexError, KeyError):
            continue
        if 0 <= a < n and 0 <= b < n and a != b:
            edges.append((a, b))
    try:
        start = int(brief.get("start", 0))
    except (TypeError, ValueError):
        start = 0
    start = start if 0 <= start < n else 0
    algorithm = "bfs" if str(brief.get("algorithm", "bfs")).lower() == "bfs" else "dfs"
    pts = _graph_layout(n)
    node_mobs = []
    for i, p in enumerate(pts):
        c = Circle(radius=0.38, color=theme.border, fill_color=theme.card, fill_opacity=1, stroke_width=4).move_to(p)
        t = Text(names[i], font=theme.font, color=theme.text).scale(0.34)
        fit(t, 0.62)
        t.move_to(p)
        node_mobs.append(VGroup(c, t))
    edge_mobs = [Line(pts[a], pts[b], stroke_width=3, color=theme.border) for a, b in edges]
    order = _order(n, edges, start, algorithm)
    frames = stage_frames(budget.total, [3] + [2] * len(order), None)

    scene.add(title_text(theme, brief.get("title") or ""))
    run_stage(budget, frames[0], *[Create(e) for e in edge_mobs], *[FadeIn(m) for m in node_mobs])
    for idx, node in enumerate(order):
        circle = node_mobs[node][0]
        run_stage(budget, frames[idx + 1], circle.animate.set_fill(theme.accent, opacity=1).set_stroke(theme.accent_alt))
    budget.fill()


def run(scene, theme, brief, budget, beat_frames):
    if isinstance(brief.get("nodes"), list) and len(brief["nodes"]) >= 2:
        _traversal(scene, theme, brief, budget, beat_frames)
    else:
        _forward(scene, theme, brief, budget, beat_frames)
