/**
 * Visual Archetypes Catalog & Single Source of Truth for Studio One.
 *
 * Defines all available visual archetypes, their semantic descriptions,
 * visual families, best-use guidance, and intentional aliases.
 */

export const VISUAL_CATALOG = [
  {
    id: "hook",
    family: "title",
    isMiddle: false,
    description:
      "High-impact editorial title card and friction opener (best for opening hook or problem framing)",
    payloadHint: "eyebrow, title, subtitle, visualNote",
    aliases: ["intro", "opening"],
  },
  {
    id: "outro",
    family: "title",
    isMiddle: false,
    description: "Closing takeaway summary and call-to-action (best for final scene or conclusion)",
    payloadHint: "eyebrow, title, subtitle, pills: [], cta",
    aliases: ["cta", "conclusion", "summary"],
  },
  {
    id: "kinetic-text",
    family: "typographic",
    isMiddle: true,
    description: "Giant high-impact typography takeover without boxes",
    payloadHint: "kineticData: { mainWord, accentWord, subtitle, badge }",
    aliases: ["hero-title", "headline-announcement", "typography", "kinetic-type"],
  },
  {
    id: "kinetic-impact",
    family: "typographic",
    isMiddle: true,
    description:
      "Pure full-bleed display typography TAKEOVER — NO eyebrow, NO cards, NO subtitles. Huge aggressive condensed-gothic or ultra-bold sans text (110–140px) spanning the full screen with clip-path mask reveals and word-slam stagger. Best for thesis statements, paradigm shifts, or any moment that needs maximum visual impact.",
    payloadHint: "impactData: { lines: [string], accent: string, tag }",
    aliases: ["impact-text", "full-bleed-typography", "word-slam", "condensed-title", "typographic-takeover"],
  },
  {
    id: "stat-spotlight",
    family: "numeric",
    isMiddle: true,
    description:
      "Massive centered metric spotlight — one huge number (140px glow font), radiating conic/radial background glow, and concentric SVG pulse rings. Zero cards, zero clutter. Used to land a single decisive number with maximum cinematic weight.",
    payloadHint: "spotlightData: { value, unit, label, subLabel }",
    aliases: ["number-spotlight", "metric-spotlight", "focal-metric", "single-stat", "cinematic-metric"],
  },
  {
    id: "mobile-mockup",
    family: "device",
    isMiddle: true,
    description: "Realistic smartphone app showcase with notifications and card feeds",
    payloadHint:
      "mockupData: { appTitle, screenType, headerBadge, items: [{ title, desc, time }] }",
    aliases: ["mobile", "phone-mockup"],
  },
  {
    id: "radial-orbit",
    family: "radial",
    isMiddle: true,
    description: "Core engine or hub with orbiting satellite nodes",
    payloadHint: "orbitData: { centerTitle, centerSub, satellites: [{ label, desc }] }",
    aliases: ["orbital-network", "orbit", "ecosystem-orbit"],
  },
  {
    id: "step-ladder",
    family: "diagram",
    isMiddle: true,
    description: "Multi-stage process flow with glowing milestones and status badges",
    payloadHint: "stepData: { steps: [{ stepNumber, title, desc, status }] }",
    aliases: ["quarterly-roadmap", "multi-phase-timeline", "timeline", "roadmap"],
  },
  {
    id: "live-feed",
    family: "feed",
    isMiddle: true,
    description: "Realtime activity stream with glowing status tags",
    payloadHint: "feedData: { items: [{ icon, text, tag, status }] }",
    aliases: ["activity-feed", "telemetry-feed"],
  },
  {
    id: "isometric-stack",
    family: "diagram",
    isMiddle: true,
    description: "3D layered system architecture stack",
    payloadHint: "stackData: { layers: [{ name, tech, role }] }",
    aliases: ["deep-dive-infrastructure", "layered-stack", "3d-stack"],
  },
  {
    id: "flowchart-process",
    family: "diagram",
    isMiddle: true,
    description: "Sequential SVG process pipeline or biological/algorithmic flow",
    payloadHint: "flowData: { steps: [{ stepNumber, title, desc, isHighlighted }] }",
    aliases: ["execution-workflow", "biological-diagram", "workflow", "process-flow"],
  },
  {
    id: "kpi-counter-ring",
    family: "numeric",
    isMiddle: true,
    description: "Dramatic hero metric with glowing SVG conic progress ring and trend badge",
    payloadHint: "kpiData: { value, label, trend, progress, subtitle }",
    aliases: ["gauge-counter", "kpi-ring", "counter-ring"],
  },
  {
    id: "interactive-diff",
    family: "comparison",
    isMiddle: true,
    description: "Side-by-side evolution with addition/deletion diff lines",
    payloadHint:
      "diffData: { titleLeft, badgeLeft, linesLeft: [], titleRight, badgeRight, linesRight: [] }",
    aliases: ["diff", "code-diff", "before-after"],
  },
  {
    id: "chat-exchange",
    family: "feed",
    isMiddle: true,
    description: "Simulated AI/expert message stream with avatars & timestamps",
    payloadHint: "chatData: { channelName, messages: [{ sender, text, isAi, time }] }",
    aliases: ["user-conversation", "ai-agent-message"],
  },
  {
    id: "metric-stat",
    family: "numeric",
    isMiddle: true,
    description: "Big hero numbers, benchmark ring & pills",
    payloadHint: "metric: { value, label, badge, subPills: [] }",
    aliases: ["metric", "stat-counter"],
  },
  {
    id: "architecture-pipeline",
    family: "diagram",
    isMiddle: true,
    description: "3-step workflow pipeline with connected nodes",
    payloadHint:
      "pipeline: { node1: { title, desc }, node2: { title, desc }, node3: { title, desc } }",
    aliases: ["pipeline", "workflow-pipeline"],
  },
  {
    id: "code-terminal",
    family: "device",
    isMiddle: true,
    description:
      "Developer scripts, CLI, API walkthrough with syntax highlighting and terminal output",
    payloadHint: "codeDemo: { filename, language, lines: [], output }",
    aliases: ["bash-command-terminal", "terminal", "cli"],
  },
  {
    id: "split-comparison",
    family: "comparison",
    isMiddle: true,
    description: "Old friction vs New solution side-by-side card comparison",
    payloadHint:
      "compareLeft: { title, tag, points: [] }, compareRight: { title, tag, points: [] }",
    aliases: ["side-by-side-comparison", "versus", "comparison"],
  },
  {
    id: "custom-split",
    family: "comparison",
    isMiddle: true,
    description: "Custom split-stage comparison and dual showcase layout",
    payloadHint:
      "compareLeft: { title, tag, points: [] }, compareRight: { title, tag, points: [] }",
    aliases: ["custom-comparison"],
  },
  {
    id: "data-graph",
    family: "numeric",
    isMiddle: true,
    description: "Performance bars, analytics and growth throughput",
    payloadHint: "chartData: { title, badge, bars: [{ label, value, height }] }",
    aliases: ["infographic-trends", "analytics-bars", "chart", "bar-chart"],
  },
  {
    id: "bento-grid",
    family: "grid",
    isMiddle: true,
    description: "3-pillar modular features bento grid",
    payloadHint:
      "bento: { mainCard: { title, desc, badge }, subCard1: { title, badge }, subCard2: { title, badge } }",
    aliases: ["analytics-dashboard", "system-overview-panel", "bento"],
  },
  {
    id: "quote-callout",
    family: "typographic",
    isMiddle: true,
    description: "Core principle, defining axiom, or testimonial callout",
    payloadHint: "quoteData: { quote, author, context, badge }",
    aliases: ["quote", "testimonial", "axiom"],
  },
  {
    id: "features-cards",
    family: "grid",
    isMiddle: true,
    description: "Balanced dual feature cards with typewriter demo and bullet notes",
    payloadHint: "cardLeft: { title, badge, sampleText }, cardRight: { title, badge, bullets: [] }",
    aliases: ["features", "feature-cards"],
  },
  {
    id: "bento-metric-grid",
    family: "numeric",
    isMiddle: true,
    description:
      "Multi-stat Bento grid with varied tile sizes, a highlighted hero tile, count-up metric numbers and animated accent borders",
    payloadHint: "bentoData: { metrics: [{ label, value, unit, detail, hero }] }",
    aliases: ["bento-stats", "stats-grid", "metric-grid", "bento-metrics"],
  },
  {
    id: "terminal-flow",
    family: "device",
    isMiddle: true,
    description:
      "EDGE-TO-EDGE split canvas. Left 40%: compact HUD header (JetBrains Mono, [TAG // 01] style) + minimal bullet list, NO centered serif title. Right 60%: giant dark terminal console filling most of the screen with typed commands and outputs. Ideal for dev workflow comparisons, CLI sequences, or build pipeline explanations.",
    payloadHint: "terminalData: { hudTag, bullets: [{ text }], lines: [{ prompt, text, output }] }",
    aliases: ["split-device", "device-mockup", "dev-terminal", "terminal-preview"],
  },
  {
    id: "step-progression",
    family: "diagram",
    isMiddle: true,
    description:
      "Connected node timeline showing 3-4 progressive stages with a drawn connector line and a pulsing active node",
    payloadHint: "progressData: { steps: [{ label, caption }] }",
    aliases: ["progress-timeline", "journey-steps", "stage-progression"],
  },
  {
    id: "vector-cluster-graph",
    family: "diagram",
    isMiddle: true,
    description:
      "EDGE-TO-EDGE canvas. NO centered title, NO eyebrow dot row. Compact HUD header top-left in JetBrains Mono ([TRACE // 01] HYPERPLANE ROUTING style). SVG vector field fills 80%+ of the frame with glowing clustered nodes, traversal path animation, and continuous node drift. Ideal for AI embeddings, k-NN search, semantic retrieval, and any high-dimensional data visualization.",
    payloadHint:
      "title, subtitle, queryLabel, clusters[{name, nodeCount, active}], stats: {metric, latency}",
    aliases: ["vector-space", "cluster-graph", "knn-search"],
  },
];

