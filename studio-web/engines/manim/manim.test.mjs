import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { checkManimCapability, scrubbedEnv } from "./capability.mjs";
import { validateManimBrief, validateBeats, validateExpression, beatFrames } from "./schema.mjs";
import { degradeScene } from "./degrade.mjs";
import { runManimScene } from "./runner.mjs";
import { sanitizePalette, toSolidHex, parseCssColor } from "./planner.mjs";
import { normalizeManimClip } from "./normalize.mjs";
import { validateStoryboard } from "../../quality.mjs";
import {
  detectBlankVideo,
  assertNotBlank,
  FPS,
  computeSceneFrames,
  buildFrameTimeline,
  normalizeSegment,
  concatenateSegments,
  assembleMasterAudio,
  muxMasterVideo,
  probeVideo,
} from "../../stitcher.mjs";

const hasFfmpeg = spawnSync("ffmpeg", ["-version"]).status === 0;
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "chalk-manim-test-"));

test("capability probe returns a well-formed report and never throws", async () => {
  const cap = await checkManimCapability({ force: true });
  assert.equal(typeof cap.ok, "boolean");
  assert.ok(Array.isArray(cap.reasons));
  assert.equal(typeof cap.latex, "boolean");
  if (cap.ok) {
    assert.ok(cap.python && cap.manimVersion);
    assert.ok(cap.fonts.sans && cap.fonts.mono);
  } else {
    assert.ok(cap.reasons.length > 0, "a failed probe must say why");
  }
});

test("subprocess environment is scrubbed of API keys", () => {
  process.env.OPENROUTER_API_KEY = "secret-key";
  process.env.TAVILY_API_KEY = "secret-key-2";
  try {
    const env = scrubbedEnv();
    assert.equal(env.OPENROUTER_API_KEY, undefined);
    assert.equal(env.TAVILY_API_KEY, undefined);
    assert.ok(env.PATH);
  } finally {
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.TAVILY_API_KEY;
  }
});

test("expression grammar accepts math and rejects anything executable", () => {
  for (const ok of ["x^2 - 2*x + sin(3*x)", "exp(-x)*cos(pi*x)", "sqrt(abs(x))", "2x"]) {
    assert.equal(validateExpression(ok), ok);
  }
  for (const bad of [
    "__import__('os').system('ls')",
    "open('/etc/passwd')",
    "x; import os",
    "x.__class__",
    "lambda: 1",
    "sin(x",
    "",
    "x".repeat(300),
  ]) {
    assert.throws(() => validateExpression(bad), undefined, `must reject ${bad.slice(0, 30)}`);
  }
});

test("brief validation sanitizes good briefs and rejects malformed ones", () => {
  const plot = validateManimBrief("manim-function-plot", {
    title: "Slope",
    expr: "x^2",
    xRange: [-2, 2],
    tangentAt: "1.5",
  });
  assert.deepEqual(plot.xRange, [-2, 2]);
  assert.equal(plot.tangentAt, 1.5);
  assert.throws(() => validateManimBrief("manim-function-plot", { expr: "x", xRange: [3, 1] }));
  assert.throws(() => validateManimBrief("manim-vector-transform", { matrix: [[1, 2, 3]] }));
  const vt = validateManimBrief("manim-vector-transform", {
    matrix: [
      [9, 0],
      [0, -9],
    ],
  });
  assert.deepEqual(
    vt.matrix,
    [
      [4, 0],
      [0, -4],
    ],
    "matrix entries are clamped into frame",
  );
  const net = validateManimBrief("manim-network-topology", { layers: [3, 4, 2] });
  assert.deepEqual(net.layers, [3, 4, 2]);
  assert.throws(() => validateManimBrief("manim-network-topology", { layers: [3] }));
  assert.throws(() =>
    validateManimBrief("manim-network-topology", { nodes: ["A", "B"], edges: [] }),
  );
  assert.throws(() => validateManimBrief("not-a-primitive", {}));
  assert.throws(() => validateBeats([]));
  assert.deepEqual(validateBeats(["One.", { narration: "Two." }]), ["One.", "Two."]);
});

test("degradeScene swaps to the fallback archetype and keeps narration", () => {
  const scene = {
    id: "scene3",
    archetype: "manim-function-plot",
    engine: "manim",
    title: "Slope",
    voiceover: "A curve.",
    manimData: { expr: "x" },
    beats: ["A curve."],
    fallbackArchetype: "bento-metric-grid",
    fallbackPayload: { bentoData: { metrics: [{ label: "A", value: 1 }] } },
  };
  const out = degradeScene(scene, "render timed out");
  assert.equal(out.engine, "html-gsap");
  assert.equal(out.archetype, "bento-metric-grid");
  assert.equal(out.degraded, true);
  assert.equal(out.voiceover, "A curve.");
  assert.equal(out.manimData, undefined);
  assert.equal(out.beats, undefined);
  assert.equal(out.bentoData.metrics[0].label, "A");
  assert.equal(
    degradeScene({ archetype: "manim-vector-transform" }).archetype,
    "vector-cluster-graph",
  );
});

