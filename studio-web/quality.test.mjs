import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseVideoRange,
  validateStoryboard,
  validateProductionInput,
  validateTopicInput,
  isPublicAddress,
  normalizeArchetype,
  auditAndDegradeManimScenes,
  isMathematicalStoryboard,
  ARCHETYPE_FAMILY,
} from "./quality.mjs";
import {
  getSceneTimingStructure,
  registerArchetype,
  registerArchetypeRenderer,
  formatCatalogForPrompt,
  buildSceneHtmlAndChoreography,
  getArchetypeScopedCss,
  buildDirectorPrompt,
  parseStoryboardYamlOrJson,
  parseStoryboardJson,
  formatStoryboardYaml,
  formatStoryboardMarkdown,
} from "./server.mjs";
import { formatCompactMetric } from "./renderers.mjs";
import { DEFAULT_3B1B_PALETTE, sanitizePalette } from "./engines/manim/planner.mjs";

const timing = [
  { id: "scene1-hook", role: "hook" },
  { id: "scene2-outro", role: "outro" },
];
const storyboard = () => ({
  productName: "Brand <script>alert(1)</script>",
  scenes: [
    {
      id: "../../escape",
      archetype: "hook",
      title: '<img src=x onerror="evil()">',
      voiceover: "Narrate <exactly>",
    },
    { id: "other", archetype: "outro", title: "End", voiceover: "Done.", pills: ["Fast & easy"] },
  ],
});

test("DNS address filtering refuses private, loopback, metadata and mapped IPv4", () => {
  for (const address of [
    "127.0.0.1",
    "10.0.0.1",
    "192.168.1.2",
    "169.254.169.254",
    "172.16.0.2",
    "0.0.0.0",
    "100.64.0.1",
    "::1",
    "fc00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
  ]) {
    assert.equal(isPublicAddress(address), false, address);
  }
  for (const address of ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"]) {
    assert.equal(isPublicAddress(address), true, address);
  }
});

test("valid, suffix and open-ended byte ranges", () => {
  assert.deepEqual(parseVideoRange("bytes=0-100", 1000), { start: 0, end: 100 });
  assert.deepEqual(parseVideoRange("bytes=990-", 1000), { start: 990, end: 999 });
  assert.deepEqual(parseVideoRange("bytes=-500", 1000), { start: 500, end: 999 });
  assert.deepEqual(parseVideoRange("bytes=-2000", 1000), { start: 0, end: 999 });
  assert.deepEqual(parseVideoRange("bytes=0-999999", 1000), { start: 0, end: 999 });
});

test("invalid and unsafe byte ranges are refused", () => {
  for (const range of [
    "bytes=abc-def",
    "bytes=",
    "bytes=-0",
    "bytes=1000-",
    "bytes=10-9",
    "bytes=999999999999999999999999-",
    "bytes=0-1,3-4",
    "items=0-10",
    "bytes=1.5-9",
  ]) {
    assert.equal(parseVideoRange(range, 1000), null, range);
  }
  assert.equal(parseVideoRange("bytes=0-", 0), null);
});

test("storyboard forces safe IDs, escapes all display strings, preserves narration", () => {
  const result = validateStoryboard(storyboard(), timing);
  assert.equal(result.scenes[0].id, "scene1-hook");
  assert.equal(result.scenes[1].id, "scene2-outro");
  assert.equal(result.scenes[0].title, "&lt;img src=x onerror=&quot;evil()&quot;&gt;");
  assert.equal(result.scenes[0].voiceover, "Narrate <exactly>");
  assert.equal(result.scenes[1].pills[0], "Fast &amp; easy");
  assert.ok(!result.productName.includes("<script>"));
});

test("malformed director replies fail before TTS or filesystem work", () => {
  assert.throws(() => validateStoryboard({ scenes: [] }, timing), /expected 2 scenes/);
  const bad = storyboard();
  bad.scenes[0].voiceover = "";
  assert.throws(() => validateStoryboard(bad, timing), /narration/);
  const badChart = storyboard();
  badChart.scenes[0].chartData = { bars: [{ height: '10; background:url("evil")' }] };
  assert.throws(() => validateStoryboard(badChart, timing), /chart heights/);
  const badList = storyboard();
  badList.scenes[1].pills = [1];
  assert.throws(() => validateStoryboard(badList, timing), /text list/);
});

test("archetypes with object arrays (step-ladder, radial-orbit, live-feed, isometric-stack) validate cleanly", () => {
  const customTiming = [
    { id: "scene1-hook", role: "hook" },
    { id: "scene2-step", role: "feature" },
    { id: "scene3-orbit", role: "feature" },
    { id: "scene4-feed", role: "feature" },
    { id: "scene5-stack", role: "feature" },
    { id: "scene6-outro", role: "outro" },
  ];
  const complexStoryboard = {
    productName: "Neural Engine",
    scenes: [
      { id: "s1", archetype: "hook", title: "Intro", voiceover: "Welcome to the future." },
      {
        id: "s2",
        archetype: "step-ladder",
        title: "Process",
        voiceover: "Here is the step by step process.",
        stepData: {
          steps: [
            { stepNumber: "01", title: "Init", desc: "Start pipeline", status: "Active" },
            { stepNumber: "02", title: "Execute", desc: "Run models", status: "Done" },
          ],
        },
      },
      {
        id: "s3",
        archetype: "radial-orbit",
        title: "Ecosystem",
        voiceover: "Our orbiting system.",
        orbitData: {
          centerTitle: "Core",
          centerSub: "Hub",
          satellites: [{ label: "Node A", desc: "First node" }],
        },
      },
      {
        id: "s4",
        archetype: "live-feed",
        title: "Activity",
        voiceover: "Live stream of operations.",
        feedData: {
          items: [{ icon: "⚡", text: "Execution complete", tag: "Fast", status: "OK" }],
        },
      },
      {
        id: "s5",
        archetype: "isometric-stack",
        title: "Architecture",
        voiceover: "The layered hierarchy.",
        stackData: {
          layers: [{ name: "UI", tech: "DOM", role: "Surface" }],
        },
      },
      {
        id: "s6",
        archetype: "outro",
        title: "Conclusion",
        voiceover: "Get started today.",
        pills: ["Reliable", "Fast"],
        cta: "Try Now",
      },
    ],
  };

  const validated = validateStoryboard(complexStoryboard, customTiming);
  assert.equal(validated.scenes.length, 6);
  assert.equal(validated.scenes[1].archetype, "step-ladder");
  assert.equal(validated.scenes[1].stepData.steps[0].title, "Init");
  assert.equal(validated.scenes[2].archetype, "radial-orbit");
  assert.equal(validated.scenes[3].archetype, "live-feed");
  assert.equal(validated.scenes[4].archetype, "isometric-stack");
});

test("invalid source and duration fail before a job is admitted", () => {
  for (const input of [
    {},
    { sourcePdf: "" },
    { sourceScript: " " },
    { sourceUrl: "https://example.com", duration: 601 },
    { sourceUrl: "https://example.com", duration: 1000 },
    { sourceUrl: "https://example.com", duration: "nan" },
  ]) {
    assert.throws(() => validateProductionInput(input));
  }
  assert.throws(() => validateProductionInput({ sourceScript: "hello", duration: 30 }), /API key/);
  assert.equal(
    validateProductionInput({ sourceScript: "hello", duration: 30, apiKey: "test" }).duration,
    30,
  );
  assert.equal(
    validateProductionInput({ sourceTopic: "Quantum Physics", duration: 45, apiKey: "test" })
      .duration,
    45,
  );
  assert.equal(
    validateProductionInput({ sourceTopic: "Quantum Physics", duration: 600, apiKey: "test" })
      .duration,
    600,
  );
});

