/**
 * Archetype HTML & CSS Renderers for Studio One.
 *
 * Implements a pluggable registry pattern: each visual archetype registers
 * its HTML builder, GSAP choreography, and scoped CSS rules in one clean place.
 */

import {
  synthesizeFallbackText,
  synthesizeFallbackNumber,
  NEUTRAL_TOKENS,
} from "./fallbackText.mjs";
import { harmonizePalette } from "./color-contrast.mjs";

export { synthesizeFallbackText };

/**
 * Temporal pacing helper (runs in Node, returns GSAP source for the scene script).
 *
 * Spreads N sequential items across the narration window instead of revealing them all in
 * the first second. After a 0.8s entrance buffer, item i becomes the "active" item at
 *     t_i = 0.8 + i * dt,   dt = (sDur - 1.5) / N
 * The active item gets an accent glow + 1.04 scale; earlier items settle to a dimmed state.
 *
 * `elementsExpr` is a JS expression (evaluated in the scene script) giving an array-like of
 * elements. `options.activeProps` / `options.settledProps` are GSAP vars objects.
 */
export function scheduleStepProgression(tl, elementsExpr, totalDuration, options = {}) {
  // `tl` names the timeline variable in the generated scene script (default "tl").
  const timeline = typeof tl === "string" && tl ? tl : "tl";
  const accent = typeof options.accent === "string" ? options.accent : "#6366f1";
  const {
    entranceBuffer = 0.8,
    tailBuffer = 0.7,
    transition = 0.45,
    activeProps = {
      scale: 1.04,
      opacity: 1,
      boxShadow: `0 0 0 2px ${accent}, 0 0 28px ${accent}66`,
    },
    settledProps = { scale: 1, opacity: 0.7, boxShadow: `0 0 0 1px ${accent}55` },
  } = options;
  // dt = (sDur - 1.5) / N with the default 0.8s entrance + 0.7s tail buffers.
  const span = Math.max(1, Number(totalDuration) - entranceBuffer - tailBuffer);
  const active = JSON.stringify({ ...activeProps, duration: transition, ease: "power2.out" });
  const settled = JSON.stringify({ ...settledProps, duration: transition, ease: "power2.out" });
  return `
        (function () {
          const __paced = Array.from(${elementsExpr});
          const __n = __paced.length;
          if (!__n) return;
          const __dt = ${span.toFixed(4)} / __n;
          __paced.forEach((__el, __k) => {
            const __t = ${entranceBuffer} + __k * __dt;
            ${timeline}.to(__el, ${active}, __t);
            if (__k < __n - 1) ${timeline}.to(__el, ${settled}, __t + __dt);
          });
        })();`;
}

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
    return harmonizePalette(
      {
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
      },
      true,
    );
  }
  if (theme === "accent") {
    return harmonizePalette(
      {
        ...basePalette,
        background: basePalette.accent ? `${basePalette.accent}14` : "#f0f4ff",
        card: "#ffffff",
        border: basePalette.accent ? `${basePalette.accent}33` : "rgba(0,0,0,0.1)",
        text: basePalette.text || "#111827",
        textMuted: basePalette.textMuted || "#4b5563",
        muted: basePalette.muted || "#6b7280",
        accent: basePalette.accent || "#6366f1",
        isAccent: true,
      },
      false,
    );
  }
  return harmonizePalette(basePalette, Boolean(basePalette.isDark));
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
        <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || NEUTRAL_TOKENS.index[0])}</span></div>
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
            <div class="eyebrow" style="margin-bottom: 16px"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || NEUTRAL_TOKENS.index[0])}</span></div>
            <h1 class="editorial-title" style="font-size: ${isPortrait ? "74px" : "80px"}">${h(scene.title)}<span class="brand-dot">.</span></h1>
            <p class="editorial-subtitle" style="font-size: ${isPortrait ? "30px" : "24px"}; margin-top: 14px">${h(scene.subtitle || "")}</p>
            <div class="pricing-pills">${pillsHtml}</div>
            <div class="cta-button"><span>${h(scene.cta || "")}</span><span class="cta-arrow">↗</span></div>
          </div>
        </div>
      `,
      gsapChoreography: `
        tl.from(scope.querySelector("#s${i + 1}-card"), { opacity: 0, y: 40, scale: 0.95, duration: 0.7, ease: "back.out(1.15)" }, 0.2);
        tl.from(scope.querySelectorAll(".pill-feature"), { opacity: 0, y: 15, scale: 0.95, stagger: 0.1, duration: 0.45, ease: "back.out(1.15)" }, 0.8);
        tl.from(scope.querySelector(".cta-button"), { opacity: 0, scale: 0.92, duration: 0.5, ease: "back.out(1.2)" }, 1.3);
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
    const mainWord =
      scene.kineticData?.mainWord ||
      String(synthesizeFallbackText(scene, "metric", 0)).toUpperCase();
    const accentWord =
      scene.kineticData?.accentWord ||
      String(synthesizeFallbackText(scene, "target", 0)).toUpperCase();
    const subText =
      scene.kineticData?.subtitle || scene.title || synthesizeFallbackText(scene, "caption", 0);
    const badgeText = scene.kineticData?.badge || synthesizeFallbackText(scene, "index", 0);
    return {
      innerHtml: `
        <div class="scene-inner">
          <div class="ambient-glow"></div>
          <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || NEUTRAL_TOKENS.index[0])}</span></div>
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
    const appTitle =
      scene.mockupData?.appTitle || scene.title || synthesizeFallbackText(scene, "node", 0);
    const headerBadge = scene.mockupData?.headerBadge || synthesizeFallbackText(scene, "index", 0);
    const rawItems =
      scene.mockupData?.items ||
      [0, 1, 2].map((k) => ({
        title: synthesizeFallbackText(scene, "node", k),
        desc: synthesizeFallbackText(scene, "caption", k),
        time: "",
      }));
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
          <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || NEUTRAL_TOKENS.index[0])}</span></div>
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
    const centerTitle =
      scene.orbitData?.centerTitle || scene.title || synthesizeFallbackText(scene, "node", 0);
    const centerSub = scene.orbitData?.centerSub || synthesizeFallbackText(scene, "index", 0);
    const rawSatellites =
      scene.orbitData?.satellites ||
      [0, 1, 2, 3].map((k) => ({
        label: synthesizeFallbackText(scene, "node", k + 1),
        desc: synthesizeFallbackText(scene, "caption", k),
      }));
    const satellites = rawSatellites.map((s, idx) =>
      typeof s === "string"
        ? { label: s, desc: "" }
        : { label: s?.label || s?.title || `Node ${idx + 1}`, desc: s?.desc || "" },
    );
    return {
      innerHtml: `
        <div class="scene-inner">
          <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || NEUTRAL_TOKENS.index[0])}</span></div>
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
  renderHtml: ({ scene, i, isPortrait, h, sDur, activePalette }) => {
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
        ${scheduleStepProgression("tl", 'scope.querySelectorAll(".step-card")', sDur, { accent: activePalette.accent })}
      `,
    };
  },
  renderCss: ({ scene, isPortrait, activePalette }) => `
    [data-composition-id="${scene.id}"] .ladder-container { display: flex; gap: 32px; width: ${isPortrait ? "100%" : "min(1400px, 85vw)"}; max-width: ${isPortrait ? "920px" : "none"}; height: ${isPortrait ? "840px" : "560px"}; margin: 36px auto 0; text-align: left; align-items: stretch; }
    [data-composition-id="${scene.id}"] .ladder-track { width: 6px; background: ${activePalette.border}; border-radius: 3px; position: relative; }
    [data-composition-id="${scene.id}"] .ladder-fill { position: absolute; inset: 0; background: ${activePalette.accent}; border-radius: 3px; transform-origin: top; }
    [data-composition-id="${scene.id}"] .ladder-steps { display: flex; flex-direction: column; justify-content: space-between; flex: 1; }
    [data-composition-id="${scene.id}"] .ladder-step-row { display: flex; align-items: center; gap: 24px; }
    [data-composition-id="${scene.id}"] .step-marker { width: 50px; height: 50px; border-radius: 50%; background: ${activePalette.card}; border: 2px solid ${activePalette.accent}; display: flex; align-items: center; justify-content: center; font-family: "JetBrains Mono", monospace; font-size: 18px; font-weight: 700; color: ${activePalette.accent}; box-shadow: 0 0 20px ${activePalette.accent}33; flex-shrink: 0; }
    [data-composition-id="${scene.id}"] .step-card { flex: 1; background: ${activePalette.card}; border: 1px solid ${activePalette.border}; border-radius: 20px; padding: 32px 36px; box-shadow: 0 12px 30px rgba(0,0,0,0.04); }
    [data-composition-id="${scene.id}"] .step-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
    [data-composition-id="${scene.id}"] .step-title { font-family: "Playfair Display", serif; font-size: ${isPortrait ? "30px" : "32px"}; font-weight: 700; color: ${activePalette.text}; }
    [data-composition-id="${scene.id}"] .step-badge { font-family: "JetBrains Mono", monospace; font-size: 18px; font-weight: 600; color: ${activePalette.accent}; background: rgba(0,0,0,0.04); padding: 4px 12px; border-radius: 10px; }
    [data-composition-id="${scene.id}"] .step-desc { font-size: ${isPortrait ? "22px" : "22px"}; color: ${activePalette.textMuted || activePalette.text}; }
  `,
});

// 7. Live Feed
registerArchetypeRenderer("live-feed", {
  getBackground: ({ isPortrait, activePalette }) =>
    `background: radial-gradient(circle at ${isPortrait ? "50% 50%" : "74% 50%"}, ${activePalette.accent}18 0%, transparent 60%), ${activePalette.background};`,
  renderHtml: ({ scene, i, isPortrait, h }) => {
    const rawItems =
      scene.feedData?.items ||
      [0, 1, 2, 3].map((k) => ({
        icon: "●",
        text:
          synthesizeFallbackText(scene, "caption", k) || synthesizeFallbackText(scene, "state", k),
        tag: synthesizeFallbackText(scene, "index", k),
        status: k === 0 ? "Active" : "Observed",
      }));
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
        <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || NEUTRAL_TOKENS.index[0])}</span></div>
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
          <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || NEUTRAL_TOKENS.index[0])}</span></div>
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
          tl.from(f, { opacity: 0, y: 30, scale: 0.96, duration: 0.5, ease: "back.out(1.15)" }, 0.7 + (idx * 0.22));
        });
      `,
    };
  },
  renderCss: ({ scene, isPortrait, activePalette }) => `
    [data-composition-id="${scene.id}"] .live-feed-stream { display: flex; flex-direction: column; gap: 20px; width: 100%; max-width: ${isPortrait ? "920px" : "min(1400px, 85vw)"}; margin-top: 40px; }
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
    const rawLayers =
      scene.stackData?.layers ||
      [0, 1, 2].map((k) => ({
        name: synthesizeFallbackText(scene, "node", k),
        tech: synthesizeFallbackText(scene, "index", k),
        role:
          synthesizeFallbackText(scene, "caption", k) || synthesizeFallbackText(scene, "state", k),
      }));
    const layers = rawLayers.map((l, idx) =>
      typeof l === "string"
        ? { name: l, tech: NEUTRAL_TOKENS.index[idx % 6], role: NEUTRAL_TOKENS.state[idx % 6] }
        : {
            name: l?.name || l?.title || `Layer ${idx + 1}`,
            tech: l?.tech || NEUTRAL_TOKENS.index[idx % 6],
            role: l?.role || `Architecture Tier ${idx + 1}`,
          },
    );
    return {
      innerHtml: `
        <div class="scene-inner">
          <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || NEUTRAL_TOKENS.index[0])}</span></div>
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
    [data-composition-id="${scene.id}"] .isometric-container { display: flex; flex-direction: column; gap: 24px; width: 100%; max-width: ${isPortrait ? "920px" : "min(1400px, 85vw)"}; margin-top: 40px; }
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
    const val = scene.metric?.value || String(synthesizeFallbackNumber(scene, 0));
    const label = scene.metric?.label || scene.title || synthesizeFallbackText(scene, "metric", 0);
    const badge = scene.metric?.badge || synthesizeFallbackText(scene, "target", 0);
    const subPills = scene.metric?.subPills || [
      synthesizeFallbackText(scene, "metric", 1),
      synthesizeFallbackText(scene, "metric", 2),
    ];
    const innerHtml = isPortrait
      ? `
      <div class="scene-inner">
        <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || NEUTRAL_TOKENS.metric[0])}</span></div>
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
          <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || NEUTRAL_TOKENS.metric[0])}</span></div>
          <h2 id="s${i + 1}-title" class="split-hero-title">${h(scene.title)}</h2>
          <p id="s${i + 1}-subtitle" class="split-hero-sub">${h(scene.subtitle || label || "Quantitative leap over conventional manual workflows.")}</p>
          <div class="split-hero-badge"><span class="accent-spark">✦</span><span>${h(badge || NEUTRAL_TOKENS.target[0])}</span></div>
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
    const n1 = scene.pipeline?.node1 || {
      title: synthesizeFallbackText(scene, "step", 0),
      desc: synthesizeFallbackText(scene, "caption", 0),
    };
    const n2 = scene.pipeline?.node2 || {
      title: synthesizeFallbackText(scene, "step", 1),
      desc: synthesizeFallbackText(scene, "caption", 1),
    };
    const n3 = scene.pipeline?.node3 || {
      title: synthesizeFallbackText(scene, "step", 2),
      desc: synthesizeFallbackText(scene, "caption", 2),
    };
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
        <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || NEUTRAL_TOKENS.index[0])}</span></div>
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
    [data-composition-id="${scene.id}"] .terminal-card { width: 100%; max-width: ${isPortrait ? "940px" : "min(1400px, 85vw)"}; margin-top: 40px; background: #0c0d12; border: 1px solid rgba(255,255,255,0.12); border-radius: 24px; overflow: hidden; box-shadow: 0 24px 70px rgba(0,0,0,0.4); text-align: left; }
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
    const leftTitle = scene.compareLeft?.title || synthesizeFallbackText(scene, "state", 1);
    const leftTag = scene.compareLeft?.tag || synthesizeFallbackText(scene, "index", 1);
    const leftPoints =
      scene.compareLeft?.points ||
      [0, 1, 2].map((k) => synthesizeFallbackText(scene, "state", k + 1));
    const rightTitle = scene.compareRight?.title || synthesizeFallbackText(scene, "state", 0);
    const rightTag = scene.compareRight?.tag || synthesizeFallbackText(scene, "index", 0);
    const rightPoints =
      scene.compareRight?.points ||
      [0, 1, 2].map((k) => synthesizeFallbackText(scene, "target", k));
    return {
      innerHtml: `
        <div class="scene-inner">
          <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || NEUTRAL_TOKENS.state[0])}</span></div>
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
    const chartTitle =
      scene.chartData?.title || scene.title || synthesizeFallbackText(scene, "metric", 0);
    const chartBadge = scene.chartData?.badge || synthesizeFallbackText(scene, "target", 0);
    const bars =
      scene.chartData?.bars ||
      [0, 1, 2, 3].map((k) => ({
        label: synthesizeFallbackText(scene, "metric", k),
        value: String(synthesizeFallbackNumber(scene, k)),
        height: 30 + k * 22,
      }));
    const innerHtml = isPortrait
      ? `
      <div class="scene-inner">
        <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || NEUTRAL_TOKENS.index[0])}</span></div>
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
    [data-composition-id="${scene.id}"] .chart-wrapper { width: 100%; max-width: ${isPortrait ? "920px" : "min(1400px, 85vw)"}; height: ${isPortrait ? "660px" : "auto"}; margin-top: 40px; background: ${activePalette.card}; border: 1px solid ${activePalette.border}; border-radius: 28px; padding: 40px 50px; box-shadow: 0 20px 60px rgba(0,0,0,0.06); text-align: left; display: flex; flex-direction: column; }
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
      title: scene.title || synthesizeFallbackText(scene, "metric", 0),
      desc: synthesizeFallbackText(scene, "caption", 0),
      badge: synthesizeFallbackText(scene, "index", 0),
    };
    const sub1 = scene.bento?.subCard1 || {
      title: synthesizeFallbackText(scene, "metric", 1),
      badge: synthesizeFallbackText(scene, "index", 1),
    };
    const sub2 = scene.bento?.subCard2 || {
      title: synthesizeFallbackText(scene, "metric", 2),
      badge: synthesizeFallbackText(scene, "index", 2),
    };
    return {
      innerHtml: `
        <div class="scene-inner">
          <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || NEUTRAL_TOKENS.index[0])}</span></div>
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
    const qAuthor = scene.quoteData?.author || scene.title || NEUTRAL_TOKENS.node[0];
    const qContext = scene.quoteData?.context || NEUTRAL_TOKENS.state[0];
    const qBadge = scene.quoteData?.badge || NEUTRAL_TOKENS.index[0];
    const innerHtml = isPortrait
      ? `
      <div class="scene-inner">
        <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || NEUTRAL_TOKENS.index[0])}</span></div>
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
          <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || NEUTRAL_TOKENS.index[0])}</span></div>
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
    [data-composition-id="${scene.id}"] .quote-card { width: 100%; max-width: ${isPortrait ? "920px" : "min(1400px, 85vw)"}; margin-top: 36px; background: ${activePalette.card}; border: 1px solid ${activePalette.border}; border-left: 6px solid ${activePalette.accent}; border-radius: 24px; padding: ${isPortrait ? "40px 36px" : "48px 60px"}; box-shadow: 0 20px 60px rgba(0,0,0,0.06); text-align: left; }
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
        : [0, 1, 2].map((k) => ({
            stepNumber: String(k + 1).padStart(2, "0"),
            title: synthesizeFallbackText(scene, "step", k),
            desc: synthesizeFallbackText(scene, "caption", k),
            isHighlighted: k === 1,
          }))
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
            <div class="flow-node-desc">${h(st.desc || "")}</div>
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
        <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || NEUTRAL_TOKENS.index[0])}</span></div>
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
    const kVal = scene.kpiData?.value || String(synthesizeFallbackNumber(scene, 0));
    const kLabel =
      scene.kpiData?.label || scene.title || synthesizeFallbackText(scene, "metric", 0);
    const kTrend = scene.kpiData?.trend || synthesizeFallbackText(scene, "metric", 1);
    const kSubtitle = scene.kpiData?.subtitle || synthesizeFallbackText(scene, "caption", 0);
    const kProgress = Math.min(100, Math.max(10, Number(scene.kpiData?.progress) || 82));
    const circumference = 880;
    const strokeDash = Math.round((kProgress / 100) * circumference);

    const innerHtml = isPortrait
      ? `
      <div class="scene-inner">
        <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || NEUTRAL_TOKENS.metric[0])}</span></div>
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
          <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || NEUTRAL_TOKENS.metric[0])}</span></div>
          <h2 id="s${i + 1}-title" class="split-hero-title">${h(scene.title)}</h2>
          <p id="s${i + 1}-subtitle" class="split-hero-sub">${h(scene.subtitle || kSubtitle || "Measured across distributed cluster workloads and production benchmarks.")}</p>
          <div class="split-hero-badge"><span class="accent-spark">✦</span><span>${h(kTrend || NEUTRAL_TOKENS.target[0])}</span></div>
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
    [data-composition-id="${scene.id}"] .kpi-ring-stage { display: flex; flex-direction: column; align-items: center; justify-content: center; margin-top: 36px; width: 100%; max-width: ${isPortrait ? "920px" : "min(1400px, 85vw)"}; }
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
    const tLeft = scene.diffData?.titleLeft || synthesizeFallbackText(scene, "state", 1);
    const bLeft = scene.diffData?.badgeLeft || synthesizeFallbackText(scene, "index", 1);
    const linesL =
      Array.isArray(scene.diffData?.linesLeft) && scene.diffData.linesLeft.length > 0
        ? scene.diffData.linesLeft
        : [0, 1, 2].map((k) => synthesizeFallbackText(scene, "state", k + 1));
    const tRight = scene.diffData?.titleRight || synthesizeFallbackText(scene, "state", 0);
    const bRight = scene.diffData?.badgeRight || synthesizeFallbackText(scene, "index", 0);
    const linesR =
      Array.isArray(scene.diffData?.linesRight) && scene.diffData.linesRight.length > 0
        ? scene.diffData.linesRight
        : [0, 1, 2].map((k) => synthesizeFallbackText(scene, "target", k));

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
        <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || NEUTRAL_TOKENS.index[0])}</span></div>
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
    const channel =
      scene.chatData?.channelName || scene.title || synthesizeFallbackText(scene, "node", 0);
    const rawMsgs =
      Array.isArray(scene.chatData?.messages) && scene.chatData.messages.length > 0
        ? scene.chatData.messages
        : [0, 1, 2].map((k) => ({
            sender: synthesizeFallbackText(scene, "node", k),
            text:
              synthesizeFallbackText(scene, "caption", k) ||
              synthesizeFallbackText(scene, "state", k),
            isAi: k > 0,
            time: "",
          }));
    const msgs = rawMsgs.slice(0, 3);
    const msgsHtml = msgs
      .map(
        (m, idx) => `
      <div class="chat-bubble-row ${m.isAi ? "ai-msg" : "user-msg"}" id="chat-msg-${i}-${idx + 1}">
        <div class="chat-avatar">${m.isAi ? "⚡" : "👤"}</div>
        <div class="chat-bubble-body">
          <div class="chat-meta">
            <span class="chat-sender">${h(m.sender || (m.isAi ? "Engine" : "User"))}</span>
            <span class="chat-time">${h(m.time || "")}</span>
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
          <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || NEUTRAL_TOKENS.index[0])}</span></div>
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
    [data-composition-id="${scene.id}"] .chat-stream-card { width: 100%; max-width: ${isPortrait ? "920px" : "min(1400px, 85vw)"}; margin-top: 36px; background: #0d0f17; border: 1px solid rgba(255,255,255,0.12); border-radius: 28px; overflow: hidden; box-shadow: 0 24px 70px rgba(0,0,0,0.4); text-align: left; }
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
  renderHtml: ({ scene, i, isPortrait, h, sDur, activePalette }) => {
    const bulletsHtml = (
      scene.cardRight?.bullets ||
      [0, 1, 2].map(
        (k) =>
          synthesizeFallbackText(scene, "caption", k) || synthesizeFallbackText(scene, "state", k),
      )
    )
      .map(
        (b, idx) =>
          `<li class="note-item" id="note-${i}-${idx + 1}"><span class="note-icon">✓</span><span>${h(b)}</span></li>`,
      )
      .join("\n");
    const sampleWords = (
      scene.cardLeft?.sampleText ||
      synthesizeFallbackText(scene, "caption", 0) ||
      scene.title ||
      ""
    )
      .split(" ")
      .map((w) => `<span class="typed-word">${h(w)} </span>`)
      .join("");

    return {
      innerHtml: `
        <div class="scene-inner">
          <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || NEUTRAL_TOKENS.index[0])}</span></div>
          <h2 id="s${i + 1}-title" class="editorial-title" style="font-size: ${isPortrait ? "64px" : "68px"}">${h(scene.title)}</h2>
          <div class="cards-container ${isPortrait ? "portrait-stack" : ""}">
            <div id="s${i + 1}-card-a" class="feature-card">
              <div class="card-header">
                <span class="card-title">${h(scene.cardLeft?.title || NEUTRAL_TOKENS.metric[0])}</span>
                <span class="card-badge">${h(scene.cardLeft?.badge || synthesizeFallbackText(scene, "index", 0))}</span>
              </div>
              <div class="email-body">${sampleWords}</div>
            </div>
            <div id="s${i + 1}-card-b" class="feature-card">
              <div class="card-header">
                <span class="card-title">${h(scene.cardRight?.title || synthesizeFallbackText(scene, "metric", 1))}</span>
                <span class="card-badge privacy">${h(scene.cardRight?.badge || synthesizeFallbackText(scene, "index", 1))}</span>
              </div>
              <ul class="notes-list">${bulletsHtml}</ul>
            </div>
          </div>
        </div>
      `,
      gsapChoreography: `
        tl.from(scope.querySelector("#s${i + 1}-eyebrow"), { opacity: 0, y: 15, duration: 0.4 }, 0.2);
        tl.from(scope.querySelector("#s${i + 1}-title"), { opacity: 0, y: 20, duration: 0.5 }, 0.4);
        tl.from(scope.querySelector("#s${i + 1}-card-a"), { opacity: 0, y: 35, scale: 0.95, duration: 0.55, ease: "back.out(1.15)" }, 0.7);
        tl.from(scope.querySelector("#s${i + 1}-card-b"), { opacity: 0, y: 35, scale: 0.95, duration: 0.55, ease: "back.out(1.15)" }, 0.9);
        const words = scope.querySelectorAll(".typed-word");
        words.forEach((w, idx) => { tl.to(w, { opacity: 1, duration: 0.04 }, 1.2 + (idx * 0.12)); });
        scope.querySelectorAll(".note-item").forEach((n) => { tl.to(n, { opacity: 0.55, y: 0, duration: 0.4 }, 2.0); });
        ${scheduleStepProgression("tl", 'scope.querySelectorAll(".note-item")', sDur, { accent: activePalette.accent, activeProps: { opacity: 1, x: 10 }, settledProps: { opacity: 0.75, x: 0 } })}
      `,
    };
  },
  renderCss: ({ scene, isPortrait, activePalette }) => `
    [data-composition-id="${scene.id}"] .cards-container { display: grid; grid-template-columns: ${isPortrait ? "1fr" : "1fr 1fr"}; gap: 40px; width: ${isPortrait ? "100%" : "min(1400px, 85vw)"}; margin: 40px auto 0; align-items: stretch; }
    [data-composition-id="${scene.id}"] .feature-card { background: ${activePalette.card}; border: 1px solid ${activePalette.border}; border-radius: 24px; padding: ${isPortrait ? "36px 40px" : "48px 40px"}; min-height: ${isPortrait ? "0" : "360px"}; box-shadow: 0 16px 40px rgba(0,0,0,0.04); display: flex; flex-direction: column; text-align: left; }
    [data-composition-id="${scene.id}"] .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid ${activePalette.border}; }
    [data-composition-id="${scene.id}"] .card-title { font-family: "Playfair Display", serif; font-size: 36px; font-weight: 700; color: ${activePalette.text}; }
    [data-composition-id="${scene.id}"] .card-badge { font-family: "JetBrains Mono", monospace; font-size: 18px; font-weight: 500; padding: 6px 14px; border-radius: 20px; background: rgba(0,0,0,0.06); color: ${activePalette.text}; }
    [data-composition-id="${scene.id}"] .card-badge.privacy { background: #e9f3ec; color: #27623d; }
    [data-composition-id="${scene.id}"] .email-body { font-size: 26px; line-height: 1.5; color: ${activePalette.text}; min-height: 100px; }
    [data-composition-id="${scene.id}"] .typed-word { display: inline; opacity: 0; }
    [data-composition-id="${scene.id}"] .notes-list { list-style: none; display: flex; flex-direction: column; gap: 16px; }
    [data-composition-id="${scene.id}"] .note-item { display: flex; align-items: flex-start; gap: 14px; font-size: 24px; line-height: 1.45; color: ${activePalette.text}; opacity: 0; transform: translateY(12px); }
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
  renderHtml: ({ scene, i, isPortrait, h, sDur, activePalette }) => {
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
          <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || NEUTRAL_TOKENS.index[0])}</span></div>
          <h1 id="s${i + 1}-title" class="editorial-title" style="font-size: ${isPortrait ? "60px" : "72px"}">${h(scene.title)}</h1>
          <div id="s${i + 1}-bento" class="bento-grid">${tilesHtml}</div>
        </div>
      `,
      gsapChoreography: `
        tl.from(scope.querySelector("#s${i + 1}-eyebrow"), { opacity: 0, y: 20, duration: 0.5 }, 0.2);
        tl.from(scope.querySelector("#s${i + 1}-title"), { opacity: 0, y: 25, duration: 0.6 }, 0.4);
        tl.from(scope.querySelectorAll(".bento-tile"), { opacity: 0, y: 30, scale: 0.94, stagger: 0.08, duration: 0.55, ease: "back.out(1.15)" }, 0.5);
        ${scheduleStepProgression("tl", 'scope.querySelectorAll(".bento-tile")', sDur, { accent: activePalette.accent })}
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
    [data-composition-id="${scene.id}"] .bento-grid { display: grid; grid-template-columns: ${isPortrait ? "repeat(2, 1fr)" : "repeat(3, 1fr)"}; gap: ${isPortrait ? "18px" : "24px"}; margin: 48px auto 0; width: ${isPortrait ? "100%" : "min(1400px, 85vw)"}; }
    [data-composition-id="${scene.id}"] .bento-tile { position: relative; overflow: hidden; background: ${activePalette.card}; border: 1px solid ${activePalette.border}; border-radius: 22px; padding: ${isPortrait ? "32px 24px" : "40px 32px"}; min-height: ${isPortrait ? "0" : "190px"}; text-align: left; }
    [data-composition-id="${scene.id}"] .bento-hero { grid-column: span 2; grid-row: span 2; background: ${activePalette.accent}14; }
    [data-composition-id="${scene.id}"] .bento-border { position: absolute; inset: 0 0 auto 0; height: 3px; background: linear-gradient(90deg, ${activePalette.accent}, transparent); transform-origin: left; }
    [data-composition-id="${scene.id}"] .bento-value { font-size: ${isPortrait ? "56px" : "76px"}; font-weight: 700; color: ${activePalette.text}; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
    [data-composition-id="${scene.id}"] .bento-unit { font-size: 0.45em; font-weight: 600; color: ${activePalette.accent}; margin-left: 6px; }
    [data-composition-id="${scene.id}"] .bento-label { font-size: ${isPortrait ? "22px" : "26px"}; font-weight: 600; color: ${activePalette.text}; margin-top: 10px; }
    [data-composition-id="${scene.id}"] .bento-detail { font-size: 20px; color: ${activePalette.textMuted || activePalette.muted || "#9ca3af"}; margin-top: 6px; }
  `,
});

// Terminal Flow — left narrative bullets, right simulated terminal preview card.
registerArchetypeRenderer("terminal-flow", {
  getBackground: ({ activePalette, scene }) =>
    scene?.theme === "dark" || activePalette?.isDark
      ? `background: radial-gradient(ellipse at 75% 20%, ${activePalette.accent}22 0%, transparent 55%), #0b0d14;`
      : `background: linear-gradient(120deg, ${activePalette.accent}14 0%, transparent 45%), ${activePalette.background};`,
  renderHtml: ({ scene, i, h, sDur, activePalette }) => {
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
        : [0, 1, 2].map((k) => ({
            prompt: ">",
            text: synthesizeFallbackText(scene, "step", k),
            output: synthesizeFallbackText(scene, "caption", k),
          }));
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
        tl.from(scope.querySelectorAll(".tf-line"), { opacity: 0.25, y: 10, duration: 0.32 }, 0.9);
        ${scheduleStepProgression("tl", 'scope.querySelectorAll(".tf-line")', sDur, { accent: activePalette.accent })}
        ${scheduleStepProgression("tl", 'scope.querySelectorAll(".tf-bullet")', sDur, { accent: activePalette.accent, activeProps: { opacity: 1, x: 8 }, settledProps: { opacity: 0.75, x: 0 } })}
        tl.to(scope.querySelector("#s${i + 1}-scan"), { y: "100%", duration: Math.max(2, sDur - 1.0), ease: "none", repeat: -1 }, 1.2);
        tl.to(scope.querySelector("#s${i + 1}-canvas"), { scale: 1.028, duration: Math.max(1, sDur - 1.0), ease: "none" }, 0.4);
      `,
    };
  },
  renderCss: ({ scene, isPortrait, activePalette }) => `
    [data-composition-id="${scene.id}"] .tf-canvas { position: relative; width: 100%; height: 100%; display: flex; flex-direction: column; padding: ${isPortrait ? "90px 44px 60px" : "56px 80px 56px"}; box-sizing: border-box; overflow: hidden; }
    [data-composition-id="${scene.id}"] .tf-hud-header { display: flex; align-items: center; gap: 20px; margin-bottom: ${isPortrait ? "28px" : "32px"}; }
    [data-composition-id="${scene.id}"] .tf-hud-trace { font-family: "JetBrains Mono", monospace; font-size: ${isPortrait ? "16px" : "15px"}; font-weight: 700; color: ${activePalette.accent}; letter-spacing: 0.12em; opacity: 0.75; }
    [data-composition-id="${scene.id}"] .tf-hud-tag { font-family: "JetBrains Mono", monospace; font-size: ${isPortrait ? "18px" : "16px"}; font-weight: 700; color: ${activePalette.text || "#f3f4f8"}; letter-spacing: 0.08em; text-transform: uppercase; }
    [data-composition-id="${scene.id}"] .tf-split { display: flex; ${isPortrait ? "flex-direction: column;" : "flex-direction: row; align-items: center;"} gap: ${isPortrait ? "32px" : "56px"}; flex: 1; width: 100%; min-height: 0; }
    [data-composition-id="${scene.id}"] .tf-left { flex: 0 0 ${isPortrait ? "100%" : "37%"}; display: flex; flex-direction: column; justify-content: center; text-align: left; }
    [data-composition-id="${scene.id}"] .tf-hud-title { font-family: "Inter", sans-serif; font-size: ${isPortrait ? "46px" : "56px"}; font-weight: 800; line-height: 1.1; letter-spacing: -0.03em; color: ${activePalette.text || "#f3f4f8"}; margin: 0 0 24px; }
    [data-composition-id="${scene.id}"] .tf-right { flex: 1; width: 100%; min-height: ${isPortrait ? "520px" : "560px"}; display: flex; align-items: center; justify-content: center; }
    [data-composition-id="${scene.id}"] .tf-bullets { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 16px; }
    [data-composition-id="${scene.id}"] .tf-bullet { display: flex; align-items: flex-start; gap: 14px; font-size: ${isPortrait ? "22px" : "24px"}; color: ${activePalette.text || "#f3f4f8"}; line-height: 1.4; opacity: 0.9; }
    [data-composition-id="${scene.id}"] .tf-bullet-dot { width: 8px; height: 8px; border-radius: 50%; background: ${activePalette.accent}; margin-top: 9px; flex-shrink: 0; box-shadow: 0 0 8px ${activePalette.accent}; }
    [data-composition-id="${scene.id}"] .tf-terminal { width: 100%; max-width: ${isPortrait ? "100%" : "none"}; min-height: ${isPortrait ? "480px" : "560px"}; background: #0d0e16; border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; overflow: hidden; box-shadow: 0 30px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,102,241,0.12); font-family: "JetBrains Mono", monospace; text-align: left; }
    [data-composition-id="${scene.id}"] .tf-titlebar { display: flex; align-items: center; gap: 8px; padding: 13px 18px; background: #13141e; border-bottom: 1px solid rgba(255,255,255,0.06); }
    [data-composition-id="${scene.id}"] .tf-dot { width: 12px; height: 12px; border-radius: 50%; }
    [data-composition-id="${scene.id}"] .tf-dot-red { background: #ff5f57; }
    [data-composition-id="${scene.id}"] .tf-dot-yellow { background: #febc2e; }
    [data-composition-id="${scene.id}"] .tf-dot-green { background: #28c840; }
    [data-composition-id="${scene.id}"] .tf-title { margin-left: 8px; font-size: 13px; color: rgba(255,255,255,0.4); }
    [data-composition-id="${scene.id}"] .tf-title-path { margin-left: auto; font-size: 12px; color: ${activePalette.accent}88; }
    [data-composition-id="${scene.id}"] .tf-body { padding: ${isPortrait ? "20px" : "24px 28px 32px"}; display: flex; flex-direction: column; gap: ${isPortrait ? "18px" : "22px"}; flex: 1; justify-content: center; }
    [data-composition-id="${scene.id}"] .tf-line { display: flex; flex-wrap: wrap; align-items: baseline; gap: 12px; font-size: ${isPortrait ? "20px" : "22px"}; padding: 10px 14px; border-radius: 10px; }
    [data-composition-id="${scene.id}"] .tf-prompt { color: ${activePalette.accent}; font-weight: 700; }
    [data-composition-id="${scene.id}"] .tf-cmd { color: #e8e8f0; }
    [data-composition-id="${scene.id}"] .tf-out { width: 100%; color: #6fca8a; font-size: ${isPortrait ? "18px" : "20px"}; padding-left: 20px; opacity: 0.85; }
    [data-composition-id="${scene.id}"] .tf-scan-line { position: absolute; left: 0; right: 0; top: -2px; height: 2px; background: linear-gradient(90deg, transparent, ${activePalette.accent}66, transparent); pointer-events: none; }
  `,
});

// Step Progression — connected node timeline with GSAP-driven pulse.
// The pulse is a GSAP repeat:-1 tween (NOT a CSS @keyframes animation) so the
// Puppeteer/seek-by-frame adapters can render each frame deterministically.
registerArchetypeRenderer("step-progression", {
  getBackground: ({ activePalette }) =>
    `background: radial-gradient(circle at 80% 15%, ${activePalette.accent}15 0%, transparent 50%), ${activePalette.background};`,
  renderHtml: ({ scene, i, isPortrait, h, sDur, activePalette }) => {
    const steps = (
      Array.isArray(scene.progressData?.steps) && scene.progressData.steps.length
        ? scene.progressData.steps
        : [0, 1, 2].map((k) => ({
            label: synthesizeFallbackText(scene, "step", k),
            caption: synthesizeFallbackText(scene, "caption", k),
          }))
    ).slice(0, 4);
    const nodesHtml = steps
      .map((s, j) => {
        const label = typeof s?.label === "string" ? s.label : NEUTRAL_TOKENS.step[j];
        const caption = typeof s?.caption === "string" ? s.caption : "";
        const captionHtml = caption ? `<div class="sp-caption">${h(caption)}</div>` : "";
        return `
        <div class="sp-step">
          <div class="sp-node"><span class="sp-node-core">${j + 1}</span></div>
          <div class="sp-card">
            <div class="sp-label">${h(label)}</div>
            ${captionHtml}
          </div>
        </div>`;
      })
      .join("\n");
    const accent = activePalette.accent;
    const paceCards = scheduleStepProgression("tl", 'scope.querySelectorAll(".sp-card")', sDur, {
      accent,
    });
    const paceNodes = scheduleStepProgression("tl", 'scope.querySelectorAll(".sp-node")', sDur, {
      accent,
      activeProps: { scale: 1.14 },
      settledProps: { scale: 1 },
    });
    return {
      innerHtml: `
        <div class="scene-inner sp-stage">
          <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || NEUTRAL_TOKENS.index[0])}</span></div>
          <h1 id="s${i + 1}-title" class="editorial-title" style="font-size: ${isPortrait ? "56px" : "72px"}">${h(scene.title)}</h1>
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
        tl.from(scope.querySelectorAll(".sp-step"), { opacity: 0, y: 26, stagger: 0.14, duration: 0.5, ease: "power3.out" }, 0.8);
        ${paceCards}
        ${paceNodes}
      `,
    };
  },
  renderCss: ({ scene, isPortrait, activePalette }) => `
    [data-composition-id="${scene.id}"] .sp-stage { justify-content: center; align-items: center; text-align: center; }
    [data-composition-id="${scene.id}"] .sp-track { position: relative; display: flex; ${isPortrait ? "flex-direction: column; align-items: stretch; gap: 28px;" : "flex-direction: row; align-items: stretch; justify-content: space-between; gap: 28px;"} margin: ${isPortrait ? "44px" : "64px"} auto 0; width: ${isPortrait ? "100%" : "min(1400px, 85vw)"}; }
    [data-composition-id="${scene.id}"] .sp-connector { position: absolute; ${isPortrait ? "left: 34px; top: 0; bottom: 0; width: 4px; height: auto; transform-origin: top;" : "left: 6%; right: 6%; top: 34px; height: 4px; transform-origin: left;"} background: linear-gradient(90deg, ${activePalette.accent}, ${activePalette.accent}44); border-radius: 2px; }
    [data-composition-id="${scene.id}"] .sp-step { position: relative; z-index: 1; flex: 1 1 0; display: flex; ${isPortrait ? "flex-direction: row; align-items: flex-start; gap: 24px; text-align: left;" : "flex-direction: column; align-items: center; gap: 22px; text-align: center;"} }
    [data-composition-id="${scene.id}"] .sp-node { flex: 0 0 auto; width: 68px; height: 68px; border-radius: 50%; background: ${activePalette.background}; border: 4px solid ${activePalette.accent}; display: flex; align-items: center; justify-content: center; }
    [data-composition-id="${scene.id}"] .sp-node-core { font-family: "JetBrains Mono", monospace; font-size: 24px; font-weight: 800; color: ${activePalette.accent}; }
    [data-composition-id="${scene.id}"] .sp-card { flex: 1; width: 100%; box-sizing: border-box; padding: 32px 24px; border-radius: 22px; background: ${activePalette.card}; border: 2px solid ${activePalette.border}; min-height: ${isPortrait ? "0" : "340px"}; display: flex; flex-direction: column; justify-content: center; gap: 18px; }
    [data-composition-id="${scene.id}"] .sp-label { font-size: ${isPortrait ? "30px" : "38px"}; font-weight: 800; line-height: 1.2; color: ${activePalette.text}; }
    [data-composition-id="${scene.id}"] .sp-caption { font-size: ${isPortrait ? "24px" : "28px"}; line-height: 1.45; color: ${activePalette.textMuted || activePalette.text}; }
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
        : [0, 1, 2].map((k) => ({
            name: synthesizeFallbackText(scene, "node", k),
            nodeCount: [16, 9, 12][k],
            active: k === 0,
          }));
    const clusters = rawClusters.slice(0, 3);
    const queryLabel = scene.queryLabel || synthesizeFallbackText(scene, "node", 0);
    const stats = scene.stats || {
      metric: synthesizeFallbackText(scene, "state", 0),
      latency: synthesizeFallbackText(scene, "target", 0),
    };
    const statLabels = [
      scene.stats?.metricLabel || NEUTRAL_TOKENS.metric[0],
      scene.stats?.latencyLabel || NEUTRAL_TOKENS.metric[1],
    ];
    const accent = activePalette?.accent || "#6366f1";

    return {
      innerHtml: `
        <div class="scene-inner vc-container${isPortrait ? " vc-portrait" : ""}">
          <div class="vc-left-col">
            <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || NEUTRAL_TOKENS.index[0])}</span></div>
            <h1 id="s${i + 1}-title" class="vc-title">${h(scene.title)}</h1>
            <p id="s${i + 1}-subtitle" class="vc-subtitle">${h(scene.subtitle || scene.voiceover?.slice(0, 130) || "")}</p>
            <div id="s${i + 1}-query" class="vc-query-chip">
              <span class="vc-query-dot"></span>
              <code class="vc-query-code">${h(queryLabel)}</code>
            </div>
            <div class="vc-stats-grid">
              <div class="vc-stat-tile">
                <span class="vc-stat-val">${h(stats.metric || NEUTRAL_TOKENS.state[0])}</span>
                <span class="vc-stat-lbl">${h(statLabels[0])}</span>
              </div>
              <div class="vc-stat-tile">
                <span class="vc-stat-val">${h(stats.latency || NEUTRAL_TOKENS.target[0])}</span>
                <span class="vc-stat-lbl">${h(statLabels[1])}</span>
              </div>
            </div>
            <div class="vc-legend">
              ${clusters
                .map(
                  (c, cIdx) => `
                <div class="vc-legend-item${c.active ? " vc-active" : ""}">
                  <span class="vc-legend-dot" style="background:${c.active ? accent : "rgba(255,255,255,0.4)"}"></span>
                  <span class="vc-legend-name">${h(c.name || `Cluster ${cIdx + 1}`)}</span>
                  <span class="vc-legend-cnt">${h(c.nodeCount || 10)}</span>
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

              <!-- Constellation Lines (Cluster 2: secondary group 260, 380) -->
              <g class="vc-edges vc-edges-inactive">
                <line class="vc-edge" x1="260" y1="380" x2="210" y2="350" />
                <line class="vc-edge" x1="260" y1="380" x2="310" y2="360" />
                <line class="vc-edge" x1="260" y1="380" x2="240" y2="430" />
                <line class="vc-edge" x1="260" y1="380" x2="300" y2="420" />
              </g>

              <!-- Constellation Lines (Cluster 3: tertiary group 560, 400) -->
              <g class="vc-edges vc-edges-inactive">
                <line class="vc-edge" x1="560" y1="400" x2="510" y2="380" />
                <line class="vc-edge" x1="560" y1="400" x2="620" y2="390" />
                <line class="vc-edge" x1="560" y1="400" x2="540" y2="450" />
                <line class="vc-edge" x1="560" y1="400" x2="600" y2="440" />
              </g>

              <!-- Alternate traversal candidates (Low-opacity dashed) -->
              <path class="vc-pruned-path" d="M 120 160 Q 180 280, 260 380" fill="none" stroke-dasharray="6 6" />

              <!-- Traversal path from the source marker to the target node -->
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

              <!-- Source marker -->
              <g class="vc-query-marker">
                <circle class="vc-query-ripple" cx="120" cy="160" r="28" />
                <circle class="vc-query-outer" cx="120" cy="160" r="14" />
                <circle class="vc-query-inner" cx="120" cy="160" r="5" />
                <text class="vc-query-svg-label" x="120" y="118" text-anchor="middle">${h(String(queryLabel).slice(0, 24))}</text>
              </g>

              <!-- Centroid Target Label -->
              <text class="vc-target-label" x="490" y="222" text-anchor="middle">${h(NEUTRAL_TOKENS.target[0])}</text>
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
    [data-composition-id="${scene.id}"] .vc-left-col { flex: 0 0 ${isPortrait ? "100%" : "37%"}; max-width: ${isPortrait ? "920px" : "none"}; display: flex; flex-direction: column; align-items: flex-start; text-align: left; }
    [data-composition-id="${scene.id}"] .vc-title { font-family: "Playfair Display", serif; font-size: ${isPortrait ? "56px" : "64px"}; font-weight: 700; line-height: 1.15; letter-spacing: -0.02em; color: ${activePalette.text}; margin-top: 8px; }
    [data-composition-id="${scene.id}"] .vc-subtitle { font-size: ${isPortrait ? "24px" : "24px"}; color: ${activePalette.textMuted || activePalette.muted || activePalette.text}; line-height: 1.45; margin-top: 14px; }
    [data-composition-id="${scene.id}"] .vc-query-chip { margin-top: 20px; display: inline-flex; align-items: center; gap: 10px; background: rgba(99, 102, 241, 0.1); border: 1px solid ${activePalette.accent}55; padding: 8px 18px; border-radius: 20px; font-family: "JetBrains Mono", monospace; font-size: 14px; font-weight: 600; color: ${activePalette.accent}; }
    [data-composition-id="${scene.id}"] .vc-query-dot { width: 8px; height: 8px; border-radius: 50%; background: ${activePalette.accent}; box-shadow: 0 0 10px ${activePalette.accent}; }
    [data-composition-id="${scene.id}"] .vc-stats-grid { display: flex; gap: 14px; margin-top: 22px; width: 100%; }
    [data-composition-id="${scene.id}"] .vc-stat-tile { flex: 1; background: ${activePalette.card}; border: 1px solid ${activePalette.border}; border-radius: 16px; padding: 14px 18px; display: flex; flex-direction: column; gap: 4px; box-shadow: 0 8px 24px rgba(0,0,0,0.04); }
    [data-composition-id="${scene.id}"] .vc-stat-val { font-family: "JetBrains Mono", monospace; font-size: 26px; font-weight: 700; color: ${activePalette.text}; }
    [data-composition-id="${scene.id}"] .vc-stat-lbl { font-size: 18px; color: ${activePalette.textMuted || activePalette.muted}; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
    [data-composition-id="${scene.id}"] .vc-legend { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 20px; }
    [data-composition-id="${scene.id}"] .vc-legend-item { display: inline-flex; align-items: center; gap: 10px; background: rgba(0,0,0,0.04); border: 1px solid ${activePalette.border}; padding: 10px 18px; border-radius: 16px; font-size: 20px; color: ${activePalette.textMuted || activePalette.text}; }
    [data-composition-id="${scene.id}"] .vc-legend-item.vc-active { border-color: ${activePalette.accent}; color: ${activePalette.text}; background: rgba(99, 102, 241, 0.08); font-weight: 600; }
    [data-composition-id="${scene.id}"] .vc-legend-dot { width: 8px; height: 8px; border-radius: 50%; }
    [data-composition-id="${scene.id}"] .vc-legend-cnt { font-family: "JetBrains Mono", monospace; font-size: 18px; opacity: 0.7; }
    [data-composition-id="${scene.id}"] .vc-right-canvas { flex: 0 0 ${isPortrait ? "100%" : "61%"}; width: ${isPortrait ? "100%" : "61%"}; min-height: ${isPortrait ? "560px" : "560px"}; height: ${isPortrait ? "580px" : "100%"}; display: flex; align-items: center; justify-content: center; position: relative; }
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
  renderHtml: ({ scene, i, h }) => {
    const rawLines =
      Array.isArray(scene.impactData?.lines) && scene.impactData.lines.length
        ? scene.impactData.lines
        : [scene.title || "INSTANT", scene.subtitle || "IMPACT."];
    const lines = rawLines.slice(0, 4);
    const tag = scene.impactData?.tag || scene.eyebrow || "";
    const linesHtml = lines
      .map((line, idx) => {
        const isAccentLine =
          idx === lines.length - 1 ||
          (scene.impactData?.accent && line === scene.impactData.accent);
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
          // Reveal opens outward from the horizontal center, so the text never wipes in from the left edge.
          tl.fromTo(el, { clipPath: "inset(0 50% 0 50%)", opacity: 0.8 }, { clipPath: "inset(0 0% 0 0%)", opacity: 1, duration: 0.45, ease: "power4.out" }, 0.25 + idx * 0.22);
        });
        // Drift is symmetric around the centered position (-9px..+9px) instead of ending 18px off-center.
        tl.fromTo(scope.querySelector("#s${i + 1}-ki-words"), { y: 9 }, { y: -9, duration: Math.max(1.5, sDur - 1.2), ease: "sine.inOut" }, 1.2);
        tl.fromTo(scope.querySelector("#s${i + 1}-ki-glow"), { x: -30, y: 15 }, { x: 30, y: -15, duration: Math.max(2, sDur - 0.8), ease: "sine.inOut" }, 0.8);
      `,
    };
  },
  renderCss: ({ scene, isPortrait, activePalette }) => {
    const accent = activePalette?.accent || "#6366f1";
    const textColor =
      activePalette?.isDark || scene?.theme === "dark"
        ? "#f3f4f8"
        : activePalette?.text || "#111827";
    const fontSize = isPortrait ? "96px" : "124px";
    return `
    [data-composition-id="${scene.id}"] .ki-stage { position: relative; width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; margin: 0 auto; padding: ${isPortrait ? "100px 52px 80px" : "80px 100px"}; box-sizing: border-box; overflow: hidden; }
    [data-composition-id="${scene.id}"] .ki-tag { text-align: center; margin-left: auto; margin-right: auto; font-family: "JetBrains Mono", monospace; font-size: ${isPortrait ? "18px" : "16px"}; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase; color: ${accent}; margin-bottom: 32px; opacity: 0.8; }
    [data-composition-id="${scene.id}"] .ki-words { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; width: 100%; max-width: ${isPortrait ? "100%" : "min(1500px, 90vw)"}; margin-left: auto; margin-right: auto; gap: ${isPortrait ? "8px" : "4px"}; z-index: 2; position: relative; }
    [data-composition-id="${scene.id}"] .ki-line { text-align: center; margin-left: auto; margin-right: auto; max-width: 100%; font-family: "Inter", sans-serif; font-size: ${fontSize}; font-weight: 900; line-height: 0.96; letter-spacing: -0.04em; color: ${textColor}; text-transform: uppercase; clip-path: inset(0 0% 0 0); }
    [data-composition-id="${scene.id}"] .ki-accent-line { color: ${accent}; text-shadow: 0 0 80px ${accent}55; }
    [data-composition-id="${scene.id}"] .ki-glow-orb { position: absolute; width: ${isPortrait ? "600px" : "800px"}; height: ${isPortrait ? "600px" : "800px"}; border-radius: 50%; background: radial-gradient(circle, ${accent}28 0%, transparent 70%); filter: blur(80px); pointer-events: none; left: 50%; top: 50%; margin-left: ${isPortrait ? "-300px" : "-400px"}; margin-top: ${isPortrait ? "-300px" : "-400px"}; z-index: 0; }
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
  renderHtml: ({ scene, i, h, activePalette }) => {
    const val = String(
      scene.spotlightData?.value ?? scene.metric?.value ?? synthesizeFallbackNumber(scene, 0),
    );
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
    const textColor = isDark ? "#f3f4f8" : activePalette?.text || "#111827";
    const mutedColor = isDark ? "#9ca3af" : activePalette?.textMuted || "#6b7280";
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

// =========================================================================
// BATCH 2: 15 MODERN AI & SYSTEMS HTML/GSAP ARCHETYPES
// =========================================================================

// 28. RAG Retrieval Pipeline
registerArchetypeRenderer("rag-retrieval-pipeline", {
  getBackground: ({ activePalette }) =>
    `background: radial-gradient(circle at 50% 25%, ${activePalette.accent}14 0%, transparent 60%), ${activePalette.background};`,
  renderHtml: ({ scene, i, isPortrait, h, sDur, activePalette }) => {
    const rawStages = scene.ragData?.stages;
    const stages = (
      Array.isArray(rawStages) && rawStages.length >= 3
        ? rawStages
        : [0, 1, 2, 3, 4].map((k) => ({
            name: synthesizeFallbackText(scene, "step", k),
            detail: synthesizeFallbackText(scene, "caption", k),
          }))
    ).slice(0, 5);

    const queryText = scene.ragData?.queryText || scene.title;
    const retrievedCount = scene.ragData?.retrievedCount || 5;

    const stagesHtml = stages
      .map((st, idx) => {
        const isHighlight = idx === 3;
        const name = typeof st.name === "string" ? st.name : `Stage ${idx + 1}`;
        const detail = typeof st.detail === "string" ? st.detail : "";
        return `
        <div class="rag-stage-card ${isHighlight ? "rag-stage-hero" : ""}">
          <div class="rag-stage-num">0${idx + 1}</div>
          <div class="rag-stage-name">${h(name)}</div>
          ${detail ? `<div class="rag-stage-detail">${h(detail)}</div>` : ""}
          <div class="rag-stage-badge">${isHighlight ? `${retrievedCount} Top-K` : "Verified"}</div>
        </div>`;
      })
      .join("\n");

    const pace = scheduleStepProgression("tl", 'scope.querySelectorAll(".rag-stage-card")', sDur, {
      accent: activePalette.accent,
    });

    return {
      innerHtml: `
        <div class="scene-inner rag-stage">
          <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || "RETRIEVAL-AUGMENTED GENERATION")}</span></div>
          <h1 id="s${i + 1}-title" class="editorial-title" style="font-size: ${isPortrait ? "48px" : "64px"}">${h(scene.title)}</h1>
          <div class="rag-query-hud">
            <span class="rag-query-tag">SEARCH QUERY</span>
            <span class="rag-query-val">"${h(queryText)}"</span>
          </div>
          <div id="s${i + 1}-track" class="rag-track">
            <div class="rag-connector"></div>
            ${stagesHtml}
          </div>
        </div>
      `,
      gsapChoreography: `
        tl.from(scope.querySelector("#s${i + 1}-eyebrow"), { opacity: 0, y: 18, duration: 0.5 }, 0.2);
        tl.from(scope.querySelector("#s${i + 1}-title"), { opacity: 0, y: 22, duration: 0.6 }, 0.35);
        tl.from(scope.querySelector(".rag-query-hud"), { opacity: 0, y: 20, duration: 0.5 }, 0.5);
        tl.fromTo(scope.querySelector(".rag-connector"), { scaleX: 0, opacity: 1 }, { scaleX: 1, opacity: 1, duration: 0.9, ease: "power2.inOut" }, 0.65);
        tl.from(scope.querySelectorAll(".rag-stage-card"), { opacity: 0, y: 30, stagger: 0.12, duration: 0.55, ease: "power3.out" }, 0.8);
        ${pace}
      `,
    };
  },
  renderCss: ({ scene, isPortrait, activePalette }) => `
    [data-composition-id="${scene.id}"] .rag-stage { justify-content: center; align-items: center; text-align: center; }
    [data-composition-id="${scene.id}"] .rag-query-hud { display: inline-flex; align-items: center; gap: 14px; padding: 10px 22px; border-radius: 999px; background: ${activePalette.card}; border: 1.5px solid ${activePalette.border}; margin: 24px auto 0; max-width: 90%; }
    [data-composition-id="${scene.id}"] .rag-query-tag { font-family: "JetBrains Mono", monospace; font-size: 14px; font-weight: 800; color: ${activePalette.accent}; letter-spacing: 0.08em; }
    [data-composition-id="${scene.id}"] .rag-query-val { font-size: 18px; color: ${activePalette.text}; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 700px; }
    [data-composition-id="${scene.id}"] .rag-track { position: relative; display: flex; ${isPortrait ? "flex-direction: column; align-items: stretch; gap: 20px;" : "flex-direction: row; align-items: stretch; justify-content: space-between; gap: 20px;"} margin-top: ${isPortrait ? "32px" : "56px"}; width: min(1420px, 86vw); min-height: ${isPortrait ? "auto" : "320px"}; }
    [data-composition-id="${scene.id}"] .rag-connector { position: absolute; ${isPortrait ? "left: 36px; top: 0; bottom: 0; width: 4px; height: auto; transform-origin: top;" : "left: 4%; right: 4%; top: 38px; height: 4px; transform-origin: left;"} background: linear-gradient(90deg, ${activePalette.accent}, ${activePalette.accent}44); border-radius: 2px; }
    [data-composition-id="${scene.id}"] .rag-stage-card { position: relative; z-index: 1; flex: 1 1 0; display: flex; flex-direction: column; justify-content: space-between; padding: 26px 20px; border-radius: 18px; background: ${activePalette.card}; border: 1.5px solid ${activePalette.border}; text-align: left; }
    [data-composition-id="${scene.id}"] .rag-stage-hero { border-color: ${activePalette.accent}; box-shadow: 0 0 32px ${activePalette.accent}26; }
    [data-composition-id="${scene.id}"] .rag-stage-num { font-family: "JetBrains Mono", monospace; font-size: 18px; font-weight: 800; color: ${activePalette.accent}; }
    [data-composition-id="${scene.id}"] .rag-stage-name { font-size: ${isPortrait ? "22px" : "26px"}; font-weight: 800; color: ${activePalette.text}; margin-top: 14px; line-height: 1.25; }
    [data-composition-id="${scene.id}"] .rag-stage-detail { font-size: 17px; color: ${activePalette.textMuted || activePalette.text}; line-height: 1.45; margin-top: 10px; }
    [data-composition-id="${scene.id}"] .rag-stage-badge { font-family: "JetBrains Mono", monospace; font-size: 13px; font-weight: 700; color: ${activePalette.accent}; margin-top: 18px; padding: 4px 10px; border-radius: 6px; background: ${activePalette.accent}16; display: inline-block; width: fit-content; }
  `,
});

// 29. Agent Scratchpad (ReAct Cognitive Loop)
registerArchetypeRenderer("agent-scratchpad", {
  getBackground: ({ activePalette }) =>
    `background: radial-gradient(circle at 80% 20%, ${activePalette.accent}16 0%, transparent 65%), ${activePalette.background};`,
  renderHtml: ({ scene, i, isPortrait, h, sDur, activePalette }) => {
    const rawSteps = scene.agentData?.steps;
    const steps = (
      Array.isArray(rawSteps) && rawSteps.length >= 2
        ? rawSteps
        : [
            {
              type: "thought",
              content:
                synthesizeFallbackText(scene, "caption", 0) ||
                "Analyze user objective and verify parameters",
            },
            {
              type: "action",
              content: `search_database(target="${synthesizeFallbackText(scene, "node", 0)}")`,
            },
            {
              type: "observation",
              content:
                synthesizeFallbackText(scene, "caption", 1) ||
                "Retrieved 14 matching entries with high confidence",
            },
            {
              type: "answer",
              content:
                synthesizeFallbackText(scene, "caption", 2) ||
                "Synthesized conclusive plan meeting constraints",
            },
          ]
    ).slice(0, 4);

    const typeIcons = {
      thought: "🧠 THOUGHT",
      action: "⚡ ACTION",
      observation: "👁 OBSERVATION",
      answer: "🎯 FINAL ANSWER",
    };

    const cardsHtml = steps
      .map((st, idx) => {
        const type = String(st.type || "thought").toLowerCase();
        const header = typeIcons[type] || "STEP";
        const content = typeof st.content === "string" ? st.content : "";
        const isAnswer = type === "answer";
        return `
        <div class="agent-step-card ${isAnswer ? "agent-card-answer" : ""}">
          <div class="agent-card-header">
            <span class="agent-type-tag agent-tag-${type}">${header}</span>
            <span class="agent-step-idx">#0${idx + 1}</span>
          </div>
          <div class="agent-card-content ${type === "action" ? "agent-code-font" : ""}">${h(content)}</div>
        </div>`;
      })
      .join("\n");

    const pace = scheduleStepProgression("tl", 'scope.querySelectorAll(".agent-step-card")', sDur, {
      accent: activePalette.accent,
    });

    return {
      innerHtml: `
        <div class="scene-inner agent-stage">
          <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || "COGNITIVE REASONING LOOP")}</span></div>
          <h1 id="s${i + 1}-title" class="editorial-title" style="font-size: ${isPortrait ? "46px" : "62px"}">${h(scene.title)}</h1>
          <div id="s${i + 1}-grid" class="agent-grid">
            ${cardsHtml}
          </div>
        </div>
      `,
      gsapChoreography: `
        tl.from(scope.querySelector("#s${i + 1}-eyebrow"), { opacity: 0, y: 16, duration: 0.5 }, 0.2);
        tl.from(scope.querySelector("#s${i + 1}-title"), { opacity: 0, y: 22, duration: 0.6 }, 0.35);
        tl.from(scope.querySelectorAll(".agent-step-card"), { opacity: 0, y: 28, stagger: 0.12, duration: 0.5, ease: "power3.out" }, 0.6);
        ${pace}
      `,
    };
  },
  renderCss: ({ scene, isPortrait, activePalette }) => `
    [data-composition-id="${scene.id}"] .agent-stage { justify-content: center; align-items: center; text-align: center; }
    [data-composition-id="${scene.id}"] .agent-grid { display: grid; grid-template-columns: ${isPortrait ? "1fr" : "repeat(2, 1fr)"}; gap: 24px; width: min(1360px, 86vw); margin-top: ${isPortrait ? "32px" : "52px"}; }
    [data-composition-id="${scene.id}"] .agent-step-card { padding: 26px 28px; border-radius: 18px; background: ${activePalette.card}; border: 1.5px solid ${activePalette.border}; text-align: left; display: flex; flex-direction: column; justify-content: space-between; min-height: 160px; }
    [data-composition-id="${scene.id}"] .agent-card-answer { border-color: ${activePalette.accent}; box-shadow: 0 0 28px ${activePalette.accent}24; }
    [data-composition-id="${scene.id}"] .agent-card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
    [data-composition-id="${scene.id}"] .agent-type-tag { font-family: "JetBrains Mono", monospace; font-size: 15px; font-weight: 800; letter-spacing: 0.05em; padding: 4px 10px; border-radius: 6px; }
    [data-composition-id="${scene.id}"] .agent-tag-thought { background: rgba(139, 92, 246, 0.16); color: #a78bfa; }
    [data-composition-id="${scene.id}"] .agent-tag-action { background: rgba(59, 130, 246, 0.16); color: #60a5fa; }
    [data-composition-id="${scene.id}"] .agent-tag-observation { background: rgba(245, 158, 11, 0.16); color: #fbbf24; }
    [data-composition-id="${scene.id}"] .agent-tag-answer { background: rgba(16, 185, 129, 0.16); color: #34d399; }
    [data-composition-id="${scene.id}"] .agent-step-idx { font-family: "JetBrains Mono", monospace; font-size: 16px; font-weight: 700; color: ${activePalette.textMuted || activePalette.text}; }
    [data-composition-id="${scene.id}"] .agent-card-content { font-size: 21px; line-height: 1.45; color: ${activePalette.text}; font-weight: 600; }
    [data-composition-id="${scene.id}"] .agent-code-font { font-family: "JetBrains Mono", monospace; font-size: 19px; color: ${activePalette.accent}; }
  `,
});

// 30. Prompt Budget Canvas (Stacked Context Breakdown)
registerArchetypeRenderer("prompt-budget-canvas", {
  getBackground: ({ activePalette }) =>
    `background: radial-gradient(circle at 50% 50%, ${activePalette.accent}12 0%, transparent 65%), ${activePalette.background};`,
  renderHtml: ({ scene, i, isPortrait, h, sDur, activePalette }) => {
    const rawSegments = scene.budgetData?.segments;
    const totalTokens = Number(scene.budgetData?.totalTokens) || 8192;
    const segments = (
      Array.isArray(rawSegments) && rawSegments.length >= 2
        ? rawSegments
        : [
            { label: "System Persona", tokens: 1200 },
            { label: "Few-Shot Examples", tokens: 2200 },
            { label: "RAG Context", tokens: 2800 },
            { label: "Output Headroom", tokens: 1992 },
          ]
    ).slice(0, 5);

    const colors = [activePalette.accent, "#3b82f6", "#10b981", "#f59e0b", "#ec4899"];

    const segBarsHtml = segments
      .map((seg, idx) => {
        const tokens = Number(seg.tokens) || 1000;
        const pct = Math.max(5, Math.round((tokens / totalTokens) * 100));
        const color = colors[idx % colors.length];
        return `<div class="pbc-bar-seg" style="flex: ${pct}; background: ${color};" title="${h(seg.label)}: ${tokens}"></div>`;
      })
      .join("\n");

    const legendHtml = segments
      .map((seg, idx) => {
        const tokens = Number(seg.tokens) || 1000;
        const pct = Math.round((tokens / totalTokens) * 100);
        const color = colors[idx % colors.length];
        return `
        <div class="pbc-legend-card">
          <div class="pbc-card-dot" style="background: ${color};"></div>
          <div class="pbc-card-info">
            <div class="pbc-card-label">${h(seg.label)}</div>
            <div class="pbc-card-num">${tokens.toLocaleString()} <span class="pbc-card-pct">(${pct}%)</span></div>
          </div>
        </div>`;
      })
      .join("\n");

    const pace = scheduleStepProgression("tl", 'scope.querySelectorAll(".pbc-legend-card")', sDur, {
      accent: activePalette.accent,
    });

    return {
      innerHtml: `
        <div class="scene-inner pbc-stage">
          <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || "CONTEXT BUDGET ALLOCATION")}</span></div>
          <h1 id="s${i + 1}-title" class="editorial-title" style="font-size: ${isPortrait ? "48px" : "64px"}">${h(scene.title)}</h1>
          <div class="pbc-total-badge">
            <span class="pbc-total-num">${totalTokens.toLocaleString()}</span>
            <span class="pbc-total-unit">TOTAL TOKENS</span>
          </div>
          <div id="s${i + 1}-bar" class="pbc-bar-container">
            ${segBarsHtml}
          </div>
          <div id="s${i + 1}-legend" class="pbc-legend-grid">
            ${legendHtml}
          </div>
        </div>
      `,
      gsapChoreography: `
        tl.from(scope.querySelector("#s${i + 1}-eyebrow"), { opacity: 0, y: 16, duration: 0.5 }, 0.2);
        tl.from(scope.querySelector("#s${i + 1}-title"), { opacity: 0, y: 22, duration: 0.6 }, 0.35);
        tl.from(scope.querySelector(".pbc-total-badge"), { opacity: 0, scale: 0.8, duration: 0.5 }, 0.5);
        tl.from(scope.querySelector(".pbc-bar-container"), { scaleX: 0, opacity: 0, duration: 0.8, ease: "power3.out" }, 0.65);
        tl.from(scope.querySelectorAll(".pbc-legend-card"), { opacity: 0, y: 24, stagger: 0.1, duration: 0.5, ease: "power3.out" }, 0.85);
        ${pace}
      `,
    };
  },
  renderCss: ({ scene, isPortrait, activePalette }) => `
    [data-composition-id="${scene.id}"] .pbc-stage { justify-content: center; align-items: center; text-align: center; }
    [data-composition-id="${scene.id}"] .pbc-total-badge { display: inline-flex; align-items: baseline; gap: 10px; margin-top: 18px; padding: 8px 24px; border-radius: 999px; background: ${activePalette.card}; border: 1.5px solid ${activePalette.border}; }
    [data-composition-id="${scene.id}"] .pbc-total-num { font-family: "JetBrains Mono", monospace; font-size: 32px; font-weight: 900; color: ${activePalette.accent}; }
    [data-composition-id="${scene.id}"] .pbc-total-unit { font-size: 16px; font-weight: 800; color: ${activePalette.textMuted || activePalette.text}; letter-spacing: 0.08em; }
    [data-composition-id="${scene.id}"] .pbc-bar-container { display: flex; width: min(1360px, 86vw); height: 48px; border-radius: 14px; overflow: hidden; margin-top: 36px; border: 2px solid ${activePalette.border}; box-shadow: 0 0 32px rgba(0,0,0,0.2); }
    [data-composition-id="${scene.id}"] .pbc-bar-seg { height: 100%; transition: opacity 0.3s; }
    [data-composition-id="${scene.id}"] .pbc-legend-grid { display: grid; grid-template-columns: ${isPortrait ? "repeat(2, 1fr)" : "repeat(auto-fit, minmax(240px, 1fr))"}; gap: 20px; width: min(1360px, 86vw); margin-top: 40px; }
    [data-composition-id="${scene.id}"] .pbc-legend-card { display: flex; align-items: center; gap: 16px; padding: 22px 24px; border-radius: 16px; background: ${activePalette.card}; border: 1.5px solid ${activePalette.border}; text-align: left; }
    [data-composition-id="${scene.id}"] .pbc-card-dot { width: 16px; height: 16px; border-radius: 50%; flex-shrink: 0; }
    [data-composition-id="${scene.id}"] .pbc-card-label { font-size: 18px; font-weight: 700; color: ${activePalette.text}; }
    [data-composition-id="${scene.id}"] .pbc-card-num { font-family: "JetBrains Mono", monospace; font-size: 22px; font-weight: 800; color: ${activePalette.text}; margin-top: 4px; }
    [data-composition-id="${scene.id}"] .pbc-card-pct { font-size: 16px; color: ${activePalette.textMuted || activePalette.text}; font-weight: 500; }
  `,
});

// 31. Embedding Similarity Space (2D Vector Metric)
registerArchetypeRenderer("embedding-similarity-space", {
  getBackground: ({ activePalette }) =>
    `background: radial-gradient(circle at 30% 40%, ${activePalette.accent}14 0%, transparent 60%), ${activePalette.background};`,
  renderHtml: ({ scene, i, isPortrait, h, sDur, activePalette }) => {
    const rawCandidates = scene.similarityData?.candidates;
    const candidates = (
      Array.isArray(rawCandidates) && rawCandidates.length >= 2
        ? rawCandidates
        : [
            { label: "Semantic Chunk A", score: 0.94, match: true },
            { label: "Context Window B", score: 0.81, match: false },
            { label: "Related Token C", score: 0.67, match: false },
          ]
    ).slice(0, 4);

    const queryLabel = scene.similarityData?.queryLabel || scene.title;

    const rankRowsHtml = candidates
      .map((c, idx) => {
        const isMatch = Boolean(c.match);
        const score = Number(c.score) || 0.75;
        const pct = Math.round(score * 100);
        return `
        <div class="ess-rank-row ${isMatch ? "ess-row-match" : ""}">
          <div class="ess-rank-idx">#0${idx + 1}</div>
          <div class="ess-rank-name">${h(c.label)}</div>
          <div class="ess-rank-score-wrap">
            <span class="ess-rank-score">${score.toFixed(2)}</span>
            <span class="ess-rank-badge">${isMatch ? "NEAREST" : `${pct}%`}</span>
          </div>
        </div>`;
      })
      .join("\n");

    const pace = scheduleStepProgression("tl", 'scope.querySelectorAll(".ess-rank-row")', sDur, {
      accent: activePalette.accent,
    });

    return {
      innerHtml: `
        <div class="scene-inner ess-stage">
          <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || "HIGH-DIMENSIONAL VECTOR SPACE")}</span></div>
          <h1 id="s${i + 1}-title" class="editorial-title" style="font-size: ${isPortrait ? "46px" : "60px"}">${h(scene.title)}</h1>
          <div class="ess-canvas-grid">
            <!-- Left: 2D Projection Space -->
            <div class="ess-polar-space">
              <svg class="ess-polar-svg" viewBox="0 0 400 400">
                <circle cx="200" cy="200" r="160" class="ess-grid-ring" />
                <circle cx="200" cy="200" r="110" class="ess-grid-ring" />
                <circle cx="200" cy="200" r="60" class="ess-grid-ring" />
                <line x1="20" y1="200" x2="380" y2="200" class="ess-grid-axis" />
                <line x1="200" y1="20" x2="200" y2="380" class="ess-grid-axis" />
                <!-- Anchor Query Node -->
                <circle cx="200" cy="200" r="10" class="ess-anchor-node" />
                <text x="200" y="235" text-anchor="middle" class="ess-anchor-txt">QUERY</text>
                <!-- Plotted vectors -->
                <line x1="200" y1="200" x2="290" y2="130" class="ess-cosine-line" />
                <circle cx="290" cy="130" r="8" class="ess-target-node" />
                <line x1="200" y1="200" x2="110" y2="120" class="ess-cosine-line" />
                <circle cx="110" cy="120" r="7" class="ess-candidate-node" />
                <line x1="200" y1="200" x2="270" y2="280" class="ess-cosine-line" />
                <circle cx="270" cy="280" r="7" class="ess-candidate-node" />
              </svg>
              <div class="ess-query-tag">${h(queryLabel)}</div>
            </div>
            <!-- Right: Ranked List -->
            <div class="ess-rank-table">
              <div class="ess-table-head">METRIC SIMILARITY RANKING</div>
              ${rankRowsHtml}
            </div>
          </div>
        </div>
      `,
      gsapChoreography: `
        tl.from(scope.querySelector("#s${i + 1}-eyebrow"), { opacity: 0, y: 16, duration: 0.5 }, 0.2);
        tl.from(scope.querySelector("#s${i + 1}-title"), { opacity: 0, y: 22, duration: 0.6 }, 0.35);
        tl.from(scope.querySelector(".ess-polar-space"), { opacity: 0, scale: 0.85, duration: 0.7, ease: "back.out(1.4)" }, 0.55);
        tl.from(scope.querySelectorAll(".ess-rank-row"), { opacity: 0, x: 26, stagger: 0.12, duration: 0.55, ease: "power3.out" }, 0.75);
        ${pace}
      `,
    };
  },
  renderCss: ({ scene, isPortrait, activePalette }) => `
    [data-composition-id="${scene.id}"] .ess-stage { justify-content: center; align-items: center; text-align: center; }
    [data-composition-id="${scene.id}"] .ess-canvas-grid { display: flex; ${isPortrait ? "flex-direction: column;" : "flex-direction: row;"} align-items: center; justify-content: space-between; gap: 36px; width: min(1360px, 86vw); margin-top: ${isPortrait ? "28px" : "48px"}; }
    [data-composition-id="${scene.id}"] .ess-polar-space { flex: 0 0 ${isPortrait ? "100%" : "44%"}; display: flex; flex-direction: column; align-items: center; padding: 24px; border-radius: 20px; background: ${activePalette.card}; border: 1.5px solid ${activePalette.border}; }
    [data-composition-id="${scene.id}"] .ess-polar-svg { width: 340px; height: 340px; }
    [data-composition-id="${scene.id}"] .ess-grid-ring { fill: none; stroke: ${activePalette.border}; stroke-width: 1.5; stroke-dasharray: 4 6; }
    [data-composition-id="${scene.id}"] .ess-grid-axis { stroke: ${activePalette.border}; stroke-width: 1.5; }
    [data-composition-id="${scene.id}"] .ess-anchor-node { fill: ${activePalette.accent}; filter: drop-shadow(0 0 10px ${activePalette.accent}); }
    [data-composition-id="${scene.id}"] .ess-anchor-txt { fill: ${activePalette.accent}; font-family: "JetBrains Mono", monospace; font-size: 14px; font-weight: 800; }
    [data-composition-id="${scene.id}"] .ess-cosine-line { stroke: ${activePalette.accent}; stroke-width: 2; stroke-dasharray: 4 4; opacity: 0.7; }
    [data-composition-id="${scene.id}"] .ess-target-node { fill: #10b981; filter: drop-shadow(0 0 8px #10b981); }
    [data-composition-id="${scene.id}"] .ess-candidate-node { fill: ${activePalette.textMuted || "#888"}; }
    [data-composition-id="${scene.id}"] .ess-query-tag { font-family: "JetBrains Mono", monospace; font-size: 16px; font-weight: 700; color: ${activePalette.accent}; margin-top: 14px; }
    [data-composition-id="${scene.id}"] .ess-rank-table { flex: 1; width: 100%; display: flex; flex-direction: column; gap: 16px; }
    [data-composition-id="${scene.id}"] .ess-table-head { font-family: "JetBrains Mono", monospace; font-size: 15px; font-weight: 800; color: ${activePalette.accent}; letter-spacing: 0.08em; text-align: left; }
    [data-composition-id="${scene.id}"] .ess-rank-row { display: flex; align-items: center; justify-content: space-between; padding: 22px 26px; border-radius: 16px; background: ${activePalette.card}; border: 1.5px solid ${activePalette.border}; }
    [data-composition-id="${scene.id}"] .ess-row-match { border-color: ${activePalette.accent}; box-shadow: 0 0 24px ${activePalette.accent}24; }
    [data-composition-id="${scene.id}"] .ess-rank-idx { font-family: "JetBrains Mono", monospace; font-size: 18px; font-weight: 800; color: ${activePalette.accent}; }
    [data-composition-id="${scene.id}"] .ess-rank-name { font-size: 21px; font-weight: 700; color: ${activePalette.text}; margin-left: 16px; text-align: left; flex: 1; }
    [data-composition-id="${scene.id}"] .ess-rank-score-wrap { display: flex; align-items: center; gap: 14px; }
    [data-composition-id="${scene.id}"] .ess-rank-score { font-family: "JetBrains Mono", monospace; font-size: 22px; font-weight: 800; color: ${activePalette.text}; }
    [data-composition-id="${scene.id}"] .ess-rank-badge { font-family: "JetBrains Mono", monospace; font-size: 13px; font-weight: 800; padding: 4px 10px; border-radius: 6px; background: ${activePalette.accent}16; color: ${activePalette.accent}; }
  `,
});

// 32. Tool Calling Schema (Structured Function Contract)
registerArchetypeRenderer("tool-calling-schema", {
  getBackground: ({ activePalette }) =>
    `background: radial-gradient(circle at 75% 30%, ${activePalette.accent}14 0%, transparent 60%), ${activePalette.background};`,
  renderHtml: ({ scene, i, isPortrait, h, sDur, activePalette }) => {
    const fnName = scene.toolData?.functionName || "query_vector_store";
    const desc =
      scene.toolData?.description || "Executes semantic similarity search over index chunks";
    const rawParams = scene.toolData?.parameters;
    const params = (
      Array.isArray(rawParams) && rawParams.length >= 2
        ? rawParams
        : [
            { name: "query", type: "string", desc: "Target query prompt text", required: true },
            { name: "top_k", type: "number", desc: "Maximum candidates to return", required: true },
            { name: "threshold", type: "number", desc: "Minimum score cutoff", required: false },
          ]
    ).slice(0, 4);

    const paramsHtml = params
      .map((p) => {
        const reqBadge = p.required
          ? `<span class="tcs-req-badge">REQUIRED</span>`
          : `<span class="tcs-opt-badge">OPTIONAL</span>`;
        return `
        <div class="tcs-param-row">
          <div class="tcs-param-head">
            <span class="tcs-param-name">${h(p.name)}</span>
            <span class="tcs-param-type">${h(p.type)}</span>
            ${reqBadge}
          </div>
          <div class="tcs-param-desc">${h(p.desc)}</div>
        </div>`;
      })
      .join("\n");

    const pace = scheduleStepProgression("tl", 'scope.querySelectorAll(".tcs-param-row")', sDur, {
      accent: activePalette.accent,
    });

    return {
      innerHtml: `
        <div class="scene-inner tcs-stage">
          <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || "FUNCTION CALLING SCHEMA")}</span></div>
          <h1 id="s${i + 1}-title" class="editorial-title" style="font-size: ${isPortrait ? "46px" : "60px"}">${h(scene.title)}</h1>
          <div class="tcs-split-layout">
            <!-- Left: Function Summary -->
            <div class="tcs-left-card">
              <div class="tcs-badge-pill">VALIDATED SPEC</div>
              <div class="tcs-fn-name">fn: ${h(fnName)}()</div>
              <div class="tcs-fn-desc">${h(desc)}</div>
              <div class="tcs-call-box">
                <span class="tcs-prompt-sign">&gt;</span>
                <span class="tcs-call-txt">${h(fnName)}(query="search_terms", top_k=5)</span>
              </div>
            </div>
            <!-- Right: Schema Parameters -->
            <div class="tcs-right-card">
              <div class="tcs-schema-title">PARAMETERS SCHEMA</div>
              <div class="tcs-params-list">
                ${paramsHtml}
              </div>
            </div>
          </div>
        </div>
      `,
      gsapChoreography: `
        tl.from(scope.querySelector("#s${i + 1}-eyebrow"), { opacity: 0, y: 16, duration: 0.5 }, 0.2);
        tl.from(scope.querySelector("#s${i + 1}-title"), { opacity: 0, y: 22, duration: 0.6 }, 0.35);
        tl.from(scope.querySelector(".tcs-left-card"), { opacity: 0, x: -30, duration: 0.6, ease: "power3.out" }, 0.55);
        tl.from(scope.querySelector(".tcs-right-card"), { opacity: 0, x: 30, duration: 0.6, ease: "power3.out" }, 0.65);
        ${pace}
      `,
    };
  },
  renderCss: ({ scene, isPortrait, activePalette }) => `
    [data-composition-id="${scene.id}"] .tcs-stage { justify-content: center; align-items: center; text-align: center; }
    [data-composition-id="${scene.id}"] .tcs-split-layout { display: flex; ${isPortrait ? "flex-direction: column;" : "flex-direction: row;"} gap: 28px; width: min(1380px, 86vw); margin-top: ${isPortrait ? "28px" : "48px"}; text-align: left; }
    [data-composition-id="${scene.id}"] .tcs-left-card { flex: 0 0 ${isPortrait ? "100%" : "42%"}; padding: 32px 30px; border-radius: 20px; background: ${activePalette.card}; border: 1.5px solid ${activePalette.border}; display: flex; flex-direction: column; justify-content: space-between; }
    [data-composition-id="${scene.id}"] .tcs-badge-pill { font-family: "JetBrains Mono", monospace; font-size: 13px; font-weight: 800; color: #10b981; background: rgba(16, 185, 129, 0.15); padding: 4px 12px; border-radius: 999px; width: fit-content; }
    [data-composition-id="${scene.id}"] .tcs-fn-name { font-family: "JetBrains Mono", monospace; font-size: ${isPortrait ? "26px" : "32px"}; font-weight: 800; color: ${activePalette.accent}; margin-top: 18px; }
    [data-composition-id="${scene.id}"] .tcs-fn-desc { font-size: 20px; color: ${activePalette.textMuted || activePalette.text}; line-height: 1.45; margin-top: 12px; }
    [data-composition-id="${scene.id}"] .tcs-call-box { display: flex; align-items: center; gap: 12px; padding: 16px 20px; border-radius: 12px; background: ${activePalette.background}; border: 1px solid ${activePalette.border}; margin-top: 24px; }
    [data-composition-id="${scene.id}"] .tcs-prompt-sign { font-family: "JetBrains Mono", monospace; font-size: 20px; font-weight: 800; color: ${activePalette.accent}; }
    [data-composition-id="${scene.id}"] .tcs-call-txt { font-family: "JetBrains Mono", monospace; font-size: 17px; color: ${activePalette.text}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    [data-composition-id="${scene.id}"] .tcs-right-card { flex: 1; padding: 32px 30px; border-radius: 20px; background: ${activePalette.card}; border: 1.5px solid ${activePalette.border}; display: flex; flex-direction: column; }
    [data-composition-id="${scene.id}"] .tcs-schema-title { font-family: "JetBrains Mono", monospace; font-size: 15px; font-weight: 800; color: ${activePalette.accent}; letter-spacing: 0.08em; margin-bottom: 20px; }
    [data-composition-id="${scene.id}"] .tcs-params-list { display: flex; flex-direction: column; gap: 14px; }
    [data-composition-id="${scene.id}"] .tcs-param-row { padding: 18px 20px; border-radius: 14px; background: ${activePalette.background}; border: 1px solid ${activePalette.border}; }
    [data-composition-id="${scene.id}"] .tcs-param-head { display: flex; align-items: center; gap: 12px; }
    [data-composition-id="${scene.id}"] .tcs-param-name { font-family: "JetBrains Mono", monospace; font-size: 20px; font-weight: 800; color: ${activePalette.text}; }
    [data-composition-id="${scene.id}"] .tcs-param-type { font-family: "JetBrains Mono", monospace; font-size: 14px; color: ${activePalette.accent}; background: ${activePalette.accent}14; padding: 2px 8px; border-radius: 4px; }
    [data-composition-id="${scene.id}"] .tcs-req-badge { font-family: "JetBrains Mono", monospace; font-size: 12px; font-weight: 800; color: #f59e0b; background: rgba(245, 158, 11, 0.15); padding: 2px 8px; border-radius: 4px; margin-left: auto; }
    [data-composition-id="${scene.id}"] .tcs-opt-badge { font-family: "JetBrains Mono", monospace; font-size: 12px; font-weight: 800; color: ${activePalette.textMuted || "#888"}; background: rgba(255, 255, 255, 0.08); padding: 2px 8px; border-radius: 4px; margin-left: auto; }
    [data-composition-id="${scene.id}"] .tcs-param-desc { font-size: 17px; color: ${activePalette.textMuted || activePalette.text}; margin-top: 6px; line-height: 1.4; }
  `,
});

// 33. Context Window Gauge (Radial Memory Pressure)
registerArchetypeRenderer("context-window-gauge", {
  getBackground: ({ activePalette }) =>
    `background: radial-gradient(circle at 50% 40%, ${activePalette.accent}16 0%, transparent 65%), ${activePalette.background};`,
  renderHtml: ({ scene, i, isPortrait, h, sDur, activePalette }) => {
    const curTokens = Number(scene.gaugeData?.currentTokens) || 64000;
    const maxTokens = Number(scene.gaugeData?.maxTokens) || 128000;
    const ratio = Math.min(1.0, Math.max(0.05, curTokens / maxTokens));
    const pct = Math.round(ratio * 100);
    const label = scene.gaugeData?.label || "Working Context Allocation";
    const fillDur = Math.min(1.4, Math.max(0.6, sDur * 0.3));

    return {
      innerHtml: `
        <div class="scene-inner cwg-stage">
          <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || "ACTIVE CONTEXT MONITOR")}</span></div>
          <h1 id="s${i + 1}-title" class="editorial-title" style="font-size: ${isPortrait ? "46px" : "60px"}">${h(scene.title)}</h1>
          <div class="cwg-gauge-wrap" style="--cwg-accent: ${activePalette.accent};">
            <svg class="cwg-gauge-svg" viewBox="0 0 360 220">
              <path d="M 40 190 A 140 140 0 0 1 320 190" class="cwg-gauge-track" />
              <path d="M 40 190 A 140 140 0 0 1 320 190" class="cwg-gauge-fill" style="stroke-dasharray: 440; stroke-dashoffset: ${440 - 440 * ratio};" />
            </svg>
            <div class="cwg-readout">
              <div class="cwg-pct">${pct}%</div>
              <div class="cwg-sub">${(curTokens / 1000).toFixed(0)}k / ${(maxTokens / 1000).toFixed(0)}k TOKENS</div>
            </div>
          </div>
          <div class="cwg-status-card">
            <div class="cwg-status-indicator"></div>
            <div class="cwg-status-text">${h(label)}</div>
          </div>
        </div>
      `,
      gsapChoreography: `
        tl.from(scope.querySelector("#s${i + 1}-eyebrow"), { opacity: 0, y: 16, duration: 0.5 }, 0.2);
        tl.from(scope.querySelector("#s${i + 1}-title"), { opacity: 0, y: 22, duration: 0.6 }, 0.35);
        tl.from(scope.querySelector(".cwg-gauge-fill"), { strokeDashoffset: 440, duration: ${fillDur}, ease: "power3.out" }, 0.5);
        tl.from(scope.querySelector(".cwg-readout"), { opacity: 0, scale: 0.8, duration: 0.6, ease: "back.out(1.5)" }, 0.7);
        tl.from(scope.querySelector(".cwg-status-card"), { opacity: 0, y: 20, duration: 0.5 }, 0.9);
      `,
    };
  },
  renderCss: ({ scene, isPortrait, activePalette }) => `
    [data-composition-id="${scene.id}"] .cwg-stage { justify-content: center; align-items: center; text-align: center; }
    [data-composition-id="${scene.id}"] .cwg-gauge-wrap { position: relative; width: 420px; height: 260px; margin-top: 36px; display: flex; align-items: flex-end; justify-content: center; }
    [data-composition-id="${scene.id}"] .cwg-gauge-svg { width: 100%; height: 100%; overflow: visible; }
    [data-composition-id="${scene.id}"] .cwg-gauge-track { fill: none; stroke: ${activePalette.border}; stroke-width: 28; stroke-linecap: round; }
    [data-composition-id="${scene.id}"] .cwg-gauge-fill { fill: none; stroke: ${activePalette.accent}; stroke-width: 28; stroke-linecap: round; filter: drop-shadow(0 0 14px ${activePalette.accent}); }
    [data-composition-id="${scene.id}"] .cwg-readout { position: absolute; bottom: 10px; display: flex; flex-direction: column; align-items: center; }
    [data-composition-id="${scene.id}"] .cwg-pct { font-family: "JetBrains Mono", monospace; font-size: ${isPortrait ? "56px" : "68px"}; font-weight: 900; color: ${activePalette.text}; line-height: 1; }
    [data-composition-id="${scene.id}"] .cwg-sub { font-family: "JetBrains Mono", monospace; font-size: 17px; font-weight: 700; color: ${activePalette.accent}; margin-top: 8px; letter-spacing: 0.05em; }
    [data-composition-id="${scene.id}"] .cwg-status-card { display: inline-flex; align-items: center; gap: 12px; padding: 14px 28px; border-radius: 999px; background: ${activePalette.card}; border: 1.5px solid ${activePalette.border}; margin-top: 40px; }
    [data-composition-id="${scene.id}"] .cwg-status-indicator { width: 14px; height: 14px; border-radius: 50%; background: #10b981; box-shadow: 0 0 10px #10b981; }
    [data-composition-id="${scene.id}"] .cwg-status-text { font-size: 20px; font-weight: 700; color: ${activePalette.text}; }
  `,
});

// 34. Eval Benchmark Matrix (Leaderboard Comparison)
registerArchetypeRenderer("eval-benchmark-matrix", {
  getBackground: ({ activePalette }) =>
    `background: radial-gradient(circle at 50% 50%, ${activePalette.accent}12 0%, transparent 65%), ${activePalette.background};`,
  renderHtml: ({ scene, i, isPortrait, h, sDur, activePalette }) => {
    const rawBench = scene.benchmarkData?.benchmarks;
    const benchmarks = (
      Array.isArray(rawBench) && rawBench.length >= 2
        ? rawBench
        : [
            {
              name: "MMLU Reasoning",
              scores: [
                { model: "Hero Model", score: 89.2, isHero: true },
                { model: "Baseline A", score: 78.4 },
                { model: "Baseline B", score: 71.0 },
              ],
            },
            {
              name: "HumanEval Coding",
              scores: [
                { model: "Hero Model", score: 84.6, isHero: true },
                { model: "Baseline A", score: 73.1 },
                { model: "Baseline B", score: 65.5 },
              ],
            },
            {
              name: "GSM8K Math",
              scores: [
                { model: "Hero Model", score: 92.4, isHero: true },
                { model: "Baseline A", score: 81.0 },
                { model: "Baseline B", score: 74.8 },
              ],
            },
          ]
    ).slice(0, 3);

    const rowsHtml = benchmarks
      .map((bm) => {
        const barsHtml = (bm.scores || [])
          .map((sc) => {
            const isHero = Boolean(sc.isHero);
            const score = Number(sc.score) || 75;
            return `
            <div class="ebm-bar-row">
              <span class="ebm-model-name ${isHero ? "ebm-hero-text" : ""}">${h(sc.model)}</span>
              <div class="ebm-bar-track">
                <div class="ebm-bar-fill ${isHero ? "ebm-hero-bar" : ""}" style="width: ${score}%;"></div>
              </div>
              <span class="ebm-model-score ${isHero ? "ebm-hero-text" : ""}">${score.toFixed(1)}%</span>
            </div>`;
          })
          .join("\n");

        return `
        <div class="ebm-bench-card">
          <div class="ebm-bench-title">${h(bm.name)}</div>
          <div class="ebm-bars-group">
            ${barsHtml}
          </div>
        </div>`;
      })
      .join("\n");

    const pace = scheduleStepProgression("tl", 'scope.querySelectorAll(".ebm-bench-card")', sDur, {
      accent: activePalette.accent,
    });

    return {
      innerHtml: `
        <div class="scene-inner ebm-stage">
          <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || "EVALUATION BENCHMARK SUITE")}</span></div>
          <h1 id="s${i + 1}-title" class="editorial-title" style="font-size: ${isPortrait ? "46px" : "60px"}">${h(scene.title)}</h1>
          <div class="ebm-cards-grid">
            ${rowsHtml}
          </div>
        </div>
      `,
      gsapChoreography: `
        tl.from(scope.querySelector("#s${i + 1}-eyebrow"), { opacity: 0, y: 16, duration: 0.5 }, 0.2);
        tl.from(scope.querySelector("#s${i + 1}-title"), { opacity: 0, y: 22, duration: 0.6 }, 0.35);
        tl.from(scope.querySelectorAll(".ebm-bench-card"), { opacity: 0, y: 28, stagger: 0.14, duration: 0.6, ease: "power3.out" }, 0.55);
        ${pace}
      `,
    };
  },
  renderCss: ({ scene, isPortrait, activePalette }) => `
    [data-composition-id="${scene.id}"] .ebm-stage { justify-content: center; align-items: center; text-align: center; }
    [data-composition-id="${scene.id}"] .ebm-cards-grid { display: flex; flex-direction: column; gap: 22px; width: min(1360px, 86vw); margin-top: ${isPortrait ? "28px" : "44px"}; }
    [data-composition-id="${scene.id}"] .ebm-bench-card { padding: 24px 30px; border-radius: 18px; background: ${activePalette.card}; border: 1.5px solid ${activePalette.border}; text-align: left; }
    [data-composition-id="${scene.id}"] .ebm-bench-title { font-size: 24px; font-weight: 800; color: ${activePalette.text}; margin-bottom: 18px; }
    [data-composition-id="${scene.id}"] .ebm-bars-group { display: flex; flex-direction: column; gap: 12px; }
    [data-composition-id="${scene.id}"] .ebm-bar-row { display: flex; align-items: center; gap: 18px; }
    [data-composition-id="${scene.id}"] .ebm-model-name { font-size: 18px; font-weight: 600; color: ${activePalette.textMuted || activePalette.text}; width: 140px; flex-shrink: 0; }
    [data-composition-id="${scene.id}"] .ebm-hero-text { color: ${activePalette.accent} !important; font-weight: 800; }
    [data-composition-id="${scene.id}"] .ebm-bar-track { flex: 1; height: 16px; border-radius: 999px; background: ${activePalette.background}; overflow: hidden; border: 1px solid ${activePalette.border}; }
    [data-composition-id="${scene.id}"] .ebm-bar-fill { height: 100%; border-radius: 999px; background: ${activePalette.textMuted || "#888"}; transition: width 0.5s; }
    [data-composition-id="${scene.id}"] .ebm-hero-bar { background: ${activePalette.accent}; box-shadow: 0 0 12px ${activePalette.accent}; }
    [data-composition-id="${scene.id}"] .ebm-model-score { font-family: "JetBrains Mono", monospace; font-size: 19px; font-weight: 700; color: ${activePalette.text}; width: 70px; text-align: right; flex-shrink: 0; }
  `,
});

// 35. Data Lineage Flow (ETL/DAG Stream)
registerArchetypeRenderer("data-lineage-flow", {
  getBackground: ({ activePalette }) =>
    `background: radial-gradient(circle at 70% 30%, ${activePalette.accent}14 0%, transparent 60%), ${activePalette.background};`,
  renderHtml: ({ scene, i, isPortrait, h, sDur, activePalette }) => {
    const rawStages = scene.lineageData?.stages;
    const stages = (
      Array.isArray(rawStages) && rawStages.length >= 2
        ? rawStages
        : [
            {
              title: "Raw Sources",
              subtitle: "Event logs & APIs",
              items: ["Kafka Stream", "Postgres CDC"],
            },
            {
              title: "Transformation",
              subtitle: "Cleaning & dedup",
              items: ["Schema Validator", "Filter Pass"],
            },
            {
              title: "Vector Store",
              subtitle: "Storage & Index",
              items: ["Graph Cache", "Index Cache"],
            },
            {
              title: "Serving Layer",
              subtitle: "Low latency query",
              items: ["gRPC Endpoint", "Edge Cache"],
            },
          ]
    ).slice(0, 4);

    const columnsHtml = stages
      .map((st, idx) => {
        const itemsHtml = (st.items || [])
          .map((item) => `<div class="dlf-item-badge">${h(item)}</div>`)
          .join("\n");
        return `
        <div class="dlf-stage-col">
          <div class="dlf-stage-header">
            <span class="dlf-step-num">STAGE 0${idx + 1}</span>
            <div class="dlf-step-title">${h(st.title)}</div>
            <div class="dlf-step-sub">${h(st.subtitle || "")}</div>
          </div>
          <div class="dlf-items-box">
            ${itemsHtml}
          </div>
        </div>`;
      })
      .join("\n");

    const pace = scheduleStepProgression("tl", 'scope.querySelectorAll(".dlf-stage-col")', sDur, {
      accent: activePalette.accent,
    });

    return {
      innerHtml: `
        <div class="scene-inner dlf-stage">
          <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || "END-TO-END DATA LINEAGE")}</span></div>
          <h1 id="s${i + 1}-title" class="editorial-title" style="font-size: ${isPortrait ? "46px" : "60px"}">${h(scene.title)}</h1>
          <div class="dlf-columns-track">
            ${columnsHtml}
          </div>
        </div>
      `,
      gsapChoreography: `
        tl.from(scope.querySelector("#s${i + 1}-eyebrow"), { opacity: 0, y: 16, duration: 0.5 }, 0.2);
        tl.from(scope.querySelector("#s${i + 1}-title"), { opacity: 0, y: 22, duration: 0.6 }, 0.35);
        tl.from(scope.querySelectorAll(".dlf-stage-col"), { opacity: 0, y: 28, stagger: 0.12, duration: 0.55, ease: "power3.out" }, 0.55);
        ${pace}
      `,
    };
  },
  renderCss: ({ scene, isPortrait, activePalette }) => `
    [data-composition-id="${scene.id}"] .dlf-stage { justify-content: center; align-items: center; text-align: center; }
    [data-composition-id="${scene.id}"] .dlf-columns-track { display: flex; ${isPortrait ? "flex-direction: column;" : "flex-direction: row;"} gap: 24px; width: min(1400px, 86vw); margin-top: ${isPortrait ? "28px" : "48px"}; }
    [data-composition-id="${scene.id}"] .dlf-stage-col { flex: 1; padding: 28px 24px; border-radius: 18px; background: ${activePalette.card}; border: 1.5px solid ${activePalette.border}; text-align: left; display: flex; flex-direction: column; justify-content: space-between; min-height: 280px; }
    [data-composition-id="${scene.id}"] .dlf-step-num { font-family: "JetBrains Mono", monospace; font-size: 14px; font-weight: 800; color: ${activePalette.accent}; letter-spacing: 0.08em; }
    [data-composition-id="${scene.id}"] .dlf-step-title { font-size: 24px; font-weight: 800; color: ${activePalette.text}; margin-top: 10px; }
    [data-composition-id="${scene.id}"] .dlf-step-sub { font-size: 17px; color: ${activePalette.textMuted || activePalette.text}; margin-top: 6px; }
    [data-composition-id="${scene.id}"] .dlf-items-box { display: flex; flex-direction: column; gap: 10px; margin-top: 24px; }
    [data-composition-id="${scene.id}"] .dlf-item-badge { padding: 12px 14px; border-radius: 10px; background: ${activePalette.background}; border: 1px solid ${activePalette.border}; font-family: "JetBrains Mono", monospace; font-size: 16px; font-weight: 700; color: ${activePalette.text}; }
  `,
});

// 36. Microservice Mesh (Distributed Service Topology)
registerArchetypeRenderer("microservice-mesh", {
  getBackground: ({ activePalette }) =>
    `background: radial-gradient(circle at 50% 30%, ${activePalette.accent}14 0%, transparent 65%), ${activePalette.background};`,
  renderHtml: ({ scene, i, isPortrait, h, sDur, activePalette }) => {
    const rawNodes = scene.meshData?.nodes;
    const nodes = (
      Array.isArray(rawNodes) && rawNodes.length >= 2
        ? rawNodes
        : [
            { id: "gw", label: "API Gateway", role: "Load Balancer", status: "ok" },
            { id: "auth", label: "Auth Service", role: "OAuth & JWT", status: "ok" },
            { id: "core", label: "Core Service", role: "Business Logic", status: "ok" },
            { id: "db", label: "Data Cluster", role: "Storage Shard", status: "ok" },
          ]
    ).slice(0, 4);

    const nodesHtml = nodes
      .map(
        (node) => `
        <div class="msm-node-card">
          <div class="msm-node-status"></div>
          <div class="msm-node-name">${h(node.label)}</div>
          <div class="msm-node-role">${h(node.role || "")}</div>
          <div class="msm-node-meta">gRPC // 1.2ms</div>
        </div>`,
      )
      .join("\n");

    const pace = scheduleStepProgression("tl", 'scope.querySelectorAll(".msm-node-card")', sDur, {
      accent: activePalette.accent,
    });

    return {
      innerHtml: `
        <div class="scene-inner msm-stage">
          <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || "DISTRIBUTED SERVICE MESH")}</span></div>
          <h1 id="s${i + 1}-title" class="editorial-title" style="font-size: ${isPortrait ? "46px" : "60px"}">${h(scene.title)}</h1>
          <div class="msm-mesh-grid">
            ${nodesHtml}
          </div>
        </div>
      `,
      gsapChoreography: `
        tl.from(scope.querySelector("#s${i + 1}-eyebrow"), { opacity: 0, y: 16, duration: 0.5 }, 0.2);
        tl.from(scope.querySelector("#s${i + 1}-title"), { opacity: 0, y: 22, duration: 0.6 }, 0.35);
        tl.from(scope.querySelectorAll(".msm-node-card"), { opacity: 0, scale: 0.85, stagger: 0.12, duration: 0.55, ease: "back.out(1.4)" }, 0.55);
        ${pace}
      `,
    };
  },
  renderCss: ({ scene, isPortrait, activePalette }) => `
    [data-composition-id="${scene.id}"] .msm-stage { justify-content: center; align-items: center; text-align: center; }
    [data-composition-id="${scene.id}"] .msm-mesh-grid { display: grid; grid-template-columns: ${isPortrait ? "1fr" : "repeat(2, 1fr)"}; gap: 24px; width: min(1200px, 84vw); margin-top: ${isPortrait ? "28px" : "48px"}; }
    [data-composition-id="${scene.id}"] .msm-node-card { position: relative; padding: 28px 30px; border-radius: 18px; background: ${activePalette.card}; border: 1.5px solid ${activePalette.border}; text-align: left; }
    [data-composition-id="${scene.id}"] .msm-node-status { position: absolute; top: 28px; right: 28px; width: 12px; height: 12px; border-radius: 50%; background: #10b981; box-shadow: 0 0 10px #10b981; }
    [data-composition-id="${scene.id}"] .msm-node-name { font-size: 26px; font-weight: 800; color: ${activePalette.text}; }
    [data-composition-id="${scene.id}"] .msm-node-role { font-size: 18px; color: ${activePalette.textMuted || activePalette.text}; margin-top: 8px; }
    [data-composition-id="${scene.id}"] .msm-node-meta { font-family: "JetBrains Mono", monospace; font-size: 14px; font-weight: 700; color: ${activePalette.accent}; margin-top: 18px; }
  `,
});

// 37. Database Shard Map (Partition Ring)
registerArchetypeRenderer("database-shard-map", {
  getBackground: ({ activePalette }) =>
    `background: radial-gradient(circle at 50% 25%, ${activePalette.accent}14 0%, transparent 60%), ${activePalette.background};`,
  renderHtml: ({ scene, i, isPortrait, h, sDur, activePalette }) => {
    const routerKey = scene.shardData?.routerKey || "user_hash_key";
    const rawShards = scene.shardData?.shards;
    const shards = (
      Array.isArray(rawShards) && rawShards.length >= 2
        ? rawShards
        : [
            { name: "Shard 01", range: "[0x00..0x3F]", count: 14200, active: true },
            { name: "Shard 02", range: "[0x40..0x7F]", count: 18900, active: false },
            { name: "Shard 03", range: "[0x80..0xBF]", count: 16400, active: false },
          ]
    ).slice(0, 3);

    const shardsHtml = shards
      .map((sh) => {
        const isActive = Boolean(sh.active);
        const count = Number(sh.count) || 12000;
        return `
        <div class="dsm-shard-card ${isActive ? "dsm-shard-active" : ""}">
          <div class="dsm-shard-head">
            <span class="dsm-shard-title">${h(sh.name)}</span>
            <span class="dsm-shard-badge">${isActive ? "TARGET SHARD" : "ONLINE"}</span>
          </div>
          <div class="dsm-shard-range">${h(sh.range)}</div>
          <div class="dsm-shard-count">${count.toLocaleString()} <span class="dsm-count-unit">records</span></div>
        </div>`;
      })
      .join("\n");

    const pace = scheduleStepProgression("tl", 'scope.querySelectorAll(".dsm-shard-card")', sDur, {
      accent: activePalette.accent,
    });

    return {
      innerHtml: `
        <div class="scene-inner dsm-stage">
          <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || "HORIZONTAL STORAGE PARTITIONING")}</span></div>
          <h1 id="s${i + 1}-title" class="editorial-title" style="font-size: ${isPortrait ? "46px" : "60px"}">${h(scene.title)}</h1>
          <div class="dsm-router-hud">
            <span class="dsm-router-tag">HASH ROUTER</span>
            <span class="dsm-router-val">fn(${h(routerKey)}) -&gt; Murmur3</span>
          </div>
          <div class="dsm-shards-grid">
            ${shardsHtml}
          </div>
        </div>
      `,
      gsapChoreography: `
        tl.from(scope.querySelector("#s${i + 1}-eyebrow"), { opacity: 0, y: 16, duration: 0.5 }, 0.2);
        tl.from(scope.querySelector("#s${i + 1}-title"), { opacity: 0, y: 22, duration: 0.6 }, 0.35);
        tl.from(scope.querySelector(".dsm-router-hud"), { opacity: 0, scale: 0.85, duration: 0.5 }, 0.5);
        tl.from(scope.querySelectorAll(".dsm-shard-card"), { opacity: 0, y: 26, stagger: 0.12, duration: 0.55, ease: "power3.out" }, 0.7);
        ${pace}
      `,
    };
  },
  renderCss: ({ scene, isPortrait, activePalette }) => `
    [data-composition-id="${scene.id}"] .dsm-stage { justify-content: center; align-items: center; text-align: center; }
    [data-composition-id="${scene.id}"] .dsm-router-hud { display: inline-flex; align-items: center; gap: 14px; padding: 10px 24px; border-radius: 999px; background: ${activePalette.card}; border: 1.5px solid ${activePalette.border}; margin: 24px auto 0; }
    [data-composition-id="${scene.id}"] .dsm-router-tag { font-family: "JetBrains Mono", monospace; font-size: 14px; font-weight: 800; color: ${activePalette.accent}; letter-spacing: 0.08em; }
    [data-composition-id="${scene.id}"] .dsm-router-val { font-family: "JetBrains Mono", monospace; font-size: 18px; font-weight: 700; color: ${activePalette.text}; }
    [data-composition-id="${scene.id}"] .dsm-shards-grid { display: grid; grid-template-columns: ${isPortrait ? "1fr" : "repeat(3, 1fr)"}; gap: 24px; width: min(1360px, 86vw); margin-top: ${isPortrait ? "28px" : "48px"}; text-align: left; }
    [data-composition-id="${scene.id}"] .dsm-shard-card { padding: 30px 28px; border-radius: 18px; background: ${activePalette.card}; border: 1.5px solid ${activePalette.border}; }
    [data-composition-id="${scene.id}"] .dsm-shard-active { border-color: ${activePalette.accent}; box-shadow: 0 0 28px ${activePalette.accent}24; }
    [data-composition-id="${scene.id}"] .dsm-shard-head { display: flex; align-items: center; justify-content: space-between; }
    [data-composition-id="${scene.id}"] .dsm-shard-title { font-size: 26px; font-weight: 800; color: ${activePalette.text}; }
    [data-composition-id="${scene.id}"] .dsm-shard-badge { font-family: "JetBrains Mono", monospace; font-size: 13px; font-weight: 800; color: ${activePalette.accent}; background: ${activePalette.accent}14; padding: 4px 10px; border-radius: 6px; }
    [data-composition-id="${scene.id}"] .dsm-shard-range { font-family: "JetBrains Mono", monospace; font-size: 17px; color: ${activePalette.textMuted || activePalette.text}; margin-top: 14px; }
    [data-composition-id="${scene.id}"] .dsm-shard-count { font-family: "JetBrains Mono", monospace; font-size: 30px; font-weight: 900; color: ${activePalette.text}; margin-top: 14px; }
    [data-composition-id="${scene.id}"] .dsm-count-unit { font-size: 16px; font-weight: 600; color: ${activePalette.textMuted || activePalette.text}; }
  `,
});

// 38. Memory Layout Stack (Stack vs Heap)
registerArchetypeRenderer("memory-layout-stack", {
  getBackground: ({ activePalette }) =>
    `background: radial-gradient(circle at 60% 40%, ${activePalette.accent}14 0%, transparent 60%), ${activePalette.background};`,
  renderHtml: ({ scene, i, isPortrait, h, sDur, activePalette }) => {
    const rawFrames = scene.memoryData?.stackFrames;
    const frames = (
      Array.isArray(rawFrames) && rawFrames.length >= 2
        ? rawFrames
        : [
            { func: "execute()", vars: ["ptr_a = 0x7ffe10", "ret_ip"] },
            { func: "main()", vars: ["argc = 2", "argv = 0x7ffe40"] },
          ]
    ).slice(0, 3);

    const rawHeap = scene.memoryData?.heapObjects;
    const heap = (
      Array.isArray(rawHeap) && rawHeap.length >= 2
        ? rawHeap
        : [
            { addr: "0x7ffe10", label: "Payload Buffer [1024]" },
            { addr: "0x7ffe40", label: "Context String Object" },
          ]
    ).slice(0, 3);

    const stackHtml = frames
      .map(
        (f) => `
        <div class="mls-frame-card">
          <div class="mls-frame-func">${h(f.func)}</div>
          <div class="mls-vars-list">${(f.vars || []).map((v) => `<div class="mls-var-item">${h(v)}</div>`).join("")}</div>
        </div>`,
      )
      .join("\n");

    const heapHtml = heap
      .map(
        (hp) => `
        <div class="mls-heap-card">
          <span class="mls-heap-addr">${h(hp.addr)}</span>
          <div class="mls-heap-label">${h(hp.label)}</div>
        </div>`,
      )
      .join("\n");

    const pace = scheduleStepProgression("tl", 'scope.querySelectorAll(".mls-frame-card")', sDur, {
      accent: activePalette.accent,
    });

    return {
      innerHtml: `
        <div class="scene-inner mls-stage">
          <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || "VIRTUAL MEMORY ARCHITECTURE")}</span></div>
          <h1 id="s${i + 1}-title" class="editorial-title" style="font-size: ${isPortrait ? "46px" : "60px"}">${h(scene.title)}</h1>
          <div class="mls-columns-wrap">
            <div class="mls-col">
              <div class="mls-col-title">CALL STACK (LIFO)</div>
              <div class="mls-frames-group">
                ${stackHtml}
              </div>
            </div>
            <div class="mls-col">
              <div class="mls-col-title">DYNAMIC HEAP</div>
              <div class="mls-heap-group">
                ${heapHtml}
              </div>
            </div>
          </div>
        </div>
      `,
      gsapChoreography: `
        tl.from(scope.querySelector("#s${i + 1}-eyebrow"), { opacity: 0, y: 16, duration: 0.5 }, 0.2);
        tl.from(scope.querySelector("#s${i + 1}-title"), { opacity: 0, y: 22, duration: 0.6 }, 0.35);
        tl.from(scope.querySelectorAll(".mls-col"), { opacity: 0, y: 26, stagger: 0.14, duration: 0.55, ease: "power3.out" }, 0.55);
        ${pace}
      `,
    };
  },
  renderCss: ({ scene, isPortrait, activePalette }) => `
    [data-composition-id="${scene.id}"] .mls-stage { justify-content: center; align-items: center; text-align: center; }
    [data-composition-id="${scene.id}"] .mls-columns-wrap { display: flex; ${isPortrait ? "flex-direction: column;" : "flex-direction: row;"} gap: 32px; width: min(1360px, 86vw); margin-top: ${isPortrait ? "28px" : "48px"}; text-align: left; }
    [data-composition-id="${scene.id}"] .mls-col { flex: 1; padding: 28px 30px; border-radius: 20px; background: ${activePalette.card}; border: 1.5px solid ${activePalette.border}; }
    [data-composition-id="${scene.id}"] .mls-col-title { font-family: "JetBrains Mono", monospace; font-size: 16px; font-weight: 800; color: ${activePalette.accent}; letter-spacing: 0.08em; margin-bottom: 20px; }
    [data-composition-id="${scene.id}"] .mls-frames-group { display: flex; flex-direction: column; gap: 14px; }
    [data-composition-id="${scene.id}"] .mls-frame-card { padding: 18px 20px; border-radius: 12px; background: ${activePalette.background}; border: 1px solid ${activePalette.border}; }
    [data-composition-id="${scene.id}"] .mls-frame-func { font-family: "JetBrains Mono", monospace; font-size: 20px; font-weight: 800; color: ${activePalette.text}; }
    [data-composition-id="${scene.id}"] .mls-vars-list { display: flex; flex-direction: column; gap: 6px; margin-top: 10px; }
    [data-composition-id="${scene.id}"] .mls-var-item { font-family: "JetBrains Mono", monospace; font-size: 15px; color: ${activePalette.accent}; }
    [data-composition-id="${scene.id}"] .mls-heap-group { display: flex; flex-direction: column; gap: 14px; }
    [data-composition-id="${scene.id}"] .mls-heap-card { padding: 18px 20px; border-radius: 12px; background: ${activePalette.background}; border: 1px solid ${activePalette.border}; }
    [data-composition-id="${scene.id}"] .mls-heap-addr { font-family: "JetBrains Mono", monospace; font-size: 14px; font-weight: 800; color: ${activePalette.accent}; }
    [data-composition-id="${scene.id}"] .mls-heap-label { font-size: 19px; font-weight: 700; color: ${activePalette.text}; margin-top: 6px; }
  `,
});

// 39. DAG Pipeline (Task Dependency Flow)
registerArchetypeRenderer("dag-pipeline", {
  getBackground: ({ activePalette }) =>
    `background: radial-gradient(circle at 50% 30%, ${activePalette.accent}14 0%, transparent 60%), ${activePalette.background};`,
  renderHtml: ({ scene, i, isPortrait, h, sDur, activePalette }) => {
    const rawNodes = scene.dagData?.nodes;
    const nodes = (
      Array.isArray(rawNodes) && rawNodes.length >= 2
        ? rawNodes
        : [
            { id: "n1", label: "Extract Source", status: "done" },
            { id: "n2", label: "Feature Engine A", status: "running" },
            { id: "n3", label: "Feature Engine B", status: "running" },
            { id: "n4", label: "Deploy Artifact", status: "pending" },
          ]
    ).slice(0, 4);

    const nodesHtml = nodes
      .map((nd) => {
        const st = String(nd.status || "pending").toLowerCase();
        const isRunning = st === "running";
        return `
        <div class="dag-node-card dag-node-${st}">
          <div class="dag-node-head">
            <span class="dag-node-id">${h(nd.id)}</span>
            <span class="dag-status-pill dag-status-${st}">${st.toUpperCase()}</span>
          </div>
          <div class="dag-node-label">${h(nd.label)}</div>
          ${isRunning ? `<div class="dag-pulse-bar"></div>` : ""}
        </div>`;
      })
      .join("\n");

    const pace = scheduleStepProgression("tl", 'scope.querySelectorAll(".dag-node-card")', sDur, {
      accent: activePalette.accent,
    });

    return {
      innerHtml: `
        <div class="scene-inner dag-stage">
          <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || "DIRECTED ACYCLIC GRAPH")}</span></div>
          <h1 id="s${i + 1}-title" class="editorial-title" style="font-size: ${isPortrait ? "46px" : "60px"}">${h(scene.title)}</h1>
          <div class="dag-nodes-grid">
            ${nodesHtml}
          </div>
        </div>
      `,
      gsapChoreography: `
        tl.from(scope.querySelector("#s${i + 1}-eyebrow"), { opacity: 0, y: 16, duration: 0.5 }, 0.2);
        tl.from(scope.querySelector("#s${i + 1}-title"), { opacity: 0, y: 22, duration: 0.6 }, 0.35);
        tl.from(scope.querySelectorAll(".dag-node-card"), { opacity: 0, y: 26, stagger: 0.12, duration: 0.55, ease: "power3.out" }, 0.55);
        ${pace}
      `,
    };
  },
  renderCss: ({ scene, isPortrait, activePalette }) => `
    [data-composition-id="${scene.id}"] .dag-stage { justify-content: center; align-items: center; text-align: center; }
    [data-composition-id="${scene.id}"] .dag-nodes-grid { display: grid; grid-template-columns: ${isPortrait ? "1fr" : "repeat(2, 1fr)"}; gap: 24px; width: min(1360px, 86vw); margin-top: ${isPortrait ? "28px" : "48px"}; text-align: left; }
    [data-composition-id="${scene.id}"] .dag-node-card { position: relative; padding: 26px 28px; border-radius: 18px; background: ${activePalette.card}; border: 1.5px solid ${activePalette.border}; }
    [data-composition-id="${scene.id}"] .dag-node-running { border-color: ${activePalette.accent}; box-shadow: 0 0 28px ${activePalette.accent}24; }
    [data-composition-id="${scene.id}"] .dag-node-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    [data-composition-id="${scene.id}"] .dag-node-id { font-family: "JetBrains Mono", monospace; font-size: 15px; font-weight: 800; color: ${activePalette.textMuted || activePalette.text}; }
    [data-composition-id="${scene.id}"] .dag-status-pill { font-family: "JetBrains Mono", monospace; font-size: 13px; font-weight: 800; padding: 3px 10px; border-radius: 6px; }
    [data-composition-id="${scene.id}"] .dag-status-done { background: rgba(16, 185, 129, 0.15); color: #10b981; }
    [data-composition-id="${scene.id}"] .dag-status-running { background: ${activePalette.accent}22; color: ${activePalette.accent}; }
    [data-composition-id="${scene.id}"] .dag-status-pending { background: rgba(255, 255, 255, 0.08); color: ${activePalette.textMuted || "#888"}; }
    [data-composition-id="${scene.id}"] .dag-node-label { font-size: 24px; font-weight: 800; color: ${activePalette.text}; }
    [data-composition-id="${scene.id}"] .dag-pulse-bar { height: 3px; border-radius: 2px; background: ${activePalette.accent}; margin-top: 14px; animation: pulse 1.5s infinite; }
  `,
});

// 40. Event Bus Pub/Sub (Broker Stream)
registerArchetypeRenderer("event-bus-pubsub", {
  getBackground: ({ activePalette }) =>
    `background: radial-gradient(circle at 40% 40%, ${activePalette.accent}14 0%, transparent 60%), ${activePalette.background};`,
  renderHtml: ({ scene, i, isPortrait, h, sDur, activePalette }) => {
    const topic = scene.eventData?.topic || "user.events.v1";
    const rawEvents = scene.eventData?.events;
    const events = (
      Array.isArray(rawEvents) && rawEvents.length >= 2
        ? rawEvents
        : [
            { id: "evt-01", payload: "UserSignupVerified", targetConsumer: "Email Worker" },
            { id: "evt-02", payload: "BillingAccountCreated", targetConsumer: "Invoice Worker" },
            { id: "evt-03", payload: "AuditLogDispatched", targetConsumer: "Analytics Stream" },
          ]
    ).slice(0, 3);

    const eventsHtml = events
      .map(
        (ev) => `
        <div class="ebp-event-card">
          <div class="ebp-card-top">
            <span class="ebp-event-id">${h(ev.id)}</span>
            <span class="ebp-target-pill">--&gt; ${h(ev.targetConsumer)}</span>
          </div>
          <div class="ebp-event-payload">${h(ev.payload)}</div>
        </div>`,
      )
      .join("\n");

    const pace = scheduleStepProgression("tl", 'scope.querySelectorAll(".ebp-event-card")', sDur, {
      accent: activePalette.accent,
    });

    return {
      innerHtml: `
        <div class="scene-inner ebp-stage">
          <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || "EVENT-DRIVEN STREAMING BROKER")}</span></div>
          <h1 id="s${i + 1}-title" class="editorial-title" style="font-size: ${isPortrait ? "46px" : "60px"}">${h(scene.title)}</h1>
          <div class="ebp-topic-badge">
            <span class="ebp-topic-tag">TOPIC</span>
            <span class="ebp-topic-val">${h(topic)}</span>
          </div>
          <div class="ebp-events-list">
            ${eventsHtml}
          </div>
        </div>
      `,
      gsapChoreography: `
        tl.from(scope.querySelector("#s${i + 1}-eyebrow"), { opacity: 0, y: 16, duration: 0.5 }, 0.2);
        tl.from(scope.querySelector("#s${i + 1}-title"), { opacity: 0, y: 22, duration: 0.6 }, 0.35);
        tl.from(scope.querySelector(".ebp-topic-badge"), { opacity: 0, scale: 0.85, duration: 0.5 }, 0.5);
        tl.from(scope.querySelectorAll(".ebp-event-card"), { opacity: 0, y: 26, stagger: 0.12, duration: 0.55, ease: "power3.out" }, 0.65);
        ${pace}
      `,
    };
  },
  renderCss: ({ scene, isPortrait, activePalette }) => `
    [data-composition-id="${scene.id}"] .ebp-stage { justify-content: center; align-items: center; text-align: center; }
    [data-composition-id="${scene.id}"] .ebp-topic-badge { display: inline-flex; align-items: center; gap: 14px; padding: 10px 24px; border-radius: 999px; background: ${activePalette.card}; border: 1.5px solid ${activePalette.border}; margin: 24px auto 0; }
    [data-composition-id="${scene.id}"] .ebp-topic-tag { font-family: "JetBrains Mono", monospace; font-size: 14px; font-weight: 800; color: ${activePalette.accent}; letter-spacing: 0.08em; }
    [data-composition-id="${scene.id}"] .ebp-topic-val { font-family: "JetBrains Mono", monospace; font-size: 19px; font-weight: 700; color: ${activePalette.text}; }
    [data-composition-id="${scene.id}"] .ebp-events-list { display: flex; flex-direction: column; gap: 18px; width: min(1360px, 86vw); margin-top: ${isPortrait ? "28px" : "44px"}; }
    [data-composition-id="${scene.id}"] .ebp-event-card { padding: 22px 26px; border-radius: 16px; background: ${activePalette.card}; border: 1.5px solid ${activePalette.border}; text-align: left; }
    [data-composition-id="${scene.id}"] .ebp-card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
    [data-composition-id="${scene.id}"] .ebp-event-id { font-family: "JetBrains Mono", monospace; font-size: 15px; font-weight: 800; color: ${activePalette.accent}; }
    [data-composition-id="${scene.id}"] .ebp-target-pill { font-family: "JetBrains Mono", monospace; font-size: 14px; font-weight: 700; color: ${activePalette.textMuted || activePalette.text}; }
    [data-composition-id="${scene.id}"] .ebp-event-payload { font-family: "JetBrains Mono", monospace; font-size: 22px; font-weight: 800; color: ${activePalette.text}; }
  `,
});

// 41. Compiler AST (Hierarchical Syntax Tree)
registerArchetypeRenderer("compiler-ast", {
  getBackground: ({ activePalette }) =>
    `background: radial-gradient(circle at 50% 25%, ${activePalette.accent}14 0%, transparent 60%), ${activePalette.background};`,
  renderHtml: ({ scene, i, isPortrait, h, sDur, activePalette }) => {
    const rootLabel = scene.astData?.root?.label || "Program (AST)";
    const rawChildren = scene.astData?.root?.children;
    const branches = (
      Array.isArray(rawChildren) && rawChildren.length >= 2
        ? rawChildren
        : [
            {
              label: "BinaryExpr (+)",
              children: [{ label: "Var (x)" }, { label: "Literal (42)" }],
            },
            { label: "ReturnStmt", children: [{ label: "Identifier (res)" }] },
          ]
    ).slice(0, 3);

    const branchesHtml = branches
      .map(
        (br) => `
        <div class="ast-branch-card">
          <div class="ast-branch-title">${h(br.label)}</div>
          <div class="ast-leaves-group">
            ${(br.children || []).map((ch) => `<div class="ast-leaf-item">${h(ch.label)}</div>`).join("")}
          </div>
        </div>`,
      )
      .join("\n");

    const pace = scheduleStepProgression("tl", 'scope.querySelectorAll(".ast-branch-card")', sDur, {
      accent: activePalette.accent,
    });

    return {
      innerHtml: `
        <div class="scene-inner ast-stage">
          <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || "ABSTRACT SYNTAX TREE")}</span></div>
          <h1 id="s${i + 1}-title" class="editorial-title" style="font-size: ${isPortrait ? "46px" : "60px"}">${h(scene.title)}</h1>
          <div class="ast-root-badge">
            <span class="ast-root-node">${h(rootLabel)}</span>
          </div>
          <div class="ast-branches-grid">
            ${branchesHtml}
          </div>
        </div>
      `,
      gsapChoreography: `
        tl.from(scope.querySelector("#s${i + 1}-eyebrow"), { opacity: 0, y: 16, duration: 0.5 }, 0.2);
        tl.from(scope.querySelector("#s${i + 1}-title"), { opacity: 0, y: 22, duration: 0.6 }, 0.35);
        tl.from(scope.querySelector(".ast-root-badge"), { opacity: 0, scale: 0.8, duration: 0.5 }, 0.5);
        tl.from(scope.querySelectorAll(".ast-branch-card"), { opacity: 0, y: 26, stagger: 0.12, duration: 0.55, ease: "power3.out" }, 0.65);
        ${pace}
      `,
    };
  },
  renderCss: ({ scene, isPortrait, activePalette }) => `
    [data-composition-id="${scene.id}"] .ast-stage { justify-content: center; align-items: center; text-align: center; }
    [data-composition-id="${scene.id}"] .ast-root-badge { display: inline-flex; align-items: center; padding: 12px 32px; border-radius: 999px; background: ${activePalette.card}; border: 2px solid ${activePalette.accent}; box-shadow: 0 0 28px ${activePalette.accent}26; margin-top: 28px; }
    [data-composition-id="${scene.id}"] .ast-root-node { font-family: "JetBrains Mono", monospace; font-size: 22px; font-weight: 800; color: ${activePalette.text}; }
    [data-composition-id="${scene.id}"] .ast-branches-grid { display: flex; ${isPortrait ? "flex-direction: column;" : "flex-direction: row;"} gap: 24px; width: min(1360px, 86vw); margin-top: ${isPortrait ? "28px" : "48px"}; text-align: left; }
    [data-composition-id="${scene.id}"] .ast-branch-card { flex: 1; padding: 26px 28px; border-radius: 18px; background: ${activePalette.card}; border: 1.5px solid ${activePalette.border}; }
    [data-composition-id="${scene.id}"] .ast-branch-title { font-family: "JetBrains Mono", monospace; font-size: 21px; font-weight: 800; color: ${activePalette.accent}; margin-bottom: 18px; }
    [data-composition-id="${scene.id}"] .ast-leaves-group { display: flex; flex-direction: column; gap: 10px; }
    [data-composition-id="${scene.id}"] .ast-leaf-item { padding: 12px 16px; border-radius: 10px; background: ${activePalette.background}; border: 1px solid ${activePalette.border}; font-family: "JetBrains Mono", monospace; font-size: 16px; font-weight: 700; color: ${activePalette.text}; }
  `,
});

// 42. Raft Consensus (Quorum Cluster)
registerArchetypeRenderer("raft-consensus", {
  getBackground: ({ activePalette }) =>
    `background: radial-gradient(circle at 50% 30%, ${activePalette.accent}16 0%, transparent 60%), ${activePalette.background};`,
  renderHtml: ({ scene, i, isPortrait, h, sDur, activePalette }) => {
    const rawNodes = scene.consensusData?.nodes;
    const nodes = (
      Array.isArray(rawNodes) && rawNodes.length >= 2
        ? rawNodes
        : [
            { id: "node-1", role: "leader", term: 3, logIndex: 42 },
            { id: "node-2", role: "follower", term: 3, logIndex: 42 },
            { id: "node-3", role: "follower", term: 3, logIndex: 41 },
          ]
    ).slice(0, 3);

    const nodesHtml = nodes
      .map((nd) => {
        const isLeader = nd.role === "leader";
        return `
        <div class="raft-node-card ${isLeader ? "raft-leader-card" : ""}">
          <div class="raft-node-head">
            <span class="raft-role-badge raft-role-${nd.role}">${String(nd.role).toUpperCase()}</span>
            <span class="raft-term-badge">TERM ${nd.term}</span>
          </div>
          <div class="raft-node-id">${h(nd.id)}</div>
          <div class="raft-log-index">Commit Index: <span class="raft-idx-num">${nd.logIndex}</span></div>
        </div>`;
      })
      .join("\n");

    const pace = scheduleStepProgression("tl", 'scope.querySelectorAll(".raft-node-card")', sDur, {
      accent: activePalette.accent,
    });

    return {
      innerHtml: `
        <div class="scene-inner raft-stage">
          <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || "DISTRIBUTED RAFT CONSENSUS")}</span></div>
          <h1 id="s${i + 1}-title" class="editorial-title" style="font-size: ${isPortrait ? "46px" : "60px"}">${h(scene.title)}</h1>
          <div class="raft-nodes-grid">
            ${nodesHtml}
          </div>
        </div>
      `,
      gsapChoreography: `
        tl.from(scope.querySelector("#s${i + 1}-eyebrow"), { opacity: 0, y: 16, duration: 0.5 }, 0.2);
        tl.from(scope.querySelector("#s${i + 1}-title"), { opacity: 0, y: 22, duration: 0.6 }, 0.35);
        tl.from(scope.querySelectorAll(".raft-node-card"), { opacity: 0, scale: 0.85, stagger: 0.14, duration: 0.55, ease: "back.out(1.4)" }, 0.55);
        ${pace}
      `,
    };
  },
  renderCss: ({ scene, isPortrait, activePalette }) => `
    [data-composition-id="${scene.id}"] .raft-stage { justify-content: center; align-items: center; text-align: center; }
    [data-composition-id="${scene.id}"] .raft-nodes-grid { display: grid; grid-template-columns: ${isPortrait ? "1fr" : "repeat(3, 1fr)"}; gap: 24px; width: min(1360px, 86vw); margin-top: ${isPortrait ? "28px" : "52px"}; text-align: left; }
    [data-composition-id="${scene.id}"] .raft-node-card { padding: 32px 28px; border-radius: 20px; background: ${activePalette.card}; border: 1.5px solid ${activePalette.border}; }
    [data-composition-id="${scene.id}"] .raft-leader-card { border-color: ${activePalette.accent}; box-shadow: 0 0 32px ${activePalette.accent}28; }
    [data-composition-id="${scene.id}"] .raft-node-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
    [data-composition-id="${scene.id}"] .raft-role-badge { font-family: "JetBrains Mono", monospace; font-size: 13px; font-weight: 800; padding: 4px 10px; border-radius: 6px; }
    [data-composition-id="${scene.id}"] .raft-role-leader { background: ${activePalette.accent}22; color: ${activePalette.accent}; }
    [data-composition-id="${scene.id}"] .raft-role-follower { background: rgba(255, 255, 255, 0.08); color: ${activePalette.textMuted || "#888"}; }
    [data-composition-id="${scene.id}"] .raft-term-badge { font-family: "JetBrains Mono", monospace; font-size: 13px; font-weight: 700; color: ${activePalette.textMuted || activePalette.text}; }
    [data-composition-id="${scene.id}"] .raft-node-id { font-size: 28px; font-weight: 900; color: ${activePalette.text}; }
    [data-composition-id="${scene.id}"] .raft-log-index { font-family: "JetBrains Mono", monospace; font-size: 17px; color: ${activePalette.textMuted || activePalette.text}; margin-top: 14px; }
    [data-composition-id="${scene.id}"] .raft-idx-num { font-weight: 800; color: ${activePalette.text}; }
  `,
});

// 43. Git Branch Graph
registerArchetypeRenderer("git-branch-graph", {
  getBackground: ({ activePalette }) =>
    `background: radial-gradient(circle at 50% 25%, ${activePalette.accent}14 0%, transparent 60%), ${activePalette.background};`,
  renderHtml: ({ scene, i, isPortrait, h, sDur, activePalette }) => {
    const rawCommits = scene.gitData?.commits;
    const commits = (
      Array.isArray(rawCommits) && rawCommits.length >= 2
        ? rawCommits
        : [
            { id: "c1", branch: "main", message: synthesizeFallbackText(scene, "step", 0) },
            { id: "c2", branch: "feature", message: synthesizeFallbackText(scene, "step", 1) },
            {
              id: "c3",
              branch: "main",
              message: synthesizeFallbackText(scene, "step", 2),
              isMerge: true,
            },
          ]
    ).slice(0, 4);

    const commitsHtml = commits
      .map((c, idx) => {
        const isMain = c.branch === "main";
        return `
        <div class="git-commit-node ${c.isMerge ? "git-merge-node" : ""}">
          <div class="git-node-dot" style="background: ${isMain ? activePalette.accent : activePalette.accent2 || activePalette.accent};"></div>
          <div class="git-node-content">
            <div class="git-sha-row">
              <span class="git-sha-badge">${h(c.id || `c${idx + 1}`)}</span>
              <span class="git-branch-pill">${h(c.branch || "main")}</span>
              ${c.isMerge ? `<span class="git-merge-pill">MERGE</span>` : ""}
            </div>
            <div class="git-commit-msg">${h(c.message || "Commit")}</div>
          </div>
        </div>`;
      })
      .join("\n");

    const pace = scheduleStepProgression("tl", 'scope.querySelectorAll(".git-commit-node")', sDur, {
      accent: activePalette.accent,
    });

    return {
      innerHtml: `
        <div class="scene-inner git-stage">
          <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || "VERSION CONTROL GRAPH")}</span></div>
          <h1 id="s${i + 1}-title" class="editorial-title" style="font-size: ${isPortrait ? "46px" : "60px"}">${h(scene.title)}</h1>
          <div class="git-graph-container">
            <div class="git-line-track"></div>
            ${commitsHtml}
          </div>
        </div>
      `,
      gsapChoreography: `
        tl.from(scope.querySelector("#s${i + 1}-eyebrow"), { opacity: 0, y: 16, duration: 0.5 }, 0.2);
        tl.from(scope.querySelector("#s${i + 1}-title"), { opacity: 0, y: 22, duration: 0.6 }, 0.35);
        tl.from(scope.querySelectorAll(".git-commit-node"), { opacity: 0, x: -24, stagger: 0.14, duration: 0.55, ease: "power3.out" }, 0.55);
        ${pace}
      `,
    };
  },
  renderCss: ({ scene, isPortrait, activePalette }) => `
    [data-composition-id="${scene.id}"] .git-stage { justify-content: center; align-items: center; text-align: center; }
    [data-composition-id="${scene.id}"] .git-graph-container { position: relative; width: min(1200px, 86vw); margin-top: ${isPortrait ? "24px" : "48px"}; display: flex; flex-direction: column; gap: 20px; text-align: left; }
    [data-composition-id="${scene.id}"] .git-commit-node { display: flex; align-items: center; gap: 24px; padding: 20px 24px; border-radius: 16px; background: ${activePalette.card}; border: 1.5px solid ${activePalette.border}; }
    [data-composition-id="${scene.id}"] .git-merge-node { border-color: ${activePalette.accent}; box-shadow: 0 0 24px ${activePalette.accent}20; }
    [data-composition-id="${scene.id}"] .git-node-dot { width: 18px; height: 18px; border-radius: 50%; box-shadow: 0 0 12px currentColor; flex-shrink: 0; }
    [data-composition-id="${scene.id}"] .git-node-content { flex: 1; }
    [data-composition-id="${scene.id}"] .git-sha-row { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
    [data-composition-id="${scene.id}"] .git-sha-badge { font-family: "JetBrains Mono", monospace; font-size: 14px; font-weight: 800; color: ${activePalette.accent}; }
    [data-composition-id="${scene.id}"] .git-branch-pill { font-family: "JetBrains Mono", monospace; font-size: 12px; font-weight: 700; padding: 2px 8px; border-radius: 4px; background: rgba(255, 255, 255, 0.08); color: ${activePalette.text}; }
    [data-composition-id="${scene.id}"] .git-merge-pill { font-family: "JetBrains Mono", monospace; font-size: 11px; font-weight: 800; padding: 2px 6px; border-radius: 4px; background: ${activePalette.accent}26; color: ${activePalette.accent}; }
    [data-composition-id="${scene.id}"] .git-commit-msg { font-size: 20px; font-weight: 700; color: ${activePalette.text}; }
  `,
});

// 44. Browser DevTools
registerArchetypeRenderer("browser-devtools", {
  getBackground: ({ activePalette }) =>
    `background: radial-gradient(circle at 50% 25%, ${activePalette.accent}12 0%, transparent 60%), ${activePalette.background};`,
  renderHtml: ({ scene, i, isPortrait, h, sDur, activePalette }) => {
    const rawReqs = scene.devtoolsData?.requests;
    const reqs = (
      Array.isArray(rawReqs) && rawReqs.length >= 2
        ? rawReqs
        : [
            { path: "/api/v1/auth", method: "POST", status: 200, durationMs: 42 },
            { path: "/api/v1/stream", method: "GET", status: 200, durationMs: 128 },
            { path: "/assets/runtime.js", method: "GET", status: 200, durationMs: 18 },
          ]
    ).slice(0, 4);

    const rowsHtml = reqs
      .map(
        (r) => `
      <div class="devtools-row">
        <span class="dt-method dt-method-${r.method.toLowerCase()}">${h(r.method)}</span>
        <span class="dt-status dt-status-200">${r.status}</span>
        <span class="dt-path">${h(r.path)}</span>
        <div class="dt-latency-wrap">
          <div class="dt-latency-bar" style="width: ${Math.min(100, (r.durationMs / 150) * 100)}%;"></div>
          <span class="dt-ms">${r.durationMs}ms</span>
        </div>
      </div>`,
      )
      .join("\n");

    const pace = scheduleStepProgression("tl", 'scope.querySelectorAll(".devtools-row")', sDur, {
      accent: activePalette.accent,
    });

    return {
      innerHtml: `
        <div class="scene-inner devtools-stage">
          <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || "DEVELOPER TOOLS INSPECTOR")}</span></div>
          <h1 id="s${i + 1}-title" class="editorial-title" style="font-size: ${isPortrait ? "46px" : "60px"}">${h(scene.title)}</h1>
          <div class="devtools-window">
            <div class="devtools-chrome">
              <div class="dt-dots"><span class="dt-dot"></span><span class="dt-dot"></span><span class="dt-dot"></span></div>
              <div class="dt-tabs">
                <span class="dt-tab dt-tab-active">Network</span>
                <span class="dt-tab">Console</span>
                <span class="dt-tab">Elements</span>
              </div>
            </div>
            <div class="devtools-table">
              <div class="dt-table-head">
                <span>METHOD</span><span>STATUS</span><span>PATH</span><span>LATENCY</span>
              </div>
              ${rowsHtml}
            </div>
          </div>
        </div>
      `,
      gsapChoreography: `
        tl.from(scope.querySelector("#s${i + 1}-eyebrow"), { opacity: 0, y: 16, duration: 0.5 }, 0.2);
        tl.from(scope.querySelector("#s${i + 1}-title"), { opacity: 0, y: 22, duration: 0.6 }, 0.35);
        tl.from(scope.querySelector(".devtools-window"), { opacity: 0, y: 28, duration: 0.6, ease: "power3.out" }, 0.5);
        ${pace}
      `,
    };
  },
  renderCss: ({ scene, isPortrait, activePalette }) => `
    [data-composition-id="${scene.id}"] .devtools-stage { justify-content: center; align-items: center; text-align: center; }
    [data-composition-id="${scene.id}"] .devtools-window { width: min(1280px, 86vw); margin-top: ${isPortrait ? "24px" : "44px"}; border-radius: 18px; background: ${activePalette.card}; border: 1.5px solid ${activePalette.border}; overflow: hidden; text-align: left; box-shadow: 0 20px 50px rgba(0,0,0,0.3); }
    [data-composition-id="${scene.id}"] .devtools-chrome { display: flex; align-items: center; gap: 24px; padding: 16px 20px; background: rgba(0, 0, 0, 0.25); border-bottom: 1.5px solid ${activePalette.border}; }
    [data-composition-id="${scene.id}"] .dt-dots { display: flex; gap: 8px; }
    [data-composition-id="${scene.id}"] .dt-dot { width: 12px; height: 12px; border-radius: 50%; background: ${activePalette.border}; }
    [data-composition-id="${scene.id}"] .dt-tabs { display: flex; gap: 12px; }
    [data-composition-id="${scene.id}"] .dt-tab { font-family: "JetBrains Mono", monospace; font-size: 14px; font-weight: 700; padding: 6px 14px; border-radius: 6px; color: ${activePalette.textMuted || "#888"}; }
    [data-composition-id="${scene.id}"] .dt-tab-active { background: ${activePalette.accent}20; color: ${activePalette.accent}; }
    [data-composition-id="${scene.id}"] .devtools-table { padding: 16px 24px; display: flex; flex-direction: column; gap: 12px; }
    [data-composition-id="${scene.id}"] .dt-table-head { display: grid; grid-template-columns: 90px 80px 1fr 180px; font-family: "JetBrains Mono", monospace; font-size: 13px; font-weight: 800; color: ${activePalette.textMuted || "#888"}; padding-bottom: 10px; border-bottom: 1px solid ${activePalette.border}; }
    [data-composition-id="${scene.id}"] .devtools-row { display: grid; grid-template-columns: 90px 80px 1fr 180px; align-items: center; padding: 14px 12px; border-radius: 10px; background: rgba(255, 255, 255, 0.02); }
    [data-composition-id="${scene.id}"] .dt-method { font-family: "JetBrains Mono", monospace; font-size: 13px; font-weight: 800; }
    [data-composition-id="${scene.id}"] .dt-method-post { color: ${activePalette.accent}; }
    [data-composition-id="${scene.id}"] .dt-method-get { color: ${activePalette.accent2 || activePalette.accent}; }
    [data-composition-id="${scene.id}"] .dt-status-200 { font-family: "JetBrains Mono", monospace; font-size: 14px; font-weight: 800; color: #4ade80; }
    [data-composition-id="${scene.id}"] .dt-path { font-family: "JetBrains Mono", monospace; font-size: 17px; font-weight: 600; color: ${activePalette.text}; }
    [data-composition-id="${scene.id}"] .dt-latency-wrap { display: flex; align-items: center; gap: 12px; }
    [data-composition-id="${scene.id}"] .dt-latency-bar { height: 8px; border-radius: 4px; background: ${activePalette.accent}; }
    [data-composition-id="${scene.id}"] .dt-ms { font-family: "JetBrains Mono", monospace; font-size: 13px; color: ${activePalette.textMuted || activePalette.text}; }
  `,
});

// 45. Security Threat Model
registerArchetypeRenderer("security-threat-model", {
  getBackground: ({ activePalette }) =>
    `background: radial-gradient(circle at 50% 25%, ${activePalette.accent}14 0%, transparent 60%), ${activePalette.background};`,
  renderHtml: ({ scene, i, isPortrait, h, sDur, activePalette }) => {
    const rawThreats = scene.securityData?.threats;
    const threats = (
      Array.isArray(rawThreats) && rawThreats.length >= 2
        ? rawThreats
        : [
            { label: synthesizeFallbackText(scene, "step", 0), blocked: true },
            { label: synthesizeFallbackText(scene, "step", 1), blocked: false },
            { label: synthesizeFallbackText(scene, "step", 2), blocked: true },
          ]
    ).slice(0, 3);

    const threatsHtml = threats
      .map(
        (t) => `
      <div class="threat-card ${t.blocked ? "threat-blocked" : "threat-flagged"}">
        <div class="threat-shield">${t.blocked ? "🛡️" : "⚠️"}</div>
        <div class="threat-content">
          <div class="threat-status">${t.blocked ? "THREAT MITIGATED" : "INSPECTION GATEWAY"}</div>
          <div class="threat-label">${h(t.label)}</div>
        </div>
      </div>`,
      )
      .join("\n");

    const pace = scheduleStepProgression("tl", 'scope.querySelectorAll(".threat-card")', sDur, {
      accent: activePalette.accent,
    });

    return {
      innerHtml: `
        <div class="scene-inner sec-stage">
          <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || "ZERO-TRUST PERIMETER")}</span></div>
          <h1 id="s${i + 1}-title" class="editorial-title" style="font-size: ${isPortrait ? "46px" : "60px"}">${h(scene.title)}</h1>
          <div class="sec-grid">
            ${threatsHtml}
          </div>
        </div>
      `,
      gsapChoreography: `
        tl.from(scope.querySelector("#s${i + 1}-eyebrow"), { opacity: 0, y: 16, duration: 0.5 }, 0.2);
        tl.from(scope.querySelector("#s${i + 1}-title"), { opacity: 0, y: 22, duration: 0.6 }, 0.35);
        tl.from(scope.querySelectorAll(".threat-card"), { opacity: 0, y: 24, stagger: 0.14, duration: 0.55, ease: "power3.out" }, 0.55);
        ${pace}
      `,
    };
  },
  renderCss: ({ scene, isPortrait, activePalette }) => `
    [data-composition-id="${scene.id}"] .sec-stage { justify-content: center; align-items: center; text-align: center; }
    [data-composition-id="${scene.id}"] .sec-grid { display: grid; grid-template-columns: ${isPortrait ? "1fr" : "repeat(3, 1fr)"}; gap: 24px; width: min(1360px, 86vw); margin-top: ${isPortrait ? "28px" : "50px"}; text-align: left; }
    [data-composition-id="${scene.id}"] .threat-card { display: flex; align-items: center; gap: 20px; padding: 28px 24px; border-radius: 18px; background: ${activePalette.card}; border: 1.5px solid ${activePalette.border}; }
    [data-composition-id="${scene.id}"] .threat-blocked { border-color: ${activePalette.accent}; box-shadow: 0 0 28px ${activePalette.accent}20; }
    [data-composition-id="${scene.id}"] .threat-flagged { border-color: #f59e0b; }
    [data-composition-id="${scene.id}"] .threat-shield { font-size: 32px; }
    [data-composition-id="${scene.id}"] .threat-status { font-family: "JetBrains Mono", monospace; font-size: 12px; font-weight: 800; color: ${activePalette.accent}; margin-bottom: 6px; }
    [data-composition-id="${scene.id}"] .threat-flagged .threat-status { color: #f59e0b; }
    [data-composition-id="${scene.id}"] .threat-label { font-size: 20px; font-weight: 700; color: ${activePalette.text}; }
  `,
});

// 46. Kanban Sprint Board
registerArchetypeRenderer("kanban-sprint", {
  getBackground: ({ activePalette }) =>
    `background: radial-gradient(circle at 50% 25%, ${activePalette.accent}14 0%, transparent 60%), ${activePalette.background};`,
  renderHtml: ({ scene, i, isPortrait, h, sDur, activePalette }) => {
    const rawCols = scene.kanbanData?.columns;
    const cols = (
      Array.isArray(rawCols) && rawCols.length >= 2
        ? rawCols
        : [
            {
              name: "Backlog",
              cards: [{ title: synthesizeFallbackText(scene, "step", 0), tag: "3d" }],
            },
            {
              name: "In Progress",
              cards: [{ title: synthesizeFallbackText(scene, "step", 1), tag: "2d" }],
            },
            {
              name: "Done",
              cards: [{ title: synthesizeFallbackText(scene, "step", 2), tag: "1d" }],
            },
          ]
    ).slice(0, 3);

    const colsHtml = cols
      .map((col) => {
        const cardsHtml = (col.cards || [])
          .map(
            (cd) => `
          <div class="kanban-card">
            <div class="kanban-card-title">${h(cd.title)}</div>
            <div class="kanban-card-tag">${h(cd.tag || cd.estimate || "Sprint")}</div>
          </div>`,
          )
          .join("\n");

        return `
        <div class="kanban-col">
          <div class="kanban-col-head">
            <span class="kanban-col-name">${h(col.name)}</span>
            <span class="kanban-col-count">${col.cards?.length || 0}</span>
          </div>
          <div class="kanban-col-body">
            ${cardsHtml}
          </div>
        </div>`;
      })
      .join("\n");

    const pace = scheduleStepProgression("tl", 'scope.querySelectorAll(".kanban-card")', sDur, {
      accent: activePalette.accent,
    });

    return {
      innerHtml: `
        <div class="scene-inner kanban-stage">
          <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || "SPRINT EXECUTION BOARD")}</span></div>
          <h1 id="s${i + 1}-title" class="editorial-title" style="font-size: ${isPortrait ? "46px" : "60px"}">${h(scene.title)}</h1>
          <div class="kanban-board">
            ${colsHtml}
          </div>
        </div>
      `,
      gsapChoreography: `
        tl.from(scope.querySelector("#s${i + 1}-eyebrow"), { opacity: 0, y: 16, duration: 0.5 }, 0.2);
        tl.from(scope.querySelector("#s${i + 1}-title"), { opacity: 0, y: 22, duration: 0.6 }, 0.35);
        tl.from(scope.querySelectorAll(".kanban-col"), { opacity: 0, y: 30, stagger: 0.12, duration: 0.55, ease: "power3.out" }, 0.55);
        ${pace}
      `,
    };
  },
  renderCss: ({ scene, isPortrait, activePalette }) => `
    [data-composition-id="${scene.id}"] .kanban-stage { justify-content: center; align-items: center; text-align: center; }
    [data-composition-id="${scene.id}"] .kanban-board { display: grid; grid-template-columns: ${isPortrait ? "1fr" : "repeat(3, 1fr)"}; gap: 24px; width: min(1360px, 86vw); margin-top: ${isPortrait ? "24px" : "48px"}; text-align: left; }
    [data-composition-id="${scene.id}"] .kanban-col { padding: 22px 20px; border-radius: 18px; background: rgba(255, 255, 255, 0.03); border: 1.5px solid ${activePalette.border}; }
    [data-composition-id="${scene.id}"] .kanban-col-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
    [data-composition-id="${scene.id}"] .kanban-col-name { font-family: "JetBrains Mono", monospace; font-size: 15px; font-weight: 800; color: ${activePalette.text}; }
    [data-composition-id="${scene.id}"] .kanban-col-count { font-family: "JetBrains Mono", monospace; font-size: 13px; font-weight: 700; padding: 2px 8px; border-radius: 10px; background: rgba(255, 255, 255, 0.08); color: ${activePalette.textMuted || activePalette.text}; }
    [data-composition-id="${scene.id}"] .kanban-col-body { display: flex; flex-direction: column; gap: 14px; }
    [data-composition-id="${scene.id}"] .kanban-card { padding: 18px 20px; border-radius: 14px; background: ${activePalette.card}; border: 1.5px solid ${activePalette.border}; }
    [data-composition-id="${scene.id}"] .kanban-card-title { font-size: 18px; font-weight: 700; color: ${activePalette.text}; margin-bottom: 12px; }
    [data-composition-id="${scene.id}"] .kanban-card-tag { display: inline-block; font-family: "JetBrains Mono", monospace; font-size: 12px; font-weight: 800; padding: 2px 8px; border-radius: 4px; background: ${activePalette.accent}20; color: ${activePalette.accent}; }
  `,
});

// 47. Changelog Timeline
registerArchetypeRenderer("changelog-timeline", {
  getBackground: ({ activePalette }) =>
    `background: radial-gradient(circle at 50% 25%, ${activePalette.accent}14 0%, transparent 60%), ${activePalette.background};`,
  renderHtml: ({ scene, i, isPortrait, h, sDur, activePalette }) => {
    const rawRels = scene.changelogData?.releases;
    const rels = (
      Array.isArray(rawRels) && rawRels.length >= 2
        ? rawRels
        : [
            {
              version: "v2.0",
              date: "Latest",
              highlights: [
                synthesizeFallbackText(scene, "step", 0),
                synthesizeFallbackText(scene, "step", 1),
              ],
              isLatest: true,
            },
            {
              version: "v1.9",
              date: "Stable",
              highlights: [synthesizeFallbackText(scene, "step", 2)],
              isLatest: false,
            },
          ]
    ).slice(0, 3);

    const relsHtml = rels
      .map((rel) => {
        const bulletsHtml = (rel.highlights || [])
          .map((b) => `<li class="cl-bullet">${h(b)}</li>`)
          .join("\n");

        return `
        <div class="changelog-item ${rel.isLatest ? "cl-latest" : ""}">
          <div class="cl-badge-col">
            <span class="cl-ver-pill">${h(rel.version)}</span>
            <span class="cl-date">${h(rel.date)}</span>
          </div>
          <div class="cl-card">
            <ul class="cl-list">
              ${bulletsHtml}
            </ul>
          </div>
        </div>`;
      })
      .join("\n");

    const pace = scheduleStepProgression("tl", 'scope.querySelectorAll(".changelog-item")', sDur, {
      accent: activePalette.accent,
    });

    return {
      innerHtml: `
        <div class="scene-inner cl-stage">
          <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || "PRODUCT RELEASE HISTORY")}</span></div>
          <h1 id="s${i + 1}-title" class="editorial-title" style="font-size: ${isPortrait ? "46px" : "60px"}">${h(scene.title)}</h1>
          <div class="changelog-timeline">
            ${relsHtml}
          </div>
        </div>
      `,
      gsapChoreography: `
        tl.from(scope.querySelector("#s${i + 1}-eyebrow"), { opacity: 0, y: 16, duration: 0.5 }, 0.2);
        tl.from(scope.querySelector("#s${i + 1}-title"), { opacity: 0, y: 22, duration: 0.6 }, 0.35);
        tl.from(scope.querySelectorAll(".changelog-item"), { opacity: 0, x: -30, stagger: 0.15, duration: 0.55, ease: "power3.out" }, 0.55);
        ${pace}
      `,
    };
  },
  renderCss: ({ scene, isPortrait, activePalette }) => `
    [data-composition-id="${scene.id}"] .cl-stage { justify-content: center; align-items: center; text-align: center; }
    [data-composition-id="${scene.id}"] .changelog-timeline { display: flex; flex-direction: column; gap: 20px; width: min(1200px, 86vw); margin-top: ${isPortrait ? "24px" : "48px"}; text-align: left; }
    [data-composition-id="${scene.id}"] .changelog-item { display: flex; gap: 28px; align-items: flex-start; }
    [data-composition-id="${scene.id}"] .cl-badge-col { display: flex; flex-direction: column; gap: 6px; width: 140px; flex-shrink: 0; }
    [data-composition-id="${scene.id}"] .cl-ver-pill { font-family: "JetBrains Mono", monospace; font-size: 18px; font-weight: 900; color: ${activePalette.accent}; }
    [data-composition-id="${scene.id}"] .cl-date { font-family: "JetBrains Mono", monospace; font-size: 13px; color: ${activePalette.textMuted || activePalette.text}; }
    [data-composition-id="${scene.id}"] .cl-card { flex: 1; padding: 22px 28px; border-radius: 16px; background: ${activePalette.card}; border: 1.5px solid ${activePalette.border}; }
    [data-composition-id="${scene.id}"] .cl-latest .cl-card { border-color: ${activePalette.accent}; box-shadow: 0 0 28px ${activePalette.accent}20; }
    [data-composition-id="${scene.id}"] .cl-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
    [data-composition-id="${scene.id}"] .cl-bullet { font-size: 19px; font-weight: 600; color: ${activePalette.text}; }
  `,
});

// 48. Circuit Breaker Status
registerArchetypeRenderer("circuit-breaker-status", {
  getBackground: ({ activePalette }) =>
    `background: radial-gradient(circle at 50% 25%, ${activePalette.accent}14 0%, transparent 60%), ${activePalette.background};`,
  renderHtml: ({ scene, i, isPortrait, h, sDur, activePalette }) => {
    const rawState = scene.circuitData?.state || "closed";
    const failRate = scene.circuitData?.failureRate || 0.02;
    const thresh = scene.circuitData?.threshold || 0.05;

    const states = [
      { id: "closed", name: "CLOSED", label: "Normal Flow", active: rawState === "closed" },
      {
        id: "half-open",
        name: "HALF-OPEN",
        label: "Trial Probing",
        active: rawState === "half-open",
      },
      { id: "open", name: "OPEN", label: "Fail-Fast Protection", active: rawState === "open" },
    ];

    const statesHtml = states
      .map(
        (st) => `
      <div class="circuit-state-card ${st.active ? "circuit-state-active" : ""}">
        <div class="circuit-state-head">
          <span class="circuit-indicator"></span>
          <span class="circuit-state-name">${st.name}</span>
        </div>
        <div class="circuit-state-desc">${st.label}</div>
      </div>`,
      )
      .join("\n");

    const pace = scheduleStepProgression(
      "tl",
      'scope.querySelectorAll(".circuit-state-card")',
      sDur,
      {
        accent: activePalette.accent,
      },
    );

    return {
      innerHtml: `
        <div class="scene-inner circuit-stage">
          <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || "RESILIENCE PATTERN")}</span></div>
          <h1 id="s${i + 1}-title" class="editorial-title" style="font-size: ${isPortrait ? "46px" : "60px"}">${h(scene.title)}</h1>
          <div class="circuit-states-grid">
            ${statesHtml}
          </div>
          <div class="circuit-metric-hud">
            <div class="circuit-hud-item">
              <span class="circuit-hud-label">ERROR RATE</span>
              <span class="circuit-hud-val">${(failRate * 100).toFixed(1)}%</span>
            </div>
            <div class="circuit-hud-sep"></div>
            <div class="circuit-hud-item">
              <span class="circuit-hud-label">TRIP THRESHOLD</span>
              <span class="circuit-hud-val">${(thresh * 100).toFixed(1)}%</span>
            </div>
          </div>
        </div>
      `,
      gsapChoreography: `
        tl.from(scope.querySelector("#s${i + 1}-eyebrow"), { opacity: 0, y: 16, duration: 0.5 }, 0.2);
        tl.from(scope.querySelector("#s${i + 1}-title"), { opacity: 0, y: 22, duration: 0.6 }, 0.35);
        tl.from(scope.querySelectorAll(".circuit-state-card"), { opacity: 0, scale: 0.9, stagger: 0.12, duration: 0.55, ease: "back.out(1.4)" }, 0.55);
        tl.from(scope.querySelector(".circuit-metric-hud"), { opacity: 0, y: 20, duration: 0.5 }, 0.7);
        ${pace}
      `,
    };
  },
  renderCss: ({ scene, isPortrait, activePalette }) => `
    [data-composition-id="${scene.id}"] .circuit-stage { justify-content: center; align-items: center; text-align: center; }
    [data-composition-id="${scene.id}"] .circuit-states-grid { display: grid; grid-template-columns: ${isPortrait ? "1fr" : "repeat(3, 1fr)"}; gap: 24px; width: min(1360px, 86vw); margin-top: ${isPortrait ? "24px" : "48px"}; text-align: left; }
    [data-composition-id="${scene.id}"] .circuit-state-card { padding: 32px 28px; border-radius: 20px; background: ${activePalette.card}; border: 1.5px solid ${activePalette.border}; }
    [data-composition-id="${scene.id}"] .circuit-state-active { border-color: ${activePalette.accent}; box-shadow: 0 0 32px ${activePalette.accent}25; }
    [data-composition-id="${scene.id}"] .circuit-state-head { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
    [data-composition-id="${scene.id}"] .circuit-indicator { width: 14px; height: 14px; border-radius: 50%; background: ${activePalette.accent}; box-shadow: 0 0 10px ${activePalette.accent}; }
    [data-composition-id="${scene.id}"] .circuit-state-name { font-family: "JetBrains Mono", monospace; font-size: 22px; font-weight: 900; color: ${activePalette.text}; }
    [data-composition-id="${scene.id}"] .circuit-state-desc { font-size: 18px; color: ${activePalette.textMuted || activePalette.text}; }
    [data-composition-id="${scene.id}"] .circuit-metric-hud { display: flex; align-items: center; justify-content: center; gap: 36px; margin-top: 36px; padding: 18px 36px; border-radius: 14px; background: rgba(0, 0, 0, 0.25); border: 1.5px solid ${activePalette.border}; }
    [data-composition-id="${scene.id}"] .circuit-hud-item { display: flex; flex-direction: column; gap: 4px; }
    [data-composition-id="${scene.id}"] .circuit-hud-label { font-family: "JetBrains Mono", monospace; font-size: 13px; font-weight: 800; color: ${activePalette.textMuted || "#888"}; }
    [data-composition-id="${scene.id}"] .circuit-hud-val { font-family: "JetBrains Mono", monospace; font-size: 24px; font-weight: 900; color: ${activePalette.accent}; }
    [data-composition-id="${scene.id}"] .circuit-hud-sep { width: 1px; height: 36px; background: ${activePalette.border}; }
  `,
});

// 49. Rate Limiter Bucket
registerArchetypeRenderer("rate-limiter-bucket", {
  getBackground: ({ activePalette }) =>
    `background: radial-gradient(circle at 50% 25%, ${activePalette.accent}14 0%, transparent 60%), ${activePalette.background};`,
  renderHtml: ({ scene, i, isPortrait, h, sDur, activePalette }) => {
    const capacity = scene.limiterData?.capacity || 1000;
    const current = scene.limiterData?.currentTokens || 750;
    const refill = scene.limiterData?.refillRate || "50/sec";
    const pct = Math.min(100, Math.round((current / capacity) * 100));

    const pace = scheduleStepProgression(
      "tl",
      'scope.querySelectorAll(".limiter-metric-tile")',
      sDur,
      {
        accent: activePalette.accent,
      },
    );

    return {
      innerHtml: `
        <div class="scene-inner limiter-stage">
          <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || "TRAFFIC SHAPING ALGORITHM")}</span></div>
          <h1 id="s${i + 1}-title" class="editorial-title" style="font-size: ${isPortrait ? "46px" : "60px"}">${h(scene.title)}</h1>
          <div class="limiter-container">
            <div class="limiter-bucket-card">
              <div class="bucket-header">
                <span class="bucket-title">TOKEN CAPACITY GAUGE</span>
                <span class="bucket-pct">${pct}%</span>
              </div>
              <div class="bucket-fill-track">
                <div class="bucket-fill-bar" style="width: ${pct}%;"></div>
              </div>
              <div class="bucket-meta">
                <span>Available: ${current} tokens</span>
                <span>Max: ${capacity} tokens</span>
              </div>
            </div>
            <div class="limiter-stats-row">
              <div class="limiter-metric-tile">
                <span class="limiter-tile-label">REFILL RATE</span>
                <span class="limiter-tile-val">${h(refill)}</span>
              </div>
              <div class="limiter-metric-tile">
                <span class="limiter-tile-label">INGRESS STATUS</span>
                <span class="limiter-tile-val" style="color: #4ade80;">HEALTHY</span>
              </div>
            </div>
          </div>
        </div>
      `,
      gsapChoreography: `
        tl.from(scope.querySelector("#s${i + 1}-eyebrow"), { opacity: 0, y: 16, duration: 0.5 }, 0.2);
        tl.from(scope.querySelector("#s${i + 1}-title"), { opacity: 0, y: 22, duration: 0.6 }, 0.35);
        tl.from(scope.querySelector(".limiter-bucket-card"), { opacity: 0, scale: 0.95, duration: 0.55 }, 0.5);
        tl.from(scope.querySelectorAll(".limiter-metric-tile"), { opacity: 0, y: 20, stagger: 0.12, duration: 0.5 }, 0.65);
        ${pace}
      `,
    };
  },
  renderCss: ({ scene, isPortrait, activePalette }) => `
    [data-composition-id="${scene.id}"] .limiter-stage { justify-content: center; align-items: center; text-align: center; }
    [data-composition-id="${scene.id}"] .limiter-container { width: min(1200px, 86vw); margin-top: ${isPortrait ? "24px" : "48px"}; display: flex; flex-direction: column; gap: 24px; text-align: left; }
    [data-composition-id="${scene.id}"] .limiter-bucket-card { padding: 36px 32px; border-radius: 20px; background: ${activePalette.card}; border: 1.5px solid ${activePalette.border}; }
    [data-composition-id="${scene.id}"] .bucket-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    [data-composition-id="${scene.id}"] .bucket-title { font-family: "JetBrains Mono", monospace; font-size: 15px; font-weight: 800; color: ${activePalette.text}; }
    [data-composition-id="${scene.id}"] .bucket-pct { font-family: "JetBrains Mono", monospace; font-size: 24px; font-weight: 900; color: ${activePalette.accent}; }
    [data-composition-id="${scene.id}"] .bucket-fill-track { height: 24px; border-radius: 12px; background: rgba(255, 255, 255, 0.05); overflow: hidden; margin-bottom: 16px; border: 1px solid ${activePalette.border}; }
    [data-composition-id="${scene.id}"] .bucket-fill-bar { height: 100%; border-radius: 12px; background: ${activePalette.accent}; box-shadow: 0 0 20px ${activePalette.accent}; }
    [data-composition-id="${scene.id}"] .bucket-meta { display: flex; justify-content: space-between; font-family: "JetBrains Mono", monospace; font-size: 15px; color: ${activePalette.textMuted || activePalette.text}; }
    [data-composition-id="${scene.id}"] .limiter-stats-row { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
    [data-composition-id="${scene.id}"] .limiter-metric-tile { padding: 22px 24px; border-radius: 16px; background: ${activePalette.card}; border: 1.5px solid ${activePalette.border}; }
    [data-composition-id="${scene.id}"] .limiter-tile-label { font-family: "JetBrains Mono", monospace; font-size: 13px; font-weight: 800; color: ${activePalette.textMuted || "#888"}; display: block; margin-bottom: 6px; }
    [data-composition-id="${scene.id}"] .limiter-tile-val { font-family: "JetBrains Mono", monospace; font-size: 22px; font-weight: 900; color: ${activePalette.text}; }
  `,
});

// 50. Audit Log Stream
registerArchetypeRenderer("audit-log-stream", {
  getBackground: ({ activePalette }) =>
    `background: radial-gradient(circle at 50% 25%, ${activePalette.accent}14 0%, transparent 60%), ${activePalette.background};`,
  renderHtml: ({ scene, i, isPortrait, h, sDur, activePalette }) => {
    const rawLogs = scene.auditData?.logs;
    const logs = (
      Array.isArray(rawLogs) && rawLogs.length >= 2
        ? rawLogs
        : [
            {
              timestamp: "10:14:01",
              actor: "service-auth",
              action: "token_issue",
              resource: "auth:token",
              status: "allow",
            },
            {
              timestamp: "10:14:02",
              actor: "client-proxy",
              action: "route_invoke",
              resource: "api:model",
              status: "allow",
            },
            {
              timestamp: "10:14:03",
              actor: "worker-pool",
              action: "batch_eval",
              resource: "worker:job",
              status: "allow",
            },
          ]
    ).slice(0, 4);

    const logsHtml = logs
      .map(
        (l) => `
      <div class="audit-row">
        <span class="audit-ts">${h(l.timestamp)}</span>
        <span class="audit-actor">${h(l.actor)}</span>
        <span class="audit-action">${h(l.action)}</span>
        <span class="audit-res">${h(l.resource)}</span>
        <span class="audit-status audit-status-${l.status}">${String(l.status).toUpperCase()}</span>
      </div>`,
      )
      .join("\n");

    const pace = scheduleStepProgression("tl", 'scope.querySelectorAll(".audit-row")', sDur, {
      accent: activePalette.accent,
    });

    return {
      innerHtml: `
        <div class="scene-inner audit-stage">
          <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || "IMMUTABLE AUDIT LOG")}</span></div>
          <h1 id="s${i + 1}-title" class="editorial-title" style="font-size: ${isPortrait ? "46px" : "60px"}">${h(scene.title)}</h1>
          <div class="audit-table-wrap">
            <div class="audit-table-head">
              <span>TIME</span><span>ACTOR</span><span>ACTION</span><span>TARGET</span><span>STATUS</span>
            </div>
            ${logsHtml}
          </div>
        </div>
      `,
      gsapChoreography: `
        tl.from(scope.querySelector("#s${i + 1}-eyebrow"), { opacity: 0, y: 16, duration: 0.5 }, 0.2);
        tl.from(scope.querySelector("#s${i + 1}-title"), { opacity: 0, y: 22, duration: 0.6 }, 0.35);
        tl.from(scope.querySelectorAll(".audit-row"), { opacity: 0, x: -20, stagger: 0.12, duration: 0.5, ease: "power3.out" }, 0.5);
        ${pace}
      `,
    };
  },
  renderCss: ({ scene, isPortrait, activePalette }) => `
    [data-composition-id="${scene.id}"] .audit-stage { justify-content: center; align-items: center; text-align: center; }
    [data-composition-id="${scene.id}"] .audit-table-wrap { width: min(1360px, 86vw); margin-top: ${isPortrait ? "24px" : "48px"}; border-radius: 18px; background: ${activePalette.card}; border: 1.5px solid ${activePalette.border}; padding: 20px 24px; display: flex; flex-direction: column; gap: 10px; text-align: left; }
    [data-composition-id="${scene.id}"] .audit-table-head { display: grid; grid-template-columns: 100px 180px 180px 1fr 100px; font-family: "JetBrains Mono", monospace; font-size: 13px; font-weight: 800; color: ${activePalette.textMuted || "#888"}; padding: 10px 14px; border-bottom: 1px solid ${activePalette.border}; }
    [data-composition-id="${scene.id}"] .audit-row { display: grid; grid-template-columns: 100px 180px 180px 1fr 100px; align-items: center; padding: 16px 14px; border-radius: 10px; background: rgba(255, 255, 255, 0.02); }
    [data-composition-id="${scene.id}"] .audit-ts { font-family: "JetBrains Mono", monospace; font-size: 14px; color: ${activePalette.textMuted || activePalette.text}; }
    [data-composition-id="${scene.id}"] .audit-actor { font-family: "JetBrains Mono", monospace; font-size: 15px; font-weight: 700; color: ${activePalette.accent}; }
    [data-composition-id="${scene.id}"] .audit-action { font-family: "JetBrains Mono", monospace; font-size: 15px; font-weight: 700; color: ${activePalette.text}; }
    [data-composition-id="${scene.id}"] .audit-res { font-family: "JetBrains Mono", monospace; font-size: 14px; color: ${activePalette.textMuted || activePalette.text}; }
    [data-composition-id="${scene.id}"] .audit-status { font-family: "JetBrains Mono", monospace; font-size: 12px; font-weight: 800; padding: 3px 8px; border-radius: 4px; text-align: center; }
    [data-composition-id="${scene.id}"] .audit-status-allow { background: rgba(74, 222, 128, 0.15); color: #4ade80; }
  `,
});

// 51. Confusion Matrix
registerArchetypeRenderer("confusion-matrix", {
  getBackground: ({ activePalette }) =>
    `background: radial-gradient(circle at 50% 25%, ${activePalette.accent}14 0%, transparent 60%), ${activePalette.background};`,
  renderHtml: ({ scene, i, isPortrait, h, sDur, activePalette }) => {
    const tp = scene.matrixData?.tp ?? 840;
    const fp = scene.matrixData?.fp ?? 45;
    const fn = scene.matrixData?.fn ?? 30;
    const tn = scene.matrixData?.tn ?? 920;

    const pace = scheduleStepProgression("tl", 'scope.querySelectorAll(".cm-cell")', sDur, {
      accent: activePalette.accent,
    });

    return {
      innerHtml: `
        <div class="scene-inner cm-stage">
          <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || "CLASSIFICATION BENCHMARK")}</span></div>
          <h1 id="s${i + 1}-title" class="editorial-title" style="font-size: ${isPortrait ? "46px" : "60px"}">${h(scene.title)}</h1>
          <div class="cm-layout">
            <div class="cm-grid">
              <div class="cm-cell cm-tp">
                <span class="cm-cell-tag">TRUE POSITIVE</span>
                <span class="cm-cell-val">${tp}</span>
              </div>
              <div class="cm-cell cm-fp">
                <span class="cm-cell-tag">FALSE POSITIVE</span>
                <span class="cm-cell-val">${fp}</span>
              </div>
              <div class="cm-cell cm-fn">
                <span class="cm-cell-tag">FALSE NEGATIVE</span>
                <span class="cm-cell-val">${fn}</span>
              </div>
              <div class="cm-cell cm-tn">
                <span class="cm-cell-tag">TRUE NEGATIVE</span>
                <span class="cm-cell-val">${tn}</span>
              </div>
            </div>
            <div class="cm-metrics-card">
              <div class="cm-metric-row">
                <span class="cm-m-name">Precision</span>
                <span class="cm-m-val">${((tp / (tp + fp)) * 100).toFixed(1)}%</span>
              </div>
              <div class="cm-metric-row">
                <span class="cm-m-name">Sensitivity</span>
                <span class="cm-m-val">${((tp / (tp + fn)) * 100).toFixed(1)}%</span>
              </div>
              <div class="cm-metric-row">
                <span class="cm-m-name">Accuracy</span>
                <span class="cm-m-val">${(((tp + tn) / (tp + tn + fp + fn)) * 100).toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>
      `,
      gsapChoreography: `
        tl.from(scope.querySelector("#s${i + 1}-eyebrow"), { opacity: 0, y: 16, duration: 0.5 }, 0.2);
        tl.from(scope.querySelector("#s${i + 1}-title"), { opacity: 0, y: 22, duration: 0.6 }, 0.35);
        tl.from(scope.querySelectorAll(".cm-cell"), { opacity: 0, scale: 0.9, stagger: 0.1, duration: 0.5 }, 0.5);
        tl.from(scope.querySelector(".cm-metrics-card"), { opacity: 0, x: 24, duration: 0.5 }, 0.65);
        ${pace}
      `,
    };
  },
  renderCss: ({ scene, isPortrait, activePalette }) => `
    [data-composition-id="${scene.id}"] .cm-stage { justify-content: center; align-items: center; text-align: center; }
    [data-composition-id="${scene.id}"] .cm-layout { display: flex; flex-direction: ${isPortrait ? "column" : "row"}; gap: 32px; width: min(1200px, 86vw); margin-top: ${isPortrait ? "24px" : "48px"}; align-items: stretch; text-align: left; }
    [data-composition-id="${scene.id}"] .cm-grid { flex: 1; display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
    [data-composition-id="${scene.id}"] .cm-cell { padding: 32px 24px; border-radius: 16px; background: ${activePalette.card}; border: 1.5px solid ${activePalette.border}; }
    [data-composition-id="${scene.id}"] .cm-tp { background: ${activePalette.accent}18; border-color: ${activePalette.accent}; }
    [data-composition-id="${scene.id}"] .cm-tn { background: ${activePalette.accent}10; }
    [data-composition-id="${scene.id}"] .cm-cell-tag { font-family: "JetBrains Mono", monospace; font-size: 13px; font-weight: 800; color: ${activePalette.textMuted || "#888"}; display: block; margin-bottom: 8px; }
    [data-composition-id="${scene.id}"] .cm-cell-val { font-family: "JetBrains Mono", monospace; font-size: 36px; font-weight: 900; color: ${activePalette.text}; }
    [data-composition-id="${scene.id}"] .cm-metrics-card { width: ${isPortrait ? "100%" : "320px"}; padding: 28px 24px; border-radius: 18px; background: ${activePalette.card}; border: 1.5px solid ${activePalette.border}; display: flex; flex-direction: column; justify-content: center; gap: 20px; }
    [data-composition-id="${scene.id}"] .cm-metric-row { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid ${activePalette.border}; padding-bottom: 12px; }
    [data-composition-id="${scene.id}"] .cm-m-name { font-size: 18px; font-weight: 600; color: ${activePalette.textMuted || activePalette.text}; }
    [data-composition-id="${scene.id}"] .cm-m-val { font-family: "JetBrains Mono", monospace; font-size: 24px; font-weight: 900; color: ${activePalette.accent}; }
  `,
});

// 52. Quantile Distribution
registerArchetypeRenderer("quantile-distribution", {
  getBackground: ({ activePalette }) =>
    `background: radial-gradient(circle at 50% 25%, ${activePalette.accent}14 0%, transparent 60%), ${activePalette.background};`,
  renderHtml: ({ scene, i, isPortrait, h, sDur, activePalette }) => {
    const p50 = scene.quantileData?.p50 ?? 12;
    const p90 = scene.quantileData?.p90 ?? 45;
    const p99 = scene.quantileData?.p99 ?? 125;
    const unit = scene.quantileData?.unit || "ms";

    const pace = scheduleStepProgression("tl", 'scope.querySelectorAll(".quantile-badge")', sDur, {
      accent: activePalette.accent,
    });

    return {
      innerHtml: `
        <div class="scene-inner qd-stage">
          <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || "PERCENTILE TAIL DISTRIBUTION")}</span></div>
          <h1 id="s${i + 1}-title" class="editorial-title" style="font-size: ${isPortrait ? "46px" : "60px"}">${h(scene.title)}</h1>
          <div class="qd-container">
            <svg class="qd-curve-svg" viewBox="0 0 800 240" fill="none">
              <path d="M 50 220 Q 200 220 300 40 Q 400 220 750 220" stroke="${activePalette.accent}" stroke-width="4" fill="none" />
              <line x1="300" y1="220" x2="300" y2="40" stroke="${activePalette.border}" stroke-width="2" stroke-dasharray="4" />
              <line x1="450" y1="220" x2="450" y2="120" stroke="${activePalette.accent}" stroke-width="2" stroke-dasharray="4" />
              <line x1="620" y1="220" x2="620" y2="190" stroke="#f59e0b" stroke-width="2" stroke-dasharray="4" />
            </svg>
            <div class="qd-badges-row">
              <div class="quantile-badge">
                <span class="qd-tag">P50 (MEDIAN)</span>
                <span class="qd-val">${p50}${unit}</span>
              </div>
              <div class="quantile-badge qd-hero">
                <span class="qd-tag">P90</span>
                <span class="qd-val">${p90}${unit}</span>
              </div>
              <div class="quantile-badge qd-warn">
                <span class="qd-tag">P99 (TAIL)</span>
                <span class="qd-val">${p99}${unit}</span>
              </div>
            </div>
          </div>
        </div>
      `,
      gsapChoreography: `
        tl.from(scope.querySelector("#s${i + 1}-eyebrow"), { opacity: 0, y: 16, duration: 0.5 }, 0.2);
        tl.from(scope.querySelector("#s${i + 1}-title"), { opacity: 0, y: 22, duration: 0.6 }, 0.35);
        tl.from(scope.querySelector(".qd-curve-svg"), { opacity: 0, scaleY: 0, transformOrigin: "bottom", duration: 0.7 }, 0.5);
        tl.from(scope.querySelectorAll(".quantile-badge"), { opacity: 0, y: 20, stagger: 0.12, duration: 0.5 }, 0.7);
        ${pace}
      `,
    };
  },
  renderCss: ({ scene, isPortrait, activePalette }) => `
    [data-composition-id="${scene.id}"] .qd-stage { justify-content: center; align-items: center; text-align: center; }
    [data-composition-id="${scene.id}"] .qd-container { width: min(1200px, 86vw); margin-top: ${isPortrait ? "24px" : "48px"}; display: flex; flex-direction: column; gap: 28px; }
    [data-composition-id="${scene.id}"] .qd-curve-svg { width: 100%; height: 220px; }
    [data-composition-id="${scene.id}"] .qd-badges-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; text-align: left; }
    [data-composition-id="${scene.id}"] .quantile-badge { padding: 24px 28px; border-radius: 18px; background: ${activePalette.card}; border: 1.5px solid ${activePalette.border}; }
    [data-composition-id="${scene.id}"] .qd-hero { border-color: ${activePalette.accent}; box-shadow: 0 0 28px ${activePalette.accent}20; }
    [data-composition-id="${scene.id}"] .qd-warn { border-color: #f59e0b; }
    [data-composition-id="${scene.id}"] .qd-tag { font-family: "JetBrains Mono", monospace; font-size: 13px; font-weight: 800; color: ${activePalette.textMuted || "#888"}; display: block; margin-bottom: 6px; }
    [data-composition-id="${scene.id}"] .qd-val { font-family: "JetBrains Mono", monospace; font-size: 32px; font-weight: 900; color: ${activePalette.text}; }
  `,
});

// 53. Radar Capability
registerArchetypeRenderer("radar-capability", {
  getBackground: ({ activePalette }) =>
    `background: radial-gradient(circle at 50% 25%, ${activePalette.accent}14 0%, transparent 60%), ${activePalette.background};`,
  renderHtml: ({ scene, i, isPortrait, h, sDur, activePalette }) => {
    const rawAxes = scene.radarData?.axes;
    const axes = (
      Array.isArray(rawAxes) && rawAxes.length >= 3
        ? rawAxes
        : ["Reasoning", "Coding", "Mathematics", "Context", "Instruction"].map((n) => ({ name: n }))
    ).slice(0, 5);

    const labelsHtml = axes
      .map((ax) => `<div class="radar-axis-chip">${h(ax.name)}</div>`)
      .join("\n");

    const pace = scheduleStepProgression(
      "tl",
      'scope.querySelectorAll(".radar-legend-item")',
      sDur,
      {
        accent: activePalette.accent,
      },
    );

    return {
      innerHtml: `
        <div class="scene-inner radar-stage">
          <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || "MULTI-AXIS BENCHMARK")}</span></div>
          <h1 id="s${i + 1}-title" class="editorial-title" style="font-size: ${isPortrait ? "46px" : "60px"}">${h(scene.title)}</h1>
          <div class="radar-wrap">
            <svg class="radar-svg" viewBox="0 0 400 400">
              <polygon points="200,40 350,150 290,330 110,330 50,150" stroke="${activePalette.border}" stroke-width="1.5" fill="none" />
              <polygon points="200,80 305,160 260,290 140,290 95,160" stroke="${activePalette.border}" stroke-width="1.5" fill="none" />
              <polygon points="200,55 330,155 280,310 120,310 65,155" stroke="${activePalette.accent}" stroke-width="3" fill="${activePalette.accent}25" />
            </svg>
            <div class="radar-axes-list">
              ${labelsHtml}
            </div>
            <div class="radar-legend">
              <div class="radar-legend-item"><span class="r-dot" style="background: ${activePalette.accent};"></span><span>Model Target</span></div>
              <div class="radar-legend-item"><span class="r-dot" style="background: ${activePalette.border};"></span><span>Baseline Frontier</span></div>
            </div>
          </div>
        </div>
      `,
      gsapChoreography: `
        tl.from(scope.querySelector("#s${i + 1}-eyebrow"), { opacity: 0, y: 16, duration: 0.5 }, 0.2);
        tl.from(scope.querySelector("#s${i + 1}-title"), { opacity: 0, y: 22, duration: 0.6 }, 0.35);
        tl.from(scope.querySelector(".radar-svg polygon:last-child"), { opacity: 0, scale: 0.2, transformOrigin: "center", duration: 0.7, ease: "back.out(1.4)" }, 0.5);
        tl.from(scope.querySelectorAll(".radar-axis-chip"), { opacity: 0, y: 14, stagger: 0.08, duration: 0.4 }, 0.65);
        ${pace}
      `,
    };
  },
  renderCss: ({ scene, isPortrait, activePalette }) => `
    [data-composition-id="${scene.id}"] .radar-stage { justify-content: center; align-items: center; text-align: center; }
    [data-composition-id="${scene.id}"] .radar-wrap { width: min(1200px, 86vw); margin-top: ${isPortrait ? "20px" : "40px"}; display: flex; flex-direction: column; align-items: center; gap: 20px; }
    [data-composition-id="${scene.id}"] .radar-svg { width: 340px; height: 340px; }
    [data-composition-id="${scene.id}"] .radar-axes-list { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; }
    [data-composition-id="${scene.id}"] .radar-axis-chip { font-family: "JetBrains Mono", monospace; font-size: 14px; font-weight: 700; padding: 6px 14px; border-radius: 8px; background: ${activePalette.card}; border: 1px solid ${activePalette.border}; color: ${activePalette.text}; }
    [data-composition-id="${scene.id}"] .radar-legend { display: flex; gap: 24px; font-family: "JetBrains Mono", monospace; font-size: 14px; color: ${activePalette.textMuted || activePalette.text}; }
    [data-composition-id="${scene.id}"] .radar-legend-item { display: flex; align-items: center; gap: 8px; }
    [data-composition-id="${scene.id}"] .r-dot { width: 10px; height: 10px; border-radius: 50%; }
  `,
});

// 54. Sankey Cost Flow
registerArchetypeRenderer("sankey-cost-flow", {
  getBackground: ({ activePalette }) =>
    `background: radial-gradient(circle at 50% 25%, ${activePalette.accent}14 0%, transparent 60%), ${activePalette.background};`,
  renderHtml: ({ scene, i, isPortrait, h, sDur, activePalette }) => {
    const rawStreams = scene.sankeyData?.streams;
    const streams = (
      Array.isArray(rawStreams) && rawStreams.length >= 2
        ? rawStreams
        : [
            { source: "Budget", target: synthesizeFallbackText(scene, "step", 0), value: 45 },
            { source: "Budget", target: synthesizeFallbackText(scene, "step", 1), value: 30 },
            { source: "Budget", target: synthesizeFallbackText(scene, "step", 2), value: 25 },
          ]
    ).slice(0, 4);

    const total = scene.sankeyData?.total || "$50k";

    const streamsHtml = streams
      .map(
        (st) => `
      <div class="sankey-branch">
        <div class="sankey-branch-head">
          <span class="sankey-target">${h(st.target)}</span>
          <span class="sankey-val">${st.value}%</span>
        </div>
        <div class="sankey-bar-track">
          <div class="sankey-bar-fill" style="width: ${st.value}%;"></div>
        </div>
      </div>`,
      )
      .join("\n");

    const pace = scheduleStepProgression("tl", 'scope.querySelectorAll(".sankey-branch")', sDur, {
      accent: activePalette.accent,
    });

    return {
      innerHtml: `
        <div class="scene-inner sankey-stage">
          <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || "CAPITAL & TOKEN ALLOCATION")}</span></div>
          <h1 id="s${i + 1}-title" class="editorial-title" style="font-size: ${isPortrait ? "46px" : "60px"}">${h(scene.title)}</h1>
          <div class="sankey-layout">
            <div class="sankey-source-node">
              <span class="sankey-src-label">TOTAL ALLOCATION</span>
              <span class="sankey-src-val">${h(total)}</span>
            </div>
            <div class="sankey-branches-col">
              ${streamsHtml}
            </div>
          </div>
        </div>
      `,
      gsapChoreography: `
        tl.from(scope.querySelector("#s${i + 1}-eyebrow"), { opacity: 0, y: 16, duration: 0.5 }, 0.2);
        tl.from(scope.querySelector("#s${i + 1}-title"), { opacity: 0, y: 22, duration: 0.6 }, 0.35);
        tl.from(scope.querySelector(".sankey-source-node"), { opacity: 0, scale: 0.9, duration: 0.5 }, 0.5);
        tl.from(scope.querySelectorAll(".sankey-branch"), { opacity: 0, x: 20, stagger: 0.12, duration: 0.5 }, 0.65);
        ${pace}
      `,
    };
  },
  renderCss: ({ scene, isPortrait, activePalette }) => `
    [data-composition-id="${scene.id}"] .sankey-stage { justify-content: center; align-items: center; text-align: center; }
    [data-composition-id="${scene.id}"] .sankey-layout { display: flex; flex-direction: ${isPortrait ? "column" : "row"}; gap: 36px; width: min(1200px, 86vw); margin-top: ${isPortrait ? "24px" : "48px"}; align-items: center; text-align: left; }
    [data-composition-id="${scene.id}"] .sankey-source-node { width: ${isPortrait ? "100%" : "260px"}; padding: 36px 28px; border-radius: 20px; background: ${activePalette.card}; border: 1.5px solid ${activePalette.accent}; box-shadow: 0 0 32px ${activePalette.accent}20; text-align: center; }
    [data-composition-id="${scene.id}"] .sankey-src-label { font-family: "JetBrains Mono", monospace; font-size: 13px; font-weight: 800; color: ${activePalette.textMuted || "#888"}; display: block; margin-bottom: 8px; }
    [data-composition-id="${scene.id}"] .sankey-src-val { font-family: "JetBrains Mono", monospace; font-size: 38px; font-weight: 900; color: ${activePalette.accent}; }
    [data-composition-id="${scene.id}"] .sankey-branches-col { flex: 1; display: flex; flex-direction: column; gap: 18px; width: 100%; }
    [data-composition-id="${scene.id}"] .sankey-branch { padding: 20px 24px; border-radius: 16px; background: ${activePalette.card}; border: 1.5px solid ${activePalette.border}; }
    [data-composition-id="${scene.id}"] .sankey-branch-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    [data-composition-id="${scene.id}"] .sankey-target { font-size: 18px; font-weight: 700; color: ${activePalette.text}; }
    [data-composition-id="${scene.id}"] .sankey-val { font-family: "JetBrains Mono", monospace; font-size: 18px; font-weight: 900; color: ${activePalette.accent}; }
    [data-composition-id="${scene.id}"] .sankey-bar-track { height: 10px; border-radius: 5px; background: rgba(255, 255, 255, 0.05); overflow: hidden; }
    [data-composition-id="${scene.id}"] .sankey-bar-fill { height: 100%; border-radius: 5px; background: ${activePalette.accent}; }
  `,
});

// 55. Cohort Retention Grid
registerArchetypeRenderer("cohort-retention-grid", {
  getBackground: ({ activePalette }) =>
    `background: radial-gradient(circle at 50% 25%, ${activePalette.accent}14 0%, transparent 60%), ${activePalette.background};`,
  renderHtml: ({ scene, i, isPortrait, h, sDur, activePalette }) => {
    const rawCohorts = scene.cohortData?.cohorts;
    const cohorts = (
      Array.isArray(rawCohorts) && rawCohorts.length >= 2
        ? rawCohorts
        : [
            { label: "Cohort 1", size: 1200, percentages: [100, 78, 65, 58, 52] },
            { label: "Cohort 2", size: 1450, percentages: [100, 82, 70, 63] },
            { label: "Cohort 3", size: 1600, percentages: [100, 85, 74] },
          ]
    ).slice(0, 3);

    const rowsHtml = cohorts
      .map((c) => {
        const tilesHtml = (c.percentages || [])
          .map((p) => {
            const alpha = Math.max(0.1, p / 100);
            return `<div class="cohort-tile" style="background: ${activePalette.accent}${Math.round(
              alpha * 255,
            )
              .toString(16)
              .padStart(2, "0")};">${p}%</div>`;
          })
          .join("\n");

        return `
        <div class="cohort-row">
          <span class="cohort-label">${h(c.label)}</span>
          <div class="cohort-tiles">
            ${tilesHtml}
          </div>
        </div>`;
      })
      .join("\n");

    const pace = scheduleStepProgression("tl", 'scope.querySelectorAll(".cohort-row")', sDur, {
      accent: activePalette.accent,
    });

    return {
      innerHtml: `
        <div class="scene-inner cohort-stage">
          <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || "RETENTION HEATMAP")}</span></div>
          <h1 id="s${i + 1}-title" class="editorial-title" style="font-size: ${isPortrait ? "46px" : "60px"}">${h(scene.title)}</h1>
          <div class="cohort-table">
            <div class="cohort-head">
              <span>COHORT</span>
              <div class="cohort-head-cols">
                <span>W0</span><span>W1</span><span>W2</span><span>W3</span><span>W4</span>
              </div>
            </div>
            ${rowsHtml}
          </div>
        </div>
      `,
      gsapChoreography: `
        tl.from(scope.querySelector("#s${i + 1}-eyebrow"), { opacity: 0, y: 16, duration: 0.5 }, 0.2);
        tl.from(scope.querySelector("#s${i + 1}-title"), { opacity: 0, y: 22, duration: 0.6 }, 0.35);
        tl.from(scope.querySelectorAll(".cohort-row"), { opacity: 0, y: 18, stagger: 0.12, duration: 0.5 }, 0.5);
        ${pace}
      `,
    };
  },
  renderCss: ({ scene, isPortrait, activePalette }) => `
    [data-composition-id="${scene.id}"] .cohort-stage { justify-content: center; align-items: center; text-align: center; }
    [data-composition-id="${scene.id}"] .cohort-table { width: min(1200px, 86vw); margin-top: ${isPortrait ? "24px" : "48px"}; border-radius: 18px; background: ${activePalette.card}; border: 1.5px solid ${activePalette.border}; padding: 24px 28px; display: flex; flex-direction: column; gap: 14px; text-align: left; }
    [data-composition-id="${scene.id}"] .cohort-head { display: grid; grid-template-columns: 140px 1fr; font-family: "JetBrains Mono", monospace; font-size: 13px; font-weight: 800; color: ${activePalette.textMuted || "#888"}; border-bottom: 1px solid ${activePalette.border}; padding-bottom: 12px; }
    [data-composition-id="${scene.id}"] .cohort-head-cols { display: grid; grid-template-columns: repeat(5, 1fr); text-align: center; }
    [data-composition-id="${scene.id}"] .cohort-row { display: grid; grid-template-columns: 140px 1fr; align-items: center; }
    [data-composition-id="${scene.id}"] .cohort-label { font-family: "JetBrains Mono", monospace; font-size: 16px; font-weight: 700; color: ${activePalette.text}; }
    [data-composition-id="${scene.id}"] .cohort-tiles { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; }
    [data-composition-id="${scene.id}"] .cohort-tile { padding: 14px 10px; border-radius: 8px; text-align: center; font-family: "JetBrains Mono", monospace; font-size: 15px; font-weight: 800; color: ${activePalette.text}; }
  `,
});

// 56. Multi-Metric Dashboard
registerArchetypeRenderer("multi-metric-dashboard", {
  getBackground: ({ activePalette }) =>
    `background: radial-gradient(circle at 50% 25%, ${activePalette.accent}14 0%, transparent 60%), ${activePalette.background};`,
  renderHtml: ({ scene, i, isPortrait, h, sDur, activePalette }) => {
    const rawMetrics = scene.dashboardData?.metrics;
    const metrics = (
      Array.isArray(rawMetrics) && rawMetrics.length >= 2
        ? rawMetrics
        : [0, 1, 2, 3].map((k) => ({
            title: synthesizeFallbackText(scene, "metric", k),
            value: `${(k + 1) * 25}%`,
            change: `+${k + 2}.4%`,
          }))
    ).slice(0, 4);

    const cardsHtml = metrics
      .map(
        (m) => `
      <div class="kpi-card">
        <div class="kpi-card-head">
          <span class="kpi-title">${h(m.title)}</span>
          <span class="kpi-delta">${h(m.change || "+2.4%")}</span>
        </div>
        <div class="kpi-val">${h(m.value)}</div>
        <svg class="kpi-sparkline" viewBox="0 0 100 24" preserveAspectRatio="none">
          <path d="M 0 18 Q 25 10 50 14 T 100 4" stroke="${activePalette.accent}" stroke-width="2.5" fill="none" />
        </svg>
      </div>`,
      )
      .join("\n");

    const pace = scheduleStepProgression("tl", 'scope.querySelectorAll(".kpi-card")', sDur, {
      accent: activePalette.accent,
    });

    return {
      innerHtml: `
        <div class="scene-inner dash-stage">
          <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || "TELEMETRY OVERVIEW")}</span></div>
          <h1 id="s${i + 1}-title" class="editorial-title" style="font-size: ${isPortrait ? "46px" : "60px"}">${h(scene.title)}</h1>
          <div class="dash-grid">
            ${cardsHtml}
          </div>
        </div>
      `,
      gsapChoreography: `
        tl.from(scope.querySelector("#s${i + 1}-eyebrow"), { opacity: 0, y: 16, duration: 0.5 }, 0.2);
        tl.from(scope.querySelector("#s${i + 1}-title"), { opacity: 0, y: 22, duration: 0.6 }, 0.35);
        tl.from(scope.querySelectorAll(".kpi-card"), { opacity: 0, y: 24, stagger: 0.1, duration: 0.55, ease: "power3.out" }, 0.55);
        ${pace}
      `,
    };
  },
  renderCss: ({ scene, isPortrait, activePalette }) => `
    [data-composition-id="${scene.id}"] .dash-stage { justify-content: center; align-items: center; text-align: center; }
    [data-composition-id="${scene.id}"] .dash-grid { display: grid; grid-template-columns: ${isPortrait ? "1fr" : "repeat(4, 1fr)"}; gap: 20px; width: min(1360px, 86vw); margin-top: ${isPortrait ? "24px" : "48px"}; text-align: left; }
    [data-composition-id="${scene.id}"] .kpi-card { padding: 28px 24px; border-radius: 18px; background: ${activePalette.card}; border: 1.5px solid ${activePalette.border}; }
    [data-composition-id="${scene.id}"] .kpi-card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    [data-composition-id="${scene.id}"] .kpi-title { font-family: "JetBrains Mono", monospace; font-size: 13px; font-weight: 800; color: ${activePalette.textMuted || "#888"}; }
    [data-composition-id="${scene.id}"] .kpi-delta { font-family: "JetBrains Mono", monospace; font-size: 13px; font-weight: 800; color: #4ade80; }
    [data-composition-id="${scene.id}"] .kpi-val { font-family: "JetBrains Mono", monospace; font-size: 34px; font-weight: 900; color: ${activePalette.text}; margin-bottom: 16px; }
    [data-composition-id="${scene.id}"] .kpi-sparkline { width: 100%; height: 24px; }
  `,
});

// 57. A/B Test Confidence
registerArchetypeRenderer("ab-test-confidence", {
  getBackground: ({ activePalette }) =>
    `background: radial-gradient(circle at 50% 25%, ${activePalette.accent}14 0%, transparent 60%), ${activePalette.background};`,
  renderHtml: ({ scene, i, isPortrait, h, sDur, activePalette }) => {
    const rawAb = scene.abData;
    const vA = rawAb?.variantA || { label: "Control", mean: 12.4, conversion: "12.4%" };
    const vB = rawAb?.variantB || { label: "Candidate", mean: 14.8, conversion: "14.8%" };
    const pVal = rawAb?.pValue ?? 0.003;

    const pace = scheduleStepProgression("tl", 'scope.querySelectorAll(".ab-variant-card")', sDur, {
      accent: activePalette.accent,
    });

    return {
      innerHtml: `
        <div class="scene-inner ab-stage">
          <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || "STATISTICAL SIGNIFICANCE")}</span></div>
          <h1 id="s${i + 1}-title" class="editorial-title" style="font-size: ${isPortrait ? "46px" : "60px"}">${h(scene.title)}</h1>
          <div class="ab-container">
            <svg class="ab-bell-svg" viewBox="0 0 600 200" fill="none">
              <!-- Curve A (Control) -->
              <path d="M 80 180 Q 220 180 250 50 Q 280 180 420 180" stroke="${activePalette.border}" stroke-width="3" fill="${activePalette.border}20" />
              <!-- Curve B (Candidate) -->
              <path d="M 180 180 Q 320 180 350 40 Q 380 180 520 180" stroke="${activePalette.accent}" stroke-width="3.5" fill="${activePalette.accent}25" />
            </svg>
            <div class="ab-variants-grid">
              <div class="ab-variant-card">
                <span class="ab-tag">VARIANT A (CONTROL)</span>
                <span class="ab-rate">${h(vA.conversion)}</span>
                <span class="ab-mean">Mean = ${vA.mean}</span>
              </div>
              <div class="ab-variant-card ab-hero">
                <span class="ab-tag">VARIANT B (CANDIDATE)</span>
                <span class="ab-rate" style="color: ${activePalette.accent};">${h(vB.conversion)}</span>
                <span class="ab-mean">Uplift: +${(((vB.mean - vA.mean) / vA.mean) * 100).toFixed(1)}%</span>
              </div>
            </div>
            <div class="ab-significance-chip">
              <span class="ab-sig-icon">✓</span>
              <span>Statistically Significant (p = ${pVal})</span>
            </div>
          </div>
        </div>
      `,
      gsapChoreography: `
        tl.from(scope.querySelector("#s${i + 1}-eyebrow"), { opacity: 0, y: 16, duration: 0.5 }, 0.2);
        tl.from(scope.querySelector("#s${i + 1}-title"), { opacity: 0, y: 22, duration: 0.6 }, 0.35);
        tl.from(scope.querySelector(".ab-bell-svg"), { opacity: 0, scaleY: 0, transformOrigin: "bottom", duration: 0.7 }, 0.5);
        tl.from(scope.querySelectorAll(".ab-variant-card"), { opacity: 0, y: 20, stagger: 0.14, duration: 0.5 }, 0.65);
        tl.from(scope.querySelector(".ab-significance-chip"), { opacity: 0, scale: 0.85, duration: 0.4 }, 0.85);
        ${pace}
      `,
    };
  },
  renderCss: ({ scene, isPortrait, activePalette }) => `
    [data-composition-id="${scene.id}"] .ab-stage { justify-content: center; align-items: center; text-align: center; }
    [data-composition-id="${scene.id}"] .ab-container { width: min(1200px, 86vw); margin-top: ${isPortrait ? "24px" : "44px"}; display: flex; flex-direction: column; align-items: center; gap: 24px; text-align: left; }
    [data-composition-id="${scene.id}"] .ab-bell-svg { width: 100%; max-width: 600px; height: 180px; }
    [data-composition-id="${scene.id}"] .ab-variants-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; width: 100%; }
    [data-composition-id="${scene.id}"] .ab-variant-card { padding: 28px 24px; border-radius: 18px; background: ${activePalette.card}; border: 1.5px solid ${activePalette.border}; }
    [data-composition-id="${scene.id}"] .ab-hero { border-color: ${activePalette.accent}; box-shadow: 0 0 28px ${activePalette.accent}20; }
    [data-composition-id="${scene.id}"] .ab-tag { font-family: "JetBrains Mono", monospace; font-size: 13px; font-weight: 800; color: ${activePalette.textMuted || "#888"}; display: block; margin-bottom: 6px; }
    [data-composition-id="${scene.id}"] .ab-rate { font-family: "JetBrains Mono", monospace; font-size: 36px; font-weight: 900; color: ${activePalette.text}; display: block; margin-bottom: 4px; }
    [data-composition-id="${scene.id}"] .ab-mean { font-family: "JetBrains Mono", monospace; font-size: 15px; color: ${activePalette.textMuted || activePalette.text}; }
    [data-composition-id="${scene.id}"] .ab-significance-chip { display: flex; align-items: center; gap: 10px; padding: 10px 20px; border-radius: 30px; background: rgba(74, 222, 128, 0.15); border: 1px solid rgba(74, 222, 128, 0.3); font-family: "JetBrains Mono", monospace; font-size: 14px; font-weight: 800; color: #4ade80; }
  `,
});

// 58. Carousel 3D Showcase
registerArchetypeRenderer("carousel-3d-showcase", {
  getBackground: ({ activePalette }) =>
    `background: radial-gradient(circle at 50% 35%, ${activePalette.accent}16 0%, transparent 65%), ${activePalette.background};`,
  renderHtml: ({ scene, i, isPortrait, h, sDur, activePalette }) => {
    const rawItems = scene.carouselData?.items;
    const items =
      Array.isArray(rawItems) && rawItems.length > 0
        ? rawItems.slice(0, 6)
        : [
            {
              badge: "01",
              title: "Modular System",
              desc: "Decoupled pipeline layers",
              tag: "FOUNDATION",
            },
            {
              badge: "02",
              title: "Dynamic Scaling",
              desc: "Adaptive throughput rates",
              tag: "OPTIMIZATION",
            },
            {
              badge: "03",
              title: "Consistent State",
              desc: "Reproducible execution passes",
              tag: "INTEGRITY",
            },
            {
              badge: "04",
              title: "Instant Visuals",
              desc: "Continuous composition rendering",
              tag: "EFFICIENCY",
            },
          ];

    const count = items.length;
    const radius = isPortrait ? 260 : 380;
    const cardsHtml = items
      .map((item, idx) => {
        const theta = (idx * 360) / count;
        return `
          <div class="c3d-card" style="transform: rotateY(${theta}deg) translateZ(${radius}px);">
            <div class="c3d-card-inner">
              <div class="c3d-card-header">
                <span class="c3d-badge">${h(item.badge || `0${idx + 1}`)}</span>
                <span class="c3d-tag">${h(item.tag || "ACTIVE")}</span>
              </div>
              <h3 class="c3d-card-title">${h(item.title || "Feature")}</h3>
              <p class="c3d-card-desc">${h(item.desc || "")}</p>
              <div class="c3d-glow-bar"></div>
            </div>
          </div>
        `;
      })
      .join("");

    const pace = scheduleStepProgression("tl", 'scope.querySelectorAll(".c3d-card")', sDur, {
      accent: activePalette.accent,
    });

    return {
      innerHtml: `
        <div class="scene-inner c3d-stage">
          <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || "FEATURE SHOWCASE")}</span></div>
          <h1 id="s${i + 1}-title" class="editorial-title" style="font-size: ${isPortrait ? "42px" : "56px"}">${h(scene.title)}</h1>
          <div class="c3d-viewport">
            <div class="c3d-ring">
              ${cardsHtml}
            </div>
          </div>
        </div>
      `,
      gsapChoreography: `
        tl.from(scope.querySelector("#s${i + 1}-eyebrow"), { opacity: 0, y: 16, duration: 0.5 }, 0.2);
        tl.from(scope.querySelector("#s${i + 1}-title"), { opacity: 0, y: 22, duration: 0.6 }, 0.35);
        tl.from(scope.querySelectorAll(".c3d-card"), { opacity: 0, scale: 0.7, duration: 0.7, stagger: 0.1 }, 0.45);
        tl.to(scope.querySelector(".c3d-ring"), { rotationY: -360, duration: Math.max(3, Number(sDur) - 1.2), ease: "power1.inOut" }, 0.8);
        ${pace}
      `,
    };
  },
  renderCss: ({ scene, isPortrait, activePalette }) => `
    [data-composition-id="${scene.id}"] .c3d-stage { justify-content: center; align-items: center; text-align: center; overflow: hidden; }
    [data-composition-id="${scene.id}"] .c3d-viewport { width: 100%; height: ${isPortrait ? "480px" : "420px"}; margin-top: ${isPortrait ? "20px" : "36px"}; display: flex; justify-content: center; align-items: center; perspective: 1200px; transform-style: preserve-3d; }
    [data-composition-id="${scene.id}"] .c3d-ring { position: relative; width: ${isPortrait ? "260px" : "320px"}; height: ${isPortrait ? "320px" : "340px"}; transform-style: preserve-3d; }
    [data-composition-id="${scene.id}"] .c3d-card { position: absolute; inset: 0; transform-style: preserve-3d; backface-visibility: hidden; border-radius: 20px; background: ${activePalette.card}; border: 1.5px solid ${activePalette.border}; padding: 24px; text-align: left; box-shadow: 0 16px 40px rgba(0,0,0,0.5); display: flex; flex-direction: column; justify-content: space-between; }
    [data-composition-id="${scene.id}"] .c3d-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    [data-composition-id="${scene.id}"] .c3d-badge { font-family: "JetBrains Mono", monospace; font-size: 14px; font-weight: 900; color: ${activePalette.accent}; }
    [data-composition-id="${scene.id}"] .c3d-tag { font-family: "JetBrains Mono", monospace; font-size: 11px; font-weight: 800; color: ${activePalette.textMuted || "#888"}; background: ${activePalette.border}44; padding: 4px 8px; border-radius: 6px; letter-spacing: 0.5px; }
    [data-composition-id="${scene.id}"] .c3d-card-title { font-family: "JetBrains Mono", monospace; font-size: 19px; font-weight: 800; color: ${activePalette.text}; margin-bottom: 8px; }
    [data-composition-id="${scene.id}"] .c3d-card-desc { font-family: "JetBrains Mono", monospace; font-size: 13px; color: ${activePalette.textMuted || "#aaa"}; line-height: 1.5; }
    [data-composition-id="${scene.id}"] .c3d-glow-bar { width: 100%; height: 3px; border-radius: 2px; background: ${activePalette.accent}; opacity: 0.6; margin-top: 14px; }
  `,
});

// 59. 3D Motion Hero
registerArchetypeRenderer("3d-motion-hero", {
  getBackground: ({ activePalette }) =>
    `background: radial-gradient(ellipse at 50% 50%, ${activePalette.accent}24 0%, #060913 70%), ${activePalette.background};`,
  renderHtml: ({ scene, i, isPortrait, h, sDur, activePalette }) => {
    const rawHero = scene.hero3dData;
    const title = rawHero?.mainTitle || scene.title;
    const sub = rawHero?.subTitle || scene.subtitle || "";
    const badge = rawHero?.badge || "SPATIAL VIEW";
    const canvasId = `hero3d-canvas-s${i + 1}`;

    return {
      innerHtml: `
        <div class="scene-inner hero3d-stage">
          <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || badge)}</span></div>
          <h1 id="s${i + 1}-title" class="editorial-title hero3d-title" style="font-size: ${isPortrait ? "44px" : "62px"}">${h(title)}</h1>
          ${sub ? `<p class="hero3d-sub">${h(sub)}</p>` : ""}
          <div class="hero3d-canvas-wrap">
            <canvas id="${canvasId}" class="hero3d-canvas" width="${isPortrait ? 600 : 780}" height="${isPortrait ? 500 : 420}"></canvas>
            <div class="hero3d-halo"></div>
          </div>
        </div>
      `,
      gsapChoreography: `
        tl.from(scope.querySelector("#s${i + 1}-eyebrow"), { opacity: 0, y: 16, duration: 0.5 }, 0.2);
        tl.from(scope.querySelector("#s${i + 1}-title"), { opacity: 0, scale: 0.92, duration: 0.7 }, 0.35);
        if (scope.querySelector(".hero3d-sub")) {
          tl.from(scope.querySelector(".hero3d-sub"), { opacity: 0, y: 14, duration: 0.5 }, 0.5);
        }
        tl.from(scope.querySelector(".hero3d-canvas-wrap"), { opacity: 0, scale: 0.8, duration: 0.8 }, 0.4);

        (function () {
          const cvs = scope.querySelector("#${canvasId}");
          if (!cvs) return;
          const ctx = cvs.getContext("2d");
          if (!ctx) return;
          const W = cvs.width;
          const H = cvs.height;
          const cx = W / 2;
          const cy = H / 2;
          const R = ${isPortrait ? 130 : 160};
          const accent = "${activePalette.accent}";

          const phi = (1 + Math.sqrt(5)) / 2;
          const baseVerts = [
            [-1,  phi, 0], [ 1,  phi, 0], [-1, -phi, 0], [ 1, -phi, 0],
            [0, -1,  phi], [0,  1,  phi], [0, -1, -phi], [0,  1, -phi],
            [ phi, 0, -1], [ phi, 0,  1], [-phi, 0, -1], [-phi, 0,  1]
          ].map(v => {
            const len = Math.hypot(v[0], v[1], v[2]);
            return [v[0] / len * R, v[1] / len * R, v[2] / len * R];
          });

          const edges = [
            [0,1],[0,5],[0,7],[0,10],[0,11],
            [1,5],[1,7],[1,8],[1,9],
            [2,3],[2,4],[2,6],[2,10],[2,11],
            [3,4],[3,6],[3,8],[3,9],
            [4,5],[4,9],[4,11],
            [5,9],[5,11],
            [6,7],[6,8],[6,10],
            [7,8],[7,10],
            [8,9],[10,11]
          ];

          function renderFrame(timeSec) {
            ctx.clearRect(0, 0, W, H);
            const angX = timeSec * 0.6;
            const angY = timeSec * 0.85;
            const cosX = Math.cos(angX), sinX = Math.sin(angX);
            const cosY = Math.cos(angY), sinY = Math.sin(angY);

            const proj = baseVerts.map(v => {
              const x1 = v[0] * cosY + v[2] * sinY;
              const z1 = -v[0] * sinY + v[2] * cosY;
              const y2 = v[1] * cosX - z1 * sinX;
              const z2 = v[1] * sinX + z1 * cosX;
              const fov = 450;
              const scale = fov / (fov + z2);
              return { x: cx + x1 * scale, y: cy + y2 * scale, z: z2, s: scale };
            });

            ctx.lineWidth = 2;
            edges.forEach(([a, b]) => {
              const pA = proj[a];
              const pB = proj[b];
              const avgZ = (pA.z + pB.z) / 2;
              const alpha = Math.max(0.15, Math.min(0.9, (avgZ + R) / (2 * R)));
              ctx.strokeStyle = accent;
              ctx.globalAlpha = alpha;
              ctx.beginPath();
              ctx.moveTo(pA.x, pA.y);
              ctx.lineTo(pB.x, pB.y);
              ctx.stroke();
            });

            proj.forEach(p => {
              ctx.globalAlpha = Math.max(0.4, p.s);
              ctx.fillStyle = "#ffffff";
              ctx.beginPath();
              ctx.arc(p.x, p.y, 4 * p.s, 0, Math.PI * 2);
              ctx.fill();
            });

            const pCount = 14;
            for (let k = 0; k < pCount; k++) {
              const pAng = (k / pCount) * Math.PI * 2 + timeSec * 1.2;
              const pRad = R * 1.5;
              const px = Math.cos(pAng) * pRad;
              const pz = Math.sin(pAng) * pRad;
              const py = Math.sin(pAng * 2) * (R * 0.4);
              const px1 = px * cosY + pz * sinY;
              const pz1 = -px * sinY + pz * cosY;
              const py2 = py * cosX - pz1 * sinX;
              const pz2 = py * sinX + pz1 * cosX;
              const scale = 450 / (450 + pz2);
              const screenX = cx + px1 * scale;
              const screenY = cy + py2 * scale;
              ctx.globalAlpha = Math.max(0.2, Math.min(0.85, (pz2 + R) / (2 * R)));
              ctx.fillStyle = accent;
              ctx.beginPath();
              ctx.arc(screenX, screenY, 3 * scale, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.globalAlpha = 1;
          }

          renderFrame(0);
          tl.to({ t: 0 }, {
            t: ${Number(sDur)},
            duration: ${Number(sDur)},
            ease: "none",
            onUpdate: function () {
              renderFrame(tl.time());
            }
          }, 0);
        })();
      `,
    };
  },
  renderCss: ({ scene, isPortrait, activePalette }) => `
    [data-composition-id="${scene.id}"] .hero3d-stage { justify-content: center; align-items: center; text-align: center; }
    [data-composition-id="${scene.id}"] .hero3d-title { max-width: min(1000px, 90vw); margin-bottom: 8px; }
    [data-composition-id="${scene.id}"] .hero3d-sub { font-family: "JetBrains Mono", monospace; font-size: 16px; color: ${activePalette.textMuted || "#888"}; margin-bottom: 16px; }
    [data-composition-id="${scene.id}"] .hero3d-canvas-wrap { position: relative; display: flex; justify-content: center; align-items: center; margin-top: ${isPortrait ? "16px" : "20px"}; }
    [data-composition-id="${scene.id}"] .hero3d-canvas { position: relative; z-index: 2; border-radius: 20px; }
    [data-composition-id="${scene.id}"] .hero3d-halo { position: absolute; inset: -40px; border-radius: 50%; background: radial-gradient(circle, ${activePalette.accent}20 0%, transparent 70%); pointer-events: none; z-index: 1; }
  `,
});

// 60. Code Slice Reveal
registerArchetypeRenderer("code-slice-reveal", {
  getBackground: ({ activePalette }) =>
    `background: radial-gradient(circle at 75% 25%, ${activePalette.accent}14 0%, transparent 60%), ${activePalette.background};`,
  renderHtml: ({ scene, i, isPortrait, h }) => {
    const rawSlice = scene.sliceData;
    const filename = rawSlice?.filename || "pipeline.ts";
    const language = rawSlice?.language || "TypeScript";
    const diffTag = rawSlice?.diffTag || "FEATURE";
    const rawLines =
      Array.isArray(rawSlice?.lines) && rawSlice.lines.length > 0
        ? rawSlice.lines
        : [
            "export async function processFrame(seq: number): Promise<Buffer> {",
            "  const render = await orchestrator.execute(seq);",
            "  validateInvariant(render.status === 'READY');",
            "  return streamCodec.encode(render.buffer);",
          ];
    const output = rawSlice?.output || "Pipeline state verified (0 errors)";

    const formattedLines = rawLines
      .map((line, idx) => {
        const prefix = idx === 1 ? "+" : idx === 2 ? "+" : " ";
        const lineClass = prefix === "+" ? "diff-add" : "diff-ctx";
        return `
        <div class="code-line ${lineClass}">
          <span class="line-num">${idx + 1}</span>
          <span class="line-prefix">${prefix}</span>
          <span class="line-code">${highlightCodeTokens(line)}</span>
        </div>
      `;
      })
      .join("");

    return {
      innerHtml: `
        <div class="scene-inner code-slice-stage">
          <div id="s${i + 1}-eyebrow" class="eyebrow"><span class="eyebrow-dot"></span><span>${h(scene.eyebrow || "SYNTAX MATRIX")}</span></div>
          <h1 id="s${i + 1}-title" class="editorial-title" style="font-size: ${isPortrait ? "42px" : "56px"}">${h(scene.title)}</h1>
          <div class="code-slice-grid">
            <div class="code-editor-pane">
              <div class="editor-header">
                <div class="editor-dots">
                  <span class="dot dot-r"></span>
                  <span class="dot dot-y"></span>
                  <span class="dot dot-g"></span>
                </div>
                <div class="editor-tab">
                  <span class="tab-icon">📄</span>
                  <span class="tab-name">${h(filename)}</span>
                </div>
                <span class="diff-badge">${h(diffTag)}</span>
              </div>
              <div class="editor-body">
                ${formattedLines}
              </div>
            </div>
            <div class="code-terminal-pane">
              <div class="terminal-header">
                <span class="term-pulse"></span>
                <span class="term-title">RUNTIME CONSOLE · ${h(language)}</span>
              </div>
              <div class="terminal-body">
                <div class="term-row"><span class="term-prompt">$</span> <span>bun test --filter pipeline</span></div>
                <div class="term-row term-pass"><span>✔</span> <span>${h(output)}</span></div>
                <div class="term-row term-meta"><span>→</span> <span>Latency: 18ms · Allocation: verified</span></div>
              </div>
            </div>
          </div>
        </div>
      `,
      gsapChoreography: `
        tl.from(scope.querySelector("#s${i + 1}-eyebrow"), { opacity: 0, y: 16, duration: 0.5 }, 0.2);
        tl.from(scope.querySelector("#s${i + 1}-title"), { opacity: 0, y: 22, duration: 0.6 }, 0.35);
        tl.from(scope.querySelector(".code-editor-pane"), { opacity: 0, y: 24, duration: 0.7 }, 0.45);
        tl.from(scope.querySelectorAll(".code-line"), { opacity: 0, x: -14, stagger: 0.1, duration: 0.4 }, 0.65);
        tl.from(scope.querySelector(".code-terminal-pane"), { opacity: 0, y: 20, duration: 0.5 }, 0.85);
        tl.from(scope.querySelectorAll(".term-row"), { opacity: 0, y: 10, stagger: 0.12, duration: 0.35 }, 1.05);
      `,
    };
  },
  renderCss: ({ scene, isPortrait, activePalette }) => `
    [data-composition-id="${scene.id}"] .code-slice-stage { justify-content: center; align-items: center; text-align: center; }
    [data-composition-id="${scene.id}"] .code-slice-grid { width: min(1180px, 88vw); margin-top: ${isPortrait ? "20px" : "36px"}; display: flex; flex-direction: column; gap: 20px; text-align: left; }
    [data-composition-id="${scene.id}"] .code-editor-pane { background: ${activePalette.card}; border: 1.5px solid ${activePalette.border}; border-radius: 18px; overflow: hidden; box-shadow: 0 16px 45px rgba(0,0,0,0.45); }
    [data-composition-id="${scene.id}"] .editor-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 18px; background: rgba(0,0,0,0.25); border-bottom: 1px solid ${activePalette.border}; }
    [data-composition-id="${scene.id}"] .editor-dots { display: flex; gap: 8px; }
    [data-composition-id="${scene.id}"] .editor-dots .dot { width: 11px; height: 11px; border-radius: 50%; }
    [data-composition-id="${scene.id}"] .dot-r { background: #ff5f56; }
    [data-composition-id="${scene.id}"] .dot-y { background: #ffbd2e; }
    [data-composition-id="${scene.id}"] .dot-g { background: #27c93f; }
    [data-composition-id="${scene.id}"] .editor-tab { display: flex; align-items: center; gap: 8px; font-family: "JetBrains Mono", monospace; font-size: 13px; font-weight: 800; color: ${activePalette.text}; }
    [data-composition-id="${scene.id}"] .diff-badge { font-family: "JetBrains Mono", monospace; font-size: 11px; font-weight: 800; color: #4ade80; background: rgba(74, 222, 128, 0.15); padding: 3px 8px; border-radius: 6px; }
    [data-composition-id="${scene.id}"] .editor-body { padding: 18px 22px; display: flex; flex-direction: column; gap: 6px; }
    [data-composition-id="${scene.id}"] .code-line { display: flex; align-items: center; gap: 14px; font-family: "JetBrains Mono", monospace; font-size: ${isPortrait ? "13px" : "15px"}; }
    [data-composition-id="${scene.id}"] .diff-add { background: rgba(74, 222, 128, 0.08); border-radius: 4px; }
    [data-composition-id="${scene.id}"] .line-num { font-size: 12px; color: ${activePalette.textMuted || "#666"}; width: 22px; text-align: right; user-select: none; }
    [data-composition-id="${scene.id}"] .line-prefix { font-size: 13px; font-weight: 800; width: 12px; }
    [data-composition-id="${scene.id}"] .diff-add .line-prefix { color: #4ade80; }
    [data-composition-id="${scene.id}"] .line-code { color: ${activePalette.text}; }
    [data-composition-id="${scene.id}"] .code-terminal-pane { background: #070913; border: 1.5px solid ${activePalette.border}; border-radius: 16px; padding: 16px 20px; }
    [data-composition-id="${scene.id}"] .terminal-header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; font-family: "JetBrains Mono", monospace; font-size: 12px; font-weight: 800; color: ${activePalette.textMuted || "#888"}; }
    [data-composition-id="${scene.id}"] .term-pulse { width: 8px; height: 8px; border-radius: 50%; background: #4ade80; box-shadow: 0 0 8px #4ade80; }
    [data-composition-id="${scene.id}"] .terminal-body { display: flex; flex-direction: column; gap: 6px; font-family: "JetBrains Mono", monospace; font-size: 13px; }
    [data-composition-id="${scene.id}"] .term-row { display: flex; gap: 10px; color: ${activePalette.textMuted || "#bbb"}; }
    [data-composition-id="${scene.id}"] .term-prompt { color: ${activePalette.accent}; font-weight: 800; }
    [data-composition-id="${scene.id}"] .term-pass { color: #4ade80; font-weight: 800; }
    [data-composition-id="${scene.id}"] .term-meta { color: ${activePalette.textMuted || "#666"}; font-size: 12px; }
  `,
});

// Split Stage Hero — cinematic split product showcase with real screenshot viewport and vector UI fallback.
registerArchetypeRenderer("split-stage-hero", {
  getBackground: ({ activePalette, scene }) =>
    scene?.theme === "dark" || activePalette?.isDark
      ? `background: radial-gradient(ellipse at 80% 30%, ${activePalette.accent}25 0%, transparent 60%), radial-gradient(circle at 20% 80%, ${activePalette.accent}12 0%, transparent 50%), #080a10;`
      : `background: radial-gradient(ellipse at 75% 30%, ${activePalette.accent}18 0%, transparent 60%), linear-gradient(135deg, ${activePalette.card} 0%, ${activePalette.background} 100%);`,
  renderHtml: ({ scene, i, isPortrait, h, sDur, activePalette }) => {
    const rawHighlights = scene.heroData?.highlights || scene.pills;
    const highlights = (
      Array.isArray(rawHighlights) && rawHighlights.length
        ? rawHighlights
        : [
            { text: synthesizeFallbackText(scene, "feature", 0) },
            { text: synthesizeFallbackText(scene, "feature", 1) },
            { text: synthesizeFallbackText(scene, "feature", 2) },
          ]
    ).slice(0, 3);

    const highlightsHtml = highlights
      .map((item, idx) => {
        const text = typeof item === "string" ? item : item?.text || "";
        return `
          <div class="split-pill split-pill-${idx}">
            <span class="split-pill-dot"></span>
            <span class="split-pill-text">${h(text)}</span>
          </div>`;
      })
      .join("\n");

    const appTitle = scene.heroData?.appTitle || scene.title || "Product Workspace";
    const appUrl = scene.heroData?.url || scene.eyebrow || "https://platform.io/app";
    const screenshotUrl = scene.screenshotPath || scene.heroData?.screenshotUrl;

    const mockupContentHtml = screenshotUrl
      ? `<div class="mockup-viewport">
           <img src="${screenshotUrl}" class="mockup-screenshot-img" alt="Product Live View" />
         </div>`
      : `<div class="mockup-vector-ui">
           <div class="mockup-top-nav">
             <div class="mockup-brand"><span class="brand-glyph">✦</span><span>${h(appTitle)}</span></div>
             <div class="mockup-nav-links">
               <span class="mockup-link active">Overview</span>
               <span class="mockup-link">Analytics</span>
               <span class="mockup-link">Engine</span>
             </div>
             <div class="mockup-status-badge">CONNECTED</div>
           </div>
           <div class="mockup-body-grid">
             <div class="mockup-card-primary">
               <span class="mockup-label">REAL-TIME PIPELINE</span>
               <div class="mockup-big-val">99.98%</div>
               <div class="mockup-chart-bars">
                 <div class="m-bar" style="height: 45%;"></div>
                 <div class="m-bar" style="height: 70%;"></div>
                 <div class="m-bar" style="height: 60%;"></div>
                 <div class="m-bar" style="height: 85%;"></div>
                 <div class="m-bar m-bar-hi" style="height: 100%;"></div>
               </div>
             </div>
             <div class="mockup-card-secondary">
               <span class="mockup-label">EXECUTION LATENCY</span>
               <div class="mockup-small-val">12.4ms</div>
               <div class="mockup-stream-line"><span class="dot-green"></span><span>Streaming 120 fps</span></div>
               <div class="mockup-stream-line"><span class="dot-blue"></span><span>Model weights synced</span></div>
             </div>
           </div>
         </div>`;

    const animDur = Math.max(1, sDur - 1.6);
    return {
      innerHtml: `
        <div class="scene-inner split-stage-wrapper">
          <div class="split-hero-container">
            <div class="split-hero-copy">
              <div id="s${i + 1}-eyebrow" class="eyebrow">
                <span class="eyebrow-dot"></span>
                <span>${h(scene.eyebrow || "PRODUCT OVERVIEW")}</span>
              </div>
              <h1 id="s${i + 1}-title" class="editorial-title split-hero-title" style="font-size: ${isPortrait ? "48px" : "64px"}; color: ${activePalette.text};">${h(scene.title)}</h1>
              <p id="s${i + 1}-subtitle" class="editorial-subtitle split-hero-subtitle">${h(scene.subtitle || scene.narration || "")}</p>
              <div id="s${i + 1}-pills" class="split-pills-row">
                ${highlightsHtml}
              </div>
            </div>
            <div class="split-hero-visual">
              <div id="s${i + 1}-mockup" class="browser-mockup-frame">
                <div class="browser-header">
                  <div class="browser-dots">
                    <span class="b-dot b-dot-r"></span>
                    <span class="b-dot b-dot-y"></span>
                    <span class="b-dot b-dot-g"></span>
                  </div>
                  <div class="browser-address-bar">
                    <span class="lock-icon">🔒</span>
                    <span class="browser-url">${h(appUrl)}</span>
                  </div>
                  <div class="browser-action-icon">⋯</div>
                </div>
                <div class="browser-screen">
                  ${mockupContentHtml}
                </div>
              </div>
            </div>
          </div>
        </div>
      `,
      gsapChoreography: `
        tl.from(scope.querySelector("#s${i + 1}-eyebrow"), { opacity: 0, y: 18, duration: 0.45 }, 0.2);
        tl.from(scope.querySelector("#s${i + 1}-title"), { opacity: 0, y: 26, duration: 0.6, ease: "power3.out" }, 0.35);
        tl.from(scope.querySelector("#s${i + 1}-subtitle"), { opacity: 0, y: 20, duration: 0.55 }, 0.55);
        tl.from(scope.querySelectorAll(".split-pill"), { opacity: 0, y: 15, scale: 0.95, stagger: 0.1, duration: 0.45, ease: "back.out(1.15)" }, 0.7);
        tl.from(scope.querySelector("#s${i + 1}-mockup"), { opacity: 0, y: 50, scale: 0.92, duration: 0.75, ease: "back.out(1.15)" }, 0.4);
        ${
          screenshotUrl
            ? `const scrImg = scope.querySelector(".mockup-screenshot-img");
               if (scrImg) {
                 tl.fromTo(scrImg, { y: 0 }, { y: -65, duration: ${animDur}, ease: "power1.inOut" }, 1.2);
               }`
            : `tl.from(scope.querySelectorAll(".mockup-card-primary, .mockup-card-secondary"), { opacity: 0, y: 20, stagger: 0.15, duration: 0.5, ease: "back.out(1.15)" }, 0.85);
               tl.fromTo(scope.querySelectorAll(".m-bar"), { scaleY: 0, transformOrigin: "bottom" }, { scaleY: 1, stagger: 0.08, duration: 0.6, ease: "power2.out" }, 1.1);`
        }
      `,
    };
  },
  renderCss: ({ scene, isPortrait, activePalette }) => `
    [data-composition-id="${scene.id}"] .split-stage-wrapper { justify-content: center; align-items: center; width: 100%; height: 100%; padding: ${isPortrait ? "80px 36px" : "60px 80px"}; }
    [data-composition-id="${scene.id}"] .split-hero-container { display: flex; flex-direction: ${isPortrait ? "column" : "row"}; align-items: center; justify-content: space-between; gap: ${isPortrait ? "36px" : "54px"}; width: 100%; max-width: 1720px; }
    [data-composition-id="${scene.id}"] .split-hero-copy { flex: 1; display: flex; flex-direction: column; align-items: ${isPortrait ? "center" : "flex-start"}; text-align: ${isPortrait ? "center" : "left"}; }
    [data-composition-id="${scene.id}"] .split-hero-title { font-size: ${isPortrait ? "50px" : "64px"}; text-align: ${isPortrait ? "center" : "left"}; max-width: 760px; line-height: 1.15; }
    [data-composition-id="${scene.id}"] .split-hero-subtitle { font-size: ${isPortrait ? "24px" : "28px"}; text-align: ${isPortrait ? "center" : "left"}; max-width: 700px; margin-top: 16px; color: ${activePalette.textMuted || activePalette.muted}; }
    [data-composition-id="${scene.id}"] .split-pills-row { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 28px; justify-content: ${isPortrait ? "center" : "flex-start"}; }
    [data-composition-id="${scene.id}"] .split-pill { display: flex; align-items: center; gap: 10px; background: ${activePalette.card || "rgba(255,255,255,0.06)"}; border: 1.5px solid ${activePalette.border || "rgba(255,255,255,0.14)"}; padding: 10px 18px; border-radius: 999px; box-shadow: 0 4px 14px rgba(0,0,0,0.18); }
    [data-composition-id="${scene.id}"] .split-pill-dot { width: 8px; height: 8px; border-radius: 50%; background: ${activePalette.accent}; box-shadow: 0 0 8px ${activePalette.accent}; }
    [data-composition-id="${scene.id}"] .split-pill-text { font-family: "Plus Jakarta Sans", sans-serif; font-size: 16px; font-weight: 600; color: ${activePalette.text}; }
    [data-composition-id="${scene.id}"] .split-hero-visual { flex: ${isPortrait ? "none" : "1.2"}; width: ${isPortrait ? "100%" : "auto"}; max-width: ${isPortrait ? "680px" : "900px"}; display: flex; justify-content: center; }
    [data-composition-id="${scene.id}"] .browser-mockup-frame { width: 100%; background: #0c0f17; border-radius: 20px; border: 1.5px solid rgba(255,255,255,0.15); box-shadow: 0 32px 80px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.06); overflow: hidden; transform: perspective(1000px) rotateY(-2deg) rotateX(2deg); }
    [data-composition-id="${scene.id}"] .browser-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; background: #131722; border-bottom: 1px solid rgba(255,255,255,0.1); }
    [data-composition-id="${scene.id}"] .browser-dots { display: flex; gap: 8px; }
    [data-composition-id="${scene.id}"] .b-dot { width: 12px; height: 12px; border-radius: 50%; }
    [data-composition-id="${scene.id}"] .b-dot-r { background: #ff5f56; }
    [data-composition-id="${scene.id}"] .b-dot-y { background: #ffbd2e; }
    [data-composition-id="${scene.id}"] .b-dot-g { background: #27c93f; }
    [data-composition-id="${scene.id}"] .browser-address-bar { display: flex; align-items: center; gap: 8px; background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.08); padding: 5px 16px; border-radius: 8px; font-family: "JetBrains Mono", monospace; font-size: 13px; color: ${activePalette.textMuted || "#999"}; min-width: 260px; max-width: 420px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    [data-composition-id="${scene.id}"] .lock-icon { font-size: 11px; }
    [data-composition-id="${scene.id}"] .browser-action-icon { color: #666; font-size: 18px; }
    [data-composition-id="${scene.id}"] .browser-screen { height: ${isPortrait ? "360px" : "480px"}; overflow: hidden; background: #070911; position: relative; }
    [data-composition-id="${scene.id}"] .mockup-viewport { width: 100%; height: 100%; overflow: hidden; position: relative; }
    [data-composition-id="${scene.id}"] .mockup-screenshot-img { width: 100%; height: auto; min-height: 100%; display: block; object-fit: cover; object-position: top; }
    [data-composition-id="${scene.id}"] .mockup-vector-ui { padding: 24px; display: flex; flex-direction: column; gap: 20px; height: 100%; box-sizing: border-box; }
    [data-composition-id="${scene.id}"] .mockup-top-nav { display: flex; align-items: center; justify-content: space-between; padding-bottom: 14px; border-bottom: 1px solid rgba(255,255,255,0.08); }
    [data-composition-id="${scene.id}"] .mockup-brand { display: flex; align-items: center; gap: 8px; font-family: "Plus Jakarta Sans", sans-serif; font-size: 15px; font-weight: 700; color: #fff; }
    [data-composition-id="${scene.id}"] .brand-glyph { color: ${activePalette.accent}; }
    [data-composition-id="${scene.id}"] .mockup-nav-links { display: flex; gap: 16px; font-size: 13px; color: #888; font-weight: 600; }
    [data-composition-id="${scene.id}"] .mockup-link.active { color: ${activePalette.accent}; }
    [data-composition-id="${scene.id}"] .mockup-status-badge { font-family: "JetBrains Mono", monospace; font-size: 11px; font-weight: 800; color: #4ade80; background: rgba(74,222,128,0.12); padding: 3px 10px; border-radius: 999px; }
    [data-composition-id="${scene.id}"] .mockup-body-grid { display: grid; grid-template-columns: 1.4fr 1fr; gap: 18px; flex: 1; }
    [data-composition-id="${scene.id}"] .mockup-card-primary, [data-composition-id="${scene.id}"] .mockup-card-secondary { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 18px; display: flex; flex-direction: column; justify-content: space-between; }
    [data-composition-id="${scene.id}"] .mockup-label { font-family: "JetBrains Mono", monospace; font-size: 11px; font-weight: 700; color: #888; letter-spacing: 0.08em; }
    [data-composition-id="${scene.id}"] .mockup-big-val { font-size: 40px; font-weight: 800; color: #fff; line-height: 1.1; margin: 8px 0; }
    [data-composition-id="${scene.id}"] .mockup-small-val { font-size: 28px; font-weight: 800; color: ${activePalette.accent}; line-height: 1.1; margin: 6px 0; }
    [data-composition-id="${scene.id}"] .mockup-chart-bars { display: flex; align-items: flex-end; gap: 10px; height: 60px; }
    [data-composition-id="${scene.id}"] .m-bar { flex: 1; background: rgba(255,255,255,0.12); border-radius: 4px 4px 0 0; }
    [data-composition-id="${scene.id}"] .m-bar-hi { background: ${activePalette.accent}; box-shadow: 0 0 12px ${activePalette.accent}88; }
    [data-composition-id="${scene.id}"] .mockup-stream-line { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #bbb; }
    [data-composition-id="${scene.id}"] .dot-green { width: 6px; height: 6px; border-radius: 50%; background: #4ade80; }
    [data-composition-id="${scene.id}"] .dot-blue { width: 6px; height: 6px; border-radius: 50%; background: #60a5fa; }
  `,
});
