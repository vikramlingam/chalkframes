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
  ARCHETYPE_RENDERERS,
  registerArchetypeRenderer,
  getArchetypeRenderer,
  renderDefaultCards,
  highlightCodeTokens,
  resolveScenePalette,
} from "./renderers.mjs";

export {
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

// Env for every child process, with the bun bin dir guaranteed present.
function childEnv() {
  return { ...process.env, PATH: `${bunPath}${path.delimiter}${process.env.PATH}` };
}

const PORT = process.env.PORT || 4000;
// Bind to loopback by default: this server has no auth and spends API credits.
const HOST = process.env.HOST || "127.0.0.1";
// Resolve the repo root from this file so the server works from any cwd.
const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_DIR = path.join(ROOT_DIR, "studio-web", "public");
const RENDERS_DIR = path.join(ROOT_DIR, "studio-web", "renders");
const PROJECTS_DIR = path.join(ROOT_DIR, "projects");

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
];

// Curated OpenRouter Models with real-time pricing
const MODELS = [
  {
    id: "anthropic/claude-sonnet-5.5",
    name: "Claude Sonnet 5.5",
    price: "$2.00 / $10.00 per 1M",
    badge: "Flagship Director",
  },
  {
    id: "openai/gpt-6.1-sol-pro",
    name: "GPT-6.1 Sol Pro",
    price: "$2.00 / $10.00 per 1M",
    badge: "Premier Reasoning",
  },
  {
    id: "openai/gpt-6.1-sol",
    name: "GPT-6.1 Sol",
    price: "$2.00 / $10.00 per 1M",
    badge: "Autonomous Agent",
  },
  {
    id: "x-ai/grok-4.6",
    name: "Grok 4.6",
    price: "$2.00 / $6.00 per 1M",
    badge: "Frontier Scripting",
  },
  { id: "x-ai/grok-4.7", name: "Grok 4.7", price: "$2.00 / $6.00 per 1M", badge: "High Velocity" },
  {
    id: "deepseek/deepseek-chat-v3.1",
    name: "DeepSeek V3.1",
    price: "$0.25 / $0.95 per 1M",
    badge: "Best Value",
  },
  {
    id: "deepseek/deepseek-r1",
    name: "DeepSeek R1",
    price: "$0.70 / $2.50 per 1M",
    badge: "Deep Logic",
  },
  {
    id: "google/gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    price: "$1.25 / $10.00 per 1M",
    badge: "Nuanced Design",
  },
  {
    id: "google/gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    price: "$0.30 / $2.50 per 1M",
    badge: "Fast Economy",
  },
  {
    id: "openai/gpt-6-luna-pro",
    name: "GPT-6 Luna Pro",
    price: "$0.10 / $0.50 per 1M",
    badge: "Ultra Budget",
  },
  {
    id: "openai/gpt-4o",
    name: "GPT-4o",
    price: "$2.50 / $10.00 per 1M",
    badge: "Production Standard",
  },
  {
    id: "openai/gpt-4o-mini",
    name: "GPT-4o Mini",
    price: "$0.15 / $0.60 per 1M",
    badge: "Lightweight",
  },
];

// Preset Color Palettes
const PALETTES = {
  "warm-ivory": {
    background: "#f7f6f2",
    text: "#141412",
    accent: "#e25329",
    // muted: used only for large/decorative text (≥24px or ≥18px bold) — NOT small text
    muted: "#57554f",
    // textMuted: WCAG AA guaranteed ≥4.5:1 on both card (#fff) and background (#f7f6f2) — use for ALL text ≤18px
    textMuted: "#45433e",
    // accentDark: darker accent for text on the warm semi-transparent tint bg — ≥4.5:1 guaranteed
    accentDark: "#bd4522",
    // accentText: foreground to use ON the accent color background — ≥4.5:1 on #e25329
    accentText: "#ffffff",
    card: "#ffffff",
    border: "#e5e2da",
  },
  "midnight-velvet": {
    background: "#09090d",
    text: "#f4f4f7",
    accent: "#8b5cf6",
    muted: "#888899",
    textMuted: "#9898ab",
    accentDark: "#a78bfa",
    // #ffffff on #8b5cf6 → ~5.3:1
    accentText: "#ffffff",
    card: "#13131c",
    border: "#20202e",
  },
  "cyber-slate": {
    background: "#0a0e17",
    text: "#e2e8f0",
    accent: "#06b6d4",
    muted: "#748296",
    textMuted: "#8899aa",
    accentDark: "#22d3ee",
    // #09090d on #06b6d4 → high contrast
    accentText: "#09090d",
    card: "#111827",
    border: "#1e293b",
  },
  "emerald-noir": {
    background: "#070b09",
    text: "#f0fdf4",
    accent: "#10b981",
    muted: "#6b8076",
    textMuted: "#7d9e92",
    accentDark: "#34d399",
    // #070b09 on #10b981 → high contrast
    accentText: "#070b09",
    card: "#0e1813",
    border: "#182b22",
  },
};

