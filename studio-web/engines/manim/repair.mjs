/**
 * Bounded self-healing for LLM-authored Manim scenes.
 *
 * Each attempt: (1) statically screen the candidate, (2) render it, (3) on failure feed
 * the traceback back to the model for another attempt. The loop stops after MAX_ATTEMPTS
 * and reports every attempt, so the caller can degrade with a real reason instead of
 * guessing. Nothing is accepted without passing the screen and rendering successfully.
 */
import { screenManimCode } from "./codeguard.mjs";
import { repairManimSkillCode } from "./skill_generator.mjs";

export const MAX_REPAIR_ATTEMPTS = 2;

/**
 * @param {object} args
 * @param {string} args.code          initial candidate code
 * @param {string} args.initialError  error from the first failed render
 * @param {(code: string) => Promise<void>} args.render  throws on failure
 * @param {string} [args.apiKey]
 * @param {string} [args.model]
 * @returns {Promise<{ ok: boolean, code?: string, attempts: Array<{ stage: string, reason: string }> }>}
 */
export async function repairAndRender({
  code,
  initialError,
  render,
  apiKey,
  model,
  maxAttempts = MAX_REPAIR_ATTEMPTS,
}) {
  const attempts = [];
  let current = code;
  let lastError = initialError;
  for (let n = 1; n <= maxAttempts; n++) {
    const candidate = await repairManimSkillCode({
      code: current,
      error: lastError,
      apiKey,
      model,
    });
    if (!candidate) {
      attempts.push({
        stage: `repair ${n}`,
        reason: "no repair produced (no API key or model failure)",
      });
      break;
    }
    const problems = screenManimCode(candidate);
    if (problems.length) {
      attempts.push({
        stage: `repair ${n}`,
        reason: `screened out: ${problems.slice(0, 3).join("; ")}`,
      });
      lastError = problems.join("\n");
      current = candidate;
      continue;
    }
    try {
      await render(candidate);
      return { ok: true, code: candidate, attempts };
    } catch (err) {
      const message = String(err?.message ?? err).slice(0, 1000);
      attempts.push({ stage: `repair ${n}`, reason: `render failed: ${message.slice(0, 200)}` });
      lastError = message;
      current = candidate;
    }
  }
  return { ok: false, attempts };
}
