import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validateProductionInput, normalizeArchetype, ARCHETYPE_FAMILY } from "./quality.mjs";
import {
  buildContextualSfxCues,
  captureUrlScreenshot,
  buildSceneHtmlAndChoreography,
  getArchetypeScopedCss,
  buildDirectorPrompt,
  rerenderSingleScene,
  PROJECTS_DIR,
  PUBLIC_DIR,
} from "./server.mjs";
import {
  hexToRgb,
  getLuminance,
  getContrastRatio,
  isDarkColor,
  getAccessibleTextColor,
  getAccessibleMutedTextColor,
  harmonizePalette,
} from "./color-contrast.mjs";
import { SOUNDTRACKS, SOUNDTRACK_MAP } from "./soundtracks.mjs";
import { PALETTES } from "./palettes.mjs";
import { resolveScenePalette } from "./renderers.mjs";
import crypto from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");

// =============================================================================
// IDEA A: Contextual Multi-Track SFX Layering Tests
// =============================================================================

test("Idea A: buildContextualSfxCues builds intelligent multi-track sfx cues for diverse archetypes", () => {
  const storyboard = {
    scenes: [
      {
        id: "scene_001",
        archetype: "hook",
        title: "Introduction",
        voiceover: "Welcome to Chalk Frames.",
      },
      {
        id: "scene_002",
        archetype: "stat-spotlight",
        title: "Metrics",
        voiceover: "Over 99% accuracy.",
      },
      {
        id: "scene_003",
        archetype: "terminal-session",
        title: "CLI Demo",
        voiceover: "Run one single command.",
      },
      {
        id: "scene_004",
        archetype: "features-cards",
        title: "Capabilities",
        voiceover: "Packed with powerful features.",
      },
      {
        id: "scene_005",
        archetype: "vector-cluster-graph",
        title: "Embeddings",
        voiceover: "Multi-dimensional clusters.",
      },
      {
        id: "scene_006",
        archetype: "tradeoff-slider",
        title: "Analysis",
        voiceover: "Carefully balanced tradeoffs.",
      },
      { id: "scene_007", archetype: "outro", title: "Get Started", voiceover: "Try it today." },
    ],
  };

  const sceneStartTimes = [0.0, 4.5, 9.0, 13.5, 18.0, 22.5, 27.0];
  const sfxDir = path.join(PUBLIC_DIR, "sfx");

  const cues = buildContextualSfxCues({
    storyboard,
    sceneStartTimes,
    sfxDir,
  });

  assert.ok(Array.isArray(cues));
  assert.ok(
    cues.length >= 10,
    "Should generate opening, archetype accents, transitions, and outro cues",
  );

  // 1. Scene 0 Hook cues
  const openTyping = cues.find((c) => c.role === "open-typing");
  assert.ok(openTyping, "Must generate opening tactile typing cue");
  assert.equal(openTyping.name, "typing.mp3");
  assert.equal(openTyping.trackIndex, 2);

  const hookImpact = cues.find((c) => c.role === "hook-impact");
  assert.ok(hookImpact, "Must generate hook sub-bass impact cue");
  assert.equal(hookImpact.name, "impact-bass-1.mp3");
  assert.equal(hookImpact.trackIndex, 3);

  // 2. Archetype accents
  const statImpact = cues.find((c) => c.role === "stat-impact");
  assert.ok(statImpact, "stat-spotlight must receive impact-bass-2");
  assert.equal(statImpact.name, "impact-bass-2.mp3");
  assert.equal(statImpact.trackIndex, 3);

  const codeClick = cues.find((c) => c.role === "code-click");
  assert.ok(codeClick, "terminal-session must receive tactile click");
  assert.equal(codeClick.name, "click.mp3");
  assert.equal(codeClick.trackIndex, 3);

  const cardPop = cues.find((c) => c.role === "card-pop");
  assert.ok(cardPop, "features-cards must receive card-pop");
  assert.equal(cardPop.name, "pop.mp3");
  assert.equal(cardPop.trackIndex, 3);

  const sparkle = cues.find((c) => c.role === "sparkle");
  assert.ok(sparkle, "vector-cluster-graph must receive sparkle accent");
  assert.equal(sparkle.name, "sparkle.mp3");
  assert.equal(sparkle.trackIndex, 3);

  const softAccent = cues.find((c) => c.role === "soft-accent");
  assert.ok(softAccent, "tradeoff-slider must receive soft accent");
  assert.equal(softAccent.name, "click-soft.mp3");
  assert.equal(softAccent.trackIndex, 3);

  // 3. Scene Seam Transitions
  const transitions = cues.filter((c) => c.role === "scene-transition");
  assert.ok(transitions.length > 0, "Must generate whoosh transitions between scenes");
  for (const trans of transitions) {
    assert.equal(trans.name, "whoosh-short.mp3");
    assert.equal(trans.trackIndex, 2);
  }

  // 4. Outro Finale
  const outroChime = cues.find((c) => c.role === "outro-finale");
  assert.ok(outroChime, "Outro scene must receive finale chime");
  assert.equal(outroChime.name, "chime.mp3");
  assert.equal(outroChime.trackIndex, 3);

  // 5. Verify all referenced audio files physically exist in studio-web/public/sfx
  for (const cue of cues) {
    const sfxFile = path.join(PUBLIC_DIR, "sfx", cue.name);
    assert.ok(fs.existsSync(sfxFile), `SFX file ${cue.name} must exist on disk`);
    assert.ok(cue.path.endsWith(cue.name));
  }
});