test("validateStoryboard enforces the Manim routing policy", () => {
  const timing = ["hook", "m", "m", "m", "m", "outro"].map((role, i) => ({ id: `s${i}`, role }));
  const manim = (extra = {}) => ({
    archetype: "manim-function-plot",
    title: "Slope",
    voiceover: "x",
    manimData: { title: "t", expr: "x^2", xRange: [-2, 2] },
    beats: ["One two three.", "Four five."],
    fallbackArchetype: "bento-metric-grid",
    fallbackPayload: { bentoData: { metrics: [{ label: "A", value: 1, unit: "", hero: true }] } },
    ...extra,
  });
  const plain = (archetype, title) => ({ archetype, title, voiceover: title });
  const build = (mid) => ({
    productName: "T",
    seed: 1,
    scenes: [plain("hook", "H"), ...mid, plain("outro", "O")],
  });
  const filler = [
    plain("kinetic-text", "K"),
    plain("stat-spotlight", "S"),
    plain("step-ladder", "L"),
  ];
  const engines = (r) => r.scenes.map((s) => s.engine);
  const on = { manimEnabled: true };

  const ok = validateStoryboard(build([manim(), ...filler]), timing, on);
  assert.deepEqual(engines(ok), [
    "html-gsap",
    "manim",
    "html-gsap",
    "html-gsap",
    "html-gsap",
    "html-gsap",
  ]);
  assert.equal(ok.scenes[1].voiceover, "One two three. Four five.", "voiceover is the beats");
  assert.equal(ok.scenes[1].fallbackScene.engine, "html-gsap");

  const off = validateStoryboard(build([manim(), ...filler]), timing, { manimEnabled: false });
  assert.ok(off.scenes.every((s) => s.engine === "html-gsap"));
  assert.equal(off.scenes[1].archetype, "bento-metric-grid");
  assert.equal(off.scenes[1].degraded, true);

  const noFallback = validateStoryboard(
    build([manim({ fallbackArchetype: "" }), ...filler]),
    timing,
    on,
  );
  assert.equal(noFallback.scenes[1].engine, "html-gsap", "missing fallbackArchetype degrades");
  const noBeats = validateStoryboard(build([manim({ beats: [] }), ...filler]), timing, on);
  assert.equal(noBeats.scenes[1].engine, "html-gsap", "missing beats degrades");
  const badExpr = validateStoryboard(
    build([manim({ manimData: { expr: "__import__('os')", xRange: [0, 1] } }), ...filler]),
    timing,
    on,
  );
  assert.equal(badExpr.scenes[1].engine, "html-gsap", "unsafe expression degrades");

  const flooded = validateStoryboard(build([manim(), manim(), manim(), manim()]), timing, on);
  const kept = engines(flooded).filter((e) => e === "manim").length;
  assert.ok(kept <= 2, `share cap is 40% of 6 scenes (kept ${kept})`);

  const edges = validateStoryboard(
    { productName: "T", seed: 1, scenes: [manim(), ...filler, manim(), manim()] },
    timing,
    on,
  );
  assert.equal(edges.scenes[0].engine, "html-gsap", "scene 1 is always html-gsap");
  assert.equal(edges.scenes.at(-1).engine, "html-gsap", "last scene is always html-gsap");
});

test("integer-frame timing has zero drift over 50 scenes", () => {
  let seed = 12345;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const frames = [];
  for (let i = 0; i < 50; i++) {
    const vo = 1 + rand() * 25;
    const f = computeSceneFrames({ voDuration: vo, targetSec: rand() * 20 });
    assert.ok(Number.isInteger(f) && f >= Math.ceil((vo + 1.2) * FPS - 1e-6));
    frames.push(f);
  }
  const timeline = buildFrameTimeline(frames);
  assert.equal(
    timeline.totalFrames,
    frames.reduce((a, b) => a + b, 0),
  );
  assert.equal(timeline.totalFrames / FPS, timeline.totalSeconds);
  let cursor = 0;
  frames.forEach((f, i) => {
    assert.equal(Math.round(timeline.starts[i] * FPS), cursor, `scene ${i + 1} starts on a frame`);
    cursor += f;
  });
  // Float edge: 6.3 + 1.2 = 7.5s must be exactly 225 frames, not 226.
  assert.equal(computeSceneFrames({ voDuration: 6.3, targetSec: 0 }), 225);
});

