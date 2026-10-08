"""manim-skill: Autonomous Manim Skill Runner.

Craftsmanship patterns:
1. "Geometry before algebra": Spatial intuition and geometric transformation precede formulas.
2. 3-tier opacity layering:
   - Primary focal geometry: 1.0
   - Contextual and reference geometry: 0.40
   - Background axes and coordinate grids: 0.15
3. Dynamic execution: Executes LLM-authored Python only after static validation (sandbox.py), or
   renders a high-production geometric transformation sequence.
"""

import math
import re
import sys
import traceback
from types import ModuleType, SimpleNamespace

import manim
import numpy as np
from manim import (
    Arrow,
    Axes,
    Circle,
    Circumscribe,
    Create,
    CurvedArrow,
    DashedLine,
    Dot,
    FadeIn,
    FadeOut,
    FunctionGraph,
    Indicate,
    Line,
    NumberPlane,
    Rectangle,
    ReplacementTransform,
    RoundedRectangle,
    Scene,
    Square,
    SurroundingRectangle,
    Text,
    Transform,
    VGroup,
    Write,
    config,
    DOWN,
    LEFT,
    ORIGIN,
    RIGHT,
    UL,
    UR,
    UP,
    PI,
    TAU,
)

from ..common import (
    accent_box,
    caption_text,
    clean,
    fit,
    info_badge,
    math_text,
    run_stage,
    stage_frames,
    title_text,
)
from ..theme import Theme
from ..sandbox import check_or_raise, safe_builtins
from ..timing import Budget


def _matches(text, words):
    """Whole-word keyword match. Substring matching sent 'keyboard' to attention."""
    pattern = r"\b(?:" + "|".join(re.escape(w) for w in words) + r")\b"
    return re.search(pattern, text) is not None


# The only numpy names exposed to generated code. The full module can read files
# (np.load, np.genfromtxt), so it is never passed to the sandbox.
_NP_SUBSET = SimpleNamespace(
    array=np.array,
    linspace=np.linspace,
    arange=np.arange,
    zeros=np.zeros,
    ones=np.ones,
    sqrt=np.sqrt,
    exp=np.exp,
    sin=np.sin,
    cos=np.cos,
    dot=np.dot,
    clip=np.clip,
    pi=np.pi,
)


def _num(v, default):
    try:
        v = float(v)
        return v if math.isfinite(v) else default
    except (TypeError, ValueError):
        return default


