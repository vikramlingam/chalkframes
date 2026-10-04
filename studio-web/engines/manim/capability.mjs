/**
 * Manim capability probe. Answers one question once per process: "can this machine
 * render a Chalk Frames Manim primitive?" Never throws; failure just disables the engine
 * so every Manim scene degrades to its HTML fallback.
 */
import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const PY_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "py");

const SANS_FONTS = ["Inter", "Helvetica Neue", "Arial", "DejaVu Sans"];
const MONO_FONTS = ["JetBrains Mono", "Menlo", "DejaVu Sans Mono", "Courier New"];

export function which(name, env = process.env) {
  for (const dir of (env.PATH || "").split(path.delimiter)) {
    if (!dir) continue;
    const candidate = path.join(dir, name);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      if (fs.statSync(candidate).isFile()) return candidate;
    } catch {
      // keep scanning PATH
    }
  }
  return null;
}

function interpreterFromShebang(scriptPath) {
  try {
    const first = fs.readFileSync(scriptPath, "utf8").split("\n", 1)[0];
    if (!first.startsWith("#!")) return null;
    const parts = first.slice(2).trim().split(/\s+/);
    const exe = path.basename(parts[0]) === "env" ? which(parts[1] || "") : parts[0];
    return exe && fs.existsSync(exe) ? exe : null;
  } catch {
    return null;
  }
}

/** MANIM_PYTHON wins; otherwise the interpreter behind `manim` on PATH; otherwise python3. */
export function resolveManimPython(env = process.env) {
  if (env.MANIM_PYTHON) return env.MANIM_PYTHON;
  const manimBin = which("manim", env);
  return (manimBin && interpreterFromShebang(manimBin)) || which("python3", env);
}

/** Environment for Manim children: no API keys, only what Python/Pango/LaTeX need. */
export function scrubbedEnv(extra = {}) {
  const keep = ["PATH", "HOME", "TMPDIR", "LANG", "LC_ALL", "USER"];
  const env = {};
  for (const key of keep) if (process.env[key]) env[key] = process.env[key];
  env.HOME ||= os.homedir();
  return {
    ...env,
    PYTHONPATH: PY_DIR,
    PYTHONUNBUFFERED: "1",
    PYTHONDONTWRITEBYTECODE: "1",
    ...extra,
  };
}

const PROBE_SOURCE = [
  "import json, manim, manimpango, chalk_manim",
  "print(json.dumps({'v': manim.__version__, 'fonts': sorted(set(manimpango.list_fonts()))}))",
].join("\n");

let cached = null;

async function probe() {
  const reasons = [];
  const python = resolveManimPython();
  const latex = Boolean(which("pdflatex"));
  const result = { ok: false, python, manimVersion: null, latex, fonts: {}, reasons };
  if (!python) {
    reasons.push("no Python interpreter found (set MANIM_PYTHON)");
    return result;
  }
  if (!which("ffmpeg") || !which("ffprobe")) reasons.push("ffmpeg/ffprobe not on PATH");
  try {
    const { stdout } = await execFileAsync(python, ["-c", PROBE_SOURCE], {
      env: scrubbedEnv(),
      timeout: 30_000,
    });
    const info = JSON.parse(stdout.trim().split("\n").pop());
    const installed = new Set(info.fonts);
    result.manimVersion = info.v;
    result.fonts = {
      sans: SANS_FONTS.find((f) => installed.has(f)) || null,
      mono: MONO_FONTS.find((f) => installed.has(f)) || null,
    };
    if (!result.fonts.sans) reasons.push("no supported sans font installed");
    if (!result.fonts.mono) reasons.push("no supported monospace font installed");
  } catch (err) {
    reasons.push(`manim import failed: ${String(err.message).split("\n")[0].slice(0, 160)}`);
  }
  // pdflatex is reported but not required: primitives render plain Text, never LaTeX.
  result.ok = reasons.length === 0;
  return result;
}

/** Cached probe. Pass { force: true } to re-run (tests). */
export function checkManimCapability({ force = false } = {}) {
  if (force || !cached) cached = probe();
  return cached;
}
