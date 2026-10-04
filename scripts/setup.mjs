#!/usr/bin/env node
// First-run setup for Chalk Frames. Safe to run repeatedly: every step checks first.
//
//   bun run setup           install whatever is missing
//   bun run setup:manim     also install Manim (optional) into .venv
//   bun run doctor          report only, change nothing
//
// `bun run dev` / `bun run studio` call this with --quiet first, so a fresh clone
// downloads the Kokoro weights and Chrome before the server starts.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const flags = new Set(process.argv.slice(2));
const CHECK = flags.has("--check");
const QUIET = flags.has("--quiet");
const WITH_MANIM = flags.has("--manim");

const IS_WIN = process.platform === "win32";
const VENV_PY = path.join(
  ROOT,
  ".venv",
  IS_WIN ? "Scripts" : "bin",
  IS_WIN ? "python.exe" : "python",
);
const CLI_BIN = path.join(ROOT, "packages", "cli", "bin", "chalkframes.mjs");
const CLI_DIST = path.join(ROOT, "packages", "cli", "dist", "cli.js");
const ENV_FILE = path.join(ROOT, ".env");
const CACHE = path.join(os.homedir(), ".cache", "chalkframes");

const problems = [];
const ok = (msg) => {
  if (!QUIET) console.log(`  ok    ${msg}`);
};
const note = (msg) => console.log(`  ..    ${msg}`);
const bad = (msg, hint) => {
  problems.push(msg);
  console.error(`  FAIL  ${msg}${hint ? `\n        ${hint}` : ""}`);
};
const run = (cmd, argv, opts = {}) =>
  spawnSync(cmd, argv, { cwd: ROOT, encoding: "utf8", ...opts });
const works = (cmd, argv) => run(cmd, argv, { stdio: "ignore" }).status === 0;
const canImport = (py, mods) => works(py, ["-c", `import ${mods}`]);

if (Number(process.versions.node.split(".")[0]) < 22) {
  console.error(`Node.js 22 or newer is required (found ${process.versions.node}).`);
  process.exit(1);
}
if (fs.existsSync(ENV_FILE)) {
  try {
    process.loadEnvFile(ENV_FILE);
  } catch {
    // an unreadable .env is reported by the server, not here
  }
}

function checkTools() {
  const hint =
    process.platform === "darwin"
      ? "brew install ffmpeg"
      : IS_WIN
        ? "winget install Gyan.FFmpeg"
        : "sudo apt-get install ffmpeg";
  for (const tool of ["ffmpeg", "ffprobe"]) {
    if (works(tool, ["-version"])) ok(`${tool} on PATH`);
    else bad(`${tool} not found on PATH`, `install FFmpeg (${hint})`);
  }
}

function buildPackages() {
  if (!fs.existsSync(path.join(ROOT, "node_modules"))) {
    return bad("dependencies are not installed", "run: bun install");
  }
  if (fs.existsSync(CLI_DIST)) return ok("renderer packages built");
  if (CHECK) return bad("renderer packages are not built", "run: bun run setup");
  if (!works("bun", ["--version"])) return bad("bun not found", "install Bun from https://bun.sh");
  note("building renderer packages (first run only, a few minutes)");
  const r = run("bun", ["run", "build"], { stdio: "inherit" });
  if (r.status !== 0) bad("bun run build failed", "scroll up for the error");
  else ok("renderer packages built");
}

function setupPython() {
  const configured = process.env.CHALKFRAMES_PYTHON;
  const mods = "kokoro_onnx, soundfile";
  if (configured) {
    if (canImport(configured, mods)) return ok("Kokoro Python packages (CHALKFRAMES_PYTHON)");
    return bad(
      "CHALKFRAMES_PYTHON lacks kokoro-onnx / soundfile",
      "pip install kokoro-onnx soundfile into it, or unset CHALKFRAMES_PYTHON",
    );
  }
  if (fs.existsSync(VENV_PY) && canImport(VENV_PY, mods))
    return ok("Kokoro Python packages (.venv)");
  if (CHECK) {
    if (canImport("python3", mods)) return ok("Kokoro Python packages (system python3)");
    return bad("kokoro-onnx / soundfile not installed", "run: bun run setup");
  }
  if (canImport("python3", mods)) return ok("Kokoro Python packages (system python3)");

  let base = null;
  for (const candidate of ["python3", "python"]) {
    const r = run(candidate, [
      "-c",
      "import sys;print(sys.version_info[0]*100+sys.version_info[1])",
    ]);
    if (r.status === 0 && Number(r.stdout) >= 310) {
      base = candidate;
      break;
    }
  }
  if (!base) return bad("Python 3.10 or newer not found", "install Python from https://python.org");
  if (!fs.existsSync(VENV_PY)) {
    note("creating .venv");
    if (run(base, ["-m", "venv", ".venv"], { stdio: "inherit" }).status !== 0) {
      return bad("could not create .venv", "on Debian/Ubuntu: sudo apt-get install python3-venv");
    }
  }
  note("installing kokoro-onnx and soundfile with pip");
  const pip = run(VENV_PY, ["-m", "pip", "install", "--quiet", "kokoro-onnx", "soundfile"], {
    stdio: "inherit",
  });
  if (pip.status !== 0 || !canImport(VENV_PY, mods)) {
    return bad(
      "pip install kokoro-onnx soundfile failed",
      "kokoro-onnx supports Python 3.10 to 3.12",
    );
  }
  ok("Kokoro Python packages (.venv)");
}

