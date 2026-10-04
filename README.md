<p align="center">
  <img src="assets/icon.png" alt="Chalk Frames" width="128" height="128" />
</p>

<h1 align="center">Chalk Frames</h1>

<p align="center">
  <strong>Autonomous video production suite: turn any topic, URL, script, or PDF into narrated explainer videos.</strong>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> &bull;
  <a href="#how-it-works">How It Works</a> &bull;
  <a href="#features">Features</a> &bull;
  <a href="#requirements">Requirements</a> &bull;
  <a href="#configuration">Configuration</a> &bull;
  <a href="#license">License</a>
</p>

---

Chalk Frames turns a topic, a URL, a written script or a PDF into a narrated explainer video. A language model plans the scenes, Kokoro reads the narration, and the scenes are rendered as HTML/GSAP animations or, for some math and algorithm beats, as Manim animations. Text to speech, rendering and video assembly run on your machine. The network is used for OpenRouter calls, the one-time downloads done by `bun run setup`, Google Fonts while rendering HTML scenes, and (for URL inputs) the sites you point it at. The bundled CLI sends no usage telemetry.

> **Status: work in progress.** This is an early project. It works end to end on the machine it was developed on, but it has not been tested widely, parts of it are unverified, and things will change. See [Known limitations](#known-limitations) before relying on it.

## How it works

```
input (topic | URL | script | PDF)
  -> director LLM (OpenRouter) writes a JSON storyboard
  -> validation: schema checks, escaping, archetype and engine routing, fallbacks
  -> Kokoro text to speech, one WAV per scene
  -> scene lengths are fixed in whole 30 fps frames from the measured audio
  -> Manim scenes render to clips (optional, falls back to HTML on any failure)
  -> HTML scenes render one at a time through the chalkframes CLI
  -> every clip is re-encoded to one spec, checked for blank footage, and concatenated
  -> master voiceover is padded to the exact frame count, mixed with music and effects
  -> final MP4 in studio-web/renders/
```

- **The director never writes code.** It returns JSON. For Manim scenes that JSON is validated against a schema and passed to a fixed Python library of three primitives.
- **Scene length comes from the audio.** Each scene is `max(voiceover length + 1.2 s, chapter target)`, rounded up to whole frames, so video and audio boundaries line up.
- **Rendering is chunked.** Each HTML scene is rendered in its own headless Chrome session, then the clips are joined with `ffmpeg -c copy`. This keeps memory use per session bounded. Long videos have not been tested (see limitations).
- **Failures degrade instead of aborting where possible.** A Manim scene that fails to render, times out, or produces blank footage is swapped for its HTML fallback. An HTML scene that renders blank is retried once with a plain title card, and the job fails if that is blank too.

## What is in the repository

| Path                                            | Purpose                                                                       |
| ----------------------------------------------- | ----------------------------------------------------------------------------- |
| `studio-web/server.mjs`                         | HTTP server, director prompt, job pipeline, TTS, render orchestration         |
| `studio-web/catalog.mjs`                        | Archetype catalog (30 entries) and the list shown to the director             |
| `studio-web/renderers.mjs`                      | HTML, CSS and GSAP code for each archetype                                    |
| `studio-web/quality.mjs`                        | Storyboard validation, escaping, archetype rotation, Manim routing rules      |
| `studio-web/enrichment.mjs`, `fallbackText.mjs` | Fallback copy built from the scene's own words, never from stock text         |
| `studio-web/stitcher.mjs`                       | Segment re-encoding, blank-frame detection, concat, audio assembly, final mux |
| `studio-web/engines/manim/`                     | Manim integration: capability probe, schema, runner, planner, degrade logic   |
| `studio-web/engines/manim/py/chalk_manim/`      | Python package with the three Manim primitives                                |
| `studio-web/public/`                            | Web UI, 27 voice previews, 5 soundtracks, sound effects                       |
| `packages/`                                     | Render toolchain the server calls (see below)                                 |
| `projects/`                                     | Generated per-job projects (gitignored)                                       |
| `studio-web/renders/`                           | Finished videos (gitignored)                                                  |

`packages/` contains `cli`, `core`, `engine`, `producer`, `parsers`, `lint` and `studio-server`. They provide the `chalkframes` command that captures frames in headless Chrome and runs text to speech. These packages are derived from an Apache-2.0 licensed open-source project and have been heavily modified: renamed to `chalkframes`, trimmed of unused packages, and fixed. See [License](#license) for the attribution details.

## Features

- **Inputs:** topic (the model drafts a script), website URL, pasted script, or a PDF upload (25 MB limit). The API accepts durations from 15 to 600 seconds, landscape (1920x1080) or portrait (1080x1920).
- **Archetypes:** 30 catalog entries. 27 are HTML scenes (title, stats, bento grids, step progressions, terminal views, charts, comparisons and others). 3 are Manim scenes.
- **Manim primitives:** `manim-function-plot` (curve, tangent, area, morph), `manim-vector-transform` (2x2 matrix acting on the plane, with optional projection), `manim-network-topology` (layered network or BFS/DFS traversal). They draw plain text only, with no LaTeX. Function expressions go through a restricted grammar (no `eval`).
- **Voices:** 27 English Kokoro voices (American and British, male and female), with preview clips.
- **Audio:** 5 bundled soundtracks, plus sound effects mixed at scene boundaries.
- **Palettes:** 4 built-in palettes and a custom hex palette. Scenes can use light, dark or accent themes.
- **Models:** a list of OpenRouter model IDs is defined in `server.mjs`. Which ones work depends on your OpenRouter account.
- **Live progress:** the UI follows each job over server-sent events.

## Requirements

Install these yourself (setup cannot):

- Node.js 22 or newer
- [Bun](https://bun.sh) (used for install and for building the workspace packages)
- `ffmpeg` and `ffprobe` on your `PATH`
- Python 3.10 to 3.12
- An [OpenRouter](https://openrouter.ai) API key

Setup fetches everything else. Manim Community Edition is optional: without it the app still works and Manim scenes use HTML fallbacks.

## Quick start

```bash
git clone https://github.com/vikramlingam/chalkframes.git && cd chalkframes
bun install
cp .env.example .env   # then put your OPENROUTER_API_KEY in .env (or paste it in the UI later)
bun run dev            # http://127.0.0.1:4000
```

`bun run dev` and `bun run studio` run `bun run setup` first. The first run takes a few minutes and needs about 1.5 GB of disk. Later runs skip every step that is already done. Setup:

1. checks for `ffmpeg` and `ffprobe`
2. builds the renderer packages (`bun run build`)
3. creates `.venv` and installs `kokoro-onnx` and `soundfile` into it, unless `CHALKFRAMES_PYTHON` is set or `python3` already has them
4. downloads the Kokoro model (about 311 MB) and voices (about 27 MB) into `~/.cache/chalkframes/tts/`
5. finds Chrome, or downloads one into `~/.cache/chalkframes/chrome/`
6. creates `.env` from `.env.example` if it is missing

Model weights and Chrome are never stored in the repository.

| Command               | What it does                                                        |
| --------------------- | ------------------------------------------------------------------- |
| `bun run setup`       | Run the steps above without starting the server                     |
| `bun run doctor`      | Report what is missing, change nothing                              |
| `bun run setup:manim` | Optional: install Manim into `.venv` and point `MANIM_PYTHON` at it |
| `bun run studio`      | Start the server without file watching                              |
| `bun run test`        | Run the test suites                                                 |

The OpenRouter key can come from `.env` or from the key field in the UI (the UI keeps it in the browser's `localStorage`). `.env` is git-ignored; only `.env.example`, with empty values, is committed.

Manim needs the Pango and Cairo system libraries (macOS: `brew install pango cairo pkg-config`; Debian/Ubuntu: `sudo apt-get install libpango1.0-dev libcairo2-dev pkg-config`).

## Configuration

Settings are read from the environment. A `.env` file is loaded from the current directory, the repository root, or `studio-web/`.

| Variable             | Default                                              | Meaning                                                        |
| -------------------- | ---------------------------------------------------- | -------------------------------------------------------------- |
| `OPENROUTER_API_KEY` | none                                                 | Key used for the director and script drafting                  |
| `PORT`               | `4000`                                               | Server port                                                    |
| `HOST`               | `127.0.0.1`                                          | Bind address                                                   |
| `CHALKFRAMES_PYTHON` | `.venv` from setup, else first Python on `PATH`      | Python with `kokoro-onnx` installed, used by `chalkframes tts` |
| `MANIM_PYTHON`       | interpreter behind `manim` on `PATH`, else `python3` | Python with Manim installed                                    |
| `MANIM_TIMEOUT_MS`   | `60000`                                              | Wall-clock limit for one Manim scene                           |

## Manim, in short

Manim is optional. When a job starts, the server checks for Python, the `manim` package, `ffmpeg` and usable fonts (the result is cached for the life of the process), and only offers Manim archetypes to the director if the check passes. The Manim process runs with a reduced environment (no API keys) and a timeout.

A Manim scene is accepted only if its brief validates, it has narration beats and a fallback archetype, it is not the first or last scene, and the share and run-length caps hold (at most 40% of scenes, at most 2 in a row). Anything else is switched to the fallback archetype, and the server logs the reason as `[DEGRADE REASON: Scene N: ...]`. The engine each scene received from the director is logged as `[DIRECTOR ENGINE ASSIGNMENT]`.

Whether the director chooses Manim for a given topic depends on the model. The prompt tells it to, but that is not guaranteed.

## Development

```bash
bun run test           # quality, server, engine-upgrade and Manim suites
bunx oxlint studio-web
bunx oxfmt --check studio-web
```

At the time of writing the suite has 48 tests, all passing, and `oxlint` and `oxfmt --check` report nothing. The Manim render tests skip themselves when Manim is not installed.

The packages under `packages/` have their own test suites inherited from the original project. They are not part of the commands above, and I have not kept them passing after the trimming and renaming.

### Server API

`GET /api/voices`, `/api/models`, `/api/palettes`, `/api/config`, `/api/events?id=...` (progress stream), `POST /api/prepare-script`, `POST /api/generate`, and `GET /renders/<file>` for finished videos. The server runs one production at a time and answers `429` while busy. Request bodies are capped at 40 MB. Browser requests from other origins are refused, and URL inputs are checked so they cannot point at loopback or private addresses.

## Known limitations

- **Not fully verified.** The full pipeline has been run end to end on one macOS machine (Apple silicon, Node 22). Recent changes were each checked in pieces, but I have not re-run a complete live generation after every change.
- **Portrait output** has had little testing. Several layouts were written for it but not reviewed frame by frame.
- **Long videos.** The design aims to keep memory flat, but I have not rendered a ten minute video. Render time and disk use for long jobs are unmeasured.
- **Manim render time** is not benchmarked. A scene is limited to 60 seconds by default.
- **Fonts.** HTML scenes load Inter, JetBrains Mono and Playfair Display from Google Fonts, so rendering needs network access. Manim scenes use whichever supported font is installed locally (Helvetica Neue and Menlo on the development machine).
- **English only.** Only English Kokoro voices are listed.
- **Layout.** Archetype layouts follow a size and width convention, but not every archetype has been checked against it.
- **Old projects.** Projects in `projects/` made before recent fixes can still contain broken scenes. Only new jobs get the fixes.
- **Leftover naming.** Some internal names and docs under `packages/` may still use wording from the original project.
- **Bundled audio** has no license information. See [License](#license).
- **Dead domain links.** Some CLI messages and docs under `packages/` still point at `chalkframes.dev` and `api.chalkframes.dev`, which this project does not run. Commands that rely on them (publish, sign-in, hosted registry) will not work.

## Contributing

Issues and pull requests are welcome while the project is in flux. See `CONTRIBUTING.md`.

## License

The studio code (`studio-web/` and the Manim package) is MIT licensed, see `LICENSE`.

The packages under `packages/` are derived from the open-source Hyperframes project by HeyGen, Inc. (Apache-2.0) and are heavily modified here: renamed to `chalkframes`, trimmed, and fixed. The original copyright notice is preserved in `LICENSE-APACHE-2.0` as Apache-2.0 requires, and the modifications are Copyright 2026 Vikram Lingam and the Chalk Frames contributors under the same license. See `LICENSE-APACHE-2.0` and `NOTICE`.

The audio files in `studio-web/public/soundtracks`, `studio-web/public/sfx` and `studio-web/public/samples` have no license file in this repository. Check their terms or replace them before you distribute anything built from this repository.