test("topic input validation requires topic text and valid duration (max 600s)", () => {
  for (const bad of [
    {},
    { topic: "" },
    { topic: "   " },
    { topic: 123 },
    { topic: "Valid topic", duration: 5 },
    { topic: "Valid topic", duration: 601 },
    { topic: "Valid topic", apiKey: "" },
  ]) {
    assert.throws(() => validateTopicInput(bad));
  }
  const good = validateTopicInput({
    topic: "Human Anatomy: The Circulatory System",
    duration: 60,
    apiKey: "test-key",
  });
  assert.equal(good.topic, "Human Anatomy: The Circulatory System");
  assert.equal(good.duration, 60);
});

test("new visual variety archetypes (flowchart-process, kpi-counter-ring, interactive-diff, chat-exchange) validate cleanly", () => {
  const varietyTiming = [
    { id: "scene1-hook", role: "hook" },
    { id: "scene2-flow", role: "features" },
    { id: "scene3-kpi", role: "features" },
    { id: "scene4-diff", role: "features" },
    { id: "scene5-chat", role: "features" },
    { id: "scene6-outro", role: "outro" },
  ];

  const storyboardData = {
    productName: "NeuralEngine",
    scenes: [
      {
        id: "s1",
        archetype: "hook",
        title: "The Problem",
        voiceover: "Here is the starting friction.",
      },
      {
        id: "s2",
        archetype: "flowchart-process",
        title: "Ingestion Pipeline",
        voiceover: "Signals flow sequentially through four stages.",
        flowData: {
          steps: [
            {
              stepNumber: "01",
              title: "Capture",
              desc: "Edge sensory collection",
              isHighlighted: false,
            },
            {
              stepNumber: "02",
              title: "Quantize",
              desc: "FP8 tensor reduction",
              isHighlighted: true,
            },
            {
              stepNumber: "03",
              title: "Dispatch",
              desc: "Non-blocking ring bus",
              isHighlighted: false,
            },
          ],
        },
      },
      {
        id: "s3",
        archetype: "kpi-counter-ring",
        title: "Throughput Multiplier",
        voiceover: "Throughput scaled exponentially under real-world loads.",
        kpiData: {
          value: "1,420%",
          label: "Throughput Increase",
          trend: "+84% YoY",
          progress: 88,
          subtitle: "Measured on production clusters",
        },
      },
      {
        id: "s4",
        archetype: "interactive-diff",
        title: "Architectural Shift",
        voiceover: "Legacy blocking locks were replaced by lock-free atomics.",
        diffData: {
          titleLeft: "Legacy Stack",
          badgeLeft: "Deprecated",
          linesLeft: ["Blocking mutex locks", "Thread contention", "High latency jitter"],
          titleRight: "Modern Engine",
          badgeRight: "Optimized",
          linesRight: ["Lock-free atomics", "Zero-copy streaming", "Sub-millisecond p99"],
        },
      },
      {
        id: "s5",
        archetype: "chat-exchange",
        title: "Autonomous Negotiation",
        voiceover: "Nodes negotiate distributed consensus in under two milliseconds.",
        chatData: {
          channelName: "Live Cluster Dispatch",
          messages: [
            {
              sender: "Node Alpha",
              text: "Proposing block #49281 with 12k txs",
              isAi: false,
              time: "12:00:01",
            },
            {
              sender: "Validator",
              text: "Quorum verified in 1.2ms. Block committed.",
              isAi: true,
              time: "12:00:02",
            },
          ],
        },
      },
      {
        id: "s6",
        archetype: "outro",
        title: "Summary",
        voiceover: "Transform your pipeline today.",
        pills: ["Fast", "Deterministic"],
        cta: "Deploy Now",
      },
    ],
  };

  const result = validateStoryboard(storyboardData, varietyTiming);
  assert.equal(result.scenes.length, 6);
  assert.equal(result.scenes[1].archetype, "flowchart-process");
  assert.equal(result.scenes[1].flowData.steps[0].title, "Capture");
  assert.equal(result.scenes[2].archetype, "kpi-counter-ring");
  assert.equal(result.scenes[2].kpiData.value, "1,420%");
  assert.equal(result.scenes[3].archetype, "interactive-diff");
  assert.equal(result.scenes[3].diffData.linesLeft.length, 3);
  assert.equal(result.scenes[4].archetype, "chat-exchange");
  assert.equal(result.scenes[4].chatData.messages.length, 2);
});

test("repetitive or generic archetypes are automatically diversified across distinct archetypes", () => {
  const genericTiming = [
    { id: "scene1-hook", role: "hook", suggestedArchetype: "hook" },
    { id: "scene2-feat", role: "features", suggestedArchetype: "kinetic-text" },
    { id: "scene3-feat", role: "features", suggestedArchetype: "flowchart-process" },
    { id: "scene4-feat", role: "features", suggestedArchetype: "kpi-counter-ring" },
    { id: "scene5-feat", role: "features", suggestedArchetype: "code-terminal" },
    { id: "scene6-outro", role: "outro", suggestedArchetype: "outro" },
  ];

  // Simulated LLM outputting repetitive "features" archetype for all middle scenes
  const repetitiveStoryboard = {
    productName: "ChalkFrames",
    scenes: [
      { id: "s1", archetype: "hook", title: "Intro", voiceover: "Welcome to the video." },
      {
        id: "s2",
        archetype: "features",
        title: "Core Paradigm",
        voiceover: "A fundamental shift.",
      },
      { id: "s3", archetype: "features", title: "Pipeline Flow", voiceover: "How data flows." },
      { id: "s4", archetype: "features", title: "Throughput Gains", voiceover: "Massive speedup." },
      { id: "s5", archetype: "features", title: "Developer APIs", voiceover: "Clean interfaces." },
      { id: "s6", archetype: "outro", title: "Outro", voiceover: "Get started today." },
    ],
  };

  const result = validateStoryboard(repetitiveStoryboard, genericTiming);
  assert.equal(result.scenes.length, 6);
  assert.equal(result.scenes[0].archetype, "hook");
  assert.equal(result.scenes[1].archetype, "kinetic-text");
  assert.equal(result.scenes[2].archetype, "flowchart-process");
  assert.equal(result.scenes[3].archetype, "kpi-counter-ring");
  assert.equal(result.scenes[4].archetype, "code-terminal");
  assert.equal(result.scenes[5].archetype, "outro");

  // Verify that enriched fallback data was generated for the diversified archetypes
  assert.ok(result.scenes[1].kineticData.mainWord);
  assert.ok(result.scenes[2].flowData.steps.length >= 3);
  assert.ok(result.scenes[3].kpiData.value);
  assert.ok(result.scenes[4].codeDemo.lines.length >= 3);

  // Verify that NO two consecutive scenes share the same archetype
  for (let i = 1; i < result.scenes.length; i++) {
    assert.notEqual(result.scenes[i].archetype, result.scenes[i - 1].archetype);
  }
});

test("normalizeArchetype maps diverse LLM keywords to correct non-default archetypes", () => {
  // Test that synonyms and common LLM outputs don't fall back to features-cards
  assert.equal(normalizeArchetype("hero-title"), "kinetic-text");
  assert.equal(normalizeArchetype("headline-announcement"), "kinetic-text");
  assert.equal(normalizeArchetype("analytics-dashboard"), "bento-grid");
  assert.equal(normalizeArchetype("system-overview-panel"), "bento-grid");
  assert.equal(normalizeArchetype("execution-workflow"), "flowchart-process");
  assert.equal(normalizeArchetype("biological-diagram"), "flowchart-process");
  assert.equal(normalizeArchetype("infographic-trends"), "data-graph");
  assert.equal(normalizeArchetype("analytics-bars"), "data-graph");
  assert.equal(normalizeArchetype("user-conversation"), "chat-exchange");
  assert.equal(normalizeArchetype("ai-agent-message"), "chat-exchange");
  assert.equal(normalizeArchetype("quarterly-roadmap"), "step-ladder");
  assert.equal(normalizeArchetype("multi-phase-timeline"), "step-ladder");
  assert.equal(normalizeArchetype("deep-dive-infrastructure"), "isometric-stack");
  assert.equal(normalizeArchetype("side-by-side-comparison"), "split-comparison");
  assert.equal(normalizeArchetype("orbital-network"), "radial-orbit");
  assert.equal(normalizeArchetype("bash-command-terminal"), "code-terminal");
  assert.equal(normalizeArchetype("gauge-counter"), "kpi-counter-ring");
  assert.equal(normalizeArchetype("3d-carousel"), "carousel-3d-showcase");
  assert.equal(normalizeArchetype("cylindrical-carousel"), "carousel-3d-showcase");
  assert.equal(normalizeArchetype("3d-hero"), "3d-motion-hero");
  assert.equal(normalizeArchetype("webgl-hero"), "3d-motion-hero");
  assert.equal(normalizeArchetype("code-slice"), "code-slice-reveal");
  assert.equal(normalizeArchetype("diff-reveal"), "code-slice-reveal");
});

