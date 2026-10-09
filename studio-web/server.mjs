import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { lookup } from "node:dns/promises";
import https from "node:https";
import { isIP } from "node:net";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import {
  parseVideoRange,
  validateStoryboard,
  validateProductionInput,
  validateTopicInput,
  isPublicAddress,
} from "./quality.mjs";
import {
  VISUAL_CATALOG,
  formatCatalogForPrompt,
  archetypes,
  MIDDLE_ARCHS,
  registerArchetype,
} from "./catalog.mjs";
import {
  FPS,
  computeSceneFrames,
  buildFrameTimeline,
  normalizeSegment,
  assertNotBlank,
  concatenateSegments,
  assembleMasterAudio,
  muxMasterVideo,
} from "./stitcher.mjs";
import { checkManimCapability } from "./engines/manim/capability.mjs";
import { runManimScene } from "./engines/manim/runner.mjs";
import { sanitizePalette } from "./engines/manim/planner.mjs";
import { normalizeManimClip } from "./engines/manim/normalize.mjs";
import { degradeScene } from "./engines/manim/degrade.mjs";
import { beatFrames } from "./engines/manim/schema.mjs";
import { generateManimSkillCode } from "./engines/manim/skill_generator.mjs";
import { repairAndRender } from "./engines/manim/repair.mjs";
import {
  ARCHETYPE_RENDERERS,
  registerArchetypeRenderer,
  getArchetypeRenderer,
  renderDefaultCards,
  highlightCodeTokens,
  resolveScenePalette,
} from "./renderers.mjs";
import { PALETTES, PALETTE_LIST, DESIGNER_PALETTES } from "./palettes.mjs";
import { SOUNDTRACKS, SOUNDTRACK_MAP } from "./soundtracks.mjs";

export {
  buildSegmentHtml,
  renderHtmlSegment,
  ARCHETYPE_RENDERERS,
  registerArchetypeRenderer,
  getArchetypeRenderer,
  highlightCodeTokens,
  resolveScenePalette,
  VISUAL_CATALOG,
  formatCatalogForPrompt,
  archetypes,
  MIDDLE_ARCHS,
  registerArchetype,
  PALETTES,
  PALETTE_LIST,
  DESIGNER_PALETTES,
  SOUNDTRACKS,
  SOUNDTRACK_MAP,
};

// Load environment variables from .env file (skip in automated tests)
if (process.env.NODE_ENV !== "test") {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const envCandidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(__dirname, "..", ".env"),
    path.resolve(__dirname, ".env"),
  ];
  for (const envPath of envCandidates) {
    if (fs.existsSync(envPath)) {
      try {
        if (typeof process.loadEnvFile === "function") {
          process.loadEnvFile(envPath);
        } else {
          const raw = fs.readFileSync(envPath, "utf8");
          for (const line of raw.split("\n")) {
            const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
            if (m && !process.env[m[1]]) {
              let v = (m[2] || "").trim();
              if (
                (v.startsWith('"') && v.endsWith('"')) ||
                (v.startsWith("'") && v.endsWith("'"))
              ) {
                v = v.slice(1, -1);
              }
              process.env[m[1]] = v;
            }
          }
        }
      } catch {
        // ignore
      }
    }
  }
}

// Ensure bun and local CLI tools are automatically on PATH
const bunPath = path.join(os.homedir(), ".bun", "bin");
if (!process.env.PATH.includes(bunPath)) {
  process.env.PATH = `${bunPath}${path.delimiter}${process.env.PATH}`;
}

const require = createRequire(import.meta.url);

// pdf-parse v2 exports a named `PDFParse` class — it has no callable default
// export, so `require("pdf-parse")(buffer)` throws. Bind the class instead.
let PDFParse = null;
try {
  PDFParse = require("pdf-parse").PDFParse;
} catch {
  PDFParse = null;
}

const execFileAsync = promisify(execFile);

// Resolve an executable from PATH so the pipeline is not tied to one machine's
// Homebrew prefix (previously ffprobe was hardcoded to /opt/homebrew/bin).
function resolveBin(name) {
  const suffixes = process.platform === "win32" ? [".exe", ".cmd", ".bat", ""] : [""];
  for (const dir of (process.env.PATH || "").split(path.delimiter)) {
    if (!dir) continue;
    for (const suffix of suffixes) {
      const candidate = path.join(dir, name + suffix);
      try {
        fs.accessSync(candidate, fs.constants.X_OK);
        return candidate;
      } catch {
        // not here — keep looking
      }
    }
  }
  return null;
}

function requireBin(name, hint) {
  const found = resolveBin(name);
  if (!found) throw new Error(`${name} was not found on PATH — ${hint}`);
  return found;
}

// Instant WAV duration extraction directly from header bytes (0.01ms vs 300ms ffprobe process spawn)
function getWavDurationFast(filePath) {
  try {
    const buffer = Buffer.alloc(44);
    const fd = fs.openSync(filePath, "r");
    fs.readSync(fd, buffer, 0, 44, 0);
    fs.closeSync(fd);
    const byteRate = buffer.readUInt32LE(28);
    const stat = fs.statSync(filePath);
    if (byteRate > 0) {
      return parseFloat(((stat.size - 44) / byteRate).toFixed(2));
    }
  } catch {}
  return null;
}

const PORT = process.env.PORT || 4000;
// Bind to loopback by default: this server has no auth and spends API credits.
const HOST = process.env.HOST || "127.0.0.1";
// Resolve the repo root from this file so the server works from any cwd.
const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Python created by `bun run setup` (has kokoro-onnx). An explicit CHALKFRAMES_PYTHON wins.
const VENV_PYTHON = path.join(
  ROOT_DIR,
  ".venv",
  process.platform === "win32" ? "Scripts" : "bin",
  process.platform === "win32" ? "python.exe" : "python",
);

// The repo's own CLI build, so a fresh clone works without a global `chalkframes` on PATH.
const LOCAL_CLI = path.join(ROOT_DIR, "packages", "cli", "bin", "chalkframes.mjs");

// Env for every child process, with the bun bin dir guaranteed present.
function childEnv() {
  const env = { ...process.env, PATH: `${bunPath}${path.delimiter}${process.env.PATH}` };
  if (!env.CHALKFRAMES_PYTHON && fs.existsSync(VENV_PYTHON)) env.CHALKFRAMES_PYTHON = VENV_PYTHON;
  return env;
}

export const PUBLIC_DIR = path.join(ROOT_DIR, "studio-web", "public");
export const RENDERS_DIR = path.join(ROOT_DIR, "studio-web", "renders");
export const PROJECTS_DIR = path.join(ROOT_DIR, "projects");

if (!fs.existsSync(RENDERS_DIR)) fs.mkdirSync(RENDERS_DIR, { recursive: true });
if (!fs.existsSync(PROJECTS_DIR)) fs.mkdirSync(PROJECTS_DIR, { recursive: true });

// Keep completed/error events briefly so clients connecting after a fast failure
// still receive the result. Only one resource-intensive render runs at a time.
const jobListeners = new Map();
const jobEvents = new Map();
const MAX_ACTIVE_JOBS = 1;
let activeJobs = 0;

function broadcastEvent(jobId, eventData) {
  const history = jobEvents.get(jobId);
  if (history) {
    history.push(eventData);
    if (history.length > 100) history.shift();
  }
  const listeners = jobListeners.get(jobId);
  if (!listeners) return;
  const payload = `data: ${JSON.stringify(eventData)}\n\n`;
  for (const res of listeners) {
    if (!res.destroyed) res.write(payload);
    if (eventData.status === "error" || eventData.node === "complete") res.end();
  }
}

// Keepalive heartbeat for long-running renders (prevents proxy / browser socket timeouts on 5-15m videos)
setInterval(() => {
  for (const [, listeners] of jobListeners) {
    if (!listeners) continue;
    for (const res of listeners) {
      if (!res.destroyed) {
        res.write(": keepalive\n\n");
      }
    }
  }
}, 15000).unref();

// Voices list
const VOICES = [
  {
    id: "bm_george",
    name: "George",
    gender: "Male",
    accent: "British",
    desc: "Warm, measured, literary",
    sample: "/samples/bm_george.wav",
  },
  {
    id: "af_heart",
    name: "Heart",
    gender: "Female",
    accent: "American",
    desc: "Clean, natural, warm",
    sample: "/samples/af_heart.wav",
  },
  {
    id: "af_nova",
    name: "Nova",
    gender: "Female",
    accent: "American",
    desc: "Crisp, dynamic, bright",
    sample: "/samples/af_nova.wav",
  },
  {
    id: "bf_isabella",
    name: "Isabella",
    gender: "Female",
    accent: "British",
    desc: "Refined, articulate, polished",
    sample: "/samples/bf_isabella.wav",
  },
  {
    id: "am_adam",
    name: "Adam",
    gender: "Male",
    accent: "American",
    desc: "Deep, confident, steady",
    sample: "/samples/am_adam.wav",
  },
  {
    id: "bf_emma",
    name: "Emma",
    gender: "Female",
    accent: "British",
    desc: "Calm, thoughtful, direct",
    sample: "/samples/bf_emma.wav",
  },
  {
    id: "am_michael",
    name: "Michael",
    gender: "Male",
    accent: "American",
    desc: "Conversational, clear",
    sample: "/samples/am_michael.wav",
  },
  {
    id: "af_bella",
    name: "Bella",
    gender: "Female",
    accent: "American",
    desc: "American female voice",
    sample: "/samples/af_bella.wav",
  },
  {
    id: "af_sarah",
    name: "Sarah",
    gender: "Female",
    accent: "American",
    desc: "American female voice",
    sample: "/samples/af_sarah.wav",
  },
  {
    id: "af_sky",
    name: "Sky",
    gender: "Female",
    accent: "American",
    desc: "American female voice",
    sample: "/samples/af_sky.wav",
  },
  {
    id: "af_nicole",
    name: "Nicole",
    gender: "Female",
    accent: "American",
    desc: "American female voice",
    sample: "/samples/af_nicole.wav",
  },
  {
    id: "af_alloy",
    name: "Alloy",
    gender: "Female",
    accent: "American",
    desc: "American female voice",
    sample: "/samples/af_alloy.wav",
  },
  {
    id: "af_aoede",
    name: "Aoede",
    gender: "Female",
    accent: "American",
    desc: "American female voice",
    sample: "/samples/af_aoede.wav",
  },
  {
    id: "af_jessica",
    name: "Jessica",
    gender: "Female",
    accent: "American",
    desc: "American female voice",
    sample: "/samples/af_jessica.wav",
  },
  {
    id: "af_kore",
    name: "Kore",
    gender: "Female",
    accent: "American",
    desc: "American female voice",
    sample: "/samples/af_kore.wav",
  },
  {
    id: "af_river",
    name: "River",
    gender: "Female",
    accent: "American",
    desc: "American female voice",
    sample: "/samples/af_river.wav",
  },
  {
    id: "am_echo",
    name: "Echo",
    gender: "Male",
    accent: "American",
    desc: "American male voice",
    sample: "/samples/am_echo.wav",
  },
  {
    id: "am_eric",
    name: "Eric",
    gender: "Male",
    accent: "American",
    desc: "American male voice",
    sample: "/samples/am_eric.wav",
  },
  {
    id: "am_fenrir",
    name: "Fenrir",
    gender: "Male",
    accent: "American",
    desc: "American male voice",
    sample: "/samples/am_fenrir.wav",
  },
  {
    id: "am_liam",
    name: "Liam",
    gender: "Male",
    accent: "American",
    desc: "American male voice",
    sample: "/samples/am_liam.wav",
  },
  {
    id: "am_onyx",
    name: "Onyx",
    gender: "Male",
    accent: "American",
    desc: "American male voice",
    sample: "/samples/am_onyx.wav",
  },
  {
    id: "am_puck",
    name: "Puck",
    gender: "Male",
    accent: "American",
    desc: "American male voice",
    sample: "/samples/am_puck.wav",
  },
  {
    id: "bf_alice",
    name: "Alice",
    gender: "Female",
    accent: "British",
    desc: "British female voice",
    sample: "/samples/bf_alice.wav",
  },
  {
    id: "bf_lily",
    name: "Lily",
    gender: "Female",
    accent: "British",
    desc: "British female voice",
    sample: "/samples/bf_lily.wav",
  },
  {
    id: "bm_daniel",
    name: "Daniel",
    gender: "Male",
    accent: "British",
    desc: "British male voice",
    sample: "/samples/bm_daniel.wav",
  },
  {
    id: "bm_fable",
    name: "Fable",
    gender: "Male",
    accent: "British",
    desc: "British male voice",
    sample: "/samples/bm_fable.wav",
  },
  {
    id: "bm_lewis",
    name: "Lewis",
    gender: "Male",
    accent: "British",
    desc: "British male voice",
    sample: "/samples/bm_lewis.wav",
  },
];

// Curated OpenRouter Models with real-time pricing
// Curated OpenRouter models: current, moderately priced director models.
// IDs and prices were checked against the live OpenRouter catalogue (per 1M tokens).
const MODELS = [
  {
    id: "anthropic/claude-haiku-5.5",
    name: "Claude Haiku 5.5",
    price: "$0.10 / $0.50 per 1M",
    badge: "Fast & Reliable",
  },
  {
    id: "google/gemini-3.5-flash-lite",
    name: "Gemini 3.5 Flash Lite",
    price: "$0.30 / $2.50 per 1M",
    badge: "Fast Economy",
  },
  {
    id: "google/gemini-3-flash-preview",
    name: "Gemini 3 Flash Preview",
    price: "$0.50 / $3.00 per 1M",
    badge: "Balanced Speed",
  },
  {
    id: "deepseek/deepseek-v4-pro",
    name: "DeepSeek V4 Pro",
    price: "$0.29 / $0.59 per 1M",
    badge: "Best Value Reasoning",
  },
  {
    id: "deepseek/deepseek-v3.2",
    name: "DeepSeek V3.2",
    price: "$0.26 / $0.42 per 1M",
    badge: "Lowest Output Cost",
  },
  {
    id: "qwen/qwen3.7-plus",
    name: "Qwen 3.7 Plus",
    price: "$0.32 / $1.28 per 1M",
    badge: "Strong Structured Output",
  },
  {
    id: "moonshotai/kimi-k2.6",
    name: "Kimi K2.6",
    price: "$0.44 / $2.45 per 1M",
    badge: "Long Context",
  },
  {
    id: "x-ai/grok-4.3",
    name: "Grok 4.3",
    price: "$1.25 / $2.50 per 1M",
    badge: "High Velocity",
  },
  {
    id: "openai/gpt-6-luna",
    name: "GPT-6 Luna",
    price: "$0.10 / $0.50 per 1M",
    badge: "Ultra Budget",
  },
];

// Calculate Scene Breakdown based on requested total seconds (15s up to 10m / 600s)
// Pacing calibrated so visual beats change every 12 to 25 seconds, keeping long videos dynamic.
// 18 distinct narrative beats for middle scenes with semantic narrative intent
export const MIDDLE_THEME_POOL = [
  {
    role: "spatial3d",
    title: "3D Spatial Architecture & Core Engine",
    narrativeIntent: "Showcase the fundamental architecture using procedural 3D motion",
    suggestedArchetypes: ["3d-motion-hero", "isometric-stack", "vector-cluster-graph"],
  },
  {
    role: "carousel",
    title: "Multi-Feature Showcase & Ecosystem",
    narrativeIntent: "Highlight multi-feature capabilities in an orbiting revolving carousel",
    suggestedArchetypes: ["carousel-3d-showcase", "radial-orbit", "bento-metric-grid"],
  },
  {
    role: "code",
    title: "Developer Walkthrough & CLI Execution",
    narrativeIntent: "Walk through developer interfaces, syntax, or commands",
    suggestedArchetypes: ["code-slice-reveal", "code-terminal", "interactive-diff"],
  },
  {
    role: "metrics",
    title: "Quantitative Benchmarks & Throughput",
    narrativeIntent: "Display comparative throughput metrics or growth numbers",
    suggestedArchetypes: ["kpi-counter-ring", "stat-spotlight", "multi-metric-dashboard"],
  },
  {
    role: "paradigm",
    title: "Mental Model & Core Paradigm",
    narrativeIntent: "Explain the fundamental shift or mental model",
    suggestedArchetypes: ["3d-motion-hero", "vector-cluster-graph", "kinetic-impact"],
  },
  {
    role: "mechanism",
    title: "System Execution & Logic Flow",
    narrativeIntent: "Illustrate step-by-step mechanisms and algorithmic flow",
    suggestedArchetypes: ["flowchart-process", "step-ladder", "step-progression"],
  },
  {
    role: "impact",
    title: "Quantitative Performance Multipliers",
    narrativeIntent: "Highlight quantitative benchmarks and tangible performance leaps",
    suggestedArchetypes: ["kinetic-impact", "kinetic-text", "stat-spotlight"],
  },
  {
    role: "contrast",
    title: "Comparative Analysis: Old vs Modern",
    narrativeIntent: "Contrast legacy friction against the modern paradigm",
    suggestedArchetypes: ["split-comparison", "interactive-diff", "ab-test-confidence"],
  },
  {
    role: "ecosystem",
    title: "Autonomous Orchestration Engine",
    narrativeIntent: "Showcase the interconnected ecosystem or node topology",
    suggestedArchetypes: ["carousel-3d-showcase", "radial-orbit", "microservice-mesh"],
  },
  {
    role: "architecture",
    title: "3D Layered Infrastructure Stack",
    narrativeIntent: "Break down the architectural stack and layer responsibilities",
    suggestedArchetypes: ["3d-motion-hero", "isometric-stack", "architecture-pipeline"],
  },
  {
    role: "milestones",
    title: "Production Deployment Patterns",
    narrativeIntent: "Walk through lifecycle stages or deployment milestones",
    suggestedArchetypes: ["step-ladder", "step-progression", "changelog-timeline"],
  },
  {
    role: "telemetry",
    title: "Live Streaming & Event Verification",
    narrativeIntent: "Demonstrate realtime activity stream and event processing",
    suggestedArchetypes: ["live-feed", "agent-scratchpad", "chat-exchange"],
  },
  {
    role: "pillars",
    title: "Three Modular Architectural Pillars",
    narrativeIntent: "Present the core architectural pillars and modular design",
    suggestedArchetypes: ["carousel-3d-showcase", "isometric-stack", "bento-grid"],
  },
  {
    role: "comparison",
    title: "Comparative Old vs Modern Paradigms",
    narrativeIntent: "Direct head-to-head comparison of approaches",
    suggestedArchetypes: ["split-comparison", "interactive-diff", "ab-test-confidence"],
  },
  {
    role: "axiom",
    title: "Key Principles & Architectural Axioms",
    narrativeIntent: "Emphasize a core philosophical principle or architectural axiom",
    suggestedArchetypes: ["quote-callout", "kinetic-impact", "stat-spotlight"],
  },
  {
    role: "dialogue",
    title: "Autonomous Agent State Negotiation",
    narrativeIntent: "Display simulated agent conversation or message exchange",
    suggestedArchetypes: ["chat-exchange", "agent-scratchpad", "live-feed"],
  },
  {
    role: "mobile",
    title: "Mobile & Realtime Interactive Experience",
    narrativeIntent: "Showcase the responsive app interface or mobile UX",
    suggestedArchetypes: ["mobile-mockup", "carousel-3d-showcase"],
  },
  {
    role: "velocity",
    title: "Execution Speed & Latency Gains",
    narrativeIntent: "Focus on speedups, latency reduction, and velocity",
    suggestedArchetypes: ["stat-spotlight", "kpi-counter-ring", "quantile-distribution"],
  },
  {
    role: "pipeline",
    title: "End-to-End Orchestration Nodes",
    narrativeIntent: "Illustrate the multi-node data or processing pipeline",
    suggestedArchetypes: ["architecture-pipeline", "dag-pipeline", "rag-retrieval-pipeline"],
  },
  {
    role: "features",
    title: "Core Capabilities & Feature Matrix",
    narrativeIntent: "Showcase core capabilities and modular features",
    suggestedArchetypes: ["carousel-3d-showcase", "bento-grid", "features-cards"],
  },
  {
    role: "mesh",
    title: "Microservice Topology & Event Bus",
    narrativeIntent: "Showcase distributed node mesh and pub/sub message routing",
    suggestedArchetypes: ["microservice-mesh", "event-bus-pubsub", "architecture-pipeline"],
  },
  {
    role: "storage",
    title: "Database Sharding & Memory Layout",
    narrativeIntent: "Illustrate database partitions, memory buffers, and consistency",
    suggestedArchetypes: ["database-shard-map", "memory-layout-stack", "raft-consensus"],
  },
  {
    role: "dag",
    title: "DAG Task Dependency & Execution",
    narrativeIntent: "Visualize topological task execution and distributed flows",
    suggestedArchetypes: ["dag-pipeline", "architecture-pipeline", "flowchart-process"],
  },
  {
    role: "ast",
    title: "Syntax Trees & Tool Orchestration",
    narrativeIntent: "Explore compiler AST graphs and structured tool execution",
    suggestedArchetypes: ["compiler-ast", "tool-calling-schema", "security-threat-model"],
  },
  {
    role: "git",
    title: "Branch Topology & Rebase Workflows",
    narrativeIntent: "Illustrate branch histories, commits, and code lifecycles",
    suggestedArchetypes: ["git-branch-graph", "code-terminal", "interactive-diff"],
  },
  {
    role: "devtools",
    title: "Runtime Inspection & Performance Profiling",
    narrativeIntent: "Demonstrate browser console metrics, network waterfalls, and audit streams",
    suggestedArchetypes: ["browser-devtools", "terminal-flow", "eval-benchmark-matrix"],
  },
  {
    role: "resilience",
    title: "Circuit Breakers & Rate Limiting",
    narrativeIntent: "Highlight failure recovery, leaky buckets, and token limiters",
    suggestedArchetypes: [
      "circuit-breaker-status",
      "rate-limiter-bucket",
      "audit-compliance-trail",
    ],
  },
  {
    role: "rag",
    title: "Retrieval Augmentation & Vector Search",
    narrativeIntent: "Explore multi-stage document chunking, embeddings, and context reranking",
    suggestedArchetypes: ["rag-retrieval-pipeline", "vector-cluster-graph", "prompt-budget-canvas"],
  },
  {
    role: "similarity",
    title: "High-Dimensional Vector Projections",
    narrativeIntent: "Display cosine similarity spaces and semantic clustering",
    suggestedArchetypes: [
      "embedding-similarity-space",
      "vector-cluster-graph",
      "context-window-gauge",
    ],
  },
  {
    role: "analytics",
    title: "Multidimensional Analytics & Flow",
    narrativeIntent: "Illustrate quantitative trends with radar charts and Sankey allocations",
    suggestedArchetypes: ["radar-chart", "sankey-diagram", "data-graph"],
  },
  {
    role: "matrix",
    title: "Density Heatmaps & Performance Grids",
    narrativeIntent: "Display correlation density and cohort retention patterns",
    suggestedArchetypes: [
      "matrix-density-heatmap",
      "eval-benchmark-matrix",
      "cohort-retention-heatmap",
    ],
  },
  {
    role: "sprint",
    title: "Engineering Roadmap & Kanban Cadence",
    narrativeIntent: "Trace milestone execution and delivery timelines",
    suggestedArchetypes: ["kanban-sprint", "changelog-timeline", "step-ladder"],
  },
  {
    role: "security",
    title: "Threat Modeling & Attack Surfaces",
    narrativeIntent: "Map vulnerability vectors, firewalls, and audit trails",
    suggestedArchetypes: [
      "security-threat-model",
      "audit-compliance-trail",
      "circuit-breaker-status",
    ],
  },
];

