/**
 * Lossless segment stitcher for Chalk Frames.
 *
 * Every scene is exported as its own clip (HTML/GSAP via the CLI renderer, or Manim),
 * normalized to one exact encoding, concatenated with `-c copy`, then muxed with a
 * single frame-exact master audio track. Because scene length is an integer number of
 * frames, video and audio boundaries line up with zero cumulative drift.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export const FPS = 30;
export const AUDIO_RATE = 48000;

/** Scene length in whole frames: ceil of the larger of (VO + padding) and the chapter target. */
export function computeSceneFrames({ voDuration, targetSec = 0, padding = 1.2, fps = FPS }) {
  const seconds = Math.max(Number(voDuration) + padding, Number(targetSec) || 0);
  // The epsilon stops 190.00000000000003 from rounding up to 191.
  return Math.max(1, Math.ceil(seconds * fps - 1e-6));
}

export function framesToSeconds(frames, fps = FPS) {
  return frames / fps;
}

/** Cumulative start time of every scene, computed in integer frames. */
export function buildFrameTimeline(frameCounts, fps = FPS) {
  let cursor = 0;
  const starts = [];
  for (const frames of frameCounts) {
    starts.push(cursor / fps);
    cursor += frames;
  }
  return { starts, totalFrames: cursor, totalSeconds: cursor / fps };
}

function runTool(bin, args, { timeoutMs = 10 * 60_000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.stdout.on("data", (d) => {
      stdout = (stdout + d.toString()).slice(-200_000);
    });
    child.stderr.on("data", (d) => {
      stderr = (stderr + d.toString()).slice(-4000);
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else
        reject(
          new Error(`${bin} exited ${code}: ${stderr.trim().split("\n").slice(-4).join(" ")}`),
        );
    });
  });
}

export function runFfmpeg(args, options) {
  return runTool("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], options);
}

/** Probe the first video stream, counting real frames. */
export async function probeVideo(filePath) {
  const { stdout } = await runTool("ffprobe", [
    "-v",
    "error",
    "-count_frames",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=codec_name,width,height,pix_fmt,r_frame_rate,nb_read_frames,duration",
    "-of",
    "json",
    filePath,
  ]);
  const stream = JSON.parse(stdout).streams?.[0];
  if (!stream) throw new Error(`No video stream in ${filePath}`);
  return {
    codec: stream.codec_name,
    width: Number(stream.width),
    height: Number(stream.height),
    pixFmt: stream.pix_fmt,
    frameRate: stream.r_frame_rate,
    frames: Number(stream.nb_read_frames),
    duration: Number(stream.duration),
  };
}

/**
 * Re-encode one scene clip to the exact target spec: WxH, 30.0fps CFR, H.264 High,
 * yuv420p, BT.709 tags, no audio, and EXACTLY `totalFrames` frames. A short source is
 * padded by cloning its last frame (tpad); a long one is cut.
 */
export async function normalizeSegment({
  inputPath,
  outputPath,
  totalFrames,
  width,
  height,
  fps = FPS,
}) {
  if (!Number.isInteger(totalFrames) || totalFrames < 1) {
    throw new Error(
      `normalizeSegment: totalFrames must be a positive integer (got ${totalFrames})`,
    );
  }
  const duration = totalFrames / fps;
  const vf = [
    `fps=${fps}`,
    `scale=${width}:${height}:flags=lanczos:out_color_matrix=bt709:out_range=tv`,
    "format=yuv420p",
    "tpad=stop_mode=clone:stop_duration=3",
    "setsar=1",
  ].join(",");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  await runFfmpeg([
    "-i",
    inputPath,
    "-vf",
    vf,
    "-an",
    "-t",
    duration.toFixed(6),
    "-frames:v",
    String(totalFrames),
    "-c:v",
    "libx264",
    "-profile:v",
    "high",
    "-preset",
    "medium",
    "-crf",
    "14",
    "-g",
    String(fps),
    "-pix_fmt",
    "yuv420p",
    "-r",
    String(fps),
    "-fps_mode",
    "cfr",
    "-color_primaries",
    "bt709",
    "-color_trc",
    "bt709",
    "-colorspace",
    "bt709",
    "-color_range",
    "tv",
    "-video_track_timescale",
    "30000",
    "-movflags",
    "+faststart",
    outputPath,
  ]);
  const probe = await probeVideo(outputPath);
  if (probe.frames !== totalFrames) {
    throw new Error(`normalizeSegment: expected ${totalFrames} frames, got ${probe.frames}`);
  }
  return { ...probe, expectedFrames: totalFrames };
}

/** Grab one tiny grayscale frame (64x36) at `seconds` as raw bytes. */
function grabGrayFrame(filePath, seconds) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-ss",
        seconds.toFixed(3),
        "-i",
        filePath,
        "-frames:v",
        "1",
        "-vf",
        "scale=64:36:flags=area,format=gray",
        "-f",
        "rawvideo",
        "-",
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    const chunks = [];
    child.stdout.on("data", (d) => chunks.push(d));
    child.on("error", reject);
    child.on("close", (code) => {
      const frame = Buffer.concat(chunks);
      if (code === 0 && frame.length === 64 * 36) resolve(frame);
      else reject(new Error(`could not sample frame at ${seconds}s`));
    });
  });
}