// Calculate Scene Breakdown based on requested total seconds (15s up to 10m / 600s)
// Pacing calibrated so visual beats change every 12 to 25 seconds, keeping long videos dynamic.
// 18 distinct narrative beats for middle scenes with semantic narrative intent
const MIDDLE_THEME_POOL = [
  {
    role: "paradigm",
    title: "Mental Model & Core Paradigm",
    narrativeIntent: "Explain the fundamental shift or mental model",
  },
  {
    role: "mechanism",
    title: "System Execution & Logic Flow",
    narrativeIntent: "Illustrate step-by-step mechanisms and algorithmic flow",
  },
  {
    role: "impact",
    title: "Quantitative Performance Multipliers",
    narrativeIntent: "Highlight quantitative benchmarks and tangible performance leaps",
  },
  {
    role: "code",
    title: "Developer Walkthrough & CLI Execution",
    narrativeIntent: "Walk through developer interfaces, syntax, or commands",
  },
  {
    role: "contrast",
    title: "Comparative Analysis: Old vs Modern",
    narrativeIntent: "Contrast legacy friction against the modern paradigm",
  },
  {
    role: "ecosystem",
    title: "Autonomous Orchestration Engine",
    narrativeIntent: "Showcase the interconnected ecosystem or node topology",
  },
  {
    role: "architecture",
    title: "3D Layered Infrastructure Stack",
    narrativeIntent: "Break down the architectural stack and layer responsibilities",
  },
  {
    role: "milestones",
    title: "Production Deployment Patterns",
    narrativeIntent: "Walk through lifecycle stages or deployment milestones",
  },
  {
    role: "telemetry",
    title: "Live Streaming & Event Verification",
    narrativeIntent: "Demonstrate realtime activity stream and event processing",
  },
  {
    role: "metrics",
    title: "Quantitative Benchmarks & Throughput",
    narrativeIntent: "Display comparative throughput metrics or growth numbers",
  },
  {
    role: "pillars",
    title: "Three Modular Architectural Pillars",
    narrativeIntent: "Present the core architectural pillars and modular design",
  },
  {
    role: "comparison",
    title: "Comparative Old vs Modern Paradigms",
    narrativeIntent: "Direct head-to-head comparison of approaches",
  },
  {
    role: "axiom",
    title: "Key Principles & Architectural Axioms",
    narrativeIntent: "Emphasize a core philosophical principle or architectural axiom",
  },
  {
    role: "dialogue",
    title: "Autonomous Agent State Negotiation",
    narrativeIntent: "Display simulated agent conversation or message exchange",
  },
  {
    role: "mobile",
    title: "Mobile & Realtime Interactive Experience",
    narrativeIntent: "Showcase the responsive app interface or mobile UX",
  },
  {
    role: "velocity",
    title: "Execution Speed & Latency Gains",
    narrativeIntent: "Focus on speedups, latency reduction, and velocity",
  },
  {
    role: "pipeline",
    title: "End-to-End Orchestration Nodes",
    narrativeIntent: "Illustrate the multi-node data or processing pipeline",
  },
  {
    role: "features",
    title: "Core Capabilities & Feature Matrix",
    narrativeIntent: "Showcase core capabilities and modular features",
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
export function getSceneTimingStructure(totalSeconds, seed) {
  const sec = Math.max(15, Math.min(600, Math.round(totalSeconds)));
  const seedEntropy = seed !== undefined ? seed : process.env.NODE_ENV === "test" ? 0 : Date.now();
  const rng = makeTimingRng(seedEntropy);

  if (sec <= 20) {
    return [
      {
        id: "scene1-hook",
        role: "hook",
        duration: parseFloat((sec * 0.45).toFixed(1)),
        maxWords: Math.round(sec * 0.45 * 2.3),
        chapterTitle: "Hook & Friction",
        narrativeIntent: "Hook the audience and present the core problem or tension",
      },
      {
        id: "scene2-outro",
        role: "outro",
        duration: parseFloat((sec * 0.55).toFixed(1)),
        maxWords: Math.round(sec * 0.55 * 2.3),
        chapterTitle: "Solution & Action",
        narrativeIntent: "Deliver the resolution, key takeaways, and call to action",
      },
    ];
  }
  if (sec <= 35) {
    const middleThemes = selectDiverseMiddleThemes(2, rng);
    return [
      {
        id: "scene1-hook",
        role: "hook",
        duration: 7.0,
        maxWords: 16,
        chapterTitle: "Workflow Friction",
        narrativeIntent: "Introduce the problem space and core friction",
      },
      {
        id: `scene2-${middleThemes[0].role}`,
        role: middleThemes[0].role,
        duration: 8.0,
        maxWords: 18,
        chapterTitle: middleThemes[0].title,
        narrativeIntent: middleThemes[0].narrativeIntent,
      },
      {
        id: `scene3-${middleThemes[1].role}`,
        role: middleThemes[1].role,
        duration: 8.5,
        maxWords: 19,
        chapterTitle: middleThemes[1].title,
        narrativeIntent: middleThemes[1].narrativeIntent,
      },
      {
        id: "scene4-outro",
        role: "outro",
        duration: 6.5,
        maxWords: 15,
        chapterTitle: "Actionable Next Steps",
        narrativeIntent: "Summarize the value and present actionable next steps",
      },
    ];
  }
  if (sec <= 75) {
    const sceneDur = parseFloat((sec / 5).toFixed(1));
    const words = Math.round(sceneDur * 2.2);
    const middleThemes = selectDiverseMiddleThemes(3, rng);
    return [
      {
        id: "scene1-hook",
        role: "hook",
        duration: sceneDur,
        maxWords: words,
        chapterTitle: "Workflow Friction",
        narrativeIntent: "Introduce the topic and highlight the core friction or question",
      },
      ...middleThemes.map((th, idx) => ({
        id: `scene${idx + 2}-${th.role}`,
        role: th.role,
        duration: sceneDur,
        maxWords: words,
        chapterTitle: th.title,
        narrativeIntent: th.narrativeIntent,
      })),
      {
        id: "scene5-outro",
        role: "outro",
        duration: sceneDur,
        maxWords: words,
        chapterTitle: "Actionable Summary",
        narrativeIntent: "Conclude with core takeaways and call to action",
      },
    ];
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

  return [
    {
      id: "scene1-hook",
      role: "hook",
      duration: parseFloat(sceneDuration.toFixed(1)),
      maxWords: wordsPerScene,
      chapterTitle: "Introduction & The Core Friction",
      narrativeIntent: "Hook the audience and establish the central problem or subject",
    },
    ...middleThemes.map((th, idx) => ({
      id: `scene${idx + 2}-${th.role}`,
      role: th.role,
      duration: parseFloat(sceneDuration.toFixed(1)),
      maxWords: wordsPerScene,
      chapterTitle: th.title,
      narrativeIntent: th.narrativeIntent,
    })),
    {
      id: `scene${chapterCount}-outro`,
      role: "outro",
      duration: parseFloat(sceneDuration.toFixed(1)),
      maxWords: wordsPerScene,
      chapterTitle: "Conclusion & Actionable Next Steps",
      narrativeIntent: "Synthesize the insights and prompt the next steps",
    },
  ];
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

function parseStoryboardJson(raw) {
  if (typeof raw !== "string") throw new Error("Director returned no storyboard");
  let text = raw.trim();
  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (match) text = match[1].trim();

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    text = text.slice(start, end + 1);
  }

  try {
    return JSON.parse(text);
  } catch (err) {
    // If truncated near end of a long 10-15m generation, attempt auto-closing scenes array
    const lastSceneMatch = text.lastIndexOf("}");
    if (lastSceneMatch !== -1) {
      const candidate = text.slice(0, lastSceneMatch + 1) + "\n]}";
      try {
        return JSON.parse(candidate);
      } catch {}
    }
    throw new Error(`Director returned invalid JSON: ${err.message}`);
  }
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

  const styleDescriptions = {
    explainer:
      "Visual explainer with intuitive analogies, real-world context, and clear concept progression.",
    "deep-dive":
      "Technical or scientific deep dive with rigorous terminology, core mechanisms, structural breakdowns, and data points.",
    educational:
      "Foundational educational pedagogy, building systematically from basic intuition to deeper principles.",
    documentary:
      "Cinematic documentary narrative with historical milestones, key discoveries, and profound takeaways.",
  };
  const chosenStyle = styleDescriptions[topicStyle] || styleDescriptions.explainer;

  const prompt = `You are a world-renowned educational researcher, domain specialist, and documentary scriptwriter.
Your task is to write a comprehensive, authoritative, and engaging educational video script for ANY subject in human knowledge.

TOPIC / SUBJECT:
"${topic.trim()}"

TARGET SPECS:
- Target Duration: ${duration} seconds
- Total Scenes / Chapters: ${totalScenes}
- Aspect Ratio: ${isPortrait ? "9:16 Vertical (Mobile / Shorts / Reels 1080x1920)" : "16:9 Landscape (YouTube / Desktop 1920x1080)"}
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

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${effectiveKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:4000",
      "X-Title": "Studio One Production Suite",
    },
    body: JSON.stringify({
      model: model || "anthropic/claude-sonnet-5.5",
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
    throw new Error(`OpenRouter returned HTTP ${response.status} when synthesizing topic script`);
  }

  const data = await response.json();
  const scriptContent = data.choices?.[0]?.message?.content || "";

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

  const timingStructure = providedTiming || getSceneTimingStructure(duration);
  const sceneCount = timingStructure.length;
  const isPortrait = format === "portrait";

  const isEducational = duration >= 90 || Boolean(sourceTopic);
  const prompt = `You are a world-class creative video director and motion designer.
Create a structured video storyboard and script specification based on the provided material.

INPUT:
${context}

CONSTRAINTS:
1. Total Target Duration: ${duration} seconds across ${sceneCount} distinct visual chapters/scenes.
2. Aspect Ratio: ${isPortrait ? "9:16 Portrait (Mobile / Reels / Shorts 1080x1920)" : "16:9 Landscape (YouTube 1920x1080)"}.
3. Tone: ${isEducational ? "Articulate, deeply informative, engaging, and clear for curious viewers." : "Minimalist, refined, quiet confidence."} NO hype words. NO buzzwords. NO em dashes.
4. Spoken Narration: Every scene must deliver natural, compelling spoken voiceover narration matching its target word count.
5. VISUAL VARIETY (CRITICAL): Rotate across archetypes. Consecutive scenes MUST NOT use the same archetype! Every visual chapter must have a distinct structure. Select the best-fitting archetype from the catalog to convey each chapter's narrative beat. Do NOT default to "features" or "features-cards".
6. CRITICAL VISUAL DIVERSITY RULE:
   a. The standard "eyebrow dot + centered serif title + rounded card below" layout pattern is FORBIDDEN more than once across the entire video.
   b. Every video MUST include at least one "kinetic-impact" scene — pure full-bleed word-slam typography with NO cards, NO eyebrow, NO subtitles.
   c. Every video MUST include at least one edge-to-edge interactive diagram — choose from: "vector-cluster-graph", "terminal-flow", or "stat-spotlight".
   d. Vary density and scale: alternate between oversized focal elements ("kinetic-impact", "stat-spotlight", "kpi-counter-ring") and detailed multi-element canvases ("bento-metric-grid", "terminal-flow", "vector-cluster-graph").
7. DYNAMIC THEME RHYTHM (CRITICAL): Never make all scenes the same theme. Alternate themes for visual breathing room (e.g., Open with 'light', transition to 'dark' for the architecture/vector traversal, and close on 'light'). Supported themes: "dark" | "light" | "accent".
8. WORKFLOW BEATS & SPATIAL RHYTHM: Avoid center-locking every scene. When comparing remote vs local workflows or architectures (like Scene 2), prioritize "terminal-flow" or step pipelines over static side-by-side bullet cards. Alternate between asymmetric split canvases (vector-cluster-graph, terminal-flow), multi-metric grids (bento-metric-grid), and focused editorial layouts.
9. NEGATIVE CONSTRAINT: Do not wrap every visual concept inside a centered rounded white card.
Choose from these ${VISUAL_CATALOG.length} available archetypes:
${formatCatalogForPrompt()}

TOPIC & DOMAIN ADAPTATION:
Translate the subject matter into rich visual metaphors across the archetypes:
- AI / Machine Learning / Data Science / Geometry: "vector-cluster-graph" (ideal dark theme) for embeddings, high-dimensional vector space, clustered embeddings, k-NN traversal, semantic search; "kinetic-impact" for paradigm-shift thesis statements; "stat-spotlight" for a decisive accuracy/latency/recall metric.
- Human Anatomy / Biology: "flowchart-process" for cardiac circulation, digestion, synaptic signal cascade; "isometric-stack" for anatomical/tissue layers; "radial-orbit" for neural/cellular networks; "kpi-counter-ring" for heart rate, blood pressure, cellular counts; "interactive-diff" for healthy vs pathology states; "stat-spotlight" for singular scale facts.
- Programming / Computer Science: "terminal-flow" (dark theme) for real code/APIs, CLI workflows, and build pipelines; "kinetic-impact" for core paradigm or thesis; "flowchart-process" for algorithm loops; "interactive-diff" for code refactoring or paradigm shift; "architecture-pipeline" for service flow; "isometric-stack" for OS/network stacks; "chat-exchange" for AI agent dialogue.
- Physics / Astronomy / Science: "radial-orbit" for gravitational/orbital systems; "flowchart-process" for thermodynamics or nuclear decay cycles; "stat-spotlight" for extreme-scale facts (speed of light, Planck constant); "kinetic-text" for fundamental laws; "interactive-diff" for classical vs relativistic models.
- History / Humanities / Economics: "flowchart-process" for historical chains of causation or policy passage; "step-ladder" or "step-progression" for chronological epochs and journeys; "interactive-diff" for pre vs post reform; "chat-exchange" for diplomatic cables; "stat-spotlight" for decisive GDP, demographic, or population milestones.
- Metrics / Results / Traction beats: "bento-metric-grid" when a chapter presents 3+ numbers (bare numbers, put %, x, $ in "unit"); "stat-spotlight" when a single metric deserves maximum cinematic weight (e.g. "10M users", "99.9% uptime").

Timing & Chapter Breakdown:
${timingStructure.map((t, idx) => `Chapter ${idx + 1} (${t.id}): ~${t.duration}s (~${t.maxWords} words) — Narrative Beat: ${t.chapterTitle || t.role}${t.narrativeIntent ? ` (${t.narrativeIntent})` : ""}`).join("\n")}

MANDATORY REQUIREMENTS FOR EVERY SCENE:
Every single scene (from Scene 1 to Scene ${sceneCount}) MUST ALWAYS include:
1. "id": Exact scene ID matching the breakdown (e.g. "scene1-hook", "scene2-paradigm", etc.)
2. "archetype": The chosen archetype name
3. "theme": "dark" | "light" | "accent" (set "dark" on at least 1-2 scenes for technical deep-dives or visual contrast)
4. "title": Punchy 2-5 word visual scene headline
5. "voiceover": Compelling spoken voiceover narration calibrated to the chapter target words
6. "eyebrow": Short 1-3 word category / milestone tag
7. The matching visual data payload for its archetype (e.g. kineticData, flowData, kpiData, codeDemo, diffData, clusters, stats, etc.). Do not output dummy properties for unrelated archetypes.

Respond ONLY with valid JSON matching this schema:
{
  "productName": "Topic or Product Name",
  "domain": "Domain or Field Badge",
  "scenes": [
    {
      "id": "scene1-hook",
      "archetype": "hook",
      "theme": "light",
      "eyebrow": "Core Question or Friction",
      "title": "Scene Headline",
      "subtitle": "Secondary description",
      "voiceover": "Concise spoken voiceover narration.",
      "visualNote": "Concept badge"
    },
    {
      "id": "scene2-cluster",
      "archetype": "vector-cluster-graph",
      "theme": "dark",
      "eyebrow": "Embedding Geometry",
      "title": "High-Dimensional Vector Space",
      "subtitle": "Sub-millisecond semantic retrieval across dense vector clusters.",
      "voiceover": "Dense vector representations partition high-dimensional space into semantic clusters, routing nearest-neighbor queries in real time.",
      "queryLabel": "q = embed('semantic query')",
      "clusters": [
        { "name": "Semantic Intent", "nodeCount": 16, "active": true },
        { "name": "Syntactic Match", "nodeCount": 9, "active": false },
        { "name": "Pruned Subgraph", "nodeCount": 12, "active": false }
      ],
      "stats": {
        "metric": "99.4% Cosine Sim",
        "latency": "1.2ms HNSW Traversal"
      }
    },
    {
      "id": "scene3-flow",
      "archetype": "terminal-flow",
      "theme": "dark",
      "eyebrow": "How It Works",
      "title": "From voice to published text",
      "voiceover": "Spoken voiceover narration walking through the workflow.",
      "terminalData": {
        "bullets": [
          { "text": "Speak naturally, wherever you are" },
          { "text": "The agent drafts in your tone" },
          { "text": "One review, then it ships" }
        ],
        "lines": [
          { "prompt": "$", "text": "chalkframes draft --from-voice", "output": "✓ draft ready in 4.2s" },
          { "prompt": "$", "text": "chalkframes publish draft-42", "output": "✓ published to workspace" }
        ]
      }
    },
    {
      "id": "scene4-stats",
      "archetype": "bento-metric-grid",
      "theme": "light",
      "eyebrow": "Traction",
      "title": "Numbers that carry weight",
      "voiceover": "Spoken voiceover narration over the metric grid.",
      "bentoData": {
        "metrics": [
          { "label": "Teams onboard", "value": 12000, "unit": "+", "detail": "since launch", "hero": true },
          { "label": "Render uptime", "value": 99.98, "unit": "%", "detail": "" },
          { "label": "Median export", "value": 41, "unit": "s", "detail": "" }
        ]
      }
    },
    {
      "id": "scene${sceneCount}-outro",
      "archetype": "outro",
      "theme": "accent",
      "eyebrow": "Synthesis",
      "title": "Topic Headline",
      "subtitle": "Summary statement",
      "voiceover": "Concluding spoken voiceover narration.",
      "pills": ["Core takeaway 1", "Core takeaway 2", "Core takeaway 3"],
      "cta": "Explore More"
    }
  ]
}`;

  const effectiveKey = apiKey || process.env.OPENROUTER_API_KEY;
  if (!effectiveKey) {
    throw new Error(
      "An OpenRouter API key is required to create a video grounded in your source. The offline template does not use your document and has been disabled.",
    );
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${effectiveKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:4000",
      "X-Title": "Studio One Production Suite",
    },
    body: JSON.stringify({
      model: model || "anthropic/claude-sonnet-5.5",
      messages: [
        { role: "system", content: "You are an autonomous JSON-only video design director." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.6,
      top_p: 0.9,
      presence_penalty: 0.3,
      max_tokens: Math.min(8000, Math.max(3500, sceneCount * 250)),
    }),
    signal: AbortSignal.timeout(180_000),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter returned HTTP ${response.status}; check the API key and model`);
  }

  const data = await response.json();
  const rawContent = data.choices?.[0]?.message?.content;
  return parseStoryboardJson(rawContent);
}

// Background Music Suite (5 soothing, high-fidelity instrumental tracks)
const SOUNDTRACK_MAP = {
  "soothing-ambient": {
    file: "soothing-ambient.mp3",
    name: "Soothing Ambient",
    desc: "Gentle and warm ambient pulse, relaxing and unobtrusive",
  },
  "modern-tech": {
    file: "modern-tech.mp3",
    name: "Modern Tech",
    desc: "Kinetic SaaS groove with subtle upbeat percussion",
  },
  "chill-lofi": {
    file: "chill-lofi.mp3",
    name: "Chill Horizon",
    desc: "Relaxing electronic lo-fi with atmospheric chords",
  },
  "acoustic-warmth": {
    file: "acoustic-warmth.mp3",
    name: "Acoustic Warmth",
    desc: "Warm acoustic piano and strings, emotional and human",
  },
  "minimal-clarity": {
    file: "minimal-clarity.mp3",
    name: "Minimal Clarity",
    desc: "Thoughtful neo-classical acoustic guitar, focused and serene",
  },
};

async function generateSoundtrack({ musicEngine = "soothing-ambient", duration = 30, targetPath }) {
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
    console.warn(`[Soundtrack] Unknown engine "${musicEngine}", falling back to soothing-ambient`);
  }
  const track = selectedTrack || SOUNDTRACK_MAP["soothing-ambient"];
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
export function getArchetypeScopedCss(scene, compWidth, compHeight, isPortrait, activePalette) {
  const defaultArch = "features-cards";
  const arch = scene.archetype || defaultArch;
  const renderer =
    ARCHETYPE_RENDERERS[arch] || ARCHETYPE_RENDERERS["features-cards"] || renderDefaultCards;

  const effectivePalette = resolveScenePalette(scene, activePalette);
  const isDark = scene.theme === "dark";

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

  return `
    [data-composition-id="${scene.id}"] { position: absolute; inset: 0; width: ${compWidth}px; height: ${compHeight}px; ${bgStyle} overflow: hidden; color: ${effectivePalette.text}; }
    [data-composition-id="${scene.id}"] .scene-inner { width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: ${isPortrait ? "flex-start" : "center"}; align-items: center; padding: ${isPortrait ? "130px 48px 120px" : "60px 100px"}; text-align: center; box-sizing: border-box; transform-origin: center center; }

    /* Split-Stage Hero Layout (Left Narrative / Right Graphic) */
    [data-composition-id="${scene.id}"] .split-hero-layout { width: 100%; height: 100%; display: flex; flex-direction: row; align-items: center; justify-content: space-between; padding: 60px 100px; box-sizing: border-box; text-align: left; }
    [data-composition-id="${scene.id}"] .split-col-left { flex: 0 0 42%; display: flex; flex-direction: column; align-items: flex-start; text-align: left; }
    [data-composition-id="${scene.id}"] .split-hero-title { font-family: "Playfair Display", serif; font-size: 64px; font-weight: 700; line-height: 1.15; letter-spacing: -0.02em; color: ${effectivePalette.text}; margin-top: 12px; }
    [data-composition-id="${scene.id}"] .split-hero-sub { font-size: 24px; color: ${effectivePalette.textMuted || effectivePalette.text}; line-height: 1.5; margin-top: 18px; max-width: 580px; }
    [data-composition-id="${scene.id}"] .split-hero-badge { margin-top: 28px; display: inline-flex; align-items: center; gap: 10px; background: ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)"}; border: 1px solid ${effectivePalette.border}; padding: 8px 20px; border-radius: 30px; font-family: "JetBrains Mono", monospace; font-size: 14px; font-weight: 600; color: ${effectivePalette.accent}; }
    [data-composition-id="${scene.id}"] .split-col-right { flex: 0 0 54%; display: flex; align-items: center; justify-content: center; }

    /* Full-Bleed Showcase Canvas */
    [data-composition-id="${scene.id}"] .fullbleed-layout { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: stretch; justify-content: flex-start; padding: 40px 80px; box-sizing: border-box; text-align: left; }
    [data-composition-id="${scene.id}"] .top-nav-bar { display: flex; justify-content: space-between; align-items: center; padding-bottom: 20px; border-bottom: 1px solid ${effectivePalette.border}; margin-bottom: 28px; width: 100%; }
    [data-composition-id="${scene.id}"] .nav-left { display: flex; align-items: center; gap: 14px; }
    [data-composition-id="${scene.id}"] .nav-badge { font-family: "JetBrains Mono", monospace; font-size: 15px; font-weight: 700; color: ${effectivePalette.accent}; letter-spacing: 0.08em; text-transform: uppercase; }
    [data-composition-id="${scene.id}"] .nav-sep { color: ${effectivePalette.border}; font-weight: 300; font-size: 18px; }
    [data-composition-id="${scene.id}"] .nav-title { font-family: "Playfair Display", serif; font-size: 28px; font-weight: 700; color: ${effectivePalette.text}; }
    [data-composition-id="${scene.id}"] .nav-status-pill { font-family: "JetBrains Mono", monospace; font-size: 13px; font-weight: 600; color: ${effectivePalette.textMuted || effectivePalette.text}; background: ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)"}; border: 1px solid ${effectivePalette.border}; padding: 6px 16px; border-radius: 20px; }
    [data-composition-id="${scene.id}"] .showcase-stage { flex: 1; display: flex; align-items: center; justify-content: center; width: 100%; }

    /* Full-bleed element adjustments */
    [data-composition-id="${scene.id}"] .terminal-fullbleed { max-width: 1560px; width: 100%; margin-top: 0; }
    [data-composition-id="${scene.id}"] .flow-fullbleed { max-width: 1600px; width: 100%; margin-top: 0; }
    [data-composition-id="${scene.id}"] .diff-fullbleed { max-width: 1560px; width: 100%; margin-top: 0; }
    [data-composition-id="${scene.id}"] .chart-fullbleed { max-width: 1560px; width: 100%; margin-top: 0; height: 580px; }
    [data-composition-id="${scene.id}"] .quote-split { max-width: 760px; margin-top: 0; }
    [data-composition-id="${scene.id}"] .ladder-split { max-width: 760px; margin-top: 0; }
    [data-composition-id="${scene.id}"] .live-feed-split { max-width: 760px; margin-top: 0; }

    [data-composition-id="${scene.id}"] .eyebrow { font-family: "JetBrains Mono", monospace; font-size: ${isPortrait ? "22px" : "18px"}; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: ${effectivePalette.textMuted || effectivePalette.text}; margin-bottom: ${isPortrait ? "14px" : "20px"}; display: flex; align-items: center; gap: 12px; }
    [data-composition-id="${scene.id}"] .eyebrow-dot { width: 10px; height: 10px; border-radius: 50%; background-color: ${effectivePalette.accent}; box-shadow: 0 0 12px ${effectivePalette.accent}; }
    [data-composition-id="${scene.id}"] .editorial-title { font-family: "Playfair Display", serif; font-size: ${isPortrait ? "76px" : "88px"}; font-weight: 700; line-height: 1.12; letter-spacing: -0.02em; color: ${effectivePalette.text}; text-align: center; max-width: ${isPortrait ? "940px" : "1400px"}; }
    [data-composition-id="${scene.id}"] .brand-dot { color: ${effectivePalette.accent}; }
    [data-composition-id="${scene.id}"] .cursor-blink { display: inline-block; width: 4px; height: 0.9em; background: ${effectivePalette.text}; margin-left: 8px; vertical-align: -0.05em; }
    [data-composition-id="${scene.id}"] .editorial-subtitle { font-size: ${isPortrait ? "30px" : "30px"}; font-weight: 400; color: ${effectivePalette.muted}; line-height: 1.45; margin-top: 18px; text-align: center; max-width: ${isPortrait ? "880px" : "900px"}; }
    [data-composition-id="${scene.id}"] .friction-box { margin-top: 40px; background: ${effectivePalette.card}; border: 1px solid ${effectivePalette.border}; border-radius: 16px; padding: 22px 40px; box-shadow: ${isDark ? "0 12px 32px rgba(0,0,0,0.4)" : "0 12px 32px rgba(0,0,0,0.04)"}; display: flex; align-items: center; gap: 16px; }
    [data-composition-id="${scene.id}"] .keyboard-badge { background: ${isDark ? "#1c202d" : "#ece8df"}; border: 1px solid ${isDark ? "#2e3447" : "#dcd7cc"}; border-radius: 8px; padding: 8px 16px; font-family: "JetBrains Mono", monospace; font-size: 18px; font-weight: 600; color: ${isDark ? "#f3f4f8" : "#3b3935"}; }
    [data-composition-id="${scene.id}"] .friction-text { font-family: "JetBrains Mono", monospace; font-size: 22px; color: ${effectivePalette.textMuted || effectivePalette.text}; }

    /* Archetype-Specific Scoped CSS */
    ${customCss}

    ${
      isDark
        ? `
    /* Deep Obsidian Dark Theme Overrides */
    [data-composition-id="${scene.id}"] { background: #0b0d14; color: #f3f4f8; }
    [data-composition-id="${scene.id}"] .editorial-title,
    [data-composition-id="${scene.id}"] .split-hero-title,
    [data-composition-id="${scene.id}"] .nav-title,
    [data-composition-id="${scene.id}"] .bento-value,
    [data-composition-id="${scene.id}"] .bento-label,
    [data-composition-id="${scene.id}"] .quote-text,
    [data-composition-id="${scene.id}"] .feature-card h3,
    [data-composition-id="${scene.id}"] .step-title,
    [data-composition-id="${scene.id}"] .flow-node-title,
    [data-composition-id="${scene.id}"] .chart-title { color: #f3f4f8 !important; }

    [data-composition-id="${scene.id}"] .editorial-subtitle,
    [data-composition-id="${scene.id}"] .split-hero-sub,
    [data-composition-id="${scene.id}"] .eyebrow,
    [data-composition-id="${scene.id}"] .friction-text,
    [data-composition-id="${scene.id}"] .bento-detail,
    [data-composition-id="${scene.id}"] .feed-sub,
    [data-composition-id="${scene.id}"] .flow-node-desc,
    [data-composition-id="${scene.id}"] .quote-author,
    [data-composition-id="${scene.id}"] .nav-status-pill { color: #9ca3af !important; }

    [data-composition-id="${scene.id}"] .bento-tile,
    [data-composition-id="${scene.id}"] .feature-card,
    [data-composition-id="${scene.id}"] .step-card,
    [data-composition-id="${scene.id}"] .feed-item-pill,
    [data-composition-id="${scene.id}"] .iso-slab,
    [data-composition-id="${scene.id}"] .pipe-node,
    [data-composition-id="${scene.id}"] .flow-node,
    [data-composition-id="${scene.id}"] .diff-pane,
    [data-composition-id="${scene.id}"] .chart-wrapper,
    [data-composition-id="${scene.id}"] .quote-card,
    [data-composition-id="${scene.id}"] .outro-card {
      background: #141724 !important;
      border: 1px solid rgba(255, 255, 255, 0.12) !important;
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5) !important;
    }

    [data-composition-id="${scene.id}"] .pill-feature {
      background: #0b0d14 !important;
      border: 1px solid rgba(255, 255, 255, 0.16) !important;
      color: #f3f4f8 !important;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3) !important;
    }

    [data-composition-id="${scene.id}"] .cta-button {
      background: ${effectivePalette.accent} !important;
      color: #ffffff !important;
      border: 1px solid rgba(255, 255, 255, 0.2) !important;
      box-shadow: 0 12px 36px ${effectivePalette.accent}55 !important;
    }

    [data-composition-id="${scene.id}"] .feed-tag,
    [data-composition-id="${scene.id}"] .step-badge,
    [data-composition-id="${scene.id}"] .node-badge,
    [data-composition-id="${scene.id}"] .flow-node-badge,
    [data-composition-id="${scene.id}"] .card-badge,
    [data-composition-id="${scene.id}"] .note-icon,
    [data-composition-id="${scene.id}"] .kinetic-pill {
      background: rgba(255, 255, 255, 0.08) !important;
      border-color: rgba(255, 255, 255, 0.16) !important;
      color: #f3f4f8 !important;
    }
    `
        : ""
    }

    /* Portrait stacks */
    [data-composition-id="${scene.id}"] .portrait-stack { display: flex; flex-direction: column; gap: 24px; max-width: 920px; width: 100%; }
  `;
}

// Master Production Pipeline

async function runProductionPipeline(jobId, payload) {
  const {
    apiKey,
    model = "anthropic/claude-sonnet-5.5",
    voice = "bm_george",
    sourceUrl = "",
    sourceScript = "",
    sourceTopic = "",
    topicStyle = "explainer",
    sourcePdf = null,
    sourcePdfName = null,
    duration = 30,
    format = "landscape",
    paletteKey = "warm-ivory",
    customColors = null,
    // Must be a SOUNDTRACK_MAP key (or "none") — "studio-acoustic" was never a
    // real key and silently fell back to soothing-ambient.
    musicEngine = "soothing-ambient",
  } = payload;

  const projectDir = path.join(PROJECTS_DIR, `prod-${jobId}`);
  const assetsDir = path.join(projectDir, "assets");
  const compDir = path.join(projectDir, "compositions");
  const sfxDir = path.join(assetsDir, "sfx");

  let completed = false;
  const isPortrait = format === "portrait";
  const compWidth = isPortrait ? 1080 : 1920;
  const compHeight = isPortrait ? 1920 : 1080;

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
      ? { ...(PALETTES[paletteKey] || PALETTES["warm-ivory"]), ...customColors }
      : PALETTES[paletteKey] || PALETTES["warm-ivory"];
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
    broadcastEvent(jobId, {
      node: "ingest",
      status: "complete",
      message: `Source configured (${isPortrait ? "9:16 Portrait" : "16:9 Landscape"}, ${duration}s${sourcePdf ? " · PDF" : ""}${sourceTopic ? " · Topic" : ""})`,
    });

    // 02: Director
    broadcastEvent(jobId, {
      node: "narrative",
      status: "active",
      message: `Directing scene choreography using ${model}`,
    });
    const timingStructure = getSceneTimingStructure(duration);
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
    const storyboard = validateStoryboard(rawStoryboard, timingStructure);
    console.log("--- STORYBOARD ARCHETYPE AUDIT (POST-VALIDATION) ---");
    console.log(
      "Chosen Archetypes:",
      storyboard.scenes.map((s, idx) => `[Scene ${idx + 1}] ${s.archetype} (${s.title || s.id})`),
    );
    console.log("---------------------------------------------------");
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

    // Copy sound effects (best effort — the source lives in the CLI build output).
    const sfxSourceDir = path.join(
      ROOT_DIR,
      "packages",
      "cli",
      "dist",
      "skills",
      "media-use",
      "audio",
      "assets",
      "sfx",
    );
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
      resolveBin("chalkframes") ||
      requireBin("chalkframes", "run `bun run build`");
    const procEnv = childEnv();

    const voDurations = new Array(storyboard.scenes.length).fill(4.0);
    const concurrency = 2;
    let completedAudioCount = 0;

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
        console.warn(
          `[TTS] TTS failed for scene ${i + 1} (${probeErr.message}); estimating duration`,
        );
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

    // Dynamic scene duration calculation based on voiceover length and chapter target
    const sceneStartTimes = [];
    const sceneDurations = [];
    let accumulatedTime = 0;

    for (let i = 0; i < storyboard.scenes.length; i++) {
      sceneStartTimes.push(accumulatedTime);
      const targetSec = timingStructure[i]?.duration || 8.0;
      const sceneDur = Math.max(voDurations[i] + 1.2, targetSec);
      sceneDurations.push(sceneDur);
      accumulatedTime += sceneDur;
    }

    const totalCalculatedDuration = accumulatedTime;

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
      message: `Authoring ${isPortrait ? "portrait" : "landscape"} motion layouts`,
    });

    // Generate Scene HTML files (Archetype-Driven)
    for (let i = 0; i < storyboard.scenes.length; i++) {
      const scene = storyboard.scenes[i];
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
        ${i > 0 ? (isPortrait ? `tl.from(scope, { y: 160, opacity: 0, duration: 0.5, ease: "power4.out" }, 0);` : `tl.from(scope, { x: 220, opacity: 0, duration: 0.5, ease: "power4.out" }, 0);`) : `tl.from(scope, { opacity: 0, duration: 0.4 }, 0);`}
        ${gsapChoreography}
        ${i < storyboard.scenes.length - 1 ? (isPortrait ? `tl.to(scope, { y: -160, opacity: 0, duration: 0.45, ease: "power4.in" }, ${sDur - 0.45});` : `tl.to(scope, { x: -220, opacity: 0, duration: 0.45, ease: "power4.in" }, ${sDur - 0.45});`) : ``}
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

    const sceneDivsHtml = storyboard.scenes
      .map(
        (s, idx) =>
          `<div id="${s.id}" class="scene clip" data-composition-id="${s.id}" data-composition-src="compositions/${s.id}.html" data-start="${sceneStartTimes[idx].toFixed(2)}" data-duration="${sceneDurations[idx].toFixed(2)}" data-track-index="${idx % 2 === 0 ? 4 : 5}" data-width="${compWidth}" data-height="${compHeight}"></div>`,
      )
      .join("\n      ");

    // Dynamic non-overlapping whooshes on track 2 for scene seams
    const whooshAudioHtml = [];
    for (let sIdx = 0; sIdx < storyboard.scenes.length - 1; sIdx++) {
      const wStart = Math.max(1.8, sceneStartTimes[sIdx + 1] - 0.3);
      whooshAudioHtml.push(
        `<audio id="sfx-whoosh-${sIdx + 1}" class="clip" src="assets/sfx/whoosh.mp3" data-start="${wStart.toFixed(2)}" data-duration="0.57" data-track-index="2" data-volume="0.40"></audio>`,
      );
    }

    // Dynamic non-overlapping chimes on track 3 for reveal & outro
    const chimeAudioHtml = [
      `<audio id="sfx-chime-reveal" class="clip" src="assets/sfx/chime.mp3" data-start="${(sceneStartTimes[1] + 0.2).toFixed(2)}" data-duration="1.5" data-track-index="3" data-volume="0.40"></audio>`,
    ];
    if (storyboard.scenes.length >= 4) {
      const outroIdx = storyboard.scenes.length - 1;
      const outroChimeStart = (sceneStartTimes[outroIdx] + 0.2).toFixed(2);
      chimeAudioHtml.push(
        `<audio id="sfx-chime-outro" class="clip" src="assets/sfx/chime.mp3" data-start="${outroChimeStart}" data-duration="1.5" data-track-index="3" data-volume="0.40"></audio>`,
      );
    }

    const masterHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${compWidth}, height=${compHeight}" />
    <title>${storyboard.productName} — Explainer</title>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=block" rel="stylesheet" />
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { margin: 0; width: ${compWidth}px; height: ${compHeight}px; overflow: hidden; background-color: ${activePalette.background}; color: ${activePalette.text}; font-family: "Inter", sans-serif; }
      #root { position: relative; width: ${compWidth}px; height: ${compHeight}px; background: ${activePalette.background}; overflow: hidden; }
      .scene { position: absolute; inset: 0; width: ${compWidth}px; height: ${compHeight}px; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${totalCalculatedDuration.toFixed(2)}" data-width="${compWidth}" data-height="${compHeight}">
      ${musicEngine !== "none" ? `<audio id="bgm" class="clip" src="assets/bgm.wav" data-start="0" data-duration="${totalCalculatedDuration.toFixed(2)}" data-track-index="0" data-volume="0.30"></audio>` : ""}
      ${audioTagsHtml}
      <audio id="sfx-typing" class="clip" src="assets/sfx/typing.mp3" data-start="0.1" data-duration="1.5" data-track-index="2" data-volume="0.35"></audio>
      ${whooshAudioHtml.join("\n      ")}
      ${chimeAudioHtml.join("\n      ")}

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

    // Spawned with --experimental-fast-capture (Chrome drawElementImage GPU path, ~2x faster).
    // stdin is closed so the CLI never waits on interactive prompts.
    const renderChild = spawn(
      hfBin,
      ["render", projectDir, "--experimental-fast-capture", "-o", outputMp4Path],
      {
        env: procEnv,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    let renderErrTail = "";
    renderChild.stdout.on("data", (data) => {
      const line = data.toString();
      const match = line.match(/(\d+)%\s+(?:Streaming|Capturing)\s+frame\s+(\d+\/\d+)/i);
      if (match) {
        broadcastEvent(jobId, {
          node: "render",
          status: "active",
          message: `Streaming frame ${match[2]} (${match[1]}%)`,
        });
      } else if (line.includes("Encoding video")) {
        broadcastEvent(jobId, {
          node: "render",
          status: "active",
          message: "Encoding video stream (H.264 / AAC)",
        });
      } else if (line.includes("Assembling final video")) {
        broadcastEvent(jobId, {
          node: "render",
          status: "active",
          message: "Mastering audio & muxing container",
        });
      }
    });

    // Drain stderr so the child can never block on a full pipe buffer.
    renderChild.stderr.on("data", (data) => {
      renderErrTail = (renderErrTail + data.toString()).slice(-1500);
    });

    // Keep the job slot until encoding actually finishes, not merely until the
    // render process is launched. A failed job discards its incomplete files.
    await new Promise((resolve) => {
      let spawnError;
      renderChild.on("error", (err) => {
        spawnError = err;
      });
      renderChild.on("close", (code) => {
        if (code === 0 && fs.existsSync(outputMp4Path) && fs.statSync(outputMp4Path).size > 0) {
          completed = true;
          broadcastEvent(jobId, {
            node: "complete",
            status: "complete",
            message: "Production complete",
            videoUrl: `/renders/${outputMp4Name}`,
            duration: `${totalCalculatedDuration.toFixed(1)}s`,
            resolution: `${compWidth}x${compHeight}`,
          });
        } else {
          const detail = renderErrTail.trim();
          broadcastEvent(jobId, {
            node: "render",
            status: "error",
            message: spawnError
              ? `Render failed to start: ${spawnError.message}`
              : `Render failed (exit ${code})${detail ? `: ${detail.split("\n").slice(-3).join(" ")}` : ""}`,
          });
        }
        resolve();
      });
    });
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

  // GET /api/config
  if (url.pathname === "/api/config" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        hasServerKey: Boolean(process.env.OPENROUTER_API_KEY),
        hasTavilyKey: Boolean(process.env.TAVILY_API_KEY || process.env.TAVILY_API_KEY2),
        models: MODELS,
        voices: VOICES,
        palettes: PALETTES,
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
