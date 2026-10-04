/**
 * `chalkframes auth` — credential management for Chalkframes.
 *
 * Subverbs:
 *   - `login`   sign in via API key (OAuth coming next)
 *   - `status`  show the active credential + identity
 *   - `logout`  remove the stored credential
 *
 * Each subverb lives in `./auth/<name>.ts` and is dynamic-imported on
 * demand. Keeps cold-start fast and lets the auth library load only
 * when the user is doing auth work.
 */

import { defineCommand } from "citty";
import type { Example } from "./_examples.js";
import { c } from "../ui/colors.js";

export const examples: Example[] = [
  ["Sign in via browser (OAuth)", "chalkframes auth login"],
  ["Sign in from SSH/headless terminal", "chalkframes auth login --device"],
  ["Save an API key (interactive)", "chalkframes auth login --api-key"],
  ["Save an API key from stdin", "echo $CHALKFRAMES_API_KEY | chalkframes auth login --api-key"],
  ["Check who you're signed in as", "chalkframes auth status"],
  ["Force-refresh the OAuth access token", "chalkframes auth refresh"],
  ["Sign out", "chalkframes auth logout"],
];

const HELP = `
${c.bold("chalkframes auth")} ${c.dim("<subcommand> [args]")}

Manage Chalkframes credentials. Credentials live in
${c.accent("~/.chalkframes/credentials")} and are shared with chalkframes-cli.

${c.bold("SUBCOMMANDS:")}
  ${c.accent("login")}    ${c.dim("Sign in via browser, --device for SSH, or --api-key for a long-lived key.")}
  ${c.accent("status")}   ${c.dim("Show the active credential's source, type, and identity.")}
  ${c.accent("refresh")}  ${c.dim("Force-refresh the OAuth access token.")}
  ${c.accent("logout")}   ${c.dim("Remove the stored credential (--keep-api-key for OAuth-only).")}

${c.bold("ENV VARS:")}
  ${c.accent("CHALKFRAMES_API_KEY")}              Override the stored credential.
  ${c.accent("CHALKFRAMES_API_KEY")}         Alias for CHALKFRAMES_API_KEY.
  ${c.accent("CHALKFRAMES_API_URL")}              Override the API base URL (default https://api.chalkframes.com).
  ${c.accent("CHALKFRAMES_CONFIG_DIR")}           Override the credentials directory (default ~/.chalkframes).
  ${c.accent("CHALKFRAMES_OAUTH_CLIENT_ID")} Override the OAuth client_id (for dev/test).
  ${c.accent("CHALKFRAMES_OAUTH_DEVICE_URL")} Override the RFC 8628 device endpoint (for dev/test).
`;

export default defineCommand({
  meta: { name: "auth", description: "Sign in to Chalkframes and manage credentials" },
  subCommands: {
    login: () => import("./auth/login.js").then((m) => m.default),
    status: () => import("./auth/status.js").then((m) => m.default),
    logout: () => import("./auth/logout.js").then((m) => m.default),
    refresh: () => import("./auth/refresh.js").then((m) => m.default),
  },
  async run({ args }) {
    if (!args._?.[0]) console.log(HELP);
  },
});
