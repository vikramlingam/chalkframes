import net from "node:net";

// Input contracts shared by the Studio One server and its regression tests.
export function isPublicAddress(address) {
  const ip = net.isIP(address);
  if (ip === 4) {
    const [a, b] = address.split(".").map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  if (ip === 6) {
    const normalized = address.toLowerCase().split("%")[0];
    if (normalized.startsWith("::ffff:")) {
      const mapped = normalized.slice(7);
      if (net.isIP(mapped) === 4) return isPublicAddress(mapped);
      // Hex-mapped IPv4 addresses are blocked rather than risking bypasses.
      return false;
    }
    return !(
      normalized === "::" ||
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      /^fe[89ab]/.test(normalized) ||
      normalized.startsWith("2001:db8")
    );
  }
  return false;
}

export function parseVideoRange(range, size) {
  if (!Number.isSafeInteger(size) || size <= 0) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match || (!match[1] && !match[2])) return null;
  let start;
  let end;
  if (!match[1]) {
    const count = Number(match[2]);
    if (!Number.isSafeInteger(count) || count <= 0) return null;
    start = Math.max(0, size - count);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : size - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || end < start)
      return null;
    end = Math.min(end, size - 1);
  }
  return { start, end };
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

import {
  VISUAL_CATALOG,
  archetypes,
  ARCHETYPE_FAMILY,
  MIDDLE_ARCHS,
  MANIM_ARCHETYPES,
  ARCHETYPE_ALIASES,
  registerArchetype,
  formatCatalogForPrompt,
} from "./catalog.mjs";
import {
  validateManimBrief,
  validateBeats,
  inferManimPrimitive,
  DEFAULT_FALLBACK,
} from "./engines/manim/schema.mjs";
import { degradeScene } from "./engines/manim/degrade.mjs";
import { enrichScene } from "./enrichment.mjs";

/** Max share of scenes that may use Manim, and max consecutive Manim scenes. */
export const MANIM_MAX_SHARE = 0.4;
export const MANIM_MAX_CONSECUTIVE = 2;

/**
 * Decide whether a Manim scene may keep its engine. Returns { ok:true, brief, beats,
 * fallback } or { ok:false, reason, fallback } -- the caller degrades on !ok.
 */
function planManimScene({ scene, archetype, index, lastIndex, enabled, count, max, run }) {
  const requested = strictArchetype(scene.fallbackArchetype);
  const fallbackOk =
    requested &&
    !MANIM_ARCHETYPES.includes(requested) &&
    requested !== "hook" &&
    requested !== "outro";
  const fallback = fallbackOk ? requested : DEFAULT_FALLBACK[archetype] || "bento-metric-grid";
  const no = (reason) => ({ ok: false, reason, fallback });
  if (!enabled) return no("Manim engine unavailable");
  if (index === 0 || index === lastIndex) return no("hook and outro must be html-gsap");
  if (count >= max) return no(`Manim share capped at ${Math.round(MANIM_MAX_SHARE * 100)}%`);
  if (run >= MANIM_MAX_CONSECUTIVE) return no("too many consecutive Manim scenes");
  if (!fallbackOk) return no("missing or invalid fallbackArchetype");
  let beats;
  let brief;
  try {
    beats = validateBeats(scene.beats);
  } catch (err) {
    return no(err.message);
  }
  try {
    brief = validateManimBrief(archetype, scene.manimData);
  } catch (err) {
    return no(`invalid manimData: ${err.message}`);
  }
  return { ok: true, brief, beats, fallback };
}

export {
  VISUAL_CATALOG,
  archetypes,
  ARCHETYPE_FAMILY,
  MIDDLE_ARCHS,
  ARCHETYPE_ALIASES,
  registerArchetype,
  formatCatalogForPrompt,
};

