/**
 * Brief validation for Manim primitives. The director emits JSON data, never Python;
 * everything here is allowlist validation, so a bad brief throws and the caller degrades.
 */

export const MANIM_PRIMITIVE_IDS = [
  "manim-function-plot",
  "manim-vector-transform",
  "manim-network-topology",
  "manim-transformer-block",
  "manim-kv-cache",
  "manim-positional-rope",
  "manim-token-unembedding",
  "manim-residual-stream",
  "manim-temperature-softmax",
  "manim-gradient-descent-3d",
  "manim-backprop-chain",
  "manim-convolution-kernel",
  "manim-svd-transform",
  "manim-latent-manifold",
  "manim-eigen-decomposition",
  "manim-activation-functions",
  "manim-dot-cross-product",
  "manim-hyperplane-separator",
  "manim-basis-change",
  "manim-sorting-visualizer",
  "manim-monte-carlo-pi",
  "manim-markov-chain",
  "manim-bayes-theorem",
];

/** Safe HTML archetypes used when the director gives no usable fallback. */
export const DEFAULT_FALLBACK = {
  "manim-function-plot": "bento-metric-grid",
  "manim-vector-transform": "vector-cluster-graph",
  "manim-network-topology": "vector-cluster-graph",
  "manim-transformer-block": "step-progression",
  "manim-kv-cache": "step-progression",
  "manim-positional-rope": "vector-cluster-graph",
  "manim-token-unembedding": "data-graph",
  "manim-residual-stream": "architecture-pipeline",
  "manim-temperature-softmax": "data-graph",
  "manim-gradient-descent-3d": "vector-cluster-graph",
  "manim-backprop-chain": "flowchart-process",
  "manim-convolution-kernel": "bento-grid",
  "manim-svd-transform": "vector-cluster-graph",
  "manim-latent-manifold": "vector-cluster-graph",
  "manim-eigen-decomposition": "manim-vector-transform",
  "manim-activation-functions": "manim-function-plot",
  "manim-dot-cross-product": "manim-vector-transform",
  "manim-hyperplane-separator": "embedding-similarity-space",
  "manim-basis-change": "manim-vector-transform",
  "manim-sorting-visualizer": "data-graph",
  "manim-monte-carlo-pi": "data-graph",
  "manim-markov-chain": "dag-pipeline",
  "manim-bayes-theorem": "confusion-matrix",
};

const EXPR_IDENTIFIERS = new Set([
  "x",
  "pi",
  "e",
  "sin",
  "cos",
  "tan",
  "exp",
  "log",
  "ln",
  "sqrt",
  "abs",
]);
const MAX_BEATS = 6;

export function isManimPrimitive(id) {
  return MANIM_PRIMITIVE_IDS.includes(id);
}

/**
 * When the director declares engine "manim" but names a non-manim archetype (or none),
 * recover the intended primitive from the SHAPE of its manimData instead of discarding a
 * valid choice. Returns a primitive id or null.
 */
export function inferManimPrimitive(manimData) {
  if (!manimData || typeof manimData !== "object" || Array.isArray(manimData)) return null;
  if (typeof manimData.expr === "string") return "manim-function-plot";
  if (Array.isArray(manimData.matrix)) return "manim-vector-transform";
  if (Array.isArray(manimData.layers) || Array.isArray(manimData.nodes))
    return "manim-network-topology";
  if (manimData.highlight && ["attention", "ffn", "residual"].includes(manimData.highlight))
    return "manim-transformer-block";
  if (Array.isArray(manimData.promptTokens)) return "manim-kv-cache";
  if (manimData.angle1 !== undefined || manimData.angle2 !== undefined)
    return "manim-positional-rope";
  if (Array.isArray(manimData.topTokens)) return "manim-token-unembedding";
  if (Array.isArray(manimData.stages)) return "manim-residual-stream";
  if (Array.isArray(manimData.logits)) return "manim-temperature-softmax";
  if (manimData.steps !== undefined && manimData.momentum !== undefined)
    return "manim-gradient-descent-3d";
  if (Array.isArray(manimData.nodeNames)) return "manim-backprop-chain";
  if (manimData.kernelSize !== undefined) return "manim-convolution-kernel";
  if (Array.isArray(manimData.sigma)) return "manim-svd-transform";
  if (manimData.interpolationSteps !== undefined || manimData.showGeodesic !== undefined)
    return "manim-latent-manifold";
  if (Array.isArray(manimData.eigenvalues)) return "manim-eigen-decomposition";
  if (typeof manimData.functionType === "string") return "manim-activation-functions";
  if (typeof manimData.mode === "string" && (manimData.vectorA || manimData.vectorB))
    return "manim-dot-cross-product";
  if (manimData.marginWidth !== undefined || manimData.showSupportVectors !== undefined)
    return "manim-hyperplane-separator";
  if (Array.isArray(manimData.basis1) && Array.isArray(manimData.basis2))
    return "manim-basis-change";
  if (Array.isArray(manimData.array) && (manimData.algorithm || Array.isArray(manimData.array)))
    return "manim-sorting-visualizer";
  if (manimData.pointCount !== undefined || manimData.targetRatio !== undefined)
    return "manim-monte-carlo-pi";
  if (Array.isArray(manimData.states) && manimData.transitions) return "manim-markov-chain";
  if (manimData.priorA !== undefined || manimData.likelihoodBGivenA !== undefined)
    return "manim-bayes-theorem";
  return null;
}

