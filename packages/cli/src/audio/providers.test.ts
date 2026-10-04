import { describe, expect, it } from "vitest";
import { decideMusic, decideVoice, KOKORO_PIP, MUSICGEN_PIP } from "./providers.js";

describe("decideVoice — mirrors the skill's chalkframes → elevenlabs → kokoro order", () => {
  it("prefers Chalkframes when configured", () => {
    const r = decideVoice({ hasChalkframes: true, elevenlabs: true, kokoro: true });
    expect(r.engine).toBe("chalkframes");
    expect(r.ready).toBe(true);
  });

  it("falls to ElevenLabs only when key + module are both present", () => {
    expect(decideVoice({ hasChalkframes: false, elevenlabs: true, kokoro: true }).engine).toBe(
      "elevenlabs",
    );
  });

  it("falls to Kokoro when no cloud provider is usable", () => {
    expect(decideVoice({ hasChalkframes: false, elevenlabs: false, kokoro: true }).engine).toBe(
      "kokoro",
    );
  });

  it("flags Kokoro as not-ready with a pip hint when deps are missing", () => {
    const r = decideVoice({ hasChalkframes: false, elevenlabs: false, kokoro: false });
    expect(r.engine).toBe("kokoro");
    expect(r.ready).toBe(false);
    expect(r.setupHint).toBe(KOKORO_PIP);
  });

  it("omits the hint when Kokoro is ready", () => {
    expect(
      decideVoice({ hasChalkframes: false, elevenlabs: false, kokoro: true }).setupHint,
    ).toBeUndefined();
  });
});

describe("decideMusic — mirrors the skill's chalkframes → lyria → musicgen order", () => {
  it("prefers Chalkframes, then Lyria, then MusicGen", () => {
    expect(decideMusic({ hasChalkframes: true, lyria: true, musicgen: true }).engine).toBe("chalkframes");
    expect(decideMusic({ hasChalkframes: false, lyria: true, musicgen: true }).engine).toBe("lyria");
    expect(decideMusic({ hasChalkframes: false, lyria: false, musicgen: true }).engine).toBe("musicgen");
  });

  it("flags MusicGen as not-ready with a pip hint when deps are missing", () => {
    const r = decideMusic({ hasChalkframes: false, lyria: false, musicgen: false });
    expect(r.engine).toBe("musicgen");
    expect(r.ready).toBe(false);
    expect(r.setupHint).toBe(MUSICGEN_PIP);
  });
});
