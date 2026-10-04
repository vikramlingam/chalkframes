# HyperFrames — Studio One (fork)

> **Write HTML. Render video.** This is a personal fork of
> [heygen-com/hyperframes](https://github.com/heygen-com/hyperframes) that adds
> **Studio One** — a zero-setup web UI that turns a URL, a script, or a PDF into a
> fully narrated, motion-designed MP4 in one click.

> Upstream's original `README.md` is untouched. This file documents _your_ version only.

---

## What is new in this fork

Studio One lives in **`studio-web/`**. The upstream `packages/` workspace remains unmodified.

|                                      |                                                                                                 |
| ------------------------------------ | ----------------------------------------------------------------------------------------------- |
| **`studio-web/server.mjs`**          | Node HTTP server: AI directing → storyboard → TTS → composition authoring → validation → render |
| **`studio-web/public/`**             | Single-page UI (`index.html`, `app.js`, `style.css`) with live SSE pipeline telemetry           |
| **`studio-web/public/samples/`**     | 7 Kokoro TTS voice previews                                                                     |
| **`studio-web/public/soundtracks/`** | 5 bundled background tracks                                                                     |
| **`projects/`**                      | Generated output — one `prod-video_*` dir per job (composition HTML + VO + SFX + BGM)           |
| **`studio-web/renders/`**            | Finished MP4s                                                                                   |

**Pipeline:** ingest (URL / script / PDF) → OpenRouter "director" produces a
JSON storyboard → Kokoro TTS per scene → FFmpeg soundtrack master → archetype
HTML authoring → `hyperframes check` gate → `hyperframes render` → MP4.

**Design decision worth knowing:** the LLM chooses a **visual archetype** per
scene (`split-comparison`, `architecture-pipeline`, `metric-stat`, `code-terminal`,
`data-graph`, `bento-grid`, `quote-callout`, `features-cards`, `hook`, `outro`),
so scenes don't all look alike. Durations are then re-timed from the _measured_
voiceover length, not the LLM's guess.

**Source-grounded generation requires an OpenRouter API key.** The old offline
fallback ignored the uploaded document and narrated unrelated marketing claims;
it has been disabled rather than delivering a misleading video. Rendering and
speech synthesis still happen locally.

---

## Requirements

- **bun** ≥ 1.4 · **Node.js** ≥ 22 · **ffmpeg + ffprobe** on `PATH`
- **Chrome/Chromium** — the `hyperframes check` gate and `render` need it
- **Kokoro TTS** — install `kokoro-onnx` and `soundfile` in Python; if several
  Python installs exist, set `HYPERFRAMES_PYTHON=/path/to/python-with-kokoro`
- An **OpenRouter API key** with access to the model selected in the UI

## Quickstart

```bash
bun install                 # installs workspace + pdf-parse
bun run build               # builds packages/* (see upstream sdk-playground caveat below)
HYPERFRAMES_PYTHON=/path/to/python-with-kokoro bun run dev
# open http://localhost:4000
```

Open <http://localhost:4000>, paste an OpenRouter key (stored in
`localStorage`), drop in a URL/script/PDF, hit **Produce Video**.

<details>
<summary>Other scripts</summary>

```bash
bun run dev:monorepo        # upstream React Studio (packages/studio)
bun run studio              # alias for dev
bun run test                # full workspace test suite
node --test studio-web/*.test.mjs # Studio One regression tests
bun run lint                # oxlint + workspace contract checks
bun run format              # oxfmt .
```

</details>

## Project layout

```
studio-web/
  server.mjs            # the whole backend
  public/               # UI + voice samples + soundtracks
  renders/              # output MP4s (gitignored)
projects/               # generated projects (per-job HTML + audio)
packages/               # upstream, unmodified
```

## Configuration

| Env    | Default | Notes |
| ------ | ------- | ----- |
| `PORT` | `4000`  |       |

Voices, models, and palettes are hardcoded lists in `server.mjs`
(`VOICES`, `MODELS`, `PALETTES`) — the palette set is WCAG-AA-audited.

---

## Known issues

Everything in this section was found by a full audit and has since been **fixed**.
Kept as a record of what was wrong and why the fixes matter.

### Fixed — correctness

1. **PDF upload was silently broken.** `pdf-parse` v2 has no callable default
   export, so `pdfParse(buffer)` threw `TypeError`; the `catch` swallowed it into
   a "warning" and the pipeline rendered with _no content_. Now binds the v2
   `PDFParse` class (`new PDFParse({ data })` → `getText()` → `destroy()`), and
   validates the `%PDF-` magic bytes, non-empty buffer, and a 25 MB cap. A PDF
   with no extractable text now raises a clear error instead of rendering empty.
   **Verified end-to-end:** `PDF parsed — 7 words extracted`.
