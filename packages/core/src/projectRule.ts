/** Files that `chalkframes init` or another ChalkFrames tool writes at a project's root, next to its `index.html`. */
export const PROJECT_MARKER_FILES = ["chalkframes.json", "meta.json", "project.json"] as const;

export function isChalkframesProject(fileNames: Iterable<string>): boolean {
  const names = new Set(fileNames);
  return names.has("index.html") && PROJECT_MARKER_FILES.some((name) => names.has(name));
}