test("beat frame allocation sums exactly to the scene length", () => {
  for (const total of [37, 150, 901]) {
    const out = beatFrames(["a b c d e f g", "h i", "j k l m n o p q r s t"], total);
    assert.equal(
      out.reduce((a, b) => a + b, 0),
      total,
    );
    assert.ok(out.every((n) => Number.isInteger(n) && n >= 0));
  }
});

function ff(args) {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args]);
  assert.equal(r.status, 0, r.stderr?.toString());
}

test(
  "stitcher: frame-exact segments, lossless concat, muxed master",
  { skip: !hasFfmpeg },
  async () => {
    const dir = tmp();
    try {
      ff([
        "-f",
        "lavfi",
        "-i",
        "testsrc2=s=320x180:r=24:d=1.7",
        "-c:v",
        "libx264",
        path.join(dir, "a.mp4"),
      ]);
      ff([
        "-f",
        "lavfi",
        "-i",
        "color=c=red:s=640x360:r=30:d=3",
        "-c:v",
        "libx264",
        path.join(dir, "b.mp4"),
      ]);
      ff(["-f", "lavfi", "-i", "sine=f=440:d=2.1", path.join(dir, "v1.wav")]);
      const frames = [61, 95];
      const segs = [];
      for (const [i, name] of ["a", "b"].entries()) {
        const out = path.join(dir, `n${i}.mp4`);
        const info = await normalizeSegment({
          inputPath: path.join(dir, `${name}.mp4`),
          outputPath: out,
          totalFrames: frames[i],
          width: 640,
          height: 360,
        });
        assert.equal(info.frames, frames[i]);
        assert.equal(info.pixFmt, "yuv420p");
        segs.push(out);
      }
      const cat = await concatenateSegments({
        segmentPaths: segs,
        outputVideoPath: path.join(dir, "cat.mp4"),
      });
      assert.equal((await probeVideo(cat)).frames, 156);
      const wav = await assembleMasterAudio({
        sceneWavPaths: [path.join(dir, "v1.wav"), null],
        expectedDurations: frames.map((f) => f / FPS),
        outputWavPath: path.join(dir, "m.wav"),
        leadIn: 0.3,
      });
      const probe = spawnSync("ffprobe", [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "csv=p=0",
        wav,
      ]);
      const audioLen = Number(probe.stdout.toString());
      assert.ok(
        Math.abs(audioLen - 156 / FPS) < 0.002,
        `master audio ${audioLen}s vs ${156 / FPS}s`,
      );
      const final = await muxMasterVideo({
        videoPath: cat,
        audioPath: wav,
        outputPath: path.join(dir, "out.mp4"),
      });
      const streams = spawnSync("ffprobe", [
        "-v",
        "error",
        "-show_entries",
        "stream=codec_type,color_space",
        "-of",
        "csv=p=0",
        final,
      ]).stdout.toString();
      assert.match(streams, /video,bt709/);
      assert.match(streams, /audio/);
      assert.equal((await probeVideo(final)).frames, 156);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  },
);

test(
  "real Manim render lands on exactly totalFrames; failures reject cleanly",
  { timeout: 180_000 },
  async (t) => {
    const cap = await checkManimCapability();
    if (!cap.ok || !hasFfmpeg) return t.skip("Manim not available on this machine");
    const dir = tmp();
    try {
      const palette = {
        background: "#070b09",
        text: "#f0fdf4",
        textMuted: "#7d9e92",
        accent: "#10b981",
        accentDark: "#34d399",
        card: "#0e1813",
        border: "#182b22",
      };
      const base = {
        palette,
        fonts: cap.fonts,
        width: 640,
        height: 360,
        fps: 30,
        totalFrames: 83,
        mediaDir: path.join(dir, "media"),
      };
      const plan = {
        ...base,
        primitive: "manim-network-topology",
        brief: { title: "Net", layers: [2, 3, 2] },
        beatFrames: [40, 43],
        outputPath: path.join(dir, "raw.mp4"),
      };
      await runManimScene({ plan, workDir: path.join(dir, "w"), python: cap.python });
      const clip = await normalizeManimClip({
        inputPath: plan.outputPath,
        outputPath: path.join(dir, "out.mp4"),
        totalFrames: 83,
        width: 640,
        height: 360,
      });
      assert.equal(clip.frames, 83);
      await assert.rejects(
        runManimScene({
          plan: { ...base, primitive: "nope", brief: {}, outputPath: path.join(dir, "x.mp4") },
          workDir: path.join(dir, "w2"),
          python: cap.python,
        }),
        (err) => err.kind === "exit",
      );
      await assert.rejects(
        runManimScene({
          plan: { ...plan, outputPath: path.join(dir, "y.mp4") },
          workDir: path.join(dir, "w3"),
          python: cap.python,
          timeoutMs: 400,
        }),
        (err) => err.kind === "timeout",
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  },
);

test(
  "blank-frame guard rejects flat footage and accepts real content",
  { skip: !hasFfmpeg },
  async () => {
    const dir = tmp();
    try {
      const flat = path.join(dir, "flat.mp4");
      const busy = path.join(dir, "busy.mp4");
      ff([
        "-f",
        "lavfi",
        "-i",
        "color=c=0x0b0d14:s=320x180:r=30:d=3",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        flat,
      ]);
      ff([
        "-f",
        "lavfi",
        "-i",
        "testsrc2=s=320x180:r=30:d=3",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        busy,
      ]);
      assert.equal((await detectBlankVideo(flat)).blank, true);
      assert.equal((await detectBlankVideo(busy)).blank, false);
      await assert.rejects(assertNotBlank(flat, "Scene 2"), (err) => err.kind === "blank");
      await assertNotBlank(busy, "Scene 3");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  },
);

// The palette that broke a real run: resolveScenePalette(dark) emits CSS rgba() tokens.
const CSS_PALETTE = {
  background: "#0b0d14",
  card: "#141724",
  border: "rgba(255, 255, 255, 0.12)",
  text: "#f3f4f8",
  textMuted: "#9ca3af",
  muted: "#9ca3af",
  accent: "#6366f1",
  accentDark: "#a78bfa",
  accentText: "#ffffff",
  glow: "rgba(99, 102, 241, 0.35)",
  isDark: true,
};

test("planner flattens CSS rgba()/8-digit hex palette tokens to solid #rrggbb", () => {
  assert.deepEqual(parseCssColor("rgba(255, 255, 255, 0.12)"), {
    rgb: [255, 255, 255],
    alpha: 0.12,
  });
  assert.equal(parseCssColor("not a colour"), null);
  // 12% white over #0b0d14 = a subtle border, not solid white.
  assert.equal(toSolidHex("rgba(255, 255, 255, 0.12)", "#0b0d14"), "#282a30");
  assert.equal(toSolidHex("rgb(10, 20, 30)"), "#0a141e");
  assert.equal(toSolidHex("#6366f1"), "#6366f1");
  assert.equal(toSolidHex("#abc"), "#aabbcc");
  assert.equal(toSolidHex("garbage", "#000000", "#123456"), "#123456");
  const clean = sanitizePalette(CSS_PALETTE);
  for (const [key, value] of Object.entries(clean)) {
    assert.match(value, /^#[0-9a-f]{6}$/, `${key} must be solid hex (got ${value})`);
  }
  assert.equal(clean.border, "#282a30");
  assert.equal(clean.isDark, undefined, "boolean flags are not colours");
  assert.equal(JSON.stringify(clean).includes("rgba"), false);
});

test(
  "Manim renders with a CSS rgba() palette without ValueError (JS and Python layers)",
  { timeout: 180_000 },
  async (t) => {
    const cap = await checkManimCapability();
    if (!cap.ok || !hasFfmpeg) return t.skip("Manim not available on this machine");
    const dir = tmp();
    try {
      const base = {
        fonts: cap.fonts,
        width: 640,
        height: 360,
        fps: 30,
        totalFrames: 60,
        mediaDir: path.join(dir, "media"),
        primitive: "manim-vector-transform",
        brief: {
          title: "Shear",
          matrix: [
            [1, 1],
            [0, 1],
          ],
          vector: [1, 2],
        },
        beatFrames: [30, 30],
      };
      // Layer 1: sanitized by the JS planner (the production path).
      const sanitized = {
        ...base,
        palette: sanitizePalette(CSS_PALETTE),
        outputPath: path.join(dir, "a.mp4"),
      };
      await runManimScene({ plan: sanitized, workDir: path.join(dir, "wa"), python: cap.python });
      assert.equal((await probeVideo(sanitized.outputPath)).frames, 60);
      // Layer 2: raw rgba() straight to Python. theme.parse_color must absorb it on its own.
      const raw = { ...base, palette: CSS_PALETTE, outputPath: path.join(dir, "b.mp4") };
      await runManimScene({ plan: raw, workDir: path.join(dir, "wb"), python: cap.python });
      assert.equal((await probeVideo(raw.outputPath)).frames, 60);
      const gridless = await detectBlankVideo(raw.outputPath);
      assert.equal(gridless.blank, false, "scene must render visible content");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  },
);
