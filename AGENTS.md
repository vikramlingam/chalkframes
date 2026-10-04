# Chalk Frames — agent guide

Chalk Frames turns a topic, URL, script or PDF into a narrated explainer video.
An LLM director writes a JSON storyboard, Kokoro reads the narration, and scenes
are rendered as HTML/GSAP (optionally Manim), then stitched with FFmpeg.

The server and web UI live in `studio-web/`. The renderer toolchain it calls
(the `chalkframes` CLI) lives in `packages/`.

## Setup

```bash
bun install
cp .env.example .env   # add OPENROUTER_API_KEY
bun run dev            # runs `bun run setup` first, then serves http://127.0.0.1:4000
bun run doctor         # report what is missing without changing anything
```

Setup builds `packages/`, creates `.venv` with kokoro-onnx, and downloads the
Kokoro weights and Chrome into `~/.cache/chalkframes`. Manim is optional
(`bun run setup:manim`).

## Build and test

```bash
bun run build    # builds the packages under packages/
bun run test     # quality, server, engine-upgrade and Manim suites
bunx oxlint studio-web scripts/setup.mjs
bunx oxfmt --check studio-web
```

Licensing: `studio-web/` is MIT; `packages/` is Apache-2.0 (the project is
derived from HeyGen's open-source Hyperframes and heavily modified — see
`NOTICE` and `LICENSE-APACHE-2.0`). Keep new files under the license of their
directory, and never remove the upstream attribution.

## Conventions

- Package manager: bun (not pnpm/npm for workspace operations).
- Conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`).
- TypeScript: avoid `any` and `as` casts; prefer type guards.
- Compositions are HTML files with `data-*` attributes; clips need
  `class="clip"`; register one paused GSAP root timeline per composition on
  `window.__timelines`.
- Renderers must be deterministic: no `Date.now()`, no unseeded
  `Math.random()`, no render-time network fetches.
- New visual archetypes: register in `studio-web/catalog.mjs` and
  `studio-web/renderers.mjs`.
- Never commit secrets (`.env` is gitignored) or generated output
  (`projects/`, `studio-web/renders/`).

## Project Structure

```
packages/
  cli/                  → chalkframes CLI (capture, tts, browser, render)
  core/                 → Types, parsers, generators, linter, runtime
  engine/               → Seekable page-to-video capture engine (Puppeteer + FFmpeg)
  producer/             → Rendering pipeline (capture + encode + audio mix)
  parsers/              → Composition parsers
  lint/                 → Composition linter
  studio-server/        → Studio backend server
studio-web/             → Production suite: HTTP server, director, renderers, stitcher
  engines/manim/        → Manim engine and the chalk_manim Python package
  public/               → Web UI, voice previews, soundtracks, SFX
scripts/                → Repo scripts (setup.mjs is the first-run setup)
```

