/**
 * Chalk Frames Autonomous Manim Skill Integration.
 *
 * Craftsmanship standards:
 * - "Geometry before algebra": Spatial intuition precedes symbolic equations.
 * - 3-tier opacity layering:
 *     Tier 1 (1.0): Primary focal geometry & active transformations
 *     Tier 2 (0.40): Contextual and comparative geometry
 *     Tier 3 (0.15): Reference coordinate axes and gridlines
 * - Autonomous self-healing execution loop: Intercepts Python tracebacks and
 *   repairs the script until exit code 0 is achieved.
 * - Rich semantic catalog: When offline or during fast generation, selects from
 *   distinct mathematical architectures (Neural Networks, Loss Surfaces, Vector Spaces,
 *   Attention Mechanisms, Probability Distributions, Graph Traversals, and Waves).
 */

/**
 * Builds the system prompt instructing the AI agent to write professional
 * 3Blue1Brown-quality Python code for a Manim scene.
 */
export function buildManimSkillPrompt({
  scene,
  topic,
  theme = "dark",
  beatCount = 3,
  sceneIndex = 0,
  totalScenes = 1,
}) {
  return `You are the Autonomous Mathematical Animator.
You write production-grade Manim Community Edition (CE) Python code for 3Blue1Brown-style explainer scenes.

SCENE CONTEXT:
- Scene Number: ${sceneIndex + 1} of ${totalScenes}
- Title: "${scene.title || topic || "Mathematical Animation"}"
- Voiceover Narration: "${scene.voiceover || ""}"
- Topic Domain: "${topic || "Mathematics & Computing"}"
- Presentation Theme: "${theme}"
- Number of Narration Beats: ${beatCount}

CRAFTSMANSHIP PATTERNS:
1. "GEOMETRY BEFORE ALGEBRA":
   Visual memory encodes faster than symbolic memory. Do NOT start by displaying raw equations.
   In Beat 1, build the coordinate system and geometric intuition.
   In Beat 2, execute the core spatial transformation or parameter deformation.
   In Beat 3, formalize the concept with mathematical notation (using math_text) and takeaway badges.

2. 3-TIER OPACITY LAYERING:
   - Tier 1 (1.0): Primary focus elements (active curves, transformed vectors, key nodes).
   - Tier 2 (0.40): Contextual and reference geometry (bounding hulls, tangent lines, projections).
   - Tier 3 (0.15): Background axes, coordinate grids, and reference frames.

3. TIMING & SYNCHRONIZATION:
   Implement: def run(scene, theme, brief, budget, beats):
   - "scene": Manim Scene instance
   - "theme": Active color palette (theme.accent, theme.accent_alt, theme.border, theme.card, theme.text, theme.blue, theme.gold, theme.teal, theme.red, theme.yellow)
   - "budget": Budget instance. Use budget.play(*anims, frames=n) and budget.hold(n)
   - "beats": Integer frame allocations for each narration beat (e.g. beats[0], beats[1], beats[2])
   Use run_stage(budget, beats[i], *anims) for automatic 55% animation + 45% hold cadence.
   Always call budget.fill() at the very end of def run(...).

4. SAFETY & COMPATIBILITY:
   - Use clean, standard Manim CE objects: Axes, NumberPlane, Circle, Square, Line, Arrow, Dot, CurvedArrow, VGroup, RoundedRectangle.
   - Text rendering: Use title_text(theme, text), caption_text(theme, text), math_text(theme, text), info_badge(theme, text), accent_box(theme, mob).
   - Ensure all coordinates stay within frame bounds (X: [-6.5, 6.5], Y: [-3.5, 3.5]).
   - Available in sandbox: np, numpy, math, run_stage, stage_frames, title_text, caption_text, math_text, info_badge, accent_box, clean, fit, Axes, NumberPlane, Dot, Line, Arrow, CurvedArrow, Circle, Square, Rectangle, RoundedRectangle, VGroup, FadeIn, FadeOut, Create, Transform, ReplacementTransform, Indicate, Circumscribe, UP, DOWN, LEFT, RIGHT, ORIGIN, PI, TAU.
   - No external file reads or network calls.
   - Do not import anything. Imports, dunder names, private (underscore) attributes, exec, eval, open and compile are rejected before execution.

Return ONLY executable Python code defining:
def run(scene, theme, brief, budget, beats):
...`;
}

