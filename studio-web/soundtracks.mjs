// 5 CC0 Public Domain Background Soundtracks
// Released under Creative Commons Zero (CC0 1.0 Universal - Public Domain Dedication)
// Zero copyright restrictions, safe for commercial, open-source, and offline distribution.

export const SOUNDTRACKS = [
  {
    id: "quiet-reflection",
    file: "quiet-reflection.mp3",
    title: "Quiet Time",
    name: "Quiet Reflection",
    artist: "HoliznaCC0",
    license: "CC0 1.0 Universal (Public Domain)",
    genre: "Soft Rhodes electric piano and warm lo-fi ambience",
    desc: "Soft Rhodes electric piano and warm lo-fi ambience",
    bestFor: "Product walk-throughs, UI demos, and thoughtful engineering explainers",
  },
  {
    id: "ambient-drift",
    file: "ambient-drift.mp3",
    title: "Drifting",
    name: "Ambient Drift",
    artist: "HoliznaCC0",
    license: "CC0 1.0 Universal (Public Domain)",
    genre: "Slow analog synth pad with a warm sub-bass pulse",
    desc: "Slow analog synth pad with a warm sub-bass pulse",
    bestFor: "Complex systems architecture, distributed networks, and cloud pipelines",
  },
  {
    id: "minimal-clarity",
    file: "minimal-clarity.mp3",
    title: "Gymnopédie No. 1",
    name: "Minimal Clarity",
    artist: "Erik Satie (Musopen)",
    license: "Public Domain Mark / CC0",
    genre: "Minimalist solo classical piano",
    desc: "Minimalist solo classical piano",
    bestFor: "Deep mathematical proofs, calculus, and foundational algorithms",
  },
  {
    id: "gentle-pulse",
    file: "gentle-pulse.mp3",
    title: "It Feels Good To Be Alive Too",
    name: "Gentle Pulse",
    artist: "Loyalty Freak Music",
    license: "CC0 1.0 Universal (Public Domain)",
    genre: "Warm acoustic pluck and subtle downtempo electronic hum",
    desc: "Warm acoustic pluck and subtle downtempo electronic hum",
    bestFor: "Company pitches, vision explainers, and macroeconomic overviews",
  },
  {
    id: "deliberate-thought",
    file: "deliberate-thought.mp3",
    title: "Calmant",
    name: "Deliberate Thought",
    artist: "Kevin MacLeod",
    license: "CC0 1.0 Universal (FreePD Public Domain release)",
    genre: "Cinematic soft drone with muted strings and peaceful resonance",
    desc: "Cinematic soft drone with muted strings and peaceful resonance",
    bestFor: "Research paper breakdowns and technical deep dives",
  },
];

export const SOUNDTRACK_MAP = {
  // 5 Flagship CC0 Soundtracks
  ...Object.fromEntries(SOUNDTRACKS.map((t) => [t.id, t])),

  // Backward-compatible legacy aliases
  "soothing-ambient": {
    file: "soothing-ambient.mp3",
    name: "Soothing Ambient",
    desc: "Gentle and warm ambient pulse, relaxing and unobtrusive",
  },
  "modern-tech": {
    file: "modern-tech.mp3",
    name: "Modern Tech",
    desc: "Kinetic SaaS groove with subtle upbeat percussion",
  },
  "chill-lofi": {
    file: "chill-lofi.mp3",
    name: "Chill Horizon",
    desc: "Relaxing electronic lo-fi with atmospheric chords",
  },
  "acoustic-warmth": {
    file: "acoustic-warmth.mp3",
    name: "Acoustic Warmth",
    desc: "Warm acoustic piano and strings, emotional and human",
  },
};