function makeTimingRng(seed) {
  let state = typeof seed === "number" ? seed >>> 0 : 0;
  if (typeof seed === "string") {
    let hash = 2166136261;
    for (let i = 0; i < seed.length; i++) {
      hash ^= seed.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    state = hash >>> 0;
  }
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function selectDiverseMiddleThemes(needed, rng) {
  const pool = [...MIDDLE_THEME_POOL];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const selected = [];
  const usedRoles = new Set();

  for (let i = 0; i < needed; i++) {
    if (usedRoles.size >= pool.length) {
      usedRoles.clear();
    }

    let candidate = pool.find((item) => !usedRoles.has(item.role));
    if (!candidate) candidate = pool[i % pool.length];

    selected.push(candidate);
    usedRoles.add(candidate.role);
  }

  return selected;
}

// Calculate Scene Breakdown based on requested total seconds (15s up to 10m / 600s)
// Pacing calibrated so visual beats change every 12 to 25 seconds, keeping long videos dynamic.
export function getSceneTimingStructure(totalSeconds, seed, options = {}) {
  const actualSeed = typeof seed === "object" && seed !== null ? undefined : seed;
  const actualOptions = typeof seed === "object" && seed !== null ? seed : options;
  const isManimOnly = actualOptions?.engineMode === "manim";
  const sec = Math.max(15, Math.min(600, Math.round(totalSeconds)));
  const seedEntropy =
    actualSeed !== undefined ? actualSeed : process.env.NODE_ENV === "test" ? 0 : Date.now();
  const rng = makeTimingRng(seedEntropy);

  const adjustForManim = (list) => {
    if (!isManimOnly) return list;
    return list.map((item) => ({
      ...item,
      suggestedArchetypes: ["manim-skill"],
      suggestedArchetype: "manim-skill",
    }));
  };

  if (sec <= 20) {
    return adjustForManim([
      {
        id: "scene1-hook",
        role: "hook",
        duration: parseFloat((sec * 0.45).toFixed(1)),
        maxWords: Math.round(sec * 0.45 * 2.3),
        chapterTitle: "Hook & Friction",
        narrativeIntent: "Hook the audience and present the core problem or tension",
        suggestedArchetypes: ["hook", "kinetic-impact", "3d-motion-hero"],
        suggestedArchetype: "hook",
      },
      {
        id: "scene2-outro",
        role: "outro",
        duration: parseFloat((sec * 0.55).toFixed(1)),
        maxWords: Math.round(sec * 0.55 * 2.3),
        chapterTitle: "Solution & Action",
        narrativeIntent: "Deliver the resolution, key takeaways, and call to action",
        suggestedArchetypes: ["outro", "quote-callout"],
        suggestedArchetype: "outro",
      },
    ]);
  }
  if (sec <= 35) {
    const middleThemes = selectDiverseMiddleThemes(2, rng);
    return adjustForManim([
      {
        id: "scene1-hook",
        role: "hook",
        duration: 7.0,
        maxWords: 16,
        chapterTitle: "Workflow Friction",
        narrativeIntent: "Introduce the problem space and core friction",
        suggestedArchetypes: ["hook", "kinetic-impact", "3d-motion-hero"],
        suggestedArchetype: "hook",
      },
      {
        id: `scene2-${middleThemes[0].role}`,
        role: middleThemes[0].role,
        duration: 8.0,
        maxWords: 18,
        chapterTitle: middleThemes[0].title,
        narrativeIntent: middleThemes[0].narrativeIntent,
        suggestedArchetypes: middleThemes[0].suggestedArchetypes || [middleThemes[0].role],
        suggestedArchetype: middleThemes[0].suggestedArchetypes?.[0] || middleThemes[0].role,
      },
      {
        id: `scene3-${middleThemes[1].role}`,
        role: middleThemes[1].role,
        duration: 8.5,
        maxWords: 19,
        chapterTitle: middleThemes[1].title,
        narrativeIntent: middleThemes[1].narrativeIntent,
        suggestedArchetypes: middleThemes[1].suggestedArchetypes || [middleThemes[1].role],
        suggestedArchetype: middleThemes[1].suggestedArchetypes?.[0] || middleThemes[1].role,
      },
      {
        id: "scene4-outro",
        role: "outro",
        duration: 6.5,
        maxWords: 15,
        chapterTitle: "Actionable Next Steps",
        narrativeIntent: "Summarize the value and present actionable next steps",
        suggestedArchetypes: ["outro", "quote-callout"],
        suggestedArchetype: "outro",
      },
    ]);
  }
  if (sec <= 75) {
    const sceneDur = parseFloat((sec / 5).toFixed(1));
    const words = Math.round(sceneDur * 2.2);
    const middleThemes = selectDiverseMiddleThemes(3, rng);
    return adjustForManim([
      {
        id: "scene1-hook",
        role: "hook",
        duration: sceneDur,
        maxWords: words,
        chapterTitle: "Workflow Friction",
        narrativeIntent: "Introduce the topic and highlight the core friction or question",
        suggestedArchetypes: ["hook", "kinetic-impact", "3d-motion-hero"],
        suggestedArchetype: "hook",
      },
      ...middleThemes.map((th, idx) => ({
        id: `scene${idx + 2}-${th.role}`,
        role: th.role,
        duration: sceneDur,
        maxWords: words,
        chapterTitle: th.title,
        narrativeIntent: th.narrativeIntent,
        suggestedArchetypes: th.suggestedArchetypes || [th.role],
        suggestedArchetype: th.suggestedArchetypes?.[0] || th.role,
      })),
      {
        id: "scene5-outro",
        role: "outro",
        duration: sceneDur,
        maxWords: words,
        chapterTitle: "Actionable Summary",
        narrativeIntent: "Conclude with core takeaways and call to action",
        suggestedArchetypes: ["outro", "quote-callout"],
        suggestedArchetype: "outro",
      },
    ]);
  }

  // Multi-minute educational explainer (up to 10 minutes / 600 seconds)
  // Calibrated scene density: visual changes every 14 to 26 seconds, eliminating boring static cards.
  let chapterCount;
  if (sec <= 100)
    chapterCount = 6; // ~90s -> 6 chapters (~15s each)
  else if (sec <= 160)
    chapterCount = 8; // ~2 mins -> 8 chapters (~16s each)
  else if (sec <= 260)
    chapterCount = 11; // ~3-4 mins -> 11 chapters (~20s each)
  else if (sec <= 420)
    chapterCount = 16; // ~5-7 mins -> 16 chapters (~22-26s each)
  else chapterCount = 24; // ~7-10 mins -> 24 chapters (~25s each)

  const needed = chapterCount - 2;
  const middleThemes = selectDiverseMiddleThemes(needed, rng);
  const sceneDuration = sec / chapterCount;
  const wordsPerScene = Math.max(14, Math.round(sceneDuration * 2.2));

  return adjustForManim([
    {
      id: "scene1-hook",
      role: "hook",
      duration: parseFloat(sceneDuration.toFixed(1)),
      maxWords: wordsPerScene,
      chapterTitle: "Introduction & The Core Friction",
      narrativeIntent: "Hook the audience and establish the central problem or subject",
      suggestedArchetypes: ["hook", "kinetic-impact", "3d-motion-hero"],
      suggestedArchetype: "hook",
    },
    ...middleThemes.map((th, idx) => ({
      id: `scene${idx + 2}-${th.role}`,
      role: th.role,
      duration: parseFloat(sceneDuration.toFixed(1)),
      maxWords: wordsPerScene,
      chapterTitle: th.title,
      narrativeIntent: th.narrativeIntent,
      suggestedArchetypes: th.suggestedArchetypes || [th.role],
      suggestedArchetype: th.suggestedArchetypes?.[0] || th.role,
    })),
    {
      id: `scene${chapterCount}-outro`,
      role: "outro",
      duration: parseFloat(sceneDuration.toFixed(1)),
      maxWords: wordsPerScene,
      chapterTitle: "Conclusion & Actionable Next Steps",
      narrativeIntent: "Synthesize the insights and prompt the next steps",
      suggestedArchetypes: ["outro", "quote-callout"],
      suggestedArchetype: "outro",
    },
  ]);
}

// PDF Text Extractor
const MAX_PDF_BYTES = 25 * 1024 * 1024;
const MAX_PDF_CHARS_FOR_PROMPT = 4000;

async function parsePdfContent(base64String) {
  if (!PDFParse) throw new Error("pdf-parse not available — reinstall dependencies");

  const buffer = Buffer.from(base64String, "base64");
  if (buffer.length === 0) throw new Error("uploaded PDF is empty");
  if (buffer.length > MAX_PDF_BYTES) throw new Error("PDF is larger than the 25 MB limit");
  if (buffer.subarray(0, 5).toString("latin1") !== "%PDF-") {
    throw new Error("that file is not a PDF (missing %PDF- header)");
  }

  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    const text = (result.text || "")
      .replace(/\s+/g, " ")
      .replace(/([.!?])\s+/g, "$1\n")
      .trim();
    if (!text) {
      throw new Error("no extractable text — the PDF may be a scanned image");
    }
    return text.slice(0, MAX_PDF_CHARS_FOR_PROMPT);
  } finally {
    // Always release the worker, or the process leaks handles per upload.
    await parser.destroy().catch(() => {});
  }
}

// Fetch a page for the director prompt without going through a shell.
const MAX_SOURCE_HTML_BYTES = 512 * 1024;

// Block obvious internal targets so the URL field can't be used to probe the
// machine's own network/services (SSRF).
function assertPublicHttpUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`"${rawUrl}" is not a valid URL`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("only http:// and https:// URLs are supported");
  }
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    (isIP(host) && !isPublicAddress(host))
  ) {
    throw new Error("only public website URLs are supported (private/local addresses are blocked)");
  }
  return parsed;
}

// Resolve all addresses, then pin one public address to the actual socket.
// This prevents DNS rebinding between validation and the HTTP connection.
async function fetchPublicPage(url) {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host)
    ? [{ address: host, family: isIP(host) }]
    : await lookup(host, { all: true });
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new Error("Website resolves to a private or unsafe network address");
  }
  return new Promise((resolve, reject) => {
    const request = (url.protocol === "https:" ? https : http).get(
      url,
      {
        headers: { "User-Agent": "ChalkFrames-Studio/1.0" },
        lookup: (_hostname, options, callback) =>
          options.all
            ? callback(null, [addresses[0]])
            : callback(null, addresses[0].address, addresses[0].family),
        timeout: 10000,
      },
      (response) => {
        const chunks = [];
        let size = 0;
        response.on("data", (chunk) => {
          if (size + chunk.length >= MAX_SOURCE_HTML_BYTES) {
            chunks.push(chunk.subarray(0, MAX_SOURCE_HTML_BYTES - size));
            response.destroy();
            resolve({
              status: response.statusCode,
              location: response.headers.location,
              html: Buffer.concat(chunks).toString("utf8"),
            });
            return;
          }
          chunks.push(chunk);
          size += chunk.length;
        });
        response.on("end", () =>
          resolve({
            status: response.statusCode,
            location: response.headers.location,
            html: Buffer.concat(chunks).toString("utf8"),
          }),
        );
        response.on("error", reject);
      },
    );
    request.on("timeout", () => request.destroy(new Error("Website request timed out")));
    request.on("error", reject);
  });
}

async function fetchSiteSnippet(rawUrl) {
  const parsed = assertPublicHttpUrl(rawUrl);
  let current = parsed;
  for (let redirect = 0; redirect <= 3; redirect++) {
    const res = await fetchPublicPage(current);
    if (res.status >= 300 && res.status < 400) {
      if (!res.location || redirect === 3) throw new Error("Website redirected too many times");
      current = assertPublicHttpUrl(new URL(res.location, current).href);
      continue;
    }
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`website returned HTTP ${res.status}`);
    }
    const html = res.html;
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 1600);
  }
  throw new Error("Website redirected too many times");
}

let _puppeteerLoader = null;
async function getPuppeteerInstance() {
  if (_puppeteerLoader) return _puppeteerLoader;
  try {
    const requireFromProducer = createRequire(
      path.join(ROOT_DIR, "packages", "producer", "package.json"),
    );
    _puppeteerLoader = requireFromProducer("puppeteer");
    return _puppeteerLoader;
  } catch {
    const mod = await import("puppeteer");
    _puppeteerLoader = mod.default || mod;
    return _puppeteerLoader;
  }
}

/**
 * Capture a live desktop screenshot of a validated public URL into target outputPath.
 * Falls back safely to false if network or headless browser encounters an issue.
 */
export async function captureUrlScreenshot(rawUrl, outputPath) {
  try {
    const validatedUrl = assertPublicHttpUrl(rawUrl).href;
    const puppeteer = await getPuppeteerInstance();
    const browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-gpu",
        "--disable-dev-shm-usage",
      ],
    });
    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.25 });
      await page.goto(validatedUrl, { waitUntil: "networkidle2", timeout: 12000 }).catch(() => {});
      if (outputPath) {
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        await page.screenshot({ path: outputPath, type: "png" });
      }
      return true;
    } finally {
      await browser.close().catch(() => {});
    }
  } catch (err) {
    console.warn(`[Screenshot Capture] Fallback to vector mockup (${err.message})`);
    return false;
  }
}

/**
 * Build contextual multi-track SFX cues matching scene archetypes and visual peaks.
 * Track 2: Transitions (Whooshes, Opening Typing)
 * Track 3: Archetype Accents (Sub-bass Impacts, Pops, Clicks, Sparkles, Outro Chime)
 */
export function buildContextualSfxCues({
  storyboard,
  sceneStartTimes = [],
  _sceneDurations = [],
  sfxDir,
}) {
  const cues = [];
  const scenes = storyboard?.scenes || [];
  if (scenes.length === 0) return cues;

  const resolvePath = (filename) => {
    if (!sfxDir) return filename;
    return path.join(sfxDir, filename);
  };

  // 1. Scene 0 Hook: Opening tactile typing and sub-bass impact
  cues.push({
    id: "sfx-open-typing",
    name: "typing.mp3",
    path: resolvePath("typing.mp3"),
    webSrc: "assets/sfx/typing.mp3",
    start: 0.1,
    duration: 1.2,
    volume: 0.28,
    trackIndex: 2,
    role: "open-typing",
  });

  cues.push({
    id: "sfx-hook-impact",
    name: "impact-bass-1.mp3",
    path: resolvePath("impact-bass-1.mp3"),
    webSrc: "assets/sfx/impact-bass-1.mp3",
    start: 0.35,
    duration: 1.0,
    volume: 0.32,
    trackIndex: 3,
    role: "hook-impact",
  });

  // 2. Archetype-specific accent cues for each scene
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const sStart = sceneStartTimes[i] ?? i * 5.0;
    const arch = String(scene.archetype || "").toLowerCase();

    if (
      arch === "stat-spotlight" ||
      arch === "kinetic-impact" ||
      arch === "hero-canvas" ||
      arch === "split-stage-hero" ||
      arch === "kpi-counter-ring"
    ) {
      if (i > 0) {
        cues.push({
          id: `sfx-impact-${i + 1}`,
          name: "impact-bass-2.mp3",
          path: resolvePath("impact-bass-2.mp3"),
          webSrc: "assets/sfx/impact-bass-2.mp3",
          start: Number((sStart + 0.35).toFixed(2)),
          duration: 1.0,
          volume: 0.3,
          trackIndex: 3,
          role: "stat-impact",
        });
      }
    } else if (
      arch.includes("terminal") ||
      arch.includes("code") ||
      arch.includes("diff") ||
      arch === "browser-devtools" ||
      arch === "tool-calling-schema"
    ) {
      cues.push({
        id: `sfx-click-${i + 1}`,
        name: "click.mp3",
        path: resolvePath("click.mp3"),
        webSrc: "assets/sfx/click.mp3",
        start: Number((sStart + 0.45).toFixed(2)),
        duration: 0.4,
        volume: 0.28,
        trackIndex: 3,
        role: "code-click",
      });
    } else if (
      arch.includes("card") ||
      arch.includes("ladder") ||
      arch.includes("feed") ||
      arch.includes("bento") ||
      arch.includes("grid") ||
      arch.includes("matrix") ||
      arch.includes("flow") ||
      arch.includes("kanban")
    ) {
      cues.push({
        id: `sfx-pop-${i + 1}`,
        name: "pop.mp3",
        path: resolvePath("pop.mp3"),
        webSrc: "assets/sfx/pop.mp3",
        start: Number((sStart + 0.6).toFixed(2)),
        duration: 0.4,
        volume: 0.25,
        trackIndex: 3,
        role: "card-pop",
      });
    } else if (
      arch.includes("orbit") ||
      arch.includes("graph") ||
      arch.includes("mesh") ||
      arch.includes("stack") ||
      arch.includes("carousel") ||
      arch.includes("spatial") ||
      arch.includes("vector")
    ) {
      cues.push({
        id: `sfx-sparkle-${i + 1}`,
        name: "sparkle.mp3",
        path: resolvePath("sparkle.mp3"),
        webSrc: "assets/sfx/sparkle.mp3",
        start: Number((sStart + 0.55).toFixed(2)),
        duration: 0.8,
        volume: 0.25,
        trackIndex: 3,
        role: "sparkle",
      });
    } else if (
      arch.includes("tradeoff") ||
      arch.includes("friction") ||
      arch.includes("timeline")
    ) {
      cues.push({
        id: `sfx-click-soft-${i + 1}`,
        name: "click-soft.mp3",
        path: resolvePath("click-soft.mp3"),
        webSrc: "assets/sfx/click-soft.mp3",
        start: Number((sStart + 0.45).toFixed(2)),
        duration: 0.5,
        volume: 0.25,
        trackIndex: 3,
        role: "soft-accent",
      });
    }
  }

  // 3. Scene Seam Transitions (Whooshes)
  for (let sIdx = 0; sIdx < scenes.length - 1; sIdx++) {
    const nextStart = sceneStartTimes[sIdx + 1] ?? (sIdx + 1) * 5.0;
    if (nextStart > 1.2) {
      const wStart = Math.max(1.0, nextStart - 0.25);
      cues.push({
        id: `sfx-whoosh-${sIdx + 1}`,
        name: "whoosh-short.mp3",
        path: resolvePath("whoosh-short.mp3"),
        webSrc: "assets/sfx/whoosh-short.mp3",
        start: Number(wStart.toFixed(2)),
        duration: 0.45,
        volume: 0.32,
        trackIndex: 2,
        role: "scene-transition",
      });
    }
  }

  // 4. Outro Scene Finale (Chime)
  if (scenes.length >= 2) {
    const outroIdx = scenes.length - 1;
    const outroStart = sceneStartTimes[outroIdx] ?? outroIdx * 5.0;
    cues.push({
      id: "sfx-chime-outro",
      name: "chime.mp3",
      path: resolvePath("chime.mp3"),
      webSrc: "assets/sfx/chime.mp3",
      start: Number((outroStart + 0.25).toFixed(2)),
      duration: 1.5,
      volume: 0.38,
      trackIndex: 3,
      role: "outro-finale",
    });
  }

  return cues.sort((a, b) => a.start - b.start);
}

const JSON_SIMPLE_ESCAPES = new Set(['"', "\\", "/", "b", "f", "n", "r", "t"]);

/**
 * String-aware JSON repair for LLM output. Handles smart-quote delimiters, raw control
 * characters and invalid escapes inside strings, unescaped inner quotes, trailing commas,
 * trailing prose after the root value, and truncation (closes open strings/brackets).
 */
