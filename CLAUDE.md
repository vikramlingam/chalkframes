# CLAUDE.md

Read [AGENTS.md](AGENTS.md) — it is the authoritative guide for working in this
repository: setup, build and test commands, licensing, and conventions.

Quick facts:

- Package manager: bun (`bun install`, `bun run build`, `bun run test`).
- Lint/format: oxlint and oxfmt (`bunx oxlint studio-web`,
  `bunx oxfmt --check studio-web`).
- The studio server and UI are in `studio-web/` (MIT). The renderer toolchain
  is in `packages/` (Apache-2.0; the project is derived from HeyGen's
  open-source Hyperframes — attribution lives in `NOTICE` and
  `LICENSE-APACHE-2.0`; do not remove it).
- First-run setup is `scripts/setup.mjs` (`bun run setup`, `bun run doctor`).

