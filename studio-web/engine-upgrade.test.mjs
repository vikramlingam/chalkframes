import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {
  synthesizeFallbackText,
  contentWords,
  NEUTRAL_TOKENS,
  synthesizeFallbackNumber,
} from "./fallbackText.mjs";
import { validateStoryboard } from "./quality.mjs";
import { scheduleStepProgression } from "./renderers.mjs";
import {
  ARCHETYPE_RENDERERS,
  getArchetypeScopedCss,
  buildSceneHtmlAndChoreography,
} from "./server.mjs";

export const TOPICS = [
  { title: "Photosynthesis in Leaves", subtitle: "Plants convert light into stored energy." },
  { title: "Inflation and Interest Rates", subtitle: "Central banks adjust borrowing costs." },
  { title: "Quicksort Partitioning", subtitle: "Pick a pivot and split the array." },
  { title: "Orbital Mechanics", subtitle: "Satellites trade speed for altitude." },
];
export const LEAKY =
  /embed|HNSW|Cosine|Recall|Syntactic|Pruned|Centroid|10M|10x|Autonomous|Deterministic|Dispatcher|Core Engine|Hyperplane|chalkframes|Legacy|Breakthrough|Ingestion|Neural|Puppeteer|Query Vector|Studio One/i;
export const PALETTE = {
  background: "#000",
  text: "#fff",
  accent: "#6366f1",
  card: "#111",
  border: "#222",
};

test("synthesizer derives labels from the scene and falls back to neutral tokens", () => {
  const s = TOPICS[0];
  assert.deepEqual(contentWords(s).slice(0, 3), ["Photosynthesis", "Leaves", "Plants"]);
  assert.equal(synthesizeFallbackText(s, "metric", 0), "Photosynthesis");
  const bare = { title: "A" };
  assert.equal(synthesizeFallbackText(bare, "metric", 0), "Metric A");
  assert.equal(synthesizeFallbackText(bare, "node", 0), "Active Node");
  assert.equal(synthesizeFallbackText(bare, "state", 0), "Observed State");
  assert.equal(synthesizeFallbackText(bare, "target", 0), "Target Value");
  assert.equal(synthesizeFallbackText(bare, "index", 0), "Index");
  assert.equal(synthesizeFallbackNumber(bare, 1), 2, "numbers are structural, never invented");
  assert.equal(synthesizeFallbackNumber({ title: "Top 7 ideas" }, 0), 7);
  assert.ok(NEUTRAL_TOKENS.metric.every((t) => !LEAKY.test(t)));
});

test("every archetype renders with an empty payload and leaks no stock jargon, for any topic", () => {
  const ids = Object.keys(ARCHETYPE_RENDERERS).filter((id) => !id.startsWith("manim-"));
  for (const topic of TOPICS) {
    for (const id of ids) {
      const scene = { id: "s", archetype: id, theme: "dark", ...topic, voiceover: "Narration." };
      const { innerHtml } = buildSceneHtmlAndChoreography(
        scene,
        1,
        4,
        12,
        1920,
        1080,
        false,
        PALETTE,
      );
      const visible = innerHtml.replace(/<[^>]+>/g, " ");
      assert.doesNotMatch(visible, LEAKY, `${id} leaked stock copy for "${topic.title}"`);
    }
  }
});

test("validateStoryboard enrichment is domain-agnostic for every archetype", () => {
  const timing = [
    { id: "a", role: "hook" },
    { id: "b", role: "middle" },
    { id: "c", role: "outro" },
  ];
  const middles = [
    "flowchart-process",
    "kpi-counter-ring",
    "interactive-diff",
    "code-terminal",
    "kinetic-text",
    "radial-orbit",
    "step-ladder",
    "live-feed",
    "isometric-stack",
    "data-graph",
    "bento-grid",
    "quote-callout",
    "chat-exchange",
    "bento-metric-grid",
    "terminal-flow",
    "step-progression",
    "vector-cluster-graph",
  ];
  for (const archetype of middles) {
    const out = validateStoryboard(
      {
        productName: "Topic",
        seed: 3,
        scenes: [
          { archetype: "hook", title: "Hook", voiceover: "Intro." },
          { archetype, ...TOPICS[1], voiceover: "Central banks adjust borrowing costs." },
          { archetype: "outro", title: "End", voiceover: "Bye." },
        ],
      },
      timing,
    );
    assert.doesNotMatch(JSON.stringify(out.scenes[1]), LEAKY, `${archetype} enrichment leaked`);
  }
});