/**
 * Selects an authentic, domain-tailored procedural Manim animation based on
 * the scene's semantic keywords and position in the storyboard.
 */
export function generateProceduralManimCode({
  title = "Mathematical Concept",
  voiceover = "",
  topic = "",
  sceneIndex = 0,
}) {
  const text = `${title} ${voiceover} ${topic}`.toLowerCase();
  const safeTitle = title.replace(/"/g, '\\"');

  // 1. Neural Networks & Deep Learning
  if (
    /\b(?:neural|networks?|layers?|weights?|activations?|deep|backprop|perceptrons?|neurons?|embeddings?)\b/.test(
      text,
    )
  ) {
    return `def run(scene, theme, brief, budget, beats):
    # Craftsmanship: Neural Network Architecture & Synaptic Propagation
    scene.add(title_text(theme, "${safeTitle}"))

    # Tier 3 (0.15 opacity): Network Bounding Frame
    frame = RoundedRectangle(
        corner_radius=0.18, width=10.6, height=5.2,
        stroke_color=theme.border, stroke_width=1.5, stroke_opacity=0.25,
        fill_color=theme.card, fill_opacity=0.12
    ).shift(DOWN * 0.15)

    # Tier 2 (0.35 opacity): Synaptic Weights
    layers = [3, 4, 2]
    x_coords = [-3.5, 0.0, 3.5]
    all_nodes = []
    edges = VGroup()

    for l_idx, (count, x) in enumerate(zip(layers, x_coords)):
        layer_nodes = []
        y_coords = [-(count - 1) * 0.9 / 2 + i * 0.9 for i in range(count)]
        for y in y_coords:
            node = Dot([x, y - 0.15, 0], radius=0.18, color=getattr(theme, "blue", theme.accent))
            layer_nodes.append(node)
        all_nodes.append(layer_nodes)

    for i in range(len(layers) - 1):
        for n1 in all_nodes[i]:
            for n2 in all_nodes[i + 1]:
                edge = Line(n1.get_center(), n2.get_center(), stroke_width=1.8, stroke_opacity=0.35, color=theme.border)
                edges.add(edge)

    # Tier 1 (1.0 opacity): Active Nodes & Forward Signals
    input_group = VGroup(*all_nodes[0])
    hidden_group = VGroup(*all_nodes[1])
    output_group = VGroup(*all_nodes[2])

    b0 = beats[0] if len(beats) > 0 else budget.total // 3
    run_stage(budget, b0, FadeIn(frame), Create(edges), FadeIn(input_group), FadeIn(hidden_group), FadeIn(output_group))

    b1 = beats[1] if len(beats) > 1 else budget.total // 3
    pulse_nodes = VGroup(*[node.copy().set_color(getattr(theme, "yellow", theme.accent_alt)).scale(1.4) for node in all_nodes[1]])
    badge = info_badge(theme, "Forward Propagation: a = σ(W x + b)", pos=frame.get_top() + UP * 0.35)
    run_stage(budget, b1, Transform(hidden_group, pulse_nodes), FadeIn(badge))

    b2 = beats[2] if len(beats) > 2 else (budget.total - b0 - b1)
    formula = math_text(theme, "z^{[l]} = W^{[l]} a^{[l-1]} + b^{[l]}", size=0.48).next_to(frame, DOWN, buff=0.22)
    box = accent_box(theme, formula)
    run_stage(budget, b2, FadeIn(formula), Create(box))
    budget.fill()
`;
  }

  // 2. Gradient Descent & Loss Landscapes
  if (
    /\b(?:gradients?|loss|descent|optimi[sz]e|optimi[sz]ation|derivatives?|slope|minima|convergence|cost|rate)\b/.test(
      text,
    )
  ) {
    return `def run(scene, theme, brief, budget, beats):
    # Craftsmanship: Convex Loss Landscape & Gradient Flow
    scene.add(title_text(theme, "${safeTitle}"))

    # Tier 3 (0.15 opacity): Coordinate Axes
    axes = Axes(
        x_range=[-3, 3, 1], y_range=[0, 5, 1], x_length=9.6, y_length=4.8,
        axis_config={"color": theme.border, "stroke_width": 2.0, "stroke_opacity": 0.25}
    ).shift(DOWN * 0.25)

    # Tier 2 (0.40 opacity): Loss Curve
    loss_curve = axes.plot(lambda x: 0.5 * x * x + 0.3, x_range=[-2.8, 2.8], color=getattr(theme, "teal", theme.accent), stroke_width=5.0)

    # Tier 1 (1.0 opacity): Parameter Particle & Tangent Slope
    particle = Dot(axes.c2p(2.2, 0.5 * 2.2 * 2.2 + 0.3), radius=0.18, color=getattr(theme, "yellow", theme.accent))
    target_particle = Dot(axes.c2p(0.2, 0.5 * 0.2 * 0.2 + 0.3), radius=0.18, color=getattr(theme, "gold", theme.text))
    tangent = Line(axes.c2p(1.2, 0.5 * 2.2 * 2.2 + 0.3 - 2.2 * 1.0), axes.c2p(3.0, 0.5 * 2.2 * 2.2 + 0.3 + 2.2 * 0.8), color=getattr(theme, "red", theme.accent_alt), stroke_width=4.0)

    b0 = beats[0] if len(beats) > 0 else budget.total // 3
    run_stage(budget, b0, FadeIn(axes), Create(loss_curve), FadeIn(particle), Create(tangent))

    b1 = beats[1] if len(beats) > 1 else budget.total // 3
    descent_arrow = Arrow(axes.c2p(2.2, 2.7), axes.c2p(0.4, 0.5), color=getattr(theme, "gold", theme.accent), stroke_width=4.5)
    badge = info_badge(theme, "Gradient Vector: -∇L(θ)", pos=axes.get_top() + UP * 0.35)
    run_stage(budget, b1, ReplacementTransform(particle, target_particle), Create(descent_arrow), FadeIn(badge))

    b2 = beats[2] if len(beats) > 2 else (budget.total - b0 - b1)
    formula = math_text(theme, "θ_{t+1} = θ_t - η ∇L(θ_t)", size=0.48).next_to(axes, DOWN, buff=0.22)
    box = accent_box(theme, formula)
    run_stage(budget, b2, FadeIn(formula), Create(box), FadeOut(tangent))
    budget.fill()
`;
  }

  // 3. Vector Space & Coordinate Matrix Warps
  if (
    /\b(?:matri(?:x|ces)|vectors?|linear|transforms?|transformations?|basis|dimensions?|eigen\w*|projections?|space|tensors?)\b/.test(
      text,
    )
  ) {
    return `def run(scene, theme, brief, budget, beats):
    # Craftsmanship: Linear Transformation & Basis Warp
    scene.add(title_text(theme, "${safeTitle}"))

    # Tier 3 (0.15 opacity): Coordinate Plane
    plane = Axes(
        x_range=[-4, 4, 1], y_range=[-3, 3, 1], x_length=9.0, y_length=5.0,
        axis_config={"color": theme.border, "stroke_width": 2.0, "stroke_opacity": 0.25}
    ).shift(DOWN * 0.2)

    # Tier 1 (1.0 opacity): Unit Basis Vectors i-hat and j-hat
    i_hat = Arrow(plane.c2p(0, 0), plane.c2p(1.5, 0), color=getattr(theme, "blue", theme.accent), buff=0, stroke_width=5.5)
    j_hat = Arrow(plane.c2p(0, 0), plane.c2p(0, 1.5), color=getattr(theme, "teal", theme.accent), buff=0, stroke_width=5.5)

    # Transformed Basis Vectors under Matrix A = [[1.2, 0.8], [-0.5, 1.4]]
    i_trans = Arrow(plane.c2p(0, 0), plane.c2p(1.8, 1.2), color=getattr(theme, "gold", theme.accent_alt), buff=0, stroke_width=5.5)
    j_trans = Arrow(plane.c2p(0, 0), plane.c2p(-0.7, 2.1), color=getattr(theme, "yellow", theme.accent_alt), buff=0, stroke_width=5.5)

    b0 = beats[0] if len(beats) > 0 else budget.total // 3
    run_stage(budget, b0, FadeIn(plane), Create(i_hat), Create(j_hat))

    b1 = beats[1] if len(beats) > 1 else budget.total // 3
    badge = info_badge(theme, "Matrix Mapping: T(v) = A · v", pos=plane.get_top() + UP * 0.35)
    run_stage(budget, b1, ReplacementTransform(i_hat, i_trans), ReplacementTransform(j_hat, j_trans), FadeIn(badge))

    b2 = beats[2] if len(beats) > 2 else (budget.total - b0 - b1)
    formula = math_text(theme, "A = [a, b; c, d] · [x, y]^T", size=0.48).next_to(plane, DOWN, buff=0.22)
    box = accent_box(theme, formula)
    run_stage(budget, b2, FadeIn(formula), Create(box))
    budget.fill()
`;
  }

  // 4. Attention Mechanism & Transformers
  if (
    /\b(?:attention|transformers?|tokens?|context|prompts?|quer(?:y|ies)|keys?|values?|softmax|llm)\b/.test(
      text,
    )
  ) {
    return `def run(scene, theme, brief, budget, beats):
    # Craftsmanship: Self-Attention & Query-Key Affinity
    scene.add(title_text(theme, "${safeTitle}"))

    # Tier 3 (0.15 opacity): Attention Envelope
    envelope = RoundedRectangle(
        corner_radius=0.18, width=10.4, height=5.2,
        stroke_color=theme.border, stroke_width=1.5, stroke_opacity=0.25,
        fill_color=theme.card, fill_opacity=0.15
    ).shift(DOWN * 0.15)

    # Tier 2 (0.40 opacity): Token Sequence Blocks
    tokens = ["Token 1", "Token 2", "Token 3", "Target"]
    token_boxes = VGroup()
    x_positions = [-3.6, -1.2, 1.2, 3.6]
    for i, (tok, x) in enumerate(zip(tokens, x_positions)):
        bg = RoundedRectangle(corner_radius=0.12, width=1.8, height=0.9, stroke_width=2.5, stroke_color=theme.border, fill_color=theme.card, fill_opacity=0.85).move_to([x, -1.2, 0])
        txt = Text(tok, font=theme.mono, weight="BOLD", color=theme.text).scale(0.38).move_to(bg.get_center())
        token_boxes.add(VGroup(bg, txt))

    # Tier 1 (1.0 opacity): Attention Arcs
    arc1 = CurvedArrow(token_boxes[3].get_top(), token_boxes[0].get_top(), color=getattr(theme, "blue", theme.accent), angle=0.8, stroke_width=4.0)
    arc2 = CurvedArrow(token_boxes[3].get_top(), token_boxes[2].get_top(), color=getattr(theme, "gold", theme.accent), angle=0.8, stroke_width=5.5)

    b0 = beats[0] if len(beats) > 0 else budget.total // 3
    run_stage(budget, b0, FadeIn(envelope), FadeIn(token_boxes))

    b1 = beats[1] if len(beats) > 1 else budget.total // 3
    badge = info_badge(theme, "Affinity Score: Softmax(Q K^T / √d)", pos=envelope.get_top() + UP * 0.35)
    run_stage(budget, b1, Create(arc1), Create(arc2), FadeIn(badge))

    b2 = beats[2] if len(beats) > 2 else (budget.total - b0 - b1)
    formula = math_text(theme, "Attention(Q, K, V) = Softmax(Q K^T / √d_k) V", size=0.48).next_to(envelope, DOWN, buff=0.22)
    box = accent_box(theme, formula)
    run_stage(budget, b2, FadeIn(formula), Create(box))
    budget.fill()
`;
  }

  // 5. Probability, Bayes & Distributions
  if (
    /\b(?:probabilit(?:y|ies)|bayes|distributions?|gaussian|random|samples?|prior|variance|stat|statistics|normal)\b/.test(
      text,
    )
  ) {
    return `def run(scene, theme, brief, budget, beats):
    # Craftsmanship: Gaussian Bell Curve & Bayesian Shading
    scene.add(title_text(theme, "${safeTitle}"))

    axes = Axes(
        x_range=[-3.5, 3.5, 1], y_range=[0, 1.2, 0.4], x_length=9.4, y_length=4.8,
        axis_config={"color": theme.border, "stroke_width": 2.0, "stroke_opacity": 0.25}
    ).shift(DOWN * 0.25)

    bell1 = axes.plot(lambda x: math.exp(-0.5 * x * x), x_range=[-3.2, 3.2], color=getattr(theme, "blue", theme.accent), stroke_width=5.5)
    bell2 = axes.plot(lambda x: 1.1 * math.exp(-1.2 * (x - 0.7) * (x - 0.7)), x_range=[-3.2, 3.2], color=getattr(theme, "gold", theme.accent_alt), stroke_width=5.5)
    area = axes.get_area(axes.plot(lambda x: math.exp(-0.5 * x * x), x_range=[-1.0, 1.0]), x_range=[-1.0, 1.0], color=getattr(theme, "teal", theme.accent), opacity=0.35)

    b0 = beats[0] if len(beats) > 0 else budget.total // 3
    run_stage(budget, b0, FadeIn(axes), Create(bell1), FadeIn(area))

    b1 = beats[1] if len(beats) > 1 else budget.total // 3
    badge = info_badge(theme, "Posterior Update: P(A | B)", pos=axes.get_top() + UP * 0.35)
    run_stage(budget, b1, ReplacementTransform(bell1, bell2), FadeIn(badge))

    b2 = beats[2] if len(beats) > 2 else (budget.total - b0 - b1)
    formula = math_text(theme, "P(A|B) = [P(B|A) P(A)] / P(B)", size=0.48).next_to(axes, DOWN, buff=0.22)
    box = accent_box(theme, formula)
    run_stage(budget, b2, FadeIn(formula), Create(box))
    budget.fill()
`;
  }

  // 6. Graph, Tree & Algorithms
  if (
    /\b(?:trees?|graphs?|nodes?|clusters?|edges?|paths?|flows?|hierarchy|traversal|sort|sorting)\b/.test(
      text,
    )
  ) {
    return `def run(scene, theme, brief, budget, beats):
    # Craftsmanship: Graph Traversal & Topological Ordering
    scene.add(title_text(theme, "${safeTitle}"))

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

    b0 = beats[0] if len(beats) > 0 else budget.total // 3
    run_stage(budget, b0, FadeIn(root), Create(e1), Create(e2), FadeIn(c1), FadeIn(c2))

    b1 = beats[1] if len(beats) > 1 else budget.total // 3
    badge = info_badge(theme, "Breadth-First Exploration: O(V + E)", pos=root.get_top() + UP * 0.45)
    run_stage(budget, b1, Create(e3), Create(e4), Create(e5), FadeIn(g1), FadeIn(g2), FadeIn(g3), FadeIn(badge))

    b2 = beats[2] if len(beats) > 2 else (budget.total - b0 - b1)
    formula = math_text(theme, "G = (V, E) \\quad \\text{Visited} \\subseteq V", size=0.48).shift(DOWN * 2.8)
    box = accent_box(theme, formula)
    run_stage(budget, b2, FadeIn(formula), Create(box), Indicate(c1, color=getattr(theme, "yellow", theme.accent)))
    budget.fill()
`;
  }

  // 7. Dynamic Continuous Curves & Inflection Points (cycled by scene index so every scene is unique)
  const variants = [
    {
      expr1: "1.8 * math.sin(0.9 * x) / (1 + 0.15 * x * x)",
      expr2: "1.6 * math.cos(1.2 * x) * math.exp(-0.12 * abs(x))",
      formula: "\\mathcal{F}\\{\\psi(t)\\} = \\int_{-\\infty}^\\infty \\psi(t) e^{-i \\omega t} dt",
      concept: "Frequency Domain Superposition",
    },
    {
      expr1: "2.0 / (1.0 + math.exp(-1.8 * x)) - 1.0",
      expr2: "x * (1.0 / (1.0 + math.exp(-1.5 * x)))",
      formula: "\\text{SwiGLU}(x) = \\text{Swish}(x W) \\otimes (x V)",
      concept: "Non-linear Gated Activation",
    },
    {
      expr1: "0.25 * (x**3 - 3*x)",
      expr2: "0.75 * (x**2 - 1)",
      formula: "f'(x_0) = 0 \\implies x_0 \\in \\{-1, +1\\}",
      concept: "Critical Points & Bifurcation",
    },
    {
      expr1: "1.8 * math.exp(-0.4 * x * x)",
      expr2: "-1.8 * x * math.exp(-0.4 * x * x)",
      formula: "\\nabla \\mathcal{K}(x, y) = -\\gamma (x - y) k(x, y)",
      concept: "Radial Basis Metric Space",
    },
  ];

  const pick = variants[sceneIndex % variants.length];

  return `def run(scene, theme, brief, budget, beats):
    # Craftsmanship: Geometry before algebra (Continuous Metric Arc)
    scene.add(title_text(theme, "${safeTitle}"))

    axes = Axes(
        x_range=[-4, 4, 1], y_range=[-2.5, 2.5, 1], x_length=9.6, y_length=5.0,
        axis_config={"color": theme.border, "stroke_width": 2.0, "stroke_opacity": 0.25}
    ).shift(DOWN * 0.2)

    curve1 = axes.plot(lambda x: ${pick.expr1}, x_range=[-3.8, 3.8], color=getattr(theme, "blue", theme.accent), stroke_width=5.5)
    curve2 = axes.plot(lambda x: ${pick.expr2}, x_range=[-3.8, 3.8], color=getattr(theme, "gold", theme.accent_alt), stroke_width=5.5)
    focal_dot = Dot(axes.c2p(1.0, 0.8), color=theme.text, radius=0.14)

    b0 = beats[0] if len(beats) > 0 else budget.total // 3
    run_stage(budget, b0, FadeIn(axes), Create(curve1), FadeIn(focal_dot))

    b1 = beats[1] if len(beats) > 1 else budget.total // 3
    badge = info_badge(theme, "${pick.concept}", pos=axes.get_top() + UP * 0.35)
    run_stage(budget, b1, ReplacementTransform(curve1, curve2), FadeIn(badge))

    b2 = beats[2] if len(beats) > 2 else (budget.total - b0 - b1)
    formula = math_text(theme, "${pick.formula.replace(/"/g, '\\"')}", size=0.48).next_to(axes, DOWN, buff=0.22)
    box = accent_box(theme, formula)
    run_stage(budget, b2, FadeIn(formula), Create(box), Indicate(focal_dot, color=getattr(theme, "red", theme.accent)))
    budget.fill()
`;
}

/**
 * Autonomously synthesizes bespoke Manim Python code for a specific scene using LLM,
 * falling back gracefully to domain-matching procedural code if offline.
 */
export async function generateManimSkillCode({
  scene,
  topic,
  theme = "dark",
  beatCount = 3,
  apiKey,
  model = "anthropic/claude-haiku-5.5",
  sceneIndex = 0,
  totalScenes = 1,
}) {
  const proceduralFallback = generateProceduralManimCode({
    title: scene.title || topic,
    voiceover: scene.voiceover || "",
    topic,
    sceneIndex,
    totalScenes,
  });

  const effectiveKey =
    apiKey && apiKey !== "test-key"
      ? apiKey
      : process.env.NODE_ENV !== "test"
        ? process.env.OPENROUTER_API_KEY
        : undefined;

  if (!effectiveKey || !effectiveKey.trim()) {
    return proceduralFallback;
  }

  const prompt = buildManimSkillPrompt({
    scene,
    topic,
    theme,
    beatCount,
    sceneIndex,
    totalScenes,
  });

  try {
    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${effectiveKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:4000",
        "X-Title": "Chalk Frames Manim Skill",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "You are the Autonomous Mathematical Animator. You write production-grade Python code for Manim CE. Output ONLY executable Python code defining `def run(scene, theme, brief, budget, beats):`. No markdown explanations.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 2500,
      }),
      signal: AbortSignal.timeout(45_000),
    });

    if (!resp.ok) {
      console.warn(
        `[MANIM SKILL] OpenRouter responded with ${resp.status}, using domain procedural synthesis`,
      );
      return proceduralFallback;
    }

    const data = await resp.json();
    let code = data.choices?.[0]?.message?.content || "";
    if (Array.isArray(code)) {
      code = code.map((p) => (typeof p === "string" ? p : p?.text || "")).join("");
    }
    if (code.includes("```python")) {
      code = code.split("```python")[1].split("```")[0];
    } else if (code.includes("```")) {
      code = code.split("```")[1].split("```")[0];
    }
    code = code.trim();

    if (code && code.includes("def run(")) {
      return code;
    }
    return proceduralFallback;
  } catch (err) {
    console.warn(
      `[MANIM SKILL] Synthesis failed (${err.message}), using domain procedural synthesis`,
    );
    return proceduralFallback;
  }
}

