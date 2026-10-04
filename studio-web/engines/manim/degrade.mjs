/**
 * Degrade a Manim scene to its HTML fallback. Pure and total: it never throws, and the
 * scene keeps its voiceover/title/id so audio timing is unaffected.
 */
import { DEFAULT_FALLBACK } from "./schema.mjs";

const MANIM_ONLY_KEYS = ["manimData", "beats", "fallbackArchetype", "fallbackPayload"];

export function degradeScene(scene, reason = "manim unavailable") {
  // Validated Manim scenes carry a pre-enriched, pre-escaped HTML twin: swap straight to it.
  if (scene.fallbackScene && typeof scene.fallbackScene === "object") {
    const twin = { ...scene.fallbackScene };
    return {
      ...twin,
      id: scene.id ?? twin.id,
      role: scene.role ?? twin.role,
      title: scene.title ?? twin.title,
      voiceover: scene.voiceover ?? twin.voiceover,
      theme: scene.theme ?? twin.theme,
      totalFrames: scene.totalFrames,
      duration: scene.duration,
      engine: "html-gsap",
      degraded: true,
      degradedFrom: scene.archetype,
      degradeReason: String(reason).slice(0, 200),
    };
  }
  const fallback =
    (typeof scene.fallbackArchetype === "string" && scene.fallbackArchetype.trim()) ||
    DEFAULT_FALLBACK[scene.archetype] ||
    "bento-metric-grid";
  const payload =
    scene.fallbackPayload &&
    typeof scene.fallbackPayload === "object" &&
    !Array.isArray(scene.fallbackPayload)
      ? scene.fallbackPayload
      : {};
  const next = { ...scene, ...payload };
  for (const key of MANIM_ONLY_KEYS) delete next[key];
  return {
    ...next,
    engine: "html-gsap",
    archetype: fallback,
    degraded: true,
    degradedFrom: scene.archetype,
    degradeReason: String(reason).slice(0, 200),
  };
}
