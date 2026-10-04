/**
 * Post-render gate for Manim clips: ffprobe the file, then ONE ffmpeg pass that forces
 * the exact frame count T = totalFrames / 30 (tpad clone + cut), strips audio, and
 * guarantees 30fps CFR yuv420p BT.709.
 */
import { normalizeSegment, probeVideo, assertNotBlank } from "../../stitcher.mjs";

/**
 * Normalize a Manim clip. Throws (kind "blank" for empty footage) so the caller degrades
 * the scene to its HTML fallback instead of stitching silent blank video.
 */
export async function normalizeManimClip({
  inputPath,
  outputPath,
  totalFrames,
  width,
  height,
  label = "Manim scene",
}) {
  const source = await probeVideo(inputPath);
  if (!(source.frames > 0)) throw new Error("Manim clip has no frames");
  if (!(source.width > 0 && source.height > 0)) throw new Error("Manim clip has no resolution");
  const result = await normalizeSegment({ inputPath, outputPath, totalFrames, width, height });
  await assertNotBlank(outputPath, label);
  return { ...result, sourceFrames: source.frames };
}