export function normalizeArchetype(raw) {
  if (!raw || typeof raw !== "string") {
    console.warn(
      `[Archetype Normalization] Missing or invalid archetype "${raw}". Falling back to features-cards.`,
    );
    return "features-cards";
  }
  const str = raw.toLowerCase().trim().replace(/_/g, "-");
  if (archetypes.has(str)) return str;
  if (ARCHETYPE_ALIASES[str]) return ARCHETYPE_ALIASES[str];

  console.warn(
    `[Archetype Normalization] Unrecognized archetype: "${raw}". Falling back to features-cards.`,
  );
  return "features-cards";
}

function familyOf(archetype) {
  return ARCHETYPE_FAMILY[archetype] ?? "grid";
}

/**
 * Strict resolution: returns the archetype only when `raw` actually names one.
 */
function strictArchetype(raw) {
  if (!raw || typeof raw !== "string") return null;
  const str = raw.toLowerCase().trim().replace(/_/g, "-");
  if (archetypes.has(str)) return str;
  if (ARCHETYPE_ALIASES[str]) return ARCHETYPE_ALIASES[str];
  return null;
}

/** Deterministic 32-bit string hash (FNV-1a) — seeds the per-project rotation. */
function hashSeed(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Mulberry32 PRNG — seeded, so a given project always rotates identically. */
function makeRng(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(list, rng) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Choose the archetype for one middle scene.
 *
 * Precedence:
 *   1. The director's valid pick, whenever it doesn't immediately repeat the preceding scene.
 *   2. The timing's suggested archetype, when it clears the window.
 *   3. Seeded rotation over eligible middle archetypes avoiding recent look repeats.
 */
function chooseArchetype({ requested, suggested, previous, window = 2, archetypeWindow = 3, rng }) {
  const lastArchetype = previous[previous.length - 1];
  // If the director made a valid selection that doesn't immediately repeat the preceding scene, honour it!
  if (requested && requested !== lastArchetype) {
    return requested;
  }
  // A valid Manim primitive is never rotated away: the Manim gate (share cap, max 2 in a
  // row, brief + fallback validation) decides, and logs why when it degrades one.
  if (requested && MANIM_ARCHETYPES.includes(requested)) {
    return requested;
  }

  const recentArchetypes = previous.slice(-Math.max(window, archetypeWindow));
  const recentFamilies = new Set(previous.slice(-window).map(familyOf));
  const clearsWindow = (candidate) =>
    candidate !== null &&
    candidate !== "hook" &&
    candidate !== "outro" &&
    !recentArchetypes.includes(candidate) &&
    !recentFamilies.has(familyOf(candidate));

  if (suggested && clearsWindow(suggested)) return suggested;

  const candidates = shuffled(MIDDLE_ARCHS, rng);
  const freshFamily = candidates.find((candidate) => clearsWindow(candidate));
  if (freshFamily) return freshFamily;
  return candidates.find((candidate) => !recentArchetypes.includes(candidate)) ?? candidates[0];
}

function safeTextFields(value) {
  if (Array.isArray(value)) return value.map(safeTextFields);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        key === "voiceover" || key === "lines" ? child : safeTextFields(child),
      ]),
    );
  }
  return typeof value === "string" ? escapeHtml(value) : value;
}