function text(value, limit = 80) {
  return Array.from(String(value ?? ""), (ch) =>
    ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127 ? " " : ch,
  )
    .join("")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function finite(value, label) {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n))
    throw new Error(`${label} must be a finite number`);
  return n;
}

function pair(value, label, { min = -1000, max = 1000, ordered = false } = {}) {
  if (!Array.isArray(value) || value.length < 2) throw new Error(`${label} must be [a, b]`);
  const a = finite(value[0], label);
  const b = finite(value[1], label);
  if (a < min || a > max || b < min || b > max) throw new Error(`${label} out of range`);
  if (ordered && !(a < b)) throw new Error(`${label} must satisfy a < b`);
  return [a, b];
}

/** Restricted expression grammar check (mirrors py/chalk_manim/expr.py). */
export function validateExpression(src, label = "expr") {
  if (typeof src !== "string" || !src.trim())
    throw new Error(`${label} must be a non-empty string`);
  if (src.length > 200) throw new Error(`${label} is too long`);
  if (!/^[0-9a-zA-Z_+\-*/^().\s]+$/.test(src))
    throw new Error(`${label} contains illegal characters`);
  for (const word of src.match(/[A-Za-z_]+/g) || []) {
    if (!EXPR_IDENTIFIERS.has(word.toLowerCase()))
      throw new Error(`${label} uses unknown name '${word}'`);
  }
  let depth = 0;
  for (const ch of src) {
    if (ch === "(") depth++;
    if (ch === ")" && --depth < 0) throw new Error(`${label} has unbalanced parentheses`);
  }
  if (depth !== 0) throw new Error(`${label} has unbalanced parentheses`);
  return src.trim();
}

function functionPlot(raw) {
  const brief = { title: text(raw.title, 60), expr: validateExpression(raw.expr) };
  brief.xRange = pair(raw.xRange ?? [-5, 5], "xRange", { ordered: true });
  if (raw.expr2 !== undefined) brief.expr2 = validateExpression(raw.expr2, "expr2");
  if (raw.yRange !== undefined) brief.yRange = pair(raw.yRange, "yRange", { ordered: true });
  if (raw.tangentAt !== undefined) brief.tangentAt = finite(raw.tangentAt, "tangentAt");
  if (raw.area !== undefined) brief.area = pair(raw.area, "area", { ordered: true });
  return brief;
}

function vectorTransform(raw) {
  const m = raw.matrix;
  if (
    !Array.isArray(m) ||
    m.length !== 2 ||
    m.some((row) => !Array.isArray(row) || row.length !== 2)
  )
    throw new Error("matrix must be 2x2");
  const brief = {
    title: text(raw.title, 60),
    matrix: m.map((row) => row.map((v) => Math.min(4, Math.max(-4, finite(v, "matrix entry"))))),
    showBasis: raw.showBasis !== false,
  };
  if (raw.vector !== undefined) brief.vector = pair(raw.vector, "vector", { min: -6, max: 6 });
  if (raw.projectOnto !== undefined)
    brief.projectOnto = pair(raw.projectOnto, "projectOnto", { min: -6, max: 6 });
  return brief;
}