/**
 * Self-healing repair loop: takes Python compiler / runtime traceback from Manim execution,
 * queries the LLM to inspect the syntax and API misuse, and returns the corrected code.
 */
export async function repairManimSkillCode({
  code,
  error,
  apiKey,
  model = "anthropic/claude-haiku-5.5",
}) {
  const effectiveKey =
    apiKey && apiKey !== "test-key"
      ? apiKey
      : process.env.NODE_ENV !== "test"
        ? process.env.OPENROUTER_API_KEY
        : undefined;

  // No key means no repair. Returning unrelated template code here would hide the failure;
  // the caller decides explicitly (it degrades the scene to its HTML twin).
  if (!effectiveKey || !effectiveKey.trim()) {
    return null;
  }

  const prompt = `The following Manim CE Python script failed with this runtime traceback:

--- TRACEBACK ---
${error}
-----------------

--- FAILING CODE ---
${code}
--------------------

Fix the bug, ensure all Mobjects fit within [-6.5, 6.5] x [-3.5, 3.5], and return ONLY the corrected Python code defining:
def run(scene, theme, brief, budget, beats):
...`;

  try {
    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${effectiveKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:4000",
        "X-Title": "Chalk Frames Manim Skill",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "You are an expert Python Manim animator debugging runtime traceback errors. Return ONLY the corrected Python script without explanations.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!resp.ok) return null;
    const data = await resp.json();
    let fixed = data.choices?.[0]?.message?.content || "";
    if (Array.isArray(fixed)) {
      fixed = fixed.map((p) => (typeof p === "string" ? p : p?.text || "")).join("");
    }
    if (fixed.includes("```python")) {
      fixed = fixed.split("```python")[1].split("```")[0];
    } else if (fixed.includes("```")) {
      fixed = fixed.split("```")[1].split("```")[0];
    }
    return fixed.trim() || null;
  } catch {
    return null;
  }
}
