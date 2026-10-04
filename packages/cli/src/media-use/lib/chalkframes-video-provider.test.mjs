import { strict as assert } from "node:assert";
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { test } from "node:test";
import { CHALKFRAMES_NOT_AUTHENTICATED_MESSAGE } from "./chalkframes-cli.mjs";
import { AVATAR_VIDEO_SIGNIN_MESSAGE } from "./chalkframes-video-provider.mjs";

function cleanupDownload(localPath) {
  if (
    basename(localPath) === "video.mp4" &&
    basename(dirname(localPath)).startsWith("media-use-chalkframes-video-")
  ) {
    rmSync(dirname(localPath), { recursive: true, force: true });
  } else {
    rmSync(localPath, { force: true });
  }
}

const VIDEO_FIXTURE = Buffer.from("tiny chalkframes video fixture");
let importCount = 0;

async function freshGenerate() {
  importCount += 1;
  const module = await import(`./chalkframes-video-provider.mjs?test=${importCount}`);
  return module.chalkframesVideoGenerate;
}

async function listenVideoServer(t) {
  const server = http.createServer((req, res) => {
    if (req.url !== "/video.mp4") {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, {
      "content-length": VIDEO_FIXTURE.length,
      "content-type": "video/mp4",
    });
    res.end(VIDEO_FIXTURE);
  });
  await new Promise((resolve) => server.listen(0, resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  // Keep the provider URL public; only the test transport reaches the local fixture.
  const url = "https://media.example.com/video.mp4";
  const originalFetch = globalThis.fetch;
  t.mock.method(globalThis, "fetch", (requested, options) => {
    assert.equal(requested, url);
    assert.equal(options.redirect, "manual");
    return originalFetch(`http://127.0.0.1:${address.port}/video.mp4`, options);
  });
  return { server, url };
}

async function listenFailingVideoServer(t) {
  const server = http.createServer((req, res) => {
    res.writeHead(500).end();
  });
  await new Promise((resolve) => server.listen(0, resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  // Keep the provider URL public; only the test transport reaches the local fixture.
  const url = "https://media.example.com/video.mp4";
  const originalFetch = globalThis.fetch;
  t.mock.method(globalThis, "fetch", (requested, options) => {
    assert.equal(requested, url);
    assert.equal(options.redirect, "manual");
    return originalFetch(`http://127.0.0.1:${address.port}/video.mp4`, options);
  });
  return { server, url };
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

async function withFakeChalkframes(options, run) {
  const dir = mkdtempSync(join(tmpdir(), "media-use-chalkframes-video-provider-"));
  const capturePath = join(dir, "argv.log");
  const chalkframesPath = join(dir, "chalkframes");
  const previousEnv = {
    PATH: process.env.PATH,
    CHALKFRAMES_CAPTURE_PATH: process.env.CHALKFRAMES_CAPTURE_PATH,
    CHALKFRAMES_VIDEO_MODE: process.env.CHALKFRAMES_VIDEO_MODE,
    CHALKFRAMES_VIDEO_RESPONSE: process.env.CHALKFRAMES_VIDEO_RESPONSE,
    CHALKFRAMES_DISCOVERY_MODE: process.env.CHALKFRAMES_DISCOVERY_MODE,
    CHALKFRAMES_NO_TELEMETRY: process.env.CHALKFRAMES_NO_TELEMETRY,
  };

  writeFileSync(
    chalkframesPath,
    `#!/bin/sh
printf '%s\\n' "$*" >> "$CHALKFRAMES_CAPTURE_PATH"
case "$*" in
  *"avatar list"*)
    case "$CHALKFRAMES_DISCOVERY_MODE" in
      auth) printf '%s\\n' 'HTTP 401 Unauthorized' >&2; exit 1 ;;
      *) printf '%s\\n' '{"data":[{"avatar_id":"avatar-public-1"}]}' ;;
    esac
    ;;
  *"voice list"*)
    case "$CHALKFRAMES_DISCOVERY_MODE" in
      auth) printf '%s\\n' 'HTTP 401 Unauthorized' >&2; exit 1 ;;
      *) printf '%s\\n' '{"data":[{"voice_id":"voice-starfish-1"}]}' ;;
    esac
    ;;
  *"video create"*)
    case "$CHALKFRAMES_VIDEO_MODE" in
      auth) printf '%s\\n' 'HTTP 401 Unauthorized' >&2; exit 1 ;;
      other) printf '%s\\n' 'provider unavailable' >&2; exit 1 ;;
      *) printf '%s\\n' "$CHALKFRAMES_VIDEO_RESPONSE" ;;
    esac
    ;;
esac
`,
  );
  chmodSync(chalkframesPath, 0o755);
  process.env.PATH = `${dir}:${previousEnv.PATH ?? ""}`;
  process.env.CHALKFRAMES_CAPTURE_PATH = capturePath;
  process.env.CHALKFRAMES_VIDEO_MODE = options.mode ?? "success";
  process.env.CHALKFRAMES_VIDEO_RESPONSE = options.response ?? "";
  process.env.CHALKFRAMES_DISCOVERY_MODE = options.discoveryMode ?? "";
  process.env.CHALKFRAMES_NO_TELEMETRY = "1";

  try {
    return await run({
      invocations: () => readFileSync(capturePath, "utf8").trim().split("\n"),
    });
  } finally {
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    rmSync(dir, { recursive: true, force: true });
  }
}

function bodyFromInvocation(invocation) {
  const marker = " -d ";
  const start = invocation.indexOf(marker);
  assert.notEqual(start, -1);
  return JSON.parse(invocation.slice(start + marker.length));
}

test("downloads a generated avatar video and returns the generated MP4 result", async (t) => {
  const { server, url } = await listenVideoServer(t);
  let localPath;
  try {
    await withFakeChalkframes(
      { response: JSON.stringify({ data: { video_url: url } }) },
      async ({ invocations }) => {
        const chalkframesVideoGenerate = await freshGenerate();
        const intent = "Welcome to the ChalkFrames launch";
        const result = await chalkframesVideoGenerate(intent, {});
        localPath = result?.localPath;
        const calls = invocations();
        const create = calls.find((call) => call.includes("video create"));

        assert.ok(create);
        assert.match(create, /--headers X-Chalkframes-Client-Source: media-use/);
        assert.deepEqual(bodyFromInvocation(create), {
          type: "avatar",
          avatar_id: "avatar-public-1",
          script: intent,
          voice_id: "voice-starfish-1",
        });
        assert.ok(result);
        assert.equal(join(tmpdir(), result.localPath.slice(tmpdir().length + 1)), result.localPath);
        assert.match(result.localPath, /media-use-chalkframes-video-[^/\\]+[/\\]video\.mp4$/);
        if (process.platform !== "win32") {
          assert.equal(statSync(dirname(result.localPath)).mode & 0o777, 0o700);
        }
        assert.deepEqual(result, {
          localPath: result.localPath,
          ext: ".mp4",
          source: "generated",
          metadata: {
            description: intent,
            provider: "chalkframes.video",
            provenance: { prompt: intent },
          },
        });
        assert.deepEqual(readFileSync(result.localPath), VIDEO_FIXTURE);
      },
    );
  } finally {
    if (localPath) cleanupDownload(localPath);
    await closeServer(server);
  }
});

test("tags video creation but not avatar or voice discovery", async (t) => {
  const { server, url } = await listenVideoServer(t);
  let localPath;
  try {
    await withFakeChalkframes(
      { response: JSON.stringify({ data: { video_url: url } }) },
      async ({ invocations }) => {
        const chalkframesVideoGenerate = await freshGenerate();
        const result = await chalkframesVideoGenerate("Header regression guard", {});
        localPath = result?.localPath;
        const calls = invocations();

        assert.equal(calls.length, 3);
        assert.match(calls[0], /^avatar list --ownership public --limit 1$/);
        assert.doesNotMatch(calls[0], /X-Chalkframes-Client-Source/);
        assert.match(calls[1], /^voice list --engine starfish --limit 1$/);
        assert.doesNotMatch(calls[1], /X-Chalkframes-Client-Source/);
        assert.match(calls[2], /video create/);
        assert.match(calls[2], /X-Chalkframes-Client-Source: media-use/);
      },
    );
  } finally {
    if (localPath) cleanupDownload(localPath);
    await closeServer(server);
  }
});

test("uses explicit avatar and voice overrides without discovery", async (t) => {
  const { server, url } = await listenVideoServer(t);
  let localPath;
  try {
    await withFakeChalkframes(
      { response: JSON.stringify({ data: { video_url: url } }) },
      async ({ invocations }) => {
        const chalkframesVideoGenerate = await freshGenerate();
        const result = await chalkframesVideoGenerate("Use my presenter", {
          avatarId: "avatar-override",
          voiceId: "voice-override",
        });
        localPath = result?.localPath;
        const calls = invocations();

        assert.equal(calls.length, 1);
        assert.match(calls[0], /video create/);
        assert.deepEqual(bodyFromInvocation(calls[0]), {
          type: "avatar",
          avatar_id: "avatar-override",
          script: "Use my presenter",
          voice_id: "voice-override",
        });
      },
    );
  } finally {
    if (localPath) cleanupDownload(localPath);
    await closeServer(server);
  }
});

test("caches discovered avatar and voice IDs for the process", async (t) => {
  const { server, url } = await listenVideoServer(t);
  const localPaths = new Set();
  try {
    await withFakeChalkframes(
      { response: JSON.stringify({ data: { video_url: url } }) },
      async ({ invocations }) => {
        const chalkframesVideoGenerate = await freshGenerate();
        for (const intent of ["First avatar video", "Second avatar video"]) {
          const result = await chalkframesVideoGenerate(intent, {});
          if (result) localPaths.add(result.localPath);
        }
        const calls = invocations();

        assert.equal(calls.filter((call) => call.startsWith("avatar list ")).length, 1);
        assert.equal(calls.filter((call) => call.startsWith("voice list ")).length, 1);
        assert.equal(calls.filter((call) => call.includes("video create")).length, 2);
      },
    );
  } finally {
    for (const localPath of localPaths) cleanupDownload(localPath);
    await closeServer(server);
  }
});

test("prints auth onboarding and reports an unauthenticated create failure", async (t) => {
  const errors = [];
  t.mock.method(console, "error", (message) => errors.push(message));

  await withFakeChalkframes({ mode: "auth" }, async () => {
    const chalkframesVideoGenerate = await freshGenerate();
    const result = await chalkframesVideoGenerate("Sign-in failure", {
      avatarId: "avatar-override",
      voiceId: "voice-override",
    });

    assert.equal(result, null);
    assert.ok(errors.includes(AVATAR_VIDEO_SIGNIN_MESSAGE));
    assert.ok(errors.includes(CHALKFRAMES_NOT_AUTHENTICATED_MESSAGE));
  });
});

test("reports other create failures without auth onboarding", async (t) => {
  const errors = [];
  t.mock.method(console, "error", (message) => errors.push(message));

  await withFakeChalkframes({ mode: "other" }, async () => {
    const chalkframesVideoGenerate = await freshGenerate();
    const result = await chalkframesVideoGenerate("Provider failure", {
      avatarId: "avatar-override",
      voiceId: "voice-override",
    });

    assert.equal(result, null);
    assert.ok(!errors.includes(AVATAR_VIDEO_SIGNIN_MESSAGE));
    assert.ok(errors.includes("media-use: `chalkframes video create` failed: provider unavailable"));
  });
});

test("falls through on non-JSON and error responses", async (t) => {
  t.mock.method(console, "error", () => {});

  for (const response of ["not JSON", '{"error":{"message":"render failed"}}']) {
    await withFakeChalkframes({ response }, async () => {
      const chalkframesVideoGenerate = await freshGenerate();
      const result = await chalkframesVideoGenerate("Unusable response", {
        avatarId: "avatar-override",
        voiceId: "voice-override",
      });

      assert.equal(result, null);
    });
  }
});

test("onboards and returns null when avatar/voice discovery itself is unauthenticated", async (t) => {
  const errors = [];
  t.mock.method(console, "error", (message) => errors.push(message));

  // Both avatar list AND voice list would fail unauthenticated (discoveryMode
  // "auth" applies to both in the fake CLI) -- the short-circuit after the
  // first failure must mean only one is ever attempted, so the onboarding
  // message and the provider-error telemetry ping each fire exactly once
  // instead of double-firing for what's really one auth failure.
  await withFakeChalkframes({ discoveryMode: "auth" }, async ({ invocations }) => {
    const chalkframesVideoGenerate = await freshGenerate();
    const result = await chalkframesVideoGenerate("Discovery auth failure", {});

    assert.equal(result, null);
    assert.equal(
      errors.filter((message) => message === AVATAR_VIDEO_SIGNIN_MESSAGE).length,
      1,
      "onboarding message must fire exactly once, not once per failed discovery call",
    );
    const calls = invocations();
    assert.equal(calls.length, 1, "must short-circuit after the first discovery failure");
    assert.match(calls[0], /^avatar list /);
  });
});

test("download failure after a successful create returns null and logs a diagnostic", async (t) => {
  const { server, url } = await listenFailingVideoServer(t);
  try {
    await withFakeChalkframes({ response: JSON.stringify({ data: { video_url: url } }) }, async () => {
      const chalkframesVideoGenerate = await freshGenerate();
      const result = await chalkframesVideoGenerate("Download failure", {
        avatarId: "avatar-override",
        voiceId: "voice-override",
      });

      assert.equal(result, null);
    });
  } finally {
    await closeServer(server);
  }
});

test("uses private unique downloads even when time is fixed and the old name is planted", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "hf-video-temp-test-"));
  const previousTmpdir = process.env.TMPDIR;
  process.env.TMPDIR = root;
  t.mock.method(Date, "now", () => 123456);
  t.mock.method(globalThis, "fetch", async () => ({
    ok: true,
    headers: { get: () => "4" },
    body: [Buffer.from("new!")],
  }));
  try {
    const victim = join(root, "victim");
    writeFileSync(victim, "unchanged");
    symlinkSync(victim, join(root, `media-use-chalkframes-video-${process.pid}-123456.mp4`));
    await withFakeChalkframes(
      { response: JSON.stringify({ data: { video_url: "https://example.invalid/video.mp4" } }) },
      async () => {
        const generate = await freshGenerate();
        const first = await generate("First", { avatarId: "a", voiceId: "v" });
        const second = await generate("Second", { avatarId: "a", voiceId: "v" });
        assert.ok(first && second);
        assert.notEqual(first.localPath, second.localPath);
        assert.equal(readFileSync(first.localPath, "utf8"), "new!");
        assert.equal(readFileSync(second.localPath, "utf8"), "new!");
        assert.equal(readFileSync(victim, "utf8"), "unchanged");
      },
    );
  } finally {
    if (previousTmpdir === undefined) delete process.env.TMPDIR;
    else process.env.TMPDIR = previousTmpdir;
    rmSync(root, { recursive: true, force: true });
  }
});

test("removes private download staging on failure while returning null", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "hf-video-temp-fail-"));
  const previousTmpdir = process.env.TMPDIR;
  process.env.TMPDIR = root;
  t.mock.method(globalThis, "fetch", async () => {
    throw new Error("download failed");
  });
  t.mock.method(console, "error", () => {});
  try {
    await withFakeChalkframes(
      { response: JSON.stringify({ data: { video_url: "https://example.invalid/video.mp4" } }) },
      async () => {
        const generate = await freshGenerate();
        assert.equal(await generate("Failure", { avatarId: "a", voiceId: "v" }), null);
      },
    );
    assert.deepEqual(readdirSync(root), []);
  } finally {
    if (previousTmpdir === undefined) delete process.env.TMPDIR;
    else process.env.TMPDIR = previousTmpdir;
    rmSync(root, { recursive: true, force: true });
  }
});
