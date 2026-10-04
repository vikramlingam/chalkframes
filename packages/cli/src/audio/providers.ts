/**
 * Which voice / music engine a workflow will actually use, and whether
 * its local dependencies are present. Mirrors the resolution order the
 * media-use skill scripts use, so `auth status` and `doctor`
 * report the same engine the render pipeline would pick:
 *
 *   voice: Chalkframes Starfish → ElevenLabs (key + `elevenlabs`) → Kokoro (local)
 *   music: Chalkframes library  → Lyria (key + `google.genai`)   → MusicGen (local)
 *
 * The decision is split from the probing: `decide*` is pure (unit-tested
 * without spawning Python); `gather*` collects the live facts.
 */

import { hasPythonModules } from "../tts/python.js";

/** Python import names probed for each local engine. */
export const KOKORO_MODULES = ["kokoro_onnx", "soundfile"];
export const MUSICGEN_MODULES = ["transformers", "torch", "soundfile", "numpy"];

/** pip one-liners shown when a local engine's deps are missing. */
export const KOKORO_PIP = "pip install kokoro-onnx soundfile";
export const MUSICGEN_PIP = "pip install transformers torch soundfile numpy";

export type VoiceEngine = "chalkframes" | "elevenlabs" | "kokoro";
export type MusicEngine = "chalkframes" | "lyria" | "musicgen";

export interface EngineReadiness<E> {
  engine: E;
  /** Human label, e.g. "Kokoro". */
  label: string;
  /** A local engine (no account needed) vs a cloud provider keyed by env. */
  local: boolean;
  /** Usable right now: cloud key present, or local deps installed. */
  ready: boolean;
  /** Shown when `ready` is false — how to make it ready. */
  setupHint?: string;
}

export interface VoiceFacts {
  hasChalkframes: boolean;
  /** ELEVENLABS_API_KEY set AND the `elevenlabs` module importable. */
  elevenlabs: boolean;
  /** Kokoro's local deps importable. */
  kokoro: boolean;
}

export interface MusicFacts {
  hasChalkframes: boolean;
  /** A Gemini/Google key set AND `google.genai` importable. */
  lyria: boolean;
  /** MusicGen's local deps importable. */
  musicgen: boolean;
}

export function decideVoice(f: VoiceFacts): EngineReadiness<VoiceEngine> {
  if (f.hasChalkframes) return { engine: "chalkframes", label: "Chalkframes Starfish", local: false, ready: true };
  if (f.elevenlabs) return { engine: "elevenlabs", label: "ElevenLabs", local: false, ready: true };
  return {
    engine: "kokoro",
    label: "Kokoro",
    local: true,
    ready: f.kokoro,
    ...(f.kokoro ? {} : { setupHint: KOKORO_PIP }),
  };
}

export function decideMusic(f: MusicFacts): EngineReadiness<MusicEngine> {
  if (f.hasChalkframes) return { engine: "chalkframes", label: "Chalkframes library", local: false, ready: true };
  if (f.lyria) return { engine: "lyria", label: "Lyria (Gemini)", local: false, ready: true };
  return {
    engine: "musicgen",
    label: "MusicGen",
    local: true,
    ready: f.musicgen,
    ...(f.musicgen ? {} : { setupHint: MUSICGEN_PIP }),
  };
}

/** Collect live voice facts. Skips Python probes when Chalkframes is configured. */
function gatherVoiceFacts(hasChalkframes: boolean): VoiceFacts {
  if (hasChalkframes) return { hasChalkframes, elevenlabs: false, kokoro: false };
  const elevenlabs = Boolean(process.env["ELEVENLABS_API_KEY"]) && hasPythonModules(["elevenlabs"]);
  const kokoro = hasPythonModules(KOKORO_MODULES);
  return { hasChalkframes, elevenlabs, kokoro };
}

/** Collect live music facts. Skips Python probes when Chalkframes is configured. */
function gatherMusicFacts(hasChalkframes: boolean): MusicFacts {
  if (hasChalkframes) return { hasChalkframes, lyria: false, musicgen: false };
  const hasLyriaKey = Boolean(process.env["GEMINI_API_KEY"] || process.env["GOOGLE_API_KEY"]);
  const lyria = hasLyriaKey && hasPythonModules(["google.genai"]);
  const musicgen = hasPythonModules(MUSICGEN_MODULES);
  return { hasChalkframes, lyria, musicgen };
}

export function resolveVoice(hasChalkframes: boolean): EngineReadiness<VoiceEngine> {
  return decideVoice(gatherVoiceFacts(hasChalkframes));
}

export function resolveMusic(hasChalkframes: boolean): EngineReadiness<MusicEngine> {
  return decideMusic(gatherMusicFacts(hasChalkframes));
}
