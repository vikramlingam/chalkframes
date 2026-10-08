import { test } from "node:test";
import assert from "node:assert/strict";
import { screenManimCode, MAX_CODE_CHARS } from "./codeguard.mjs";
import { repairAndRender, MAX_REPAIR_ATTEMPTS } from "./repair.mjs";

const GOOD = `def run(scene, theme, brief, budget, beats):
    dot = Dot(color=theme.accent)
    run_stage(budget, beats[0], FadeIn(dot))
    budget.fill()`;

test("codeguard accepts well-formed run() code", () => {
  assert.deepEqual(screenManimCode(GOOD), []);
});

test("codeguard rejects imports, exec/eval/open, dunders, private attrs and async", () => {
  const bad = {
    import: "import os\ndef run(scene, theme, brief, budget, beats):\n    pass",
    from: "from os import system\ndef run(scene, theme, brief, budget, beats):\n    pass",
    exec: "def run(scene, theme, brief, budget, beats):\n    exec('x')",
    eval: "def run(scene, theme, brief, budget, beats):\n    eval('1')",
    open: "def run(scene, theme, brief, budget, beats):\n    open('/etc/passwd')",
    dunder: "def run(scene, theme, brief, budget, beats):\n    x = ().__class__",
    private: "def run(scene, theme, brief, budget, beats):\n    scene._hidden()",
    getattr: "def run(scene, theme, brief, budget, beats):\n    getattr(scene, '_x')",
    async: "async def run(scene, theme, brief, budget, beats):\n    pass",
  };
  for (const [name, code] of Object.entries(bad)) {
    assert.ok(screenManimCode(code).length > 0, `${name} must be rejected`);
  }
});

test("codeguard requires run() and bounds length; comments do not trigger rules", () => {
  assert.ok(screenManimCode("x = 1").some((p) => p.includes("run(")));
  assert.ok(screenManimCode("a".repeat(MAX_CODE_CHARS + 1)).some((p) => p.includes("exceeds")));
  const commented = `def run(scene, theme, brief, budget, beats):\n    # import os is only a comment\n    budget.fill()`;
  assert.deepEqual(screenManimCode(commented), []);
});

test("repairAndRender reports every attempt when no repair is produced", async () => {
  const saved = process.env.OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  try {
    let renders = 0;
    const out = await repairAndRender({
      code: "broken",
      initialError: "boom",
      apiKey: "",
      render: async () => {
        renders++;
      },
    });
    assert.equal(renders, 0, "nothing renders without a repair candidate");
    assert.equal(out.ok, false);
    assert.equal(out.attempts.length, 1);
    assert.match(out.attempts[0].reason, /no repair produced/);
    assert.ok(MAX_REPAIR_ATTEMPTS >= 1 && MAX_REPAIR_ATTEMPTS <= 3, "attempts stay bounded");
  } finally {
    if (saved !== undefined) process.env.OPENROUTER_API_KEY = saved;
  }
});
