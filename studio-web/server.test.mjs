import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { writeFile, rm, access } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const renderDir = path.join(repo, "studio-web", "renders");
const projectsDir = path.join(repo, "projects");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function unusedPort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function startServer(t) {
  const port = await unusedPort();
  const childEnv = { ...process.env, PORT: String(port), NODE_ENV: "test" };
  delete childEnv.OPENROUTER_API_KEY;
  const child = spawn(process.execPath, ["studio-web/server.mjs"], {
    cwd: repo,
    env: childEnv,
    stdio: "ignore",
  });
  t.after(() => child.kill());
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 50; i++) {
    try {
      const response = await fetch(`${base}/api/voices`);
      if (response.ok) return base;
    } catch {
      if (child.exitCode !== null) throw new Error(`Studio server exited: ${child.exitCode}`);
    }
    await sleep(100);
  }
  throw new Error("Studio server did not start");
}

async function createJob(base, input) {
  const response = await fetch(`${base}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return { response, body: await response.json() };
}

async function awaitTerminal(base, jobId) {
  const response = await fetch(`${base}/api/events?id=${jobId}`, {
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(response.status, 200);
  let text = "";
  for await (const chunk of response.body) text += Buffer.from(chunk).toString("utf8");
  return text
    .split("\n")
    .filter((line) => line.startsWith("data: "))
    .map((line) => JSON.parse(line.slice(6)));
}

test("video byte-range handling never terminates the server", async (t) => {
  const base = await startServer(t);
  const file = `range-test-${randomBytes(6).toString("hex")}.mp4`;
  await writeFile(path.join(renderDir, file), Buffer.from("0123456789"));
  t.after(() => rm(path.join(renderDir, file), { force: true }));
  for (const [range, status, content] of [
    ["bytes=0-3", 206, "0123"],
    ["bytes=-4", 206, "6789"],
    ["bytes=8-", 206, "89"],
    ["bytes=0-999", 206, "0123456789"],
    ["bytes=abc-def", 416, ""],
    ["bytes=", 416, ""],
    ["items=0-3", 416, ""],
    ["bytes=99999999999999-", 416, ""],
  ]) {
    const response = await fetch(`${base}/renders/${file}`, { headers: { Range: range } });
    assert.equal(response.status, status, range);
    assert.equal(await response.text(), content, range);
  }
  assert.equal((await fetch(`${base}/api/voices`)).status, 200);
});

test("bad PDF fails clearly, replays error, releases slot, and cleans its project", async (t) => {
  const base = await startServer(t);
  const { response, body } = await createJob(base, {
    sourcePdf: Buffer.from("not a PDF").toString("base64"),
    sourcePdfName: "bad.pdf",
    duration: 15,
    apiKey: "test-key",
  });
  assert.equal(response.status, 200);
  const next = await createJob(base, { sourceScript: "A brief", duration: 15, apiKey: "test-key" });
  assert.equal(next.response.status, 429);
  const events = await awaitTerminal(base, body.jobId);
  assert.match(events.at(-1).message, /Could not read the PDF/);
  assert.equal(events.at(-1).status, "error");
  assert.equal((await awaitTerminal(base, body.jobId)).at(-1).status, "error");
  for (let i = 0; i < 30; i++) {
    try {
      await access(path.join(projectsDir, `prod-${body.jobId}`));
    } catch {
      break;
    }
    await sleep(100);
  }
  await assert.rejects(access(path.join(projectsDir, `prod-${body.jobId}`)));
  // A failed job no longer holds the production slot.
  let accepted = false;
  for (let i = 0; i < 20; i++) {
    const attempt = await createJob(base, { sourcePdf: "" });
    if (attempt.response.status === 400) {
      accepted = true;
      break;
    }
    await sleep(100);
  }
  assert.ok(accepted);
});

test("empty PDF, missing source and missing key are rejected synchronously", async (t) => {
  const base = await startServer(t);
  assert.equal((await createJob(base, { sourcePdf: "", apiKey: "test-key" })).response.status, 400);
  assert.equal((await createJob(base, { apiKey: "test-key" })).response.status, 400);
  assert.equal((await createJob(base, { sourceScript: "A brief" })).response.status, 400);
  assert.equal((await fetch(`${base}/api/events?id=not-a-job`)).status, 404);
});

test("unreachable or rejected URL reports an error without creating a generic video", async (t) => {
  const base = await startServer(t);
  const { response, body } = await createJob(base, {
    sourceUrl: "http://127.0.0.1:9/",
    apiKey: "test-key",
    duration: 15,
  });
  assert.equal(response.status, 200);
  const events = await awaitTerminal(base, body.jobId);
  assert.equal(events.at(-1).status, "error");
  assert.match(events.at(-1).message, /private\/local addresses are blocked/);
});

test("foreign browser origins cannot initiate jobs, local browser origins can use the API", async (t) => {
  const base = await startServer(t);
  const blocked = await fetch(`${base}/api/generate`, {
    method: "POST",
    headers: { Origin: "https://attacker.example", "Content-Type": "text/plain" },
    body: JSON.stringify({ sourceScript: "a brief", duration: 15 }),
  });
  assert.equal(blocked.status, 403);
  const allowed = await fetch(`${base}/api/voices`, { headers: { Origin: base } });
  assert.equal(allowed.status, 200);
  assert.equal(allowed.headers.get("access-control-allow-origin"), base);
});

test("prepare-script endpoint validates input synchronously", async (t) => {
  const base = await startServer(t);
  const bad1 = await fetch(`${base}/api/prepare-script`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  assert.equal(bad1.status, 400);

  const bad2 = await fetch(`${base}/api/prepare-script`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic: "Quantum Computing" }), // missing apiKey
  });
  assert.equal(bad2.status, 400);

  const bad3 = await fetch(`${base}/api/prepare-script`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic: "", apiKey: "test-key" }), // empty topic
  });
  assert.equal(bad3.status, 400);
});

test("parseStoryboardJson recovers from common LLM JSON anomalies", async () => {
  const { parseStoryboardJson } = await import("./server.mjs");

  // Code fence + trailing commas + escaped math + prose around the payload.
  const fenced = [
    "Here you go:",
    "```json",
    "{",
    '  "title": "Slope",',
    '  "scenes": [',
    '    {"voiceover": "Compute \\\\frac{dy}{dx} for f(x)=x^2", "pills": ["a", "b",],},',
    "  ],",
    "}",
    "```",
    "Hope this helps!",
  ].join("\n");
  const a = parseStoryboardJson(fenced);
  assert.equal(a.scenes.length, 1);
  assert.equal(a.scenes[0].voiceover, "Compute \\frac{dy}{dx} for f(x)=x^2");
  assert.deepEqual(a.scenes[0].pills, ["a", "b"]);

  // Raw newline and tab inside a string literal, plus an invalid escape such as \( .
  const b = parseStoryboardJson('{"scenes":[{"voiceover":"line one\nline\ttwo \\(x\\)"}]}');
  assert.match(b.scenes[0].voiceover, /line one\nline\ttwo/);

  // Smart quotes used as string delimiters.
  const c = parseStoryboardJson('{\u201ctitle\u201d: \u201cSmart\u201d, "scenes": []}');
  assert.equal(c.title, "Smart");

  // Unescaped inner quotes.
  const d = parseStoryboardJson('{"scenes":[{"voiceover":"He said "hello" to me"}]}');
  assert.equal(d.scenes[0].voiceover, 'He said "hello" to me');

  // Token-limit truncation mid-array and mid-string.
  const truncated =
    '{"title":"T","scenes":[{"voiceover":"one","pills":["x"]},{"voiceover":"two","pills":["y","z';
  const e = parseStoryboardJson(truncated);
  assert.equal(e.scenes.length, 2);
  assert.equal(e.scenes[0].voiceover, "one");

  assert.throws(() => parseStoryboardJson("no json here"), /invalid JSON/);
});