2. **Default music engine was invalid.** `musicEngine = "studio-acoustic"` was
   never a `SOUNDTRACK_MAP` key, so every video silently used _Soothing Ambient_.
   Default is now `soothing-ambient`, and an unknown engine logs a warning.
3. **Duplicate audio track (10 of 15 older projects).** `whoosh` and `chime`
   overlapped on track 2. Current source already puts chimes on track 3 —
   **verified: newly generated projects lint with 0 errors, 0 warnings.** The old
   `projects/` folders predate that fix.
4. **Hardcoded `/opt/homebrew/bin/ffprobe`.** Now resolved from `PATH`, so the
   pipeline works on Intel Macs and Linux too.
5. **Non-unique job IDs.** `video_${Date.now()}` could collide for two requests
   in the same millisecond. Now `video_${Date.now()}_${random}`.

### Fixed — security

6. **Server was exposed to the whole LAN.** `listen(PORT)` with no host bound
   `0.0.0.0` — verified reachable at `http://192.168.1.2:4000`. Now binds
   `127.0.0.1` by default (override with `HOST`).
7. **Wildcard CORS + unauthenticated `POST /api/generate`** meant any webpage you
   visited could drive the pipeline and spend your OpenRouter credits. CORS is now
   same-origin only.
8. **Shell injection.** Every `execAsync` template string is gone; `ffmpeg`,
   `ffprobe`, and the `hyperframes` CLI now run via `execFile`/`spawn` with
   argument arrays. Narration text is never interpreted by a shell.
9. **SSRF.** The URL field is validated (`http`/`https` only) and refuses
   loopback, link-local, and RFC1918 private targets.
10. **Unbounded request body.** Capped at 40 MB → `413` instead of buffering an
    arbitrary payload into RAM.

### Fixed — repo hygiene

11. **`bun run lint` failed (exit 1)** — 5 `no-unused-vars` in your files. Removed.
    `bunx oxlint .` now reports **0 errors, 0 warnings**.
12. **`oxfmt --check` failed** on all 5 files. Reformatted — now clean.
13. **`projects/` (348 MB) and `studio-web/renders/` were not gitignored** — a
    `git add -A` would have staged 482 files / ~375 MB. Now ignored.
14. **`pdf-parse` was in `dependencies`**; moved to `devDependencies` (it only
    backs the local dev server).

### Still open (needs your decision)

15. **Pre-existing upstream build failure.** `bun run build` fails at
    `@hyperframes/sdk-playground` (`ERR_UNKNOWN_FILE_EXTENSION ".ts"`).
    `packages/` is untouched by this fork, so this is inherited from upstream —
    it is not caused by Studio One.
16. **Upstream test suite failures** occur in the untouched `packages/` workspace
    on this machine. The parallel `bun run test` run failed in studio-server,
    producer, core, cli, engine and studio; this is not a passing full-suite gate.
    Studio One's own `node --test studio-web/*.test.mjs` regression suite passes.
17. **Bundled audio licensing.** The 5 MP3 soundtracks and 7 Kokoro voice WAVs
    ship with no attribution or license file. Add provenance before publishing.
18. **`knip` reports 240 unused files** — all upstream noise, none from Studio One.

### Further hardening after the follow-up audit

- Video Range requests now support suffix/open-ended ranges and return `416` for
  invalid ranges instead of crashing the process.
- Studio One admits one production at a time (`429` with `Retry-After` when
  busy); the slot stays reserved through encoding, not just until it starts.
- SSE events are replayed to late clients; failed jobs clean up their incomplete
  project directories. Previously created projects are not removed automatically.
- Corrupt PDFs and blocked/unreachable URLs produce explicit errors rather than
  unrelated fallback videos. The old no-key storyboard has been disabled because
  it ignored the supplied brief or PDF.
- Director storyboards are checked before TTS; scene IDs come from the server's
  timeline rather than an LLM, and display text is escaped before HTML generation.
  Voiceover text remains unescaped so the narrator reads the original words.
- The website fetch checks DNS addresses before connecting and on each redirect,
  pins the validated IP, limits the downloaded bytes and rejects unsafe hosts.
- Browser cross-origin POSTs are refused, not merely hidden by CORS; PDF
  filenames are inserted into the UI with `textContent`.

No hardcoded API keys were found. Audio asset provenance remains to be documented
before public distribution.

---

## Audited

Build · full test suite · oxlint · oxfmt --check · knip · path traversal ·
LAN exposure · CORS · body-size cap · SSRF · shell-injection surface · secret
scan · live end-to-end PDF ingest · `hyperframes lint` + `check` on every
generated project (all pass WCAG AA, 92/92 text checks).

---

Apache-2.0, inherited from upstream. Bundled audio assets are the exception —
see "Still open" item 17.