function networkTopology(raw) {
  const brief = { title: text(raw.title, 60) };
  if (Array.isArray(raw.nodes)) {
    if (raw.nodes.length < 2 || raw.nodes.length > 12)
      throw new Error("nodes must have 2-12 entries");
    const count = raw.nodes.length;
    brief.nodes = raw.nodes.map((n) => text(n, 12) || "?");
    brief.edges = (Array.isArray(raw.edges) ? raw.edges : [])
      .slice(0, 40)
      .map((e) => [Number(e?.[0]), Number(e?.[1])])
      .filter(
        ([a, b]) =>
          Number.isInteger(a) &&
          Number.isInteger(b) &&
          a !== b &&
          a >= 0 &&
          b >= 0 &&
          a < count &&
          b < count,
      );
    if (brief.edges.length === 0) throw new Error("edges must connect at least one node pair");
    brief.start =
      Number.isInteger(raw.start) && raw.start >= 0 && raw.start < count ? raw.start : 0;
    brief.algorithm = String(raw.algorithm).toLowerCase() === "dfs" ? "dfs" : "bfs";
    return brief;
  }
  if (!Array.isArray(raw.layers) || raw.layers.length < 2 || raw.layers.length > 6)
    throw new Error("layers must have 2-6 entries");
  brief.layers = raw.layers.map((n) => {
    const v = Number(n);
    if (!Number.isInteger(v) || v < 1 || v > 8)
      throw new Error("each layer size must be an integer 1-8");
    return v;
  });
  if (Array.isArray(raw.labels))
    brief.labels = raw.labels.slice(0, brief.layers.length).map((l) => text(l, 18));
  return brief;
}

function transformerBlock(raw) {
  const brief = { title: text(raw.title, 60) };
  if (raw.layers !== undefined) {
    if (!Array.isArray(raw.layers) || raw.layers.length < 2 || raw.layers.length > 7) {
      throw new Error("layers must be an array of 2-7 strings");
    }
    brief.layers = raw.layers.map((l) => text(l, 25));
  } else {
    brief.layers = [
      "Input Embedding",
      "Multi-Head Attention",
      "Add & Norm",
      "Feed Forward",
      "Add & Norm",
    ];
  }
  const h = String(raw.highlight || "attention")
    .toLowerCase()
    .trim();
  brief.highlight = ["attention", "ffn", "residual"].includes(h) ? h : "attention";
  return brief;
}

function kvCache(raw) {
  const brief = { title: text(raw.title, 60) };
  const prompt = Array.isArray(raw.promptTokens) ? raw.promptTokens : ["The", "quick", "brown"];
  if (prompt.length < 1 || prompt.length > 6) {
    throw new Error("promptTokens must have 1-6 entries");
  }
  brief.promptTokens = prompt.map((t) => text(t, 12));

  const generated = Array.isArray(raw.generatedTokens) ? raw.generatedTokens : ["fox", "jumps"];
  if (generated.length < 1 || generated.length > 5) {
    throw new Error("generatedTokens must have 1-5 entries");
  }
  brief.generatedTokens = generated.map((t) => text(t, 12));
  return brief;
}

function positionalRope(raw) {
  const brief = { title: text(raw.title, 60) };
  brief.angle1 = finite(raw.angle1 ?? 30, "angle1");
  brief.angle2 = finite(raw.angle2 ?? 75, "angle2");
  return brief;
}

function tokenUnembedding(raw) {
  const brief = { title: text(raw.title, 60) };
  if (!Array.isArray(raw.topTokens) || raw.topTokens.length < 2 || raw.topTokens.length > 6) {
    throw new Error("topTokens must be an array of 2-6 items");
  }
  brief.topTokens = raw.topTokens.map((item, idx) => {
    if (!item || typeof item !== "object") throw new Error(`topTokens[${idx}] must be an object`);
    return {
      token: text(item.token ?? `T${idx + 1}`, 15),
      prob: Math.max(0, Math.min(1, finite(item.prob ?? 0.2, `topTokens[${idx}].prob`))),
    };
  });
  return brief;
}

function residualStream(raw) {
  const brief = { title: text(raw.title, 60) };
  const stages = Array.isArray(raw.stages)
    ? raw.stages
    : ["Attention 1", "MLP 1", "Attention 2", "MLP 2"];
  if (stages.length < 2 || stages.length > 5) {
    throw new Error("stages must be an array of 2-5 strings");
  }
  brief.stages = stages.map((s) => text(s, 20));
  return brief;
}