test("api endpoints expose 10 designer palettes and 5 CC0 soundtracks", async (t) => {
  const base = await startServer(t);

  const palRes = await fetch(`${base}/api/palettes`);
  assert.equal(palRes.status, 200);
  const palettes = await palRes.json();

  const requiredPalettes = [
    "braun-industrial",
    "tokyo-metro",
    "broadside-editorial",
    "swiss-international",
    "nordic-fjord",
    "risograph-studio",
    "solarized-amber",
    "kyoto-matcha",
    "bauhaus-dessau",
    "monolith-titanium",
  ];

  for (const id of requiredPalettes) {
    const p = palettes[id];
    assert.ok(p, `Palette ${id} must exist`);
    assert.equal(p.id, id);
    assert.ok(p.name);
    assert.ok(p.description);
    assert.match(p.background, /^#[0-9a-fA-F]{6}$/);
    assert.match(p.card, /^#[0-9a-fA-F]{6}$/);
    assert.match(p.border, /^#[0-9a-fA-F]{6}$/);
    assert.match(p.text, /^#[0-9a-fA-F]{6}$/);
    assert.match(p.textMuted, /^#[0-9a-fA-F]{6}$/);
    assert.match(p.accent, /^#[0-9a-fA-F]{6}$/);
    assert.equal(typeof p.isDark, "boolean");
  }

  const soundRes = await fetch(`${base}/api/soundtracks`);
  assert.equal(soundRes.status, 200);
  const soundtracks = await soundRes.json();
  assert.equal(soundtracks.length, 5);

  const requiredTracks = [
    "quiet-reflection",
    "ambient-drift",
    "minimal-clarity",
    "gentle-pulse",
    "deliberate-thought",
  ];
  for (const trackId of requiredTracks) {
    const track = soundtracks.find((t) => t.id === trackId);
    assert.ok(track, `Track ${trackId} must exist`);
    assert.ok(track.file);
    assert.ok(track.license.includes("CC0") || track.license.includes("Public Domain"));
  }

  // Verify all 5 CC0 tracks are distinct audio files with unique content (no duplicates)
  const crypto = await import("node:crypto");
  const fsPromises = await import("node:fs/promises");
  const hashes = new Set();
  for (const track of soundtracks) {
    const filePath = path.join(repo, "studio-web", "public", "soundtracks", track.file);
    const content = await fsPromises.readFile(filePath);
    const hash = crypto.createHash("sha256").update(content).digest("hex");
    assert.ok(!hashes.has(hash), `Soundtrack ${track.file} must not duplicate another audio file`);
    hashes.add(hash);
  }

  const cfgRes = await fetch(`${base}/api/config`);
  assert.equal(cfgRes.status, 200);
  const cfg = await cfgRes.json();
  assert.ok(cfg.palettes);
  assert.ok(cfg.soundtracks);
  assert.equal(cfg.soundtracks.length, 5);
});
