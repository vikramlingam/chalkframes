/**
 * Cheap static screen for LLM-written Manim Python, mirroring py/chalk_manim/sandbox.py.
 * Run before every render attempt (including repairs) so obviously unsafe code never
 * reaches Python. The Python validator remains the authority; this only saves a render.
 *
 * It is a line-oriented screen, not a parser, so it errs on the side of rejecting.
 */

export const MAX_CODE_CHARS = 20_000;

const FORBIDDEN_CALLS = ["exec", "eval", "open", "compile", "__import__", "input", "breakpoint"];

export function screenManimCode(code) {
  if (typeof code !== "string" || !code.trim()) return ["code is empty"];
  if (code.length > MAX_CODE_CHARS) return [`code exceeds ${MAX_CODE_CHARS} characters`];
  if (!/^\s*def run\s*\(/m.test(code))
    return ["code must define run(scene, theme, brief, budget, beats)"];
  const problems = [];
  code.split("\n").forEach((raw, idx) => {
    const line = raw.replace(/#.*$/, "");
    const at = `line ${idx + 1}`;
    if (/^\s*(import|from)\s+\S/.test(line)) problems.push(`${at}: imports are not allowed`);
    if (/^\s*async\s+def\b/.test(line) || /\bawait\b/.test(line))
      problems.push(`${at}: async code is not allowed`);
    if (/__\w+__/.test(line)) problems.push(`${at}: dunder names are not allowed`);
    if (/\.\s*_\w*/.test(line)) problems.push(`${at}: private attributes are not allowed`);
    if (/\b(?:getattr|hasattr|setattr|delattr)\s*\([^)]*['"]_/.test(line))
      problems.push(`${at}: private attribute access is not allowed`);
    for (const name of FORBIDDEN_CALLS) {
      if (new RegExp(`(^|[^\\w.])${name}\\s*\\(`).test(line))
        problems.push(`${at}: call to '${name}' is not allowed`);
    }
  });
  return problems;
}