test("scheduleStepProgression paces N items across the narration window", () => {
  const code = scheduleStepProgression("tl", "items", 12, { accent: "#ff0000" });
  const calls = [];
  const tl = { to: (el, vars, t) => calls.push({ el, vars, t }) };
  vm.runInNewContext(code, { tl, items: ["a", "b", "c", "d"], Array });
  const activeAt = calls.filter((c) => c.vars.scale === 1.04).map((c) => c.t);
  const dt = (12 - 1.5) / 4;
  assert.equal(activeAt.length, 4);
  activeAt.forEach((t, i) => assert.ok(Math.abs(t - (0.8 + i * dt)) < 1e-6, `item ${i} at ${t}`));
  assert.ok(activeAt[3] > 8, "last item activates late in the scene, not in the first second");
  assert.equal(calls.filter((c) => c.vars.scale === 1).length, 3, "earlier items settle");
});

test("generated choreography runs and schedules tweens for sequential archetypes", () => {
  const ids = [
    "step-progression",
    "terminal-flow",
    "bento-metric-grid",
    "step-ladder",
    "features-cards",
  ];
  for (const id of ids) {
    const scene = { id: "s2", archetype: id, theme: "dark", ...TOPICS[2], voiceover: "x" };
    const { gsapChoreography } = buildSceneHtmlAndChoreography(
      scene,
      1,
      4,
      14,
      1920,
      1080,
      false,
      PALETTE,
    );
    let tweens = 0;
    const timeline = new Proxy(
      {},
      {
        get: (_t, prop) =>
          prop === "then"
            ? undefined
            : () => {
                tweens++;
                return timeline;
              },
      },
    );
    const scope = { querySelector: () => ({}), querySelectorAll: () => [{}, {}, {}] };
    const script = `(function(){ const tl = TL; const scope = SCOPE; const sDur = 14; ${gsapChoreography} })()`;
    assert.doesNotThrow(
      () => vm.runInNewContext(script, { TL: timeline, SCOPE: scope, Array, Math }),
      `${id} choreography threw`,
    );
    assert.ok(tweens >= 6, `${id} scheduled only ${tweens} tweens`);
  }
});