test("new spatial 3D, carousel, and code slice archetypes validate cleanly and diversify properly", () => {
  // Spatial-3d family archetypes are separated by different families to respect family diversity
  const customTiming = [
    { id: "scene1-hook", role: "hook" },
    { id: "scene2-hero3d", role: "feature" },
    { id: "scene3-code", role: "feature" },
    { id: "scene4-carousel", role: "feature" },
    { id: "scene5-kpi", role: "feature" },
    { id: "scene6-outro", role: "outro" },
  ];
  const customStoryboard = {
    productName: "Spatial Intelligence",
    scenes: [
      { id: "s1", archetype: "hook", title: "Intro", voiceover: "Welcome to spatial compute." },
      {
        id: "s2",
        archetype: "3d-motion-hero",
        title: "3D Core",
        voiceover: "Geometric architecture.",
      },
      {
        id: "s3",
        archetype: "code-slice-reveal",
        title: "Execution",
        voiceover: "Under the hood code slice.",
      },
      {
        id: "s4",
        archetype: "carousel-3d-showcase",
        title: "Feature Ring",
        voiceover: "Orbiting feature modules.",
      },
      {
        id: "s5",
        archetype: "kpi-counter-ring",
        title: "Throughput",
        voiceover: "Key performance metrics.",
      },
      { id: "s6", archetype: "outro", title: "Conclusion", voiceover: "Build with us today." },
    ],
  };

  const result = validateStoryboard(customStoryboard, customTiming);
  assert.equal(result.scenes.length, 6);
  assert.equal(result.scenes[1].archetype, "3d-motion-hero");
  assert.equal(result.scenes[2].archetype, "code-slice-reveal");
  assert.equal(result.scenes[3].archetype, "carousel-3d-showcase");
  assert.ok(result.scenes[1].hero3dData.mainTitle);
  assert.ok(result.scenes[2].sliceData.lines.length >= 3);
  assert.ok(result.scenes[3].carouselData.items.length >= 3);

  // Consecutive scene archetypes AND families must be distinct
  for (let i = 1; i < result.scenes.length; i++) {
    assert.notEqual(result.scenes[i].archetype, result.scenes[i - 1].archetype);
  }
  // Family diversity: no two consecutive middle scenes share a family
  const middleFamilies = result.scenes.slice(1, -1).map((s) => ARCHETYPE_FAMILY[s.archetype]);
  for (let i = 1; i < middleFamilies.length; i++) {
    assert.notEqual(
      middleFamilies[i],
      middleFamilies[i - 1],
      `Middle scenes ${i} and ${i + 1} must not share family "${middleFamilies[i]}"`,
    );
  }
});

test("getSceneTimingStructure generates diverse non-repetitive narrative beats across durations and seeds", () => {
  // 30s video (4 scenes: hook, 2 middle, outro)
  const timing30 = getSceneTimingStructure(30, 42);
  assert.equal(timing30.length, 4);
  assert.equal(timing30[0].role, "hook");
  assert.equal(timing30[3].role, "outro");
  assert.notEqual(timing30[1].narrativeIntent, timing30[2].narrativeIntent);

  // 60s video (5 scenes: hook, 3 middle, outro)
  const timing60 = getSceneTimingStructure(60, 42);
  assert.equal(timing60.length, 5);
  const middle60 = [timing60[1].role, timing60[2].role, timing60[3].role];
  const unique60 = new Set(middle60);
  assert.equal(unique60.size, 3, "All 3 middle scenes must have distinct roles");

  // Different seeds produce different middle themes (narrative variety across regenerations)
  const timing60A = getSceneTimingStructure(60, "seed-alpha");
  const timing60B = getSceneTimingStructure(60, "seed-beta");
  const setA = timing60A
    .slice(1, 4)
    .map((s) => s.chapterTitle)
    .join(",");
  const setB = timing60B
    .slice(1, 4)
    .map((s) => s.chapterTitle)
    .join(",");
  assert.notEqual(setA, setB, "Different seeds should rotate middle themes differently");
});

test("validateStoryboard respects explicit seeds and rotates archetypes cleanly", () => {
  const genericTiming = [
    { id: "s1", role: "hook", suggestedArchetype: "hook" },
    { id: "s2", role: "middle" },
    { id: "s3", role: "middle" },
    { id: "s4", role: "middle" },
    { id: "s5", role: "outro", suggestedArchetype: "outro" },
  ];

  const storyboardA = {
    productName: "TestProduct",
    seed: "run-1",
    scenes: [
      { id: "s1", archetype: "hook", title: "A", voiceover: "Voice." },
      { id: "s2", archetype: "features", title: "B", voiceover: "Voice." },
      { id: "s3", archetype: "features", title: "C", voiceover: "Voice." },
      { id: "s4", archetype: "features", title: "D", voiceover: "Voice." },
      { id: "s5", archetype: "outro", title: "E", voiceover: "Voice." },
    ],
  };

  const storyboardB = {
    ...storyboardA,
    seed: "run-2",
  };

  const resA = validateStoryboard(storyboardA, genericTiming);
  const resB = validateStoryboard(storyboardB, genericTiming);

  // Both should have non-repeating middle archetypes
  assert.notEqual(resA.scenes[1].archetype, resA.scenes[2].archetype);
  assert.notEqual(resA.scenes[2].archetype, resA.scenes[3].archetype);

  // Different seeds should produce different selections
  const archsA = resA.scenes.map((s) => s.archetype).join(",");
  const archsB = resB.scenes.map((s) => s.archetype).join(",");
  assert.notEqual(archsA, archsB, "Different seed entropy must vary the selected archetypes");
});