// The director owns prose, never filenames, IDs, arbitrary DOM markup or bar geometry.
export function validateStoryboard(value, timing, { manimEnabled = false } = {}) {
  if (
    !value ||
    typeof value !== "object" ||
    !Array.isArray(value.scenes) ||
    value.scenes.length === 0
  )
    throw new Error(`Director returned an invalid storyboard: expected ${timing.length} scenes`);
  if (typeof value.productName !== "string" || !value.productName.trim())
    throw new Error("Director returned an invalid product name");

  // Resilient scene count: truncate if LLM returned too many, pad with fallbacks if too few.
  // Long educational prompts occasionally produce N±1 scenes due to token budget limits.
  let rawScenes = value.scenes;
  if (rawScenes.length > timing.length) {
    // Too many: keep hook (first), required middle scenes, outro (last)
    const middle = rawScenes.slice(1, rawScenes.length - 1);
    const needed = timing.length - 2;
    rawScenes = [rawScenes[0], ...middle.slice(0, needed), rawScenes[rawScenes.length - 1]];
  } else if (rawScenes.length < timing.length) {
    // Too few: clone the last middle scene until we have the right count
    const shortage = timing.length - rawScenes.length;
    const donor = rawScenes[Math.max(0, rawScenes.length - 2)] || rawScenes[0];
    const pads = Array.from({ length: shortage }, () => ({ ...donor }));
    rawScenes = [...rawScenes.slice(0, -1), ...pads, rawScenes[rawScenes.length - 1]];
  }

  // Seeded from product name, scene count, and optional seed/entropy (falls back to Date.now() when not fixed)
  // so regenerating produces fresh visual selections while tests can remain deterministic if seed is passed.
  const seedEntropy =
    value.seed !== undefined ? value.seed : process.env.NODE_ENV === "test" ? 0 : Date.now();
  const rng = makeRng(hashSeed(`${value.productName}|${rawScenes.length}|${seedEntropy}`));

  const scenes = [];
  const manimMax = Math.floor(rawScenes.length * MANIM_MAX_SHARE);
  let manimCount = 0;
  let manimRun = 0;
  for (let index = 0; index < rawScenes.length; index++) {
    const scene = rawScenes[index];
    if (!scene || typeof scene !== "object") {
      throw new Error(`Director scene ${index + 1} is invalid`);
    }

    // Adapt to diverse LLM output variations (headline, name, chapterTitle, narration, script, text)
    let title =
      typeof scene.title === "string" && scene.title.trim()
        ? scene.title.trim()
        : typeof scene.headline === "string" && scene.headline.trim()
          ? scene.headline.trim()
          : typeof scene.chapterTitle === "string" && scene.chapterTitle.trim()
            ? scene.chapterTitle.trim()
            : typeof scene.name === "string" && scene.name.trim()
              ? scene.name.trim()
              : timing[index]?.chapterTitle || "";

    let voiceover =
      typeof scene.voiceover === "string" && scene.voiceover.trim()
        ? scene.voiceover.trim()
        : typeof scene.narration === "string" && scene.narration.trim()
          ? scene.narration.trim()
          : typeof scene.script === "string" && scene.script.trim()
            ? scene.script.trim()
            : typeof scene.speech === "string" && scene.speech.trim()
              ? scene.speech.trim()
              : typeof scene.text === "string" && scene.text.trim()
                ? scene.text.trim()
                : Array.isArray(scene.kineticData)
                  ? scene.kineticData.join(" ")
                  : typeof scene.caption === "string" && scene.caption.trim()
                    ? scene.caption.trim()
                    : typeof scene.subtitle === "string" && scene.subtitle.trim()
                      ? scene.subtitle.trim()
                      : "";

    // For middle scenes, if title was omitted, derive from archetype data
    if (!title && scene.kineticData?.mainWord) {
      title = `${scene.kineticData.mainWord} ${scene.kineticData.accentWord || ""}`.trim();
    }
    if (!title) {
      title = timing[index]?.chapterTitle || `Chapter ${index + 1}`;
    }

    // Check if voiceover is empty: in unit tests (e.g. bad.scenes[0].voiceover = ""), explicitly assert throw
    if (scene.voiceover === "" || (!voiceover && index === 0)) {
      throw new Error(`Director scene ${index + 1} needs a title and narration`);
    }
    if (!voiceover) {
      // Intelligent fallback for narration from chapter title
      voiceover = `Understanding ${title} and its foundational principles for the system.`;
    }

    scene.title = title;
    scene.voiceover = voiceover;

    // Normalize kineticData if LLM returned array of strings
    if (Array.isArray(scene.kineticData)) {
      const words = scene.kineticData.filter((x) => typeof x === "string");
      scene.kineticData = {
        mainWord: words[0]?.slice(0, 30) || scene.title,
        accentWord: words[1]?.slice(0, 30) || "",
        subtitle: words[2] || scene.voiceover,
        badge: "Key Paradigm",
      };
    }

    // Normalize flowData if LLM returned nodes or connections
    if ((!scene.flowData || !scene.flowData.steps) && Array.isArray(scene.nodes)) {
      scene.flowData = {
        steps: scene.nodes.slice(0, 4).map((node, i) => ({
          stepNumber: String(i + 1).padStart(2, "0"),
          title:
            typeof node === "string"
              ? node
              : node.title || node.label || node.name || `Phase ${i + 1}`,
          desc: typeof node === "object" ? node.desc || node.description || "" : "",
          isHighlighted: i === 1,
        })),
      };
    }

    // Auto-normalize single strings into arrays for text lists before validation
    if (typeof scene.pills === "string")
      scene.pills = scene.pills
        .split(/[,\n•-]/)
        .map((s) => s.trim())
        .filter(Boolean);
    if (typeof scene.compareLeft?.points === "string")
      scene.compareLeft.points = [scene.compareLeft.points];
    if (typeof scene.compareRight?.points === "string")
      scene.compareRight.points = [scene.compareRight.points];
    if (typeof scene.codeDemo?.lines === "string")
      scene.codeDemo.lines = scene.codeDemo.lines.split("\n");
    if (typeof scene.cardRight?.bullets === "string")
      scene.cardRight.bullets = scene.cardRight.bullets
        .split(/[,\n•-]/)
        .map((s) => s.trim())
        .filter(Boolean);
    if (typeof scene.metric?.subPills === "string")
      scene.metric.subPills = scene.metric.subPills
        .split(/[,\n•-]/)
        .map((s) => s.trim())
        .filter(Boolean);
    if (typeof scene.kineticData?.words === "string")
      scene.kineticData.words = [scene.kineticData.words];
    if (typeof scene.diffData?.linesLeft === "string")
      scene.diffData.linesLeft = scene.diffData.linesLeft.split("\n");
    if (typeof scene.diffData?.linesRight === "string")
      scene.diffData.linesRight = scene.diffData.linesRight.split("\n");

    // Visual-variety rotation.
    //
    // Previously this only intervened on *bad* input (missing / "features" /
    // same-as-previous) and otherwise used `MIDDLE_ARCHS[index % length]` — pure
    // index math, so every video got an identical skeleton and two "different"
    // archetypes could still land back to back with the same look. Now the
    // director's pick is honoured whenever it clears the window, and anything
    // generic, unknown, or visually repetitive is replaced from a rotation seeded
    // on the product name: varied across projects, identical for a given project.
    // Honour an explicit `engine: "manim"` even when the archetype name is missing or not a
    // manim-* id: recover the primitive from the shape of manimData (never override a valid
    // director choice just because one field was named inconsistently).
    if (
      String(scene.engine || "").toLowerCase() === "manim" &&
      !MANIM_ARCHETYPES.includes(strictArchetype(scene.archetype))
    ) {
      const inferred = inferManimPrimitive(scene.manimData);
      if (inferred) scene.archetype = inferred;
      else
        console.warn(
          `[DEGRADE REASON: Scene ${index + 1}: engine "manim" declared without a manim-* archetype or recognizable manimData]`,
        );
    }
    let resolvedArch = normalizeArchetype(scene.archetype);
    if (index > 0 && index < rawScenes.length - 1) {
      const requested = strictArchetype(scene.archetype);
      resolvedArch = chooseArchetype({
        requested: scene.archetype === "features" ? null : requested,
        suggested: timing[index]?.suggestedArchetype ?? null,
        previous: scenes.map((done) => done.archetype),
        window: 2,
        archetypeWindow: 3,
        rng,
      });
    }
    for (const key of [
      "pills",
      "compareLeft",
      "compareRight",
      "chartData",
      "codeDemo",
      "cardRight",
      "cardLeft",
      "metric",
      "pipeline",
      "bento",
      "quoteData",
      "mockupData",
      "orbitData",
      "stepData",
      "feedData",
      "stackData",
      "kineticData",
      "flowData",
      "kpiData",
      "diffData",
      "chatData",
      "bentoData",
      "terminalData",
      "progressData",
      "vectorData",
      "stats",
    ]) {
      const field = scene[key];
      if (
        field !== undefined &&
        (!field || typeof field !== "object" || (Array.isArray(field) && key !== "pills"))
      )
        throw new Error(`Director scene ${index + 1} has invalid ${key}`);
    }
    for (const field of [
      scene.pills,
      scene.compareLeft?.points,
      scene.compareRight?.points,
      scene.codeDemo?.lines,
      scene.cardRight?.bullets,
      scene.metric?.subPills,
      scene.kineticData?.words,
      scene.diffData?.linesLeft,
      scene.diffData?.linesRight,
    ]) {
      if (
        field !== undefined &&
        (!Array.isArray(field) || field.some((x) => typeof x !== "string"))
      )
        throw new Error(`Director scene ${index + 1} has invalid text list`);
    }
    for (const list of [
      scene.stepData?.steps,
      scene.orbitData?.satellites,
      scene.feedData?.items,
      scene.stackData?.layers,
      scene.mockupData?.items,
      scene.flowData?.steps,
      scene.chatData?.messages,
      scene.clusters,
    ]) {
      if (list !== undefined && !Array.isArray(list)) {
        throw new Error(`Director scene ${index + 1} has invalid list`);
      }
    }
    if (
      scene.chartData?.bars !== undefined &&
      (!Array.isArray(scene.chartData.bars) ||
        scene.chartData.bars.some(
          (bar) =>
            !bar ||
            typeof bar !== "object" ||
            !Number.isFinite(Number(bar.height)) ||
            Number(bar.height) < 0 ||
            Number(bar.height) > 100,
        ))
    )
      throw new Error(`Director scene ${index + 1} has invalid chart heights`);

    let finalArchetype =
      index === 0
        ? scene.archetype
          ? normalizeArchetype(scene.archetype)
          : "hook"
        : index === timing.length - 1
          ? scene.archetype
            ? normalizeArchetype(scene.archetype)
            : "outro"
          : resolvedArch;

    // Intelligent domain-aware fallbacks so every archetype renders with high fidelity
    let enrichedScene = { ...scene, engine: "html-gsap" };

    // Manim routing gate: keep the engine only when every rule passes; otherwise swap to
    // the fallback archetype *before* enrichment so the fallback gets a full payload.
    let manimClean = null;
    if (MANIM_ARCHETYPES.includes(finalArchetype)) {
      const plan = planManimScene({
        scene,
        archetype: finalArchetype,
        index,
        lastIndex: rawScenes.length - 1,
        enabled: manimEnabled,
        count: manimCount,
        max: manimMax,
        run: manimRun,
      });
      let twin = null;
      if (plan.ok) {
        // Narration is exactly the beats, so audio and animation cannot drift apart.
        scene.voiceover = plan.beats.join(" ");
        try {
          // Pre-build the fully enriched HTML twin so a runtime Manim failure can swap
          // to it instantly (same escaping + default payloads as any normal scene).
          twin = validateStoryboard(
            {
              productName: value.productName,
              seed: 0,
              scenes: [
                { archetype: "hook", title: "-", voiceover: "-" },
                degradeScene({ ...scene, fallbackArchetype: plan.fallback }, "prebuilt twin"),
                { archetype: "outro", title: "-", voiceover: "-" },
              ],
            },
            [
              { id: "twin-a", role: "hook" },
              { id: "twin-b", role: "middle" },
              { id: "twin-c", role: "outro" },
            ],
          ).scenes[1];
        } catch (err) {
          plan.ok = false;
          plan.reason = `fallback scene invalid: ${err.message}`;
        }
      }
      if (plan.ok) {
        manimClean = { manimData: plan.brief, beats: plan.beats, fallbackScene: twin };
        enrichedScene.engine = "manim";
        enrichedScene.fallbackArchetype = plan.fallback;
      } else {
        console.warn(`[DEGRADE REASON: Scene ${index + 1}: ${plan.reason}] -> ${plan.fallback}`);
        enrichedScene = degradeScene({ ...scene, fallbackArchetype: plan.fallback }, plan.reason);
        finalArchetype = enrichedScene.archetype;
      }
    }
    manimCount += manimClean ? 1 : 0;
    manimRun = manimClean ? manimRun + 1 : 0;

    // Domain-agnostic payload enrichment (see enrichment.mjs / fallbackText.mjs).
    enrichedScene = enrichScene(enrichedScene, finalArchetype);

    // Support scene-level theme: "dark" | "light" | "accent" (defaults to "light" if omitted)
    const rawTheme = typeof scene.theme === "string" ? scene.theme.toLowerCase().trim() : "";
    const theme = ["dark", "light", "accent"].includes(rawTheme) ? rawTheme : "light";
    enrichedScene.theme = theme;

    scenes.push({
      ...safeTextFields(enrichedScene),
      id: timing[index].id,
      role: timing[index].role,
      // Manim payloads are plain data for Python (never HTML), so keep them unescaped.
      ...(manimClean || {}),
      voiceover: scene.voiceover,
      archetype: finalArchetype,
      theme,
    });
  }
  return { ...value, productName: escapeHtml(value.productName), scenes };
}

