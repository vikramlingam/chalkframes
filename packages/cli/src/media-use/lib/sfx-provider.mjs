import { chalkframesSearch } from "./chalkframes-search.mjs";

export const sfxProvider = {
  async search(intent) {
    const results = chalkframesSearch("audio sounds list", intent, {
      type: "sound_effects",
      minScore: 0.4,
    });
    if (!results) return null;
    const best = results[0];
    return {
      url: best.audio_url,
      source: "search",
      // ext derived from audio_url by resolve.mjs — catalog SFX are .mp3 or .wav
      metadata: {
        description: best.description || best.name || intent,
        duration: best.duration || null,
        provider: "chalkframes.audio.sounds",
        provenance: { track_id: best.id, score: best.score, query: intent },
      },
    };
  },
};
