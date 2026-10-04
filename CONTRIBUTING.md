# Contributing to Chalk Frames

Thanks for helping. Chalk Frames is MIT licensed (the rendering packages under
`packages/` stay Apache-2.0; see `NOTICE`). By contributing you agree your work
is released under the license of the files you change.

## Setup

```bash
bun install
cp .env.example .env   # add OPENROUTER_API_KEY
bun run dev            # runs `bun run setup` first, then http://127.0.0.1:4000
bun run doctor         # report what is missing without changing anything
```

Requirements you install yourself: Node 22+, Bun, FFmpeg and Python 3.10 to
3.12. `bun run setup` builds the packages, creates `.venv` with kokoro-onnx and
soundfile, and downloads the Kokoro weights and Chrome into `~/.cache/chalkframes`.
Manim is optional (`bun run setup:manim`). Without it Chalk Frames still works
and Manim scenes fall back to HTML archetypes.

## Before you open a PR

```bash
bun run test
bunx oxlint studio-web
bunx oxfmt --check studio-web
```

## Guidelines

- Add a test with every bug fix. Tests live next to the code they cover.
- New visual archetypes: register in `studio-web/catalog.mjs` and
  `studio-web/renderers.mjs`. Keep renderers deterministic (no `Date.now()`,
  no unseeded `Math.random()`, no render-time network fetches).
- The director LLM never writes Python. Manim primitives take validated JSON.
- Conventional commit messages (`feat:`, `fix:`, `docs:`, `test:`).
- Do not commit generated output (`projects/`, `studio-web/renders/`) or secrets.