// Same files and locations that `chalkframes tts` uses, so either path can fill the cache.
const GH = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/";
const WEIGHTS = [
  {
    label: "Kokoro model (~311 MB)",
    file: path.join(CACHE, "tts", "models", "kokoro-v1.0.onnx"),
    url: `${GH}kokoro-v1.0.onnx`,
    size: 325532387,
  },
  {
    label: "Kokoro voices (~27 MB)",
    file: path.join(CACHE, "tts", "voices", "voices-v1.0.bin"),
    url: `${GH}voices-v1.0.bin`,
    size: 28214398,
  },
];

async function download(w) {
  fs.mkdirSync(path.dirname(w.file), { recursive: true });
  const part = `${w.file}.part`;
  try {
    const res = await fetch(w.url, {
      redirect: "follow",
      signal: AbortSignal.timeout(30 * 60_000),
    });
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
    let got = 0;
    let shown = -1;
    const src = Readable.fromWeb(res.body);
    src.on("data", (chunk) => {
      got += chunk.length;
      const pct = Math.floor((got / w.size) * 10) * 10;
      if (pct !== shown) {
        shown = pct;
        process.stdout.write(`\r        ${pct}%`);
      }
    });
    await pipeline(src, fs.createWriteStream(part));
    process.stdout.write("\n");
    if (fs.statSync(part).size !== w.size) throw new Error("download was incomplete");
    fs.renameSync(part, w.file);
  } finally {
    fs.rmSync(part, { force: true });
  }
}

async function setupWeights() {
  for (const w of WEIGHTS) {
    const have = fs.existsSync(w.file) && fs.statSync(w.file).size === w.size;
    if (have) {
      ok(w.label);
      continue;
    }
    if (CHECK) {
      bad(`${w.label} not downloaded`, "run: bun run setup");
      continue;
    }
    note(`downloading ${w.label}`);
    try {
      await download(w);
      ok(w.label);
    } catch (err) {
      bad(`could not download ${w.label}: ${err.message}`, `fetch it manually from ${w.url}`);
    }
  }
}

function setupChrome() {
  const dir = path.join(CACHE, "chrome");
  if (fs.existsSync(dir) && fs.readdirSync(dir).length > 0) return ok("Chrome (cached)");
  if (CHECK || !fs.existsSync(CLI_DIST))
    return note("Chrome not cached yet (fetched on first setup)");
  note("looking for Chrome (downloads one if none is installed)");
  const r = run(process.execPath, [CLI_BIN, "browser", "ensure"], { stdio: "inherit" });
  if (r.status !== 0) bad("could not find or download Chrome", "install Chrome or Chromium");
}

function setupEnvFile() {
  if (!fs.existsSync(ENV_FILE)) {
    if (CHECK) note(".env missing (copy .env.example to .env)");
    else {
      fs.copyFileSync(path.join(ROOT, ".env.example"), ENV_FILE);
      note("created .env from .env.example");
    }
  }
  if (process.env.OPENROUTER_API_KEY) ok("OPENROUTER_API_KEY is set");
  else note("OPENROUTER_API_KEY is not set: add it to .env or paste it in the web UI");
}

function setupManim() {
  const py = process.env.MANIM_PYTHON || (fs.existsSync(VENV_PY) ? VENV_PY : "python3");
  if (WITH_MANIM && !CHECK) {
    if (!fs.existsSync(VENV_PY)) return bad("run `bun run setup` first to create .venv");
    note("installing manim with pip (needs Pango and Cairo system libraries)");
    const pip = run(VENV_PY, ["-m", "pip", "install", "--quiet", "manim"], { stdio: "inherit" });
    if (pip.status !== 0)
      return bad("pip install manim failed", "see https://docs.manim.community");
    const env = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, "utf8") : "";
    if (!/^MANIM_PYTHON=/m.test(env)) fs.appendFileSync(ENV_FILE, `\nMANIM_PYTHON=${VENV_PY}\n`);
    return ok("Manim installed into .venv");
  }
  if (canImport(py, "manim")) ok("Manim available (optional)");
  else note("Manim not installed (optional). Install with: bun run setup:manim");
}

if (!QUIET) console.log("Chalk Frames setup" + (CHECK ? " (check only)" : ""));
checkTools();
buildPackages();
setupPython();
await setupWeights();
setupChrome();
setupEnvFile();
setupManim();

if (problems.length > 0) {
  console.error(
    `\nSetup is incomplete (${problems.length} problem${problems.length > 1 ? "s" : ""}).`,
  );
  process.exit(1);
}
if (!QUIET) console.log("\nReady. Start the app with: bun run dev");
