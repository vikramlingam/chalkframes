import type { Example } from "./_examples.js";
import { createInspectCommand } from "./layout.js";

export const examples: Example[] = [
  ["Inspect visual layout across the current composition", "chalkframes inspect"],
  ["Inspect a specific project", "chalkframes inspect ./my-video"],
  ["Output agent-readable JSON", "chalkframes inspect --json"],
  ["Use explicit hero-frame timestamps", "chalkframes inspect --at 1.5,4.0,7.25"],
  [
    "Also sample at tween boundaries to catch transient overlaps",
    "chalkframes inspect --at-transitions",
  ],
  [
    "Verify motion intent (add a *.motion.json sidecar next to the composition)",
    "chalkframes inspect --json",
  ],
  ["Run the compatibility alias", "chalkframes layout --json"],
];

export default createInspectCommand("inspect");
