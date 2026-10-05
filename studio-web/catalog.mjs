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
    aliases: [
      "impact-text",
      "full-bleed-typography",
      "word-slam",
      "condensed-title",
      "typographic-takeover",
    ],
  },
  {
    id: "stat-spotlight",
    family: "numeric",
    isMiddle: true,
    description:
      "Massive centered metric spotlight — one huge number (140px glow font), radiating conic/radial background glow, and concentric SVG pulse rings. Zero cards, zero clutter. Used to land a single decisive number with maximum cinematic weight.",
    payloadHint: "spotlightData: { value, unit, label, subLabel }",
    aliases: [
      "number-spotlight",
      "metric-spotlight",
      "focal-metric",
      "single-stat",
      "cinematic-metric",
    ],
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
  {
    id: "rag-retrieval-pipeline",
    family: "diagram",
    isMiddle: true,
    description:
      "Horizontal 5-stage RAG retrieval pipeline: Ingestion -> Chunking -> Embedding -> Vector Search -> Context Injection, with animated packet traversal.",
    payloadHint:
      "ragData: { stages: [{ name, detail }], queryText?: string, retrievedCount?: number }",
    aliases: ["rag-pipeline", "retrieval-pipeline", "vector-retrieval"],
  },
  {
    id: "agent-scratchpad",
    family: "feed",
    isMiddle: true,
    description:
      "ReAct agent cognitive reasoning loop featuring stylized step cards for Thought, Action, Observation, and Final Answer.",
    payloadHint:
      'agentData: { steps: [{ type: "thought"|"action"|"observation"|"answer", content, meta }] }',
    aliases: ["react-loop", "agent-reasoning", "thought-action-loop"],
  },
  {
    id: "prompt-budget-canvas",
    family: "numeric",
    isMiddle: true,
    description:
      "Stacked contextual token budget bar visualizing allocation across System Prompt, Few-Shot, RAG Context, Chat History, and Output Headroom.",
    payloadHint: "budgetData: { totalTokens: number, segments: [{ label, tokens, color }] }",
    aliases: ["token-budget", "context-window-breakdown", "prompt-tokens"],
  },
  {
    id: "embedding-similarity-space",
    family: "diagram",
    isMiddle: true,
    description:
      "2D vector similarity coordinate space plotting an anchor Query vector against candidate Document chunks with cosine similarity distance rings and rank table.",
    payloadHint:
      "similarityData: { queryLabel: string, candidates: [{ label, score, match: boolean }] }",
    aliases: ["cosine-similarity", "embedding-space", "similarity-matrix"],
  },
  {
    id: "tool-calling-schema",
    family: "device",
    isMiddle: true,
    description:
      "Split layout showcasing agent execution on the left and structured JSON function calling schema definition with types and validation badges on the right.",
    payloadHint:
      "toolData: { functionName: string, description: string, parameters: [{ name, type, desc, required: boolean }] }",
    aliases: ["function-calling", "tool-schema", "json-tool"],
  },
  {
    id: "context-window-gauge",
    family: "numeric",
    isMiddle: true,
    description:
      "High-impact horseshoe or radial context window gauge meter displaying active token consumption, ceiling limits, and compression thresholds.",
    payloadHint:
      'gaugeData: { currentTokens: number, maxTokens: number, label: string, status: "safe"|"warning"|"overflow" }',
    aliases: ["context-gauge", "token-meter", "capacity-gauge"],
  },
  {
    id: "eval-benchmark-matrix",
    family: "numeric",
    isMiddle: true,
    description:
      "Horizontal model evaluation benchmark leaderboard comparing model performance across MMLU, HumanEval, Math, and Latency metrics with delta badges.",
    payloadHint:
      "benchmarkData: { benchmarks: [{ name, scores: [{ model, score, isHero?: boolean }] }] }",
    aliases: ["model-leaderboard", "eval-matrix", "benchmark-bars"],
  },
  {
    id: "data-lineage-flow",
    family: "diagram",
    isMiddle: true,
    description:
      "End-to-end data lineage DAG tracking data transformations from Raw Sources through Cleaning & Feature Store to Serving APIs with animated throughput pulses.",
    payloadHint: "lineageData: { stages: [{ title, subtitle, items: [string] }] }",
    aliases: ["data-pipeline", "lineage-graph", "data-flow"],
  },
  {
    id: "microservice-mesh",
    family: "diagram",
    isMiddle: true,
    description:
      "Distributed microservice mesh topology showing API Gateway routing traffic to Auth, Core, Payment, and Async Worker services with latency metrics.",
    payloadHint: "meshData: { nodes: [{ id, label, role, status }], links: [{ from, to, label }] }",
    aliases: ["service-mesh", "microservices-graph", "distributed-architecture"],
  },
  {
    id: "database-shard-map",
    family: "diagram",
    isMiddle: true,
    description:
      "Distributed database partition map showing a consistent hash ring router distributing write and query throughput across storage shards.",
    payloadHint:
      "shardData: { routerKey: string, shards: [{ name, range, count, active?: boolean }] }",
    aliases: ["sharding-topology", "partition-map", "consistent-hashing"],
  },
  {
    id: "memory-layout-stack",
    family: "device",
    isMiddle: true,
    description:
      "Side-by-side memory architecture comparing Call Stack execution frames with Dynamic Heap object allocations and pointer references.",
    payloadHint:
      "memoryData: { stackFrames: [{ func, vars: [string] }], heapObjects: [{ addr, label }] }",
    aliases: ["stack-heap", "memory-layout", "call-stack"],
  },
  {
    id: "dag-pipeline",
    family: "diagram",
    isMiddle: true,
    description:
      "Directed Acyclic Graph (DAG) task execution pipeline with topological stage dependency resolution and dynamic task status states.",
    payloadHint:
      'dagData: { nodes: [{ id, label, status: "pending"|"running"|"done" }], edges: [[from, to]] }',
    aliases: ["dag-graph", "dependency-graph", "task-pipeline"],
  },
  {
    id: "event-bus-pubsub",
    family: "diagram",
    isMiddle: true,
    description:
      "Event-driven pub/sub message broker showing concurrent publishers pushing topic events and message consumer workers streaming offsets.",
    payloadHint: "eventData: { topic: string, events: [{ id, payload, targetConsumer }] }",
    aliases: ["pubsub-architecture", "message-queue", "kafka-stream"],
  },
  {
    id: "compiler-ast",
    family: "diagram",
    isMiddle: true,
    description:
      "Hierarchical compiler Abstract Syntax Tree (AST) visualizing token parsing from Program root into Statements, Expressions, and Binary Operators.",
    payloadHint: "astData: { root: { label, children: [{ label, type }] } }",
    aliases: ["syntax-tree", "parse-tree", "ast-diagram"],
  },
  {
    id: "raft-consensus",
    family: "diagram",
    isMiddle: true,
    description:
      "Distributed Raft consensus cluster showing Leader election, Follower heartbeat ping waves, and synchronized log entry replication.",
    payloadHint:
      'consensusData: { leaderId: string, nodes: [{ id, role: "leader"|"follower"|"candidate", term: number, logIndex: number }] }',
    aliases: ["raft-cluster", "quorum-nodes", "consensus-protocol"],
  },
  {
    id: "git-branch-graph",
    family: "diagram",
    isMiddle: true,
    description:
      "Git branching graph showing main branch, feature branches, commits with SHA badges, and merge commits.",
    payloadHint:
      "gitData: { branches: [{ name, color? }], commits: [{ id, branch, message, isMerge?: boolean }] }",
    aliases: ["git-graph", "branch-merge", "version-control-tree"],
  },
  {
    id: "browser-devtools",
    family: "device",
    isMiddle: true,
    description:
      "Browser developer tools panel with network waterfall requests, HTTP status badges, latency bars, and DOM element tree.",
    payloadHint:
      'devtoolsData: { tab: "network"|"console"|"elements", requests: [{ path, method, status, durationMs }] }',
    aliases: ["network-waterfall", "devtools-panel", "http-trace"],
  },
  {
    id: "security-threat-model",
    family: "diagram",
    isMiddle: true,
    description:
      "Zero-trust security architecture showing trust perimeters, authentication firewalls, token issuance, and blocked threat vectors.",
    payloadHint:
      "securityData: { zones: [{ name, trusted: boolean }], threats: [{ label, blocked: boolean }] }",
    aliases: ["threat-model", "zero-trust", "security-perimeter"],
  },
  {
    id: "kanban-sprint",
    family: "grid",
    isMiddle: true,
    description:
      "Linear-style sprint Kanban board with Todo, In Progress, and Done columns, card tags, estimates, and horizontal flow.",
    payloadHint: "kanbanData: { columns: [{ name, cards: [{ title, tag, estimate }] }] }",
    aliases: ["task-board", "sprint-kanban", "issue-tracker"],
  },
  {
    id: "changelog-timeline",
    family: "diagram",
    isMiddle: true,
    description:
      "Vertical product release timeline with version tags, release dates, feature highlight bullets, and breaking-change warning tags.",
    payloadHint:
      "changelogData: { releases: [{ version, date, highlights: string[], isLatest?: boolean }] }",
    aliases: ["release-notes", "version-history", "product-changelog"],
  },
  {
    id: "circuit-breaker-status",
    family: "diagram",
    isMiddle: true,
    description:
      "System resilience state machine displaying Closed (Normal), Open (Tripped), and Half-Open (Testing) states with failure rate threshold meters.",
    payloadHint:
      'circuitData: { state: "closed"|"open"|"half-open", failureRate: number, threshold: number }',
    aliases: ["circuit-breaker", "resilience-pattern", "fault-tolerance"],
  },
  {
    id: "rate-limiter-bucket",
    family: "diagram",
    isMiddle: true,
    description:
      "Token Bucket / Leaky Bucket algorithm container with incoming request drops, token replenishment pulses, and throttled packet exits.",
    payloadHint:
      "limiterData: { capacity: number, currentTokens: number, refillRate: string, droppedCount?: number }",
    aliases: ["token-bucket", "leaky-bucket", "traffic-shaping"],
  },
  {
    id: "audit-log-stream",
    family: "feed",
    isMiddle: true,
    description:
      "Real-time compliance/security audit event log table with timestamp offsets, actor badges, IP origin tags, action verbs, and status chips.",
    payloadHint: "auditData: { logs: [{ timestamp, actor, action, resource, status }] }",
    aliases: ["event-audit", "compliance-log", "security-events"],
  },
  {
    id: "confusion-matrix",
    family: "numeric",
    isMiddle: true,
    description:
      "2x2 classification matrix (True Positive, False Positive, False Negative, True Negative) with cell counts, color intensity mapping, and Precision/Recall/F1 metrics.",
    payloadHint:
      "matrixData: { tp: number, fp: number, fn: number, tn: number, metricLabels?: { precision, recall } }",
    aliases: ["classification-matrix", "error-matrix", "tp-fp-matrix"],
  },
  {
    id: "quantile-distribution",
    family: "numeric",
    isMiddle: true,
    description:
      "Probability distribution curve highlighting vertical percentile marker lines (p50, p90, p95, p99) and tail latency regions.",
    payloadHint: "quantileData: { p50: number, p90: number, p99: number, unit?: string }",
    aliases: ["percentile-distribution", "latency-quantiles", "bell-curve"],
  },
  {
    id: "radar-capability",
    family: "diagram",
    isMiddle: true,
    description:
      "Multi-axis polygonal radar/spider chart comparing model capabilities across reasoning, code, math, and context with translucent polygon fills.",
    payloadHint:
      "radarData: { axes: [{ name, maxVal }], series: [{ label, values: number[], isHero?: boolean }] }",
    aliases: ["spider-chart", "skill-radar", "benchmark-polygon"],
  },
  {
    id: "sankey-cost-flow",
    family: "diagram",
    isMiddle: true,
    description:
      "Directional flow diagram tracking total cloud/API budget branching into compute, model tokens, storage, and egress with proportional band widths.",
    payloadHint: "sankeyData: { total: string, streams: [{ source, target, value, label }] }",
    aliases: ["cost-breakdown", "token-spend-flow", "budget-sankey"],
  },
  {
    id: "cohort-retention-grid",
    family: "grid",
    isMiddle: true,
    description:
      "Stepped triangular cohort retention heatmap table with week-by-week user retention percentage tiles displaying color gradients.",
    payloadHint: "cohortData: { cohorts: [{ label, size, percentages: number[] }] }",
    aliases: ["retention-heatmap", "cohort-analysis", "user-retention-grid"],
  },
  {
    id: "multi-metric-dashboard",
    family: "numeric",
    isMiddle: true,
    description:
      "High-density monitoring dashboard composed of 4 KPI cards with live metric counters, delta change badges, and mini SVG sparklines.",
    payloadHint: "dashboardData: { metrics: [{ title, value, change, sparkline: number[] }] }",
    aliases: ["datadog-dashboard", "telemetry-grid", "kpi-sparklines"],
  },
  {
    id: "ab-test-confidence",
    family: "numeric",
    isMiddle: true,
    description:
      "Dual overlapping normal distribution curves comparing Variant A vs. Variant B with confidence interval bands, uplift percentage, and p-value statistical significance badge.",
    payloadHint:
      "abData: { variantA: { label, mean, conversion }, variantB: { label, mean, conversion }, pValue: number, significant: boolean }",
    aliases: ["ab-test", "statistical-significance", "variant-comparison"],
  },
  // Manim primitives: rendered by a Python worker, not HTML. They are director-selectable
  // but never part of random rotation (a rotated pick would have no brief to render).
  {
    id: "manim-function-plot",
    family: "math-anim",
    engine: "manim",
    isMiddle: true,
    description:
      "MATH ANIMATION (Manim). Animated 2D function graph with optional tangent line, shaded area, and morph into a second curve. ONLY for calculus/algebra/physics beats where a curve changing IS the explanation. Never for marketing or UI beats.",
    payloadHint:
      'manimData: { title, expr (x, numbers, + - * / ^, sin cos tan exp log sqrt abs, pi), xRange: [a, b], tangentAt?, area?: [a, b], expr2? }, beats: ["narration sentence", ...] (1-6), fallbackArchetype: "bento-metric-grid", fallbackPayload: { bentoData }',
    aliases: ["function-plot", "graph-plot", "calculus-plot"],
  },
  {
    id: "manim-vector-transform",
    family: "math-anim",
    engine: "manim",
    isMiddle: true,
    description:
      "MATH ANIMATION (Manim). A 2x2 matrix transforming the plane: grid warp, basis vectors, a sample vector and an optional projection onto a line. ONLY for linear-algebra beats (transformations, shear, rotation, projection).",
    payloadHint:
      'manimData: { title, matrix: [[a, b], [c, d]], vector?: [x, y], projectOnto?: [x, y], showBasis? }, beats: ["narration sentence", ...], fallbackArchetype: "vector-cluster-graph", fallbackPayload: { clusters, stats }',
    aliases: ["matrix-transform", "linear-transform", "vector-projection"],
  },
  {
    id: "manim-network-topology",
    family: "math-anim",
    engine: "manim",
    isMiddle: true,
    description:
      "MATH ANIMATION (Manim). Layered neural network with a forward-pass pulse, OR a graph traversal (BFS/DFS) lighting nodes in visit order. ONLY for ML architecture or graph-algorithm beats.",
    payloadHint:
      'manimData: { title, layers: [3,5,4,2], labels?: [..] } OR { title, nodes: ["A","B",..], edges: [[0,1],..], start?, algorithm?: "bfs"|"dfs" }, beats: ["narration sentence", ...], fallbackArchetype: "vector-cluster-graph", fallbackPayload: { clusters, stats }',
    aliases: ["neural-network", "graph-traversal", "network-graph"],
  },
  {
    id: "manim-transformer-block",
    family: "math-anim",
    engine: "manim",
    isMiddle: true,
    description:
      "MATH ANIMATION (Manim). Vertical architectural transformer column (Embedding -> Multi-Head Attention -> Add & Norm -> Feed Forward -> Add & Norm) with an animated residual skip connection. ONLY for transformer architecture beats.",
    payloadHint:
      'manimData: { title, layers?: ["Embedding", "Attention", ...], highlight?: "attention"|"ffn"|"residual" }, beats: ["sentence 1", ...], fallbackArchetype: "step-progression"',
    aliases: ["transformer-layer", "transformer-architecture", "attention-block"],
  },
  {
    id: "manim-kv-cache",
    family: "math-anim",
    engine: "manim",
    isMiddle: true,
    description:
      "MATH ANIMATION (Manim). KV Cache memory grid for LLM inference showing prompt ingestion and incremental token generation without recomputing past key/value vectors. ONLY for LLM inference or KV cache beats.",
    payloadHint:
      'manimData: { title, promptTokens: ["The", "quick"], generatedTokens: ["brown", "fox"] }, beats: ["sentence 1", ...], fallbackArchetype: "step-progression"',
    aliases: ["kvcache", "key-value-cache", "autoregressive-cache"],
  },
  {
    id: "manim-positional-rope",
    family: "math-anim",
    engine: "manim",
    isMiddle: true,
    description:
      "MATH ANIMATION (Manim). Rotary Position Embedding (RoPE) coordinate planes showing query/key vector pairs rotating by angles proportional to token position. ONLY for position encoding or RoPE beats.",
    payloadHint:
      'manimData: { title, angle1?: 30, angle2?: 75 }, beats: ["sentence 1", ...], fallbackArchetype: "vector-cluster-graph"',
    aliases: ["rotary-embedding", "rope-embedding", "rotary-positional"],
  },
  {
    id: "manim-token-unembedding",
    family: "math-anim",
    engine: "manim",
    isMiddle: true,
    description:
      "MATH ANIMATION (Manim). Hidden-state vector projecting through an unembedding matrix funnel and expanding into a Softmax token probability histogram. ONLY for output projection, vocabulary logits, or sampling beats.",
    payloadHint:
      'manimData: { title, topTokens: [{ token: "word", prob: 0.72 }, ...] }, beats: ["sentence 1", ...], fallbackArchetype: "data-graph"',
    aliases: ["unembedding", "token-projection", "lm-head", "vocabulary-projection"],
  },
  {
    id: "manim-residual-stream",
    family: "math-anim",
    engine: "manim",
    isMiddle: true,
    description:
      "MATH ANIMATION (Manim). Central vertical residual stream highway with attention and MLP sub-blocks reading inputs and accumulating state updates via addition badges (+). ONLY for residual stream or transformer depth beats.",
    payloadHint:
      'manimData: { title, stages?: ["Attention 1", "MLP 1", ...] }, beats: ["sentence 1", ...], fallbackArchetype: "architecture-pipeline"',
    aliases: ["residual-highway", "residual-connections", "stream-architecture"],
  },
  {
    id: "manim-temperature-softmax",
    family: "math-anim",
    engine: "manim",
    isMiddle: true,
    description:
      "MATH ANIMATION (Manim). Animated Softmax temperature slider morphing raw logits from sharp argmax (low T) to uniform distribution (high T). ONLY for Softmax, temperature, or sampling entropy beats.",
    payloadHint:
      'manimData: { title, logits: [2.0, 1.0, 0.5, 3.2], temperature?: 0.5 }, beats: ["sentence 1", ...], fallbackArchetype: "data-graph"',
    aliases: ["temperature-scaling", "softmax-temperature", "logit-temperature"],
  },
  {
    id: "manim-gradient-descent-3d",
    family: "math-anim",
    engine: "manim",
    isMiddle: true,
    description:
      "MATH ANIMATION (Manim). 2D loss surface contours with gradient vectors and an iterative optimizer particle descending downhill with momentum into the local minimum. ONLY for optimization or gradient descent beats.",
    payloadHint:
      'manimData: { title, steps?: 5, momentum?: true }, beats: ["sentence 1", ...], fallbackArchetype: "vector-cluster-graph"',
    aliases: ["gradient-descent", "loss-surface", "contour-optimization", "optimization-descent"],
  },
  {
    id: "manim-backprop-chain",
    family: "math-anim",
    engine: "manim",
    isMiddle: true,
    description:
      "MATH ANIMATION (Manim). Forward-backward computational graph with activations flowing forward (left to right) and gradient chain-rule pulses flowing backward (right to left). ONLY for backpropagation or autograd beats.",
    payloadHint:
      'manimData: { title, nodeNames?: ["x, y", "z = x * y", "loss L"] }, beats: ["sentence 1", ...], fallbackArchetype: "flowchart-process"',
    aliases: ["backpropagation", "computation-graph", "autograd", "chain-rule"],
  },
  {
    id: "manim-convolution-kernel",
    family: "math-anim",
    engine: "manim",
    isMiddle: true,
    description:
      "MATH ANIMATION (Manim). 2D convolution sliding kernel moving across an input pixel matrix and lighting up corresponding receptive fields in an output feature map. ONLY for CNN, filter, or receptive field beats.",
    payloadHint:
      'manimData: { title, kernelSize?: 3, stride?: 1 }, beats: ["sentence 1", ...], fallbackArchetype: "bento-grid"',
    aliases: ["cnn-kernel", "feature-map", "conv2d", "convolution-sliding"],
  },
  {
    id: "manim-svd-transform",
    family: "math-anim",
    engine: "manim",
    isMiddle: true,
    description:
      "MATH ANIMATION (Manim). Geometric Singular Value Decomposition (A = U Sigma V^T) transforming unit circle and basis vectors via rotation, singular value stretching, and final rotation. ONLY for SVD, PCA, or matrix factor beats.",
    payloadHint:
      'manimData: { title, sigma?: [2.2, 0.8] }, beats: ["sentence 1", ...], fallbackArchetype: "vector-cluster-graph"',
    aliases: ["singular-value-decomposition", "svd", "matrix-factorization"],
  },
  {
    id: "manim-latent-manifold",
    family: "math-anim",
    engine: "manim",
    isMiddle: true,
    description:
      "MATH ANIMATION (Manim). Non-linear curved latent manifold surface where two latent vector points interpolate along a geodesic curve. ONLY for latent space or manifold geometry beats.",
    payloadHint:
      'manimData: { title, interpolationSteps?: 5, showGeodesic?: true }, beats: ["sentence 1", ...], fallbackArchetype: "vector-cluster-graph"',
    aliases: ["latent-space", "manifold-interpolation", "latent-geometry"],
  },
  {
    id: "manim-eigen-decomposition",
    family: "math-anim",
    engine: "manim",
    isMiddle: true,
    description:
      "MATH ANIMATION (Manim). 2D coordinate grid with eigenvectors maintaining invariant directional spans while circle stretches along eigenvalues. ONLY for eigenvalue or spectral beats.",
    payloadHint:
      'manimData: { title, eigenvalues: [2.0, 0.7], showGrid?: true }, beats: ["sentence 1", ...], fallbackArchetype: "manim-vector-transform"',
    aliases: ["eigenvalues", "eigenvectors", "spectral-decomposition"],
  },
  {
    id: "manim-activation-functions",
    family: "math-anim",
    engine: "manim",
    isMiddle: true,
    description:
      "MATH ANIMATION (Manim). 2D axes rendering activation curves (ReLU, GeLU, Sigmoid, SwiGLU) with animated input probe highlighting linear vs saturated regions. ONLY for activation function beats.",
    payloadHint:
      'manimData: { title, functionType: "relu"|"gelu"|"sigmoid"|"swiglu", showDerivative?: false }, beats: ["sentence 1", ...], fallbackArchetype: "manim-function-plot"',
    aliases: ["activation-curve", "relu-gelu", "neuron-activation"],
  },
  {
    id: "manim-dot-cross-product",
    family: "math-anim",
    engine: "manim",
    isMiddle: true,
    description:
      "MATH ANIMATION (Manim). Two vectors originating from origin animating scalar projection drop line or cross-product parallelogram area. ONLY for vector dot/cross product beats.",
    payloadHint:
      'manimData: { title, mode: "dot"|"cross", vectorA: [2.6, 0.4], vectorB: [1.2, 1.8] }, beats: ["sentence 1", ...], fallbackArchetype: "manim-vector-transform"',
    aliases: ["vector-projection", "dot-product", "cross-product"],
  },
  {
    id: "manim-hyperplane-separator",
    family: "math-anim",
    engine: "manim",
    isMiddle: true,
    description:
      "MATH ANIMATION (Manim). 2D scatter of two colored classes with a separating hyperplane rotating into optimal maximum-margin boundary with support vectors. ONLY for SVM or classification boundary beats.",
    payloadHint:
      'manimData: { title, marginWidth?: 0.6, showSupportVectors?: true }, beats: ["sentence 1", ...], fallbackArchetype: "embedding-similarity-space"',
    aliases: ["svm-hyperplane", "decision-boundary", "linear-separator"],
  },
  {
    id: "manim-basis-change",
    family: "math-anim",
    engine: "manim",
    isMiddle: true,
    description:
      "MATH ANIMATION (Manim). Standard Cartesian basis vectors morphing into new skewed basis transforming coordinate grid lines beneath an invariant vector. ONLY for basis change or coordinate transform beats.",
    payloadHint:
      'manimData: { title, basis1: [1.5, 0.5], basis2: [0.4, 1.4] }, beats: ["sentence 1", ...], fallbackArchetype: "manim-vector-transform"',
    aliases: ["change-of-basis", "coordinate-transform", "basis-vectors"],
  },
  {
    id: "manim-sorting-visualizer",
    family: "math-anim",
    engine: "manim",
    isMiddle: true,
    description:
      "MATH ANIMATION (Manim). Horizontal bar array highlighting, comparing, and partitioning elements via QuickSort or MergeSort into sorted order. ONLY for sorting algorithm beats.",
    payloadHint:
      'manimData: { title, array: [6, 2, 8, 4, 9, 3, 5], algorithm?: "quicksort"|"mergesort" }, beats: ["sentence 1", ...], fallbackArchetype: "data-graph"',
    aliases: ["sorting-algorithm", "quicksort-visual", "array-sort"],
  },
  {
    id: "manim-monte-carlo-pi",
    family: "math-anim",
    engine: "manim",
    isMiddle: true,
    description:
      "MATH ANIMATION (Manim). Unit square bounding quarter-circle with random sample pulses and running ratio convergence tracking Pi. ONLY for Monte Carlo or stochastic sampling beats.",
    payloadHint:
      'manimData: { title, pointCount?: 36, targetRatio?: 0.785 }, beats: ["sentence 1", ...], fallbackArchetype: "data-graph"',
    aliases: ["monte-carlo", "pi-estimation", "random-sampling"],
  },
  {
    id: "manim-markov-chain",
    family: "math-anim",
    engine: "manim",
    isMiddle: true,
    description:
      "MATH ANIMATION (Manim). Directed 3-node state graph with transition probability arrows and token particle transitions converging to stationary distribution. ONLY for Markov process beats.",
    payloadHint:
      'manimData: { title, states: ["A", "B", "C"], transitions?: [[0, 1, 0.7]] }, beats: ["sentence 1", ...], fallbackArchetype: "dag-pipeline"',
    aliases: ["markov-process", "state-machine", "transition-matrix"],
  },
  {
    id: "manim-bayes-theorem",
    family: "math-anim",
    engine: "manim",
    isMiddle: true,
    description:
      "MATH ANIMATION (Manim). Unit area box divided into prior probability sections with an evidence conditioning window isolating the posterior probability region. ONLY for Bayes rule beats.",
    payloadHint:
      'manimData: { title, priorA: 0.35, likelihoodBGivenA: 0.8 }, beats: ["sentence 1", ...], fallbackArchetype: "confusion-matrix"',
    aliases: ["bayes-rule", "conditional-probability", "bayesian-update"],
  },
];

/** Set of all allowed archetype IDs. */
export const archetypes = new Set(VISUAL_CATALOG.map((item) => item.id));

/** Visual families mapped by archetype ID. */
export const ARCHETYPE_FAMILY = Object.fromEntries(
  VISUAL_CATALOG.map((item) => [item.id, item.family || "grid"]),
);

/** Archetypes eligible for middle scenes (non-hook, non-outro). */
export const MIDDLE_ARCHS = VISUAL_CATALOG.filter((a) => a.isMiddle).map((a) => a.id);

/** Archetypes rendered by the Manim worker rather than HTML/GSAP. */
export const MANIM_ARCHETYPES = VISUAL_CATALOG.filter((item) => item.engine === "manim").map(
  (item) => item.id,
);

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
export function formatCatalogForPrompt({ manim = true } = {}) {
  return VISUAL_CATALOG.filter((item) => manim || item.engine !== "manim")
    .map((item) => {
      const hint = item.payloadHint ? ` (${item.payloadHint})` : "";
      return `   - "${item.id}": ${item.description}${hint}`;
    })
    .join("\n");
}