test("layout contract: split rails, bounded grids and type-size floors", () => {
  const css = (id, portrait = false) =>
    getArchetypeScopedCss({ id: "s", archetype: id, theme: "dark" }, 1920, 1080, portrait, PALETTE);
  const tf = css("terminal-flow");
  assert.match(tf, /\.tf-left \{ flex: 0 0 37%/);
  assert.match(tf, /\.tf-right \{[^}]*min-height: 560px/);
  assert.match(tf, /\.tf-terminal \{[^}]*min-height: 560px/);
  const vc = css("vector-cluster-graph");
  assert.match(vc, /\.vc-left-col \{ flex: 0 0 37%/);
  assert.match(vc, /\.vc-right-canvas \{[^}]*min-height: 560px/);
  for (const id of ["step-progression", "features-cards", "bento-metric-grid", "step-ladder"]) {
    assert.match(css(id), /min\(1400px, 85vw\)/, `${id} grid must be bounded`);
  }
  assert.match(css("step-progression"), /\.sp-card \{[^}]*padding: 32px 24px/);
  const floors = [
    ["terminal-flow", "tf-line", 20],
    ["terminal-flow", "tf-out", 18],
    ["step-progression", "sp-caption", 20],
    ["step-ladder", "step-desc", 20],
  ];
  for (const [arch, cls, floor] of floors) {
    const m = css(arch).match(new RegExp(`\\.${cls} \\{[^}]*font-size: (\\d+)px`));
    assert.ok(m && Number(m[1]) >= floor, `.${cls} font-size ${m?.[1]} < ${floor}px`);
  }
});

test("a valid director engine:'manim' choice survives validation; failures log a reason", () => {
  const timing = ["hook", "m", "m", "m", "m", "outro"].map((role, i) => ({ id: `s${i}`, role }));
  const filler = (a, t) => ({ archetype: a, title: t, voiceover: t });
  const base = {
    title: "Gradient descent",
    voiceover: "x",
    manimData: { title: "t", expr: "x^2", xRange: [-2, 2] },
    beats: ["One two three.", "Four five."],
    fallbackArchetype: "bento-metric-grid",
    fallbackPayload: { bentoData: { metrics: [{ label: "A", value: 1, unit: "", hero: true }] } },
  };
  const build = (scene) => ({
    productName: "T",
    seed: 2,
    scenes: [
      filler("hook", "H"),
      scene,
      filler("kinetic-text", "K"),
      filler("stat-spotlight", "S"),
      filler("step-ladder", "L"),
      filler("outro", "O"),
    ],
  });
  const on = { manimEnabled: true };
  const ok = validateStoryboard(
    build({ ...base, engine: "manim", archetype: "manim-function-plot" }),
    timing,
    on,
  );
  assert.equal(ok.scenes[1].engine, "manim");
  assert.equal(ok.scenes[1].archetype, "manim-function-plot");

  const recovered = validateStoryboard(
    build({ ...base, engine: "manim", archetype: "function-graph-thing" }),
    timing,
    on,
  );
  assert.equal(recovered.scenes[1].engine, "manim", "recovered from the manimData shape");
  assert.equal(recovered.scenes[1].archetype, "manim-function-plot");

  const warnings = [];
  const orig = console.warn;
  console.warn = (m) => warnings.push(String(m));
  try {
    const badScene = {
      ...base,
      engine: "manim",
      archetype: "manim-function-plot",
      manimData: { expr: "__import__('os')", xRange: [0, 1] },
    };
    const bad = validateStoryboard(build(badScene), timing, on);
    assert.equal(bad.scenes[1].engine, "html-gsap");
    assert.equal(bad.scenes[1].degraded, true);
  } finally {
    console.warn = orig;
  }
  assert.ok(
    warnings.some((w) => /\[DEGRADE REASON: Scene 2: invalid manimData/.test(w)),
    warnings.join("\n"),
  );
});

test("Batch 2: all 15 modern AI & Systems HTML archetypes render cleanly in landscape and portrait", () => {
  const newArchetypes = [
    "rag-retrieval-pipeline",
    "agent-scratchpad",
    "prompt-budget-canvas",
    "embedding-similarity-space",
    "tool-calling-schema",
    "context-window-gauge",
    "eval-benchmark-matrix",
    "data-lineage-flow",
    "microservice-mesh",
    "database-shard-map",
    "memory-layout-stack",
    "dag-pipeline",
    "event-bus-pubsub",
    "compiler-ast",
    "raft-consensus",
  ];

  for (const id of newArchetypes) {
    assert.ok(ARCHETYPE_RENDERERS[id], `Renderer for ${id} must be registered`);

    for (const isPortrait of [false, true]) {
      const scene = {
        id: `test-${id}`,
        archetype: id,
        title: "Distributed Transformer Consensus",
        subtitle: "Analyzing semantic memory layout and pipeline efficiency.",
        voiceover: "Detailed walkthrough of modern architecture.",
      };

      const { innerHtml, gsapChoreography } = buildSceneHtmlAndChoreography(
        scene,
        1,
        5,
        10.5,
        isPortrait ? 1080 : 1920,
        isPortrait ? 1920 : 1080,
        isPortrait,
        PALETTE,
      );

      assert.ok(innerHtml.length > 100, `${id} innerHtml must not be trivial`);
      assert.ok(innerHtml.includes("scene-inner"), `${id} must contain .scene-inner`);
      assert.ok(gsapChoreography.includes("tl."), `${id} must register tweens on tl`);

      const css = getArchetypeScopedCss(
        scene,
        isPortrait ? 1080 : 1920,
        isPortrait ? 1920 : 1080,
        isPortrait,
        PALETTE,
      );
      assert.ok(css.includes(`[data-composition-id="${scene.id}"]`), `${id} CSS must be scoped`);
    }
  }
});

test("Batch 3: all 15 Technical Product, UX, and Quantitative HTML archetypes render cleanly in landscape and portrait", () => {
  const batch3Archetypes = [
    "git-branch-graph",
    "browser-devtools",
    "security-threat-model",
    "kanban-sprint",
    "changelog-timeline",
    "circuit-breaker-status",
    "rate-limiter-bucket",
    "audit-log-stream",
    "confusion-matrix",
    "quantile-distribution",
    "radar-capability",
    "sankey-cost-flow",
    "cohort-retention-grid",
    "multi-metric-dashboard",
    "ab-test-confidence",
  ];

  for (const id of batch3Archetypes) {
    assert.ok(ARCHETYPE_RENDERERS[id], `Renderer for ${id} must be registered`);

    for (const isPortrait of [false, true]) {
      const scene = {
        id: `test-${id}`,
        archetype: id,
        title: "Product Telemetry & Verification",
        subtitle: "Analyzing metric reliability and execution speed.",
        voiceover: "Detailed overview of operational capability.",
      };

      const { innerHtml, gsapChoreography } = buildSceneHtmlAndChoreography(
        scene,
        1,
        5,
        10.5,
        isPortrait ? 1080 : 1920,
        isPortrait ? 1920 : 1080,
        isPortrait,
        PALETTE,
      );

      assert.ok(innerHtml.length > 100, `${id} innerHtml must not be trivial`);
      assert.ok(innerHtml.includes("scene-inner"), `${id} must contain .scene-inner`);
      assert.ok(gsapChoreography.includes("tl."), `${id} must register tweens on tl`);

      const css = getArchetypeScopedCss(
        scene,
        isPortrait ? 1080 : 1920,
        isPortrait ? 1920 : 1080,
        isPortrait,
        PALETTE,
      );
      assert.ok(css.includes(`[data-composition-id="${scene.id}"]`), `${id} CSS must be scoped`);
    }
  }
});