test("adding a new test archetype to the catalog flows end-to-end from prompt to HTML generator without being normalized away", () => {
  // 1. Register a brand new archetype in the dynamic catalog
  registerArchetype("custom-matrix-view", {
    description: "Multi-dimensional feature comparison matrix",
    family: "comparative",
  });

  // 2. Register pluggable HTML and CSS renderers
  registerArchetypeRenderer("custom-matrix-view", {
    renderHtml: ({ scene, h }) => ({
      innerHtml: `<div class="matrix-grid"><h3>${h(scene.title)}</h3><div class="matrix-val">${h(scene.matrixMetric)}</div></div>`,
      gsapChoreography: `tl.from(".matrix-grid", { opacity: 0, y: 30, duration: 0.8 });`,
    }),
    renderCss: ({ activePalette }) => `
      .matrix-grid { border: 2px solid ${activePalette.accent}; padding: 20px; }
      .matrix-val { font-size: 28px; font-weight: bold; }
    `,
    getBackground: ({ activePalette }) => `background: ${activePalette.background};`,
  });

  // 3. Verify it is immediately exposed in the LLM prompt catalog
  const formattedPrompt = formatCatalogForPrompt();
  assert.match(
    formattedPrompt,
    /"custom-matrix-view": Multi-dimensional feature comparison matrix/,
    "Catalog prompt format must expose newly registered archetype",
  );

  // 4. Verify normalizeArchetype matches it directly and does NOT fallback to features-cards
  const normalized = normalizeArchetype("custom-matrix-view");
  assert.equal(normalized, "custom-matrix-view");

  // 5. Verify storyboard validation preserves custom archetype and custom payload data
  const customStoryboard = {
    productName: "MatrixEngine",
    scenes: [
      {
        id: "s1",
        archetype: "custom-matrix-view",
        title: "Matrix Insights",
        voiceover: "Real-time multidimensional matrix insights.",
        matrixMetric: "99.98% High Precision",
        customConfig: { dimensions: 4 },
      },
    ],
  };

  const validated = validateStoryboard(customStoryboard, [{ id: "s1", role: "middle" }]);
  assert.equal(validated.scenes[0].archetype, "custom-matrix-view");
  assert.equal(validated.scenes[0].matrixMetric, "99.98% High Precision");
  assert.deepEqual(validated.scenes[0].customConfig, { dimensions: 4 });

  // 6. Verify HTML/CSS generation dispatches cleanly to the custom renderer
  const palette = {
    background: "#0c0d10",
    text: "#ffffff",
    accent: "#6366f1",
    border: "rgba(255,255,255,0.1)",
  };
  const { innerHtml, gsapChoreography } = buildSceneHtmlAndChoreography(
    validated.scenes[0],
    0,
    1,
    8.0,
    1920,
    1080,
    false,
  );
  assert.match(innerHtml, /<div class="matrix-grid">/);
  assert.match(innerHtml, /99\.98% High Precision/);
  assert.match(gsapChoreography, /tl\.from\("\.matrix-grid"/);

  const scopedCss = getArchetypeScopedCss(validated.scenes[0], 1920, 1080, false, palette);
  assert.match(scopedCss, /\.matrix-grid \{ border: 2px solid #6366f1;/);
});

test("bento-metric-grid renders formatted values and avoids frozen textContent: 0 tweens", () => {
  const scene = {
    id: "s-metrics",
    archetype: "bento-metric-grid",
    title: "Performance Benchmarks",
    bentoData: {
      metrics: [
        { label: "Active Vectors", value: "10M", unit: "+", detail: "in index", hero: true },
        { label: "P99 Latency", value: "5ms", unit: "", detail: "edge search" },
        { label: "Error Rate", value: "0", unit: "%", detail: "verified" },
      ],
    },
  };

  const { innerHtml, gsapChoreography } = buildSceneHtmlAndChoreography(
    scene,
    0,
    1,
    8.0,
    1920,
    1080,
    false,
  );

  // Values rendered directly in HTML
  assert.match(innerHtml, />10M</);
  assert.match(innerHtml, />5ms</);
  assert.match(innerHtml, />0</);

  // No textContent: 0 interpolation tween
  assert.doesNotMatch(gsapChoreography, /textContent:\s*0/);

  // Animates .bento-value with scale, opacity, and transform
  assert.match(gsapChoreography, /scope\.querySelectorAll\("\.bento-value"\)/);
  assert.match(gsapChoreography, /scale:\s*0\.92/);
  assert.match(gsapChoreography, /back\.out\(1\.4\)/);
});

test("scene-level theme: 'dark' adapts canvas to deep obsidian #0b0d14 and high-contrast typography", () => {
  const lightScene = {
    id: "s-light",
    archetype: "hook",
    title: "Editorial Perspective",
    voiceover: "Clear and thoughtful design narrative.",
  };
  const darkScene = {
    id: "s-dark",
    theme: "dark",
    archetype: "code-terminal",
    title: "Distributed Pipeline",
    voiceover: "Execution happens across distributed clusters.",
  };

  const validated = validateStoryboard(
    {
      productName: "ThemeEngine",
      scenes: [lightScene, darkScene],
    },
    [
      { id: "s-light", role: "hook" },
      { id: "s-dark", role: "outro" },
    ],
  );

  // Default theme is light, explicit dark theme preserved
  assert.equal(validated.scenes[0].theme, "light");
  assert.equal(validated.scenes[1].theme, "dark");

  const basePalette = {
    background: "#f7f6f1",
    card: "#ffffff",
    text: "#121316",
    accent: "#6366f1",
    border: "rgba(0,0,0,0.08)",
  };

  const darkCss = getArchetypeScopedCss(validated.scenes[1], 1920, 1080, false, basePalette);
  assert.match(darkCss, /#0b0d14/);
  assert.match(darkCss, /#f3f4f8/);
  assert.match(darkCss, /Deep Obsidian Dark Theme Overrides/);
});

test("vector-cluster-graph alias normalization, validation enrichment, and SVG rendering", () => {
  assert.equal(normalizeArchetype("vector-space"), "vector-cluster-graph");
  assert.equal(normalizeArchetype("cluster-graph"), "vector-cluster-graph");
  assert.equal(normalizeArchetype("knn-search"), "vector-cluster-graph");

  const storyboard = {
    productName: "VectorDB",
    scenes: [
      {
        id: "s-vec",
        archetype: "vector-space",
        theme: "dark",
        title: "Semantic Vector Search",
        voiceover:
          "Nearest neighbors navigate dense high-dimensional clusters in sub-millisecond time.",
      },
    ],
  };

  const validated = validateStoryboard(storyboard, [{ id: "s-vec", role: "middle" }]);
  const scene = validated.scenes[0];
  assert.equal(scene.archetype, "vector-cluster-graph");
  assert.equal(scene.theme, "dark");
  // Enriched with safe fallbacks
  assert.ok(Array.isArray(scene.clusters) && scene.clusters.length === 3);
  assert.ok(scene.stats && scene.stats.metric);
  // Zero topic leakage: fallback copy comes from the scene's own words, never stock jargon.
  assert.match(scene.queryLabel, /Semantic|Vector|Search/);
  assert.doesNotMatch(
    JSON.stringify([scene.clusters, scene.stats, scene.queryLabel]),
    /embed|HNSW|Cosine|Recall|Syntactic|Pruned|10M/i,
  );

  const { innerHtml, gsapChoreography } = buildSceneHtmlAndChoreography(
    scene,
    0,
    1,
    8.0,
    1920,
    1080,
    false,
  );

  // Renders asymmetric layout with SVG canvas
  assert.match(innerHtml, /vc-container/);
  assert.match(innerHtml, /vc-left-col/);
  assert.match(innerHtml, /vc-right-canvas/);
  assert.match(innerHtml, /<svg class="vc-svg"/);
  assert.match(innerHtml, /vc-traversal-path/);
  assert.match(innerHtml, /vc-centroid/);

  // GSAP animations for traversal and nodes
  assert.match(gsapChoreography, /strokeDashoffset:\s*0/);
  assert.match(gsapChoreography, /scope\.querySelectorAll\("\.vc-node"\)/);
});

test("formatCompactMetric formats large integers into human-readable compact notation", () => {
  assert.equal(formatCompactMetric(10000000), "10M");
  assert.equal(formatCompactMetric(1000000), "1M");
  assert.equal(formatCompactMetric(500000), "500k");
  assert.equal(formatCompactMetric("10000000"), "10M");
  assert.equal(formatCompactMetric("1,000,000"), "1M");
  assert.equal(formatCompactMetric("500,000"), "500k");
  assert.equal(formatCompactMetric(10000), "10k");
  assert.equal(formatCompactMetric(1000), "1k");
  assert.equal(formatCompactMetric(2024), "2024");
  assert.equal(formatCompactMetric("5ms"), "5ms");
  assert.equal(formatCompactMetric("10M"), "10M");
  assert.equal(formatCompactMetric(0), "0");
  assert.equal(formatCompactMetric(null), "");
  assert.equal(formatCompactMetric(undefined), "");
});

test("bento-metric-grid automatically formats raw large integers to prevent awkward wrapping", () => {
  const scene = {
    id: "s-bento-raw",
    archetype: "bento-metric-grid",
    title: "Global Scale",
    bentoData: {
      metrics: [
        { label: "Active Vectors", value: 10000000, unit: "+", hero: true },
        { label: "Daily Queries", value: 500000, unit: "/s" },
        { label: "Cluster Nodes", value: 1000000, unit: "" },
      ],
    },
  };

  const { innerHtml } = buildSceneHtmlAndChoreography(scene, 0, 1, 8.0, 1920, 1080, false);
  assert.match(innerHtml, />10M</);
  assert.match(innerHtml, />500k</);
  assert.match(innerHtml, />1M</);
  assert.doesNotMatch(innerHtml, />10000000</);
  assert.doesNotMatch(innerHtml, />500000</);
});

test("hook archetype strips director prefixes and only renders friction-box for shortcuts or short microcopy", () => {
  // Case 1: Prefixed note with short consumer microcopy (< 35 chars) -> strip prefix and render
  const shortPrefixedScene = {
    id: "s1-short",
    archetype: "hook",
    title: "Instant Retrieval",
    visualNote: "Editorial opener: Press ⌘K to start",
  };
  const res1 = buildSceneHtmlAndChoreography(shortPrefixedScene, 0, 1, 6.0, 1920, 1080, false);
  assert.match(res1.innerHtml, /class="friction-box"/);
  assert.match(res1.innerHtml, /Press ⌘K to start/);
  assert.doesNotMatch(res1.innerHtml, /Editorial opener:/i);

  // Case 2: Long director instructions (>= 35 chars) without shortcut -> suppress friction-box entirely
  const longDirectorScene = {
    id: "s1-long",
    archetype: "hook",
    title: "Deep Vision",
    visualNote:
      "Editorial opener: Start by zooming into the camera lens with heavy grain and film flicker",
  };
  const res2 = buildSceneHtmlAndChoreography(longDirectorScene, 0, 1, 6.0, 1920, 1080, false);
  assert.doesNotMatch(res2.innerHtml, /class="friction-box"/);
  assert.doesNotMatch(res2.innerHtml, /camera lens/);

  // Case 3: Shortcut present + long director instructions -> keep keyboard-badge, drop long note
  const shortcutWithLongNoteScene = {
    id: "s1-shortcut",
    archetype: "hook",
    title: "Command Palette",
    shortcut: "⌘K",
    visualNote:
      "Visual note: Zoom camera into center terminal interface while dimming surrounding UI",
  };
  const res3 = buildSceneHtmlAndChoreography(
    shortcutWithLongNoteScene,
    0,
    1,
    6.0,
    1920,
    1080,
    false,
  );
  assert.match(res3.innerHtml, /class="friction-box"/);
  assert.match(res3.innerHtml, /class="keyboard-badge">⌘K<\/span>/);
  assert.doesNotMatch(res3.innerHtml, /Zoom camera/);
  assert.doesNotMatch(res3.innerHtml, /Visual note:/i);

  // Case 4: No shortcut and no visualNote -> no friction-box
  const emptyNoteScene = {
    id: "s1-empty",
    archetype: "hook",
    title: "Clean Canvas",
  };
  const res4 = buildSceneHtmlAndChoreography(emptyNoteScene, 0, 1, 6.0, 1920, 1080, false);
  assert.doesNotMatch(res4.innerHtml, /class="friction-box"/);
});

test("outro archetype adopts dark card styling and high-contrast pills in dark mode", () => {
  const outroScene = {
    id: "s-outro",
    archetype: "outro",
    theme: "dark",
    title: "Build Production Vectors Today",
    subtitle: "Deterministic rendering and global indexing in minutes.",
    cta: "Start Free Trial",
    pills: ["Zero setup", "Sub-millisecond", "SOC2 Type II"],
  };

  const basePalette = {
    background: "#f7f6f1",
    card: "#ffffff",
    text: "#121316",
    accent: "#6366f1",
    border: "rgba(0,0,0,0.08)",
  };

  const scopedCss = getArchetypeScopedCss(outroScene, 1920, 1080, false, basePalette);

  // Modal card adopts dark styling instead of staying #ffffff
  assert.match(scopedCss, /\.outro-card\s*\{[^}]*background:\s*#141724/);
  assert.match(
    scopedCss,
    /\.outro-card\s*\{[^}]*border:\s*1px solid rgba\(255,\s*255,\s*255,\s*0\.12\)/,
  );
  assert.match(
    scopedCss,
    /\.outro-card\s*\{[^}]*box-shadow:\s*0 24px 60px rgba\(0,\s*0,\s*0,\s*0\.5\)/,
  );

  // Typography inside outro card is crisp #f3f4f8
  assert.match(scopedCss, /\.outro-card \.editorial-title\s*\{[^}]*color:\s*#f3f4f8/);

  // Pills adopt dark styling with high-contrast borders and #f3f4f8 text
  assert.match(scopedCss, /\.pill-feature\s*\{[^}]*background:\s*#0b0d14/);
  assert.match(scopedCss, /\.pill-feature\s*\{[^}]*color:\s*#f3f4f8/);
  assert.match(
    scopedCss,
    /\.pill-feature\s*\{[^}]*border:\s*1px solid rgba\(255,\s*255,\s*255,\s*0\.16\)/,
  );

  // CTA button has accent styling and glow
  assert.match(scopedCss, /\.cta-button\s*\{[^}]*background:\s*#6366f1/);
  assert.match(scopedCss, /\.cta-button\s*\{[^}]*box-shadow:[^}]*#6366f155/);
});

test("dynamic Manim thresholds: math topics allow up to 65% share and 3 consecutive", () => {
  assert.equal(isMathematicalStoryboard({ productName: "Linear Algebra & Vectors" }), true);
  assert.equal(isMathematicalStoryboard({ productName: "SaaS Dashboard CRM" }), false);

  const generalReport = auditAndDegradeManimScenes(
    [{ archetype: "hook" }, { archetype: "features-cards" }],
    { topic: "Modern SaaS Analytics Platform" },
  );
  assert.equal(generalReport.isMath, false);
  assert.equal(generalReport.maxAllowed, 0.4);
  assert.equal(generalReport.maxConsecutive, 2);

  const mathReport = auditAndDegradeManimScenes(
    [{ archetype: "hook" }, { archetype: "manim-bayes-theorem" }],
    { topic: "Bayesian Probability and Conditional Sampling" },
  );
  assert.equal(mathReport.isMath, true);
  assert.equal(mathReport.maxAllowed, 0.65);
  assert.equal(mathReport.maxConsecutive, 3);

  // In validateStoryboard:
  const timing6 = ["hook", "m1", "m2", "m3", "m4", "outro"].map((role, i) => ({
    id: `s${i}`,
    role,
  }));
  const manimScene = (i, arch = "manim-bayes-theorem") => ({
    archetype: arch,
    title: `Math Beat ${i}`,
    voiceover: `Calculating probability distribution ${i}.`,
    beats: [`Calculating probability distribution ${i}.`],
    manimData:
      arch === "manim-bayes-theorem"
        ? { title: "Bayes", pA: 0.3, pBGivenA: 0.8, pBGivenNotA: 0.1 }
        : arch === "manim-monte-carlo-pi"
          ? { title: "Monte Carlo", samplePoints: 500 }
          : { title: "Function Plot", expr: "sin(x)", xRange: [-3, 3] },
    fallbackArchetype: "bento-metric-grid",
  });

  // Math storyboard with 3 consecutive Manim scenes in a 6-scene video
  const mathBoard = {
    productName: "Probability & Bayes Theorem",
    seed: 1,
    scenes: [
      { archetype: "hook", title: "Hook", voiceover: "Welcome to Bayes Theorem." },
      manimScene(1, "manim-bayes-theorem"),
      manimScene(2, "manim-function-plot"),
      manimScene(3, "manim-monte-carlo-pi"),
      { archetype: "split-comparison", title: "Compare", voiceover: "Compare the results." },
      { archetype: "outro", title: "Outro", voiceover: "That wraps up probability." },
    ],
  };

  const validatedMath = validateStoryboard(mathBoard, timing6, { manimEnabled: true });
  const mathEngines = validatedMath.scenes.map((s) => s.engine);
  // All 3 middle Manim scenes must survive! (3/6 = 50% <= 65% cap, 3 consecutive <= 3 consecutive)
  assert.deepEqual(mathEngines, ["html-gsap", "manim", "manim", "manim", "html-gsap", "html-gsap"]);

  // For a general SaaS video with the same scene configuration, the 3rd consecutive is capped at 2 and 40%
  const generalBoard = {
    productName: "SuperSaaS CRM",
    seed: 1,
    scenes: [
      { archetype: "hook", title: "Hook", voiceover: "Welcome to SuperSaaS." },
      manimScene(1, "manim-bayes-theorem"),
      manimScene(2, "manim-function-plot"),
      manimScene(3, "manim-monte-carlo-pi"),
      { archetype: "split-comparison", title: "Compare", voiceover: "Compare the results." },
      { archetype: "outro", title: "Outro", voiceover: "That wraps up SuperSaaS." },
    ],
  };

  const validatedGeneral = validateStoryboard(generalBoard, timing6, { manimEnabled: true });
  const generalEngines = validatedGeneral.scenes.map((s) => s.engine);
  // General topic caps at 40% (max 2 scenes) and max 2 consecutive
  assert.equal(generalEngines.filter((e) => e === "manim").length, 2);
  assert.equal(generalEngines[3], "html-gsap"); // 3rd manim was degraded
});

test("visual variety is enforced across multiple product domains and distinct visual families", () => {
  const testPalette = {
    background: "#0b0d14",
    text: "#f8fafc",
    accent: "#6366f1",
    card: "#131722",
    border: "#1f2638",
  };

  const domains = [
    {
      topic: "Autonomous Robotics & Vision",
      suggested: [
        "kinetic-impact",
        "3d-motion-hero",
        "carousel-3d-showcase",
        "microservice-mesh",
        "code-slice-reveal",
      ],
    },
    {
      topic: "Cloud Data Pipeline & Sharding",
      suggested: [
        "bento-metric-grid",
        "database-shard-map",
        "event-bus-pubsub",
        "data-lineage-flow",
        "stat-spotlight",
      ],
    },
  ];

  for (const { topic, suggested } of domains) {
    const timing = [
      { id: "s1", role: "hook", suggestedArchetype: "hook" },
      ...suggested.map((arch, idx) => ({
        id: `s${idx + 2}`,
        role: "feature",
        suggestedArchetype: arch,
      })),
      { id: `s${suggested.length + 2}`, role: "outro", suggestedArchetype: "outro" },
    ];

    const inputBoard = {
      productName: topic,
      seed: topic,
      scenes: [
        { id: "s1", archetype: "hook", title: `${topic} Hook`, voiceover: "Opening overview." },
        ...suggested.map((arch, idx) => ({
          id: `s${idx + 2}`,
          archetype: arch,
          title: `Milestone ${idx + 1}`,
          voiceover: `Deep dive explanation for stage ${idx + 1}.`,
        })),
        {
          id: `s${suggested.length + 2}`,
          archetype: "outro",
          title: "Conclusion",
          voiceover: "Wrap up and takeaways.",
        },
      ],
    };

    const validated = validateStoryboard(inputBoard, timing);

    // 1. Verify every scene gets a non-null, recognized archetype
    assert.equal(validated.scenes.length, timing.length);

    // 2. Verify no two consecutive scenes repeat the same archetype
    for (let i = 1; i < validated.scenes.length; i++) {
      const prevArch = validated.scenes[i - 1].archetype;
      const currArch = validated.scenes[i].archetype;
      assert.notEqual(
        currArch,
        prevArch,
        `Scene ${i + 1} (${currArch}) must not repeat scene ${i} (${prevArch})`,
      );
    }

    // 3. Verify visual family diversity: middle scenes cover multiple distinct families
    const middleArchs = validated.scenes.slice(1, -1).map((s) => s.archetype);
    const uniqueArchs = new Set(middleArchs);
    assert.equal(
      uniqueArchs.size,
      middleArchs.length,
      "All middle scenes in this sequence must be unique",
    );

    // 4. Verify each scene builds cleanly in landscape and portrait
    for (const scene of validated.scenes) {
      for (const isPortrait of [false, true]) {
        const { innerHtml, gsapChoreography } = buildSceneHtmlAndChoreography(
          scene,
          1,
          4,
          8.0,
          isPortrait ? 1080 : 1920,
          isPortrait ? 1920 : 1080,
          isPortrait,
          testPalette,
        );
        assert.ok(innerHtml.length > 50, `${scene.archetype} HTML must render`);
        assert.ok(gsapChoreography.length > 20, `${scene.archetype} GSAP must have choreography`);
      }
    }
  }
});

test("Engine Mode: Only Manim renders 100% Manim frames across all scenes including hook and outro", () => {
  const timing5 = [
    { id: "s1", role: "hook" },
    { id: "s2", role: "middle" },
    { id: "s3", role: "middle" },
    { id: "s4", role: "middle" },
    { id: "s5", role: "outro" },
  ];

  // Director output might have mixed archetypes or generic ones
  const rawMixed = {
    productName: "Calculus & Linear Algebra",
    scenes: [
      {
        id: "s1",
        archetype: "manim-function-plot",
        title: "Derivative Slope",
        voiceover: "Visualizing the rate of change.",
      },
      {
        id: "s2",
        archetype: "split-comparison",
        title: "Matrix Comparison",
        voiceover: "Transforming vectors.",
      },
      {
        id: "s3",
        archetype: "manim-transformer-block",
        title: "Attention Mechanism",
        voiceover: "Softmax attention scores.",
      },
      {
        id: "s4",
        archetype: "features-cards",
        title: "Eigenvectors",
        voiceover: "Invariant directions.",
      },
      {
        id: "s5",
        archetype: "outro",
        title: "Conclusion",
        voiceover: "Summary of geometric intuition.",
      },
    ],
  };

  const validated = validateStoryboard(rawMixed, timing5, {
    manimEnabled: true,
    engineMode: "manim",
  });

  assert.equal(validated.scenes.length, 5);

  // 1. Every single scene must have engine === 'manim'
  for (const [idx, scene] of validated.scenes.entries()) {
    assert.equal(
      scene.engine,
      "manim",
      `Scene ${idx + 1} must use engine: 'manim' in Only Manim mode`,
    );
    assert.ok(
      scene.archetype.startsWith("manim-"),
      `Scene ${idx + 1} archetype (${scene.archetype}) must be a manim-* primitive`,
    );
    assert.ok(
      scene.manimData && typeof scene.manimData === "object",
      `Scene ${idx + 1} must contain valid manimData`,
    );
    assert.ok(
      Array.isArray(scene.beats) && scene.beats.length > 0,
      `Scene ${idx + 1} must contain valid beats`,
    );
  }

  // 2. Both hook (first) and outro (last) are Manim scenes
  assert.equal(validated.scenes[0].engine, "manim");
  assert.equal(validated.scenes[4].engine, "manim");
});

test("Engine Mode: Only HTML renders 100% HTML frames and converts any Manim primitives to HTML", () => {
  const timing4 = [
    { id: "s1", role: "hook" },
    { id: "s2", role: "middle" },
    { id: "s3", role: "middle" },
    { id: "s4", role: "outro" },
  ];

  const rawWithManim = {
    productName: "SaaS Cloud Platform",
    scenes: [
      {
        id: "s1",
        archetype: "hook",
        title: "Platform Hook",
        voiceover: "Welcome to modern cloud orchestration.",
      },
      {
        id: "s2",
        archetype: "manim-vector-transform",
        title: "Vector Transform",
        voiceover: "Linear transformations.",
      },
      {
        id: "s3",
        archetype: "manim-transformer-block",
        title: "Attention Block",
        voiceover: "Deep attention layers.",
      },
      {
        id: "s4",
        archetype: "outro",
        title: "Get Started",
        voiceover: "Deploy your first cluster today.",
      },
    ],
  };

  const validated = validateStoryboard(rawWithManim, timing4, {
    manimEnabled: true, // Even if Manim is enabled on system, Only HTML must strictly produce HTML
    engineMode: "html",
  });

  assert.equal(validated.scenes.length, 4);

  // 1. Every single scene must have engine === 'html-gsap'
  for (const [idx, scene] of validated.scenes.entries()) {
    assert.equal(
      scene.engine,
      "html-gsap",
      `Scene ${idx + 1} must use engine: 'html-gsap' in Only HTML mode`,
    );
    assert.ok(
      !scene.archetype.startsWith("manim-"),
      `Scene ${idx + 1} archetype (${scene.archetype}) must NOT be a manim primitive`,
    );
    assert.equal(scene.manimData, undefined, `Scene ${idx + 1} must not contain manimData`);
  }
});

test("Engine Mode: Combined mode routes mathematically according to hybrid policy", () => {
  const timing4 = [
    { id: "s1", role: "hook" },
    { id: "s2", role: "middle" },
    { id: "s3", role: "middle" },
    { id: "s4", role: "outro" },
  ];

  const rawStoryboard = {
    productName: "Math Foundation",
    scenes: [
      { id: "s1", archetype: "hook", title: "Hook", voiceover: "Introduction." },
      {
        id: "s2",
        archetype: "manim-function-plot",
        title: "Calculus",
        voiceover: "Slope of curve.",
        beats: ["A curve rises and falls.", "The slope is the derivative."],
        fallbackArchetype: "bento-metric-grid",
        manimData: { title: "Slope", expr: "x^2", xRange: [-2, 2] },
      },
      {
        id: "s3",
        archetype: "features-cards",
        title: "Features",
        voiceover: "Modern features.",
      },
      { id: "s4", archetype: "outro", title: "Outro", voiceover: "Conclusion." },
    ],
  };

  const validated = validateStoryboard(rawStoryboard, timing4, {
    manimEnabled: true,
    engineMode: "combined",
  });

  assert.equal(validated.scenes[0].engine, "html-gsap");
  assert.equal(validated.scenes[1].engine, "manim");
  assert.equal(validated.scenes[2].engine, "html-gsap");
  assert.equal(validated.scenes[3].engine, "html-gsap");
});

test("Input validation and catalog formatting respect all three engine options", () => {
  // 1. validateProductionInput
  const payloadManim = validateProductionInput({
    apiKey: "test-key",
    duration: 30,
    sourceTopic: "Math",
    engineMode: "manim",
  });
  assert.equal(payloadManim.engineMode, "manim");

  const payloadHtml = validateProductionInput({
    apiKey: "test-key",
    duration: 30,
    sourceTopic: "SaaS",
    engineMode: "html",
  });
  assert.equal(payloadHtml.engineMode, "html");

  const payloadCombined = validateProductionInput({
    apiKey: "test-key",
    duration: 30,
    sourceTopic: "AI",
    engineMode: "combined",
  });
  assert.equal(payloadCombined.engineMode, "combined");

  const payloadDefault = validateProductionInput({
    apiKey: "test-key",
    duration: 30,
    sourceTopic: "AI",
  });
  assert.equal(payloadDefault.engineMode, "combined");

  // 2. formatCatalogForPrompt
  const catManimOnly = formatCatalogForPrompt({ engineMode: "manim" });
  assert.ok(catManimOnly.includes("manim-function-plot"));
  assert.ok(!catManimOnly.includes("hook"));
  assert.ok(!catManimOnly.includes("carousel-3d-showcase"));

  const catHtmlOnly = formatCatalogForPrompt({ engineMode: "html" });
  assert.ok(!catHtmlOnly.includes("manim-function-plot"));
  assert.ok(catHtmlOnly.includes("3d-motion-hero"));
  assert.ok(catHtmlOnly.includes("carousel-3d-showcase"));

  const catCombined = formatCatalogForPrompt({ manim: true, engineMode: "combined" });
  assert.ok(catCombined.includes("manim-function-plot"));
  assert.ok(catCombined.includes("3d-motion-hero"));

  // 3. getSceneTimingStructure recommendations in Only Manim mode
  const timingManim = getSceneTimingStructure(30, 42, { engineMode: "manim" });
  assert.ok(timingManim[0].suggestedArchetypes.every((a) => a.startsWith("manim-")));
  assert.ok(timingManim[1].suggestedArchetypes.every((a) => a.startsWith("manim-")));
});

test("3Blue1Brown rules and palette are integrated into Manim planning and prompts", () => {
  // 1. Verify 3b1b canonical palette defaults in planner.mjs
  assert.equal(DEFAULT_3B1B_PALETTE.blue, "#58c4dd");
  assert.equal(DEFAULT_3B1B_PALETTE.green, "#83c167");
  assert.equal(DEFAULT_3B1B_PALETTE.yellow, "#ffff00");
  assert.equal(DEFAULT_3B1B_PALETTE.red, "#fc6255");
  assert.equal(DEFAULT_3B1B_PALETTE.teal, "#5cd0b3");
  assert.equal(DEFAULT_3B1B_PALETTE.gold, "#f3ac3c");
  assert.equal(DEFAULT_3B1B_PALETTE.maroon, "#c55f73");
  assert.equal(DEFAULT_3B1B_PALETTE.purple, "#9a72ac");

  const clean = sanitizePalette({});
  assert.equal(clean.blue, "#58c4dd");
  assert.equal(clean.green, "#83c167");
  assert.equal(clean.yellow, "#ffff00");
  assert.equal(clean.background, "#0e1117");

  // 2. Verify director prompt contains 3b1b mathematical rules when Manim is active
  const promptManim = buildDirectorPrompt({
    topic: "Calculus and Linear Algebra",
    timingStructure: [{ id: "s1", duration: 5, maxWords: 15, role: "hook" }],
    actualSceneCount: 1,
    actualDurationSec: 5,
    manimEnabled: true,
    engineMode: "manim",
  });

  assert.ok(promptManim.includes("3BLUE1BROWN MATHEMATICAL ANIMATION RULES"));
  assert.ok(promptManim.includes("TRANSFORM, DON'T REPLACE"));
  assert.ok(promptManim.includes("3-STAGE PEDAGOGICAL BEAT CADENCE"));
  assert.ok(promptManim.includes("COLOR GRAMMAR & VISUAL SEMANTICS"));
  assert.ok(promptManim.includes("#58C4DD")); // 3b1b Blue
  assert.ok(promptManim.includes("#83C167")); // 3b1b Green
  assert.ok(promptManim.includes("#FC6255")); // 3b1b Red
  assert.ok(promptManim.includes("#FFFF00")); // 3b1b Yellow
});

test("YAML-based storyboard routing parses pure YAML, folded blocks, and Hyperframes manifests", () => {
  const pureYaml = `
version: "2.0"
productName: "Neural Vectors"
durationSeconds: 15
aspectRatio: "16:9"
scenes:
  - id: "scene1-intro"
    engine: "manim"
    archetype: "manim-vector-field"
    theme: "dark"
    transition: "crossfade"
    title: "Vector Fields & Eigenvalues"
    subtitle: "Understanding transformations in 2D"
    voiceover: >
      Every linear transformation stretches or rotates space.
      Notice how eigenvectors remain along their span while eigenvalues scale them.
    math_expressions:
      - "A \\\\mathbf{v} = \\\\lambda \\\\mathbf{v}"
      - "\\\\det(A - \\\\lambda I) = 0"
  - id: "scene2-stats"
    engine: "html-gsap"
    archetype: "metric-stat"
    theme: "dark"
    transition: "slide"
    title: "Convergence Rates"
    value: "99.8%"
    label: "Accuracy across benchmark manifolds"
    voiceover: >
      With higher dimensional approximations, convergence reaches
      near-perfection in milliseconds.
`;

  const parsed = parseStoryboardYamlOrJson(pureYaml);
  assert.equal(parsed.productName, "Neural Vectors");
  assert.equal(parsed.version, "2.0");
  assert.equal(parsed.scenes.length, 2);

  const scene1 = parsed.scenes[0];
  assert.equal(scene1.id, "scene1-intro");
  assert.equal(scene1.engine, "manim");
  assert.equal(scene1.archetype, "manim-vector-field");
  assert.equal(scene1.transition, "crossfade");
  assert.ok(scene1.voiceover.includes("Every linear transformation"));
  assert.ok(scene1.voiceover.includes("eigenvalues scale them"));
  assert.equal(scene1.math_expressions.length, 2);

  const scene2 = parsed.scenes[1];
  assert.equal(scene2.engine, "html-gsap");
  assert.equal(scene2.archetype, "metric-stat");
  assert.equal(scene2.value, "99.8%");

  // Backwards compatibility check: parseStoryboardJson delegates transparently
  const delegated = parseStoryboardJson(pureYaml);
  assert.equal(delegated.productName, "Neural Vectors");
  assert.equal(delegated.scenes.length, 2);
});

test("YAML parser supports Markdown code fences and normalizes Hyperframes 'frames' keyword", () => {
  const fencedHyperframesYaml = `
\`\`\`yaml
version: "1.0"
title: "Quantum Superposition"
frames:
  - id: "frame-1"
    engine: "manim"
    archetype: "manim-wave-function"
    duration_s: 6.5
    transition_in: "crossfade"
    title_text: "Wave Collapse"
    voiceover: "When observed, quantum states collapse instantaneously into a single eigenstate."
    formula: "\\\\psi(x, t)"
\`\`\`
`;

  const parsed = parseStoryboardYamlOrJson(fencedHyperframesYaml);
  assert.equal(parsed.productName, "Quantum Superposition");
  assert.ok(Array.isArray(parsed.scenes));
  assert.equal(parsed.scenes.length, 1);

  const frame = parsed.scenes[0];
  assert.equal(frame.id, "frame-1");
  assert.equal(frame.engine, "manim");
  assert.equal(frame.archetype, "manim-wave-function");
  assert.equal(frame.duration, 6.5);
  assert.equal(frame.transition, "crossfade");
  assert.equal(frame.title, "Wave Collapse");
  assert.equal(frame.formula, "\\psi(x, t)");
});

test("YAML manifest serializer generates valid canonical YAML and Markdown documentation", () => {
  const sampleStoryboard = {
    version: "2.0",
    productName: "Chalk Studio Pro",
    durationSeconds: 12,
    aspectRatio: "16:9",
    scenes: [
      {
        id: "intro-frame",
        engine: "html-gsap",
        archetype: "hook",
        theme: "dark",
        transition: "fade",
        title: "Deterministic Engine",
        subtitle: "Zero jitter frame capture",
        voiceover: "Chalk Frames captures HTML and Manim frame-by-frame with zero jitter.",
      },
      {
        id: "math-frame",
        engine: "manim",
        archetype: "manim-fourier-series",
        theme: "dark",
        transition: "crossfade",
        title: "Harmonic Synthesis",
        voiceover: "Any periodic function can be decomposed into a sum of sines and cosines.",
        formulas: ["f(x) = \\\\sum c_n e^{i n x}"],
      },
    ],
  };

  const yamlOutput = formatStoryboardYaml(sampleStoryboard);
  assert.ok(yamlOutput.includes("2.0"));
  assert.ok(yamlOutput.includes("Chalk Studio Pro"));
  assert.ok(yamlOutput.includes("scenes:"));
  assert.ok(yamlOutput.includes("manim-fourier-series"));

  // Round-trip parse test: ensure serialized YAML parses cleanly back
  const roundTripped = parseStoryboardYamlOrJson(yamlOutput);
  assert.equal(roundTripped.productName, sampleStoryboard.productName);
  assert.equal(roundTripped.scenes.length, 2);
  assert.equal(roundTripped.scenes[1].engine, "manim");

  const mdOutput = formatStoryboardMarkdown(sampleStoryboard);
  assert.ok(mdOutput.startsWith("---"));
  assert.ok(mdOutput.includes('title: "Chalk Studio Pro"'));
  assert.ok(mdOutput.includes("## Scene 1: Deterministic Engine"));
  assert.ok(mdOutput.includes("## Scene 2: Harmonic Synthesis"));
  assert.ok(mdOutput.includes("**Engine**: `manim`"));
});

test("Hyperframes 18-token design contract and ambient glow are injected into scoped CSS", () => {
  const scene = {
    id: "test-scene-1",
    archetype: "features-cards",
    theme: "dark",
    title: "Tokens",
    features: [{ title: "Token 1", description: "Desc" }],
  };
  const activePalette = {
    background: "#0e1117",
    text: "#ffffff",
    textMuted: "#a0a5b5",
    border: "#232738",
    accent: "#6366f1",
    accent2: "#38bdf8",
    accent3: "#f43f5e",
  };

  const css = getArchetypeScopedCss(scene, 1920, 1080, false, activePalette);

  // Assert all 18 tokens from the Hyperframes theme contract
  assert.ok(css.includes("--bg:"), "Missing --bg token");
  assert.ok(css.includes("--fg:"), "Missing --fg token");
  assert.ok(css.includes("--muted:"), "Missing --muted token");
  assert.ok(css.includes("--surface:"), "Missing --surface token");
  assert.ok(css.includes("--border:"), "Missing --border token");
  assert.ok(css.includes("--brand:"), "Missing --brand token");
  assert.ok(css.includes("--accent:"), "Missing --accent token");
  assert.ok(css.includes("--accent-2:"), "Missing --accent-2 token");
  assert.ok(css.includes("--font-display:"), "Missing --font-display token");
  assert.ok(css.includes("--font-body:"), "Missing --font-body token");
  assert.ok(css.includes("--font-mono:"), "Missing --font-mono token");
  assert.ok(css.includes("--radius:"), "Missing --radius token");
  assert.ok(css.includes("--space-1:"), "Missing --space-1 token");
  assert.ok(css.includes("--space-2:"), "Missing --space-2 token");
  assert.ok(css.includes("--space-3:"), "Missing --space-3 token");
  assert.ok(css.includes("--dur-beat:"), "Missing --dur-beat token");
  assert.ok(css.includes("--ease-standard:"), "Missing --ease-standard token");
  assert.ok(css.includes("--ease-emphasis:"), "Missing --ease-emphasis token");

  // Assert ambient radial lighting overlay
  assert.ok(css.includes("radial-gradient"), "Missing ambient radial lighting glow");
});

test("Director prompt instructs LLM to produce structured YAML storyboard format", () => {
  const prompt = buildDirectorPrompt({
    topic: "Building Distributed Systems",
    timingStructure: [{ id: "s1", duration: 6, maxWords: 18, role: "hook" }],
    actualSceneCount: 1,
    actualDurationSec: 6,
    manimEnabled: true,
    engineMode: "combined",
  });

  assert.ok(prompt.includes("STORYBOARD YAML SPECIFICATION"));
  assert.ok(prompt.includes("scenes:"));
  assert.ok(prompt.includes("voiceover: >"));
  assert.ok(prompt.includes("engine:"));
});