function temperatureSoftmax(raw) {
  const brief = { title: text(raw.title, 60) };
  const logits = Array.isArray(raw.logits) ? raw.logits : [2.0, 1.0, 0.5, 3.2];
  if (logits.length < 2 || logits.length > 6) {
    throw new Error("logits must be an array of 2-6 numbers");
  }
  brief.logits = logits.map((val, idx) => finite(val, `logits[${idx}]`));
  brief.temperature = Math.max(0.05, Math.min(10.0, finite(raw.temperature ?? 0.5, "temperature")));
  return brief;
}

function gradientDescent3d(raw) {
  const brief = { title: text(raw.title, 60) };
  brief.steps = Math.max(3, Math.min(8, Math.round(finite(raw.steps ?? 5, "steps"))));
  brief.momentum = Boolean(raw.momentum ?? true);
  return brief;
}

function backpropChain(raw) {
  const brief = { title: text(raw.title, 60) };
  const nodes = Array.isArray(raw.nodeNames) ? raw.nodeNames : ["x, y", "z = x * y", "loss L"];
  if (nodes.length < 2 || nodes.length > 6) {
    throw new Error("nodeNames must be an array of 2-6 strings");
  }
  brief.nodeNames = nodes.map((n) => text(n, 20));
  return brief;
}

function convolutionKernel(raw) {
  const brief = { title: text(raw.title, 60) };
  brief.kernelSize = Math.max(
    2,
    Math.min(3, Math.round(finite(raw.kernelSize ?? 3, "kernelSize"))),
  );
  brief.stride = Math.max(1, Math.min(2, Math.round(finite(raw.stride ?? 1, "stride"))));
  return brief;
}

function svdTransform(raw) {
  const brief = { title: text(raw.title, 60) };
  const sigma = raw.sigma ?? [2.2, 0.8];
  brief.sigma = pair(sigma, "sigma", { min: 0.1, max: 4.0 });
  return brief;
}

function latentManifold(raw) {
  const brief = { title: text(raw.title, 60) };
  brief.interpolationSteps = Math.max(
    3,
    Math.min(8, Math.round(finite(raw.interpolationSteps ?? 5, "interpolationSteps"))),
  );
  brief.showGeodesic = Boolean(raw.showGeodesic ?? true);
  return brief;
}

function eigenDecomposition(raw) {
  const brief = { title: text(raw.title, 60) };
  brief.eigenvalues = pair(raw.eigenvalues ?? [2.0, 0.7], "eigenvalues", { min: 0.1, max: 5.0 });
  brief.showGrid = Boolean(raw.showGrid ?? true);
  return brief;
}

function activationFunctions(raw) {
  const brief = { title: text(raw.title, 60) };
  const ft = String(raw.functionType ?? "gelu").toLowerCase();
  brief.functionType = ["relu", "gelu", "sigmoid", "swiglu"].includes(ft) ? ft : "gelu";
  brief.showDerivative = Boolean(raw.showDerivative ?? false);
  return brief;
}

function dotCrossProduct(raw) {
  const brief = { title: text(raw.title, 60) };
  const m = String(raw.mode ?? "dot").toLowerCase();
  brief.mode = ["dot", "cross"].includes(m) ? m : "dot";
  brief.vectorA = pair(raw.vectorA ?? [2.6, 0.4], "vectorA", { min: -5.0, max: 5.0 });
  brief.vectorB = pair(raw.vectorB ?? [1.2, 1.8], "vectorB", { min: -5.0, max: 5.0 });
  return brief;
}

function hyperplaneSeparator(raw) {
  const brief = { title: text(raw.title, 60) };
  brief.marginWidth = Math.max(0.1, Math.min(2.0, finite(raw.marginWidth ?? 0.6, "marginWidth")));
  brief.showSupportVectors = Boolean(raw.showSupportVectors ?? true);
  return brief;
}

function basisChange(raw) {
  const brief = { title: text(raw.title, 60) };
  brief.basis1 = pair(raw.basis1 ?? [1.5, 0.5], "basis1", { min: -4.0, max: 4.0 });
  brief.basis2 = pair(raw.basis2 ?? [0.4, 1.4], "basis2", { min: -4.0, max: 4.0 });
  return brief;
}