def _render_geometric_arc(scene, theme, brief, budget, beat_frames):
    """Craftsmanship Architecture: Geometry before algebra, 3-tier opacity."""
    title = brief.get("title") or "Mathematical Animation"
    concept = brief.get("concept") or brief.get("mathExpr") or "Dynamic Transformation"
    text = f"{title} {concept}".lower()

    stages = [("geometry", 3), ("transform", 4), ("formalize", 3)]
    weights = [w for _, w in stages]
    frames = stage_frames(budget.total, weights, beat_frames)

    scene.add(title_text(theme, title))

    # 1. Neural Networks & Deep Learning
    if _matches(
        text,
        ("neural", "network", "networks", "layer", "layers", "weight", "weights", "neuron", "neurons", "deep", "backprop"),
    ):
        frame = RoundedRectangle(
            corner_radius=0.18,
            width=10.6,
            height=5.2,
            stroke_color=theme.border,
            stroke_width=1.5,
            stroke_opacity=0.25,
            fill_color=theme.card,
            fill_opacity=0.12,
        ).shift(DOWN * 0.15)
        layers = [3, 4, 2]
        x_coords = [-3.5, 0.0, 3.5]
        all_nodes = []
        edges = VGroup()
        for count, x in zip(layers, x_coords):
            layer_nodes = []
            y_coords = [-(count - 1) * 0.9 / 2 + i * 0.9 for i in range(count)]
            for y in y_coords:
                node = Dot([x, y - 0.15, 0], radius=0.18, color=getattr(theme, "blue", theme.accent))
                layer_nodes.append(node)
            all_nodes.append(layer_nodes)
        for i in range(len(layers) - 1):
            for n1 in all_nodes[i]:
                for n2 in all_nodes[i + 1]:
                    edge = Line(
                        n1.get_center(),
                        n2.get_center(),
                        stroke_width=1.8,
                        stroke_opacity=0.35,
                        color=theme.border,
                    )
                    edges.add(edge)
        flat_nodes = [node for layer in all_nodes for node in layer]
        run_stage(budget, frames[0], FadeIn(frame), Create(edges), *[FadeIn(n) for n in flat_nodes])
        pulse_nodes = VGroup(
            *[
                node.copy().set_color(getattr(theme, "yellow", theme.accent_alt)).scale(1.4)
                for node in all_nodes[1]
            ]
        )
        badge = info_badge(theme, "Forward Propagation: a = σ(W x + b)", pos=frame.get_top() + UP * 0.35)
        run_stage(budget, frames[1], Transform(VGroup(*all_nodes[1]), pulse_nodes), FadeIn(badge))
        formula = math_text(theme, "z^{[l]} = W^{[l]} a^{[l-1]} + b^{[l]}", size=0.48).next_to(
            frame, DOWN, buff=0.22
        )
        box = accent_box(theme, formula)
        run_stage(budget, frames[2], FadeIn(formula), Create(box))
        budget.fill()
        return

    # 2. Gradient Descent & Loss Landscapes
    if _matches(
        text,
        ("gradient", "gradients", "loss", "descent", "optimize", "optimization", "slope", "minima", "cost", "derivative", "derivatives"),
    ):
        axes = Axes(
            x_range=[-3, 3, 1],
            y_range=[0, 5, 1],
            x_length=9.6,
            y_length=4.8,
            axis_config={"color": theme.border, "stroke_width": 2.0, "stroke_opacity": 0.25},
        ).shift(DOWN * 0.25)
        loss_curve = axes.plot(
            lambda x: 0.5 * x * x + 0.3,
            x_range=[-2.8, 2.8],
            color=getattr(theme, "teal", theme.accent),
            stroke_width=5.0,
        )
        particle = Dot(
            axes.c2p(2.2, 0.5 * 2.2 * 2.2 + 0.3),
            radius=0.18,
            color=getattr(theme, "yellow", theme.accent),
        )
        target_particle = Dot(
            axes.c2p(0.2, 0.5 * 0.2 * 0.2 + 0.3),
            radius=0.18,
            color=getattr(theme, "gold", theme.text),
        )
        tangent = Line(
            axes.c2p(1.2, 0.5 * 2.2 * 2.2 + 0.3 - 2.2 * 1.0),
            axes.c2p(3.0, 0.5 * 2.2 * 2.2 + 0.3 + 2.2 * 0.8),
            color=getattr(theme, "red", theme.accent_alt),
            stroke_width=4.0,
        )
        run_stage(budget, frames[0], FadeIn(axes), Create(loss_curve), FadeIn(particle), Create(tangent))
        descent_arrow = Arrow(
            axes.c2p(2.2, 2.7),
            axes.c2p(0.4, 0.5),
            color=getattr(theme, "gold", theme.accent),
            stroke_width=4.5,
        )
        badge = info_badge(theme, "Gradient Vector: -∇L(θ)", pos=axes.get_top() + UP * 0.35)
        run_stage(
            budget,
            frames[1],
            ReplacementTransform(particle, target_particle),
            Create(descent_arrow),
            FadeIn(badge),
        )
        formula = math_text(theme, "θ_{t+1} = θ_t - η ∇L(θ_t)", size=0.48).next_to(axes, DOWN, buff=0.22)
        box = accent_box(theme, formula)
        run_stage(budget, frames[2], FadeIn(formula), Create(box), FadeOut(tangent))
        budget.fill()
        return

    # 3. Vector Space & Coordinate Matrix Warps
    if _matches(
        text,
        ("matrix", "matrices", "vector", "vectors", "linear", "transform", "transforms", "transformation", "transformations", "basis", "eigen", "eigenvalue", "space", "tensor"),
    ):
        plane = Axes(
            x_range=[-4, 4, 1],
            y_range=[-3, 3, 1],
            x_length=9.0,
            y_length=5.0,
            axis_config={"color": theme.border, "stroke_width": 2.0, "stroke_opacity": 0.25},
        ).shift(DOWN * 0.2)
        i_hat = Arrow(
            plane.c2p(0, 0),
            plane.c2p(1.5, 0),
            color=getattr(theme, "blue", theme.accent),
            buff=0,
            stroke_width=5.5,
        )
        j_hat = Arrow(
            plane.c2p(0, 0),
            plane.c2p(0, 1.5),
            color=getattr(theme, "teal", theme.accent),
            buff=0,
            stroke_width=5.5,
        )
        i_trans = Arrow(
            plane.c2p(0, 0),
            plane.c2p(1.8, 1.2),
            color=getattr(theme, "gold", theme.accent_alt),
            buff=0,
            stroke_width=5.5,
        )
        j_trans = Arrow(
            plane.c2p(0, 0),
            plane.c2p(-0.7, 2.1),
            color=getattr(theme, "yellow", theme.accent_alt),
            buff=0,
            stroke_width=5.5,
        )
        run_stage(budget, frames[0], FadeIn(plane), Create(i_hat), Create(j_hat))
        badge = info_badge(theme, "Matrix Mapping: T(v) = A · v", pos=plane.get_top() + UP * 0.35)
        run_stage(
            budget,
            frames[1],
            ReplacementTransform(i_hat, i_trans),
            ReplacementTransform(j_hat, j_trans),
            FadeIn(badge),
        )
        formula = math_text(theme, "A = [a, b; c, d] · [x, y]^T", size=0.48).next_to(plane, DOWN, buff=0.22)
        box = accent_box(theme, formula)
        run_stage(budget, frames[2], FadeIn(formula), Create(box))
        budget.fill()
        return

    # 4. Attention Mechanism & Transformers
    if _matches(
        text,
        ("attention", "transformer", "transformers", "token", "tokens", "context", "prompt", "prompts", "query", "queries", "key", "keys", "softmax"),
    ):
        envelope = RoundedRectangle(
            corner_radius=0.18,
            width=10.4,
            height=5.2,
            stroke_color=theme.border,
            stroke_width=1.5,
            stroke_opacity=0.25,
            fill_color=theme.card,
            fill_opacity=0.15,
        ).shift(DOWN * 0.15)
        tokens = ["Token 1", "Token 2", "Token 3", "Target"]
        token_boxes = VGroup()
        x_positions = [-3.6, -1.2, 1.2, 3.6]
        for tok, x in zip(tokens, x_positions):
            bg = RoundedRectangle(
                corner_radius=0.12,
                width=1.8,
                height=0.9,
                stroke_width=2.5,
                stroke_color=theme.border,
                fill_color=theme.card,
                fill_opacity=0.85,
            ).move_to([x, -1.2, 0])
            txt = Text(tok, font=theme.mono, weight="BOLD", color=theme.text).scale(0.38).move_to(bg.get_center())
            token_boxes.add(VGroup(bg, txt))
        arc1 = CurvedArrow(
            token_boxes[3].get_top(),
            token_boxes[0].get_top(),
            color=getattr(theme, "blue", theme.accent),
            angle=0.8,
            stroke_width=4.0,
        )
        arc2 = CurvedArrow(
            token_boxes[3].get_top(),
            token_boxes[2].get_top(),
            color=getattr(theme, "gold", theme.accent),
            angle=0.8,
            stroke_width=5.5,
        )
        run_stage(budget, frames[0], FadeIn(envelope), FadeIn(token_boxes))
        badge = info_badge(theme, "Affinity: Softmax(Q K^T / √d)", pos=envelope.get_top() + UP * 0.35)
        run_stage(budget, frames[1], Create(arc1), Create(arc2), FadeIn(badge))
        formula = math_text(theme, "Attention(Q, K, V) = Softmax(Q K^T / √d_k) V", size=0.48).next_to(
            envelope, DOWN, buff=0.22
        )
        box = accent_box(theme, formula)
        run_stage(budget, frames[2], FadeIn(formula), Create(box))
        budget.fill()
        return

    # 5. Probability, Bayes & Distributions
    if _matches(
        text,
        ("probability", "probabilities", "bayes", "distribution", "distributions", "gaussian", "random", "prior", "stat", "statistics"),
    ):
        axes = Axes(
            x_range=[-3.5, 3.5, 1],
            y_range=[0, 1.2, 0.4],
            x_length=9.4,
            y_length=4.8,
            axis_config={"color": theme.border, "stroke_width": 2.0, "stroke_opacity": 0.25},
        ).shift(DOWN * 0.25)
        bell1 = axes.plot(
            lambda x: math.exp(-0.5 * x * x),
            x_range=[-3.2, 3.2],
            color=getattr(theme, "blue", theme.accent),
            stroke_width=5.5,
        )
        bell2 = axes.plot(
            lambda x: 1.1 * math.exp(-1.2 * (x - 0.7) * (x - 0.7)),
            x_range=[-3.2, 3.2],
            color=getattr(theme, "gold", theme.accent_alt),
            stroke_width=5.5,
        )
        area = axes.get_area(
            axes.plot(lambda x: math.exp(-0.5 * x * x), x_range=[-1.0, 1.0]),
            x_range=[-1.0, 1.0],
            color=getattr(theme, "teal", theme.accent),
            opacity=0.35,
        )
        run_stage(budget, frames[0], FadeIn(axes), Create(bell1), FadeIn(area))
        badge = info_badge(theme, "Posterior Update: P(A | B)", pos=axes.get_top() + UP * 0.35)
        run_stage(budget, frames[1], ReplacementTransform(bell1, bell2), FadeIn(badge))
        formula = math_text(theme, "P(A|B) = [P(B|A) P(A)] / P(B)", size=0.48).next_to(axes, DOWN, buff=0.22)
        box = accent_box(theme, formula)
        run_stage(budget, frames[2], FadeIn(formula), Create(box))
        budget.fill()
        return

    # 6. Graph, Tree & Algorithms
    if _matches(
        text,
        ("tree", "trees", "graph", "graphs", "node", "nodes", "edge", "edges", "path", "paths", "traversal", "search"),
    ):
        root = Dot([0, 1.5, 0], radius=0.22, color=getattr(theme, "gold", theme.accent_alt))
        c1 = Dot([-2.2, 0.0, 0], radius=0.18, color=getattr(theme, "blue", theme.accent))
        c2 = Dot([2.2, 0.0, 0], radius=0.18, color=getattr(theme, "blue", theme.accent))
        g1 = Dot([-3.2, -1.3, 0], radius=0.16, color=getattr(theme, "teal", theme.accent))
        g2 = Dot([-1.2, -1.3, 0], radius=0.16, color=getattr(theme, "teal", theme.accent))
        g3 = Dot([2.2, -1.3, 0], radius=0.16, color=getattr(theme, "teal", theme.accent))
        e1 = Arrow(root.get_center(), c1.get_center(), buff=0.2, stroke_width=3.5, color=theme.border)
        e2 = Arrow(root.get_center(), c2.get_center(), buff=0.2, stroke_width=3.5, color=theme.border)
        e3 = Arrow(c1.get_center(), g1.get_center(), buff=0.2, stroke_width=3.0, color=theme.border)
        e4 = Arrow(c1.get_center(), g2.get_center(), buff=0.2, stroke_width=3.0, color=theme.border)
        e5 = Arrow(c2.get_center(), g3.get_center(), buff=0.2, stroke_width=3.0, color=theme.border)
        run_stage(budget, frames[0], FadeIn(root), Create(e1), Create(e2), FadeIn(c1), FadeIn(c2))
        badge = info_badge(theme, "Breadth-First Exploration: O(V + E)", pos=root.get_top() + UP * 0.45)
        run_stage(budget, frames[1], Create(e3), Create(e4), Create(e5), FadeIn(g1), FadeIn(g2), FadeIn(g3), FadeIn(badge))
        formula = math_text(theme, "G = (V, E)  Visited subset V", size=0.48).shift(DOWN * 2.8)
        box = accent_box(theme, formula)
        run_stage(budget, frames[2], FadeIn(formula), Create(box), Indicate(c1, color=getattr(theme, "yellow", theme.accent)))
        budget.fill()
        return

    # 7. Diverse Continuous Geometric Function Families (never repeat across scenes)
    variants = [
        (
            lambda x: 1.8 * math.sin(0.9 * x) / (1 + 0.15 * x * x),
            lambda x: 1.6 * math.cos(1.2 * x) * math.exp(-0.12 * abs(x)),
            "Frequency Superposition",
            "F{psi(t)} = int psi(t) e^{-i omega t} dt",
        ),
        (
            lambda x: 2.0 / (1.0 + math.exp(-1.8 * x)) - 1.0,
            lambda x: x * (1.0 / (1.0 + math.exp(-1.5 * x))),
            "SwiGLU Non-Linear Activation",
            "SwiGLU(x) = Swish(x W) (x V)",
        ),
        (
            lambda x: 0.25 * (x**3 - 3 * x),
            lambda x: 0.75 * (x**2 - 1),
            "Critical Points & Bifurcation",
            "f'(x_0) = 0 => x_0 in {-1, +1}",
        ),
        (
            lambda x: 1.8 * math.exp(-0.4 * x * x),
            lambda x: -1.8 * x * math.exp(-0.4 * x * x),
            "Radial Basis Metric Space",
            "grad K(x, y) = -gamma (x - y) k(x, y)",
        ),
    ]
    pick_idx = sum(ord(c) for c in title) % len(variants)
    fn1, fn2, var_concept, var_formula = variants[pick_idx]

    axes = Axes(
        x_range=[-4, 4, 1],
        y_range=[-2.5, 2.5, 1],
        x_length=9.6,
        y_length=5.0,
        tips=True,
        axis_config={"color": theme.border, "stroke_width": 2.0, "stroke_opacity": 0.25},
    ).shift(DOWN * 0.2)

    curve_initial = axes.plot(fn1, x_range=[-3.8, 3.8], color=getattr(theme, "blue", theme.accent), stroke_width=5.5)
    curve_transformed = axes.plot(fn2, x_range=[-3.8, 3.8], color=getattr(theme, "gold", theme.accent_alt), stroke_width=5.5)
    focal_dot = Dot(axes.c2p(1.0, 0.8), color=theme.text, radius=0.14)

    run_stage(budget, frames[0], FadeIn(axes), Create(curve_initial), FadeIn(focal_dot))
    badge = info_badge(theme, clean(concept or var_concept, 45), pos=axes.get_top() + UP * 0.35)
    run_stage(budget, frames[1], ReplacementTransform(curve_initial, curve_transformed), FadeIn(badge))
    formula = math_text(theme, clean(brief.get("mathExpr") or var_formula, 50), size=0.48).next_to(axes, DOWN, buff=0.22)
    box = accent_box(theme, formula)
    run_stage(budget, frames[2], FadeIn(formula), Create(box), Indicate(focal_dot, color=getattr(theme, "red", theme.accent)))
    budget.fill()


