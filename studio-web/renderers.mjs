/**
 * Archetype HTML & CSS Renderers for Studio One.
 *
 * Implements a pluggable registry pattern: each visual archetype registers
 * its HTML builder, GSAP choreography, and scoped CSS rules in one clean place.
 */

export function highlightCodeTokens(line) {
  const safe = String(line ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return safe
    .replace(
      /\b(const|let|var|function|return|import|export|from|await|async|class|new|if|else|typeof|instanceof)\b/g,
      '<span class="t-kw">$1</span>',
    )
    .replace(/(['"`].*?['"`])/g, '<span class="t-str">$1</span>')
    .replace(/\b([a-zA-Z_$][a-zA-Z0-9_$]*)(?=\()/g, '<span class="t-fn">$1</span>');
}

export function resolveScenePalette(scene, basePalette = {}) {
  const theme = scene?.theme;
  if (theme === "dark") {
    return {
      ...basePalette,
      background: "#0b0d14",
      card: "#141724",
      border: "rgba(255, 255, 255, 0.12)",
      text: "#f3f4f8",
      textMuted: "#9ca3af",
      muted: "#9ca3af",
      accent: basePalette.accent || "#6366f1",
      glow: "rgba(99, 102, 241, 0.35)",
      isDark: true,
    };
  }
  if (theme === "accent") {
    return {
      ...basePalette,
      background: basePalette.accent ? `${basePalette.accent}14` : "#f0f4ff",
      card: "#ffffff",
      border: basePalette.accent ? `${basePalette.accent}33` : "rgba(0,0,0,0.1)",
      text: basePalette.text || "#111827",
      textMuted: basePalette.textMuted || "#4b5563",
      muted: basePalette.muted || "#6b7280",
      accent: basePalette.accent || "#6366f1",
      isAccent: true,
    };
  }
  return basePalette;
}

export function formatCompactMetric(val) {
  if (val === undefined || val === null) return "";
  const str = String(val).trim();
  const num = Number(str.replace(/,/g, ""));
  if (!Number.isFinite(num)) return str;

  const abs = Math.abs(num);
  if (abs >= 1_000_000_000) {
    const formatted = (num / 1_000_000_000).toFixed(1).replace(/\.0$/, "");
    return `${formatted}B`;
  }
  if (abs >= 1_000_000) {
    const formatted = (num / 1_000_000).toFixed(1).replace(/\.0$/, "");
    return `${formatted}M`;
  }
  if (abs >= 10_000 || (abs >= 1_000 && num % 1_000 === 0)) {
    const formatted = (num / 1_000).toFixed(1).replace(/\.0$/, "");
    return `${formatted}k`;
  }
  return str;
}

export const ARCHETYPE_RENDERERS = {};

export function registerArchetypeRenderer(id, renderer) {
  const key = id.toLowerCase().trim().replace(/_/g, "-");
  ARCHETYPE_RENDERERS[key] = renderer;
}

// 1. Hook
registerArchetypeRenderer("hook", {
  getBackground: ({ activePalette, scene }) =>
    scene?.theme === "dark" || activePalette?.isDark
      ? `background: radial-gradient(circle at 50% 40%, ${activePalette.accent}24 0%, transparent 70%), #0b0d14;`
      : `background: radial-gradient(circle at 50% 40%, ${activePalette.accent}20 0%, transparent 70%), ${activePalette.background};`,
  renderHtml: ({ scene, i, isPortrait, h }) => {
    // Friction badge is fully payload-driven: render only when the director
    // supplies a shortcut and/or short consumer microcopy (< 35 chars).
    const shortcut = typeof scene.shortcut === "string" ? scene.shortcut.trim() : "";
    let rawNote = typeof scene.visualNote === "string" ? scene.visualNote.trim() : "";
    rawNote = rawNote.replace(/^["'`]|["'`]$/g, "").trim();
    rawNote = rawNote
      .replace(
        /^(editorial\s*opener|scene\s*note|visual\s*note|director(?:'s)?\s*note|note)\s*:?\s*/i,
        "",
      )
      .trim();
    rawNote = rawNote.replace(/^["'`]|["'`]$/g, "").trim();
    const displayNote = rawNote.length > 0 && rawNote.length < 35 ? rawNote : "";
    const frictionHtml =
      shortcut || displayNote
        ? `<div id="s${i + 1}-friction" class="friction-box">
          ${shortcut ? `<span class="keyboard-badge">${h(shortcut)}</span>` : ""}
          ${displayNote ? `<span class="friction-text">${h(displayNote)}</span>` : ""}
        </div>`
        : "";
    return {
      innerHtml: `
      <div class="scene-inner">
        <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || "The Horizon")}</span></div>
        <h1 id="s${i + 1}-title" class="editorial-title" style="font-size: ${isPortrait ? "74px" : "88px"}">${h(scene.title)}<span class="cursor-blink"></span></h1>
        <p id="s${i + 1}-subtitle" class="editorial-subtitle" style="font-size: ${isPortrait ? "30px" : "30px"}">${h(scene.subtitle || "")}</p>
        ${frictionHtml}
      </div>
    `,
      gsapChoreography: `
      tl.from(scope.querySelector("#s${i + 1}-eyebrow"), { opacity: 0, y: 20, duration: 0.5 }, 0.2);
      tl.from(scope.querySelector("#s${i + 1}-title"), { opacity: 0, y: 25, duration: 0.6 }, 0.4);
      tl.from(scope.querySelector("#s${i + 1}-subtitle"), { opacity: 0, y: 20, duration: 0.5 }, 0.8);
      ${frictionHtml ? `tl.from(scope.querySelector("#s${i + 1}-friction"), { opacity: 0, scale: 0.95, duration: 0.5 }, 1.3);` : ""}
    `,
    };
  },
  renderCss: () => ``,
});

// 2. Outro
registerArchetypeRenderer("outro", {
  getBackground: ({ activePalette, scene }) =>
    scene?.theme === "dark" || activePalette?.isDark
      ? `background: radial-gradient(circle at 50% 40%, ${activePalette.accent}24 0%, transparent 70%), #0b0d14;`
      : `background: radial-gradient(circle at 50% 40%, ${activePalette.accent}20 0%, transparent 70%), ${activePalette.background};`,
  renderHtml: ({ scene, i, isPortrait, h }) => {
    const pillsHtml = (scene.pills || ["Direct download", "Instant setup", "Enterprise ready"])
      .map((p) => `<div class="pill-feature"><strong>${h(p)}</strong></div>`)
      .join("\n");
    return {
      innerHtml: `
        <div class="scene-inner">
          <div id="s${i + 1}-card" class="outro-card">
            <div class="eyebrow" style="margin-bottom: 16px"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || "Next Steps")}</span></div>
            <h1 class="editorial-title" style="font-size: ${isPortrait ? "74px" : "80px"}">${h(scene.title)}<span class="brand-dot">.</span></h1>
            <p class="editorial-subtitle" style="font-size: ${isPortrait ? "30px" : "24px"}; margin-top: 14px">${h(scene.subtitle || "")}</p>
            <div class="pricing-pills">${pillsHtml}</div>
            <div class="cta-button"><span>${h(scene.cta || "Get Started Today")}</span><span class="cta-arrow">↗</span></div>
          </div>
        </div>
      `,
      gsapChoreography: `
        tl.from(scope.querySelector("#s${i + 1}-card"), { opacity: 0, y: 40, scale: 0.96, duration: 0.7, ease: "power4.out" }, 0.2);
        tl.from(scope.querySelectorAll(".pill-feature"), { opacity: 0, y: 15, stagger: 0.1, duration: 0.4 }, 0.8);
        tl.from(scope.querySelector(".cta-button"), { opacity: 0, scale: 0.95, duration: 0.5 }, 1.3);
      `,
    };
  },
  renderCss: ({ scene, isPortrait, activePalette }) => {
    const isDark = Boolean(scene?.theme === "dark" || activePalette?.isDark);
    const accent = activePalette?.accent || "#6366f1";
    return `
    [data-composition-id="${scene.id}"] .outro-card {
      background: ${isDark ? "#141724" : activePalette?.card || "#ffffff"};
      border: 1px solid ${isDark ? "rgba(255,255,255,0.12)" : activePalette?.border || "rgba(0,0,0,0.08)"};
      border-radius: 32px;
      padding: ${isPortrait ? "56px 44px" : "60px 80px"};
      box-shadow: ${isDark ? "0 24px 60px rgba(0,0,0,0.5)" : "0 24px 70px rgba(0,0,0,0.06)"};
      text-align: center;
      max-width: ${isPortrait ? "920px" : "1080px"};
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    [data-composition-id="${scene.id}"] .outro-card .editorial-title { color: ${isDark ? "#f3f4f8" : activePalette?.text || "#111827"}; }
    [data-composition-id="${scene.id}"] .outro-card .editorial-subtitle { color: ${isDark ? "#9ca3af" : activePalette?.muted || "#6b7280"}; }
    [data-composition-id="${scene.id}"] .outro-card .eyebrow { color: ${isDark ? "#9ca3af" : activePalette?.textMuted || activePalette?.text || "#111827"}; }
    [data-composition-id="${scene.id}"] .pricing-pills { display: flex; ${isPortrait ? "flex-direction: column; width: 100%;" : ""} gap: 16px; margin: 32px 0 40px; }
    [data-composition-id="${scene.id}"] .pill-feature {
      background: ${isDark ? "#0b0d14" : activePalette?.background || "#f8f9fa"};
      border: 1px solid ${isDark ? "rgba(255,255,255,0.16)" : activePalette?.border || "rgba(0,0,0,0.08)"};
      border-radius: 12px;
      padding: 14px 24px;
      font-size: ${isPortrait ? "20px" : "17px"};
      font-weight: 500;
      color: ${isDark ? "#f3f4f8" : activePalette?.text || "#111827"};
      box-shadow: ${isDark ? "0 4px 16px rgba(0,0,0,0.3)" : "none"};
      transition: all 0.2s ease;
    }
    [data-composition-id="${scene.id}"] .pill-feature strong { color: ${isDark ? "#f3f4f8" : "inherit"}; }
    [data-composition-id="${scene.id}"] .pill-feature:hover {
      border-color: ${isDark ? "rgba(255,255,255,0.3)" : accent};
      box-shadow: ${isDark ? `0 6px 20px rgba(0,0,0,0.4), 0 0 12px ${accent}33` : "0 4px 12px rgba(0,0,0,0.08)"};
    }
    [data-composition-id="${scene.id}"] .cta-button {
      background: ${isDark ? accent : activePalette?.text || "#111827"};
      color: #ffffff;
      font-size: 24px;
      font-weight: 600;
      padding: 20px 48px;
      border-radius: 16px;
      display: inline-flex;
      align-items: center;
      gap: 16px;
      ${isPortrait ? "width: 100%; justify-content: center;" : ""}
      box-shadow: ${isDark ? `0 12px 36px ${accent}55, 0 0 24px ${accent}33` : "0 10px 25px rgba(0,0,0,0.1)"};
      border: 1px solid ${isDark ? "rgba(255,255,255,0.24)" : "transparent"};
      transition: all 0.25s ease;
    }
    [data-composition-id="${scene.id}"] .cta-button:hover {
      box-shadow: ${isDark ? `0 16px 44px ${accent}77, 0 0 32px ${accent}55` : "0 14px 30px rgba(0,0,0,0.15)"};
      transform: translateY(-2px);
    }
    [data-composition-id="${scene.id}"] .cta-arrow { color: ${isDark ? "#ffffff" : accent}; }
  `;
  },
});

// 3. Kinetic Text
registerArchetypeRenderer("kinetic-text", {
  getBackground: ({ activePalette }) =>
    `background: linear-gradient(135deg, ${activePalette.accent}22 0%, transparent 55%), ${activePalette.background};`,
  renderHtml: ({ scene, i, h }) => {
    const mainWord = scene.kineticData?.mainWord || "AUTONOMOUS";
    const accentWord = scene.kineticData?.accentWord || "PRECISION.";
    const subText =
      scene.kineticData?.subtitle ||
      scene.title ||
      "Engineered for deterministic broadcast execution.";
    const badgeText = scene.kineticData?.badge || "Breakthrough Architecture";
    return {
      innerHtml: `
        <div class="scene-inner">
          <div class="ambient-glow"></div>
          <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || "Core Thesis")}</span></div>
          <div class="kinetic-wrapper">
            <div id="s${i + 1}-k-badge" class="kinetic-pill">${h(badgeText)}</div>
            <div id="s${i + 1}-k-main" class="kinetic-hero-title">${h(mainWord)}</div>
            <div id="s${i + 1}-k-accent" class="kinetic-accent-title">${h(accentWord)}</div>
            <p id="s${i + 1}-k-sub" class="kinetic-sub">${h(subText)}</p>
          </div>
        </div>
      `,
      gsapChoreography: `
        tl.fromTo(scope.querySelector(".ambient-glow"), { scale: 0.5, opacity: 0 }, { scale: 1.25, opacity: 0.8, duration: 1.4, ease: "power2.out" }, 0.1);
        tl.from(scope.querySelector("#s${i + 1}-eyebrow"), { opacity: 0, y: 15, duration: 0.4 }, 0.2);
        tl.from(scope.querySelector("#s${i + 1}-k-badge"), { opacity: 0, y: -20, duration: 0.5, ease: "back.out(1.7)" }, 0.35);
        tl.from(scope.querySelector("#s${i + 1}-k-main"), { opacity: 0, scale: 0.88, y: 35, duration: 0.6, ease: "power4.out" }, 0.5);
        tl.from(scope.querySelector("#s${i + 1}-k-accent"), { opacity: 0, scale: 0.9, y: 25, duration: 0.6, ease: "power4.out" }, 0.75);
        tl.from(scope.querySelector("#s${i + 1}-k-sub"), { opacity: 0, y: 18, duration: 0.5 }, 1.05);
        tl.to(scope.querySelector(".kinetic-wrapper"), { y: -12, duration: Math.max(1, sDur - 1.5), ease: "sine.inOut" }, 1.4);
      `,
    };
  },
  renderCss: ({ scene, isPortrait, activePalette }) => `
    [data-composition-id="${scene.id}"] .ambient-glow { position: absolute; width: ${isPortrait ? "700px" : "900px"}; height: ${isPortrait ? "700px" : "900px"}; border-radius: 50%; background: radial-gradient(circle, ${activePalette.accent}25 0%, transparent 70%); filter: blur(60px); pointer-events: none; }
    [data-composition-id="${scene.id}"] .kinetic-wrapper { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: ${isPortrait ? "24px" : "20px"}; margin-top: ${isPortrait ? "60px" : "40px"}; width: 100%; max-width: ${isPortrait ? "940px" : "1300px"}; z-index: 1; }
    [data-composition-id="${scene.id}"] .kinetic-pill { font-family: "JetBrains Mono", monospace; font-size: ${isPortrait ? "20px" : "16px"}; font-weight: 700; color: ${activePalette.accent}; background: rgba(0,0,0,0.06); border: 1.5px solid ${activePalette.accent}55; padding: 8px 24px; border-radius: 30px; letter-spacing: 0.1em; text-transform: uppercase; }
    [data-composition-id="${scene.id}"] .kinetic-hero-title { font-family: "Playfair Display", serif; font-size: ${isPortrait ? "108px" : "120px"}; font-weight: 900; line-height: 0.95; letter-spacing: -0.04em; color: ${activePalette.text}; text-transform: uppercase; }
    [data-composition-id="${scene.id}"] .kinetic-accent-title { font-family: "Playfair Display", serif; font-size: ${isPortrait ? "108px" : "120px"}; font-weight: 900; line-height: 0.95; letter-spacing: -0.04em; color: ${activePalette.accent}; text-transform: uppercase; text-shadow: 0 10px 40px ${activePalette.accent}33; }
    [data-composition-id="${scene.id}"] .kinetic-sub { font-size: ${isPortrait ? "32px" : "26px"}; color: ${activePalette.textMuted || activePalette.text}; max-width: ${isPortrait ? "840px" : "900px"}; line-height: 1.5; margin-top: 10px; }
  `,
});

// 4. Mobile Mockup
registerArchetypeRenderer("mobile-mockup", {
  renderHtml: ({ scene, i, isPortrait, h }) => {
    const appTitle = scene.mockupData?.appTitle || "Studio One Mobile";
    const headerBadge = scene.mockupData?.headerBadge || "Active Engine";
    const rawItems = scene.mockupData?.items || [
      { title: "Realtime Ingestion", desc: "4K Composition Ready in 18ms", time: "Just now" },
      { title: "Neural Orchestration", desc: "Deterministic audio & frame sync", time: "1m ago" },
      { title: "Zero Cloud Leak", desc: "Local GPU hardware synthesis", time: "3m ago" },
    ];
    const items = rawItems.map((it, idx) =>
      typeof it === "string"
        ? { title: it, desc: "", time: "Live" }
        : {
            title: it?.title || it?.name || `Notification ${idx + 1}`,
            desc: it?.desc || "",
            time: it?.time || "Now",
          },
    );
    return {
      innerHtml: `
        <div class="scene-inner">
          <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || "Mobile Experience")}</span></div>
          <h2 id="s${i + 1}-title" class="editorial-title" style="font-size: ${isPortrait ? "64px" : "68px"}">${h(scene.title)}</h2>
          <div class="mobile-phone-frame">
            <div class="phone-speaker"></div>
            <div class="phone-island"><div class="island-camera"></div><div class="island-indicator"></div></div>
            <div class="phone-screen">
              <div class="phone-status-bar"><span>9:41</span><span class="phone-icons">5G ▮▮▮</span></div>
              <div class="phone-app-header">
                <div class="app-avatar">✦</div>
                <div class="app-meta">
                  <div class="app-name">${h(appTitle)}</div>
                  <div class="app-status">${h(headerBadge)}</div>
                </div>
              </div>
              <div class="phone-content-stream">
                ${items
                  .map(
                    (it, idx) => `
                  <div class="phone-card" id="s${i + 1}-pcard-${idx}">
                    <span class="pcard-badge">LIVE EVENT</span>
                    <div class="pcard-title">${h(it.title)}</div>
                    <div class="pcard-desc">${h(it.desc)}</div>
                    <div class="pcard-time">${h(it.time)}</div>
                  </div>
                `,
                  )
                  .join("")}
              </div>
              <div class="phone-home-indicator"></div>
            </div>
          </div>
        </div>
      `,
      gsapChoreography: `
        tl.from(scope.querySelector("#s${i + 1}-eyebrow"), { opacity: 0, y: 15, duration: 0.4 }, 0.2);
        tl.from(scope.querySelector("#s${i + 1}-title"), { opacity: 0, y: 20, duration: 0.5 }, 0.4);
        tl.from(scope.querySelector(".mobile-phone-frame"), { opacity: 0, y: 60, scale: 0.94, duration: 0.7, ease: "power4.out" }, 0.6);
        scope.querySelectorAll(".phone-card").forEach((card, idx) => {
          tl.from(card, { opacity: 0, y: 20, duration: 0.4, ease: "back.out(1.5)" }, 0.9 + (idx * 0.25));
        });
      `,
    };
  },
  renderCss: ({ scene, isPortrait, activePalette }) => `
    [data-composition-id="${scene.id}"] .mobile-phone-frame { width: ${isPortrait ? "720px" : "440px"}; height: ${isPortrait ? "1100px" : "740px"}; background: #0c0d12; border: 14px solid #1e2029; border-radius: 54px; margin-top: 36px; box-shadow: 0 30px 80px rgba(0,0,0,0.5), inset 0 0 0 2px rgba(255,255,255,0.1); position: relative; overflow: hidden; display: flex; flex-direction: column; }
    [data-composition-id="${scene.id}"] .phone-speaker { width: 60px; height: 5px; background: #2c2e3d; border-radius: 4px; position: absolute; top: 10px; left: 50%; transform: translateX(-50%); z-index: 10; }
    [data-composition-id="${scene.id}"] .phone-island { width: 120px; height: 28px; background: #000; border-radius: 16px; position: absolute; top: 18px; left: 50%; transform: translateX(-50%); z-index: 10; display: flex; align-items: center; justify-content: space-between; padding: 0 14px; }
    [data-composition-id="${scene.id}"] .island-camera { width: 10px; height: 10px; border-radius: 50%; background: #131728; border: 1px solid #202740; }
    [data-composition-id="${scene.id}"] .island-indicator { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; }
    [data-composition-id="${scene.id}"] .phone-screen { width: 100%; height: 100%; display: flex; flex-direction: column; padding: 50px 28px 24px; box-sizing: border-box; text-align: left; }
    [data-composition-id="${scene.id}"] .phone-status-bar { display: flex; justify-content: space-between; font-family: "JetBrains Mono", monospace; font-size: 14px; color: #8892b0; margin-bottom: 20px; }
    [data-composition-id="${scene.id}"] .phone-app-header { display: flex; align-items: center; gap: 14px; padding-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.08); margin-bottom: 20px; }
    [data-composition-id="${scene.id}"] .app-avatar { width: 44px; height: 44px; border-radius: 14px; background: ${activePalette.accent}; color: ${activePalette.accentText || "#fff"}; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 700; }
    [data-composition-id="${scene.id}"] .app-name { font-family: "Playfair Display", serif; font-size: 20px; font-weight: 700; color: #fff; }
    [data-composition-id="${scene.id}"] .app-status { font-family: "JetBrains Mono", monospace; font-size: 12px; color: #34d399; }
    [data-composition-id="${scene.id}"] .phone-content-stream { display: flex; flex-direction: column; gap: 16px; flex: 1; }
    [data-composition-id="${scene.id}"] .phone-card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 18px; padding: 20px 22px; display: flex; flex-direction: column; gap: 6px; }
    [data-composition-id="${scene.id}"] .pcard-badge { align-self: flex-start; font-family: "JetBrains Mono", monospace; font-size: 11px; font-weight: 700; background: ${activePalette.accent}33; color: ${activePalette.accent}; padding: 2px 8px; border-radius: 6px; }
    [data-composition-id="${scene.id}"] .pcard-title { font-family: "Playfair Display", serif; font-size: ${isPortrait ? "24px" : "18px"}; font-weight: 700; color: #fff; }
    [data-composition-id="${scene.id}"] .pcard-desc { font-size: ${isPortrait ? "17px" : "14px"}; color: #94a3b8; }
    [data-composition-id="${scene.id}"] .pcard-time { font-family: "JetBrains Mono", monospace; font-size: 12px; color: #64748b; margin-top: 4px; }
    [data-composition-id="${scene.id}"] .phone-home-indicator { width: 140px; height: 5px; background: rgba(255,255,255,0.3); border-radius: 4px; align-self: center; margin-top: auto; }
  `,
});

// 5. Radial Orbit
registerArchetypeRenderer("radial-orbit", {
  getBackground: ({ activePalette }) =>
    `background: radial-gradient(circle at 50% 50%, ${activePalette.accent}24 0%, transparent 65%), ${activePalette.background};`,
  renderHtml: ({ scene, i, isPortrait, h }) => {
    const centerTitle = scene.orbitData?.centerTitle || "Core Engine";
    const centerSub = scene.orbitData?.centerSub || "Autonomous Pipeline";
    const rawSatellites = scene.orbitData?.satellites || [
      { label: "Deterministic Render", desc: "Pixel-perfect lockstep" },
      { label: "Hardware Capture", desc: "GPU accelerated capture" },
      { label: "Semantic Scripts", desc: "Source grounded" },
      { label: "Neural Audio", desc: "Studio broadcast timbre" },
    ];
    const satellites = rawSatellites.map((s, idx) =>
      typeof s === "string"
        ? { label: s, desc: "" }
        : { label: s?.label || s?.title || `Node ${idx + 1}`, desc: s?.desc || "" },
    );
    return {
      innerHtml: `
        <div class="scene-inner">
          <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || "Architecture Hub")}</span></div>
          <h2 id="s${i + 1}-title" class="editorial-title" style="font-size: ${isPortrait ? "64px" : "68px"}">${h(scene.title)}</h2>
          <div class="orbit-stage">
            <svg class="orbit-svg" viewBox="0 0 700 700">
              <circle class="orbit-ring orbit-ring-outer" cx="350" cy="350" r="280" />
              <circle class="orbit-ring orbit-ring-inner" cx="350" cy="350" r="170" />
            </svg>
            <div id="s${i + 1}-orb-center" class="orbit-center-node">
              <span class="orb-pulse-dot"></span>
              <div class="orb-center-title">${h(centerTitle)}</div>
              <div class="orb-center-sub">${h(centerSub)}</div>
            </div>
            ${satellites
              .slice(0, 4)
              .map(
                (s, sIdx) => `
              <div class="orbit-satellite sat-pos-${sIdx}" id="s${i + 1}-sat-${sIdx}">
                <span class="sat-tag">0${sIdx + 1}</span>
                <div class="sat-label">${h(s.label)}</div>
                <div class="sat-desc">${h(s.desc)}</div>
              </div>
            `,
              )
              .join("")}
          </div>
        </div>
      `,
      gsapChoreography: `
        tl.from(scope.querySelector("#s${i + 1}-eyebrow"), { opacity: 0, y: 15, duration: 0.4 }, 0.2);
        tl.from(scope.querySelector("#s${i + 1}-title"), { opacity: 0, y: 20, duration: 0.5 }, 0.4);
        tl.from(scope.querySelector(".orbit-center-node"), { opacity: 0, scale: 0.4, duration: 0.6, ease: "back.out(1.8)" }, 0.6);
        tl.fromTo(scope.querySelectorAll(".orbit-ring"), { strokeDashoffset: 1800 }, { strokeDashoffset: 0, duration: 1.6, ease: "power2.out" }, 0.7);
        scope.querySelectorAll(".orbit-satellite").forEach((sat, idx) => {
          tl.from(sat, { opacity: 0, scale: 0.5, duration: 0.5, ease: "back.out(1.5)" }, 1.0 + (idx * 0.22));
        });
      `,
    };
  },
  renderCss: ({ scene, isPortrait, activePalette }) => `
    [data-composition-id="${scene.id}"] .orbit-stage { position: relative; width: ${isPortrait ? "780px" : "700px"}; height: ${isPortrait ? "780px" : "700px"}; margin-top: 36px; display: flex; align-items: center; justify-content: center; }
    [data-composition-id="${scene.id}"] .orbit-svg { position: absolute; inset: 0; width: 100%; height: 100%; }
    [data-composition-id="${scene.id}"] .orbit-ring { fill: none; stroke: ${activePalette.border}; stroke-width: 2; stroke-dasharray: 8 8; }
    [data-composition-id="${scene.id}"] .orbit-center-node { width: 220px; height: 220px; border-radius: 50%; background: ${activePalette.card}; border: 2px solid ${activePalette.accent}; box-shadow: 0 0 50px ${activePalette.accent}33; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 20px; z-index: 5; }
    [data-composition-id="${scene.id}"] .orb-pulse-dot { width: 12px; height: 12px; border-radius: 50%; background: ${activePalette.accent}; margin-bottom: 8px; box-shadow: 0 0 14px ${activePalette.accent}; }
    [data-composition-id="${scene.id}"] .orb-center-title { font-family: "Playfair Display", serif; font-size: 26px; font-weight: 700; color: ${activePalette.text}; }
    [data-composition-id="${scene.id}"] .orb-center-sub { font-family: "JetBrains Mono", monospace; font-size: 13px; color: ${activePalette.textMuted || activePalette.text}; margin-top: 4px; }
    [data-composition-id="${scene.id}"] .orbit-satellite { position: absolute; background: ${activePalette.card}; border: 1px solid ${activePalette.border}; border-radius: 20px; padding: 18px 24px; box-shadow: 0 12px 30px rgba(0,0,0,0.06); text-align: left; width: 240px; z-index: 6; }
    [data-composition-id="${scene.id}"] .sat-tag { font-family: "JetBrains Mono", monospace; font-size: 12px; font-weight: 700; color: ${activePalette.accent}; }
    [data-composition-id="${scene.id}"] .sat-label { font-family: "Playfair Display", serif; font-size: 20px; font-weight: 700; color: ${activePalette.text}; margin: 4px 0 2px; }
    [data-composition-id="${scene.id}"] .sat-desc { font-size: 14px; color: ${activePalette.textMuted || activePalette.text}; }
    [data-composition-id="${scene.id}"] .sat-pos-0 { top: 30px; left: 30px; }
    [data-composition-id="${scene.id}"] .sat-pos-1 { top: 30px; right: 30px; }
    [data-composition-id="${scene.id}"] .sat-pos-2 { bottom: 30px; left: 30px; }
    [data-composition-id="${scene.id}"] .sat-pos-3 { bottom: 30px; right: 30px; }
  `,
});

// 6. Step Ladder
registerArchetypeRenderer("step-ladder", {
  getBackground: ({ isPortrait, activePalette }) =>
    `background: radial-gradient(circle at ${isPortrait ? "50% 50%" : "74% 50%"}, ${activePalette.accent}18 0%, transparent 60%), ${activePalette.background};`,
  renderHtml: ({ scene, i, isPortrait, h }) => {
    const rawSteps = scene.stepData?.steps || [
      {
        stepNumber: "01",
        title: "Source Parsing",
        desc: "Deep extraction of specs and briefs",
        status: "Active",
      },
      {
        stepNumber: "02",
        title: "Dynamic Choreography",
        desc: "Kinetic motion vectors mapped to voice cadence",
        status: "Active",
      },
      {
        stepNumber: "03",
        title: "Master 4K Synthesis",
        desc: "Single-pass GPU capture & stereo mastering",
        status: "Complete",
      },
    ];
    const steps = rawSteps.map((st, idx) =>
      typeof st === "string"
        ? { stepNumber: `0${idx + 1}`, title: st, desc: "", status: "Active" }
        : {
            stepNumber: st?.stepNumber || `0${idx + 1}`,
            title: st?.title || `Stage ${idx + 1}`,
            desc: st?.desc || "",
            status: st?.status || "Active",
          },
    );
    const innerHtml = isPortrait
      ? `
      <div class="scene-inner">
        <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || "Methodology")}</span></div>
        <h2 id="s${i + 1}-title" class="editorial-title" style="font-size: 64px">${h(scene.title)}</h2>
        <div class="ladder-container">
          <div class="ladder-track"><div id="s${i + 1}-ladder-fill" class="ladder-fill"></div></div>
          <div class="ladder-steps">
            ${steps
              .map(
                (st, idx) => `
              <div class="ladder-step-row" id="s${i + 1}-lstep-${idx}">
                <div class="step-marker"><span class="step-num">${h(st.stepNumber || `0${idx + 1}`)}</span></div>
                <div class="step-card">
                  <div class="step-header">
                    <span class="step-title">${h(st.title)}</span>
                    <span class="step-badge">${h(st.status || "Active")}</span>
                  </div>
                  <div class="step-desc">${h(st.desc)}</div>
                </div>
              </div>
            `,
              )
              .join("")}
          </div>
        </div>
      </div>
    `
      : `
      <div class="scene-inner split-hero-layout">
        <div class="split-col-left">
          <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || "Methodology")}</span></div>
          <h2 id="s${i + 1}-title" class="split-hero-title">${h(scene.title)}</h2>
          <p id="s${i + 1}-subtitle" class="split-hero-sub">${h(scene.subtitle || "Structured milestone progression with validated phase gates.")}</p>
          <div class="split-hero-badge"><span class="accent-spark">✦</span><span>Milestone Progression</span></div>
        </div>
        <div class="split-col-right">
          <div class="ladder-container ladder-split">
            <div class="ladder-track"><div id="s${i + 1}-ladder-fill" class="ladder-fill"></div></div>
            <div class="ladder-steps">
              ${steps
                .map(
                  (st, idx) => `
                <div class="ladder-step-row" id="s${i + 1}-lstep-${idx}">
                  <div class="step-marker"><span class="step-num">${h(st.stepNumber || `0${idx + 1}`)}</span></div>
                  <div class="step-card">
                    <div class="step-header">
                      <span class="step-title">${h(st.title)}</span>
                      <span class="step-badge">${h(st.status || "Active")}</span>
                    </div>
                    <div class="step-desc">${h(st.desc)}</div>
                  </div>
                </div>
              `,
                )
                .join("")}
            </div>
          </div>
        </div>
      </div>
    `;
    return {
      innerHtml,
      gsapChoreography: `
        tl.from(scope.querySelector("#s${i + 1}-eyebrow"), { opacity: 0, y: 15, duration: 0.4 }, 0.2);
        tl.from(scope.querySelector("#s${i + 1}-title"), { opacity: 0, y: 20, duration: 0.5 }, 0.4);
        tl.fromTo(scope.querySelector(".ladder-fill"), { scaleY: 0, transformOrigin: "top" }, { scaleY: 1, duration: 1.8, ease: "power2.inOut" }, 0.6);
        scope.querySelectorAll(".ladder-step-row").forEach((r, idx) => {
          tl.from(r, { opacity: 0, x: -30, duration: 0.5, ease: "power3.out" }, 0.8 + (idx * 0.35));
        });
      `,
    };
  },
  renderCss: ({ scene, isPortrait, activePalette }) => `
    [data-composition-id="${scene.id}"] .ladder-container { display: flex; gap: 32px; width: 100%; max-width: ${isPortrait ? "920px" : "1100px"}; height: ${isPortrait ? "840px" : "480px"}; margin-top: 36px; text-align: left; align-items: stretch; }
    [data-composition-id="${scene.id}"] .ladder-track { width: 6px; background: ${activePalette.border}; border-radius: 3px; position: relative; }
    [data-composition-id="${scene.id}"] .ladder-fill { position: absolute; inset: 0; background: ${activePalette.accent}; border-radius: 3px; transform-origin: top; }
    [data-composition-id="${scene.id}"] .ladder-steps { display: flex; flex-direction: column; justify-content: space-between; flex: 1; }
    [data-composition-id="${scene.id}"] .ladder-step-row { display: flex; align-items: center; gap: 24px; }
    [data-composition-id="${scene.id}"] .step-marker { width: 50px; height: 50px; border-radius: 50%; background: ${activePalette.card}; border: 2px solid ${activePalette.accent}; display: flex; align-items: center; justify-content: center; font-family: "JetBrains Mono", monospace; font-size: 18px; font-weight: 700; color: ${activePalette.accent}; box-shadow: 0 0 20px ${activePalette.accent}33; flex-shrink: 0; }
    [data-composition-id="${scene.id}"] .step-card { flex: 1; background: ${activePalette.card}; border: 1px solid ${activePalette.border}; border-radius: 20px; padding: 24px 30px; box-shadow: 0 12px 30px rgba(0,0,0,0.04); }
    [data-composition-id="${scene.id}"] .step-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
    [data-composition-id="${scene.id}"] .step-title { font-family: "Playfair Display", serif; font-size: ${isPortrait ? "28px" : "24px"}; font-weight: 700; color: ${activePalette.text}; }
    [data-composition-id="${scene.id}"] .step-badge { font-family: "JetBrains Mono", monospace; font-size: 13px; font-weight: 600; color: ${activePalette.accent}; background: rgba(0,0,0,0.04); padding: 4px 12px; border-radius: 10px; }
    [data-composition-id="${scene.id}"] .step-desc { font-size: ${isPortrait ? "20px" : "16px"}; color: ${activePalette.textMuted || activePalette.text}; }
  `,
});

// 7. Live Feed
registerArchetypeRenderer("live-feed", {
  getBackground: ({ isPortrait, activePalette }) =>
    `background: radial-gradient(circle at ${isPortrait ? "50% 50%" : "74% 50%"}, ${activePalette.accent}18 0%, transparent 60%), ${activePalette.background};`,
  renderHtml: ({ scene, i, isPortrait, h }) => {
    const rawItems = scene.feedData?.items || [
      { icon: "⚡", text: "Zero Cold Start Execution", tag: "1.2ms", status: "Optimal" },
      { icon: "🔒", text: "End-to-End Cryptographic Privacy", tag: "Local", status: "Verified" },
      { icon: "✦", text: "Autonomous Motion Direction", tag: "AI Director", status: "Active" },
      { icon: "✓", text: "Studio Grade 4K Render Engine", tag: "60 FPS", status: "Mastered" },
    ];
    const items = rawItems.map((it, idx) =>
      typeof it === "string"
        ? { icon: "✦", text: it, tag: "Live", status: "Active" }
        : {
            icon: it?.icon || "✦",
            text: it?.text || it?.title || `Event ${idx + 1}`,
            tag: it?.tag || "Active",
            status: it?.status || "OK",
          },
    );
    const innerHtml = isPortrait
      ? `
      <div class="scene-inner">
        <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || "Realtime Activity")}</span></div>
        <h2 id="s${i + 1}-title" class="editorial-title" style="font-size: 64px">${h(scene.title)}</h2>
        <div class="live-feed-stream">
          ${items
            .map(
              (it, idx) => `
            <div class="feed-item-pill" id="s${i + 1}-fitem-${idx}">
              <span class="feed-pulse-dot"></span>
              <span class="feed-icon">${h(it.icon || "✦")}</span>
              <span class="feed-text">${h(it.text)}</span>
              <span class="feed-tag">${h(it.tag || "Fast")}</span>
              <span class="feed-status">${h(it.status || "OK")}</span>
            </div>
          `,
            )
            .join("")}
        </div>
      </div>
    `
      : `
      <div class="scene-inner split-hero-layout">
        <div class="split-col-left">
          <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || "Realtime Telemetry")}</span></div>
          <h2 id="s${i + 1}-title" class="split-hero-title">${h(scene.title)}</h2>
          <p id="s${i + 1}-subtitle" class="split-hero-sub">${h(scene.subtitle || "Continuous automated telemetry streaming with verified frame persistence.")}</p>
          <div class="split-hero-badge"><span class="accent-spark">✦</span><span>Live Stream</span></div>
        </div>
        <div class="split-col-right">
          <div class="live-feed-stream live-feed-split">
            ${items
              .map(
                (it, idx) => `
              <div class="feed-item-pill" id="s${i + 1}-fitem-${idx}">
                <span class="feed-pulse-dot"></span>
                <span class="feed-icon">${h(it.icon || "✦")}</span>
                <span class="feed-text">${h(it.text)}</span>
                <span class="feed-tag">${h(it.tag || "Fast")}</span>
                <span class="feed-status">${h(it.status || "OK")}</span>
              </div>
            `,
              )
              .join("")}
          </div>
        </div>
      </div>
    `;
    return {
      innerHtml,
      gsapChoreography: `
        tl.from(scope.querySelector("#s${i + 1}-eyebrow"), { opacity: 0, y: 15, duration: 0.4 }, 0.2);
        tl.from(scope.querySelector("#s${i + 1}-title"), { opacity: 0, y: 20, duration: 0.5 }, 0.4);
        scope.querySelectorAll(".feed-item-pill").forEach((f, idx) => {
          tl.from(f, { opacity: 0, y: 30, scale: 0.96, duration: 0.5, ease: "power4.out" }, 0.7 + (idx * 0.22));
        });
      `,
    };
  },
  renderCss: ({ scene, isPortrait, activePalette }) => `
    [data-composition-id="${scene.id}"] .live-feed-stream { display: flex; flex-direction: column; gap: 20px; width: 100%; max-width: ${isPortrait ? "920px" : "1100px"}; margin-top: 40px; }
    [data-composition-id="${scene.id}"] .feed-item-pill { background: ${activePalette.card}; border: 1px solid ${activePalette.border}; border-radius: 24px; padding: ${isPortrait ? "24px 32px" : "20px 28px"}; display: flex; align-items: center; gap: 18px; box-shadow: 0 12px 30px rgba(0,0,0,0.04); text-align: left; }
    [data-composition-id="${scene.id}"] .feed-pulse-dot { width: 12px; height: 12px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 12px #22c55e; flex-shrink: 0; }
    [data-composition-id="${scene.id}"] .feed-icon { font-size: 24px; color: ${activePalette.accent}; }
    [data-composition-id="${scene.id}"] .feed-text { font-family: "Playfair Display", serif; font-size: ${isPortrait ? "26px" : "22px"}; font-weight: 700; color: ${activePalette.text}; flex: 1; }
    [data-composition-id="${scene.id}"] .feed-tag { font-family: "JetBrains Mono", monospace; font-size: 14px; font-weight: 600; color: ${activePalette.textMuted || activePalette.text}; background: rgba(0,0,0,0.05); padding: 4px 12px; border-radius: 8px; }
    [data-composition-id="${scene.id}"] .feed-status { font-family: "JetBrains Mono", monospace; font-size: 14px; font-weight: 700; color: #15803d; }
  `,
});

// 8. Isometric Stack
registerArchetypeRenderer("isometric-stack", {
  renderHtml: ({ scene, i, isPortrait, h }) => {
    const rawLayers = scene.stackData?.layers || [
      {
        name: "Presentation & Surface",
        tech: "HyperFrames IIFE Runtime",
        role: "Declarative Video DOM",
      },
      {
        name: "Autonomous Direction",
        tech: "Semantic Choreography Core",
        role: "Tone & Kinetic Vectoring",
      },
      {
        name: "Hardware Engine",
        tech: "Puppeteer & GPU Pipeline",
        role: "Deterministic Frame Capture",
      },
    ];
    const layers = rawLayers.map((l, idx) =>
      typeof l === "string"
        ? { name: l, tech: "Core", role: `Layer ${idx + 1}` }
        : {
            name: l?.name || l?.title || `Layer ${idx + 1}`,
            tech: l?.tech || "Core Component",
            role: l?.role || `Architecture Tier ${idx + 1}`,
          },
    );
    return {
      innerHtml: `
        <div class="scene-inner">
          <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || "Layered Systems")}</span></div>
          <h2 id="s${i + 1}-title" class="editorial-title" style="font-size: ${isPortrait ? "64px" : "68px"}">${h(scene.title)}</h2>
          <div class="isometric-container">
            ${layers
              .map(
                (l, idx) => `
              <div class="iso-slab" id="s${i + 1}-slab-${idx}">
                <div class="iso-badge">L0${3 - idx}</div>
                <div class="iso-info">
                  <div class="iso-name">${h(l.name)}</div>
                  <div class="iso-role">${h(l.role)}</div>
                </div>
                <div class="iso-tech">${h(l.tech)}</div>
              </div>
            `,
              )
              .join("")}
          </div>
        </div>
      `,
      gsapChoreography: `
        tl.from(scope.querySelector("#s${i + 1}-eyebrow"), { opacity: 0, y: 15, duration: 0.4 }, 0.2);
        tl.from(scope.querySelector("#s${i + 1}-title"), { opacity: 0, y: 20, duration: 0.5 }, 0.4);
        scope.querySelectorAll(".iso-slab").forEach((sl, idx) => {
          tl.from(sl, { opacity: 0, y: 40, duration: 0.6, ease: "power4.out" }, 0.7 + (idx * 0.25));
        });
      `,
    };
  },
  renderCss: ({ scene, isPortrait, activePalette }) => `
    [data-composition-id="${scene.id}"] .isometric-container { display: flex; flex-direction: column; gap: 24px; width: 100%; max-width: ${isPortrait ? "920px" : "1200px"}; margin-top: 40px; }
    [data-composition-id="${scene.id}"] .iso-slab { background: ${activePalette.card}; border: 1px solid ${activePalette.border}; border-left: 8px solid ${activePalette.accent}; border-radius: 20px; padding: 28px 36px; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 16px 40px rgba(0,0,0,0.05); text-align: left; }
    [data-composition-id="${scene.id}"] .iso-badge { font-family: "JetBrains Mono", monospace; font-size: 20px; font-weight: 700; color: ${activePalette.accent}; width: 60px; }
    [data-composition-id="${scene.id}"] .iso-info { flex: 1; }
    [data-composition-id="${scene.id}"] .iso-name { font-family: "Playfair Display", serif; font-size: 26px; font-weight: 700; color: ${activePalette.text}; }
    [data-composition-id="${scene.id}"] .iso-role { font-size: 16px; color: ${activePalette.textMuted || activePalette.text}; margin-top: 4px; }
    [data-composition-id="${scene.id}"] .iso-tech { font-family: "JetBrains Mono", monospace; font-size: 15px; color: ${activePalette.textMuted || activePalette.text}; background: rgba(0,0,0,0.04); padding: 6px 14px; border-radius: 10px; }
  `,
});

// 9. Metric Stat
registerArchetypeRenderer("metric-stat", {
  getBackground: ({ isPortrait, activePalette }) =>
    `background: radial-gradient(circle at ${isPortrait ? "50% 45%" : "74% 50%"}, ${activePalette.accent}30 0%, transparent 60%), ${activePalette.background};`,
  renderHtml: ({ scene, i, isPortrait, h }) => {
    const val = scene.metric?.value || "10x";
    const label = scene.metric?.label || "Accelerated Execution Speed";
    const badge = scene.metric?.badge || "Benchmarked vs Manual Production";
    const subPills = scene.metric?.subPills || ["Deterministic 4K", "Zero Cloud Latency"];
    const innerHtml = isPortrait
      ? `
      <div class="scene-inner">
        <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || "Performance Metric")}</span></div>
        <h2 id="s${i + 1}-title" class="editorial-title" style="font-size: 64px">${h(scene.title)}</h2>
        <div id="s${i + 1}-metric-box" class="metric-hero-box portrait-metric">
          <div class="metric-circle-wrap">
            <svg class="metric-svg" viewBox="0 0 200 200">
              <circle class="metric-bg-circle" cx="100" cy="100" r="85" />
              <circle id="s${i + 1}-ring" class="metric-ring" cx="100" cy="100" r="85" />
            </svg>
            <div id="s${i + 1}-val" class="metric-number">${h(val)}</div>
          </div>
          <div class="metric-info">
            <div id="s${i + 1}-label" class="metric-label">${h(label)}</div>
            <div id="s${i + 1}-badge" class="metric-badge">${h(badge)}</div>
            <div class="metric-pills">
              ${subPills.map((p) => `<span class="metric-sub-pill">${h(p)}</span>`).join("")}
            </div>
          </div>
        </div>
      </div>
    `
      : `
      <div class="scene-inner split-hero-layout">
        <div class="split-col-left">
          <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || "Performance Metric")}</span></div>
          <h2 id="s${i + 1}-title" class="split-hero-title">${h(scene.title)}</h2>
          <p id="s${i + 1}-subtitle" class="split-hero-sub">${h(scene.subtitle || label || "Quantitative leap over conventional manual workflows.")}</p>
          <div class="split-hero-badge"><span class="accent-spark">✦</span><span>${h(badge || "Verified Metric")}</span></div>
        </div>
        <div class="split-col-right">
          <div id="s${i + 1}-metric-box" class="metric-hero-box">
            <div class="metric-circle-wrap">
              <svg class="metric-svg" viewBox="0 0 200 200">
                <circle class="metric-bg-circle" cx="100" cy="100" r="85" />
                <circle id="s${i + 1}-ring" class="metric-ring" cx="100" cy="100" r="85" />
              </svg>
              <div id="s${i + 1}-val" class="metric-number">${h(val)}</div>
            </div>
            <div class="metric-info">
              <div id="s${i + 1}-label" class="metric-label">${h(label)}</div>
              <div id="s${i + 1}-badge" class="metric-badge">${h(badge)}</div>
              <div class="metric-pills">
                ${subPills.map((p) => `<span class="metric-sub-pill">${h(p)}</span>`).join("")}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    return {
      innerHtml,
      gsapChoreography: `
        tl.from(scope.querySelector("#s${i + 1}-eyebrow"), { opacity: 0, y: 15, duration: 0.4 }, 0.2);
        tl.from(scope.querySelector("#s${i + 1}-title"), { opacity: 0, y: 20, duration: 0.5 }, 0.4);
        tl.from(scope.querySelector("#s${i + 1}-metric-box"), { opacity: 0, scale: 0.94, duration: 0.6, ease: "power4.out" }, 0.7);
        tl.from(scope.querySelector("#s${i + 1}-val"), { scale: 0.7, opacity: 0, duration: 0.6, ease: "back.out(1.7)" }, 0.9);
        tl.fromTo(scope.querySelector("#s${i + 1}-ring"), { strokeDashoffset: 534 }, { strokeDashoffset: 140, duration: 1.4, ease: "power2.out" }, 0.8);
        tl.from(scope.querySelector("#s${i + 1}-label"), { opacity: 0, y: 15, duration: 0.5 }, 1.1);
        tl.from(scope.querySelector("#s${i + 1}-badge"), { opacity: 0, scale: 0.9, duration: 0.4 }, 1.4);
        tl.from(scope.querySelectorAll(".metric-sub-pill"), { opacity: 0, y: 10, stagger: 0.15, duration: 0.4 }, 1.7);
      `,
    };
  },
  renderCss: ({ scene, isPortrait, activePalette }) => `
    [data-composition-id="${scene.id}"] .metric-hero-box { display: flex; align-items: center; gap: 60px; background: ${activePalette.card}; border: 1px solid ${activePalette.border}; border-radius: 32px; padding: 48px 64px; margin-top: 40px; box-shadow: 0 20px 60px rgba(0,0,0,0.06); }
    [data-composition-id="${scene.id}"] .portrait-metric { flex-direction: column; width: 100%; max-width: 920px; padding: 50px 36px; gap: 36px; text-align: center; }
    [data-composition-id="${scene.id}"] .metric-circle-wrap { position: relative; width: ${isPortrait ? "240px" : "180px"}; height: ${isPortrait ? "240px" : "180px"}; display: flex; align-items: center; justify-content: center; }
    [data-composition-id="${scene.id}"] .metric-svg { width: 100%; height: 100%; transform: rotate(-90deg); }
    [data-composition-id="${scene.id}"] .metric-bg-circle { fill: none; stroke: ${activePalette.border}; stroke-width: 12; }
    [data-composition-id="${scene.id}"] .metric-ring { fill: none; stroke: ${activePalette.accent}; stroke-width: 12; stroke-linecap: round; stroke-dasharray: 534; stroke-dashoffset: 534; }
    [data-composition-id="${scene.id}"] .metric-number { position: absolute; font-family: "Playfair Display", serif; font-size: ${isPortrait ? "72px" : "56px"}; font-weight: 700; color: ${activePalette.accent}; }
    [data-composition-id="${scene.id}"] .metric-info { display: flex; flex-direction: column; align-items: ${isPortrait ? "center" : "flex-start"}; text-align: ${isPortrait ? "center" : "left"}; gap: 12px; }
    [data-composition-id="${scene.id}"] .metric-label { font-family: "Playfair Display", serif; font-size: ${isPortrait ? "40px" : "36px"}; font-weight: 700; color: ${activePalette.text}; }
    [data-composition-id="${scene.id}"] .metric-badge { font-family: "JetBrains Mono", monospace; font-size: 16px; color: ${activePalette.textMuted || activePalette.text}; background: rgba(0,0,0,0.04); border: 1px solid ${activePalette.border}; padding: 6px 18px; border-radius: 20px; }
    [data-composition-id="${scene.id}"] .metric-pills { display: flex; gap: 14px; margin-top: 8px; flex-wrap: wrap; justify-content: center; }
    [data-composition-id="${scene.id}"] .metric-sub-pill { font-size: 16px; font-weight: 500; color: ${activePalette.text}; background: ${activePalette.background}; border: 1px solid ${activePalette.border}; padding: 8px 20px; border-radius: 12px; }
  `,
});

// 10. Architecture Pipeline
registerArchetypeRenderer("architecture-pipeline", {
  renderHtml: ({ scene, i, isPortrait, h }) => {
    const n1 = scene.pipeline?.node1 || { title: "Raw Input", desc: "Documents & Specs" };
    const n2 = scene.pipeline?.node2 || { title: "Neural Director", desc: "Semantic Choreography" };
    const n3 = scene.pipeline?.node3 || { title: "Master Studio", desc: "Broadcast Render" };
    return {
      innerHtml: `
        <div class="scene-inner">
          <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || "Architecture")}</span></div>
          <h2 id="s${i + 1}-title" class="editorial-title" style="font-size: ${isPortrait ? "64px" : "68px"}">${h(scene.title)}</h2>
          <div class="pipeline-container ${isPortrait ? "portrait-stack" : ""}">
            <div id="s${i + 1}-n1" class="pipe-node">
              <div class="node-badge">01</div>
              <div class="node-title">${h(n1.title)}</div>
              <div class="node-desc">${h(n1.desc)}</div>
            </div>
            <div class="pipe-connector ${isPortrait ? "v-conn" : ""}">
              <div id="s${i + 1}-line1" class="pipe-line"></div>
            </div>
            <div id="s${i + 1}-n2" class="pipe-node active-pipe-node">
              <div class="node-badge active">02</div>
              <div class="node-title">${h(n2.title)}</div>
              <div class="node-desc">${h(n2.desc)}</div>
            </div>
            <div class="pipe-connector ${isPortrait ? "v-conn" : ""}">
              <div id="s${i + 1}-line2" class="pipe-line"></div>
            </div>
            <div id="s${i + 1}-n3" class="pipe-node">
              <div class="node-badge">03</div>
              <div class="node-title">${h(n3.title)}</div>
              <div class="node-desc">${h(n3.desc)}</div>
            </div>
          </div>
        </div>
      `,
      gsapChoreography: `
        tl.from(scope.querySelector("#s${i + 1}-eyebrow"), { opacity: 0, y: 15, duration: 0.4 }, 0.2);
        tl.from(scope.querySelector("#s${i + 1}-title"), { opacity: 0, y: 20, duration: 0.5 }, 0.4);
        tl.from(scope.querySelector("#s${i + 1}-n1"), { opacity: 0, scale: 0.9, duration: 0.5, ease: "power3.out" }, 0.7);
        tl.fromTo(scope.querySelector("#s${i + 1}-line1"), { scaleX: 0 }, { scaleX: 1, duration: 0.4, ease: "power2.inOut" }, 1.1);
        tl.from(scope.querySelector("#s${i + 1}-n2"), { opacity: 0, scale: 0.9, duration: 0.5, ease: "back.out(1.5)" }, 1.4);
        tl.fromTo(scope.querySelector("#s${i + 1}-line2"), { scaleX: 0 }, { scaleX: 1, duration: 0.4, ease: "power2.inOut" }, 1.8);
        tl.from(scope.querySelector("#s${i + 1}-n3"), { opacity: 0, scale: 0.9, duration: 0.5, ease: "power3.out" }, 2.1);
      `,
    };
  },
  renderCss: ({ scene, activePalette }) => `
    [data-composition-id="${scene.id}"] .pipeline-container { display: flex; align-items: center; justify-content: center; gap: 24px; margin-top: 48px; width: 100%; max-width: 1300px; }
    [data-composition-id="${scene.id}"] .pipe-node { flex: 1; background: ${activePalette.card}; border: 1px solid ${activePalette.border}; border-radius: 24px; padding: 36px 28px; box-shadow: 0 16px 40px rgba(0,0,0,0.04); display: flex; flex-direction: column; align-items: center; text-align: center; gap: 10px; }
    [data-composition-id="${scene.id}"] .active-pipe-node { border-color: ${activePalette.accent}; box-shadow: 0 0 30px rgba(203, 168, 124, 0.15); }
    [data-composition-id="${scene.id}"] .node-badge { font-family: "JetBrains Mono", monospace; font-size: 13px; font-weight: 700; color: ${activePalette.textMuted || activePalette.text}; background: rgba(0,0,0,0.06); padding: 4px 12px; border-radius: 12px; }
    [data-composition-id="${scene.id}"] .node-badge.active { background: ${activePalette.accent}; color: ${activePalette.accentText || "#ffffff"}; }
    [data-composition-id="${scene.id}"] .node-title { font-family: "Playfair Display", serif; font-size: 26px; font-weight: 700; color: ${activePalette.text}; }
    [data-composition-id="${scene.id}"] .node-desc { font-size: 16px; color: ${activePalette.textMuted || activePalette.text}; }
    [data-composition-id="${scene.id}"] .pipe-connector { width: 60px; height: 4px; position: relative; background: ${activePalette.border}; border-radius: 2px; }
    [data-composition-id="${scene.id}"] .pipe-line { position: absolute; inset: 0; background: ${activePalette.accent}; border-radius: 2px; transform-origin: left; }
    [data-composition-id="${scene.id}"] .v-conn { width: 4px; height: 28px; transform-origin: top; margin: 0 auto; }
  `,
});

// 11. Code Terminal
registerArchetypeRenderer("code-terminal", {
  getBackground: ({ activePalette }) =>
    `background: radial-gradient(ellipse at 85% 15%, ${activePalette.accent}24 0%, transparent 55%), linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px), ${activePalette.background}; background-size: 100% 100%, 36px 36px, 36px 36px;`,
  renderHtml: ({ scene, i, isPortrait, h }) => {
    const filename = scene.codeDemo?.filename || "pipeline.ts";
    const language = scene.codeDemo?.language || "TypeScript";
    const lines = scene.codeDemo?.lines || [
      "const studio = new VideoProducer();",
      "const composition = await studio.author({",
      "  source: 'knowledge-brief.pdf',",
      "  aspectRatio: '16:9',",
      "  duration: '180s'",
      "});",
      "await composition.render();",
    ];
    const output = scene.codeDemo?.output || "✓ Build finished in 18ms. 4K broadcast stream ready.";
    const innerHtml = isPortrait
      ? `
      <div class="scene-inner">
        <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || "Developer Engine")}</span></div>
        <h2 id="s${i + 1}-title" class="editorial-title" style="font-size: 64px">${h(scene.title)}</h2>
        <div id="s${i + 1}-terminal" class="terminal-card">
          <div class="terminal-header">
            <div class="terminal-dots"><span></span><span></span><span></span></div>
            <div class="terminal-filename">${h(filename)}</div>
            <div class="terminal-tag">${h(language)}</div>
          </div>
          <div class="terminal-code">
            ${lines.map((l, lIdx) => `<div class="term-line" id="s${i + 1}-line-${lIdx}"><span class="t-num">${lIdx + 1}</span><span class="t-code">${highlightCodeTokens(l)}</span></div>`).join("")}
            <div id="s${i + 1}-term-out" class="term-output">${h(output)}</div>
          </div>
        </div>
      </div>
    `
      : `
      <div class="scene-inner fullbleed-layout">
        <div class="top-nav-bar">
          <div class="nav-left">
            <span class="eyebrow-dot"></span>
            <span id="s${i + 1}-eyebrow" class="nav-badge">${h(scene.eyebrow || "DEVELOPER ENGINE")}</span>
            <span class="nav-sep">/</span>
            <span id="s${i + 1}-title" class="nav-title">${h(scene.title)}</span>
          </div>
          <div class="nav-right">
            <span class="nav-status-pill">${h(language)} • Verified API</span>
          </div>
        </div>
        <div class="showcase-stage">
          <div id="s${i + 1}-terminal" class="terminal-card terminal-fullbleed">
            <div class="terminal-header">
              <div class="terminal-dots"><span></span><span></span><span></span></div>
              <div class="terminal-filename">${h(filename)}</div>
              <div class="terminal-tag">${h(language)}</div>
            </div>
            <div class="terminal-code">
              ${lines.map((l, lIdx) => `<div class="term-line" id="s${i + 1}-line-${lIdx}"><span class="t-num">${lIdx + 1}</span><span class="t-code">${highlightCodeTokens(l)}</span></div>`).join("")}
              <div id="s${i + 1}-term-out" class="term-output">${h(output)}</div>
            </div>
          </div>
        </div>
      </div>
    `;
    return {
      innerHtml,
      gsapChoreography: `
        tl.from(scope.querySelector("#s${i + 1}-eyebrow"), { opacity: 0, y: 15, duration: 0.4 }, 0.2);
        tl.from(scope.querySelector("#s${i + 1}-title"), { opacity: 0, y: 20, duration: 0.5 }, 0.4);
        tl.from(scope.querySelector("#s${i + 1}-terminal"), { opacity: 0, y: 30, duration: 0.6, ease: "power4.out" }, 0.7);
        scope.querySelectorAll(".term-line").forEach((ln, idx) => {
          tl.from(ln, { opacity: 0, x: -10, duration: 0.2 }, 1.1 + (idx * 0.18));
        });
        tl.from(scope.querySelector("#s${i + 1}-term-out"), { opacity: 0, y: 10, duration: 0.4 }, 1.1 + (scope.querySelectorAll(".term-line").length * 0.18) + 0.3);
      `,
    };
  },
  renderCss: ({ scene, isPortrait }) => `
    [data-composition-id="${scene.id}"] .terminal-card { width: 100%; max-width: ${isPortrait ? "940px" : "1100px"}; margin-top: 40px; background: #0c0d12; border: 1px solid rgba(255,255,255,0.12); border-radius: 24px; overflow: hidden; box-shadow: 0 24px 70px rgba(0,0,0,0.4); text-align: left; }
    [data-composition-id="${scene.id}"] .terminal-header { background: #161822; padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.08); }
    [data-composition-id="${scene.id}"] .terminal-dots { display: flex; gap: 8px; }
    [data-composition-id="${scene.id}"] .terminal-dots span { width: 12px; height: 12px; border-radius: 50%; display: block; }
    [data-composition-id="${scene.id}"] .terminal-dots span:nth-child(1) { background: #ff5f56; }
    [data-composition-id="${scene.id}"] .terminal-dots span:nth-child(2) { background: #ffbd2e; }
    [data-composition-id="${scene.id}"] .terminal-dots span:nth-child(3) { background: #27c93f; }
    [data-composition-id="${scene.id}"] .terminal-filename { font-family: "JetBrains Mono", monospace; font-size: 15px; color: #a0a5b8; }
    [data-composition-id="${scene.id}"] .terminal-tag { font-family: "JetBrains Mono", monospace; font-size: 13px; color: #8899aa; }
    [data-composition-id="${scene.id}"] .terminal-code { padding: ${isPortrait ? "32px 36px" : "24px 30px"}; font-family: "JetBrains Mono", monospace; font-size: ${isPortrait ? "20px" : "18px"}; line-height: 1.9; color: #f8fafc; }
    [data-composition-id="${scene.id}"] .term-line { display: flex; gap: 20px; }
    [data-composition-id="${scene.id}"] .t-num { color: #6c7b91; user-select: none; width: 24px; text-align: right; }
    [data-composition-id="${scene.id}"] .t-code { color: #e2e8f0; }
    [data-composition-id="${scene.id}"] .term-output { margin-top: 18px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.08); font-size: 16px; color: #34d399; display: flex; align-items: center; gap: 8px; }
    [data-composition-id="${scene.id}"] .t-kw { color: #c084fc; font-weight: 600; }
    [data-composition-id="${scene.id}"] .t-str { color: #86efac; }
    [data-composition-id="${scene.id}"] .t-comment { color: #94a3b8; font-style: italic; }
    [data-composition-id="${scene.id}"] .t-fn { color: #67e8f9; }
  `,
});

// 12. Split Comparison
registerArchetypeRenderer("split-comparison", {
  renderHtml: ({ scene, i, isPortrait, h }) => {
    const leftTitle = scene.compareLeft?.title || "Legacy Process";
    const leftTag = scene.compareLeft?.tag || "High Friction";
    const leftPoints = scene.compareLeft?.points || [
      "Tedious manual timeline editing",
      "Fragile cross-tool dependency",
      "Slow export turnaround",
    ];
    const rightTitle = scene.compareRight?.title || "Autonomous Production";
    const rightTag = scene.compareRight?.tag || "Breakthrough";
    const rightPoints = scene.compareRight?.points || [
      "Prompt and brief to full video",
      "Code-accurate motion choreography",
      "Instant GPU-accelerated 4K render",
    ];
    return {
      innerHtml: `
        <div class="scene-inner">
          <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || "The Paradigm Shift")}</span></div>
          <h2 id="s${i + 1}-title" class="editorial-title" style="font-size: ${isPortrait ? "64px" : "68px"}">${h(scene.title)}</h2>
          <div class="compare-container ${isPortrait ? "portrait-stack" : ""}">
            <div id="s${i + 1}-c-left" class="compare-card compare-friction">
              <div class="compare-header">
                <span class="compare-heading">${h(leftTitle)}</span>
                <span class="compare-badge friction-badge">${h(leftTag)}</span>
              </div>
              <ul class="compare-list">
                ${leftPoints.map((p) => `<li><span class="cross-mark">✕</span><span>${h(p)}</span></li>`).join("")}
              </ul>
            </div>
            <div id="s${i + 1}-c-right" class="compare-card compare-solution">
              <div class="compare-header">
                <span class="compare-heading">${h(rightTitle)}</span>
                <span class="compare-badge solution-badge">${h(rightTag)}</span>
              </div>
              <ul class="compare-list">
                ${rightPoints.map((p) => `<li><span class="check-mark">✓</span><span>${h(p)}</span></li>`).join("")}
              </ul>
            </div>
          </div>
        </div>
      `,
      gsapChoreography: `
        tl.from(scope.querySelector("#s${i + 1}-eyebrow"), { opacity: 0, y: 15, duration: 0.4 }, 0.2);
        tl.from(scope.querySelector("#s${i + 1}-title"), { opacity: 0, y: 20, duration: 0.5 }, 0.4);
        tl.from(scope.querySelector("#s${i + 1}-c-left"), { opacity: 0, x: -30, duration: 0.6, ease: "power3.out" }, 0.7);
        tl.from(scope.querySelector("#s${i + 1}-c-right"), { opacity: 0, x: 30, scale: 0.95, duration: 0.7, ease: "power4.out" }, 0.9);
        scope.querySelectorAll("#s${i + 1}-c-right li").forEach((li, idx) => {
          tl.from(li, { opacity: 0, y: 8, duration: 0.3 }, 1.4 + (idx * 0.25));
        });
      `,
    };
  },
  renderCss: ({ scene, isPortrait, activePalette }) => `
    [data-composition-id="${scene.id}"] .compare-container { display: grid; grid-template-columns: 1fr 1fr; gap: 36px; width: 100%; max-width: ${isPortrait ? "920px" : "1400px"}; margin-top: 40px; }
    [data-composition-id="${scene.id}"] .compare-card { border-radius: 24px; padding: 40px; text-align: left; }
    [data-composition-id="${scene.id}"] .compare-friction { background: rgba(0,0,0,0.02); border: 1px dashed ${activePalette.border}; opacity: 0.75; }
    [data-composition-id="${scene.id}"] .compare-solution { background: ${activePalette.card}; border: 1px solid ${activePalette.accent}; box-shadow: 0 20px 60px rgba(0,0,0,0.08); }
    [data-composition-id="${scene.id}"] .compare-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid ${activePalette.border}; }
    [data-composition-id="${scene.id}"] .compare-heading { font-family: "Playfair Display", serif; font-size: 28px; font-weight: 700; color: ${activePalette.text}; }
    [data-composition-id="${scene.id}"] .compare-badge { font-family: "JetBrains Mono", monospace; font-size: 14px; font-weight: 600; padding: 4px 12px; border-radius: 12px; }
    [data-composition-id="${scene.id}"] .friction-badge { background: #fee2e2; color: #851818; font-weight: 700; }
    [data-composition-id="${scene.id}"] .solution-badge { background: #dcfce7; color: #14532d; font-weight: 700; }
    [data-composition-id="${scene.id}"] .compare-list { list-style: none; display: flex; flex-direction: column; gap: 18px; }
    [data-composition-id="${scene.id}"] .compare-list li { display: flex; align-items: center; gap: 14px; font-size: 20px; color: ${activePalette.text}; }
    [data-composition-id="${scene.id}"] .cross-mark { color: #b91c1c; font-weight: 700; }
    [data-composition-id="${scene.id}"] .check-mark { color: #0a7c5c; font-weight: 700; }
  `,
});

// Custom-split alias / extension
registerArchetypeRenderer("custom-split", ARCHETYPE_RENDERERS["split-comparison"]);

// 13. Data Graph
registerArchetypeRenderer("data-graph", {
  renderHtml: ({ scene, i, isPortrait, h }) => {
    const chartTitle = scene.chartData?.title || "Operational Velocity";
    const chartBadge = scene.chartData?.badge || "+340% Throughput";
    const bars = scene.chartData?.bars || [
      { label: "Legacy NLE", value: "20%", height: 20 },
      { label: "V1 Scripts", value: "45%", height: 45 },
      { label: "V2 Templates", value: "68%", height: 68 },
      { label: "Studio One", value: "100%", height: 96 },
    ];
    const innerHtml = isPortrait
      ? `
      <div class="scene-inner">
        <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || "Performance Gain")}</span></div>
        <h2 id="s${i + 1}-title" class="editorial-title" style="font-size: 64px">${h(scene.title)}</h2>
        <div id="s${i + 1}-chart" class="chart-wrapper">
          <div class="chart-header">
            <span class="chart-title">${h(chartTitle)}</span>
            <span class="chart-highlight-badge">${h(chartBadge)}</span>
          </div>
          <div class="chart-bars-row">
            ${bars
              .map(
                (b, bIdx) => `
              <div class="bar-column">
                <div class="bar-val" id="s${i + 1}-bval-${bIdx}">${h(b.value)}</div>
                <div class="bar-track">
                  <div class="bar-pillar ${bIdx === bars.length - 1 ? "bar-hero" : ""}" id="s${i + 1}-bbar-${bIdx}" style="height: ${b.height}%;"></div>
                </div>
                <div class="bar-label">${h(b.label)}</div>
              </div>
            `,
              )
              .join("")}
          </div>
        </div>
      </div>
    `
      : `
      <div class="scene-inner fullbleed-layout">
        <div class="top-nav-bar">
          <div class="nav-left">
            <span class="eyebrow-dot"></span>
            <span id="s${i + 1}-eyebrow" class="nav-badge">${h(scene.eyebrow || "PERFORMANCE GAIN")}</span>
            <span class="nav-sep">/</span>
            <span id="s${i + 1}-title" class="nav-title">${h(scene.title)}</span>
          </div>
          <div class="nav-right">
            <span class="nav-status-pill">${h(chartBadge)}</span>
          </div>
        </div>
        <div class="showcase-stage">
          <div id="s${i + 1}-chart" class="chart-wrapper chart-fullbleed">
            <div class="chart-header">
              <span class="chart-title">${h(chartTitle)}</span>
              <span class="chart-highlight-badge">${h(chartBadge)}</span>
            </div>
            <div class="chart-bars-row">
              ${bars
                .map(
                  (b, bIdx) => `
                <div class="bar-column">
                  <div class="bar-val" id="s${i + 1}-bval-${bIdx}">${h(b.value)}</div>
                  <div class="bar-track">
                    <div class="bar-pillar ${bIdx === bars.length - 1 ? "bar-hero" : ""}" id="s${i + 1}-bbar-${bIdx}" style="height: ${b.height}%;"></div>
                  </div>
                  <div class="bar-label">${h(b.label)}</div>
                </div>
              `,
                )
                .join("")}
            </div>
          </div>
        </div>
      </div>
    `;
    return {
      innerHtml,
      gsapChoreography: `
        tl.from(scope.querySelector("#s${i + 1}-eyebrow"), { opacity: 0, y: 15, duration: 0.4 }, 0.2);
        tl.from(scope.querySelector("#s${i + 1}-title"), { opacity: 0, y: 20, duration: 0.5 }, 0.4);
        tl.from(scope.querySelector("#s${i + 1}-chart"), { opacity: 0, y: 30, duration: 0.6, ease: "power4.out" }, 0.7);
        scope.querySelectorAll(".bar-pillar").forEach((bp, idx) => {
          tl.fromTo(bp, { scaleY: 0, transformOrigin: "bottom" }, { scaleY: 1, duration: 0.7, ease: "back.out(1.4)" }, 1.1 + (idx * 0.15));
        });
        scope.querySelectorAll(".bar-val").forEach((bv, idx) => {
          tl.from(bv, { opacity: 0, y: -8, duration: 0.3 }, 1.5 + (idx * 0.15));
        });
      `,
    };
  },
  renderCss: ({ scene, isPortrait, activePalette }) => `
    [data-composition-id="${scene.id}"] .chart-wrapper { width: 100%; max-width: ${isPortrait ? "920px" : "1200px"}; height: ${isPortrait ? "660px" : "auto"}; margin-top: 40px; background: ${activePalette.card}; border: 1px solid ${activePalette.border}; border-radius: 28px; padding: 40px 50px; box-shadow: 0 20px 60px rgba(0,0,0,0.06); text-align: left; display: flex; flex-direction: column; }
    [data-composition-id="${scene.id}"] .chart-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 36px; padding-bottom: 16px; border-bottom: 1px solid ${activePalette.border}; }
    [data-composition-id="${scene.id}"] .chart-title { font-family: "Playfair Display", serif; font-size: 30px; font-weight: 700; color: ${activePalette.text}; }
    [data-composition-id="${scene.id}"] .chart-highlight-badge { font-family: "JetBrains Mono", monospace; font-size: 16px; font-weight: 700; color: #bd4522; background: rgba(189, 69, 34, 0.10); padding: 6px 18px; border-radius: 20px; }
    [data-composition-id="${scene.id}"] .chart-bars-row { display: flex; align-items: flex-end; justify-content: space-between; height: ${isPortrait ? "420px" : "220px"}; gap: 32px; padding-bottom: 10px; border-bottom: 2px solid ${activePalette.border}; flex: 1; }
    [data-composition-id="${scene.id}"] .bar-column { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 10px; height: 100%; justify-content: flex-end; }
    [data-composition-id="${scene.id}"] .bar-val { font-family: "JetBrains Mono", monospace; font-size: 17px; font-weight: 600; color: ${activePalette.textMuted || activePalette.text}; }
    [data-composition-id="${scene.id}"] .bar-track { width: 100%; height: ${isPortrait ? "360px" : "180px"}; display: flex; align-items: flex-end; background: rgba(0,0,0,0.03); border-radius: 12px; overflow: hidden; }
    [data-composition-id="${scene.id}"] .bar-pillar { width: 100%; background: ${activePalette.border}; border-radius: 12px 12px 0 0; }
    [data-composition-id="${scene.id}"] .bar-hero { background: ${activePalette.accent}; }
    [data-composition-id="${scene.id}"] .bar-label { font-size: 16px; font-weight: 500; color: ${activePalette.textMuted || activePalette.text}; margin-top: 6px; }
  `,
});

// 14. Bento Grid
registerArchetypeRenderer("bento-grid", {
  renderHtml: ({ scene, i, isPortrait, h }) => {
    const main = scene.bento?.mainCard || {
      title: "Autonomous Motion Choreography",
      desc: "Engineered specifically to render fluid, broadcast-level typography without template fatigue.",
      badge: "Core Innovation",
    };
    const sub1 = scene.bento?.subCard1 || {
      title: "100% Private Local Execution",
      badge: "Zero Cloud Leak",
    };
    const sub2 = scene.bento?.subCard2 || {
      title: "Continuous Timeline Engine",
      badge: "Seamless Vectors",
    };
    return {
      innerHtml: `
        <div class="scene-inner">
          <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || "Capabilities")}</span></div>
          <h2 id="s${i + 1}-title" class="editorial-title" style="font-size: ${isPortrait ? "64px" : "68px"}">${h(scene.title)}</h2>
          <div class="bento-wrapper ${isPortrait ? "portrait-stack" : ""}">
            <div id="s${i + 1}-b-hero" class="bento-tile bento-hero-tile">
              <span class="bento-badge">${h(main.badge)}</span>
              <h3 class="bento-title">${h(main.title)}</h3>
              <p class="bento-desc">${h(main.desc)}</p>
            </div>
            <div class="bento-side-stack">
              <div id="s${i + 1}-b-sub1" class="bento-tile bento-sub-tile">
                <span class="bento-badge-sm">${h(sub1.badge)}</span>
                <div class="bento-sub-title">${h(sub1.title)}</div>
              </div>
              <div id="s${i + 1}-b-sub2" class="bento-tile bento-sub-tile">
                <span class="bento-badge-sm">${h(sub2.badge)}</span>
                <div class="bento-sub-title">${h(sub2.title)}</div>
              </div>
            </div>
          </div>
        </div>
      `,
      gsapChoreography: `
        tl.from(scope.querySelector("#s${i + 1}-eyebrow"), { opacity: 0, y: 15, duration: 0.4 }, 0.2);
        tl.from(scope.querySelector("#s${i + 1}-title"), { opacity: 0, y: 20, duration: 0.5 }, 0.4);
        tl.from(scope.querySelector("#s${i + 1}-b-hero"), { opacity: 0, y: 30, duration: 0.6, ease: "power4.out" }, 0.7);
        tl.from(scope.querySelector("#s${i + 1}-b-sub1"), { opacity: 0, x: 25, duration: 0.5, ease: "power3.out" }, 1.0);
        tl.from(scope.querySelector("#s${i + 1}-b-sub2"), { opacity: 0, x: 25, duration: 0.5, ease: "power3.out" }, 1.3);
      `,
    };
  },
  renderCss: ({ scene, activePalette }) => `
    [data-composition-id="${scene.id}"] .bento-wrapper { display: grid; grid-template-columns: 1.4fr 1fr; gap: 24px; width: 100%; max-width: 1300px; margin-top: 40px; }
    [data-composition-id="${scene.id}"] .bento-tile { background: ${activePalette.card}; border: 1px solid ${activePalette.border}; border-radius: 24px; padding: 36px; box-shadow: 0 16px 40px rgba(0,0,0,0.04); text-align: left; }
    [data-composition-id="${scene.id}"] .bento-hero-tile { display: flex; flex-direction: column; justify-content: center; gap: 16px; }
    [data-composition-id="${scene.id}"] .bento-side-stack { display: flex; flex-direction: column; gap: 24px; }
    [data-composition-id="${scene.id}"] .bento-badge { align-self: flex-start; font-family: "JetBrains Mono", monospace; font-size: 13px; font-weight: 600; color: #bd4522; background: rgba(189, 69, 34, 0.10); padding: 4px 12px; border-radius: 12px; }
    [data-composition-id="${scene.id}"] .bento-title { font-family: "Playfair Display", serif; font-size: 34px; font-weight: 700; color: ${activePalette.text}; line-height: 1.2; }
    [data-composition-id="${scene.id}"] .bento-desc { font-size: 18px; color: ${activePalette.textMuted || activePalette.text}; line-height: 1.5; }
    [data-composition-id="${scene.id}"] .bento-sub-tile { display: flex; flex-direction: column; justify-content: center; gap: 8px; }
    [data-composition-id="${scene.id}"] .bento-sub-title { font-family: "Playfair Display", serif; font-size: 24px; font-weight: 700; color: ${activePalette.text}; }
    [data-composition-id="${scene.id}"] .bento-badge-sm { font-family: "JetBrains Mono", monospace; font-size: 12px; font-weight: 600; color: ${activePalette.textMuted || activePalette.text}; }
  `,
});

// 15. Quote Callout
registerArchetypeRenderer("quote-callout", {
  renderHtml: ({ scene, i, isPortrait, h }) => {
    const qText =
      scene.quoteData?.quote ||
      "Simplicity is prerequisite for reliability. Clean abstractions outlast complex workarounds.";
    const qAuthor = scene.quoteData?.author || "Core Architectural Axiom";
    const qContext = scene.quoteData?.context || "Systems Engineering Principle";
    const qBadge = scene.quoteData?.badge || "Foundational Rule";
    const innerHtml = isPortrait
      ? `
      <div class="scene-inner">
        <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || "Core Axiom")}</span></div>
        <h2 id="s${i + 1}-title" class="editorial-title" style="font-size: 58px">${h(scene.title)}</h2>
        <div id="s${i + 1}-quote-card" class="quote-card">
          <div class="quote-mark">“</div>
          <blockquote class="quote-text">${h(qText)}</blockquote>
          <div class="quote-footer">
            <div class="quote-author-wrap">
              <span class="quote-author">${h(qAuthor)}</span>
              <span class="quote-context">${h(qContext)}</span>
            </div>
            <div class="quote-badge">${h(qBadge)}</div>
          </div>
        </div>
      </div>
    `
      : `
      <div class="scene-inner split-hero-layout">
        <div class="split-col-left">
          <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || "Core Axiom")}</span></div>
          <h2 id="s${i + 1}-title" class="split-hero-title">${h(scene.title)}</h2>
          <p id="s${i + 1}-subtitle" class="split-hero-sub">${h(scene.subtitle || qContext || "Foundational architectural principle governing system invariants.")}</p>
          <div class="split-hero-badge"><span class="accent-spark">✦</span><span>${h(qBadge)}</span></div>
        </div>
        <div class="split-col-right">
          <div id="s${i + 1}-quote-card" class="quote-card quote-split">
            <div class="quote-mark">“</div>
            <blockquote class="quote-text">${h(qText)}</blockquote>
            <div class="quote-footer">
              <div class="quote-author-wrap">
                <span class="quote-author">${h(qAuthor)}</span>
                <span class="quote-context">${h(qContext)}</span>
              </div>
              <div class="quote-badge">${h(qBadge)}</div>
            </div>
          </div>
        </div>
      </div>
    `;
    return {
      innerHtml,
      gsapChoreography: `
        tl.from(scope.querySelector("#s${i + 1}-eyebrow"), { opacity: 0, y: 15, duration: 0.4 }, 0.2);
        tl.from(scope.querySelector("#s${i + 1}-title"), { opacity: 0, y: 20, duration: 0.5 }, 0.4);
        tl.from(scope.querySelector("#s${i + 1}-quote-card"), { opacity: 0, y: 30, scale: 0.96, duration: 0.6, ease: "power4.out" }, 0.7);
        tl.from(scope.querySelector(".quote-mark"), { opacity: 0, scale: 0.5, duration: 0.4, ease: "back.out(2)" }, 0.9);
        tl.from(scope.querySelector(".quote-text"), { opacity: 0, y: 10, duration: 0.5 }, 1.1);
        tl.from(scope.querySelector(".quote-footer"), { opacity: 0, y: 10, duration: 0.4 }, 1.4);
      `,
    };
  },
  renderCss: ({ scene, isPortrait, activePalette }) => `
    [data-composition-id="${scene.id}"] .quote-card { width: 100%; max-width: ${isPortrait ? "920px" : "1200px"}; margin-top: 36px; background: ${activePalette.card}; border: 1px solid ${activePalette.border}; border-left: 6px solid ${activePalette.accent}; border-radius: 24px; padding: ${isPortrait ? "40px 36px" : "48px 60px"}; box-shadow: 0 20px 60px rgba(0,0,0,0.06); text-align: left; }
    [data-composition-id="${scene.id}"] .quote-mark { font-family: "Playfair Display", serif; font-size: 72px; line-height: 1; color: ${activePalette.accent}; opacity: 0.8; margin-bottom: -16px; }
    [data-composition-id="${scene.id}"] .quote-text { font-family: "Playfair Display", serif; font-size: ${isPortrait ? "32px" : "36px"}; font-style: italic; font-weight: 500; line-height: 1.4; color: ${activePalette.text}; margin: 16px 0 28px; }
    [data-composition-id="${scene.id}"] .quote-footer { display: flex; justify-content: space-between; align-items: center; padding-top: 20px; border-top: 1px solid ${activePalette.border}; }
    [data-composition-id="${scene.id}"] .quote-author-wrap { display: flex; flex-direction: column; gap: 4px; }
    [data-composition-id="${scene.id}"] .quote-author { font-family: "Inter", sans-serif; font-size: 20px; font-weight: 600; color: ${activePalette.text}; }
    [data-composition-id="${scene.id}"] .quote-context { font-family: "JetBrains Mono", monospace; font-size: 14px; color: ${activePalette.textMuted || activePalette.text}; }
    [data-composition-id="${scene.id}"] .quote-badge { font-family: "JetBrains Mono", monospace; font-size: 13px; font-weight: 600; color: ${activePalette.accentDark || activePalette.text}; background: rgba(0,0,0,0.06); padding: 6px 16px; border-radius: 20px; }
  `,
});

// 16. Flowchart Process
registerArchetypeRenderer("flowchart-process", {
  getBackground: ({ activePalette }) =>
    `background: radial-gradient(rgba(255,255,255,0.08) 1.5px, transparent 1.5px), ${activePalette.background}; background-size: 32px 32px;`,
  renderHtml: ({ scene, i, isPortrait, h }) => {
    const rawSteps = scene.flowData?.steps;
    const steps = (
      Array.isArray(rawSteps) && rawSteps.length > 0
        ? rawSteps
        : [
            {
              stepNumber: "01",
              title: "Ingestion & Filter",
              desc: "Raw input capture and boundary checking",
              isHighlighted: false,
            },
            {
              stepNumber: "02",
              title: "Transformation Engine",
              desc: "Optimized non-blocking pipeline execution",
              isHighlighted: true,
            },
            {
              stepNumber: "03",
              title: "Deterministic Output",
              desc: "Verified result emission and state persistence",
              isHighlighted: false,
            },
          ]
    ).slice(0, 4);

    const stepsHtml = steps
      .map(
        (st, idx) => `
        <div class="flow-node ${st.isHighlighted ? "highlighted" : ""}" id="flow-node-${i}-${idx + 1}">
          <div class="flow-node-badge">
            <span class="flow-step-num">${h(st.stepNumber || `0${idx + 1}`)}</span>
            ${st.isHighlighted ? `<span class="flow-active-dot"></span>` : ""}
          </div>
          <div class="flow-node-content">
            <div class="flow-node-title">${h(st.title || `Stage ${idx + 1}`)}</div>
            <div class="flow-node-desc">${h(st.desc || "Step execution detail")}</div>
          </div>
          ${
            idx < steps.length - 1
              ? `
            <div class="flow-connector ${isPortrait ? "vertical" : "horizontal"}">
              <svg class="connector-svg" viewBox="0 0 40 40">
                <path class="connector-line" d="${isPortrait ? "M 20 0 L 20 40" : "M 0 20 L 40 20"}" />
                <polygon class="connector-arrow" points="${isPortrait ? "15,32 20,40 25,32" : "32,15 40,20 32,25"}" />
              </svg>
            </div>
          `
              : ""
          }
        </div>
      `,
      )
      .join("\n");

    const innerHtml = isPortrait
      ? `
      <div class="scene-inner">
        <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || "Process Architecture")}</span></div>
        <h2 id="s${i + 1}-title" class="editorial-title" style="font-size: 60px">${h(scene.title)}</h2>
        <div id="s${i + 1}-flow-container" class="flow-process-container portrait-flow">
          ${stepsHtml}
        </div>
      </div>
    `
      : `
      <div class="scene-inner fullbleed-layout">
        <div class="top-nav-bar">
          <div class="nav-left">
            <span class="eyebrow-dot"></span>
            <span id="s${i + 1}-eyebrow" class="nav-badge">${h(scene.eyebrow || "PROCESS ARCHITECTURE")}</span>
            <span class="nav-sep">/</span>
            <span id="s${i + 1}-title" class="nav-title">${h(scene.title)}</span>
          </div>
          <div class="nav-right">
            <span class="nav-status-pill">Sequential Execution</span>
          </div>
        </div>
        <div class="showcase-stage">
          <div id="s${i + 1}-flow-container" class="flow-process-container flow-fullbleed">
            ${stepsHtml}
          </div>
        </div>
      </div>
    `;

    return {
      innerHtml,
      gsapChoreography: `
        tl.from(scope.querySelector("#s${i + 1}-eyebrow"), { opacity: 0, y: 15, duration: 0.4 }, 0.2);
        tl.from(scope.querySelector("#s${i + 1}-title"), { opacity: 0, y: 20, duration: 0.5 }, 0.4);
        scope.querySelectorAll(".flow-node").forEach((node, idx) => {
          tl.from(node, { opacity: 0, scale: 0.92, y: 25, duration: 0.5, ease: "power4.out" }, 0.7 + (idx * 0.35));
        });
        scope.querySelectorAll(".connector-line").forEach((line, idx) => {
          tl.fromTo(line, { strokeDashoffset: 60 }, { strokeDashoffset: 0, duration: 0.4, ease: "power2.out" }, 0.9 + (idx * 0.35));
        });
      `,
    };
  },
  renderCss: ({ scene, isPortrait, activePalette }) => `
    [data-composition-id="${scene.id}"] .flow-process-container { display: flex; align-items: center; justify-content: center; gap: ${isPortrait ? "20px" : "28px"}; width: 100%; max-width: ${isPortrait ? "920px" : "1400px"}; margin-top: ${isPortrait ? "40px" : "48px"}; ${isPortrait ? "flex-direction: column;" : ""} }
    [data-composition-id="${scene.id}"] .flow-node { flex: 1; width: ${isPortrait ? "100%" : "auto"}; background: ${activePalette.card}; border: 1px solid ${activePalette.border}; border-radius: 24px; padding: ${isPortrait ? "24px 32px" : "32px 28px"}; box-shadow: 0 16px 40px rgba(0,0,0,0.04); display: flex; ${isPortrait ? "flex-direction: row; text-align: left; align-items: center;" : "flex-direction: column; text-align: center; align-items: center;"} gap: 16px; position: relative; }
    [data-composition-id="${scene.id}"] .flow-node.highlighted { border-color: ${activePalette.accent}; box-shadow: 0 0 35px ${activePalette.accent}25; }
    [data-composition-id="${scene.id}"] .flow-node-badge { width: 52px; height: 52px; border-radius: 16px; background: rgba(0,0,0,0.05); display: flex; align-items: center; justify-content: center; font-family: "JetBrains Mono", monospace; font-size: 20px; font-weight: 700; color: ${activePalette.accent}; position: relative; flex-shrink: 0; }
    [data-composition-id="${scene.id}"] .flow-node.highlighted .flow-node-badge { background: ${activePalette.accent}; color: ${activePalette.accentText || "#ffffff"}; }
    [data-composition-id="${scene.id}"] .flow-active-dot { position: absolute; top: -4px; right: -4px; width: 12px; height: 12px; border-radius: 50%; background: #22c55e; border: 2px solid #fff; box-shadow: 0 0 10px #22c55e; }
    [data-composition-id="${scene.id}"] .flow-node-title { font-family: "Playfair Display", serif; font-size: ${isPortrait ? "26px" : "24px"}; font-weight: 700; color: ${activePalette.text}; }
    [data-composition-id="${scene.id}"] .flow-node-desc { font-size: ${isPortrait ? "17px" : "15px"}; color: ${activePalette.textMuted || activePalette.text}; margin-top: 4px; line-height: 1.45; }
    [data-composition-id="${scene.id}"] .flow-connector { display: flex; align-items: center; justify-content: center; }
    [data-composition-id="${scene.id}"] .flow-connector.horizontal { width: 44px; height: 44px; }
    [data-composition-id="${scene.id}"] .flow-connector.vertical { width: 44px; height: 32px; }
    [data-composition-id="${scene.id}"] .connector-svg { width: 100%; height: 100%; overflow: visible; }
    [data-composition-id="${scene.id}"] .connector-line { stroke: ${activePalette.accent}; stroke-width: 3; stroke-dasharray: 6 6; fill: none; }
    [data-composition-id="${scene.id}"] .connector-arrow { fill: ${activePalette.accent}; }
  `,
});

// 17. KPI Counter Ring
registerArchetypeRenderer("kpi-counter-ring", {
  getBackground: ({ isPortrait, activePalette }) =>
    `background: radial-gradient(circle at ${isPortrait ? "50% 45%" : "74% 50%"}, ${activePalette.accent}30 0%, transparent 60%), ${activePalette.background};`,
  renderHtml: ({ scene, i, isPortrait, h }) => {
    const kVal = scene.kpiData?.value || "+1,420%";
    const kLabel = scene.kpiData?.label || "Throughput Efficiency";
    const kTrend = scene.kpiData?.trend || "+84.2% YoY";
    const kSubtitle = scene.kpiData?.subtitle || "Measured across distributed cluster workloads";
    const kProgress = Math.min(100, Math.max(10, Number(scene.kpiData?.progress) || 82));
    const circumference = 880;
    const strokeDash = Math.round((kProgress / 100) * circumference);

    const innerHtml = isPortrait
      ? `
      <div class="scene-inner">
        <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || "Performance Metric")}</span></div>
        <h2 id="s${i + 1}-title" class="editorial-title" style="font-size: 58px">${h(scene.title)}</h2>
        <div id="s${i + 1}-kpi-stage" class="kpi-ring-stage">
          <div class="kpi-ring-wrap">
            <svg class="kpi-svg-ring" viewBox="0 0 320 320">
              <circle class="kpi-track" cx="160" cy="160" r="140" />
              <circle class="kpi-fill" cx="160" cy="160" r="140" style="stroke-dasharray: ${strokeDash} ${circumference}" />
            </svg>
            <div class="kpi-center-content">
              <span class="kpi-trend-pill">${h(kTrend)}</span>
              <div class="kpi-big-value" id="s${i + 1}-kpi-num">${h(kVal)}</div>
              <div class="kpi-value-label">${h(kLabel)}</div>
            </div>
          </div>
          <div class="kpi-footer-sub">${h(kSubtitle)}</div>
        </div>
      </div>
    `
      : `
      <div class="scene-inner split-hero-layout">
        <div class="split-col-left">
          <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || "Performance Metric")}</span></div>
          <h2 id="s${i + 1}-title" class="split-hero-title">${h(scene.title)}</h2>
          <p id="s${i + 1}-subtitle" class="split-hero-sub">${h(scene.subtitle || kSubtitle || "Measured across distributed cluster workloads and production benchmarks.")}</p>
          <div class="split-hero-badge"><span class="accent-spark">✦</span><span>${h(kTrend || "Verified Metric")}</span></div>
        </div>
        <div class="split-col-right">
          <div id="s${i + 1}-kpi-stage" class="kpi-ring-stage">
            <div class="kpi-ring-wrap">
              <svg class="kpi-svg-ring" viewBox="0 0 320 320">
                <circle class="kpi-track" cx="160" cy="160" r="140" />
                <circle class="kpi-fill" cx="160" cy="160" r="140" style="stroke-dasharray: ${strokeDash} ${circumference}" />
              </svg>
              <div class="kpi-center-content">
                <span class="kpi-trend-pill">${h(kTrend)}</span>
                <div class="kpi-big-value" id="s${i + 1}-kpi-num">${h(kVal)}</div>
                <div class="kpi-value-label">${h(kLabel)}</div>
              </div>
            </div>
            <div class="kpi-footer-sub">${h(kSubtitle)}</div>
          </div>
        </div>
      </div>
    `;

    return {
      innerHtml,
      gsapChoreography: `
        tl.from(scope.querySelector("#s${i + 1}-eyebrow"), { opacity: 0, y: 15, duration: 0.4 }, 0.2);
        tl.from(scope.querySelector("#s${i + 1}-title"), { opacity: 0, y: 20, duration: 0.5 }, 0.4);
        tl.from(scope.querySelector(".kpi-ring-wrap"), { opacity: 0, scale: 0.85, duration: 0.7, ease: "power4.out" }, 0.6);
        tl.fromTo(scope.querySelector(".kpi-fill"), { strokeDashoffset: ${circumference} }, { strokeDashoffset: 0, duration: 1.5, ease: "power2.out" }, 0.7);
        tl.from(scope.querySelector(".kpi-trend-pill"), { opacity: 0, y: -10, duration: 0.4, ease: "back.out(2)" }, 0.9);
        tl.from(scope.querySelector("#s${i + 1}-kpi-num"), { opacity: 0, scale: 0.8, duration: 0.6, ease: "back.out(1.4)" }, 1.0);
        tl.from(scope.querySelector(".kpi-footer-sub"), { opacity: 0, y: 15, duration: 0.5 }, 1.3);
      `,
    };
  },
  renderCss: ({ scene, isPortrait, activePalette }) => `
    [data-composition-id="${scene.id}"] .kpi-ring-stage { display: flex; flex-direction: column; align-items: center; justify-content: center; margin-top: 36px; width: 100%; max-width: ${isPortrait ? "920px" : "1200px"}; }
    [data-composition-id="${scene.id}"] .kpi-ring-wrap { position: relative; width: ${isPortrait ? "420px" : "360px"}; height: ${isPortrait ? "420px" : "360px"}; display: flex; align-items: center; justify-content: center; }
    [data-composition-id="${scene.id}"] .kpi-svg-ring { position: absolute; inset: 0; width: 100%; height: 100%; transform: rotate(-90deg); overflow: visible; }
    [data-composition-id="${scene.id}"] .kpi-track { fill: none; stroke: ${activePalette.border}; stroke-width: 14; opacity: 0.4; }
    [data-composition-id="${scene.id}"] .kpi-fill { fill: none; stroke: ${activePalette.accent}; stroke-width: 14; stroke-linecap: round; filter: drop-shadow(0 0 16px ${activePalette.accent}66); }
    [data-composition-id="${scene.id}"] .kpi-center-content { position: relative; z-index: 2; display: flex; flex-direction: column; align-items: center; text-align: center; }
    [data-composition-id="${scene.id}"] .kpi-trend-pill { font-family: "JetBrains Mono", monospace; font-size: 15px; font-weight: 700; color: #16a34a; background: #dcfce7; padding: 4px 14px; border-radius: 20px; margin-bottom: 8px; }
    [data-composition-id="${scene.id}"] .kpi-big-value { font-family: "Playfair Display", serif; font-size: ${isPortrait ? "84px" : "76px"}; font-weight: 900; color: ${activePalette.text}; line-height: 1; letter-spacing: -0.03em; }
    [data-composition-id="${scene.id}"] .kpi-value-label { font-family: "Playfair Display", serif; font-size: 22px; font-weight: 600; color: ${activePalette.textMuted || activePalette.text}; margin-top: 6px; }
    [data-composition-id="${scene.id}"] .kpi-footer-sub { font-size: ${isPortrait ? "22px" : "18px"}; color: ${activePalette.textMuted || activePalette.text}; margin-top: 28px; max-width: 700px; text-align: center; }
  `,
});

// 18. Interactive Diff
registerArchetypeRenderer("interactive-diff", {
  getBackground: ({ activePalette }) =>
    `background: linear-gradient(90deg, rgba(239, 68, 68, 0.06) 0%, rgba(239, 68, 68, 0.02) 48%, rgba(255,255,255,0.04) 50%, rgba(16, 185, 129, 0.02) 52%, rgba(16, 185, 129, 0.06) 100%), ${activePalette.background};`,
  renderHtml: ({ scene, i, isPortrait, h }) => {
    const tLeft = scene.diffData?.titleLeft || "Legacy Paradigm";
    const bLeft = scene.diffData?.badgeLeft || "Deprecated";
    const linesL =
      Array.isArray(scene.diffData?.linesLeft) && scene.diffData.linesLeft.length > 0
        ? scene.diffData.linesLeft
        : [
            "Monolithic blocking execution",
            "Resource contention bottlenecks",
            "Manual multi-step sync",
          ];
    const tRight = scene.diffData?.titleRight || "Modern Breakthrough";
    const bRight = scene.diffData?.badgeRight || "State of the Art";
    const linesR =
      Array.isArray(scene.diffData?.linesRight) && scene.diffData.linesRight.length > 0
        ? scene.diffData.linesRight
        : [
            "Zero-overhead streaming engine",
            "Autonomous concurrency fabric",
            "Instant deterministic output",
          ];

    const leftItems = linesL
      .map(
        (l) =>
          `<li class="diff-line diff-old"><span class="diff-icon">−</span><span>${h(l)}</span></li>`,
      )
      .join("\n");
    const rightItems = linesR
      .map(
        (l) =>
          `<li class="diff-line diff-new"><span class="diff-icon">+</span><span>${h(l)}</span></li>`,
      )
      .join("\n");

    const innerHtml = isPortrait
      ? `
      <div class="scene-inner">
        <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || "Comparative Evolution")}</span></div>
        <h2 id="s${i + 1}-title" class="editorial-title" style="font-size: 58px">${h(scene.title)}</h2>
        <div id="s${i + 1}-diff-container" class="diff-split-container portrait-diff">
          <div class="diff-pane diff-pane-left">
            <div class="diff-pane-header">
              <span class="diff-pane-title">${h(tLeft)}</span>
              <span class="diff-pane-badge diff-bad">${h(bLeft)}</span>
            </div>
            <ul class="diff-list">${leftItems}</ul>
          </div>
          <div class="diff-divider">
            <span class="diff-divider-badge">EVOLUTION</span>
          </div>
          <div class="diff-pane diff-pane-right">
            <div class="diff-pane-header">
              <span class="diff-pane-title">${h(tRight)}</span>
              <span class="diff-pane-badge diff-good">${h(bRight)}</span>
            </div>
            <ul class="diff-list">${rightItems}</ul>
          </div>
        </div>
      </div>
    `
      : `
      <div class="scene-inner fullbleed-layout">
        <div class="top-nav-bar">
          <div class="nav-left">
            <span class="eyebrow-dot"></span>
            <span id="s${i + 1}-eyebrow" class="nav-badge">${h(scene.eyebrow || "COMPARATIVE EVOLUTION")}</span>
            <span class="nav-sep">/</span>
            <span id="s${i + 1}-title" class="nav-title">${h(scene.title)}</span>
          </div>
          <div class="nav-right">
            <span class="nav-status-pill">Paradigm Shift</span>
          </div>
        </div>
        <div class="showcase-stage">
          <div id="s${i + 1}-diff-container" class="diff-split-container diff-fullbleed">
            <div class="diff-pane diff-pane-left">
              <div class="diff-pane-header">
                <span class="diff-pane-title">${h(tLeft)}</span>
                <span class="diff-pane-badge diff-bad">${h(bLeft)}</span>
              </div>
              <ul class="diff-list">${leftItems}</ul>
            </div>
            <div class="diff-divider">
              <span class="diff-divider-badge">EVOLUTION</span>
            </div>
            <div class="diff-pane diff-pane-right">
              <div class="diff-pane-header">
                <span class="diff-pane-title">${h(tRight)}</span>
                <span class="diff-pane-badge diff-good">${h(bRight)}</span>
              </div>
              <ul class="diff-list">${rightItems}</ul>
            </div>
          </div>
        </div>
      </div>
    `;

    return {
      innerHtml,
      gsapChoreography: `
        tl.from(scope.querySelector("#s${i + 1}-eyebrow"), { opacity: 0, y: 15, duration: 0.4 }, 0.2);
        tl.from(scope.querySelector("#s${i + 1}-title"), { opacity: 0, y: 20, duration: 0.5 }, 0.4);
        tl.from(scope.querySelector(".diff-pane-left"), { opacity: 0, x: -30, duration: 0.6, ease: "power4.out" }, 0.7);
        tl.from(scope.querySelector(".diff-divider"), { opacity: 0, scale: 0.7, duration: 0.4, ease: "back.out(1.8)" }, 0.9);
        tl.from(scope.querySelector(".diff-pane-right"), { opacity: 0, x: 30, duration: 0.6, ease: "power4.out" }, 1.1);
        scope.querySelectorAll(".diff-old").forEach((el, idx) => {
          tl.from(el, { opacity: 0, x: -10, duration: 0.3 }, 0.9 + (idx * 0.15));
        });
        scope.querySelectorAll(".diff-new").forEach((el, idx) => {
          tl.from(el, { opacity: 0, x: 10, duration: 0.3 }, 1.3 + (idx * 0.15));
        });
      `,
    };
  },
  renderCss: ({ scene, isPortrait, activePalette }) => `
    [data-composition-id="${scene.id}"] .diff-split-container { display: grid; grid-template-columns: 1fr auto 1fr; gap: 24px; align-items: stretch; width: 100%; max-width: ${isPortrait ? "920px" : "1400px"}; margin-top: 40px; }
    [data-composition-id="${scene.id}"] .diff-split-container.portrait-diff { display: flex; flex-direction: column; gap: 20px; }
    [data-composition-id="${scene.id}"] .diff-pane { background: ${activePalette.card}; border: 1px solid ${activePalette.border}; border-radius: 24px; padding: ${isPortrait ? "32px 36px" : "36px 40px"}; box-shadow: 0 16px 40px rgba(0,0,0,0.04); text-align: left; }
    [data-composition-id="${scene.id}"] .diff-pane-left { border-left: 6px solid #ef4444; }
    [data-composition-id="${scene.id}"] .diff-pane-right { border-left: 6px solid #10b981; }
    [data-composition-id="${scene.id}"] .diff-pane-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid ${activePalette.border}; }
    [data-composition-id="${scene.id}"] .diff-pane-title { font-family: "Playfair Display", serif; font-size: 26px; font-weight: 700; color: ${activePalette.text}; }
    [data-composition-id="${scene.id}"] .diff-pane-badge { font-family: "JetBrains Mono", monospace; font-size: 13px; font-weight: 700; padding: 4px 12px; border-radius: 12px; }
    [data-composition-id="${scene.id}"] .diff-bad { background: #fee2e2; color: #991b1b; }
    [data-composition-id="${scene.id}"] .diff-good { background: #d1fae5; color: #065f46; }
    [data-composition-id="${scene.id}"] .diff-list { list-style: none; display: flex; flex-direction: column; gap: 16px; margin: 0; padding: 0; }
    [data-composition-id="${scene.id}"] .diff-line { display: flex; align-items: center; gap: 14px; font-size: ${isPortrait ? "21px" : "19px"}; color: ${activePalette.text}; font-family: "Inter", sans-serif; }
    [data-composition-id="${scene.id}"] .diff-old .diff-icon { color: #ef4444; font-weight: 900; font-size: 24px; }
    [data-composition-id="${scene.id}"] .diff-new .diff-icon { color: #10b981; font-weight: 900; font-size: 24px; }
    [data-composition-id="${scene.id}"] .diff-divider { display: flex; align-items: center; justify-content: center; }
    [data-composition-id="${scene.id}"] .diff-divider-badge { font-family: "JetBrains Mono", monospace; font-size: 13px; font-weight: 700; letter-spacing: 0.1em; color: ${activePalette.accent}; background: rgba(0,0,0,0.06); border: 1px solid ${activePalette.accent}55; padding: 8px 14px; border-radius: 20px; }
  `,
});

// 19. Chat Exchange
registerArchetypeRenderer("chat-exchange", {
  renderHtml: ({ scene, i, isPortrait, h }) => {
    const channel = scene.chatData?.channelName || "Live Orchestration Stream";
    const rawMsgs =
      Array.isArray(scene.chatData?.messages) && scene.chatData.messages.length > 0
        ? scene.chatData.messages
        : [
            {
              sender: "Operator",
              text: "Initiating multi-agent state reconciliation.",
              isAi: false,
              time: "10:04 AM",
            },
            {
              sender: "Core Engine",
              text: "All 18 state invariants validated in 0.8ms. Zero locks acquired.",
              isAi: true,
              time: "10:04 AM",
            },
            {
              sender: "Dispatcher",
              text: "Streaming output frame pipeline at 90 FPS.",
              isAi: true,
              time: "10:05 AM",
            },
          ];
    const msgs = rawMsgs.slice(0, 3);
    const msgsHtml = msgs
      .map(
        (m, idx) => `
      <div class="chat-bubble-row ${m.isAi ? "ai-msg" : "user-msg"}" id="chat-msg-${i}-${idx + 1}">
        <div class="chat-avatar">${m.isAi ? "⚡" : "👤"}</div>
        <div class="chat-bubble-body">
          <div class="chat-meta">
            <span class="chat-sender">${h(m.sender || (m.isAi ? "Engine" : "User"))}</span>
            <span class="chat-time">${h(m.time || "Just now")}</span>
          </div>
          <div class="chat-bubble-text">${h(m.text || "Status confirmation.")}</div>
        </div>
      </div>
    `,
      )
      .join("\n");

    return {
      innerHtml: `
        <div class="scene-inner">
          <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || "Realtime Dialogue")}</span></div>
          <h2 id="s${i + 1}-title" class="editorial-title" style="font-size: ${isPortrait ? "58px" : "66px"}">${h(scene.title)}</h2>
          <div id="s${i + 1}-chat-card" class="chat-stream-card">
            <div class="chat-stream-header">
              <div class="chat-stream-dot"></div>
              <span class="chat-stream-title">${h(channel)}</span>
              <span class="chat-stream-badge">LIVE</span>
            </div>
            <div class="chat-messages-container">
              ${msgsHtml}
            </div>
          </div>
        </div>
      `,
      gsapChoreography: `
        tl.from(scope.querySelector("#s${i + 1}-eyebrow"), { opacity: 0, y: 15, duration: 0.4 }, 0.2);
        tl.from(scope.querySelector("#s${i + 1}-title"), { opacity: 0, y: 20, duration: 0.5 }, 0.4);
        tl.from(scope.querySelector("#s${i + 1}-chat-card"), { opacity: 0, y: 30, scale: 0.96, duration: 0.6, ease: "power4.out" }, 0.6);
        scope.querySelectorAll(".chat-bubble-row").forEach((row, idx) => {
          tl.from(row, { opacity: 0, y: 20, scale: 0.95, duration: 0.45, ease: "back.out(1.2)" }, 0.9 + (idx * 0.4));
        });
      `,
    };
  },
  renderCss: ({ scene, isPortrait, activePalette }) => `
    [data-composition-id="${scene.id}"] .chat-stream-card { width: 100%; max-width: ${isPortrait ? "920px" : "1100px"}; margin-top: 36px; background: #0d0f17; border: 1px solid rgba(255,255,255,0.12); border-radius: 28px; overflow: hidden; box-shadow: 0 24px 70px rgba(0,0,0,0.4); text-align: left; }
    [data-composition-id="${scene.id}"] .chat-stream-header { background: #171924; padding: 18px 28px; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid rgba(255,255,255,0.08); }
    [data-composition-id="${scene.id}"] .chat-stream-dot { width: 10px; height: 10px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 10px #22c55e; }
    [data-composition-id="${scene.id}"] .chat-stream-title { font-family: "JetBrains Mono", monospace; font-size: 16px; font-weight: 600; color: #e2e8f0; flex: 1; }
    [data-composition-id="${scene.id}"] .chat-stream-badge { font-family: "JetBrains Mono", monospace; font-size: 11px; font-weight: 700; background: rgba(34,197,94,0.18); color: #4ade80; padding: 3px 10px; border-radius: 10px; letter-spacing: 0.08em; }
    [data-composition-id="${scene.id}"] .chat-messages-container { padding: ${isPortrait ? "32px 28px" : "28px 32px"}; display: flex; flex-direction: column; gap: 20px; }
    [data-composition-id="${scene.id}"] .chat-bubble-row { display: flex; gap: 16px; max-width: 90%; }
    [data-composition-id="${scene.id}"] .chat-bubble-row.ai-msg { align-self: flex-start; }
    [data-composition-id="${scene.id}"] .chat-bubble-row.user-msg { align-self: flex-end; flex-direction: row-reverse; }
    [data-composition-id="${scene.id}"] .chat-avatar { width: 44px; height: 44px; border-radius: 14px; background: rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }
    [data-composition-id="${scene.id}"] .chat-bubble-body { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; padding: 18px 22px; display: flex; flex-direction: column; gap: 6px; }
    [data-composition-id="${scene.id}"] .ai-msg .chat-bubble-body { background: rgba(203,168,124,0.12); border-color: ${activePalette.accent}44; }
    [data-composition-id="${scene.id}"] .chat-meta { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
    [data-composition-id="${scene.id}"] .chat-sender { font-family: "JetBrains Mono", monospace; font-size: 13px; font-weight: 700; color: #94a3b8; }
    [data-composition-id="${scene.id}"] .ai-msg .chat-sender { color: ${activePalette.accent}; }
    [data-composition-id="${scene.id}"] .chat-time { font-family: "JetBrains Mono", monospace; font-size: 11px; color: #64748b; }
    [data-composition-id="${scene.id}"] .chat-bubble-text { font-size: ${isPortrait ? "21px" : "18px"}; line-height: 1.5; color: #f1f5f9; }
  `,
});

// 20. Features Cards (Default Fallback Handler)
export const renderDefaultCards = {
  renderHtml: ({ scene, i, isPortrait, h }) => {
    const bulletsHtml = (
      scene.cardRight?.bullets || [
        "High speed execution",
        "Private local processing",
        "Zero lock-in",
      ]
    )
      .map(
        (b, idx) =>
          `<li class="note-item" id="note-${i}-${idx + 1}"><span class="note-icon">✓</span><span>${h(b)}</span></li>`,
      )
      .join("\n");
    const sampleWords = (scene.cardLeft?.sampleText || "Translating thoughts into clean execution.")
      .split(" ")
      .map((w) => `<span class="typed-word">${h(w)} </span>`)
      .join("");

    return {
      innerHtml: `
        <div class="scene-inner">
          <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || "Core Features")}</span></div>
          <h2 id="s${i + 1}-title" class="editorial-title" style="font-size: ${isPortrait ? "64px" : "68px"}">${h(scene.title)}</h2>
          <div class="cards-container ${isPortrait ? "portrait-stack" : ""}">
            <div id="s${i + 1}-card-a" class="feature-card">
              <div class="card-header">
                <span class="card-title">${h(scene.cardLeft?.title || "Instant Core")}</span>
                <span class="card-badge">${h(scene.cardLeft?.badge || "Active")}</span>
              </div>
              <div class="email-body">${sampleWords}</div>
            </div>
            <div id="s${i + 1}-card-b" class="feature-card">
              <div class="card-header">
                <span class="card-title">${h(scene.cardRight?.title || "Structured")}</span>
                <span class="card-badge privacy">${h(scene.cardRight?.badge || "100% Offline")}</span>
              </div>
              <ul class="notes-list">${bulletsHtml}</ul>
            </div>
          </div>
        </div>
      `,
      gsapChoreography: `
        tl.from(scope.querySelector("#s${i + 1}-eyebrow"), { opacity: 0, y: 15, duration: 0.4 }, 0.2);
        tl.from(scope.querySelector("#s${i + 1}-title"), { opacity: 0, y: 20, duration: 0.5 }, 0.4);
        tl.from(scope.querySelector("#s${i + 1}-card-a"), { opacity: 0, y: 30, duration: 0.5 }, 0.7);
        tl.from(scope.querySelector("#s${i + 1}-card-b"), { opacity: 0, y: 30, duration: 0.5 }, 0.9);
        const words = scope.querySelectorAll(".typed-word");
        words.forEach((w, idx) => { tl.to(w, { opacity: 1, duration: 0.04 }, 1.2 + (idx * 0.12)); });
        scope.querySelectorAll(".note-item").forEach((n, idx) => { tl.to(n, { opacity: 1, y: 0, duration: 0.4 }, 2.0 + (idx * 0.8)); });
      `,
    };
  },
  renderCss: ({ scene, isPortrait, activePalette }) => `
    [data-composition-id="${scene.id}"] .cards-container { display: grid; grid-template-columns: 1fr 1fr; gap: 36px; width: 100%; max-width: 1540px; margin-top: 36px; }
    [data-composition-id="${scene.id}"] .feature-card { background: ${activePalette.card}; border: 1px solid ${activePalette.border}; border-radius: 24px; padding: ${isPortrait ? "36px 40px" : "40px"}; box-shadow: 0 16px 40px rgba(0,0,0,0.04); display: flex; flex-direction: column; text-align: left; }
    [data-composition-id="${scene.id}"] .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid ${activePalette.border}; }
    [data-composition-id="${scene.id}"] .card-title { font-family: "Playfair Display", serif; font-size: 32px; font-weight: 700; color: ${activePalette.text}; }
    [data-composition-id="${scene.id}"] .card-badge { font-family: "JetBrains Mono", monospace; font-size: 14px; font-weight: 500; padding: 6px 14px; border-radius: 20px; background: rgba(0,0,0,0.06); color: ${activePalette.text}; }
    [data-composition-id="${scene.id}"] .card-badge.privacy { background: #e9f3ec; color: #27623d; }
    [data-composition-id="${scene.id}"] .email-body { font-size: 24px; line-height: 1.5; color: ${activePalette.text}; min-height: 100px; }
    [data-composition-id="${scene.id}"] .typed-word { display: inline; opacity: 0; }
    [data-composition-id="${scene.id}"] .notes-list { list-style: none; display: flex; flex-direction: column; gap: 16px; }
    [data-composition-id="${scene.id}"] .note-item { display: flex; align-items: flex-start; gap: 14px; font-size: 20px; line-height: 1.45; color: ${activePalette.text}; opacity: 0; transform: translateY(12px); }
    [data-composition-id="${scene.id}"] .note-icon { width: 22px; height: 22px; border-radius: 6px; background: rgba(0,0,0,0.08); display: flex; align-items: center; justify-content: center; font-size: 13px; flex-shrink: 0; margin-top: 3px; }
  `,
};

registerArchetypeRenderer("features-cards", renderDefaultCards);

export function getArchetypeRenderer(archetype) {
  const key = String(archetype ?? "")
    .toLowerCase()
    .trim()
    .replace(/_/g, "-");
  return ARCHETYPE_RENDERERS[key] || renderDefaultCards;
}

// Bento Metric Grid — multi-stat grid, hero tile, animated accent borders.
registerArchetypeRenderer("bento-metric-grid", {
  getBackground: ({ activePalette, scene }) =>
    scene?.theme === "dark" || activePalette?.isDark
      ? `background: radial-gradient(circle at 20% 20%, ${activePalette.accent}24 0%, transparent 60%), #0b0d14;`
      : `background: radial-gradient(circle at 20% 20%, ${activePalette.accent}18 0%, transparent 55%), ${activePalette.background};`,
  renderHtml: ({ scene, i, isPortrait, h }) => {
    const metrics =
      Array.isArray(scene.bentoData?.metrics) && scene.bentoData.metrics.length
        ? scene.bentoData.metrics
        : [{ label: scene.title || "Metric", value: 0, unit: "", detail: "", hero: true }];
    const tilesHtml = metrics
      .map((m) => {
        const label = typeof m.label === "string" ? m.label : "";
        const value = formatCompactMetric(m.value);
        const unit = typeof m.unit === "string" ? m.unit : "";
        const detail = typeof m.detail === "string" ? m.detail : "";
        return `
        <div class="bento-tile${m.hero ? " bento-hero" : ""}">
          <div class="bento-border"></div>
          <div class="bento-value"><span class="bento-num">${h(value)}</span><span class="bento-unit">${h(unit)}</span></div>
          <div class="bento-label">${h(label)}</div>
          ${detail ? `<div class="bento-detail">${h(detail)}</div>` : ""}
        </div>`;
      })
      .join("\n");
    return {
      innerHtml: `
        <div class="scene-inner" style="display:flex;flex-direction:column;align-items:center;text-align:center;">
          <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || "By The Numbers")}</span></div>
          <h1 id="s${i + 1}-title" class="editorial-title" style="font-size: ${isPortrait ? "60px" : "72px"}">${h(scene.title)}</h1>
          <div id="s${i + 1}-bento" class="bento-grid">${tilesHtml}</div>
        </div>
      `,
      gsapChoreography: `
        tl.from(scope.querySelector("#s${i + 1}-eyebrow"), { opacity: 0, y: 20, duration: 0.5 }, 0.2);
        tl.from(scope.querySelector("#s${i + 1}-title"), { opacity: 0, y: 25, duration: 0.6 }, 0.4);
        tl.from(scope.querySelectorAll(".bento-tile"), { opacity: 0, y: 30, scale: 0.96, stagger: 0.12, duration: 0.55, ease: "power3.out" }, 0.5);
        tl.fromTo(scope.querySelectorAll(".bento-border"), { scaleX: 0, opacity: 0 }, { scaleX: 1, opacity: 1, stagger: 0.1, duration: 0.6, ease: "power2.inOut" }, 0.7);
        tl.from(scope.querySelectorAll(".bento-value"), {
          opacity: 0,
          y: 18,
          scale: 0.92,
          stagger: 0.12,
          duration: 0.5,
          ease: "back.out(1.4)"
        }, 0.7);
      `,
    };
  },
  renderCss: ({ scene, isPortrait, activePalette }) => `
    [data-composition-id="${scene.id}"] .bento-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: ${isPortrait ? "16px" : "20px"}; margin-top: 48px; max-width: 1080px; }
    [data-composition-id="${scene.id}"] .bento-tile { position: relative; overflow: hidden; background: ${activePalette.card}; border: 1px solid ${activePalette.border}; border-radius: 20px; padding: ${isPortrait ? "26px" : "32px"}; text-align: left; }
    [data-composition-id="${scene.id}"] .bento-hero { grid-column: span 2; grid-row: span 2; background: ${activePalette.accent}14; }
    [data-composition-id="${scene.id}"] .bento-border { position: absolute; inset: 0 0 auto 0; height: 3px; background: linear-gradient(90deg, ${activePalette.accent}, transparent); transform-origin: left; }
    [data-composition-id="${scene.id}"] .bento-value { font-size: ${isPortrait ? "48px" : "64px"}; font-weight: 700; color: ${activePalette.text}; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
    [data-composition-id="${scene.id}"] .bento-unit { font-size: 0.45em; font-weight: 600; color: ${activePalette.accent}; margin-left: 6px; }
    [data-composition-id="${scene.id}"] .bento-label { font-size: ${isPortrait ? "18px" : "20px"}; font-weight: 600; color: ${activePalette.text}; margin-top: 10px; }
    [data-composition-id="${scene.id}"] .bento-detail { font-size: 16px; color: ${activePalette.textMuted || activePalette.muted || "#9ca3af"}; margin-top: 6px; }
  `,
});

// Terminal Flow — left narrative bullets, right simulated terminal preview card.
registerArchetypeRenderer("terminal-flow", {
  getBackground: ({ activePalette, scene }) =>
    scene?.theme === "dark" || activePalette?.isDark
      ? `background: radial-gradient(ellipse at 75% 20%, ${activePalette.accent}22 0%, transparent 55%), #0b0d14;`
      : `background: linear-gradient(120deg, ${activePalette.accent}14 0%, transparent 45%), ${activePalette.background};`,
  renderHtml: ({ scene, i, isPortrait, h }) => {
    const bullets = (
      Array.isArray(scene.terminalData?.bullets) && scene.terminalData.bullets.length
        ? scene.terminalData.bullets
        : [{ text: scene.title || "Describe the workflow here." }]
    )
      .map((b) => {
        const text = typeof b === "string" ? b : typeof b?.text === "string" ? b.text : "";
        return `<li class="tf-bullet"><span class="tf-bullet-dot"></span><span>${h(text)}</span></li>`;
      })
      .join("\n");
    const lines =
      Array.isArray(scene.terminalData?.lines) && scene.terminalData.lines.length
        ? scene.terminalData.lines
        : [
            {
              prompt: "$",
              text: "hyperframes render --out demo.mp4",
              output: "✓ rendered 240 frames",
            },
          ];
    const termHtml = lines
      .map((l) => {
        const prompt = typeof l?.prompt === "string" ? l.prompt : "$";
        const text = typeof l?.text === "string" ? l.text : "";
        const output = typeof l?.output === "string" ? l.output : "";
        return `
        <div class="tf-line">
          <span class="tf-prompt">${h(prompt)}</span>
          <span class="tf-cmd">${h(text)}</span>
          ${output ? `<div class="tf-out">${h(output)}</div>` : ""}
        </div>`;
      })
      .join("\n");
    // Compact HUD header: [TRACE // 01] TAG  (no eyebrow dot, no serif title)
    const rawTag =
      scene.terminalData?.hudTag ||
      scene.eyebrow ||
      (scene.title || "WORKFLOW").toUpperCase().slice(0, 22);
    const hudTag = h(rawTag);
    return {
      innerHtml: `
        <div class="scene-inner tf-canvas" id="s${i + 1}-canvas">
          <div class="tf-hud-header" id="s${i + 1}-hud">
            <span class="tf-hud-trace">[ TRACE // ${String(i + 1).padStart(2, "0")} ]</span>
            <span class="tf-hud-tag">${hudTag}</span>
          </div>
          <div class="tf-split">
            <div class="tf-left">
              <h1 class="tf-hud-title" id="s${i + 1}-title">${h(scene.title)}</h1>
              <ul id="s${i + 1}-bullets" class="tf-bullets">${bullets}</ul>
            </div>
            <div class="tf-right">
              <div id="s${i + 1}-term" class="tf-terminal">
                <div class="tf-titlebar"><span class="tf-dot tf-dot-red"></span><span class="tf-dot tf-dot-yellow"></span><span class="tf-dot tf-dot-green"></span><span class="tf-title">terminal</span><span class="tf-title-path">${h(scene.terminalData?.hudTag || "~")}</span></div>
                <div class="tf-body">${termHtml}</div>
              </div>
            </div>
          </div>
          <div class="tf-scan-line" id="s${i + 1}-scan"></div>
        </div>
      `,
      gsapChoreography: `
        tl.from(scope.querySelector("#s${i + 1}-hud"), { opacity: 0, y: -20, duration: 0.35, ease: "power2.out" }, 0.1);
        tl.from(scope.querySelector("#s${i + 1}-title"), { opacity: 0, x: -32, duration: 0.5, ease: "power3.out" }, 0.25);
        tl.from(scope.querySelectorAll(".tf-bullet"), { opacity: 0, x: -24, stagger: 0.1, duration: 0.4 }, 0.5);
        tl.from(scope.querySelector("#s${i + 1}-term"), { opacity: 0, y: 36, scale: 0.97, duration: 0.65, ease: "power3.out" }, 0.3);
        tl.from(scope.querySelectorAll(".tf-line"), { opacity: 0, y: 10, stagger: 0.22, duration: 0.32 }, 0.9);
        tl.to(scope.querySelector("#s${i + 1}-scan"), { y: "100%", duration: Math.max(2, sDur - 1.0), ease: "none", repeat: -1 }, 1.2);
        tl.to(scope.querySelector("#s${i + 1}-canvas"), { scale: 1.028, duration: Math.max(1, sDur - 1.0), ease: "none" }, 0.4);
      `,
    };
  },
  renderCss: ({ scene, isPortrait, activePalette }) => `
    [data-composition-id="${scene.id}"] .tf-canvas { position: relative; width: 100%; height: 100%; display: flex; flex-direction: column; padding: ${isPortrait ? "90px 44px 60px" : "52px 72px 52px"}; box-sizing: border-box; overflow: hidden; }
    [data-composition-id="${scene.id}"] .tf-hud-header { display: flex; align-items: center; gap: 20px; margin-bottom: ${isPortrait ? "28px" : "32px"}; }
    [data-composition-id="${scene.id}"] .tf-hud-trace { font-family: "JetBrains Mono", monospace; font-size: ${isPortrait ? "16px" : "15px"}; font-weight: 700; color: ${activePalette.accent}; letter-spacing: 0.12em; opacity: 0.75; }
    [data-composition-id="${scene.id}"] .tf-hud-tag { font-family: "JetBrains Mono", monospace; font-size: ${isPortrait ? "18px" : "16px"}; font-weight: 700; color: ${activePalette.text || "#f3f4f8"}; letter-spacing: 0.08em; text-transform: uppercase; }
    [data-composition-id="${scene.id}"] .tf-split { display: flex; ${isPortrait ? "flex-direction: column;" : "flex-direction: row; align-items: flex-start;"} gap: ${isPortrait ? "32px" : "52px"}; flex: 1; }
    [data-composition-id="${scene.id}"] .tf-left { flex: 0 0 ${isPortrait ? "100%" : "38%"}; display: flex; flex-direction: column; justify-content: flex-start; }
    [data-composition-id="${scene.id}"] .tf-hud-title { font-family: "Inter", sans-serif; font-size: ${isPortrait ? "42px" : "48px"}; font-weight: 800; line-height: 1.1; letter-spacing: -0.03em; color: ${activePalette.text || "#f3f4f8"}; margin: 0 0 24px; }
    [data-composition-id="${scene.id}"] .tf-right { flex: 1; display: flex; align-items: flex-start; justify-content: flex-end; }
    [data-composition-id="${scene.id}"] .tf-bullets { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 16px; }
    [data-composition-id="${scene.id}"] .tf-bullet { display: flex; align-items: flex-start; gap: 14px; font-size: ${isPortrait ? "19px" : "21px"}; color: ${activePalette.text || "#f3f4f8"}; line-height: 1.4; opacity: 0.9; }
    [data-composition-id="${scene.id}"] .tf-bullet-dot { width: 8px; height: 8px; border-radius: 50%; background: ${activePalette.accent}; margin-top: 9px; flex-shrink: 0; box-shadow: 0 0 8px ${activePalette.accent}; }
    [data-composition-id="${scene.id}"] .tf-terminal { width: 100%; max-width: ${isPortrait ? "100%" : "700px"}; background: #0d0e16; border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; overflow: hidden; box-shadow: 0 30px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,102,241,0.12); font-family: "JetBrains Mono", monospace; text-align: left; }
    [data-composition-id="${scene.id}"] .tf-titlebar { display: flex; align-items: center; gap: 8px; padding: 13px 18px; background: #13141e; border-bottom: 1px solid rgba(255,255,255,0.06); }
    [data-composition-id="${scene.id}"] .tf-dot { width: 12px; height: 12px; border-radius: 50%; }
    [data-composition-id="${scene.id}"] .tf-dot-red { background: #ff5f57; }
    [data-composition-id="${scene.id}"] .tf-dot-yellow { background: #febc2e; }
    [data-composition-id="${scene.id}"] .tf-dot-green { background: #28c840; }
    [data-composition-id="${scene.id}"] .tf-title { margin-left: 8px; font-size: 13px; color: rgba(255,255,255,0.4); }
    [data-composition-id="${scene.id}"] .tf-title-path { margin-left: auto; font-size: 12px; color: ${activePalette.accent}88; }
    [data-composition-id="${scene.id}"] .tf-body { padding: ${isPortrait ? "20px" : "24px 28px 32px"}; display: flex; flex-direction: column; gap: ${isPortrait ? "14px" : "18px"}; }
    [data-composition-id="${scene.id}"] .tf-line { display: flex; flex-wrap: wrap; align-items: baseline; gap: 10px; font-size: ${isPortrait ? "14px" : "16px"}; }
    [data-composition-id="${scene.id}"] .tf-prompt { color: ${activePalette.accent}; font-weight: 700; }
    [data-composition-id="${scene.id}"] .tf-cmd { color: #e8e8f0; }
    [data-composition-id="${scene.id}"] .tf-out { width: 100%; color: #6fca8a; font-size: ${isPortrait ? "13px" : "14px"}; padding-left: 20px; opacity: 0.85; }
    [data-composition-id="${scene.id}"] .tf-scan-line { position: absolute; left: 0; right: 0; top: -2px; height: 2px; background: linear-gradient(90deg, transparent, ${activePalette.accent}66, transparent); pointer-events: none; }
  `,
});

// Step Progression — connected node timeline with GSAP-driven pulse.
// The pulse is a GSAP repeat:-1 tween (NOT a CSS @keyframes animation) so the
// Puppeteer/seek-by-frame adapters can render each frame deterministically.
registerArchetypeRenderer("step-progression", {
  getBackground: ({ activePalette }) =>
    `background: radial-gradient(circle at 80% 15%, ${activePalette.accent}15 0%, transparent 50%), ${activePalette.background};`,
  renderHtml: ({ scene, i, isPortrait, h }) => {
    const steps = (
      Array.isArray(scene.progressData?.steps) && scene.progressData.steps.length
        ? scene.progressData.steps
        : [
            { label: "Input", caption: "" },
            { label: "Transform", caption: "" },
            { label: "Output", caption: "" },
          ]
    ).slice(0, 4);
    const activeIndex = Math.min(steps.length - 1, 1);
    const nodesHtml = steps
      .map((s, j) => {
        const label = typeof s?.label === "string" ? s.label : `Step ${j + 1}`;
        const caption = typeof s?.caption === "string" ? s.caption : "";
        return `
        <div class="sp-step${j === activeIndex ? " sp-active" : ""}">
          <div class="sp-node"><span class="sp-node-core"></span></div>
          <div class="sp-label">${h(label)}</div>
          ${caption ? `<div class="sp-caption">${h(caption)}</div>` : ""}
        </div>`;
      })
      .join("\n");
    return {
      innerHtml: `
        <div class="scene-inner" style="display:flex;flex-direction:column;align-items:center;text-align:center;">
          <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || "The Path")}</span></div>
          <h1 id="s${i + 1}-title" class="editorial-title" style="font-size: ${isPortrait ? "56px" : "68px"}">${h(scene.title)}</h1>
          <div id="s${i + 1}-track" class="sp-track">
            <div class="sp-connector"></div>
            ${nodesHtml}
          </div>
        </div>
      `,
      gsapChoreography: `
        tl.from(scope.querySelector("#s${i + 1}-eyebrow"), { opacity: 0, y: 20, duration: 0.5 }, 0.2);
        tl.from(scope.querySelector("#s${i + 1}-title"), { opacity: 0, y: 25, duration: 0.6 }, 0.4);
        tl.fromTo(scope.querySelector(".sp-connector"), { scaleX: 0, opacity: 1 }, { scaleX: 1, opacity: 1, duration: 1.0, ease: "power2.inOut" }, 0.7);
        tl.from(scope.querySelectorAll(".sp-step"), { opacity: 0, y: 26, stagger: 0.18, duration: 0.5, ease: "power3.out" }, 0.8);
        tl.to(scope.querySelector(".sp-active .sp-node"), { boxShadow: "0 0 0 14px rgba(0,0,0,0)", duration: 0.8, repeat: -1, yoyo: true, ease: "sine.inOut" }, 1.5);
      `,
    };
  },
  renderCss: ({ scene, isPortrait, activePalette }) => `
    [data-composition-id="${scene.id}"] .sp-track { position: relative; display: flex; justify-content: space-between; ${isPortrait ? "flex-direction: column; align-items: center; gap: 40px;" : ""} margin-top: 72px; max-width: 1080px; width: 100%; }
    [data-composition-id="${scene.id}"] .sp-connector { position: absolute; ${isPortrait ? "left: 26px; top: 0; bottom: 0; width: 3px; height: auto; transform-origin: top;" : "left: 6%; right: 6%; top: 26px; height: 3px; transform-origin: left;"} background: linear-gradient(90deg, ${activePalette.accent}, ${activePalette.accent}44); border-radius: 2px; }
    [data-composition-id="${scene.id}"] .sp-step { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; ${isPortrait ? "flex-direction: row; width: 100%; gap: 20px;" : ""} text-align: center; }
    [data-composition-id="${scene.id}"] .sp-node { width: 52px; height: 52px; border-radius: 50%; background: ${activePalette.background}; border: 3px solid ${activePalette.accent}; display: flex; align-items: center; justify-content: center; }
    [data-composition-id="${scene.id}"] .sp-node-core { width: 16px; height: 16px; border-radius: 50%; background: ${activePalette.accent}; }
    [data-composition-id="${scene.id}"] .sp-label { font-size: ${isPortrait ? "22px" : "24px"}; font-weight: 700; color: ${activePalette.text}; margin-top: 16px; }
    [data-composition-id="${scene.id}"] .sp-caption { font-size: 17px; color: ${activePalette.border}; margin-top: 8px; max-width: 220px; }
  `,
});

// Vector Cluster Graph — Asymmetric 60/40 spatial vector field with clustered nodes and traversal path
registerArchetypeRenderer("vector-cluster-graph", {
  getBackground: ({ activePalette, scene }) =>
    scene?.theme === "dark" || activePalette?.isDark
      ? `background: radial-gradient(circle at 65% 45%, ${activePalette.accent}24 0%, transparent 65%), #0b0d14;`
      : `background: radial-gradient(circle at 70% 45%, ${activePalette.accent}16 0%, transparent 60%), ${activePalette.background};`,
  renderHtml: ({ scene, i, isPortrait, h, activePalette }) => {
    const rawClusters =
      Array.isArray(scene.clusters) && scene.clusters.length
        ? scene.clusters
        : [
            { name: "Semantic Intent", nodeCount: 16, active: true },
            { name: "Syntactic Match", nodeCount: 9, active: false },
            { name: "Pruned Subgraph", nodeCount: 12, active: false },
          ];
    const clusters = rawClusters.slice(0, 3);
    const queryLabel = scene.queryLabel || 'q = embed("semantic intent")';
    const stats = scene.stats || { metric: "99.4% Cosine Sim", latency: "1.2ms HNSW" };
    const accent = activePalette?.accent || "#6366f1";

    return {
      innerHtml: `
        <div class="scene-inner vc-container${isPortrait ? " vc-portrait" : ""}">
          <div class="vc-left-col">
            <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || "Embedding Space")}</span></div>
            <h1 id="s${i + 1}-title" class="vc-title">${h(scene.title)}</h1>
            <p id="s${i + 1}-subtitle" class="vc-subtitle">${h(scene.subtitle || scene.voiceover?.slice(0, 130) || "")}</p>
            <div id="s${i + 1}-query" class="vc-query-chip">
              <span class="vc-query-dot"></span>
              <code class="vc-query-code">${h(queryLabel)}</code>
            </div>
            <div class="vc-stats-grid">
              <div class="vc-stat-tile">
                <span class="vc-stat-val">${h(stats.metric || "99.4% Sim")}</span>
                <span class="vc-stat-lbl">Recall Score</span>
              </div>
              <div class="vc-stat-tile">
                <span class="vc-stat-val">${h(stats.latency || "1.2ms")}</span>
                <span class="vc-stat-lbl">Search Latency</span>
              </div>
            </div>
            <div class="vc-legend">
              ${clusters
                .map(
                  (c, cIdx) => `
                <div class="vc-legend-item${c.active ? " vc-active" : ""}">
                  <span class="vc-legend-dot" style="background:${c.active ? accent : "rgba(255,255,255,0.4)"}"></span>
                  <span class="vc-legend-name">${h(c.name || `Cluster ${cIdx + 1}`)}</span>
                  <span class="vc-legend-cnt">${h(c.nodeCount || 10)} pts</span>
                </div>`,
                )
                .join("")}
            </div>
          </div>
          <div class="vc-right-canvas">
            <svg class="vc-svg" viewBox="0 0 760 520" preserveAspectRatio="xMidYMid meet">
              <defs>
                <radialGradient id="s${i + 1}-centroid-glow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stop-color="${accent}" stop-opacity="0.45" />
                  <stop offset="100%" stop-color="${accent}" stop-opacity="0" />
                </radialGradient>
              </defs>

              <!-- Constellation Lines (Cluster 1: Target Centroid 490, 180) -->
              <g class="vc-edges vc-edges-active">
                <line class="vc-edge" x1="490" y1="180" x2="440" y2="140" />
                <line class="vc-edge" x1="490" y1="180" x2="540" y2="150" />
                <line class="vc-edge" x1="490" y1="180" x2="460" y2="230" />
                <line class="vc-edge" x1="490" y1="180" x2="550" y2="210" />
                <line class="vc-edge" x1="440" y1="140" x2="500" y2="110" />
                <line class="vc-edge" x1="540" y1="150" x2="580" y2="180" />
                <line class="vc-edge" x1="460" y1="230" x2="520" y2="250" />
              </g>

              <!-- Constellation Lines (Cluster 2: Syntactic Centroid 260, 380) -->
              <g class="vc-edges vc-edges-inactive">
                <line class="vc-edge" x1="260" y1="380" x2="210" y2="350" />
                <line class="vc-edge" x1="260" y1="380" x2="310" y2="360" />
                <line class="vc-edge" x1="260" y1="380" x2="240" y2="430" />
                <line class="vc-edge" x1="260" y1="380" x2="300" y2="420" />
              </g>

              <!-- Constellation Lines (Cluster 3: Pruned Centroid 560, 400) -->
              <g class="vc-edges vc-edges-inactive">
                <line class="vc-edge" x1="560" y1="400" x2="510" y2="380" />
                <line class="vc-edge" x1="560" y1="400" x2="620" y2="390" />
                <line class="vc-edge" x1="560" y1="400" x2="540" y2="450" />
                <line class="vc-edge" x1="560" y1="400" x2="600" y2="440" />
              </g>

              <!-- Pruned Neighbor Traversal Candidates (Low-opacity dashed) -->
              <path class="vc-pruned-path" d="M 120 160 Q 180 280, 260 380" fill="none" stroke-dasharray="6 6" />

              <!-- Traversal Path from Query Vector to Target Centroid -->
              <path id="s${i + 1}-traversal" class="vc-traversal-path" d="M 120 160 Q 280 80, 490 180" fill="none" stroke-dasharray="460" stroke-dashoffset="460" />

              <!-- Target Centroid Halo & Node -->
              <circle class="vc-centroid-halo" cx="490" cy="180" r="42" fill="url(#s${i + 1}-centroid-glow)" />
              <circle class="vc-centroid" cx="490" cy="180" r="16" />
              <circle class="vc-centroid-core" cx="490" cy="180" r="6" />

              <!-- Cluster 1 Nodes -->
              <g class="vc-nodes vc-nodes-active">
                <circle class="vc-node active-node" cx="440" cy="140" r="6" />
                <circle class="vc-node active-node" cx="540" cy="150" r="7" />
                <circle class="vc-node active-node" cx="460" cy="230" r="6.5" />
                <circle class="vc-node active-node" cx="550" cy="210" r="6" />
                <circle class="vc-node active-node" cx="500" cy="110" r="5" />
                <circle class="vc-node active-node" cx="580" cy="180" r="5.5" />
                <circle class="vc-node active-node" cx="520" cy="250" r="5" />
              </g>

              <!-- Cluster 2 Nodes -->
              <g class="vc-nodes vc-nodes-b">
                <circle class="vc-node" cx="260" cy="380" r="8" />
                <circle class="vc-node" cx="210" cy="350" r="5" />
                <circle class="vc-node" cx="310" cy="360" r="6" />
                <circle class="vc-node" cx="240" cy="430" r="5.5" />
                <circle class="vc-node" cx="300" cy="420" r="5" />
              </g>

              <!-- Cluster 3 Nodes -->
              <g class="vc-nodes vc-nodes-c">
                <circle class="vc-node" cx="560" cy="400" r="8" />
                <circle class="vc-node" cx="510" cy="380" r="5" />
                <circle class="vc-node" cx="620" cy="390" r="5.5" />
                <circle class="vc-node" cx="540" cy="450" r="6" />
                <circle class="vc-node" cx="600" cy="440" r="5" />
              </g>

              <!-- Query Vector Marker (Source) -->
              <g class="vc-query-marker">
                <circle class="vc-query-ripple" cx="120" cy="160" r="28" />
                <circle class="vc-query-outer" cx="120" cy="160" r="14" />
                <circle class="vc-query-inner" cx="120" cy="160" r="5" />
                <text class="vc-query-svg-label" x="120" y="118" text-anchor="middle">q [Query Vector]</text>
              </g>

              <!-- Centroid Target Label -->
              <text class="vc-target-label" x="490" y="222" text-anchor="middle">Nearest Centroid</text>
            </svg>
          </div>
        </div>
      `,
      gsapChoreography: `
        tl.from(scope.querySelector(".vc-left-col"), { opacity: 0, x: -35, duration: 0.6, ease: "power3.out" }, 0.2);
        tl.from(scope.querySelector(".vc-query-marker"), { opacity: 0, scale: 0, transformOrigin: "120px 160px", duration: 0.5, ease: "back.out(2)" }, 0.4);
        tl.from(scope.querySelectorAll(".vc-node"), { opacity: 0, scale: 0, transformOrigin: "center center", stagger: 0.02, duration: 0.45, ease: "back.out(2)" }, 0.6);
        tl.from(scope.querySelectorAll(".vc-edge"), { opacity: 0, stagger: 0.015, duration: 0.4 }, 0.75);
        tl.from(scope.querySelector(".vc-pruned-path"), { opacity: 0, duration: 0.5 }, 0.9);
        tl.to(scope.querySelector("#s${i + 1}-traversal"), { strokeDashoffset: 0, duration: 0.85, ease: "power2.inOut" }, 1.0);
        tl.fromTo(scope.querySelector(".vc-centroid-halo"), { scale: 0.7, opacity: 0.1 }, { scale: 1.3, opacity: 0.5, duration: 0.6, yoyo: true, repeat: 1, ease: "sine.out" }, 1.7);
        tl.to(scope.querySelector(".vc-query-ripple"), { scale: 1.3, opacity: 0, duration: 1.4, repeat: -1, ease: "power1.out", transformOrigin: "120px 160px" }, 1.8);
        tl.to(scope.querySelectorAll(".vc-nodes-b .vc-node, .vc-nodes-c .vc-node"), { x: "+=6", y: "-=4", duration: Math.max(2, sDur * 0.4), ease: "sine.inOut", yoyo: true, repeat: -1, stagger: 0.08 }, 2.0);
        tl.to(scope.querySelector(".vc-right-canvas"), { scale: 1.04, duration: Math.max(2, sDur - 1.5), ease: "none" }, 0.5);
      `,
    };
  },
  renderCss: ({ scene, isPortrait, activePalette }) => `
    [data-composition-id="${scene.id}"] .vc-container { width: 100%; height: 100%; display: flex; flex-direction: ${isPortrait ? "column" : "row"}; align-items: center; justify-content: space-between; padding: ${isPortrait ? "100px 48px 60px" : "60px 80px"}; box-sizing: border-box; text-align: left; gap: 40px; }
    [data-composition-id="${scene.id}"] .vc-left-col { flex: 0 0 ${isPortrait ? "100%" : "38%"}; max-width: ${isPortrait ? "920px" : "560px"}; display: flex; flex-direction: column; align-items: flex-start; text-align: left; }
    [data-composition-id="${scene.id}"] .vc-title { font-family: "Playfair Display", serif; font-size: ${isPortrait ? "56px" : "64px"}; font-weight: 700; line-height: 1.15; letter-spacing: -0.02em; color: ${activePalette.text}; margin-top: 8px; }
    [data-composition-id="${scene.id}"] .vc-subtitle { font-size: ${isPortrait ? "22px" : "22px"}; color: ${activePalette.textMuted || activePalette.muted || activePalette.text}; line-height: 1.45; margin-top: 14px; }
    [data-composition-id="${scene.id}"] .vc-query-chip { margin-top: 20px; display: inline-flex; align-items: center; gap: 10px; background: rgba(99, 102, 241, 0.1); border: 1px solid ${activePalette.accent}55; padding: 8px 18px; border-radius: 20px; font-family: "JetBrains Mono", monospace; font-size: 14px; font-weight: 600; color: ${activePalette.accent}; }
    [data-composition-id="${scene.id}"] .vc-query-dot { width: 8px; height: 8px; border-radius: 50%; background: ${activePalette.accent}; box-shadow: 0 0 10px ${activePalette.accent}; }
    [data-composition-id="${scene.id}"] .vc-stats-grid { display: flex; gap: 14px; margin-top: 22px; width: 100%; }
    [data-composition-id="${scene.id}"] .vc-stat-tile { flex: 1; background: ${activePalette.card}; border: 1px solid ${activePalette.border}; border-radius: 16px; padding: 14px 18px; display: flex; flex-direction: column; gap: 4px; box-shadow: 0 8px 24px rgba(0,0,0,0.04); }
    [data-composition-id="${scene.id}"] .vc-stat-val { font-family: "JetBrains Mono", monospace; font-size: 20px; font-weight: 700; color: ${activePalette.text}; }
    [data-composition-id="${scene.id}"] .vc-stat-lbl { font-size: 13px; color: ${activePalette.textMuted || activePalette.muted}; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
    [data-composition-id="${scene.id}"] .vc-legend { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 20px; }
    [data-composition-id="${scene.id}"] .vc-legend-item { display: inline-flex; align-items: center; gap: 8px; background: rgba(0,0,0,0.04); border: 1px solid ${activePalette.border}; padding: 6px 14px; border-radius: 14px; font-size: 13px; color: ${activePalette.textMuted || activePalette.text}; }
    [data-composition-id="${scene.id}"] .vc-legend-item.vc-active { border-color: ${activePalette.accent}; color: ${activePalette.text}; background: rgba(99, 102, 241, 0.08); font-weight: 600; }
    [data-composition-id="${scene.id}"] .vc-legend-dot { width: 8px; height: 8px; border-radius: 50%; }
    [data-composition-id="${scene.id}"] .vc-legend-cnt { font-family: "JetBrains Mono", monospace; font-size: 11px; opacity: 0.7; }
    [data-composition-id="${scene.id}"] .vc-right-canvas { flex: 0 0 ${isPortrait ? "100%" : "58%"}; height: ${isPortrait ? "580px" : "100%"}; display: flex; align-items: center; justify-content: center; position: relative; }
    [data-composition-id="${scene.id}"] .vc-svg { width: 100%; height: 100%; overflow: visible; }
    [data-composition-id="${scene.id}"] .vc-edge { stroke: ${activePalette.accent}44; stroke-width: 1.5; }
    [data-composition-id="${scene.id}"] .vc-edges-inactive .vc-edge { stroke: rgba(255,255,255,0.12); }
    [data-composition-id="${scene.id}"] .vc-pruned-path { stroke: rgba(255, 255, 255, 0.2); stroke-width: 1.5; }
    [data-composition-id="${scene.id}"] .vc-traversal-path { stroke: ${activePalette.accent}; stroke-width: 3.5; stroke-linecap: round; filter: drop-shadow(0 0 8px ${activePalette.accent}); }
    [data-composition-id="${scene.id}"] .vc-centroid { fill: ${activePalette.accent}; fill-opacity: 0.25; stroke: ${activePalette.accent}; stroke-width: 2.5; }
    [data-composition-id="${scene.id}"] .vc-centroid-core { fill: #ffffff; }
    [data-composition-id="${scene.id}"] .vc-node { fill: ${activePalette.card}; stroke: ${activePalette.border}; stroke-width: 2; }
    [data-composition-id="${scene.id}"] .vc-node.active-node { fill: ${activePalette.accent}; stroke: #ffffff; stroke-width: 1.5; }
    [data-composition-id="${scene.id}"] .vc-nodes-b .vc-node, [data-composition-id="${scene.id}"] .vc-nodes-c .vc-node { fill: #222738; stroke: rgba(255,255,255,0.2); }
    [data-composition-id="${scene.id}"] .vc-query-ripple { fill: none; stroke: ${activePalette.accent}; stroke-width: 1.5; stroke-dasharray: 4 4; }
    [data-composition-id="${scene.id}"] .vc-query-outer { fill: ${activePalette.accent}; stroke: #ffffff; stroke-width: 2.5; filter: drop-shadow(0 0 10px ${activePalette.accent}); }
    [data-composition-id="${scene.id}"] .vc-query-inner { fill: #ffffff; }
    [data-composition-id="${scene.id}"] .vc-query-svg-label { font-family: "JetBrains Mono", monospace; font-size: 14px; font-weight: 700; fill: ${activePalette.text}; }
    [data-composition-id="${scene.id}"] .vc-target-label { font-family: "JetBrains Mono", monospace; font-size: 12px; font-weight: 600; fill: ${activePalette.accent}; letter-spacing: 0.05em; }
  `,
});

// Kinetic Impact — pure full-bleed display typography takeover.
// NO eyebrow, NO cards, NO subtitle boxes. Aggressive word-slam with clip-path mask reveals.
registerArchetypeRenderer("kinetic-impact", {
  getBackground: ({ activePalette, scene }) =>
    scene?.theme === "dark" || activePalette?.isDark
      ? `background: #06060c;`
      : `background: linear-gradient(160deg, ${activePalette.accent}08 0%, ${activePalette.background} 40%, ${activePalette.accent}0c 100%);`,
  renderHtml: ({ scene, i, isPortrait, h, activePalette }) => {
    const rawLines =
      Array.isArray(scene.impactData?.lines) && scene.impactData.lines.length
        ? scene.impactData.lines
        : [scene.title || "INSTANT", scene.subtitle || "IMPACT."];
    const lines = rawLines.slice(0, 4);
    const tag = scene.impactData?.tag || scene.eyebrow || "";
    const accent = activePalette?.accent || "#6366f1";
    const linesHtml = lines
      .map((line, idx) => {
        const isAccentLine =
          idx === lines.length - 1 || (scene.impactData?.accent && line === scene.impactData.accent);
        return `<div class="ki-line ki-line-${idx}${isAccentLine ? " ki-accent-line" : ""}" id="s${i + 1}-kl-${idx}">${h(String(line))}</div>`;
      })
      .join("\n");
    return {
      innerHtml: `
        <div class="scene-inner ki-stage" id="s${i + 1}-ki">
          ${tag ? `<div class="ki-tag" id="s${i + 1}-ki-tag">${h(tag)}</div>` : ""}
          <div class="ki-words" id="s${i + 1}-ki-words">
            ${linesHtml}
          </div>
          <div class="ki-glow-orb" id="s${i + 1}-ki-glow"></div>
          <div class="ki-grid-overlay"></div>
        </div>
      `,
      gsapChoreography: `
        tl.fromTo(scope.querySelector("#s${i + 1}-ki-glow"), { scale: 0.4, opacity: 0 }, { scale: 1.6, opacity: 0.6, duration: 1.2, ease: "power2.out" }, 0);
        ${tag ? `tl.from(scope.querySelector("#s${i + 1}-ki-tag"), { opacity: 0, letterSpacing: "0.4em", duration: 0.5, ease: "power2.out" }, 0.1);` : ""}
        scope.querySelectorAll(".ki-line").forEach((el, idx) => {
          tl.fromTo(el, { clipPath: "inset(0 100% 0 0)", opacity: 0.8 }, { clipPath: "inset(0 0% 0 0)", opacity: 1, duration: 0.45, ease: "power4.out" }, 0.25 + idx * 0.22);
        });
        tl.to(scope.querySelector("#s${i + 1}-ki-words"), { y: -18, duration: Math.max(1.5, sDur - 1.2), ease: "sine.inOut" }, 1.2);
        tl.to(scope.querySelector("#s${i + 1}-ki-glow"), { x: 60, y: -30, duration: Math.max(2, sDur - 0.8), ease: "sine.inOut" }, 0.8);
      `,
    };
  },
  renderCss: ({ scene, isPortrait, activePalette }) => {
    const accent = activePalette?.accent || "#6366f1";
    const textColor = activePalette?.isDark || scene?.theme === "dark" ? "#f3f4f8" : (activePalette?.text || "#111827");
    const fontSize = isPortrait ? "96px" : "124px";
    return `
    [data-composition-id="${scene.id}"] .ki-stage { position: relative; width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: flex-start; padding: ${isPortrait ? "100px 52px 80px" : "80px 100px"}; box-sizing: border-box; overflow: hidden; }
    [data-composition-id="${scene.id}"] .ki-tag { font-family: "JetBrains Mono", monospace; font-size: ${isPortrait ? "18px" : "16px"}; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase; color: ${accent}; margin-bottom: 32px; opacity: 0.8; }
    [data-composition-id="${scene.id}"] .ki-words { display: flex; flex-direction: column; gap: ${isPortrait ? "8px" : "4px"}; z-index: 2; position: relative; }
    [data-composition-id="${scene.id}"] .ki-line { font-family: "Inter", sans-serif; font-size: ${fontSize}; font-weight: 900; line-height: 0.96; letter-spacing: -0.04em; color: ${textColor}; text-transform: uppercase; clip-path: inset(0 0% 0 0); }
    [data-composition-id="${scene.id}"] .ki-accent-line { color: ${accent}; text-shadow: 0 0 80px ${accent}55; }
    [data-composition-id="${scene.id}"] .ki-glow-orb { position: absolute; width: ${isPortrait ? "600px" : "800px"}; height: ${isPortrait ? "600px" : "800px"}; border-radius: 50%; background: radial-gradient(circle, ${accent}28 0%, transparent 70%); filter: blur(80px); pointer-events: none; right: -200px; top: 50%; transform: translateY(-50%); z-index: 0; }
    [data-composition-id="${scene.id}"] .ki-grid-overlay { position: absolute; inset: 0; background: linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px); background-size: 48px 48px; pointer-events: none; z-index: 1; }
  `;
  },
});

// Stat Spotlight — cinematic single-metric focal point.
// One massive number with radiating SVG pulse rings, zero cards, zero clutter.
registerArchetypeRenderer("stat-spotlight", {
  getBackground: ({ activePalette, scene }) => {
    const accent = activePalette?.accent || "#6366f1";
    const isDark = scene?.theme === "dark" || activePalette?.isDark;
    return isDark
      ? `background: radial-gradient(circle at 50% 50%, ${accent}30 0%, ${accent}08 35%, #0b0d14 65%);`
      : `background: radial-gradient(circle at 50% 50%, ${accent}20 0%, ${accent}06 40%, ${activePalette.background} 70%);`;
  },
  renderHtml: ({ scene, i, isPortrait, h, activePalette }) => {
    const val = String(scene.spotlightData?.value ?? scene.metric?.value ?? "10M");
    const unit = String(scene.spotlightData?.unit ?? scene.metric?.label ?? "");
    const label = String(scene.spotlightData?.label ?? scene.title ?? "");
    const subLabel = String(scene.spotlightData?.subLabel ?? scene.subtitle ?? "");
    const accent = activePalette?.accent || "#6366f1";
    return {
      innerHtml: `
        <div class="scene-inner ss-stage" id="s${i + 1}-ss">
          <svg class="ss-rings" viewBox="0 0 600 600" preserveAspectRatio="xMidYMid meet">
            <circle class="ss-ring ss-ring-1" cx="300" cy="300" r="240" />
            <circle class="ss-ring ss-ring-2" cx="300" cy="300" r="180" />
            <circle class="ss-ring ss-ring-3" cx="300" cy="300" r="120" />
            <circle class="ss-ring ss-ring-glow" cx="300" cy="300" r="80" fill="url(#ss-glow-${i + 1})" />
            <defs>
              <radialGradient id="ss-glow-${i + 1}" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="${accent}" stop-opacity="0.35" />
                <stop offset="100%" stop-color="${accent}" stop-opacity="0" />
              </radialGradient>
            </defs>
          </svg>
          <div class="ss-focal" id="s${i + 1}-focal">
            <div class="ss-value" id="s${i + 1}-val">${h(val)}</div>
            ${unit ? `<div class="ss-unit" id="s${i + 1}-unit">${h(unit)}</div>` : ""}
          </div>
          <div class="ss-labels" id="s${i + 1}-labels">
            <div class="ss-label">${h(label)}</div>
            ${subLabel ? `<div class="ss-sub-label">${h(subLabel)}</div>` : ""}
          </div>
        </div>
      `,
      gsapChoreography: `
        tl.fromTo(scope.querySelector(".ss-ring-glow"), { scale: 0.3, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.8, ease: "power3.out", transformOrigin: "300px 300px" }, 0);
        tl.fromTo(scope.querySelector(".ss-ring-3"), { scale: 0.2, opacity: 0 }, { scale: 1, opacity: 0.6, duration: 0.7, ease: "power3.out", transformOrigin: "300px 300px" }, 0.1);
        tl.fromTo(scope.querySelector(".ss-ring-2"), { scale: 0.2, opacity: 0 }, { scale: 1, opacity: 0.35, duration: 0.8, ease: "power3.out", transformOrigin: "300px 300px" }, 0.2);
        tl.fromTo(scope.querySelector(".ss-ring-1"), { scale: 0.2, opacity: 0 }, { scale: 1, opacity: 0.18, duration: 0.9, ease: "power3.out", transformOrigin: "300px 300px" }, 0.3);
        tl.from(scope.querySelector("#s${i + 1}-val"), { opacity: 0, scale: 0.5, duration: 0.7, ease: "back.out(1.6)" }, 0.35);
        ${unit ? `tl.from(scope.querySelector("#s${i + 1}-unit"), { opacity: 0, y: 20, duration: 0.4 }, 0.85);` : ""}
        tl.from(scope.querySelector("#s${i + 1}-labels"), { opacity: 0, y: 28, duration: 0.5 }, 0.9);
        tl.to(scope.querySelector(".ss-ring-glow"), { scale: 1.4, duration: Math.max(1.5, sDur * 0.5), ease: "sine.inOut", yoyo: true, repeat: -1, transformOrigin: "300px 300px" }, 1.2);
        tl.to(scope.querySelector(".ss-ring-1"), { scale: 1.06, opacity: 0.08, duration: Math.max(2, sDur * 0.6), ease: "sine.inOut", yoyo: true, repeat: -1, transformOrigin: "300px 300px" }, 1.5);
        tl.to(scope.querySelector("#s${i + 1}-focal"), { scale: 1.04, duration: Math.max(2, sDur - 1.0), ease: "sine.inOut" }, 1.0);
      `,
    };
  },
  renderCss: ({ scene, isPortrait, activePalette }) => {
    const accent = activePalette?.accent || "#6366f1";
    const isDark = scene?.theme === "dark" || activePalette?.isDark;
    const textColor = isDark ? "#f3f4f8" : (activePalette?.text || "#111827");
    const mutedColor = isDark ? "#9ca3af" : (activePalette?.textMuted || "#6b7280");
    return `
    [data-composition-id="${scene.id}"] .ss-stage { position: relative; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: hidden; }
    [data-composition-id="${scene.id}"] .ss-rings { position: absolute; width: ${isPortrait ? "90vw" : "70vh"}; height: ${isPortrait ? "90vw" : "70vh"}; max-width: ${isPortrait ? "880px" : "700px"}; max-height: ${isPortrait ? "880px" : "700px"}; pointer-events: none; }
    [data-composition-id="${scene.id}"] .ss-ring { fill: none; stroke: ${accent}; }
    [data-composition-id="${scene.id}"] .ss-ring-1 { stroke-width: 1; opacity: 0.18; stroke-dasharray: 8 12; }
    [data-composition-id="${scene.id}"] .ss-ring-2 { stroke-width: 1.5; opacity: 0.35; stroke-dasharray: 4 8; }
    [data-composition-id="${scene.id}"] .ss-ring-3 { stroke-width: 2; opacity: 0.6; }
    [data-composition-id="${scene.id}"] .ss-focal { position: relative; z-index: 2; display: flex; flex-direction: column; align-items: center; text-align: center; }
    [data-composition-id="${scene.id}"] .ss-value { font-family: "Inter", sans-serif; font-size: ${isPortrait ? "128px" : "152px"}; font-weight: 900; letter-spacing: -0.05em; line-height: 1; color: ${accent}; text-shadow: 0 0 120px ${accent}66, 0 0 40px ${accent}44; }
    [data-composition-id="${scene.id}"] .ss-unit { font-family: "Inter", sans-serif; font-size: ${isPortrait ? "40px" : "48px"}; font-weight: 700; color: ${textColor}; margin-top: 8px; opacity: 0.85; letter-spacing: -0.02em; }
    [data-composition-id="${scene.id}"] .ss-labels { position: relative; z-index: 2; text-align: center; margin-top: 36px; }
    [data-composition-id="${scene.id}"] .ss-label { font-family: "Inter", sans-serif; font-size: ${isPortrait ? "36px" : "42px"}; font-weight: 700; color: ${textColor}; letter-spacing: -0.02em; }
    [data-composition-id="${scene.id}"] .ss-sub-label { font-size: ${isPortrait ? "22px" : "24px"}; color: ${mutedColor}; margin-top: 14px; max-width: 700px; line-height: 1.4; }
  `;
  },
});