/** Set of all allowed archetype IDs. */
export const archetypes = new Set(VISUAL_CATALOG.map((item) => item.id));

/** Visual families mapped by archetype ID. */
export const ARCHETYPE_FAMILY = Object.fromEntries(
  VISUAL_CATALOG.map((item) => [item.id, item.family || "grid"]),
);

/** Archetypes eligible for middle scenes (non-hook, non-outro). */
export const MIDDLE_ARCHS = VISUAL_CATALOG.filter(
  (item) => item.isMiddle !== false && item.id !== "hook" && item.id !== "outro",
).map((item) => item.id);

/** Deliberate aliases mapping alternative names to exact archetype IDs. */
export const ARCHETYPE_ALIASES = {};
for (const item of VISUAL_CATALOG) {
  if (item.aliases) {
    for (const alias of item.aliases) {
      ARCHETYPE_ALIASES[alias.toLowerCase().trim().replace(/_/g, "-")] = item.id;
    }
  }
}

/**
 * Register a new archetype dynamically into the single source of truth catalog.
 */
export function registerArchetype(entryOrId, maybeOptions = {}) {
  let entry = entryOrId;
  if (typeof entryOrId === "string") {
    entry = { id: entryOrId, ...maybeOptions };
  }
  if (!entry || !entry.id) {
    throw new Error("Archetype entry must specify an id");
  }
  const id = entry.id.toLowerCase().trim().replace(/_/g, "-");
  const normalizedEntry = {
    ...entry,
    id,
    family: entry.family || "grid",
    isMiddle: entry.isMiddle ?? (id !== "hook" && id !== "outro"),
  };

  const existingIdx = VISUAL_CATALOG.findIndex((it) => it.id === id);
  if (existingIdx >= 0) {
    VISUAL_CATALOG[existingIdx] = { ...VISUAL_CATALOG[existingIdx], ...normalizedEntry };
  } else {
    VISUAL_CATALOG.push(normalizedEntry);
  }

  archetypes.add(id);
  ARCHETYPE_FAMILY[id] = normalizedEntry.family;

  if (normalizedEntry.isMiddle && !MIDDLE_ARCHS.includes(id)) {
    MIDDLE_ARCHS.push(id);
  } else if (!normalizedEntry.isMiddle) {
    const idx = MIDDLE_ARCHS.indexOf(id);
    if (idx >= 0) MIDDLE_ARCHS.splice(idx, 1);
  }

  if (normalizedEntry.aliases) {
    for (const alias of normalizedEntry.aliases) {
      ARCHETYPE_ALIASES[alias.toLowerCase().trim().replace(/_/g, "-")] = id;
    }
  }
}

/**
 * Formats all registered archetypes dynamically into the director prompt.
 */
export function formatCatalogForPrompt() {
  return VISUAL_CATALOG.map((item) => {
    const hint = item.payloadHint ? ` (${item.payloadHint})` : "";
    return `   - "${item.id}": ${item.description}${hint}`;
  }).join("\n");
}