export function repairJsonText(input) {
  const text = String(input);
  const out = [];
  const stack = [];
  let inString = false;
  let closer = '"';
  let i = 0;
  const nextSignificant = (from) => {
    let j = from;
    while (j < text.length && /\s/.test(text[j])) j++;
    return j < text.length ? text[j] : "";
  };
  const trimTail = () => {
    while (out.length && /\s/.test(out[out.length - 1])) out.pop();
  };
  for (; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (ch === "\\") {
        const nx = text[i + 1];
        if (nx === undefined) break;
        if (
          JSON_SIMPLE_ESCAPES.has(nx) ||
          (nx === "u" && /^[0-9a-fA-F]{4}$/.test(text.slice(i + 2, i + 6)))
        ) {
          out.push(ch, nx);
        } else {
          out.push("\\\\", nx === "\n" ? "n" : nx);
        }
        i++;
        continue;
      }
      if (ch === closer || (closer === "\u201d" && ch === '"')) {
        const nx = nextSignificant(i + 1);
        if (nx === "" || nx === "," || nx === "}" || nx === "]" || nx === ":") {
          out.push('"');
          inString = false;
        } else {
          out.push('\\"');
        }
        continue;
      }
      if (ch === "\n") out.push("\\n");
      else if (ch === "\r") out.push("\\r");
      else if (ch === "\t") out.push("\\t");
      else if (ch < " ") out.push(" ");
      else out.push(ch);
      continue;
    }
    // A new value starting right after a finished sibling means the model forgot a comma.
    if (ch === "{" || ch === "[" || ch === '"' || ch === "\u201c" || ch === "\u201d") {
      let p = out.length - 1;
      while (p >= 0 && /\s/.test(out[p])) p--;
      const prev = p >= 0 ? out[p] : "";
      const inArray = stack[stack.length - 1] === "]";
      if (prev === "}" || prev === "]" || (inArray && prev === '"')) out.push(",");
    }
    if (ch === '"' || ch === "\u201c" || ch === "\u201d") {
      inString = true;
      closer = ch === '"' ? '"' : "\u201d";
      out.push('"');
    } else if (ch === "{" || ch === "[") {
      stack.push(ch === "{" ? "}" : "]");
      out.push(ch);
    } else if (ch === "}" || ch === "]") {
      trimTail();
      if (out[out.length - 1] === ",") out.pop();
      out.push(ch);
      stack.pop();
      if (stack.length === 0) return out.join("");
    } else if (ch === ",") {
      const nx = nextSignificant(i + 1);
      if (nx === "}" || nx === "]") continue;
      out.push(ch);
    } else {
      out.push(ch);
    }
  }
  // Truncated: close the open string, drop dangling separators, then close open brackets.
  if (inString) out.push('"');
  trimTail();
  while (out.length && (out[out.length - 1] === "," || out[out.length - 1] === ":")) {
    const dangling = out.pop();
    if (dangling === ":") out.push(": null");
    trimTail();
    if (dangling === ":") break;
  }
  while (stack.length) out.push(stack.pop());
  return out.join("");
}

/**
 * Pre-processes and heals LLM YAML output:
 * - Strips code fences and conversational preamble
 * - Converts tabs to spaces (YAML forbids tabs for indentation)
 * - Normalizes smart quotes
 * - Quotes unquoted scalar values that contain colons (e.g. title: Architecture: The Engine)
 */
export function sanitizeYamlText(input) {
  if (typeof input !== "string") return "";
  let text = input.trim();

  // 1. Strip markdown code fences (```yaml, ```json, or generic ```)
  const fenced = text.match(/```(?:yaml|json)?\s*([\s\S]*?)\s*```/i);
  if (fenced) {
    text = fenced[1].trim();
  } else {
    text = text
      .replace(/^```(?:yaml|json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
  }

  // 2. Normalize smart quotes
  text = text.replace(/[\u201c\u201d]/g, '"').replace(/[\u2018\u2019]/g, "'");

  // 3. Replace tabs with 2 spaces (YAML forbids hard tabs for indentation)
  text = text.replace(/\t/g, "  ");

  // 4. Strip conversational preamble before first root key if not code-fenced
  const rootKeyMatch = text.match(
    /^(?:version|productName|product_name|title|domain|engineMode|engine_mode|scenes|frames):/m,
  );
  if (rootKeyMatch && rootKeyMatch.index > 0) {
    const before = text.slice(0, rootKeyMatch.index);
    if (!before.includes(":\n") && !before.includes(": ")) {
      text = text.slice(rootKeyMatch.index);
    }
  }

  // 5. Fix unquoted scalar values containing colons (e.g. title: Architecture: Multi-Head Attention)
  const lines = text.split("\n");
  const cleanedLines = lines.map((line) => {
    const kvMatch = line.match(/^(\s*[a-zA-Z0-9_-]+:\s*)([^\s"'>|[{].*)$/);
    if (kvMatch) {
      const prefix = kvMatch[1];
      const val = kvMatch[2].trim();
      if (val.includes(": ") && !val.startsWith('"') && !val.startsWith("'")) {
        const safeVal = JSON.stringify(val);
        return `${prefix}${safeVal}`;
      }
    }
    return line;
  });
  return cleanedLines.join("\n");
}

/**
 * Resilient line-by-line block extractor that parses scenes structurally
 * if strict YAML and JSON parsers fail. Guarantees orchestration never crashes.
 */
function extractStoryboardFromLines(text) {
  if (typeof text !== "string") return null;
  const lines = text.split("\n");
  const scenes = [];
  let currentScene = null;
  let productName = "Explainer Video";

  for (const line of lines) {
    const trimmed = line.trim();
    const prodMatch = trimmed.match(/^(?:productName|product_name|title):\s*["']?([^"'\n]+)["']?/i);
    if (prodMatch && !currentScene) {
      productName = prodMatch[1].trim();
      continue;
    }

    const sceneStart = trimmed.match(/^-\s*id:\s*["']?([a-zA-Z0-9_-]+)["']?/i);
    if (sceneStart) {
      if (currentScene) scenes.push(currentScene);
      currentScene = { id: sceneStart[1] };
      continue;
    }

    if (currentScene) {
      const archMatch = trimmed.match(/^archetype:\s*["']?([a-zA-Z0-9_-]+)["']?/i);
      if (archMatch) currentScene.archetype = archMatch[1];

      const engMatch = trimmed.match(/^engine:\s*["']?([a-zA-Z0-9_-]+)["']?/i);
      if (engMatch) currentScene.engine = engMatch[1];

      const titleMatch = trimmed.match(/^title:\s*["']?([^"'\n]+)["']?/i);
      if (titleMatch) currentScene.title = titleMatch[1];

      const voMatch = trimmed.match(/^voiceover:\s*(?:>|\|)?\s*["']?([^"'\n]+)?["']?/i);
      if (voMatch && voMatch[1]) currentScene.voiceover = voMatch[1];
      else if (trimmed.startsWith("voiceover:")) currentScene.voiceover = "";
      else if (currentScene.voiceover !== undefined && trimmed && !trimmed.includes(":")) {
        currentScene.voiceover += (currentScene.voiceover ? " " : "") + trimmed;
      }
    }
  }
  if (currentScene) scenes.push(currentScene);

  if (scenes.length > 0) {
    return {
      version: "2.0",
      productName,
      scenes: scenes.map((s, idx) => ({
        id: s.id || `scene-${idx + 1}`,
        archetype: s.archetype || "features-cards",
        title: s.title || `Scene ${idx + 1}`,
        voiceover: s.voiceover || `Understanding ${s.title || `Scene ${idx + 1}`}.`,
      })),
    };
  }
  return null;
}

/**
 * Universal Storyboard parser: parses YAML (the Hyperframes canonical standard)
 * or JSON (with repair heuristics), normalizing frames/scenes, engine routing,
 * and visual payloads. Includes multi-tier syntax healing so orchestration never fails.
 */
export function parseStoryboardYamlOrJson(raw) {
  function normalizeParsedStoryboard(obj) {
    if (!obj || typeof obj !== "object") return null;
    if (Array.isArray(obj.frames) && !Array.isArray(obj.scenes)) {
      obj.scenes = obj.frames;
    }
    if (obj.title && !obj.productName) {
      obj.productName = obj.title;
    }
    if (obj.product_name && !obj.productName) {
      obj.productName = obj.product_name;
    }
    if (Array.isArray(obj.scenes)) {
      obj.scenes = obj.scenes.map((scene, idx) => {
        if (!scene || typeof scene !== "object") return scene;
        const s = { ...scene };
        if (s.title_text && !s.title) s.title = s.title_text;
        if (s.duration_s !== undefined && s.duration === undefined) s.duration = s.duration_s;
        if (s.transition_in && !s.transition) s.transition = s.transition_in;
        if (!s.id) s.id = `scene-${idx + 1}`;
        return s;
      });
      return obj;
    }
    return null;
  }

  if (Array.isArray(raw)) {
    raw = raw
      .map((item) => (typeof item === "string" ? item : item?.text || item?.content || ""))
      .join("");
  } else if (raw && typeof raw === "object") {
    const directNormalized = normalizeParsedStoryboard(raw);
    if (directNormalized) return directNormalized;
  }

  if (typeof raw !== "string" || !raw.trim()) throw new Error("Director returned no storyboard");
  const cleanedYaml = sanitizeYamlText(raw);

  // 1. Primary path: Sanitized YAML parser (handles standard YAML and strict JSON)
  try {
    const parsed = parseYaml(cleanedYaml);
    const normalized = normalizeParsedStoryboard(parsed);
    if (normalized) return normalized;
  } catch {}

  // 2. Secondary path: Direct raw YAML parse attempt
  try {
    let unformatted = raw.trim();
    const fenced = unformatted.match(/```(?:yaml|json)?\s*([\s\S]*?)\s*```/i);
    if (fenced) unformatted = fenced[1].trim();
    const parsed = parseYaml(unformatted);
    const normalized = normalizeParsedStoryboard(parsed);
    if (normalized) return normalized;
  } catch {}

  // 3. Tertiary path: JSON extraction and repair path
  const start = raw.indexOf("{");
  if (start !== -1) {
    const jsonCandidate = raw.slice(start);
    try {
      const end = jsonCandidate.lastIndexOf("}");
      const parsed = JSON.parse(end > 0 ? jsonCandidate.slice(0, end + 1) : jsonCandidate);
      const normalized = normalizeParsedStoryboard(parsed);
      if (normalized) return normalized;
    } catch {}

    try {
      const parsed = JSON.parse(repairJsonText(jsonCandidate));
      const normalized = normalizeParsedStoryboard(parsed);
      if (normalized) return normalized;
    } catch {}

    // Last resort for cutoffs:
    let cut = jsonCandidate.length;
    for (let attempt = 0; attempt < 60; attempt++) {
      cut = Math.max(
        jsonCandidate.lastIndexOf("}", cut - 1),
        jsonCandidate.lastIndexOf("]", cut - 1),
      );
      if (cut <= 0) break;
      try {
        const parsed = JSON.parse(repairJsonText(jsonCandidate.slice(0, cut + 1)));
        const normalized = normalizeParsedStoryboard(parsed);
        if (normalized) return normalized;
      } catch {}
    }
  }

  // 4. Quaternary path: Resilient structural block extractor
  const recovered = extractStoryboardFromLines(cleanedYaml || raw);
  if (recovered && Array.isArray(recovered.scenes) && recovered.scenes.length > 0) {
    const normalized = normalizeParsedStoryboard(recovered);
    if (normalized) return normalized;
  }

  const error = new Error("Director returned invalid JSON: no valid YAML or JSON storyboard found");
  error.rawText = raw;
  throw error;
}

export const parseStoryboardJson = parseStoryboardYamlOrJson;

export function formatStoryboardYaml(storyboard) {
  if (!storyboard || typeof storyboard !== "object") return "";
  const cleaned = {
    version: "2.0",
    productName: storyboard.productName || "Untitled Video",
    domain: storyboard.domain || "General",
    engineMode: storyboard.engineMode || "combined",
    format: storyboard.format || "1920x1080",
    theme: storyboard.theme || "dark",
    palette: storyboard.palette || "obsidian",
    scenes: (storyboard.scenes || []).map((s, idx) => {
      const item = {
        id: s.id || `scene${idx + 1}`,
        engine: s.engine || "html-gsap",
        archetype: s.archetype || "features-cards",
        theme: s.theme || "dark",
        title: s.title || "",
        eyebrow: s.eyebrow || "",
        voiceover: s.voiceover || "",
        transition: s.transition || "crossfade",
      };
      if (s.duration) item.duration = s.duration;
      if (s.manimData) item.manimData = s.manimData;
      if (s.beats) item.beats = s.beats;
      if (s.fallbackArchetype) item.fallbackArchetype = s.fallbackArchetype;
      if (s.fallbackPayload) item.fallbackPayload = s.fallbackPayload;
      if (s.impactData) item.impactData = s.impactData;
      if (s.spotlightData) item.spotlightData = s.spotlightData;
      if (s.flowData) item.flowData = s.flowData;
      if (s.kpiData) item.kpiData = s.kpiData;
      if (s.stackData) item.stackData = s.stackData;
      if (s.stepData) item.stepData = s.stepData;
      if (s.feedData) item.feedData = s.feedData;
      if (s.orbitData) item.orbitData = s.orbitData;
      if (s.mockupData) item.mockupData = s.mockupData;
      if (s.diffData) item.diffData = s.diffData;
      if (s.chatData) item.chatData = s.chatData;
      if (s.pills) item.pills = s.pills;
      if (s.cta) item.cta = s.cta;
      return item;
    }),
  };
  return stringifyYaml(cleaned, { indent: 2, lineWidth: 120 });
}

export function formatStoryboardMarkdown(storyboard) {
  if (!storyboard || typeof storyboard !== "object") return "";
  const title = String(storyboard.productName || "Untitled Video").replace(/"/g, '\\"');
  const lines = [
    "---",
    `title: "${title}"`,
    `productName: "${title}"`,
    `format: ${storyboard.format || "1920x1080"}`,
    `engine: ${storyboard.engineMode || "combined"}`,
    `theme: ${storyboard.theme || "dark"}`,
    `message: "${title}"`,
    `domain: "${String(storyboard.domain || "").replace(/"/g, '\\"')}"`,
    "---",
    "",
  ];

  for (const [idx, s] of (storyboard.scenes || []).entries()) {
    lines.push(`## Scene ${idx + 1}: ${s.title || s.id}`);
    lines.push(`- **ID**: \`${s.id}\``);
    lines.push(`- **Engine**: \`${s.engine || "html-gsap"}\``);
    lines.push(`- **Archetype**: \`${s.archetype || "features-cards"}\``);
    lines.push(`- **Transition**: \`${s.transition || "crossfade"}\``);
    lines.push(`- **Theme**: \`${s.theme || "dark"}\``);
    if (s.duration) lines.push(`- **Duration**: ${s.duration}s`);
    lines.push("");
    lines.push(`> **Voiceover:** ${s.voiceover || ""}`);
    lines.push("");
  }
  return lines.join("\n");
}

/**
 * Safely extracts textual completion from OpenRouter response payload.
 * Handles:
 * - standard string choice.message.content
 * - array of content chunks ([{ type: "text", text: "..." }]) used by Claude / Anthropic
 * - reasoning / thinking fallback when content is empty
 * - choice.text fallback
 */
export function extractOpenRouterContent(data) {
  if (!data || typeof data !== "object") return "";
  const choice = data.choices?.[0];
  if (!choice) return "";
  const msg = choice.message;
  if (!msg) {
    if (typeof choice.text === "string") return choice.text;
    return "";
  }
  let content = msg.content;
  if (Array.isArray(content)) {
    content = content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object") {
          return part.text || part.content || "";
        }
        return "";
      })
      .join("");
  }
  if (typeof content === "string" && content.trim()) {
    return content;
  }
  if (typeof msg.reasoning === "string" && msg.reasoning.trim()) {
    return msg.reasoning;
  }
  if (typeof msg.text === "string" && msg.text.trim()) {
    return msg.text;
  }
  return typeof content === "string" ? content : "";
}