function frameStats(frame) {
  let sum = 0;
  for (const v of frame) sum += v;
  const mean = sum / frame.length;
  let variance = 0;
  for (const v of frame) variance += (v - mean) ** 2;
  return { mean, std: Math.sqrt(variance / frame.length) };
}

/** A frame with std below this (0-255 scale) is a flat colour field with nothing drawn. */
export const BLANK_STD_THRESHOLD = 2.5;

/**
 * Blank-footage guard. Samples frames at 25%, 50% and 75% of the clip and reports it as
 * blank when every sampled frame is a flat field (no text, shapes or gradient structure)
 * and the frames are identical to each other.
 */
export async function detectBlankVideo(
  filePath,
  { fps = FPS, threshold = BLANK_STD_THRESHOLD } = {},
) {
  const { frames } = await probeVideo(filePath);
  const duration = frames / fps;
  const samples = [];
  for (const fraction of [0.25, 0.5, 0.75]) {
    const t = Math.min(duration - 1 / fps, duration * fraction);
    samples.push(frameStats(await grabGrayFrame(filePath, Math.max(0, t))));
  }
  const maxStd = Math.max(...samples.map((s) => s.std));
  const spread = Math.max(...samples.map((s) => s.mean)) - Math.min(...samples.map((s) => s.mean));
  return { blank: maxStd < threshold && spread < 2, maxStd, spread, samples };
}

/** Throws (with the scene label) when a clip is blank, so callers never stitch it. */
export async function assertNotBlank(filePath, label) {
  const result = await detectBlankVideo(filePath);
  if (result.blank) {
    console.warn(`[BLANK DETECTED: ${label}] std=${result.maxStd.toFixed(2)}`);
    throw Object.assign(new Error(`${label} rendered blank (std ${result.maxStd.toFixed(2)})`), {
      kind: "blank",
    });
  }
  return result;
}

/** Lossless concatenation of identically-encoded segments (`-c copy`). */
export async function concatenateSegments({ segmentPaths, outputVideoPath }) {
  if (!Array.isArray(segmentPaths) || segmentPaths.length === 0) {
    throw new Error("concatenateSegments: no segments to concatenate");
  }
  fs.mkdirSync(path.dirname(outputVideoPath), { recursive: true });
  const listPath = path.join(path.dirname(outputVideoPath), "segments.txt");
  const lines = segmentPaths.map(
    (segment) => `file '${path.resolve(segment).replace(/'/g, "'\\''")}'`,
  );
  fs.writeFileSync(listPath, `${lines.join("\n")}\n`);
  try {
    await runFfmpeg([
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listPath,
      "-c",
      "copy",
      "-movflags",
      "+faststart",
      outputVideoPath,
    ]);
  } finally {
    fs.rmSync(listPath, { force: true });
  }
  return outputVideoPath;
}

