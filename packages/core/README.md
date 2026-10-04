# @chalkframes/core

Types, parsers, generators, compiler, linter, runtime, and frame adapters for the Chalkframes video framework.

## Install

```bash
npm install @chalkframes/core
```

> Most users don't need to install core directly — the [CLI](../cli), [producer](../producer), and [studio](../studio) packages depend on it internally.

## What's inside

| Module             | Description                                                                                          |
| ------------------ | ---------------------------------------------------------------------------------------------------- |
| **Types**          | `TimelineElement`, `CompositionSpec`, `Asset`, canvas dimensions, defaults                           |
| **Parsers**        | `parseHtml` — extract timeline elements from HTML; `parseGsapScript` — parse GSAP animations         |
| **Generators**     | `generateChalkframesHtml` — produce valid Chalkframes HTML from a composition spec                   |
| **Compiler**       | `compileTimingAttrs` — resolve `data-start` / `data-duration` into absolute times                    |
| **Linter**         | `lintChalkframeHtml` — validate Chalkframes HTML (missing attributes, overlapping tracks, etc.)      |
| **Runtime**        | IIFE script injected into the browser — manages seek, media playback, and the `window.__hf` protocol |
| **Frame Adapters** | Pluggable animation drivers (GSAP, Lottie, CSS, or custom)                                           |

## Generated composition trust

Composition generators require trusted authors for code-bearing inputs. `styles` and
`generateChalkframesStyles` preserve authored CSS, which can load external resources.
`animations` may contain `__raw:` values that are emitted as JavaScript;
`includeScripts: true` includes executable timeline code. `serializeGsapAnimations`
also accepts raw `preamble`, `postamble`, and a code-bearing `timelineVar`. Never fill
these inputs with untrusted data. Attribute encoding and closing-tag containment
are not a sandbox; render untrusted compositions in an appropriately isolated
execution environment and never serve them on a privileged origin.

Text content retains the supported inline-formatting sanitizer contract. The clip
parser intentionally flattens inner formatting to text, so parse/generate is not
a lossless replacement for editing the source HTML.

## Frame Adapters

A frame adapter tells the engine how to seek your animation to a specific frame:

```typescript
import { createGSAPFrameAdapter } from "@chalkframes/core";

const adapter = createGSAPFrameAdapter({
  getTimeline: () => gsap.timeline(),
  compositionId: "my-video",
});
```

Implement `FrameAdapter` for custom animation runtimes:

```typescript
import type { FrameAdapter } from "@chalkframes/core";

const myAdapter: FrameAdapter = {
  id: "my-adapter",
  getDurationFrames: () => 300,
  seekFrame: (frame) => {
    /* seek your animation */
  },
};
```

## Parsing and generating HTML

```typescript
import { parseHtml, generateChalkframesHtml } from "@chalkframes/core";

const { elements, metadata } = parseHtml(htmlString);
const html = generateChalkframesHtml(spec);
```

## Linting

```typescript
import { lintChalkframeHtml } from "@chalkframes/core/lint";

const result = lintChalkframeHtml(htmlString);
// result.findings: { severity, message, elementId }[]
```

## Documentation

Full documentation: [chalkframes.dev/packages/core](https://chalkframes.dev/packages/core)

## Related packages

- [`@chalkframes/engine`](../engine) — rendering engine that drives the browser
- [`@chalkframes/producer`](../producer) — full render pipeline (capture + encode)
- [`chalkframes`](../cli) — CLI
