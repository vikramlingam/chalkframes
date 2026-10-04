/**
 * Domain-agnostic fallback copy.
 *
 * Archetypes sometimes receive no payload from the director. The text we show then must
 * never assert anything about a specific subject, technology or benchmark. Everything here
 * is derived from the scene's own words (title / subtitle / eyebrow / narration) and, when
 * nothing usable can be extracted, falls back to strictly neutral structural tokens.
 */

const STOP_WORDS = new Set(
  (
    "a an and are as at be been but by can did do does for from had has have how if in into is it its " +
    "just more most not of on or other our over per than that the their them then these this those to " +
    "under up use used using via was we were what when where which who why will with you your about also " +
    "each such very new one two"
  ).split(" "),
);

/** Neutral structural tokens, used only when the scene offers no words to reuse. */
export const NEUTRAL_TOKENS = {
  metric: ["Metric A", "Metric B", "Metric C", "Metric D", "Metric E", "Metric F"],
  node: ["Active Node", "Node B", "Node C", "Node D", "Node E", "Node F"],
  state: ["Observed State", "Prior State", "Next State", "Final State", "State E", "State F"],
  target: ["Target Value", "Baseline Value", "Limit Value", "Delta Value", "Value E", "Value F"],
  index: ["Index", "Index B", "Index C", "Index D", "Index E", "Index F"],
  step: ["Stage 1", "Stage 2", "Stage 3", "Stage 4", "Stage 5", "Stage 6"],
};

function titleCase(word) {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function text(value) {
  return typeof value === "string" ? value : "";
}

/** Distinct, meaningful words from the scene's title / eyebrow / subtitle (title first). */
export function contentWords(scene) {
  const source = [scene?.title, scene?.eyebrow, scene?.subtitle].map(text).join(" ");
  const seen = new Set();
  const words = [];
  for (const raw of source.match(/[\p{L}][\p{L}'-]{2,}/gu) || []) {
    const key = raw.toLowerCase();
    if (STOP_WORDS.has(key) || seen.has(key)) continue;
    seen.add(key);
    words.push(titleCase(raw));
    if (words.length >= 12) break;
  }
  return words;
}

/** Numbers literally present in the scene's text. Never invented. */
export function extractNumbers(scene) {
  const source = [scene?.title, scene?.subtitle, scene?.voiceover].map(text).join(" ");
  return (source.match(/\d+(?:[.,]\d+)?/g) || []).slice(0, 6);
}

/** Sentences from subtitle then narration, trimmed to a readable length. */
export function contentSentences(scene) {
  const source = [scene?.subtitle, scene?.voiceover].map(text).join(" ");
  return source
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim().replace(/[.!?]+$/, ""))
    .filter((s) => s.length >= 4)
    .map((s) => (s.length > 64 ? `${s.slice(0, 61).trimEnd()}...` : s));
}

/**
 * One short label for a fallback slot.
 *   role  - one of NEUTRAL_TOKENS' keys, or "caption" for a sentence-length line
 *   index - which slot (0-based) so repeated calls give different labels
 */
export function synthesizeFallbackText(scene, fallbackRole = "metric", index = 0) {
  if (fallbackRole === "caption") {
    const sentence = contentSentences(scene)[index];
    if (sentence) return sentence;
    return index === 0 ? NEUTRAL_TOKENS.state[0] : "";
  }
  const derived = contentWords(scene)[index];
  if (derived) return derived;
  const neutral = NEUTRAL_TOKENS[fallbackRole] || NEUTRAL_TOKENS.metric;
  return neutral[index % neutral.length];
}

export function synthesizeFallbackList(scene, fallbackRole, count, startIndex = 0) {
  return Array.from({ length: count }, (_, k) =>
    synthesizeFallbackText(scene, fallbackRole, startIndex + k),
  );
}

/** A number from the scene's own text, else the slot index (a structural counter). */
export function synthesizeFallbackNumber(scene, index = 0) {
  const found = extractNumbers(scene)[index];
  if (found !== undefined) {
    const parsed = Number(found.replace(",", "."));
    if (Number.isFinite(parsed)) return parsed;
  }
  return index + 1;
}
