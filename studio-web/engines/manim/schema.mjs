/**
 * Brief validation for Manim primitives. The director emits JSON data, never Python;
 * everything here is allowlist validation, so a bad brief throws and the caller degrades.
 */

export const MANIM_PRIMITIVE_IDS = [
  "manim-function-plot",
  "manim-vector-transform",
  "manim-network-topology",
];

/** Safe HTML archetypes used when the director gives no usable fallback. */
export const DEFAULT_FALLBACK = {
  "manim-function-plot": "bento-metric-grid",
  "manim-vector-transform": "vector-cluster-graph",
  "manim-network-topology": "vector-cluster-graph",
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

const VALIDATORS = {
  "manim-function-plot": functionPlot,
  "manim-vector-transform": vectorTransform,
  "manim-network-topology": networkTopology,
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