// OpenRouter Topic Script Synthesizer (Generates structured script for any subject in human knowledge)
export async function synthesizeTopicScript({
  apiKey,
  model,
  topic,
  topicStyle = "explainer",
  duration = 60,
  format = "landscape",
}) {
  const effectiveKey = apiKey || process.env.OPENROUTER_API_KEY;
  if (!effectiveKey) {
    throw new Error("An OpenRouter API key is required to synthesize a topic script.");
  }
  if (!topic || typeof topic !== "string" || !topic.trim()) {
    throw new Error("Please specify a topic or subject to generate a script.");
  }

  const timingStructure = getSceneTimingStructure(duration);
  const totalScenes = timingStructure.length;
  const isPortrait = format === "portrait";
  const isSquare = format === "square";
  const aspectDesc = isSquare
    ? "1:1 Square (Social / Feed 1080x1080)"
    : isPortrait
      ? "9:16 Vertical (Mobile / Shorts / Reels 1080x1920)"
      : "16:9 Landscape (YouTube / Desktop 1920x1080)";

  const styleDescriptions = {
    explainer:
      "Visual explainer with intuitive analogies, real-world context, and clear concept progression.",
    "deep-dive":
      "Technical or scientific deep dive with rigorous terminology, core mechanisms, structural breakdowns, and data points.",
    educational:
      "Foundational educational pedagogy, building systematically from basic intuition to deeper principles.",
    documentary:
      "Cinematic documentary narrative with historical milestones, key discoveries, and profound takeaways.",
    "product-showcase":
      "High-energy product launch & spatial showcase with 3D hero reveals, revolving feature carousels, and architectural breakdowns.",
    "spatial-3d":
      "Futuristic spatial visual presentation featuring 3D geometric projections, revolving cylindrical carousels, and code slice reveals.",
  };
  const chosenStyle = styleDescriptions[topicStyle] || styleDescriptions.explainer;

  const prompt = `You are a world-renowned educational researcher, domain specialist, and documentary scriptwriter.
Your task is to write a comprehensive, authoritative, and engaging educational video script for ANY subject in human knowledge.

TOPIC / SUBJECT:
"${topic.trim()}"

TARGET SPECS:
- Target Duration: ${duration} seconds
- Total Scenes / Chapters: ${totalScenes}
- Aspect Ratio: ${aspectDesc}
- Presentation Style: ${chosenStyle}

CHAPTER PACING STRUCTURE:
${timingStructure
  .map(
    (t, idx) =>
      `Chapter ${idx + 1} (${t.id}): ~${t.duration}s (approx. ${t.maxWords} spoken words) — Focus: ${t.chapterTitle || t.role}`,
  )
  .join("\n")}

SCRIPTWRITING INSTRUCTIONS:
1. DEEP DOMAIN MASTERY: Whether this topic is human anatomy, quantum physics, compiler architecture, world history, molecular biology, macroeconomic policy, or philosophy — produce genuine, high-caliber, factually sound content. Never produce generic fluff or vague generalities.
2. VIVID, NATURAL NARRATION: For each chapter, write spoken voiceover narration that flows effortlessly when read aloud. Keep it concise, punchy, and captivating. NO filler buzzwords ("unleash", "delve", "game-changer"). NO em dashes.
3. VISUAL CONCEPT COHESION: For each chapter, identify the core visual concept that will anchor the scene (e.g. anatomical layers, data stats, process sequences, code snippets, orbital hubs, comparative paradigms).

Format your response clearly as:
# Title: [Engaging, Authoritative Title for this Subject]
# Field: [Domain / Field Category, e.g. "Anatomy & Physiology", "Computer Science", "Astrophysics"]
# Overview: [2-3 sentence executive synopsis]

[Chapters 1 to ${totalScenes} with Chapter Title, Target Words, Voiceover Narration, and Visual Cue]`;

  const primaryModel = model || "anthropic/claude-haiku-5.5";
  const fallbackModel =
    primaryModel === "google/gemini-3.5-flash-lite"
      ? "anthropic/claude-haiku-5.5"
      : "google/gemini-3.5-flash-lite";

  const fetchScript = async (targetModel) => {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${effectiveKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:4000",
        "X-Title": "Studio One Production Suite",
      },
      body: JSON.stringify({
        model: targetModel,
        messages: [
          {
            role: "system",
            content:
              "You are an expert multi-disciplinary educator, scientist, and master scriptwriter.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: Math.min(6000, Math.max(2500, totalScenes * 180)),
      }),
      signal: AbortSignal.timeout(120_000),
    });

    if (!response.ok) {
      let errDetail = "";
      try {
        const errJson = await response.json();
        errDetail = errJson.error?.message || JSON.stringify(errJson);
      } catch {
        errDetail = await response.text().catch(() => "");
      }
      throw new Error(
        `OpenRouter returned HTTP ${response.status} (${targetModel}): ${errDetail || "check API key and model"}`,
      );
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(
        `OpenRouter API error (${targetModel}): ${data.error.message || JSON.stringify(data.error)}`,
      );
    }
    return extractOpenRouterContent(data);
  };

  let scriptContent = "";
  try {
    scriptContent = await fetchScript(primaryModel);
    if (!scriptContent || !scriptContent.trim()) {
      throw new Error(`Model ${primaryModel} returned empty completion`);
    }
  } catch (err) {
    console.warn(
      `[TOPIC SCRIPT FALLBACK] Primary model ${primaryModel} failed (${err.message}). Retrying with ${fallbackModel}...`,
    );
    scriptContent = await fetchScript(fallbackModel);
  }

  // Extract title and domain if present
  const titleMatch = scriptContent.match(/#\s*Title:\s*([^\n\r]+)/i);
  const domainMatch = scriptContent.match(/#\s*Field:\s*([^\n\r]+)/i);
  const title = titleMatch ? titleMatch[1].trim() : topic.trim();
  const domain = domainMatch ? domainMatch[1].trim() : "Educational Explainer";

  return {
    title,
    domain,
    script: scriptContent,
  };
}

export function buildDirectorPrompt({
  context = "",
  duration = 60,
  sceneCount = 5,
  isPortrait = false,
  format = undefined,
  isEducational = false,
  manimEnabled = false,
  engineMode = "combined",
  timingStructure = [],
} = {}) {
  const actualSceneCount = sceneCount || timingStructure.length || 5;
  const isManimOnly = engineMode === "manim";
  const isHtmlOnly = engineMode === "html";
  const effectiveManimEnabled = isHtmlOnly ? false : isManimOnly ? true : manimEnabled;
  const isSquare = format === "square";
  const effectiveIsPortrait = format === "portrait" || isPortrait;
  const aspectDesc = isSquare
    ? "1:1 Square (Feed / Social 1080x1080)"
    : effectiveIsPortrait
      ? "9:16 Portrait (Mobile / Reels / Shorts 1080x1920)"
      : "16:9 Landscape (YouTube 1920x1080)";

  return `YOU ARE AN ADAPTIVE VIDEO DIRECTOR.
Your goal is to turn any input (raw topic, markdown doc, product URL, script, or technical PDF) into a compelling, frame-accurate motion video storyboard.

INPUT:
${context}

CONSTRAINTS:
1. Total Target Duration: ${duration} seconds across ${actualSceneCount} distinct visual chapters/scenes.
2. Aspect Ratio: ${aspectDesc}.
3. Tone: ${isEducational ? "Articulate, deeply informative, engaging, and clear for curious viewers." : "Minimalist, refined, quiet confidence."} NO hype words. NO buzzwords. NO em dashes.
4. Spoken Narration: Every scene must deliver natural, compelling spoken voiceover narration matching its target word count (15 to 35 words per scene).
5. FULL CREATIVE AUTHORITY (CRITICAL):
   - You have complete freedom and authority to select the most compelling and accurate visual archetype from the catalog for every single scene.
   - Nothing is forced and nothing is forbidden. You are NOT required to include any specific archetype, and you are NOT restricted to any narrow subset.
   - Choose what best illuminates the specific topic, whether that is a 3D procedural motion hero, a 3D cylindrical carousel, a syntax diff terminal, a dynamic architecture diagram, an interactive vector graph, a metric spotlight, or a bold typographic statement.
6. VISUAL VARIETY & MOTION DIVERSITY (CRITICAL):
   - Never repeat the same archetype two scenes in a row.
   - Vary the look and layout across scenes. Avoid repeating the same visual structure or family consecutively.
   - Alternate visual rhythm and scale: balance oversized focal moments with rich structural or quantitative canvases.
7. DYNAMIC THEME RHYTHM:
   - Alternate themes ("dark" | "light" | "accent") across scenes to provide visual contrast and pacing.

STEP 1: DETECT THE INTENT AND STORY ARC
Analyze the input to craft a clear, engaging narrative arc:
- Hook & Problem: Ground the audience in the tension, bottleneck, or core question.
- Breakthrough & Mental Model: Introduce the core architecture, mental model, or mechanism.
- Deep Dive & Mechanics: Explore how it actually operates (3D spatial models, interactive flows, code diffs, data pipelines).
- Proof & Quantitative Evidence: Validate with benchmarks, throughput, metrics, or comparisons.
- Resolution & Next Steps: Synthesize takeaways and provide a clear call to action.

${
  isManimOnly
    ? `STEP 2: ENGINE SELECTION RULE (MANIM SKILL MODE)
- You MUST set "engine": "manim" on EVERY single scene from Scene 1 to Scene ${actualSceneCount}.
- Use the Manim Skill ("manim-skill") for every scene.
- Do NOT use "html-gsap" engine or HTML archetypes for any scene.
- Every scene needs: "manimData" with { "title": "...", "concept": "...", "mathExpr": "..." } and "beats" (1-6 short narration sentences; the spoken voiceover is these beats joined).
- CRAFTSMANSHIP PATTERN 1: "GEOMETRY BEFORE ALGEBRA"
  Visual memory encodes faster than symbolic memory. Reveal spatial structure and geometry in early beats BEFORE presenting formal equations.
- CRAFTSMANSHIP PATTERN 2: 3-TIER OPACITY LAYERING
  Tier 1 (1.0 focal elements), Tier 2 (0.40 contextual geometry), Tier 3 (0.15 background axes/grids).
- Expressions use only: x, numbers, + - * / ^, parentheses, pi, e, sin cos tan exp log sqrt abs. Example: "x^2 - 2*x + sin(3*x)".`
    : isHtmlOnly
      ? `STEP 2: ENGINE SELECTION RULE (STRICT MODE: ONLY HTML)
- You MUST set "engine": "html-gsap" on EVERY single scene from Scene 1 to Scene ${actualSceneCount}.
- Choose from the HTML visual archetypes in the catalog below.
- Do NOT use "manim" engine or any "manim-*" archetypes.`
      : `STEP 2: ENGINE SELECTION RULE
- MATHEMATICAL, GEOMETRIC & ALGORITHMIC EXPLAINERS (Engine: 'manim'):
  If a beat explains a continuous function curve, rate of change, geometric transformation, vector field, coordinate projection, neural network manifold, or probability simulation, set "engine": "manim" and choose a "manim-*" archetype.
- ALL OTHER SCENES (Engine: 'html-gsap'):
  For software systems, 3D motion heroes, carousels, code diffs, interfaces, pipelines, and metrics, set "engine": "html-gsap". The first and last scene are always "html-gsap".`
}

Choose from these ${VISUAL_CATALOG.length} available archetypes:
${formatCatalogForPrompt({ manim: effectiveManimEnabled, engineMode })}
${
  effectiveManimEnabled
    ? `
ENGINE ROUTING RULE (applies to every scene; set "engine" explicitly on every scene):
${
  isManimOnly
    ? `- Every single scene must use "engine": "manim" and the "manim-skill" archetype.`
    : `Categorize each scene's narrative purpose, then assign its engine:
- If a beat explains a continuous function curve, rate of change, geometric transformation, vector field, coordinate projection, or graph traversal, you MUST set "engine": "manim" and choose a "manim-*" archetype.
- For deep mathematical, calculus, linear algebra, and probability explainers, allocate 50% to 65% of the middle scenes to "engine": "manim" (about ${Math.max(1, Math.round((actualSceneCount - 2) * 0.5))} to ${Math.max(1, Math.floor(actualSceneCount * 0.65))} of the ${Math.max(0, actualSceneCount - 2)} middle scenes here), up to 3 in a row. For general software / product explainers, allocate 25% to 40% (never more than 2 in a row).
- Use "engine": "html-gsap" for hooks, outros, high-level architectures, comparisons, and KPI metrics. The first and last scene are always "html-gsap".
- Pick the primitive by what the beat shows: a changing curve or area -> "manim-function-plot"; a matrix or basis change, rotation, shear or projection -> "manim-vector-transform"; layers of a network or a graph/tree traversal -> "manim-network-topology".`
}

3BLUE1BROWN MATHEMATICAL ANIMATION RULES (archetypes whose id starts with "manim-"):
- The "engine" field of a manim scene is "manim"; ${isManimOnly ? "all scenes are manim." : "every other scene uses html-gsap."}
- You write DATA, never code. Every manim scene needs: "manimData" (exact fields from its payload hint), "beats" (1-6 short narration sentences; the spoken voiceover is these beats joined), and "fallbackArchetype" (an HTML archetype that conveys the same idea) with "fallbackPayload". Never include Python, "code" or "pythonCode" fields.
- Expressions use only: x, numbers, + - * / ^, parentheses, pi, e, sin cos tan exp log sqrt abs. Example: "x^2 - 2*x + sin(3*x)".

3B1B DESIGN PRINCIPLE 1 — "TRANSFORM, DON'T REPLACE":
- Ground every explanation in visual and geometric continuity. Never jump between disjoint concepts.
- Morph curves smoothly (use "expr" and "expr2" in manim-function-plot), warp coordinate planes continuously under matrix multiplication (manim-vector-transform), stretch eigenvectors along their invariant directions (manim-eigen-decomposition), and trace forward/backward autograd pulses (manim-backprop-chain).

3B1B DESIGN PRINCIPLE 2 — 3-STAGE PEDAGOGICAL BEAT CADENCE:
Every Manim scene's "beats" array must tell a 3-part visual story:
- Beat 1 (Anchor): Establish the coordinate frame or initial baseline state (e.g. "Consider our standard 2D Cartesian plane with unit basis vectors.").
- Beat 2 (Mechanism): Apply the mathematical transformation, slide the tangent line, or execute the algorithmic step (e.g. "Applying this matrix warps the entire grid, shearing space to the right.").
- Beat 3 (Insight/Invariant): Highlight what stayed constant or state the decisive geometric takeaway (e.g. "Notice how vectors on the horizontal axis remain completely untouched.").

3B1B DESIGN PRINCIPLE 3 — COLOR GRAMMAR & VISUAL SEMANTICS:
- Blue / Cyan (#58C4DD): Primary functions f(x), input vectors, baseline coordinate axes.
- Green (#83C167): Primary basis vector i-hat, positive probability states, ground truth.
- Red / Maroon (#FC6255, #C55F73): Secondary basis vector j-hat, residual errors, decision boundaries, cost loss.
- Yellow / Gold (#FFFF00, #F3AC3C): Active tangent slopes, key attention highlights, eigenvalues lambda, transformed vectors.
- Purple / Teal (#9A72AC, #5CD0B3): Latent projections, transformer attention blocks, orthogonal components.

3B1B PRIMITIVE REPERTORY (Pick the precise archetype for the mathematical concept):
- Calculus, slopes, integrals, limits -> "manim-function-plot" (expr, tangentAt, area, expr2)
- Matrices, 2D coordinate warps, linear maps -> "manim-vector-transform" (matrix, vector, projectOnto, showBasis)
- Invariant directions, spectral decomposition -> "manim-eigen-decomposition" (eigenvalues: [2.0, 0.7])
- Projections, dot & cross products -> "manim-dot-cross-product" (mode: "dot"|"cross", vectorA, vectorB)
- Basis changes & coordinate transforms -> "manim-basis-change" (basis1, basis2)
- Optimization & gradient descent -> "manim-gradient-descent-3d" (steps, momentum)
- Neural networks & forward pulses -> "manim-network-topology" (layers: [3, 5, 4, 2])
- Transformer blocks, attention, residual skip -> "manim-transformer-block" (highlight: "attention"|"ffn"|"residual")
- KV Cache token inference -> "manim-kv-cache" (promptTokens, generatedTokens)
- Computational graph & chain rule -> "manim-backprop-chain" (nodeNames)
- Probability & Bayes updating -> "manim-bayes-theorem" (prior, likelihoodTrue, likelihoodFalse)
- Monte Carlo sampling -> "manim-monte-carlo-pi" (pointCount, targetRatio)
- Markov chains & state transitions -> "manim-markov-chain" (states, transitions)

3B1B SCENE EXAMPLES:
- Example 1 (Calculus / Derivative morph):
  {
    "id": "scene3-derivative",
    "engine": "manim",
    "archetype": "manim-function-plot",
    "theme": "dark",
    "title": "Rate of Change and Tangent Slope",
    "manimData": { "title": "Tangent and Derivative", "expr": "x^2 - 2*x", "xRange": [-2, 4], "tangentAt": 1.5, "expr2": "2*x - 2" },
    "beats": [
      "A continuous parabola bends across our Cartesian coordinate plane.",
      "At x = 1.5, the local tangent line measures its instantaneous rate of change.",
      "As we trace all points, the tangent slopes assemble into a new linear function: the derivative."
    ],
    "fallbackArchetype": "bento-metric-grid",
    "fallbackPayload": { "bentoData": { "metrics": [{ "label": "Derivative at 1.5", "value": 1, "unit": "", "hero": true }] } }
  }
- Example 2 (Linear Algebra / Matrix shear):
  {
    "id": "scene4-matrix-shear",
    "engine": "manim",
    "archetype": "manim-vector-transform",
    "theme": "dark",
    "title": "Matrix Multiplication as Space Warp",
    "manimData": { "title": "Shear Transformation", "matrix": [[1, 1], [0, 1]], "vector": [1, 2], "showBasis": true },
    "beats": [
      "Every linear transformation is entirely determined by where it lands basis vectors i-hat and j-hat.",
      "When our matrix acts on space, the coordinate grid lines slide horizontally into a uniform shear.",
      "The yellow sample vector glides along with the warped grid, ending at its exact computed coordinates."
    ],
    "fallbackArchetype": "vector-cluster-graph",
    "fallbackPayload": { "clusters": [{ "name": "Basis", "value": "Shear" }] }
  }
`
    : ""
}
Timing & Chapter Breakdown:
${timingStructure
  .map((t, idx) => {
    const rec =
      Array.isArray(t.suggestedArchetypes) && t.suggestedArchetypes.length > 0
        ? ` (Recommended Visuals: ${t.suggestedArchetypes.map((a) => `"${a}"`).join(", ")})`
        : t.suggestedArchetype
          ? ` (Recommended Visuals: "${t.suggestedArchetype}")`
          : "";
    return `Chapter ${idx + 1} (${t.id}): ~${t.duration}s (~${t.maxWords} words) — Narrative Beat: ${t.chapterTitle || t.role}${t.narrativeIntent ? ` (${t.narrativeIntent})` : ""}${rec}`;
  })
  .join("\n")}

MANDATORY REQUIREMENTS FOR EVERY SCENE:
Every single scene (from Scene 1 to Scene ${actualSceneCount}) MUST ALWAYS include:
1. "id": Exact scene ID matching the breakdown (e.g. "scene1-hook", "scene2-paradigm", etc.)
2. "archetype": The chosen archetype name (DO NOT repeat the same archetype consecutively)
3. "theme": "dark" | "light" | "accent" (set "dark" on at least 1-2 scenes for technical deep-dives or visual contrast)
4. "title": Punchy 2-5 word visual scene headline (in double quotes)
5. "voiceover": Compelling spoken voiceover narration calibrated to the chapter target words (using multiline folded scalar ">")
6. "eyebrow": Short 1-3 word category / milestone tag (in double quotes)
7. The matching visual data payload for its archetype (e.g. kineticData, flowData, kpiData, codeDemo, diffData, clusters, stats, etc.). Do not output dummy properties for unrelated archetypes.

VISUAL DIVERSITY & REPERTORY RULES (CRITICAL):
- Never repeat the same archetype across different scenes in the same video.
- Match visual archetypes directly to the subject domain:
  * Distributed Systems / Infrastructure: "microservice-mesh", "architecture-pipeline", "database-shard-map", "event-bus-pubsub", "raft-consensus"
  * Developer Tools / Workflows: "code-terminal", "interactive-diff", "code-slice-reveal", "git-branch-graph", "browser-devtools", "compiler-ast"
  * Quantitative Performance & Benchmarks: "stat-spotlight", "kpi-counter-ring", "eval-benchmark-matrix", "bento-metric-grid", "data-graph", "radar-chart"
  * AI Architectures & Embeddings: "vector-cluster-graph", "embedding-similarity-space", "prompt-budget-canvas", "agent-scratchpad", "tool-calling-schema"
  * High-Impact Statements: "kinetic-impact", "3d-motion-hero", "carousel-3d-showcase", "quote-callout", "kinetic-text"
  * Continuous Mathematical Curves & Algorithmic Geometry (Manim): "manim-function-plot", "manim-vector-transform", "manim-eigen-decomposition", "manim-gradient-descent-3d", "manim-bayes-theorem", "manim-sorting-visualizer"

YAML SYNTAX RULES (CRITICAL FOR PARSING):
1. Wrap all title, subtitle, eyebrow, and product name values in DOUBLE QUOTES (e.g. title: "Architecture: The Distributed Core"). Unquoted colons cause syntax errors.
2. Use multiline folded scalars (voiceover: >) for voiceover narration.
3. Use exactly 2 spaces per indentation level. NEVER use tab characters.

STORYBOARD YAML SPECIFICATION:
Respond with a clean, structured YAML document (enclosed in \`\`\`yaml ... \`\`\`) matching this schema:
version: "2.0"
productName: "Topic or Product Name"
domain: "Domain or Field Badge"
engineMode: "${engineMode}"
scenes:
  - id: "scene1-hook"
    engine: "html-gsap"
    archetype: "kinetic-impact"
    theme: "dark"
    eyebrow: "Hook"
    title: "Context Is King"
    voiceover: >
      Modern large language models live and die by how efficiently they process their context window.
    transition: "crossfade"
    impactData:
      lines:
        - "CONTEXT IS"
        - "THE NEW RAM"
      accent: "RAM"
      tag: "Inference Bottleneck"
  - id: "scene2-budget"
    engine: "html-gsap"
    archetype: "prompt-budget-canvas"
    theme: "light"
    eyebrow: "Tokens & Context"
    title: "Allocating the Prompt Budget"
    voiceover: >
      Every prompt competes for finite context tokens across system instructions, retrieved documents, and conversation history.
    transition: "blur-crossfade"
    budgetData:
      totalTokens: 8192
      segments:
        - label: "System Prompt"
          tokens: 512
          color: "var(--accent)"
        - label: "RAG Context"
          tokens: 4096
          color: "var(--text)"
        - label: "Chat History"
          tokens: 2048
          color: "var(--border)"
        - label: "Output Headroom"
          tokens: 1536
          color: "var(--card)"
  - id: "scene3-kvcache"
    engine: "manim"
    archetype: "manim-kv-cache"
    theme: "dark"
    eyebrow: "Cache Growth & Memory"
    title: "Key-Value Cache Expansion"
    voiceover: >
      As the model generates each subsequent token, past key and value projections are cached in GPU memory to prevent redundant recomputation.
    transition: "crossfade"
    manimData:
      title: "KV Cache Ingestion"
      promptTokens:
        - "Deep"
        - "Seek"
        - "V3"
      generatedTokens:
        - "generates"
        - "tokens"
        - "fast"
    beats:
      - "Past key and value vectors are stored in memory."
      - "New tokens attend to the cache without recomputing previous tokens."
      - "Memory bandwidth becomes the primary inference bottleneck."
    fallbackArchetype: "step-progression"
    fallbackPayload:
      stepData:
        steps:
          - label: "Prompt Ingestion"
            detail: "Precompute K and V matrices"
          - label: "Cache Allocation"
            detail: "Lock attention states into HBM"
          - label: "Autoregressive Step"
            detail: "Append new token state dynamically"
  - id: "scene4-rope"
    engine: "manim"
    archetype: "manim-positional-rope"
    theme: "dark"
    eyebrow: "Attention & Geometry"
    title: "Rotary Positional Embeddings"
    voiceover: >
      Rotary embeddings encode token order geometrically by rotating query and key vector pairs across complex frequency planes.
    transition: "crossfade"
    manimData:
      title: "RoPE Vector Rotation"
      angle1: 30
      angle2: 75
    beats:
      - "Tokens gain position information via 2D rotation angles."
      - "Relative distance is preserved as inner products decay smoothly."
      - "Attention mechanisms naturally distinguish nearby context."
    fallbackArchetype: "vector-cluster-graph"
    fallbackPayload:
      clusters:
        - name: "Query Plane"
          nodeCount: 8
          active: true
        - name: "Key Target"
          nodeCount: 6
          active: false
      stats:
        metric: "RoPE Geometry"
        latency: "Relative Encoding"
  - id: "scene${actualSceneCount}-outro"
    engine: "html-gsap"
    archetype: "outro"
    theme: "accent"
    eyebrow: "Takeaway"
    title: "Engineered for Efficiency"
    subtitle: "Master the geometry and memory of modern transformer inference."
    voiceover: >
      Optimizing memory layout and positional geometry unlocks the next frontier of high-throughput language models.
    transition: "blur-crossfade"
    pills:
      - "Prompt Budgets"
      - "KV Caching"
      - "Rotary Geometry"
    cta: "Explore Inference Architectures"`;
}

// OpenRouter Storyboard Director
async function directStoryboard({
  apiKey,
  model,
  sourceUrl,
  sourceScript,
  sourceTopic,
  topicStyle,
  duration,
  format,
  timingStructure: providedTiming,
  manimEnabled = false,
  engineMode = "combined",
}) {
  let context = "";
  if (sourceUrl) {
    const snippet = await fetchSiteSnippet(sourceUrl);
    if (!snippet)
      throw new Error("Website contains no readable text; provide a written brief instead");
    context = `Website URL: ${sourceUrl}\nContent Snippet: ${snippet}`;
  } else if (sourceTopic) {
    context = `Topic / Subject: ${sourceTopic}\nTopic Style: ${topicStyle || "explainer"}\nPrepared Script / Curriculum:\n${sourceScript}`;
  } else {
    context = `Script / Brief:\n${sourceScript}`;
  }

  const timingStructure =
    providedTiming || getSceneTimingStructure(duration, undefined, { engineMode });
  const sceneCount = timingStructure.length;
  const isPortrait = format === "portrait";

  const isEducational = duration >= 90 || Boolean(sourceTopic);
  const prompt = buildDirectorPrompt({
    context,
    duration,
    sceneCount,
    isPortrait,
    format,
    isEducational,
    manimEnabled,
    engineMode,
    timingStructure,
  });

  const effectiveKey = apiKey || process.env.OPENROUTER_API_KEY;
  if (!effectiveKey) {
    throw new Error(
      "An OpenRouter API key is required to create a video grounded in your source. The offline template does not use your document and has been disabled.",
    );
  }

  const primaryModel = model || "anthropic/claude-haiku-5.5";
  const fallbackModel =
    primaryModel === "google/gemini-3.5-flash-lite"
      ? "anthropic/claude-haiku-5.5"
      : "google/gemini-3.5-flash-lite";

  const callDirector = async (messages, maxTokens, targetModel = primaryModel) => {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${effectiveKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:4000",
        "X-Title": "Studio One Production Suite",
      },
      body: JSON.stringify({
        model: targetModel,
        messages,
        temperature: messages.length > 2 ? 0 : 0.6,
        top_p: 0.9,
        max_tokens: maxTokens,
      }),
      signal: AbortSignal.timeout(180_000),
    });
    if (!response.ok) {
      let errDetail = "";
      try {
        const errJson = await response.json();
        errDetail = errJson.error?.message || JSON.stringify(errJson);
      } catch {
        errDetail = await response.text().catch(() => "");
      }
      throw new Error(
        `OpenRouter returned HTTP ${response.status} (${targetModel}): ${errDetail || "check the API key and model"}`,
      );
    }
    const data = await response.json();
    if (data.error) {
      throw new Error(
        `OpenRouter API error (${targetModel}): ${data.error.message || JSON.stringify(data.error)}`,
      );
    }
    return extractOpenRouterContent(data);
  };

  // At least 8192 output tokens so long multi-scene storyboards are not cut off mid-array.
  const maxTokens = Math.min(16000, Math.max(8192, sceneCount * 250));
  let rawContent = "";
  let activeModel = primaryModel;

  try {
    rawContent = await callDirector(
      [
        {
          role: "system",
          content:
            "You are an autonomous YAML video design director adhering to professional Hyperframes standards. You produce clean, valid YAML storyboards without commentary.",
        },
        { role: "user", content: prompt },
      ],
      maxTokens,
      primaryModel,
    );
    if (!rawContent || !rawContent.trim()) {
      throw new Error(`Model ${primaryModel} returned empty completion`);
    }
  } catch (primaryErr) {
    console.warn(
      `[DIRECTOR MODEL FALLBACK] Primary director ${primaryModel} failed (${primaryErr.message}). Falling back to ${fallbackModel}...`,
    );
    activeModel = fallbackModel;
    rawContent = await callDirector(
      [
        {
          role: "system",
          content:
            "You are an autonomous YAML video design director adhering to professional Hyperframes standards. You produce clean, valid YAML storyboards without commentary.",
        },
        { role: "user", content: prompt },
      ],
      maxTokens,
      fallbackModel,
    );
  }

  try {
    return parseStoryboardYamlOrJson(rawContent);
  } catch (err) {
    if (typeof rawContent !== "string" || !rawContent.trim()) {
      if (activeModel !== fallbackModel) {
        console.warn(
          `[DIRECTOR MODEL FALLBACK] Empty storyboard from ${activeModel}; attempting fallback to ${fallbackModel}`,
        );
        activeModel = fallbackModel;
        rawContent = await callDirector(
          [
            {
              role: "system",
              content:
                "You are an autonomous YAML video design director adhering to professional Hyperframes standards. You produce clean, valid YAML storyboards without commentary.",
            },
            { role: "user", content: prompt },
          ],
          maxTokens,
          fallbackModel,
        );
        return parseStoryboardYamlOrJson(rawContent);
      }
      throw err;
    }
    console.warn(
      `[DIRECTOR STORYBOARD REPAIR] ${err.message}; requesting one repair pass with ${activeModel}`,
    );
    try {
      const repaired = await callDirector(
        [
          {
            role: "system",
            content:
              "You fix malformed YAML or JSON storyboards. Reply with only the corrected, valid YAML specification. No commentary, no explanation. Preserve all content.",
          },
          {
            role: "user",
            content: `This storyboard specification failed to parse: ${err.message}.\n\nRaw storyboard:\n${rawContent.slice(0, 60000)}`,
          },
          { role: "user", content: "Return the fixed YAML only." },
        ],
        maxTokens,
        activeModel,
      );
      return parseStoryboardYamlOrJson(repaired);
    } catch (repairErr) {
      if (activeModel !== fallbackModel) {
        console.warn(
          `[DIRECTOR REPAIR FALLBACK] Repair with ${activeModel} failed (${repairErr.message}); falling back to fresh generation with ${fallbackModel}`,
        );
        const fallbackContent = await callDirector(
          [
            {
              role: "system",
              content:
                "You are an autonomous YAML video design director adhering to professional Hyperframes standards. You produce clean, valid YAML storyboards without commentary.",
            },
            { role: "user", content: prompt },
          ],
          maxTokens,
          fallbackModel,
        );
        return parseStoryboardYamlOrJson(fallbackContent);
      }
      throw repairErr;
    }
  }
}

async function generateSoundtrack({ musicEngine = "quiet-reflection", duration = 30, targetPath }) {
  const ffmpeg = requireBin("ffmpeg", "install it with `brew install ffmpeg`");
  const silence = () =>
    execFileAsync(ffmpeg, [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "anullsrc=r=48000:cl=stereo",
      "-t",
      "1",
      targetPath,
    ]);

  if (musicEngine === "none") {
    await silence();
    return "none";
  }

  const selectedTrack = SOUNDTRACK_MAP[musicEngine];
  if (!selectedTrack) {
    console.warn(`[Soundtrack] Unknown engine "${musicEngine}", falling back to quiet-reflection`);
  }
  const track =
    selectedTrack || SOUNDTRACK_MAP["quiet-reflection"] || SOUNDTRACK_MAP["soothing-ambient"];
  const sourcePath = path.join(PUBLIC_DIR, "soundtracks", track.file);

  if (!fs.existsSync(sourcePath)) {
    console.warn(`[Soundtrack] File not found: ${sourcePath}, using fallback silence`);
    await silence();
    return "none";
  }

  const totalDur = Math.max(parseFloat(duration) || 30.0, 8.0);
  const fadeOutStart = Math.max(0, totalDur - 2.5);

  // High fidelity studio processing: loop if needed, trim to duration, 1s fade-in,
  // 2.5s fade-out, 48kHz stereo WAV. Arguments are passed as an array (no shell).
  await execFileAsync(ffmpeg, [
    "-y",
    "-stream_loop",
    "-1",
    "-i",
    sourcePath,
    "-t",
    String(totalDur),
    "-af",
    `afade=t=in:ss=0:d=1,afade=t=out:st=${fadeOutStart}:d=2.5`,
    "-ar",
    "48000",
    "-ac",
    "2",
    targetPath,
  ]);
  return track.name;
}

export function buildSceneHtmlAndChoreography(
  scene,
  i,
  totalScenes,
  sDur,
  compWidth,
  compHeight,
  isPortrait,
  activePalette = {},
) {
  const h = (v) =>
    String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  // Relax rigid scene 0 / last scene constraints: honor scene.archetype if specified
  const defaultArch = i === 0 ? "hook" : i === totalScenes - 1 ? "outro" : "features-cards";
  const archetype = scene.archetype || defaultArch;
  const effectivePalette = resolveScenePalette(scene, activePalette);

  const renderer =
    ARCHETYPE_RENDERERS[archetype] || ARCHETYPE_RENDERERS["features-cards"] || renderDefaultCards;
  const context = {
    scene,
    i,
    totalScenes,
    sDur,
    compWidth,
    compHeight,
    isPortrait,
    h,
    activePalette: effectivePalette,
  };

  const { innerHtml, gsapChoreography } = renderer.renderHtml(context);

  // Continuous Cinematic Camera Push / Drift:
  // Adds a subtle, continuous 3% scale across the scene duration so frames never feel frozen.
  const driftDur = parseFloat(scene.duration) || 8.0;
  const finalChoreography =
    gsapChoreography +
    `\n    tl.to(scope.querySelector(".scene-inner"), { scale: 1.03, duration: ${driftDur}, ease: "none" }, 0);\n  `;

  return { innerHtml, gsapChoreography: finalChoreography };
}

// Scoped CSS for all archetypes with tailored Mobile Portrait (1080x1920) and Landscape (1920x1080) specs
export function getArchetypeScopedCss(
  scene = {},
  compWidth = 1920,
  compHeight = 1080,
  isPortrait = false,
  activePalette = PALETTES["braun-industrial"],
) {
  const defaultArch = "features-cards";
  const arch = scene?.archetype || defaultArch;
  const sceneId = scene?.id || "scene";
  const renderer =
    ARCHETYPE_RENDERERS[arch] || ARCHETYPE_RENDERERS["features-cards"] || renderDefaultCards;

  const effectivePalette = resolveScenePalette(scene, activePalette);
  const isDark = Boolean(effectivePalette.isDark || scene?.theme === "dark");

  let bgStyle = renderer?.getBackground
    ? renderer.getBackground({ isPortrait, activePalette: effectivePalette, scene })
    : `background: ${effectivePalette.background};`;

  if (!bgStyle) {
    bgStyle = `background: ${effectivePalette.background};`;
  }

  const customCss = renderer?.renderCss
    ? renderer.renderCss({
        scene,
        compWidth,
        compHeight,
        isPortrait,
        activePalette: effectivePalette,
      })
    : "";

  const surfaceBg = isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.03)";
  const borderColor =
    effectivePalette.border || (isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.1)");
  const brandColor = effectivePalette.accent || "#6366f1";
  const accentColor = effectivePalette.accent2 || effectivePalette.accent || "#38bdf8";
  const accent2Color = effectivePalette.accent3 || "#f43f5e";
  const textMuted =
    effectivePalette.textMuted || (isDark ? "rgba(255, 255, 255, 0.65)" : "rgba(0, 0, 0, 0.6)");

  return `
    [data-composition-id="${sceneId}"] {
      /* Hyperframes 18-Token Design Contract */
      --bg: ${isDark ? "#0b0d14" : effectivePalette.background};
      --fg: ${isDark ? "#f3f4f8" : effectivePalette.text};
      --muted: ${textMuted};
      --surface: ${surfaceBg};
      --card: ${effectivePalette.card};
      --card-text: ${effectivePalette.cardText};
      --card-text-muted: ${effectivePalette.cardTextMuted};
      --border: ${borderColor};
      --brand: ${brandColor};
      --accent: ${accentColor};
      --accent-2: ${accent2Color};
      --font-display: "Plus Jakarta Sans", "Inter", -apple-system, BlinkMacSystemFont, sans-serif;
      --font-body: "Plus Jakarta Sans", "Inter", -apple-system, BlinkMacSystemFont, sans-serif;
      --font-mono: "JetBrains Mono", "SF Mono", monospace;
      --radius: ${isPortrait ? "24px" : "18px"};
      --space-1: 8px;
      --space-2: 16px;
      --space-3: 32px;
      --dur-beat: 0.4s;
      --ease-standard: cubic-bezier(0.16, 1, 0.3, 1);
      --ease-emphasis: cubic-bezier(0.34, 1.56, 0.64, 1);
      --ease-spring: cubic-bezier(0.34, 1.35, 0.64, 1);
      --ease-snappy: cubic-bezier(0.18, 1.25, 0.4, 1);
      --ease-heavy: cubic-bezier(0.25, 1, 0.5, 1);

      position: absolute;
      inset: 0;
      width: ${compWidth}px;
      height: ${compHeight}px;
      ${bgStyle}
      overflow: hidden;
      color: var(--fg);
    }
    [data-composition-id="${sceneId}"]::before {
      content: "";
      position: absolute;
      inset: 0;
      background: radial-gradient(circle at 50% 20%, ${isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(255, 255, 255, 0.6)"} 0%, transparent 70%);
      pointer-events: none;
      z-index: 0;
    }
    [data-composition-id="${sceneId}"]::after {
      content: "";
      position: absolute;
      inset: 0;
      background: radial-gradient(ellipse at center, transparent 60%, ${isDark ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.06)"} 100%),
                  radial-gradient(circle at 85% 15%, ${effectivePalette.accent}14 0%, transparent 45%),
                  radial-gradient(circle at 15% 85%, ${effectivePalette.accent2 || effectivePalette.accent}10 0%, transparent 40%);
      pointer-events: none;
      z-index: 0;
    }
    [data-composition-id="${sceneId}"] .scene-inner { width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: ${isPortrait ? "flex-start" : "center"}; align-items: center; padding: ${isPortrait ? "130px 48px 120px" : compWidth === compHeight ? "80px 60px" : "60px 100px"}; text-align: center; box-sizing: border-box; transform-origin: center center; position: relative; z-index: 1; }

    /* Split-Stage Hero Layout (Left Narrative / Right Graphic) */
    [data-composition-id="${sceneId}"] .split-hero-layout { width: 100%; height: 100%; display: flex; flex-direction: row; align-items: center; justify-content: space-between; padding: 60px 100px; box-sizing: border-box; text-align: left; }
    [data-composition-id="${sceneId}"] .split-col-left { flex: 0 0 42%; display: flex; flex-direction: column; align-items: flex-start; text-align: left; }
    [data-composition-id="${sceneId}"] .split-hero-title { font-family: "Plus Jakarta Sans", "Playfair Display", serif; font-size: 64px; font-weight: 800; line-height: 1.15; letter-spacing: -0.03em; color: ${effectivePalette.text}; margin-top: 12px; }
    [data-composition-id="${sceneId}"] .split-hero-sub { font-size: 24px; color: ${effectivePalette.textMuted || effectivePalette.text}; line-height: 1.5; margin-top: 18px; max-width: 580px; }
    [data-composition-id="${sceneId}"] .split-hero-badge { margin-top: 28px; display: inline-flex; align-items: center; gap: 10px; background: ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)"}; border: 1px solid ${effectivePalette.border}; padding: 8px 20px; border-radius: 30px; font-family: "JetBrains Mono", monospace; font-size: 14px; font-weight: 600; color: ${effectivePalette.accent}; }
    [data-composition-id="${sceneId}"] .split-col-right { flex: 0 0 54%; display: flex; align-items: center; justify-content: center; }

    /* Full-Bleed Showcase Canvas */
    [data-composition-id="${sceneId}"] .fullbleed-layout { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: stretch; justify-content: flex-start; padding: 40px 80px; box-sizing: border-box; text-align: left; }
    [data-composition-id="${sceneId}"] .top-nav-bar { display: flex; justify-content: space-between; align-items: center; padding-bottom: 20px; border-bottom: 1px solid ${effectivePalette.border}; margin-bottom: 28px; width: 100%; }
    [data-composition-id="${sceneId}"] .nav-left { display: flex; align-items: center; gap: 14px; }
    [data-composition-id="${sceneId}"] .nav-badge { font-family: "JetBrains Mono", monospace; font-size: 15px; font-weight: 700; color: ${effectivePalette.accent}; letter-spacing: 0.08em; text-transform: uppercase; }
    [data-composition-id="${sceneId}"] .nav-sep { color: ${effectivePalette.border}; font-weight: 300; font-size: 18px; }
    [data-composition-id="${sceneId}"] .nav-title { font-family: "Plus Jakarta Sans", "Playfair Display", serif; font-size: 28px; font-weight: 700; letter-spacing: -0.02em; color: ${effectivePalette.text}; }
    [data-composition-id="${sceneId}"] .nav-status-pill { font-family: "JetBrains Mono", monospace; font-size: 13px; font-weight: 600; color: ${effectivePalette.textMuted || effectivePalette.text}; background: ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)"}; border: 1px solid ${effectivePalette.border}; padding: 6px 16px; border-radius: 20px; }
    [data-composition-id="${sceneId}"] .showcase-stage { flex: 1; display: flex; align-items: center; justify-content: center; width: 100%; }

    /* Full-bleed element adjustments */
    [data-composition-id="${sceneId}"] .terminal-fullbleed { max-width: 1560px; width: 100%; margin-top: 0; }
    [data-composition-id="${sceneId}"] .flow-fullbleed { max-width: 1600px; width: 100%; margin-top: 0; }
    [data-composition-id="${sceneId}"] .diff-fullbleed { max-width: 1560px; width: 100%; margin-top: 0; }
    [data-composition-id="${sceneId}"] .chart-fullbleed { max-width: 1560px; width: 100%; margin-top: 0; height: 580px; }
    [data-composition-id="${sceneId}"] .quote-split { max-width: 760px; margin-top: 0; }
    [data-composition-id="${sceneId}"] .ladder-split { max-width: 760px; margin-top: 0; }
    [data-composition-id="${sceneId}"] .live-feed-split { max-width: 760px; margin-top: 0; }

    [data-composition-id="${sceneId}"] .eyebrow { font-family: "JetBrains Mono", monospace; font-size: ${isPortrait ? "22px" : "18px"}; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: ${effectivePalette.textMuted || effectivePalette.text}; margin-bottom: ${isPortrait ? "14px" : "20px"}; display: flex; align-items: center; gap: 12px; }
    [data-composition-id="${sceneId}"] .eyebrow-dot { width: 10px; height: 10px; border-radius: 50%; background-color: ${effectivePalette.accent}; box-shadow: 0 0 12px ${effectivePalette.accent}; }
    [data-composition-id="${sceneId}"] .editorial-title { font-family: "Plus Jakarta Sans", "Playfair Display", serif; font-size: ${isPortrait ? "76px" : "88px"}; font-weight: 800; line-height: 1.12; letter-spacing: -0.03em; color: ${effectivePalette.text}; text-align: center; max-width: ${isPortrait ? "940px" : "1400px"}; }
    [data-composition-id="${sceneId}"] .brand-dot { color: ${effectivePalette.accent}; }
    [data-composition-id="${sceneId}"] .cursor-blink { display: inline-block; width: 4px; height: 0.9em; background: ${effectivePalette.text}; margin-left: 8px; vertical-align: -0.05em; }
    [data-composition-id="${sceneId}"] .editorial-subtitle { font-size: ${isPortrait ? "30px" : "30px"}; font-weight: 400; color: ${effectivePalette.muted}; line-height: 1.45; margin-top: 18px; text-align: center; max-width: ${isPortrait ? "880px" : "900px"}; }
    [data-composition-id="${sceneId}"] .friction-box { margin-top: 40px; background: ${effectivePalette.card}; border: 1px solid ${effectivePalette.border}; border-radius: 16px; padding: 22px 40px; box-shadow: ${isDark ? "0 12px 32px rgba(0,0,0,0.4)" : "0 12px 32px rgba(0,0,0,0.04)"}; display: flex; align-items: center; gap: 16px; }
    [data-composition-id="${sceneId}"] .keyboard-badge { background: ${isDark ? "#1c202d" : "#ece8df"}; border: 1px solid ${isDark ? "#2e3447" : "#dcd7cc"}; border-radius: 8px; padding: 8px 16px; font-family: "JetBrains Mono", monospace; font-size: 18px; font-weight: 600; color: ${isDark ? "#f3f4f8" : "#3b3935"}; }
    [data-composition-id="${sceneId}"] .friction-text { font-family: "JetBrains Mono", monospace; font-size: 22px; color: ${effectivePalette.textMuted || effectivePalette.text}; }

    /* Archetype-Specific Scoped CSS */
    ${customCss}

    /* =========================================================================
     * WCAG 2.1 Contrast Armor & Deep Obsidian Dark Theme Overrides
     * Guaranteed Legibility Across All Themes & Cards
     * ========================================================================= */

    /* 1. Scene-Level Typography (Outside Cards) */
    [data-composition-id="${sceneId}"] .editorial-title,
    [data-composition-id="${sceneId}"] .split-hero-title,
    [data-composition-id="${sceneId}"] .nav-title {
      color: ${effectivePalette.text} !important;
    }
    [data-composition-id="${sceneId}"] .editorial-subtitle,
    [data-composition-id="${sceneId}"] .split-hero-sub,
    [data-composition-id="${sceneId}"] .eyebrow {
      color: ${effectivePalette.textMuted} !important;
    }

    /* 2. Universal Card Surfaces Across All Archetypes */
    [data-composition-id="${sceneId}"] .bento-tile,
    [data-composition-id="${sceneId}"] .feature-card,
    [data-composition-id="${sceneId}"] .step-card,
    [data-composition-id="${sceneId}"] .feed-item-pill,
    [data-composition-id="${sceneId}"] .iso-slab,
    [data-composition-id="${sceneId}"] .pipe-node,
    [data-composition-id="${sceneId}"] .flow-node,
    [data-composition-id="${sceneId}"] .diff-pane,
    [data-composition-id="${sceneId}"] .chart-wrapper,
    [data-composition-id="${sceneId}"] .quote-card,
    [data-composition-id="${sceneId}"] .outro-card,
    [data-composition-id="${sceneId}"] .rag-stage-card,
    [data-composition-id="${sceneId}"] .agent-step-card,
    [data-composition-id="${sceneId}"] .ess-polar-space,
    [data-composition-id="${sceneId}"] .ess-rank-row,
    [data-composition-id="${sceneId}"] .tcs-left-card,
    [data-composition-id="${sceneId}"] .tcs-right-card,
    [data-composition-id="${sceneId}"] .ebm-bench-card,
    [data-composition-id="${sceneId}"] .dlf-stage-col,
    [data-composition-id="${sceneId}"] .msm-node-card,
    [data-composition-id="${sceneId}"] .dsm-shard-card,
    [data-composition-id="${sceneId}"] .mls-col,
    [data-composition-id="${sceneId}"] .dag-node-card,
    [data-composition-id="${sceneId}"] .ebp-event-card,
    [data-composition-id="${sceneId}"] .ast-branch-card,
    [data-composition-id="${sceneId}"] .raft-node-card,
    [data-composition-id="${sceneId}"] .git-commit-node,
    [data-composition-id="${sceneId}"] .threat-card,
    [data-composition-id="${sceneId}"] .kanban-card,
    [data-composition-id="${sceneId}"] .cl-card,
    [data-composition-id="${sceneId}"] .circuit-state-card,
    [data-composition-id="${sceneId}"] .limiter-bucket-card,
    [data-composition-id="${sceneId}"] .limiter-metric-tile,
    [data-composition-id="${sceneId}"] .audit-table-wrap,
    [data-composition-id="${sceneId}"] .orbit-satellite,
    [data-composition-id="${sceneId}"] .orbit-center-node,
    [data-composition-id="${sceneId}"] .metric-hero-box,
    [data-composition-id="${sceneId}"] .mockup-card-primary,
    [data-composition-id="${sceneId}"] .mockup-card-secondary {
      background: var(--card) !important;
      border: 1px solid ${effectivePalette.border} !important;
      color: var(--card-text) !important;
      ${effectivePalette.cardIsDark ? "box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5) !important;" : "box-shadow: 0 16px 40px rgba(0, 0, 0, 0.05) !important;"}
    }

    /* 3. Primary Headings, Metrics & Labels inside Cards -> STRICT cardText */
    [data-composition-id="${sceneId}"] .feature-card .card-title,
    [data-composition-id="${sceneId}"] .feature-card h3,
    [data-composition-id="${sceneId}"] .bento-tile .bento-value,
    [data-composition-id="${sceneId}"] .bento-tile .bento-label,
    [data-composition-id="${sceneId}"] .step-card .step-title,
    [data-composition-id="${sceneId}"] .flow-node .flow-node-title,
    [data-composition-id="${sceneId}"] .chart-wrapper .chart-title,
    [data-composition-id="${sceneId}"] .quote-card .quote-text,
    [data-composition-id="${sceneId}"] .outro-card h1,
    [data-composition-id="${sceneId}"] .outro-card h2,
    [data-composition-id="${sceneId}"] .orb-center-title,
    [data-composition-id="${sceneId}"] .sat-label,
    [data-composition-id="${sceneId}"] .mockup-card-primary .mockup-big-val,
    [data-composition-id="${sceneId}"] .mockup-card-secondary .mockup-small-val {
      color: var(--card-text) !important;
    }

    /* 4. Paragraphs, Bullets, and Body Text inside Cards -> STRICT cardText */
    [data-composition-id="${sceneId}"] .feature-card .email-body,
    [data-composition-id="${sceneId}"] .feature-card .note-item,
    [data-composition-id="${sceneId}"] .step-card .step-desc,
    [data-composition-id="${sceneId}"] .flow-node .flow-node-desc,
    [data-composition-id="${sceneId}"] .sat-desc,
    [data-composition-id="${sceneId}"] .feed-text,
    [data-composition-id="${sceneId}"] .quote-author {
      color: var(--card-text) !important;
    }

    /* 5. Subtitles & Secondary Details inside Cards -> STRICT cardTextMuted (minimum 4.5:1 ratio) */
    [data-composition-id="${sceneId}"] .bento-tile .bento-detail,
    [data-composition-id="${sceneId}"] .chart-wrapper .chart-subtitle,
    [data-composition-id="${sceneId}"] .orb-center-sub,
    [data-composition-id="${sceneId}"] .feed-sub,
    [data-composition-id="${sceneId}"] .flow-node-desc,
    [data-composition-id="${sceneId}"] .nav-status-pill,
    [data-composition-id="${sceneId}"] .friction-text {
      color: var(--card-text-muted) !important;
    }

    /* 6. Embedded Dark Terminal / DevTools Shells (Always Dark Phosphor Console) */
    [data-composition-id="${sceneId}"] .terminal-card,
    [data-composition-id="${sceneId}"] .tf-terminal,
    [data-composition-id="${sceneId}"] .code-terminal-pane,
    [data-composition-id="${sceneId}"] .chat-stream-card,
    [data-composition-id="${sceneId}"] .browser-mockup-frame {
      background: #0d0f17 !important;
      border: 1px solid rgba(255, 255, 255, 0.14) !important;
      color: #f1f5f9 !important;
    }
    [data-composition-id="${sceneId}"] .terminal-card *,
    [data-composition-id="${sceneId}"] .tf-terminal .tf-cmd,
    [data-composition-id="${sceneId}"] .tf-terminal .tf-line,
    [data-composition-id="${sceneId}"] .code-terminal-pane .term-code-line,
    [data-composition-id="${sceneId}"] .chat-stream-card .chat-bubble {
      color: #f1f5f9;
    }

    /* 7. Badges, Pills & Accent Buttons */
    [data-composition-id="${sceneId}"] .cta-button {
      background: ${effectivePalette.accent} !important;
      color: ${effectivePalette.accentText || "#ffffff"} !important;
      border: 1px solid rgba(255, 255, 255, 0.2) !important;
      box-shadow: 0 12px 36px ${effectivePalette.accent}55 !important;
    }
    [data-composition-id="${sceneId}"] .pill-feature {
      background: ${effectivePalette.card} !important;
      border: 1px solid ${effectivePalette.border} !important;
      color: ${effectivePalette.cardText} !important;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1) !important;
    }
    [data-composition-id="${sceneId}"] .feed-tag,
    [data-composition-id="${sceneId}"] .step-badge,
    [data-composition-id="${sceneId}"] .node-badge,
    [data-composition-id="${sceneId}"] .flow-node-badge,
    [data-composition-id="${sceneId}"] .card-badge,
    [data-composition-id="${sceneId}"] .note-icon,
    [data-composition-id="${sceneId}"] .kinetic-pill {
      background: ${effectivePalette.cardIsDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)"} !important;
      border: 1px solid ${effectivePalette.border} !important;
      color: ${effectivePalette.cardText} !important;
    }

    /* Portrait stacks */
    [data-composition-id="${sceneId}"] .portrait-stack { display: flex; flex-direction: column; gap: 24px; max-width: 920px; width: 100%; }

    ${
      compWidth === compHeight
        ? `
    /* =========================================================================
     * Square Aspect Ratio (1080x1080) Fit Armor
     * Guarantees all motion layouts, cards, and titles fit elegantly within 1080x1080
     * ========================================================================= */
    [data-composition-id="${sceneId}"] .editorial-title { font-size: clamp(38px, 5.2vw, 56px) !important; max-width: 920px !important; }
    [data-composition-id="${sceneId}"] .editorial-subtitle { font-size: 22px !important; max-width: 860px !important; margin-top: 14px !important; }
    [data-composition-id="${sceneId}"] .cards-container { width: 100% !important; max-width: 960px !important; gap: 24px !important; margin: 24px auto 0 !important; }
    [data-composition-id="${sceneId}"] .feature-card { padding: 32px 36px !important; min-height: auto !important; }
    [data-composition-id="${sceneId}"] .bento-grid { width: 100% !important; max-width: 960px !important; grid-template-columns: repeat(2, 1fr) !important; gap: 16px !important; margin: 24px auto 0 !important; }
    [data-composition-id="${sceneId}"] .ladder-container { width: 100% !important; max-width: 960px !important; height: auto !important; flex-direction: column !important; gap: 16px !important; margin: 24px auto 0 !important; }
    [data-composition-id="${sceneId}"] .live-feed-stream { width: 100% !important; max-width: 960px !important; margin-top: 24px !important; }
    [data-composition-id="${sceneId}"] .isometric-container { width: 100% !important; max-width: 960px !important; margin-top: 24px !important; }
    [data-composition-id="${sceneId}"] .terminal-card { width: 100% !important; max-width: 960px !important; margin-top: 24px !important; }
    [data-composition-id="${sceneId}"] .compare-container { width: 100% !important; max-width: 960px !important; gap: 20px !important; margin-top: 24px !important; }
    [data-composition-id="${sceneId}"] .chart-wrapper { width: 100% !important; max-width: 960px !important; margin-top: 24px !important; padding: 28px 36px !important; }
    [data-composition-id="${sceneId}"] .quote-card { width: 100% !important; max-width: 960px !important; margin-top: 24px !important; padding: 32px 40px !important; }
    [data-composition-id="${sceneId}"] .flow-process-container { width: 100% !important; max-width: 960px !important; flex-wrap: wrap !important; gap: 16px !important; margin-top: 24px !important; }
    [data-composition-id="${sceneId}"] .kpi-ring-stage { width: 100% !important; max-width: 960px !important; margin-top: 24px !important; }
    [data-composition-id="${sceneId}"] .diff-split-container { width: 100% !important; max-width: 960px !important; gap: 16px !important; margin-top: 24px !important; }
    [data-composition-id="${sceneId}"] .chat-stream-card { width: 100% !important; max-width: 960px !important; margin-top: 24px !important; }
    [data-composition-id="${sceneId}"] .sp-track { width: 100% !important; max-width: 960px !important; flex-wrap: wrap !important; gap: 16px !important; margin-top: 24px !important; }
    [data-composition-id="${sceneId}"] .dlf-columns-track { width: 100% !important; max-width: 960px !important; flex-direction: column !important; margin-top: 24px !important; }
    [data-composition-id="${sceneId}"] .orbit-stage { width: 560px !important; height: 560px !important; margin-top: 20px !important; }
    [data-composition-id="${sceneId}"] .mobile-phone-frame { width: 380px !important; height: 580px !important; margin-top: 20px !important; }
    [data-composition-id="${sceneId}"] .fullbleed-layout { padding: 32px 48px !important; }
    [data-composition-id="${sceneId}"] .split-hero-layout { flex-direction: column !important; justify-content: center !important; align-items: center !important; padding: 40px 50px !important; text-align: center !important; }
    [data-composition-id="${sceneId}"] .split-col-left { flex: none !important; width: 100% !important; align-items: center !important; text-align: center !important; }
    [data-composition-id="${sceneId}"] .split-hero-title { font-size: 46px !important; text-align: center !important; }
    [data-composition-id="${sceneId}"] .split-hero-sub { font-size: 20px !important; text-align: center !important; max-width: 820px !important; }
    [data-composition-id="${sceneId}"] .split-hero-badge { margin-top: 18px !important; }
    [data-composition-id="${sceneId}"] .split-col-right { flex: none !important; width: 100% !important; margin-top: 24px !important; justify-content: center !important; }
    `
        : ""
    }
  `;
}

// Master Production Pipeline

/**
 * One-scene project index. `chalkframes render -c` cannot render a <template> sub-composition
 * directly (verified: it waits 45s for a timeline that never registers), so each scene gets
 * its own tiny project whose index.html mounts that single composition at t=0.
 */
function buildSegmentHtml({ scene, durationSec, compWidth, compHeight, activePalette }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${compWidth}, height=${compHeight}" />
    <title>${scene.id}</title>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=block" rel="stylesheet" />
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { margin: 0; width: ${compWidth}px; height: ${compHeight}px; overflow: hidden; background-color: ${activePalette.background}; color: ${activePalette.text}; font-family: "Plus Jakarta Sans", "Inter", sans-serif; }
      #root { position: relative; width: ${compWidth}px; height: ${compHeight}px; background: ${activePalette.background}; overflow: hidden; }
      .scene { position: absolute; inset: 0; width: ${compWidth}px; height: ${compHeight}px; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${durationSec.toFixed(6)}" data-width="${compWidth}" data-height="${compHeight}">
      <div id="${scene.id}" class="scene clip" data-composition-id="${scene.id}" data-composition-src="compositions/${scene.id}.html" data-start="0" data-duration="${durationSec.toFixed(6)}" data-track-index="4" data-width="${compWidth}" data-height="${compHeight}"></div>
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      const mainTl = gsap.timeline({ paused: true });
      window.__timelines["main"] = mainTl;
    </script>
  </body>
</html>`;
}

/**
 * Last-resort scene: static title + subtitle, no archetype choreography, nothing that can
 * throw. Used only when the real composition rendered blank.
 */
function buildSafeSceneHtml({
  scene,
  durationSec,
  compWidth,
  compHeight,
  isPortrait,
  activePalette,
}) {
  const esc = (v) =>
    String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  const isSquare = compWidth === compHeight;
  const subtitle = esc(String(scene.subtitle || scene.voiceover || "").slice(0, 160));
  const pad = isPortrait ? "130px 48px 120px" : isSquare ? "80px 60px" : "96px";
  const titleSize = isPortrait ? 64 : isSquare ? 54 : 84;
  const subSize = isPortrait ? 28 : isSquare ? 22 : 32;
  const maxW = isSquare ? 920 : 1400;
  return `<template id="${scene.id}-template">
  <div data-composition-id="${scene.id}" data-width="${compWidth}" data-height="${compHeight}" data-duration="${durationSec.toFixed(6)}" style="position:absolute;inset:0;width:${compWidth}px;height:${compHeight}px;background:${activePalette.background};color:${activePalette.text};display:flex;flex-direction:column;justify-content:center;align-items:center;padding:${pad};text-align:center;font-family:'Inter',sans-serif;">
    <h1 style="font-family:'Playfair Display',serif;font-size:${titleSize}px;font-weight:700;line-height:1.1;max-width:${maxW}px;">${esc(scene.title)}</h1>
    <p style="margin-top:24px;font-size:${subSize}px;line-height:1.5;max-width:${maxW - 60}px;color:${activePalette.textMuted || activePalette.text};">${subtitle}</p>
    <script>
      (function () {
        const tl = gsap.timeline({ paused: true });
        window.__timelines = window.__timelines || {};
        window.__timelines["${scene.id}"] = tl;
      })();
    </script>
  </div>
</template>`;
}

/** Render one scene project to an MP4 via the CLI, streaming frame progress to `onProgress`. */
function renderHtmlSegment({ hfBin, projectPath, outputPath, env, onProgress }) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      hfBin,
      [
        "render",
        projectPath,
        "--experimental-fast-capture",
        "--fps",
        String(FPS),
        "--quiet",
        "-o",
        outputPath,
      ],
      { env, stdio: ["ignore", "pipe", "pipe"] },
    );
    let errTail = "";
    child.stdout.on("data", (data) => {
      const match = data.toString().match(/(\d+)%\s+(?:Streaming|Capturing)\s+frame\s+(\d+\/\d+)/i);
      if (match) onProgress?.(match[1], match[2]);
    });
    // Drain stderr so the child can never block on a full pipe buffer.
    child.stderr.on("data", (data) => {
      errTail = (errTail + data.toString()).slice(-1500);
    });
    child.on("error", (err) => reject(new Error(`Render failed to start: ${err.message}`)));
    child.on("close", (code) => {
      if (code === 0 && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) resolve();
      else {
        const detail = errTail.trim().split("\n").slice(-3).join(" ");
        reject(new Error(`Render failed (exit ${code})${detail ? `: ${detail}` : ""}`));
      }
    });
  });
}

async function runProductionPipeline(jobId, payload) {
  const {
    apiKey,
    model = "anthropic/claude-haiku-5.5",
    voice = "bm_george",
    sourceUrl = "",
    sourceScript = "",
    sourceTopic = "",
    topicStyle = "explainer",
    sourcePdf = null,
    sourcePdfName = null,
    duration = 30,
    format = "landscape",
    paletteKey = "braun-industrial",
    customColors = null,
    // Must be a SOUNDTRACK_MAP key (or "none")
    musicEngine = "quiet-reflection",
    engineMode = "combined",
  } = payload;

  const effectiveKey =
    apiKey || (process.env.NODE_ENV !== "test" ? process.env.OPENROUTER_API_KEY : undefined);
  const projectDir = path.join(PROJECTS_DIR, `prod-${jobId}`);
  const assetsDir = path.join(projectDir, "assets");
  const compDir = path.join(projectDir, "compositions");
  const sfxDir = path.join(assetsDir, "sfx");

  let completed = false;
  const isSquare = format === "square";
  const isPortrait = format === "portrait";
  const compWidth = isSquare ? 1080 : isPortrait ? 1080 : 1920;
  const compHeight = isSquare ? 1080 : isPortrait ? 1920 : 1080;

  try {
    // Only accept CSS hex colours in custom palettes: arbitrary CSS here would
    // otherwise be interpolated into generated composition styles.
    if (
      customColors !== null &&
      (typeof customColors !== "object" ||
        Array.isArray(customColors) ||
        Object.values(customColors).some(
          (color) => typeof color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(color),
        ))
    ) {
      throw new Error("Custom palette colours must be six-digit hex values");
    }
    const activePalette = customColors?.background
      ? {
          ...(PALETTES[paletteKey] || PALETTES["braun-industrial"] || PALETTES["warm-ivory"]),
          ...customColors,
        }
      : PALETTES[paletteKey] || PALETTES["braun-industrial"] || PALETTES["warm-ivory"];
    fs.mkdirSync(compDir, { recursive: true });
    fs.mkdirSync(sfxDir, { recursive: true });
    // 01: Ingest
    broadcastEvent(jobId, {
      node: "ingest",
      status: "active",
      message: sourceTopic
        ? `Researching topic: "${sourceTopic.trim()}"`
        : "Extracting brand profile, palette, and key messaging",
    });

    let resolvedScript = sourceScript;

    // Ingest: Configure source
    if (sourceTopic?.trim() && (!resolvedScript || resolvedScript.length < 50)) {
      resolvedScript = `Topic: ${sourceTopic.trim()}\nTopic Style: ${topicStyle || "explainer"}`;
    }

    // A PDF failure is fatal in PDF-only mode. Never render a generic video
    // after silently discarding the document the user supplied.
    if (sourcePdf !== null && sourcePdf !== undefined) {
      broadcastEvent(jobId, {
        node: "ingest",
        status: "active",
        message: `Parsing PDF: ${sourcePdfName || "document.pdf"}`,
      });
      try {
        const pdfText = await parsePdfContent(sourcePdf);
        resolvedScript = `Source Document: ${sourcePdfName || "PDF"}\n\n${pdfText}`;
        broadcastEvent(jobId, {
          node: "ingest",
          status: "active",
          message: `PDF parsed — ${pdfText.split(" ").length} words extracted`,
        });
      } catch (pdfErr) {
        if (!sourceScript?.trim() && !sourceUrl?.trim() && !sourceTopic?.trim()) {
          throw new Error(`Could not read the PDF: ${pdfErr.message}`);
        }
        broadcastEvent(jobId, {
          node: "ingest",
          status: "active",
          message: `PDF could not be read (${pdfErr.message}); using the provided brief or URL`,
        });
      }
    }

    await new Promise((r) => setTimeout(r, 400));
    let capturedScreenshotRel = null;
    if (sourceUrl && typeof sourceUrl === "string" && sourceUrl.trim()) {
      const captureDir = path.join(assetsDir, "capture");
      fs.mkdirSync(captureDir, { recursive: true });
      const screenshotAbs = path.join(captureDir, "screenshot.png");
      broadcastEvent(jobId, {
        node: "ingest",
        status: "active",
        message: `Capturing desktop viewport screenshot of ${sourceUrl.trim()}...`,
      });
      const captured = await captureUrlScreenshot(sourceUrl.trim(), screenshotAbs);
      if (captured && fs.existsSync(screenshotAbs)) {
        const base64Data = fs.readFileSync(screenshotAbs).toString("base64");
        capturedScreenshotRel = `data:image/png;base64,${base64Data}`;
      }
    }

    broadcastEvent(jobId, {
      node: "ingest",
      status: "complete",
      message: `Source configured (${isSquare ? "1:1 Square" : isPortrait ? "9:16 Portrait" : "16:9 Landscape"}, ${duration}s · Engine: ${engineMode.toUpperCase()}${sourcePdf ? " · PDF" : ""}${sourceTopic ? " · Topic" : ""})`,
    });

    // 02: Director
    broadcastEvent(jobId, {
      node: "narrative",
      status: "active",
      message: `Directing scene choreography using ${model}`,
    });
    const timingStructure = getSceneTimingStructure(duration, undefined, { engineMode });
    // Probed once per process; when false, Manim is never offered to the director and any
    // Manim scene that slips through is degraded to its HTML fallback by validateStoryboard.
    const manimCapability = await checkManimCapability();
    if (engineMode === "manim" && !manimCapability.ok) {
      throw new Error(
        `Only Manim mode selected, but Manim is unavailable: ${manimCapability.reasons.join("; ") || "check Python installation"}`,
      );
    }
    const isManimEnabled = engineMode === "html" ? false : manimCapability.ok;
    const rawStoryboard = await directStoryboard({
      apiKey,
      model,
      sourceUrl,
      sourceScript: resolvedScript,
      sourceTopic,
      topicStyle,
      duration,
      format,
      timingStructure,
      manimEnabled: isManimEnabled,
      engineMode,
    });
    // Dual archetype audit: RAW (director output) vs NORMALIZED (post quality.mjs).
    // The delta between these two lines reveals whether validateStoryboard /
    // chooseArchetype is quietly swapping the LLM's picks.
    console.log("--- STORYBOARD ARCHETYPE AUDIT (RAW DIRECTOR) ---");
    console.log(
      "Chosen Archetypes:",
      (Array.isArray(rawStoryboard?.scenes) ? rawStoryboard.scenes : []).map(
        (s, idx) => `[Scene ${idx + 1}] ${s?.archetype} (${s?.title || s?.id})`,
      ),
    );
    // What the director itself asked for, before any validation decides otherwise.
    console.log(
      "[DIRECTOR ENGINE ASSIGNMENT]",
      (Array.isArray(rawStoryboard?.scenes) ? rawStoryboard.scenes : []).map(
        (s, idx) =>
          `[Scene ${idx + 1}] engine=${s?.engine || "(unset)"} archetype=${s?.archetype || "(unset)"}`,
      ),
    );
    const storyboard = validateStoryboard(rawStoryboard, timingStructure, {
      manimEnabled: isManimEnabled,
      engineMode,
      topic: sourceTopic || sourceScript || sourcePdfName,
    });
    for (const [idx, s] of storyboard.scenes.entries()) {
      if (s.degraded) {
        console.warn(
          `[DEGRADE REASON: Scene ${idx + 1}: ${s.degradeReason || "unspecified"}] ${s.degradedFrom} -> ${s.archetype}`,
        );
      }
    }
    if (!manimCapability.ok) {
      console.warn(
        `[DEGRADE REASON: Manim unavailable: ${manimCapability.reasons.join("; ") || "unknown"}]`,
      );
    }
    console.log("--- STORYBOARD ARCHETYPE AUDIT (POST-VALIDATION) ---");
    console.log(
      "Chosen Archetypes:",
      storyboard.scenes.map(
        (s, idx) =>
          `[Scene ${idx + 1}] ${s.archetype} [${s.engine}${s.degraded ? ", degraded" : ""}] (${s.title || s.id})`,
      ),
    );
    console.log("---------------------------------------------------");

    // Persist canonical YAML storyboard and manifests (matching Hyperframes structure)
    try {
      fs.writeFileSync(
        path.join(projectDir, "storyboard.json"),
        JSON.stringify(storyboard, null, 2),
        "utf8",
      );
      fs.writeFileSync(
        path.join(projectDir, "storyboard.yaml"),
        formatStoryboardYaml(storyboard),
        "utf8",
      );
      fs.writeFileSync(
        path.join(projectDir, "STORYBOARD.md"),
        formatStoryboardMarkdown(storyboard),
        "utf8",
      );
    } catch (saveErr) {
      console.warn(`[MANIFEST] Failed to persist storyboard manifests: ${saveErr.message}`);
    }

    broadcastEvent(jobId, {
      node: "narrative",
      status: "complete",
      message: `Scene choreography complete: ${storyboard.scenes.length} scenes for ${storyboard.productName}`,
    });

    // 03: Speech & Audio
    broadcastEvent(jobId, {
      node: "audio",
      status: "active",
      message: `Synthesizing narration via Kokoro (${voice})`,
    });

    // Copy sound effects from the studio's own bundled library.
    const sfxSourceDir = path.join(PUBLIC_DIR, "sfx");
    if (fs.existsSync(sfxSourceDir)) {
      for (const file of fs.readdirSync(sfxSourceDir)) {
        if (!file.endsWith(".mp3")) continue;
        fs.copyFileSync(path.join(sfxSourceDir, file), path.join(sfxDir, file));
      }
    } else {
      console.warn(
        `[SFX] Source directory missing, scenes will have no sound effects: ${sfxSourceDir}`,
      );
    }

    const hfBin =
      (fs.existsSync(LOCAL_CLI) &&
      fs.existsSync(path.join(ROOT_DIR, "packages", "cli", "dist", "cli.js"))
        ? LOCAL_CLI
        : null) ||
      resolveBin("chalkframes") ||
      requireBin("chalkframes", "run `bun run setup`");
    const procEnv = childEnv();

    const voDurations = new Array(storyboard.scenes.length).fill(4.0);
    const concurrency = 2;
    let completedAudioCount = 0;
    const ttsFailures = [];

    const synthTasks = storyboard.scenes.map((scene, i) => async () => {
      const voPath = path.join(assetsDir, `vo-scene${i + 1}.wav`);
      const voText = String(scene.voiceover || scene.title || "").trim();

      broadcastEvent(jobId, {
        node: "audio",
        status: "active",
        message: `Synthesizing audio ${completedAudioCount + 1}/${storyboard.scenes.length}: "${scene.title}"`,
      });
      let voDuration = 4.0;
      try {
        await execFileAsync(hfBin, ["tts", voText, "-v", String(voice), "-o", voPath], {
          env: procEnv,
          maxBuffer: 16 * 1024 * 1024,
        });
        voDuration = getWavDurationFast(voPath) || 4.0;
      } catch (probeErr) {
        // A silent scene is a failed voiceover, not a success. Record it and tell the job,
        // so the user sees the cause instead of a video with missing narration.
        const cause = String(probeErr.stderr || probeErr.message || "unknown error")
          .split("\n")
          .filter((l) => l.trim())
          .slice(-1)[0]
          .slice(0, 240);
        ttsFailures.push({ scene: i + 1, cause });
        console.warn(`[TTS] scene ${i + 1} voiceover failed: ${cause}`);
        broadcastEvent(jobId, {
          node: "audio",
          status: "active",
          message: `Voiceover failed for scene ${i + 1}: ${cause}`,
        });
        const words = voText.split(/\s+/).filter(Boolean).length;
        voDuration = Math.max(4.0, parseFloat((words / 2.2).toFixed(1)));
      }
      voDurations[i] = voDuration;
      completedAudioCount++;
    });

    const activePool = [];
    for (const task of synthTasks) {
      const p = task().then(() => {
        activePool.splice(activePool.indexOf(p), 1);
      });
      activePool.push(p);
      if (activePool.length >= concurrency) {
        await Promise.race(activePool);
      }
    }
    await Promise.all(activePool);

    // Integer-frame scene timing: every scene is a whole number of 30fps frames, so
    // per-scene video segments and the padded master audio line up with zero drift.
    // Ensure the scene-to-scene pause between spoken narrations is naturally paced between 1.0s and 2.0s maximum.
    const minSceneGap = 1.2; // At least 1.2s gap between voiceovers (>= 1.0s)
    const maxSceneGap = 1.8; // At most 1.8s gap between voiceovers (<= 2.0s maximum)
    const sceneFrames = storyboard.scenes.map((scene, i) => {
      const sceneTargetSec = timingStructure[i]?.duration || voDurations[i] + minSceneGap;
      const clampedTarget = Math.max(
        voDurations[i] + minSceneGap,
        Math.min(sceneTargetSec, voDurations[i] + maxSceneGap),
      );
      const frames = computeSceneFrames({
        voDuration: voDurations[i],
        targetSec: clampedTarget,
        padding: minSceneGap,
        fps: FPS,
      });
      scene.totalFrames = frames;
      scene.duration = frames / FPS;
      return frames;
    });
    const frameTimeline = buildFrameTimeline(sceneFrames, FPS);
    const sceneStartTimes = frameTimeline.starts;
    const sceneDurations = sceneFrames.map((frames) => frames / FPS);
    const totalCalculatedDuration = frameTimeline.totalSeconds;

    // Manim stage: render each Manim scene to a normalized clip. Any failure swaps the
    // scene to its prebuilt HTML twin, so a Manim problem can never fail the job.
    const segDir = path.join(projectDir, "seg");
    fs.mkdirSync(segDir, { recursive: true });
    const segmentPaths = new Array(storyboard.scenes.length).fill(null);
    const segName = (i) => String(i + 1).padStart(2, "0");
    const manimIndexes = storyboard.scenes.flatMap((s, i) => (s.engine === "manim" ? [i] : []));
    for (const [n, i] of manimIndexes.entries()) {
      const scene = storyboard.scenes[i];
      broadcastEvent(jobId, {
        node: "audio",
        status: "active",
        message: `Rendering Manim animation ${n + 1}/${manimIndexes.length}: "${scene.title}"`,
      });
      const sceneWork = path.join(segDir, `manim_${segName(i)}`);
      const rawPath = path.join(sceneWork, "raw.mp4");
      const outPath = path.join(segDir, `scene_${segName(i)}.mp4`);

      // Synthesize bespoke 3Blue1Brown Python code for Manim Skill
      // Only the explicit manim-skill archetype synthesizes Python. Structured Manim scenes
      // keep their director-provided data and use their primitive.
      if (scene.archetype === "manim-skill" && !scene.manimData?.code) {
        broadcastEvent(jobId, {
          node: "audio",
          status: "active",
          message: `Synthesizing bespoke Manim Skill animation ${n + 1}/${manimIndexes.length}: "${scene.title}"`,
        });
        const synthesizedCode = await generateManimSkillCode({
          scene,
          topic: sourceTopic || sourceScript || sourcePdfName || scene.title,
          theme: scene.theme || "dark",
          beatCount: (scene.beats && scene.beats.length) || 3,
          apiKey: effectiveKey,
          model,
          sceneIndex: i,
          totalScenes: storyboard.scenes.length,
        });
        scene.archetype = "manim-skill";
        scene.manimData = {
          ...(scene.manimData || {}),
          title: scene.title,
          code: synthesizedCode,
        };
      }

      try {
        const plan = {
          primitive: scene.archetype,
          brief: scene.manimData,
          // Manim rejects CSS rgba()/8-digit hex: flatten to solid #rrggbb before serializing.
          palette: sanitizePalette(resolveScenePalette(scene, activePalette)),
          fonts: manimCapability.fonts,
          totalFrames: scene.totalFrames,
          beatFrames: beatFrames(scene.beats, scene.totalFrames),
          width: compWidth,
          height: compHeight,
          fps: FPS,
          outputPath: rawPath,
          mediaDir: path.join(sceneWork, "media"),
        };
        await runManimScene({
          plan,
          workDir: sceneWork,
          python: manimCapability.python,
          timeoutMs: Number(process.env.MANIM_TIMEOUT_MS) || undefined,
        });
        await normalizeManimClip({
          inputPath: rawPath,
          outputPath: outPath,
          totalFrames: scene.totalFrames,
          width: compWidth,
          height: compHeight,
          label: `Scene ${i + 1} (${scene.archetype})`,
        });
        segmentPaths[i] = outPath;
        fs.rmSync(sceneWork, { recursive: true, force: true });
      } catch (manimErr) {
        console.warn(
          `[DEGRADE REASON: Scene ${i + 1}: ${manimErr.kind || "error"}: ${manimErr.message}]`,
        );
        if (engineMode === "manim" || scene.archetype === "manim-skill") {
          // Self-Healing Debug Loop: intercept traceback, repair code and retry
          fs.rmSync(sceneWork, { recursive: true, force: true });
          fs.mkdirSync(sceneWork, { recursive: true });
          try {
            // Bounded repair: every candidate is screened and must render before it is accepted.
            const repairBeats = beatFrames(
              scene.beats || [scene.voiceover || scene.title || "Mathematical analysis."],
              scene.totalFrames,
            );
            const repaired = await repairAndRender({
              code: scene.manimData?.code || "",
              initialError: manimErr.message,
              apiKey: effectiveKey,
              model,
              render: async (candidate) => {
                fs.rmSync(sceneWork, { recursive: true, force: true });
                fs.mkdirSync(sceneWork, { recursive: true });
                await runManimScene({
                  plan: {
                    primitive: "manim-skill",
                    brief: {
                      title: scene.title || "Mathematical Animation",
                      concept: scene.manimData?.concept || "Dynamic Transformation",
                      code: candidate,
                    },
                    palette: sanitizePalette(resolveScenePalette(scene, activePalette)),
                    fonts: manimCapability.fonts,
                    totalFrames: scene.totalFrames,
                    beatFrames: repairBeats,
                    width: compWidth,
                    height: compHeight,
                    fps: FPS,
                    outputPath: rawPath,
                    mediaDir: path.join(sceneWork, "media"),
                  },
                  workDir: sceneWork,
                  python: manimCapability.python,
                  timeoutMs: Number(process.env.MANIM_TIMEOUT_MS) || undefined,
                });
              },
            });
            if (!repaired.ok) {
              throw Object.assign(
                new Error(`repair exhausted: ${JSON.stringify(repaired.attempts)}`),
                {
                  kind: "repair",
                },
              );
            }
            await normalizeManimClip({
              inputPath: rawPath,
              outputPath: outPath,
              totalFrames: scene.totalFrames,
              width: compWidth,
              height: compHeight,
              label: `Scene ${i + 1} (Manim Skill)`,
            });
            segmentPaths[i] = outPath;
            scene.manimData = { ...(scene.manimData || {}), code: repaired.code };
            fs.rmSync(sceneWork, { recursive: true, force: true });
            continue;
          } catch (repairErr) {
            console.warn(`[REPAIR] Scene ${i + 1}: ${repairErr.message}`);
            // If self-healing custom code still fails, proceed to safe geometric fallback
          }

          // No unrelated template is substituted here. A scene whose repairs are exhausted
          // degrades to its own HTML twin below, and that reason is recorded on the scene.
        }
        storyboard.scenes[i] = degradeScene(scene, manimErr.message);
        fs.rmSync(sceneWork, { recursive: true, force: true });
        // Degradation is a visible, recorded event: the reason is kept on the scene and
        // streamed to the job so the user can see which scenes lost their Manim visuals.
        storyboard.scenes[i].degradeDetail = String(manimErr.message).slice(0, 500);
        broadcastEvent(jobId, {
          node: "audio",
          status: "active",
          message: `Scene ${i + 1} degraded to ${storyboard.scenes[i].archetype}: ${manimErr.message.slice(0, 160)}`,
        });
      }
    }
    console.log(
      "--- ENGINE ROUTING ---",
      storyboard.scenes.map(
        (s, i) => `[${i + 1}] ${s.archetype}:${s.engine}${s.degraded ? "(degraded)" : ""}`,
      ),
    );

    // Generate Soundtrack
    broadcastEvent(jobId, {
      node: "audio",
      status: "active",
      message: `Mastering soundtrack (${musicEngine})`,
    });
    const bgmPath = path.join(assetsDir, "bgm.wav");
    const usedTrackName = await generateSoundtrack({
      musicEngine,
      duration: Math.ceil(totalCalculatedDuration),
      targetPath: bgmPath,
    });
    const soundtrackMsg = usedTrackName === "none" ? "Voiceover only" : usedTrackName;
    broadcastEvent(jobId, {
      node: "audio",
      status: "complete",
      message: `Soundtrack ready: ${soundtrackMsg}`,
    });

    // 04: Composition
    broadcastEvent(jobId, {
      node: "composition",
      status: "active",
      message: `Authoring ${isSquare ? "square" : isPortrait ? "portrait" : "landscape"} motion layouts`,
    });

    // Generate Scene HTML files (Archetype-Driven). Manim scenes already have a clip.
    for (let i = 0; i < storyboard.scenes.length; i++) {
      const scene = storyboard.scenes[i];
      if (capturedScreenshotRel && !scene.screenshotPath) {
        scene.screenshotPath = capturedScreenshotRel;
      }
      if (scene.engine === "manim") continue;
      const sDur = sceneDurations[i];

      const { innerHtml, gsapChoreography } = buildSceneHtmlAndChoreography(
        scene,
        i,
        storyboard.scenes.length,
        sDur,
        compWidth,
        compHeight,
        isPortrait,
        activePalette,
      );
      const scopedCss = getArchetypeScopedCss(
        scene,
        compWidth,
        compHeight,
        isPortrait,
        activePalette,
      );

      const sceneFileContent = `<template id="${scene.id}-template">
  <div data-composition-id="${scene.id}" data-theme="${scene.theme || "light"}" class="theme-${scene.theme || "light"}" data-width="${compWidth}" data-height="${compHeight}" data-duration="${sDur}">
    ${innerHtml}
    <style>
      ${scopedCss}
    </style>
    <script>
      (function () {
        const tl = gsap.timeline({ paused: true });
        const scope = document.querySelector('[data-composition-id="${scene.id}"]');
        if (!scope) return;
        // Server-side scene length, exposed to archetype choreography (a bare sDur used
        // to be a ReferenceError that aborted the script before the timeline registered).
        const sDur = ${sDur};
        ${i > 0 ? (isPortrait ? `tl.from(scope, { y: 120, opacity: 0, scale: 0.97, filter: "blur(6px)", duration: 0.55, ease: "power3.out" }, 0);` : `tl.from(scope, { opacity: 0, scale: 0.96, filter: "blur(6px)", duration: 0.55, ease: "power3.out" }, 0);`) : `tl.from(scope, { opacity: 0, scale: 0.98, filter: "blur(4px)", duration: 0.45, ease: "power2.out" }, 0);`}
        // Continuous cinematic camera drift across the entire scene narration
        const innerStage = scope.querySelector(".scene-inner, .split-hero-layout, .fullbleed-layout");
        if (innerStage) {
          tl.to(innerStage, { scale: 1.025, ease: "none", duration: sDur }, 0);
        }
        // Continuous headline cursor blink
        const cursorEl = scope.querySelector(".cursor-blink");
        if (cursorEl) {
          const blinkRepeats = Math.max(1, Math.floor(sDur / 0.8));
          tl.to(cursorEl, { opacity: 0, duration: 0.4, repeat: blinkRepeats * 2, yoyo: true, ease: "steps(1)" }, 0.2);
        }
        // Continuous eyebrow accent dot pulse
        const eyeDot = scope.querySelector(".eyebrow-dot");
        if (eyeDot) {
          const pulseRepeats = Math.max(1, Math.floor(sDur / 1.6));
          tl.to(eyeDot, { scale: 1.35, opacity: 0.7, duration: 0.8, repeat: pulseRepeats * 2, yoyo: true, ease: "sine.inOut" }, 0.3);
        }
        // Archetype choreography is isolated: if one tween throws (null selector, bad
        // value) the entrance/exit timeline below still registers and the scene stays visible.
        try {
        ${gsapChoreography}
        } catch (choreographyError) {
          console.warn("[Chalk Frames] choreography error in ${scene.id}:", choreographyError);
        }
        ${i < storyboard.scenes.length - 1 ? (isPortrait ? `tl.to(scope, { y: -80, opacity: 0, scale: 0.98, filter: "blur(4px)", duration: 0.45, ease: "power3.in" }, ${sDur - 0.45});` : `tl.to(scope, { opacity: 0, scale: 1.03, filter: "blur(6px)", duration: 0.45, ease: "power3.inOut" }, ${sDur - 0.45});`) : ``}
        window.__timelines = window.__timelines || {};
        window.__timelines["${scene.id}"] = tl;
      })();
    </script>
  </div>
</template>`;

      fs.writeFileSync(path.join(compDir, `${scene.id}.html`), sceneFileContent);
    }

    // Master index.html
    const audioTagsHtml = storyboard.scenes
      .map(
        (s, idx) =>
          `<audio id="vo-s${idx + 1}" class="clip" src="assets/vo-scene${idx + 1}.wav" data-start="${(sceneStartTimes[idx] + 0.3).toFixed(2)}" data-duration="${voDurations[idx].toFixed(2)}" data-track-index="1" data-volume="1"></audio>`,
      )
      .join("\n      ");

    // The master index is the editable project view; Manim scenes are pre-rendered clips
    // and have no composition file, so they are not mounted here.
    const sceneDivsHtml = storyboard.scenes
      .filter((s) => s.engine !== "manim")
      .map((s) => {
        const idx = storyboard.scenes.indexOf(s);
        return `<div id="${s.id}" class="scene clip" data-composition-id="${s.id}" data-composition-src="compositions/${s.id}.html" data-start="${sceneStartTimes[idx].toFixed(2)}" data-duration="${sceneDurations[idx].toFixed(2)}" data-track-index="${idx % 2 === 0 ? 4 : 5}" data-width="${compWidth}" data-height="${compHeight}"></div>`;
      })
      .join("\n      ");

    // Contextual multi-track SFX cues matching scene archetypes and visual peaks
    const contextualSfx = buildContextualSfxCues({
      storyboard,
      sceneStartTimes,
      sceneDurations,
      sfxDir,
    });
    const activeSfxCues = contextualSfx.filter((c) => {
      const p = path.join(sfxDir, c.name);
      return fs.existsSync(p);
    });

    const sfxAudioHtml = activeSfxCues
      .map(
        (c) =>
          `<audio id="${c.id}" class="clip" src="${c.webSrc}" data-start="${c.start.toFixed(2)}" data-duration="${c.duration.toFixed(2)}" data-track-index="${c.trackIndex}" data-volume="${c.volume.toFixed(2)}"></audio>`,
      )
      .join("\n      ");

    const masterHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${compWidth}, height=${compHeight}" />
    <title>${storyboard.productName} — Explainer</title>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=block" rel="stylesheet" />
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { margin: 0; width: ${compWidth}px; height: ${compHeight}px; overflow: hidden; background-color: ${activePalette.background}; color: ${activePalette.text}; font-family: "Plus Jakarta Sans", "Inter", sans-serif; }
      #root { position: relative; width: ${compWidth}px; height: ${compHeight}px; background: ${activePalette.background}; overflow: hidden; }
      .scene { position: absolute; inset: 0; width: ${compWidth}px; height: ${compHeight}px; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${totalCalculatedDuration.toFixed(2)}" data-width="${compWidth}" data-height="${compHeight}">
      ${musicEngine !== "none" ? `<audio id="bgm" class="clip" src="assets/bgm.wav" data-start="0" data-duration="${totalCalculatedDuration.toFixed(2)}" data-track-index="0" data-volume="0.30"></audio>` : ""}
      ${audioTagsHtml}
      ${sfxAudioHtml}

      ${sceneDivsHtml}
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      const mainTl = gsap.timeline({ paused: true });
      window.__timelines["main"] = mainTl;
    </script>
  </body>
</html>`;

    fs.writeFileSync(path.join(projectDir, "index.html"), masterHtml);
    broadcastEvent(jobId, {
      node: "composition",
      status: "complete",
      message: `Layout master assembled (${compWidth}x${compHeight}, ${totalCalculatedDuration.toFixed(1)}s)`,
      storyboard: {
        productName: storyboard.productName,
        scenes: storyboard.scenes.map((s, idx) => ({
          id: s.id,
          index: idx,
          archetype: s.archetype,
          title: s.title,
          narration: s.voiceover || s.narration || "",
          duration: sceneDurations[idx],
          startTime: sceneStartTimes[idx],
          engine: s.engine || "html",
        })),
      },
    });

    // 05: Validation Gate
    broadcastEvent(jobId, {
      node: "validation",
      status: "active",
      message: "Verifying composition contract & WCAG contrast",
    });
    // Static quality validation in validateStoryboard guarantees contrast, IDs, safe markup, and timeline sync.
    broadcastEvent(jobId, {
      node: "validation",
      status: "complete",
      message: "Contrast and layout verified clean",
    });

    // 06: Master Render
    const outputMp4Name = `${jobId}.mp4`;
    const outputMp4Path = path.join(RENDERS_DIR, outputMp4Name);
    broadcastEvent(jobId, {
      node: "render",
      status: "active",
      message: `Rendering ${isPortrait ? "portrait" : "landscape"} frames via hardware GPU accelerated capture`,
    });

    // Chunked render: one bounded Chrome session per HTML scene (memory stays flat for
    // 10-minute videos), Manim scenes already have clips, then a lossless stitch.
    // Scenes render sequentially so Chrome and Manim never fight for CPU.
    const htmlIndexes = storyboard.scenes.flatMap((s, i) => (s.engine === "manim" ? [] : [i]));
    for (const [n, i] of htmlIndexes.entries()) {
      const scene = storyboard.scenes[i];
      const sceneProject = path.join(segDir, `html_${segName(i)}`);
      const rawPath = path.join(sceneProject, "raw.mp4");
      const outPath = path.join(segDir, `scene_${segName(i)}.mp4`);
      fs.mkdirSync(path.join(sceneProject, "compositions"), { recursive: true });
      fs.copyFileSync(
        path.join(compDir, `${scene.id}.html`),
        path.join(sceneProject, "compositions", `${scene.id}.html`),
      );
      fs.writeFileSync(
        path.join(sceneProject, "index.html"),
        buildSegmentHtml({
          scene,
          durationSec: sceneDurations[i],
          compWidth,
          compHeight,
          activePalette,
        }),
      );
      const renderAndNormalize = async () => {
        await renderHtmlSegment({
          hfBin,
          projectPath: sceneProject,
          outputPath: rawPath,
          env: procEnv,
          onProgress: (pct, frame) =>
            broadcastEvent(jobId, {
              node: "render",
              status: "active",
              message: `Scene ${n + 1}/${htmlIndexes.length} · frame ${frame} (${pct}%)`,
            }),
        });
        await normalizeSegment({
          inputPath: rawPath,
          outputPath: outPath,
          totalFrames: scene.totalFrames,
          width: compWidth,
          height: compHeight,
        });
        await assertNotBlank(outPath, `Scene ${i + 1} (${scene.archetype})`);
      };
      try {
        await renderAndNormalize();
      } catch (renderErr) {
        if (renderErr.kind !== "blank") throw renderErr;
        // Blank footage must never reach the stitch: retry once with a minimal static
        // composition. If that is blank too, the error below fails the job loudly.
        console.warn(`[Scene ${i + 1}] blank render; retrying with safe template`);
        fs.writeFileSync(
          path.join(sceneProject, "compositions", `${scene.id}.html`),
          buildSafeSceneHtml({
            scene,
            durationSec: sceneDurations[i],
            compWidth,
            compHeight,
            isPortrait,
            activePalette,
          }),
        );
        await renderAndNormalize();
      }
      segmentPaths[i] = outPath;
      fs.rmSync(sceneProject, { recursive: true, force: true });
    }

    broadcastEvent(jobId, {
      node: "render",
      status: "active",
      message: "Stitching scenes and mastering audio",
    });
    const stitchedVideoPath = path.join(segDir, "video.mp4");
    const masterAudioPath = path.join(segDir, "master-vo.wav");
    await concatenateSegments({ segmentPaths, outputVideoPath: stitchedVideoPath });
    await assembleMasterAudio({
      sceneWavPaths: storyboard.scenes.map((_, i) => path.join(assetsDir, `vo-scene${i + 1}.wav`)),
      expectedDurations: sceneDurations,
      outputWavPath: masterAudioPath,
      leadIn: 0.15,
    });
    const sfxCues = activeSfxCues.map((c) => ({
      path: path.join(sfxDir, c.name),
      start: c.start,
      volume: c.volume,
    }));
    await muxMasterVideo({
      videoPath: stitchedVideoPath,
      audioPath: masterAudioPath,
      bgmPath: musicEngine !== "none" ? bgmPath : null,
      bgmVolume: 0.3,
      sfx: sfxCues,
      outputPath: outputMp4Path,
    });

    if (fs.existsSync(outputMp4Path) && fs.statSync(outputMp4Path).size > 0) {
      completed = true;
      try {
        const segEntries = fs.readdirSync(segDir, { withFileTypes: true });
        for (const entry of segEntries) {
          if (entry.isDirectory() && entry.name.startsWith("html_")) {
            fs.rmSync(path.join(segDir, entry.name), { recursive: true, force: true });
          }
        }
      } catch {}
      broadcastEvent(jobId, {
        node: "complete",
        status: "complete",
        message: "Production complete",
        videoUrl: `/renders/${outputMp4Name}`,
        duration: `${totalCalculatedDuration.toFixed(1)}s`,
        resolution: `${compWidth}x${compHeight}`,
        projectId: `prod-${jobId}`,
        storyboard: {
          productName: storyboard.productName,
          scenes: storyboard.scenes.map((s, idx) => ({
            id: s.id,
            index: idx,
            archetype: s.archetype,
            title: s.title,
            narration: s.voiceover || s.narration || "",
            duration: sceneDurations[idx],
            startTime: sceneStartTimes[idx],
            engine: s.engine || "html",
          })),
        },
      });
    } else {
      throw new Error("Render failed: final video was not produced");
    }
  } catch (err) {
    console.error("Pipeline failure:", err);
    // Broadcast the real error message so the UI shows the actual cause
    // (e.g. "Director returned invalid storyboard" vs generic failure)
    const userMessage = err.message
      ? err.message.slice(0, 300)
      : "Pipeline execution failed — check the server logs";
    // Identify which stage failed by inspecting the error source
    const failedNode =
      err.message?.includes("Director") || err.message?.includes("storyboard")
        ? "narrative"
        : err.message?.includes("OpenRouter") || err.message?.includes("API")
          ? "narrative"
          : err.message?.includes("Synthesizing") || err.message?.includes("tts")
            ? "audio"
            : err.message?.includes("Contrast") || err.message?.includes("check")
              ? "validation"
              : "render";
    broadcastEvent(jobId, {
      node: failedNode,
      status: "error",
      message: userMessage,
    });
  } finally {
    if (!completed) {
      // Never remove successful projects: their source composition is useful
      // for later edits. Only clean failed jobs, including partial renders.
      fs.rmSync(projectDir, { recursive: true, force: true });
      fs.rmSync(path.join(RENDERS_DIR, `${jobId}.mp4`), { force: true });
    }
  }
}

/**
 * Re-render a single scene in an existing project (instant re-render).
 * Updates storyboard.json, compositions/${scene.id}.html, re-synthesizes voiceover if modified,
 * re-renders single scene video segment and re-stitches master MP4 in seconds.
 */
export async function rerenderSingleScene({
  projectId,
  sceneIndex,
  newNarration,
  newArchetype,
  newTitle,
}) {
  const safeProjId = String(projectId || "").replace(/[^a-zA-Z0-9_-]/g, "");
  const projDirName = safeProjId.startsWith("prod-") ? safeProjId : `prod-${safeProjId}`;
  const projectDir = path.join(PROJECTS_DIR, projDirName);
  if (!fs.existsSync(projectDir)) {
    throw new Error(`Project directory not found: ${projDirName}`);
  }

  const storyboardPath = path.join(projectDir, "storyboard.json");
  if (!fs.existsSync(storyboardPath)) {
    throw new Error("Project storyboard.json not found");
  }

  const storyboard = JSON.parse(fs.readFileSync(storyboardPath, "utf8"));
  const idx = Number(sceneIndex);
  if (!Number.isInteger(idx) || idx < 0 || idx >= (storyboard.scenes?.length || 0)) {
    throw new Error(
      `Invalid sceneIndex: ${sceneIndex} (project has ${storyboard.scenes?.length || 0} scenes)`,
    );
  }

  const scene = storyboard.scenes[idx];
  const assetsDir = path.join(projectDir, "assets");
  const compDir = path.join(projectDir, "compositions");
  const segDir = path.join(projectDir, "segments");
  const sfxDir = path.join(assetsDir, "sfx");
  const segName = (i) => String(i + 1).padStart(2, "0");

  const hfBin =
    (fs.existsSync(LOCAL_CLI) &&
    fs.existsSync(path.join(ROOT_DIR, "packages", "cli", "dist", "cli.js"))
      ? LOCAL_CLI
      : null) ||
    resolveBin("chalkframes") ||
    requireBin("chalkframes", "run `bun run setup`");
  const procEnv = childEnv();

  // 1. Update narration / TTS if provided
  if (
    typeof newNarration === "string" &&
    newNarration.trim() &&
    newNarration.trim() !== scene.voiceover
  ) {
    scene.voiceover = newNarration.trim();
    const voPath = path.join(assetsDir, `vo-scene${idx + 1}.wav`);
    try {
      await execFileAsync(hfBin, ["tts", scene.voiceover, "-o", voPath], {
        env: procEnv,
        maxBuffer: 16 * 1024 * 1024,
      });
      const newDur = getWavDurationFast(voPath);
      if (newDur && Number.isFinite(newDur)) {
        scene.duration = Math.max(3.5, parseFloat((newDur + 0.6).toFixed(1)));
      }
    } catch (ttsErr) {
      console.warn(`[SingleSceneRerender] TTS regeneration failed (${ttsErr.message})`);
    }
  }

  // 2. Update archetype or title if provided
  if (typeof newArchetype === "string" && newArchetype.trim()) {
    scene.archetype = newArchetype.trim().toLowerCase();
  }
  if (typeof newTitle === "string" && newTitle.trim()) {
    scene.title = newTitle.trim();
  }

  // Save updated storyboard
  fs.writeFileSync(storyboardPath, JSON.stringify(storyboard, null, 2));

  // 3. Re-generate scene HTML & GSAP
  const format = storyboard.format || "landscape";
  const isSquare = format === "square";
  const isPortrait = format === "portrait";
  const compWidth = isSquare ? 1080 : isPortrait ? 1080 : 1920;
  const compHeight = isSquare ? 1080 : isPortrait ? 1920 : 1080;
  const activePalette = PALETTES[storyboard.paletteKey] || PALETTES["braun-industrial"];
  const sDur = scene.duration || 5.0;

  const { innerHtml } = buildSceneHtmlAndChoreography(
    scene,
    idx,
    storyboard.scenes.length,
    sDur,
    compWidth,
    compHeight,
    isPortrait,
    activePalette,
  );
  const scopedCss = getArchetypeScopedCss(scene, compWidth, compHeight, isPortrait, activePalette);

  const sceneFileContent = `<template id="${scene.id}-template">
  <div data-composition-id="${scene.id}" data-theme="${scene.theme || "light"}" class="theme-${scene.theme || "light"}" data-width="${compWidth}" data-height="${compHeight}" data-duration="${sDur}">
    ${innerHtml}
    <style>
      ${scopedCss}
    </style>
    <script>
      (function () {
        const tl = gsap.timeline({ paused: true });
        const scope = document.querySelector('[data-composition-id="${scene.id}"]');
        if (!scope) return;
        const sDur = ${sDur};
        ${idx > 0 ? (isPortrait ? `tl.from(scope, { y: 120, opacity: 0, scale: 0.97, filter: "blur(6px)", duration: 0.55, ease: "power3.out" }, 0);` : `tl.from(scope, { opacity: 0, scale: 0.96, filter: "blur(6px)", duration: 0.55, ease: "power3.out" }, 0);`) : `tl.from(scope, { opacity: 0, scale: 0.98, filter: "blur(4px)", duration: 0.45, ease: "power2.out" }, 0);`}
        const innerStage = scope.querySelector(".scene-inner, .split-hero-layout, .fullbleed-layout");
        if (innerStage) {
          tl.to(innerStage, { scale: 1.025, ease: "none", duration: sDur }, 0);
        }
        window.__timelines = window.__timelines || {};
        window.__timelines["${scene.id}"] = tl;
      })();
    </script>
  </div>
</template>`;
  fs.writeFileSync(path.join(compDir, `${scene.id}.html`), sceneFileContent);

  // 4. Re-render this single scene segment and re-stitch if segments exist
  let videoUpdated = false;
  const rawJobId = projDirName.replace(/^prod-/, "");
  const outputMp4Name = `${rawJobId}.mp4`;
  const outputMp4Path = path.join(RENDERS_DIR, outputMp4Name);

  if (fs.existsSync(segDir)) {
    const sceneProject = path.join(segDir, `html_rerender_${segName(idx)}`);
    const rawPath = path.join(sceneProject, "raw.mp4");
    const outPath = path.join(segDir, `scene_${segName(idx)}.mp4`);
    try {
      fs.mkdirSync(path.join(sceneProject, "compositions"), { recursive: true });
      fs.copyFileSync(
        path.join(compDir, `${scene.id}.html`),
        path.join(sceneProject, "compositions", `${scene.id}.html`),
      );
      fs.writeFileSync(
        path.join(sceneProject, "index.html"),
        buildSegmentHtml({
          scene,
          durationSec: sDur,
          compWidth,
          compHeight,
          activePalette,
        }),
      );
      await renderHtmlSegment({
        hfBin,
        projectPath: sceneProject,
        outputPath: rawPath,
        env: procEnv,
        onProgress: () => {},
      });
      const frames = computeSceneFrames({ voDuration: sDur, padding: 1.2 });
      await normalizeSegment({
        inputPath: rawPath,
        outputPath: outPath,
        totalFrames: frames,
        width: compWidth,
        height: compHeight,
      });

      const segmentPaths = storyboard.scenes.map((_, i) =>
        path.join(segDir, `scene_${segName(i)}.mp4`),
      );
      if (segmentPaths.every((p) => fs.existsSync(p))) {
        const stitchedVideoPath = path.join(segDir, "video.mp4");
        const masterAudioPath = path.join(segDir, "master-vo.wav");
        const bgmPath = path.join(assetsDir, "bgm.wav");

        await concatenateSegments({ segmentPaths, outputVideoPath: stitchedVideoPath });
        const sceneDurations = storyboard.scenes.map((s) => s.duration || 5.0);
        await assembleMasterAudio({
          sceneWavPaths: storyboard.scenes.map((_, i) =>
            path.join(assetsDir, `vo-scene${i + 1}.wav`),
          ),
          expectedDurations: sceneDurations,
          outputWavPath: masterAudioPath,
          leadIn: 0.15,
        });

        const sceneStartTimes = [0];
        for (let i = 0; i < storyboard.scenes.length - 1; i++) {
          sceneStartTimes.push(sceneStartTimes[i] + sceneDurations[i]);
        }

        const contextualCues = buildContextualSfxCues({
          storyboard,
          sceneStartTimes,
          sceneDurations,
          sfxDir,
        });
        const validSfx = contextualCues
          .filter((c) => fs.existsSync(path.join(sfxDir, c.name)))
          .map((c) => ({
            path: path.join(sfxDir, c.name),
            start: c.start,
            volume: c.volume,
          }));

        await muxMasterVideo({
          videoPath: stitchedVideoPath,
          audioPath: masterAudioPath,
          bgmPath: fs.existsSync(bgmPath) ? bgmPath : null,
          bgmVolume: 0.3,
          sfx: validSfx,
          outputPath: outputMp4Path,
        });
        videoUpdated = true;
      }
    } catch (segErr) {
      console.warn(`[SingleSceneRerender] Video re-render failed (${segErr.message})`);
    } finally {
      fs.rmSync(sceneProject, { recursive: true, force: true });
    }
  }

  return {
    success: true,
    projectId: projDirName,
    sceneIndex: idx,
    scene,
    videoUpdated,
    videoUrl: `/renders/${outputMp4Name}?t=${Date.now()}`,
    updatedAt: Date.now(),
  };
}

// HTTP Server
const MAX_BODY_BYTES = 40 * 1024 * 1024; // room for a base64-encoded PDF

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  // CORS alone does not stop a cross-origin simple POST from starting a job.
  // Validate browser origins before any pipeline work is admitted.
  const allowedOrigins = new Set([`http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`]);
  const origin = req.headers.origin;
  if (origin && !allowedOrigins.has(origin)) {
    res.writeHead(403);
    res.end("Origin not allowed");
    return;
  }
  if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  // GET /api/voices
  if (url.pathname === "/api/voices" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(VOICES));
    return;
  }

  // GET /api/models
  if (url.pathname === "/api/models" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(MODELS));
    return;
  }

  // GET /api/palettes
  if (url.pathname === "/api/palettes" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(PALETTES));
    return;
  }

  // GET /api/soundtracks
  if (url.pathname === "/api/soundtracks" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(SOUNDTRACKS));
    return;
  }

  // GET /api/config
  if (url.pathname === "/api/config" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        hasServerKey: Boolean(process.env.OPENROUTER_API_KEY),
        models: MODELS,
        voices: VOICES,
        palettes: PALETTES,
        soundtracks: SOUNDTRACKS,
      }),
    );
    return;
  }

  // GET /api/events (SSE)
  if (url.pathname === "/api/events" && req.method === "GET") {
    const jobId = url.searchParams.get("id");
    if (!jobId || !jobEvents.has(jobId)) {
      res.writeHead(404);
      res.end("Unknown job id");
      return;
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    for (const event of jobEvents.get(jobId)) res.write(`data: ${JSON.stringify(event)}\n\n`);
    const last = jobEvents.get(jobId).at(-1);
    if (last?.status === "error" || last?.node === "complete") {
      res.end();
      return;
    }
    if (!jobListeners.has(jobId)) jobListeners.set(jobId, new Set());
    jobListeners.get(jobId).add(res);

    req.on("close", () => {
      const set = jobListeners.get(jobId);
      if (set) {
        set.delete(res);
        if (set.size === 0) jobListeners.delete(jobId);
      }
    });
    return;
  }

  // POST /api/prepare-script
  if (url.pathname === "/api/prepare-script" && req.method === "POST") {
    const chunks = [];
    let size = 0;
    let rejected = false;

    req.on("data", (chunk) => {
      if (rejected) return;
      size += chunk.length;
      if (size > 100_000) {
        rejected = true;
        res.writeHead(413, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Payload too large" }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", async () => {
      if (rejected) return;
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (!body.apiKey && process.env.NODE_ENV !== "test" && process.env.OPENROUTER_API_KEY) {
          body.apiKey = process.env.OPENROUTER_API_KEY;
        }
        const validated = validateTopicInput(body);
        const result = await synthesizeTopicScript(validated);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, ...result }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // POST /api/generate
  if (url.pathname === "/api/generate" && req.method === "POST") {
    const chunks = [];
    let size = 0;
    let rejected = false;

    req.on("data", (chunk) => {
      if (rejected) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        rejected = true;
        res.writeHead(413, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Request body too large (limit 40 MB)" }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      if (rejected) return;
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (!body.apiKey && process.env.NODE_ENV !== "test" && process.env.OPENROUTER_API_KEY) {
          body.apiKey = process.env.OPENROUTER_API_KEY;
        }
        const payload = validateProductionInput(body);
        if (activeJobs >= MAX_ACTIVE_JOBS) {
          res.writeHead(429, { "Content-Type": "application/json", "Retry-After": "15" });
          res.end(
            JSON.stringify({
              error: "A video is already in production. Try again after it finishes.",
            }),
          );
          return;
        }
        // Reserve the slot synchronously before accepting another POST.
        activeJobs++;
        const jobId = `video_${Date.now()}_${randomBytes(3).toString("hex")}`;
        jobEvents.set(jobId, []);
        setTimeout(() => {
          runProductionPipeline(jobId, payload)
            .catch((err) => {
              console.error("Unhandled pipeline error:", err);
              broadcastEvent(jobId, {
                node: "render",
                status: "error",
                message: "Production failed unexpectedly",
              });
            })
            .finally(() => {
              activeJobs--;
              setTimeout(() => jobEvents.delete(jobId), 10 * 60 * 1000).unref();
            });
        }, 200);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, jobId }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // POST /api/projects/:id/rerender-scene
  const rerenderMatch = url.pathname.match(/^\/api\/projects\/([a-zA-Z0-9_-]+)\/rerender-scene$/);
  if (rerenderMatch && req.method === "POST") {
    const projectId = rerenderMatch[1];
    const chunks = [];
    let size = 0;
    let rejected = false;

    req.on("data", (chunk) => {
      if (rejected) return;
      size += chunk.length;
      if (size > 100_000) {
        rejected = true;
        res.writeHead(413, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Payload too large" }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", async () => {
      if (rejected) return;
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        const result = await rerenderSingleScene({
          projectId,
          sceneIndex: body.sceneIndex,
          newNarration: body.newNarration,
          newArchetype: body.newArchetype,
          newTitle: body.newTitle,
        });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (err) {
        const status = err.message?.includes("not found") ? 404 : 400;
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // GET /renders/:file — video players commonly request suffix byte ranges.
  if (url.pathname.startsWith("/renders/")) {
    const filename = path.basename(url.pathname);
    const filePath = path.join(RENDERS_DIR, filename);
    let stat;
    try {
      stat = fs.statSync(filePath);
      if (!stat.isFile()) throw new Error("Not a file");
    } catch {
      res.writeHead(404);
      res.end("Video not found");
      return;
    }
    const range = req.headers.range;
    const bytes = range ? parseVideoRange(range, stat.size) : null;
    if (range && !bytes) {
      res.writeHead(416, { "Content-Range": `bytes */${stat.size}`, "Accept-Ranges": "bytes" });
      res.end();
      return;
    }
    res.writeHead(bytes ? 206 : 200, {
      ...(bytes ? { "Content-Range": `bytes ${bytes.start}-${bytes.end}/${stat.size}` } : {}),
      "Accept-Ranges": "bytes",
      "Content-Length": bytes ? bytes.end - bytes.start + 1 : stat.size,
      "Content-Type": "video/mp4",
    });
    const stream = fs.createReadStream(filePath, bytes || {});
    stream.on("error", () => res.destroy());
    stream.pipe(res);
    return;
  }

  // Static files in studio-web/public
  let reqPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const targetFile = path.join(PUBLIC_DIR, reqPath);

  if (fs.existsSync(targetFile) && fs.statSync(targetFile).isFile()) {
    const ext = path.extname(targetFile);
    const mimeMap = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".svg": "image/svg+xml",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".wav": "audio/wav",
      ".mp3": "audio/mpeg",
      ".mp4": "video/mp4",
    };
    res.writeHead(200, { "Content-Type": mimeMap[ext] || "text/plain" });
    fs.createReadStream(targetFile).pipe(res);
  } else {
    res.writeHead(404);
    res.end("Not Found");
  }
});

const isMainModule =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMainModule) {
  server.listen(PORT, HOST, () => {
    console.log(`Chalk Frames Server running at http://${HOST}:${PORT}`);
  });
}
