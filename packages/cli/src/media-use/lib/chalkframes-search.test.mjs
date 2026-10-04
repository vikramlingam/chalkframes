import { strict as assert } from "node:assert";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { CHALKFRAMES_CLIENT_SOURCE_HEADERS } from "../../audio/scripts/lib/chalkframes.mjs";
import { CHALKFRAMES_CLIENT_SOURCE_ARGV } from "./chalkframes-cli.mjs";
import { chalkframesSearch } from "./chalkframes-search.mjs";

test("tags Chalkframes searches with the shared media-use client source", () => {
  const dir = mkdtempSync(join(tmpdir(), "media-use-chalkframes-search-"));
  const capturePath = join(dir, "argv.log");
  const chalkframesPath = join(dir, "chalkframes");
  const previousPath = process.env.PATH;
  const previousCapturePath = process.env.CHALKFRAMES_CAPTURE_PATH;

  writeFileSync(
    chalkframesPath,
    `#!/bin/sh
printf '%s\\n' "$*" >> "$CHALKFRAMES_CAPTURE_PATH"
printf '%s\\n' '{"data":[{"id":"x"}]}'
`,
  );
  chmodSync(chalkframesPath, 0o755);
  process.env.PATH = `${dir}:${previousPath ?? ""}`;
  process.env.CHALKFRAMES_CAPTURE_PATH = capturePath;

  try {
    const result = chalkframesSearch("audio sounds list", "ocean", { limit: 1 });
    const argv = readFileSync(capturePath, "utf8").trim();

    assert.deepEqual(result, [{ id: "x" }]);
    assert.match(argv, /X-Chalkframes-Client-Source: media-use/);
  } finally {
    if (previousPath === undefined) delete process.env.PATH;
    else process.env.PATH = previousPath;
    if (previousCapturePath === undefined) delete process.env.CHALKFRAMES_CAPTURE_PATH;
    else process.env.CHALKFRAMES_CAPTURE_PATH = previousCapturePath;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("keeps CLI and REST media-use client source headers in lockstep", () => {
  const [entry] = Object.entries(CHALKFRAMES_CLIENT_SOURCE_HEADERS);
  assert.ok(entry);
  const [key, value] = entry;

  assert.equal(CHALKFRAMES_CLIENT_SOURCE_ARGV[1], `${key}: ${value}`);
});