/**
 * Build the gapless master voiceover. Each scene WAV is delayed by `leadIn` seconds,
 * padded with silence (apad) and trimmed so it is EXACTLY the scene's frame-quantized
 * duration, then all scenes are concatenated. A missing WAV becomes silence.
 */
export async function assembleMasterAudio({
  sceneWavPaths,
  expectedDurations,
  outputWavPath,
  leadIn = 0,
}) {
  if (sceneWavPaths.length !== expectedDurations.length || sceneWavPaths.length === 0) {
    throw new Error("assembleMasterAudio: sceneWavPaths and expectedDurations must match");
  }
  const inputs = [];
  const filters = [];
  const delayMs = Math.round(leadIn * 1000);
  sceneWavPaths.forEach((wavPath, i) => {
    const dur = expectedDurations[i].toFixed(6);
    if (wavPath && fs.existsSync(wavPath)) {
      inputs.push("-i", wavPath);
    } else {
      inputs.push("-f", "lavfi", "-t", dur, "-i", `anullsrc=r=${AUDIO_RATE}:cl=stereo`);
    }
    const delay = delayMs > 0 ? `adelay=${delayMs}|${delayMs},` : "";
    filters.push(
      `[${i}:a]aresample=${AUDIO_RATE},aformat=sample_fmts=s16:channel_layouts=stereo,` +
        `${delay}apad=whole_dur=${dur},atrim=end=${dur},asetpts=N/SR/TB[a${i}]`,
    );
  });
  const labels = sceneWavPaths.map((_, i) => `[a${i}]`).join("");
  filters.push(`${labels}concat=n=${sceneWavPaths.length}:v=0:a=1[out]`);
  fs.mkdirSync(path.dirname(outputWavPath), { recursive: true });
  await runFfmpeg([
    ...inputs,
    "-filter_complex",
    filters.join(";"),
    "-map",
    "[out]",
    "-c:a",
    "pcm_s16le",
    "-ar",
    String(AUDIO_RATE),
    outputWavPath,
  ]);
  return outputWavPath;
}

/**
 * Merge video + master voiceover (+ optional soundtrack and timed sound effects).
 * The video stream is copied, never re-encoded. The voiceover track is exactly the
 * video's length, so it defines the mix length (amix duration=first).
 */
export async function muxMasterVideo({
  videoPath,
  audioPath,
  bgmPath = null,
  bgmVolume = 0.3,
  sfx = [],
  outputPath,
}) {
  const stereo = `aresample=${AUDIO_RATE},aformat=sample_fmts=fltp:channel_layouts=stereo`;
  const inputs = ["-i", videoPath, "-i", audioPath];
  const filters = [`[1:a]${stereo}[vo]`];
  const mixLabels = ["[vo]"];
  let nextInput = 2;
  if (bgmPath && fs.existsSync(bgmPath)) {
    inputs.push("-i", bgmPath);
    filters.push(`[${nextInput}:a]${stereo},volume=${bgmVolume}[bgm]`);
    mixLabels.push("[bgm]");
    nextInput++;
  }
  sfx.forEach((effect, i) => {
    if (!effect?.path || !fs.existsSync(effect.path)) return;
    inputs.push("-i", effect.path);
    const delayMs = Math.max(0, Math.round((effect.start || 0) * 1000));
    filters.push(
      `[${nextInput}:a]${stereo},volume=${effect.volume ?? 0.4},adelay=${delayMs}|${delayMs}[sfx${i}]`,
    );
    mixLabels.push(`[sfx${i}]`);
    nextInput++;
  });
  filters.push(
    mixLabels.length === 1
      ? "[vo]anull[aout]"
      : `${mixLabels.join("")}amix=inputs=${mixLabels.length}:duration=first:normalize=0:dropout_transition=0[aout]`,
  );
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  await runFfmpeg([
    ...inputs,
    "-filter_complex",
    filters.join(";"),
    "-map",
    "0:v:0",
    "-map",
    "[aout]",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-ar",
    String(AUDIO_RATE),
    "-shortest",
    "-movflags",
    "+faststart",
    outputPath,
  ]);
  return outputPath;
}