function sortingVisualizer(raw) {
  const brief = { title: text(raw.title, 60) };
  const arr = Array.isArray(raw.array)
    ? raw.array.slice(0, 8).map((x, idx) => finite(x, `array[${idx}]`))
    : [6, 2, 8, 4, 9, 3, 5];
  brief.array = arr;
  const alg = String(raw.algorithm ?? "quicksort").toLowerCase();
  brief.algorithm = ["quicksort", "mergesort"].includes(alg) ? alg : "quicksort";
  return brief;
}

function monteCarloPi(raw) {
  const brief = { title: text(raw.title, 60) };
  brief.pointCount = Math.max(
    10,
    Math.min(100, Math.round(finite(raw.pointCount ?? 36, "pointCount"))),
  );
  brief.targetRatio = Math.max(0.1, Math.min(1.0, finite(raw.targetRatio ?? 0.785, "targetRatio")));
  return brief;
}

function markovChain(raw) {
  const brief = { title: text(raw.title, 60) };
  const states = Array.isArray(raw.states)
    ? raw.states.slice(0, 4).map((s) => text(s, 20))
    : ["State A", "State B", "State C"];
  brief.states = states;
  brief.transitions = Array.isArray(raw.transitions)
    ? raw.transitions
    : [
        [0, 1, 0.7],
        [1, 2, 0.5],
        [2, 0, 0.6],
      ];
  return brief;
}

function bayesTheorem(raw) {
  const brief = { title: text(raw.title, 60) };
  brief.priorA = Math.max(0.01, Math.min(0.99, finite(raw.priorA ?? 0.35, "priorA")));
  brief.likelihoodBGivenA = Math.max(
    0.01,
    Math.min(0.99, finite(raw.likelihoodBGivenA ?? 0.8, "likelihoodBGivenA")),
  );
  return brief;
}

const VALIDATORS = {
  "manim-function-plot": functionPlot,
  "manim-vector-transform": vectorTransform,
  "manim-network-topology": networkTopology,
  "manim-transformer-block": transformerBlock,
  "manim-kv-cache": kvCache,
  "manim-positional-rope": positionalRope,
  "manim-token-unembedding": tokenUnembedding,
  "manim-residual-stream": residualStream,
  "manim-temperature-softmax": temperatureSoftmax,
  "manim-gradient-descent-3d": gradientDescent3d,
  "manim-backprop-chain": backpropChain,
  "manim-convolution-kernel": convolutionKernel,
  "manim-svd-transform": svdTransform,
  "manim-latent-manifold": latentManifold,
  "manim-eigen-decomposition": eigenDecomposition,
  "manim-activation-functions": activationFunctions,
  "manim-dot-cross-product": dotCrossProduct,
  "manim-hyperplane-separator": hyperplaneSeparator,
  "manim-basis-change": basisChange,
  "manim-sorting-visualizer": sortingVisualizer,
  "manim-monte-carlo-pi": monteCarloPi,
  "manim-markov-chain": markovChain,
  "manim-bayes-theorem": bayesTheorem,
};

/** Returns the sanitized brief or throws. */
export function validateManimBrief(primitive, raw) {
  if (!isManimPrimitive(primitive)) throw new Error(`unknown Manim primitive: ${primitive}`);
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new Error("manimData must be an object");
  return VALIDATORS[primitive](raw);
}

/** beats[] -> narration strings (1-6). Accepts strings or { narration | text }. */
export function validateBeats(raw) {
  if (!Array.isArray(raw) || raw.length === 0)
    throw new Error("beats[] is required for Manim scenes");
  const beats = raw
    .slice(0, MAX_BEATS)
    .map((b) => text(typeof b === "string" ? b : (b?.narration ?? b?.text ?? ""), 300))
    .filter(Boolean);
  if (beats.length === 0) throw new Error("beats[] has no narration text");
  return beats;
}

/** Split `total` frames across beats proportional to word count (largest remainder, exact sum). */
export function beatFrames(beats, total) {
  const words = beats.map((b) => Math.max(1, b.split(/\s+/).filter(Boolean).length));
  const sum = words.reduce((a, b) => a + b, 0);
  const raw = words.map((w) => (total * w) / sum);
  const out = raw.map(Math.floor);
  const order = raw.map((r, i) => [r - out[i], i]).sort((a, b) => b[0] - a[0]);
  const missing = total - out.reduce((a, b) => a + b, 0);
  for (let k = 0; k < missing; k++) out[order[k][1]]++;
  return out;
}

