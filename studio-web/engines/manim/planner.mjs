/**
 * Palette sanitizer for Manim plans.
 *
 * Chalk Frames palettes use CSS colour syntax (`rgba(255, 255, 255, 0.12)`, 8-digit hex such
 * as `#6366f114`). Manim only understands plain hex / RGB tuples, so every colour is
 * flattened to a solid `#rrggbb` BEFORE plan.json is written. Translucent colours are
 * composited over the palette background, so a 12% white border stays a subtle border
 * instead of turning solid white.
 */

const RGB_RE =
  /^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)(?:\s*,\s*([\d.]+%?))?\s*\)$/i;
const HEX_RE = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

const clamp255 = (n) => Math.min(255, Math.max(0, Math.round(n)));
const toHex = ([r, g, b]) =>
  `#${[r, g, b].map((v) => clamp255(v).toString(16).padStart(2, "0")).join("")}`;

function parseAlpha(raw) {
  if (raw === undefined || raw === null || raw === "") return 1;
  const text = String(raw);
  const value = text.endsWith("%") ? Number(text.slice(0, -1)) / 100 : Number(text);
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 1;
}

/** Returns { rgb:[r,g,b], alpha } or null when the value is not a recognised colour. */
export function parseCssColor(value) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  const hex = HEX_RE.exec(text);
  if (hex) {
    let digits = hex[1];
    if (digits.length <= 4) digits = [...digits].map((c) => c + c).join("");
    const r = parseInt(digits.slice(0, 2), 16);
    const g = parseInt(digits.slice(2, 4), 16);
    const b = parseInt(digits.slice(4, 6), 16);
    const alpha = digits.length === 8 ? parseInt(digits.slice(6, 8), 16) / 255 : 1;
    return { rgb: [r, g, b], alpha };
  }
  const rgb = RGB_RE.exec(text);
  if (rgb)
    return { rgb: [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])], alpha: parseAlpha(rgb[4]) };
  return null;
}

/** Flatten any supported colour to `#rrggbb`, compositing over `backgroundHex`. */
export function toSolidHex(value, backgroundHex = "#000000", fallback = "#ffffff") {
  const parsed = parseCssColor(value);
  if (!parsed) return fallback;
  const bg = parseCssColor(backgroundHex)?.rgb ?? [0, 0, 0];
  const { rgb, alpha } = parsed;
  return toHex(rgb.map((channel, i) => channel * alpha + bg[i] * (1 - alpha)));
}

/** Sanitize every string colour in a palette so Python only ever sees `#rrggbb`. */
export function sanitizePalette(palette) {
  const source = palette && typeof palette === "object" ? palette : {};
  const background = toSolidHex(source.background, "#000000", "#000000");
  const out = {};
  for (const [key, value] of Object.entries(source)) {
    if (typeof value !== "string") continue; // flags such as isDark are not colours
    out[key] = key === "background" ? background : toSolidHex(value, background);
  }
  out.background = background;
  return out;
}
