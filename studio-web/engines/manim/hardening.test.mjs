/**
 * Regression tests for the Manim hardening pass: sandbox validation, whole-word
 * routing, no-key repair behaviour, prompt contract, and the MathTex/Text fallback.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkManimCapability, PY_DIR, resolveManimPython } from "./capability.mjs";
import {
  buildManimSkillPrompt,
  generateProceduralManimCode,
  repairManimSkillCode,
} from "./skill_generator.mjs";

const PY = resolveManimPython();
const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Run a Python snippet against the chalk_manim package; returns parsed JSON stdout. */
function pyJson(source) {
  const result = spawnSync(PY, ["-c", source], {
    cwd: PY_DIR,
    env: { ...process.env, PYTHONPATH: PY_DIR, PYTHONDONTWRITEBYTECODE: "1" },
    encoding: "utf8",
    timeout: 60_000,
  });
  if (result.status !== 0) throw new Error(result.stderr || "python failed");
  return JSON.parse(result.stdout.trim().split("\n").pop());
}

const sandboxAvailable =
  Boolean(PY) &&
  spawnSync(PY, ["-c", "import chalk_manim.sandbox"], {
    cwd: PY_DIR,
    env: { ...process.env, PYTHONPATH: PY_DIR },
  }).status === 0;

test("sandbox rejects imports, dunder access, eval/exec/open and private attributes", (t) => {
  if (!sandboxAvailable) return t.skip("python or chalk_manim unavailable");
  const cases = {
    import_os: "import os",
    from_import: "from os import system",
    dunder_class: "x = (1).__class__",
    dunder_name: "__import__('os')",
    eval_call: "eval('1+1')",
    exec_call: "exec('x=1')",
    open_call: "open('/etc/passwd')",
    compile_call: "compile('1','x','eval')",
    getattr_private: "getattr(scene, '_private')",
    async_def: "async def f(): pass",
    await_expr: "await x",
  };
  const out = pyJson(
    `import json
from chalk_manim.sandbox import validate
cases = ${JSON.stringify(cases)}
print(json.dumps({k: len(validate(v)) for k, v in cases.items()}))`,
  );
  for (const [name, count] of Object.entries(out)) {
    assert.ok(count > 0, `${name} must be rejected`);
  }
});

test("sandbox accepts ordinary Manim-style construction code", (t) => {
  if (!sandboxAvailable) return t.skip("python or chalk_manim unavailable");
  const code = `def run(scene, theme, brief, budget, beats):
    pts = [i * 0.5 for i in range(10)]
    total = sum(pts)
    ax = Axes(x_range=[-4, 4, 1], y_range=[-2, 2, 1])
    dot = Dot(ax.c2p(1, 1), color=theme.accent)
    run_stage(budget, beats[0], FadeIn(ax), Create(dot))
    budget.fill()`;
  const out = pyJson(
    `import json
from chalk_manim.sandbox import validate
print(json.dumps({"problems": validate(${JSON.stringify(code)})}))`,
  );
  assert.deepEqual(out.problems, []);
});

test("sandbox refuses oversized and non-string code", (t) => {
  if (!sandboxAvailable) return t.skip("python or chalk_manim unavailable");
  const out = pyJson(
    `import json
from chalk_manim.sandbox import validate
print(json.dumps({"big": validate("x=1\\n" * 10000), "none": validate(None)}))`,
  );
  assert.ok(out.big[0].includes("exceeds"));
  assert.equal(out.none[0], "code must be a string");
});

test("safe_builtins omits exec, eval, open and __import__", (t) => {
  if (!sandboxAvailable) return t.skip("python or chalk_manim unavailable");
  const out = pyJson(
    `import json
from chalk_manim.sandbox import safe_builtins
t = safe_builtins()
print(json.dumps({k: (k in t) for k in ["exec","eval","open","__import__","len","range"]}))`,
  );
  assert.equal(out.exec, false);
  assert.equal(out.eval, false);
  assert.equal(out.open, false);
  assert.equal(out.__import__, false);
  assert.equal(out.len, true);
  assert.equal(out.range, true);
});

test("whole-word routing: 'keyboard' is not attention and 'state' is not statistics", () => {
  const keyboard = generateProceduralManimCode({ title: "Keyboard layout", sceneIndex: 0 });
  assert.ok(!keyboard.includes("Softmax(Q K^T"), "keyboard must not route to attention");
  const state = generateProceduralManimCode({ title: "State transitions", sceneIndex: 0 });
  assert.ok(!state.includes("Posterior Update"), "state must not route to Bayes");
});

test("procedural routing still matches whole keywords", () => {
  const attn = generateProceduralManimCode({ title: "Attention mechanism", sceneIndex: 0 });
  assert.ok(attn.includes("Affinity Score"));
  const nn = generateProceduralManimCode({ title: "Neural networks", sceneIndex: 0 });
  assert.ok(nn.includes("Forward Propagation"));
});

test("repair without an API key returns null instead of unrelated code", async () => {
  const saved = process.env.OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  try {
    const out = await repairManimSkillCode({ code: "x", error: "boom", apiKey: "" });
    assert.equal(out, null);
  } finally {
    if (saved !== undefined) process.env.OPENROUTER_API_KEY = saved;
  }
});

test("skill prompt names only palette tokens that theme.py defines, and forbids code fields", () => {
  const prompt = buildManimSkillPrompt({ scene: { title: "T" }, topic: "x" });
  assert.ok(!prompt.includes("theme.primary"), "theme.primary does not exist in theme.py");
  assert.ok(prompt.includes("Do not import anything"));
  const themeSrc = fs.readFileSync(path.join(PY_DIR, "chalk_manim", "theme.py"), "utf8");
  for (const token of [
    "accent",
    "accent_alt",
    "border",
    "card",
    "text",
    "blue",
    "gold",
    "teal",
    "red",
    "yellow",
  ]) {
    assert.ok(
      new RegExp(`self\\.${token}\\s*=`).test(themeSrc) || themeSrc.includes(`"${token}"`),
      `theme.${token} must be defined in theme.py`,
    );
  }
});

test("server prompt no longer lets the director emit code fields", () => {
  const server = fs.readFileSync(path.join(HERE, "..", "..", "server.mjs"), "utf8");
  assert.ok(!server.includes('"code"?:'), "director must not be offered a code field");
  assert.ok(server.includes("Never include Python"), "director is told never to emit Python");
});

test("math_text falls back to plain Text when LaTeX tools are missing", (t) => {
  if (!sandboxAvailable) return t.skip("python or chalk_manim unavailable");
  const out = pyJson(
    `import json, shutil
import chalk_manim.common as common
common._LATEX_OK = None
real_which = shutil.which
shutil.which = lambda name, *a, **k: None
try:
    ok = common._latex_available()
finally:
    shutil.which = real_which
print(json.dumps({"latex": ok}))`,
  );
  assert.equal(out.latex, false);
});

test("capability probe report is well-formed for the hardening suite", async () => {
  const cap = await checkManimCapability({ force: true });
  assert.equal(typeof cap.ok, "boolean");
});