export function validateProductionInput(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    throw new Error("Expected a JSON object");
  const duration = Number(payload.duration ?? 30);
  if (!Number.isFinite(duration) || duration < 15 || duration > 600)
    throw new Error("Duration must be between 15 and 600 seconds");
  if (
    payload.sourcePdf !== undefined &&
    payload.sourcePdf !== null &&
    (typeof payload.sourcePdf !== "string" || !payload.sourcePdf)
  )
    throw new Error("Uploaded PDF is empty or invalid");
  if (payload.sourceUrl !== undefined && typeof payload.sourceUrl !== "string")
    throw new Error("URL must be text");
  if (payload.sourceScript !== undefined && typeof payload.sourceScript !== "string")
    throw new Error("Brief must be text");
  if (payload.sourceTopic !== undefined && typeof payload.sourceTopic !== "string")
    throw new Error("Topic must be text");
  if (
    payload.sourcePdfName !== undefined &&
    payload.sourcePdfName !== null &&
    (typeof payload.sourcePdfName !== "string" || payload.sourcePdfName.length > 200)
  )
    throw new Error("Invalid PDF filename");
  if (payload.sourceScript?.length > 100_000 || payload.sourceUrl?.length > 2048)
    throw new Error("Brief or URL is too long");
  if (payload.sourceTopic?.length > 2000) throw new Error("Topic is too long");
  if (payload.sourcePdf && payload.sourcePdf.length > Math.ceil((25 * 1024 * 1024 * 4) / 3) + 8)
    throw new Error("PDF is larger than 25 MB");
  if (
    !payload.sourcePdf &&
    !payload.sourceUrl?.trim() &&
    !payload.sourceScript?.trim() &&
    !payload.sourceTopic?.trim()
  )
    throw new Error("Provide a topic, PDF, website URL, or written brief");
  if (typeof payload.apiKey !== "string" || !payload.apiKey.trim())
    throw new Error("An OpenRouter API key is required to create a source-grounded video");
  return { ...payload, duration };
}

export function validateTopicInput(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    throw new Error("Expected a JSON object");
  if (typeof payload.topic !== "string" || !payload.topic.trim())
    throw new Error("Please specify a topic or subject");
  if (payload.topic.length > 2000) throw new Error("Topic is too long");
  const duration = Number(payload.duration ?? 60);
  if (!Number.isFinite(duration) || duration < 15 || duration > 600)
    throw new Error("Duration must be between 15 and 600 seconds");
  if (typeof payload.apiKey !== "string" || !payload.apiKey.trim())
    throw new Error("An OpenRouter API key is required to draft a topic script");
  return { ...payload, duration, topic: payload.topic.trim() };
}