/** Generates a safe, fully valid default brief for any Manim primitive. */
export function createDefaultManimBrief(primitive, title = "") {
  const displayTitle = (title && typeof title === "string" ? title.trim() : "").slice(0, 60);
  switch (primitive) {
    case "manim-function-plot":
      return { title: displayTitle || "Function Plot", expr: "x^2 - 2*x", xRange: [-3, 3] };
    case "manim-vector-transform":
      return {
        title: displayTitle || "Linear Transformation",
        matrix: [
          [1.5, 0.5],
          [0.2, 1.2],
        ],
      };
    case "manim-network-topology":
      return { title: displayTitle || "Neural Network", layers: [3, 4, 2] };
    case "manim-transformer-block":
      return { title: displayTitle || "Transformer Attention", highlight: "attention" };
    case "manim-kv-cache":
      return {
        title: displayTitle || "KV Cache Context",
        promptTokens: ["A", "B", "C"],
        generatedTokens: ["D"],
      };
    case "manim-positional-rope":
      return { title: displayTitle || "Rotary Embedding", angle1: 30, angle2: 75 };
    case "manim-token-unembedding":
      return {
        title: displayTitle || "Token Logits",
        topTokens: ["alpha", "beta", "gamma"],
        topLogits: [3.2, 2.1, 1.0],
      };
    case "manim-residual-stream":
      return {
        title: displayTitle || "Residual Stream",
        stages: ["Input", "Attention", "MLP", "Output"],
      };
    case "manim-temperature-softmax":
      return {
        title: displayTitle || "Softmax Temperature",
        logits: [2.0, 1.0, 0.5],
        temperature: 0.7,
      };
    case "manim-gradient-descent-3d":
      return {
        title: displayTitle || "Gradient Descent",
        steps: 5,
        learningRate: 0.1,
        momentum: 0.8,
      };
    case "manim-backprop-chain":
      return {
        title: displayTitle || "Backpropagation",
        nodeNames: ["Loss", "Output", "Hidden", "Input"],
      };
    case "manim-convolution-kernel":
      return { title: displayTitle || "Convolution Kernel", kernelSize: 3 };
    case "manim-svd-transform":
      return { title: displayTitle || "SVD Decomposition", sigma: [3.0, 1.5] };
    case "manim-latent-manifold":
      return { title: displayTitle || "Latent Manifold", interpolationSteps: 4 };
    case "manim-eigen-decomposition":
      return { title: displayTitle || "Eigen Decomposition", eigenvalues: [2.0, 0.5] };
    case "manim-activation-functions":
      return { title: displayTitle || "Activation Function", functionType: "relu" };
    case "manim-dot-cross-product":
      return {
        title: displayTitle || "Vector Operations",
        mode: "dot",
        vectorA: [2, 1],
        vectorB: [1, 2],
      };
    case "manim-hyperplane-separator":
      return { title: displayTitle || "Hyperplane Decision Boundary", marginWidth: 0.8 };
    case "manim-basis-change":
      return {
        title: displayTitle || "Change of Basis",
        basis1: [
          [1, 0],
          [0, 1],
        ],
        basis2: [
          [1, 1],
          [0, 1],
        ],
      };
    case "manim-sorting-visualizer":
      return {
        title: displayTitle || "Sorting Visualizer",
        array: [5, 2, 8, 1, 4],
        algorithm: "quicksort",
      };
    case "manim-monte-carlo-pi":
      return { title: displayTitle || "Monte Carlo Pi", pointCount: 200 };
    case "manim-markov-chain":
      return {
        title: displayTitle || "Markov Chain",
        states: ["State A", "State B"],
        transitions: [
          [0.7, 0.3],
          [0.4, 0.6],
        ],
      };
    case "manim-bayes-theorem":
      return {
        title: displayTitle || "Bayesian Inference",
        priorA: 0.05,
        likelihoodBGivenA: 0.9,
        likelihoodBGivenNotA: 0.1,
      };
    default:
      return { title: displayTitle || "Function Plot", expr: "x^2", xRange: [-3, 3] };
  }
}