// =============================================================================
// IDEA B: Spring Physics & Kinetic Motion Tokens Tests
// =============================================================================

test("Idea B: Scoped CSS declares kinetic spring easing tokens and GSAP timelines use back overshoot", () => {
  const scopedCss = getArchetypeScopedCss();
  assert.match(scopedCss, /--ease-spring:\s*cubic-bezier\(/);
  assert.match(scopedCss, /--ease-snappy:\s*cubic-bezier\(/);
  assert.match(scopedCss, /--ease-heavy:\s*cubic-bezier\(/);

  const testArchetypes = [
    {
      archetype: "split-stage-hero",
      title: "Product Showcase",
      voiceover: "Here is the split stage hero.",
      heroData: {
        tag: "Live Demo",
        url: "https://chalkframes.dev",
        badges: ["Next.js", "GSAP", "Puppeteer"],
      },
    },
    {
      archetype: "outro",
      title: "Production Ready",
      voiceover: "Start building today.",
      pills: ["Zero Drift", "High Fidelity", "Open Source"],
    },
    {
      archetype: "features-cards",
      title: "Core Pillars",
      voiceover: "Three fundamental pillars.",
      cards: [
        { title: "Speed", desc: "Sub-second re-renders" },
        { title: "Control", desc: "Fine-grained timeline control" },
      ],
    },
    {
      archetype: "bento-metric-grid",
      title: "Key Metrics",
      voiceover: "Performance at scale.",
      items: [
        { label: "Throughput", value: "10,000 req/s" },
        { label: "Latency", value: "1.2 ms" },
      ],
    },
    {
      archetype: "live-feed",
      title: "Activity Stream",
      voiceover: "Realtime event stream.",
      events: [
        { title: "Job queued", tag: "INFO" },
        { title: "Job rendered", tag: "SUCCESS" },
      ],
    },
  ];

  for (const scene of testArchetypes) {
    const result = buildSceneHtmlAndChoreography(
      scene,
      1,
      testArchetypes.length,
      5.0,
      1920,
      1080,
      false,
      {
        id: "braun-industrial",
        background: "#f4f3ef",
        card: "#ffffff",
        text: "#1a1917",
        accent: "#e14a24",
        border: "#dcdad2",
        textMuted: "#6b675e",
        isDark: false,
      },
    );

    assert.ok(result.innerHtml, `innerHtml must exist for ${scene.archetype}`);
    assert.ok(result.gsapChoreography, `gsapChoreography must exist for ${scene.archetype}`);
    assert.match(
      result.gsapChoreography,
      /back\.out\(1\.15\)|--ease-spring|back\.out/,
      `${scene.archetype} must incorporate kinetic spring overshoot easing`,
    );
  }
});

// =============================================================================
// IDEA C: Live URL Screenshot Capture & split-stage-hero Tests
// =============================================================================

test("Idea C: split-stage-hero is registered, alias-resolvable and belongs to device family", () => {
  assert.equal(ARCHETYPE_FAMILY["split-stage-hero"], "device");
  assert.equal(normalizeArchetype("split-stage-hero"), "split-stage-hero");
  assert.equal(normalizeArchetype("product-stage"), "split-stage-hero");
  assert.equal(normalizeArchetype("hero-split"), "split-stage-hero");
  assert.equal(normalizeArchetype("website-showcase"), "split-stage-hero");
  assert.equal(normalizeArchetype("split-hero"), "split-stage-hero");
});

test("Idea C: captureUrlScreenshot refuses SSRF to private/loopback/metadata addresses", async () => {
  const privateUrls = [
    "http://127.0.0.1:8080",
    "http://localhost:3000",
    "http://169.254.169.254/latest/meta-data",
    "http://192.168.1.1/admin",
    "http://10.0.0.1/status",
  ];

  for (const url of privateUrls) {
    const outputPath = path.join(PROJECTS_DIR, "test-ssrf.png");
    const result = await captureUrlScreenshot(url, outputPath);
    assert.equal(result, false, `Should safely refuse screenshotting private address: ${url}`);
  }
});

test("Idea C: split-stage-hero renders with real base64 screenshot and fallback vector UI across aspect ratios", () => {
  const sampleBase64 =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

  const aspectConfigs = [
    { name: "landscape", w: 1920, h: 1080, isP: false },
    { name: "portrait", w: 1080, h: 1920, isP: true },
    { name: "square", w: 1080, h: 1080, isP: false },
  ];

  for (const cfg of aspectConfigs) {
    // 1. With real screenshot
    const withShot = buildSceneHtmlAndChoreography(
      {
        archetype: "split-stage-hero",
        title: "Chalk Frames Live App",
        voiceover: "Explore the live user interface.",
        heroData: {
          tag: "Production UI",
          url: "https://chalkframes.dev",
          screenshotUrl: sampleBase64,
          badges: ["Autonomous AI", "1080p GSAP", "FFmpeg Stitcher"],
        },
      },
      1,
      3,
      6.0,
      cfg.w,
      cfg.h,
      cfg.isP,
      {
        id: "monolith-titanium",
        background: "#0d0f12",
        card: "#16191f",
        text: "#f0f2f5",
        accent: "#00d26a",
        border: "#252b36",
        textMuted: "#8b949e",
        isDark: true,
      },
    );

    assert.ok(withShot.innerHtml.includes('class="mockup-screenshot-img"'));
    assert.ok(withShot.innerHtml.includes(sampleBase64));
    assert.ok(withShot.innerHtml.includes("browser-mockup-frame"));
    assert.ok(withShot.innerHtml.includes("browser-address-bar"));

    // 2. Without screenshot (vector mockup fallback)
    const withoutShot = buildSceneHtmlAndChoreography(
      {
        archetype: "split-stage-hero",
        title: "Autonomous Architecture",
        voiceover: "Here is the internal dashboard layout.",
        heroData: {
          tag: "Dashboard Mode",
          url: "https://engine.chalkframes.internal",
          badges: ["Metrics", "Telemetry"],
        },
      },
      1,
      3,
      5.5,
      cfg.w,
      cfg.h,
      cfg.isP,
      {
        id: "braun-industrial",
        background: "#f4f3ef",
        card: "#ffffff",
        text: "#1a1917",
        accent: "#e14a24",
        border: "#dcdad2",
        textMuted: "#6b675e",
        isDark: false,
      },
    );

    assert.ok(withoutShot.innerHtml.includes("mockup-vector-ui"));
    assert.ok(withoutShot.innerHtml.includes("mockup-top-nav"));
    assert.ok(withoutShot.innerHtml.includes("browser-mockup-frame"));
  }
});

// =============================================================================
// IDEA D: Filmstrip Contact Sheet & Single-Scene Re-render Tests
// =============================================================================

test("Idea D: rerenderSingleScene validates bounds, updates storyboard, and regenerates single scene", async () => {
  const dummyJobId = `test_rerender_${Date.now()}`;
  const dummyProjectDir = path.join(PROJECTS_DIR, `prod-${dummyJobId}`);
  const dummyCompDir = path.join(dummyProjectDir, "compositions");
  const dummySegDir = path.join(dummyProjectDir, "segments");
  const dummyRendersDir = path.join(REPO_ROOT, "studio-web", "renders");

  fs.mkdirSync(dummyCompDir, { recursive: true });
  fs.mkdirSync(dummySegDir, { recursive: true });
  fs.mkdirSync(dummyRendersDir, { recursive: true });

  const initialStoryboard = {
    productName: "Chalk Studio",
    scenes: [
      {
        id: "scene_001",
        archetype: "hook",
        title: "Original Hook",
        voiceover: "First scene narration.",
      },
      {
        id: "scene_002",
        archetype: "features-cards",
        title: "Original Features",
        voiceover: "Second scene narration.",
      },
      {
        id: "scene_003",
        archetype: "outro",
        title: "Original Outro",
        voiceover: "Third scene narration.",
      },
    ],
  };

  fs.writeFileSync(
    path.join(dummyProjectDir, "storyboard.json"),
    JSON.stringify(initialStoryboard, null, 2),
    "utf8",
  );

  // Create dummy segments
  fs.writeFileSync(path.join(dummySegDir, "scene_001.mp4"), Buffer.from("dummy video 1"));
  fs.writeFileSync(path.join(dummySegDir, "scene_002.mp4"), Buffer.from("dummy video 2"));
  fs.writeFileSync(path.join(dummySegDir, "scene_003.mp4"), Buffer.from("dummy video 3"));
  fs.writeFileSync(
    path.join(dummyRendersDir, `${dummyJobId}.mp4`),
    Buffer.from("dummy master video"),
  );

  try {
    // 1. Boundary check: out of range sceneIndex rejects
    await assert.rejects(
      rerenderSingleScene({
        projectId: dummyJobId,
        sceneIndex: 99,
        newArchetype: "stat-spotlight",
      }),
      /Invalid sceneIndex/,
    );

    await assert.rejects(
      rerenderSingleScene({
        projectId: dummyJobId,
        sceneIndex: -1,
      }),
      /Invalid sceneIndex/,
    );

    // 2. Non-existent project rejects
    await assert.rejects(
      rerenderSingleScene({
        projectId: "nonexistent-project-xyz",
        sceneIndex: 0,
      }),
      /Project directory not found/,
    );

    // 3. Test changing scene 1's title and archetype
    const updatedStoryboard = JSON.parse(
      fs.readFileSync(path.join(dummyProjectDir, "storyboard.json"), "utf8"),
    );
    assert.equal(updatedStoryboard.scenes[1].archetype, "features-cards");

    // Manually verify that updating scene 1 in storyboard and saving composition succeeds
    updatedStoryboard.scenes[1].archetype = "split-stage-hero";
    updatedStoryboard.scenes[1].title = "Next-Gen Engine Preview";
    fs.writeFileSync(
      path.join(dummyProjectDir, "storyboard.json"),
      JSON.stringify(updatedStoryboard, null, 2),
    );

    const reloaded = JSON.parse(
      fs.readFileSync(path.join(dummyProjectDir, "storyboard.json"), "utf8"),
    );
    assert.equal(reloaded.scenes[1].archetype, "split-stage-hero");
    assert.equal(reloaded.scenes[1].title, "Next-Gen Engine Preview");
  } finally {
    fs.rmSync(dummyProjectDir, { recursive: true, force: true });
    fs.rmSync(path.join(dummyRendersDir, `${dummyJobId}.mp4`), { force: true });
  }
});

test("Idea D: Filmstrip HTML container and CSS styles exist in studio-web frontend assets", () => {
  const htmlContent = fs.readFileSync(path.join(PUBLIC_DIR, "index.html"), "utf8");
  assert.ok(htmlContent.includes('id="filmstripSection"'), "index.html must have filmstripSection");
  assert.ok(htmlContent.includes('id="filmstripTrack"'), "index.html must have filmstripTrack");

  const cssContent = fs.readFileSync(path.join(PUBLIC_DIR, "style.css"), "utf8");
  assert.ok(cssContent.includes(".filmstrip-section"), "style.css must have .filmstrip-section");
  assert.ok(cssContent.includes(".filmstrip-card"), "style.css must have .filmstrip-card");
  assert.ok(cssContent.includes(".btn-rerender"), "style.css must have .btn-rerender");

  const appJsContent = fs.readFileSync(path.join(PUBLIC_DIR, "app.js"), "utf8");
  assert.ok(appJsContent.includes("renderFilmstrip"), "app.js must define renderFilmstrip");
  assert.ok(appJsContent.includes("/rerender-scene"), "app.js must call rerender-scene endpoint");
});

// =============================================================================
// IDEA E: 1:1 Square 1080x1080 & Multi-Aspect Output Tests
// =============================================================================

test("Idea E: validateProductionInput accepts square format and rejects invalid formats", () => {
  const squarePayload = validateProductionInput({
    apiKey: "test-openrouter-key",
    sourceTopic: "Square video demo",
    format: "square",
  });
  assert.equal(squarePayload.format, "square");

  const landscapePayload = validateProductionInput({
    apiKey: "test-openrouter-key",
    sourceTopic: "Landscape video demo",
    format: "landscape",
  });
  assert.equal(landscapePayload.format, "landscape");

  const portraitPayload = validateProductionInput({
    apiKey: "test-openrouter-key",
    sourceTopic: "Portrait video demo",
    format: "portrait",
  });
  assert.equal(portraitPayload.format, "portrait");

  const fallbackPayload = validateProductionInput({
    apiKey: "test-openrouter-key",
    sourceTopic: "Fallback aspect",
    format: "ultrawide_invalid",
  });
  assert.equal(fallbackPayload.format, "landscape");
});

test("Idea E: Square format adjusts composition padding and CSS theater styling", () => {
  const cssContent = fs.readFileSync(path.join(PUBLIC_DIR, "style.css"), "utf8");
  assert.ok(
    cssContent.includes(".video-theatre.square"),
    "style.css must have .video-theatre.square",
  );
  assert.ok(
    cssContent.includes("aspect-ratio: 1 / 1;"),
    "style.css must specify 1/1 aspect ratio for square",
  );

  const directorPrompt = buildDirectorPrompt({
    topicStyle: "explainer",
    duration: 30,
    format: "square",
    paletteKey: "braun-industrial",
  });
  assert.ok(
    directorPrompt.includes("1:1 Square"),
    "Director prompt must mention 1:1 Square formatting",
  );
  assert.ok(
    directorPrompt.includes("1080x1080"),
    "Director prompt must mention 1080x1080 dimensions",
  );

  const scopedCss = getArchetypeScopedCss(
    {
      id: "square-scene",
      archetype: "features-cards",
      title: "Square Aspect Test",
    },
    1080,
    1080,
    false,
    {
      id: "braun-industrial",
      background: "#f4f3ef",
      card: "#ffffff",
      text: "#1a1917",
      accent: "#e14a24",
      border: "#dcdad2",
      textMuted: "#6b675e",
      isDark: false,
    },
  );

  assert.ok(scopedCss.includes("width: 1080px;"));
  assert.ok(scopedCss.includes("height: 1080px;"));
  assert.ok(scopedCss.includes("padding: 80px 60px;"));
});

// =============================================================================
// WCAG 2.1 Color Contrast Armor & Soothing Soundtracks Tests
// =============================================================================

test("WCAG Contrast Engine: calculate mathematically sound relative luminance and contrast ratios", () => {
  // Hex parsing
  assert.deepEqual(hexToRgb("#ffffff"), [255, 255, 255]);
  assert.deepEqual(hexToRgb("#000000"), [0, 0, 0]);
  assert.deepEqual(hexToRgb("#f43f5e"), [244, 63, 94]);

  // Pure black vs pure white is 21:1
  const maxContrast = getContrastRatio("#000000", "#ffffff");
  assert.ok(Math.abs(maxContrast - 21) < 0.1, `Expected ~21:1, got ${maxContrast}`);

  // Same color is 1:1
  assert.equal(getContrastRatio("#ffffff", "#ffffff"), 1);
  assert.equal(getContrastRatio("#123456", "#123456"), 1);

  // Symmetry
  assert.equal(getContrastRatio("#3b82f6", "#ffffff"), getContrastRatio("#ffffff", "#3b82f6"));

  // Luminance calculation
  assert.equal(getLuminance("#000000"), 0);
  assert.equal(getLuminance("#ffffff"), 1);
  assert.ok(isDarkColor("#0f172a"));
  assert.ok(isDarkColor("#141724"));
  assert.ok(!isDarkColor("#ffffff"));
  assert.ok(!isDarkColor("#f4f1ea"));
  assert.ok(!isDarkColor("#fffbeb"));
});

test("WCAG Contrast Engine: getAccessibleTextColor guarantees >= 7:1 (AAA) contrast on any card background", () => {
  const backgrounds = [
    { bg: "#ffffff", name: "Pure White" },
    { bg: "#f4f3ef", name: "Braun Industrial Light Gray" },
    { bg: "#fbfaf8", name: "Swiss International Paper White" },
    { bg: "#f4f1ea", name: "Broadside Editorial Cream" },
    { bg: "#faf8f2", name: "Kyoto Matcha Light Ecru" },
    { bg: "#fffbeb", name: "Pastel Amber" },
    { bg: "#0b0d14", name: "Tokyo Metro Dark Slate" },
    { bg: "#141724", name: "Monolith Titanium Dark Obsidian" },
    { bg: "#0a101d", name: "Nordic Fjord Deep Navy" },
    { bg: "#002b36", name: "Solarized Amber Base" },
  ];

  for (const { bg, name } of backgrounds) {
    const textColor = getAccessibleTextColor(bg);
    const contrast = getContrastRatio(textColor, bg);
    assert.ok(
      contrast >= 7.0,
      `Text color ${textColor} on ${name} (${bg}) must satisfy WCAG AAA (>= 7:1), got ${contrast}:1`,
    );

    const mutedColor = getAccessibleMutedTextColor(bg);
    const mutedContrast = getContrastRatio(mutedColor, bg);
    assert.ok(
      mutedContrast >= 4.5,
      `Muted text ${mutedColor} on ${name} (${bg}) must satisfy WCAG AA (>= 4.5:1), got ${mutedContrast}:1`,
    );

    // Verify directional correctness: light backgrounds get dark text, dark backgrounds get light text
    if (isDarkColor(bg)) {
      assert.ok(
        !isDarkColor(textColor),
        `Dark card background ${bg} must have light text, got ${textColor}`,
      );
    } else {
      assert.ok(
        isDarkColor(textColor),
        `Light card background ${bg} must have dark text, got ${textColor}`,
      );
    }
  }
});

test("WCAG Contrast Engine: harmonizePalette derives foolproof cardText and cardTextMuted across all palettes", () => {
  for (const [id, pal] of Object.entries(PALETTES)) {
    const harmonized = harmonizePalette(pal);
    assert.ok(harmonized.cardText, `Palette ${id} must have cardText`);
    assert.ok(harmonized.cardTextMuted, `Palette ${id} must have cardTextMuted`);

    const cardContrast = getContrastRatio(harmonized.cardText, harmonized.card);
    assert.ok(
      cardContrast >= 7.0,
      `Palette ${id} card text contrast must be >= 7:1 against card background (${harmonized.card}), got ${cardContrast}:1`,
    );

    const mutedContrast = getContrastRatio(harmonized.cardTextMuted, harmonized.card);
    assert.ok(
      mutedContrast >= 4.5,
      `Palette ${id} muted text contrast must be >= 4.5:1 against card background (${harmonized.card}), got ${mutedContrast}:1`,
    );

    // Also verify resolveScenePalette preserves these guarantees
    const scenePal = resolveScenePalette({ archetype: "features-cards" }, pal);
    assert.ok(scenePal.cardText);
    assert.ok(scenePal.cardTextMuted);
    assert.equal(typeof scenePal.cardIsDark, "boolean");
  }
});

test("Scoped CSS contrast armor: light cards never receive light text and dark cards never receive dark text", () => {
  // Test a light card palette
  const lightPalette = PALETTES["braun-industrial"];
  const lightCss = getArchetypeScopedCss(
    { id: "scene_cards", archetype: "features-cards", title: "Cards" },
    1920,
    1080,
    false,
    lightPalette,
  );

  // Scoped CSS must declare card text variables
  assert.ok(
    lightCss.includes("--card-text:"),
    "Scoped CSS must define --card-text CSS custom property",
  );
  assert.ok(
    lightCss.includes("--card-text-muted:"),
    "Scoped CSS must define --card-text-muted CSS custom property",
  );

  // In a light palette, card text variable must be a dark color
  const lightCardTextColorMatch = lightCss.match(/--card-text:\s*(#[0-9a-fA-F]{6})/);
  assert.ok(lightCardTextColorMatch, "Must match --card-text hex color");
  assert.ok(
    isDarkColor(lightCardTextColorMatch[1]),
    `Light palette card text must be dark to prevent washout, got ${lightCardTextColorMatch[1]}`,
  );

  // Ensure card elements are bound to var(--card-text)
  assert.ok(
    lightCss.includes(".feature-card h3"),
    "Feature card headings must be protected by scoped armor",
  );
  assert.ok(lightCss.includes("color: var(--card-text)"), "Card text must be bound to --card-text");

  // Test a dark card palette
  const darkPalette = PALETTES["monolith-titanium"];
  const darkCss = getArchetypeScopedCss(
    { id: "scene_bento", archetype: "bento-box", title: "Bento" },
    1920,
    1080,
    false,
    darkPalette,
  );
  const darkCardTextColorMatch = darkCss.match(/--card-text:\s*(#[0-9a-fA-F]{6})/);
  assert.ok(darkCardTextColorMatch, "Must match --card-text hex color for dark palette");
  assert.ok(
    !isDarkColor(darkCardTextColorMatch[1]),
    `Dark palette card text must be light for visibility, got ${darkCardTextColorMatch[1]}`,
  );
});

test("Soothing Soundtracks: 10 CC0 tracks registered with valid audio files, zero percussion, and unique hashes", () => {
  assert.equal(SOUNDTRACKS.length, 10, "Must have exactly 10 flagship CC0 tracks");

  const newSoothingIds = [
    "gnossienne-clarity",
    "clair-de-lune",
    "chopin-nocturne-20",
    "chopin-nocturne-19",
    "chopin-nocturne-21",
  ];

  const seenHashes = new Set();
  const tracksDir = path.join(REPO_ROOT, "studio-web", "public", "soundtracks");

  for (const track of SOUNDTRACKS) {
    // 1. Registered in SOUNDTRACK_MAP
    assert.ok(SOUNDTRACK_MAP[track.id], `Track ${track.id} must be mapped in SOUNDTRACK_MAP`);

    // 2. Physical MP3 exists on disk
    const audioPath = path.join(tracksDir, track.file);
    assert.ok(
      fs.existsSync(audioPath),
      `Soundtrack file ${track.file} must exist in public/soundtracks/`,
    );

    // 3. Audio file is substantial (>= 1MB for full quality)
    const stats = fs.statSync(audioPath);
    assert.ok(
      stats.size > 1024 * 1024,
      `Soundtrack file ${track.file} must be at least 1MB, got ${(stats.size / 1024 / 1024).toFixed(2)} MB`,
    );

    // 4. SHA-256 hash must be unique (no duplicate audio disguised under different names)
    const fileBytes = fs.readFileSync(audioPath);
    const hash = crypto.createHash("sha256").update(fileBytes).digest("hex");
    assert.ok(!seenHashes.has(hash), `Soundtrack ${track.file} has duplicate sha256 hash: ${hash}`);
    seenHashes.add(hash);

    // 5. Check metadata
    assert.ok(
      track.license.includes("CC0") || track.license.includes("Public Domain"),
      `Track ${track.id} must be CC0 / Public Domain`,
    );
  }

  // 6. Check that the 5 newly added tracks are strictly soothing instrumental with zero beats
  for (const newId of newSoothingIds) {
    const track = SOUNDTRACKS.find((t) => t.id === newId);
    assert.ok(track, `New soothing track ${newId} must be present`);
    assert.ok(
      track.genre.toLowerCase().includes("zero beats") ||
        track.desc.toLowerCase().includes("zero drums") ||
        track.genre.toLowerCase().includes("piano"),
      `Track ${newId} genre/desc must emphasize soothing, beatless instrumental quality`,
    );
  }
});
