/**
 * The PostHog write-only ingest key, as a LEAF module.
 *
 * It lives here rather than in transport.ts because `policy.ts` needs it (an
 * unconfigured key is itself a telemetry opt-out) and importing transport for
 * one constant created `config.ts -> policy.ts -> transport.ts -> config.ts`.
 * A cycle through the telemetry config is the kind that bites at module-init
 * time, so the constant moved instead of the dependency being tolerated.
 */
// Chalk Frames ships with no analytics key, so telemetry is off in every build
// (policy.ts reports "telemetry_disabled_build"). The key inherited from the
// upstream project was removed on purpose; do not re-add one without telling users.
export const POSTHOG_API_KEY = "";