def run(scene, theme, brief, budget, beat_frames):
    """Executes custom Manim Skill Python code or falls back to geometric arc."""
    code = brief.get("code") or brief.get("pythonCode")
    if not code or not isinstance(code, str) or not code.strip():
        _render_geometric_arc(scene, theme, brief, budget, beat_frames)
        return

    # Build execution scope containing all standard Manim and Chalkframes capabilities
    # Modules are excluded so generated code cannot reach os/sys through manim's globals.
    manim_namespace = {
        k: getattr(manim, k)
        for k in dir(manim)
        if not k.startswith("_") and not isinstance(getattr(manim, k), ModuleType)
    }
    exec_scope = {
        **manim_namespace,
        "np": _NP_SUBSET,
        "numpy": _NP_SUBSET,
        "scene": scene,
        "theme": theme,
        "brief": brief,
        "budget": budget,
        "beats": beat_frames,
        "beat_frames": beat_frames,
        "run_stage": run_stage,
        "stage_frames": stage_frames,
        "title_text": title_text,
        "caption_text": caption_text,
        "math_text": math_text,
        "accent_box": accent_box,
        "info_badge": info_badge,
        "clean": clean,
        "fit": fit,
        "Budget": Budget,
        "Theme": Theme,
        "math": math,
    }

    try:
        # Strip potential markdown fences if returned in LLM markdown format
        cleaned_code = code.strip()
        if cleaned_code.startswith("```python"):
            cleaned_code = cleaned_code[9:]
        elif cleaned_code.startswith("```"):
            cleaned_code = cleaned_code[3:]
        if cleaned_code.endswith("```"):
            cleaned_code = cleaned_code[:-3]
        cleaned_code = cleaned_code.strip()

        # Static validation first, then exec with an allowlisted builtins table only.
        check_or_raise(cleaned_code)
        exec_scope["__builtins__"] = safe_builtins()
        exec_scope["__name__"] = "chalk_skill"
        exec(compile(cleaned_code, "<chalk-skill>", "exec"), exec_scope)

        # 1. Did code define a custom run(scene, theme, brief, budget, beats) function?
        if "run" in exec_scope and callable(exec_scope["run"]):
            exec_scope["run"](scene, theme, brief, budget, beat_frames)
        # 2. Or did code define a construct(scene) function?
        elif "construct" in exec_scope and callable(exec_scope["construct"]):
            exec_scope["construct"](scene)
        # 3. Or did code define a Scene class?
        else:
            scene_classes = [
                v
                for v in exec_scope.values()
                if isinstance(v, type) and issubclass(v, Scene) and v is not Scene
            ]
            if scene_classes:
                # Instantiate and invoke construct
                custom_instance = scene_classes[0]()
                custom_instance.construct()

        budget.fill()
    except Exception as exc:
        print(f"[MANIM SKILL EXEC ERROR]: {exc}", file=sys.stderr)
        traceback.print_exc()
        # Raise to trigger self-healing recovery loop in the Node orchestrator
        raise
