/**
 * Sandboxed Manim execution: isolated subprocess, scrubbed env, wall-clock timeout,
 * process-group kill (so a stuck LaTeX/ffmpeg grandchild dies with it).
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { PY_DIR, scrubbedEnv } from "./capability.mjs";

export const DEFAULT_TIMEOUT_MS = 60_000;

function killGroup(child) {
  try {
    if (process.platform === "win32") child.kill("SIGKILL");
    else process.kill(-child.pid, "SIGKILL");
  } catch {
    // already gone
  }
}

/**
 * Render one plan. Resolves with { outputPath, ms }; rejects with an Error whose
 * `.kind` is "timeout" | "exit" | "spawn" | "empty" so callers can log why they degraded.
 */
export function runManimScene({ plan, workDir, python, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(workDir, { recursive: true });
    const planPath = path.join(workDir, "plan.json");
    fs.writeFileSync(planPath, JSON.stringify(plan));
    const started = Date.now();
    let stderr = "";
    let timedOut = false;
    const child = spawn(python, ["-m", "chalk_manim.run", planPath], {
      cwd: PY_DIR,
      env: scrubbedEnv(),
      detached: process.platform !== "win32",
      stdio: ["ignore", "ignore", "pipe"],
    });
    const fail = (kind, message) => reject(Object.assign(new Error(message), { kind }));
    const timer = setTimeout(() => {
      timedOut = true;
      killGroup(child);
    }, timeoutMs);
    child.stderr.on("data", (d) => {
      stderr = (stderr + d.toString()).slice(-3000);
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      fail("spawn", `Manim failed to start: ${err.message}`);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      killGroup(child);
      if (timedOut) return fail("timeout", `Manim render exceeded ${timeoutMs}ms`);
      if (code !== 0) {
        const tail = stderr.trim().split("\n").slice(-3).join(" ").slice(0, 300);
        return fail("exit", `Manim exited ${code}: ${tail}`);
      }
      const out = plan.outputPath;
      if (!fs.existsSync(out) || fs.statSync(out).size === 0) {
        return fail("empty", "Manim produced no output file");
      }
      resolve({ outputPath: out, ms: Date.now() - started });
    });
  });
}
