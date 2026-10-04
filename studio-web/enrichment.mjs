/**
 * Payload enrichment for archetypes the director left empty.
 *
 * Every string produced here is derived from the scene's own title / subtitle / narration
 * (see fallbackText.mjs) or is a neutral structural token. Nothing in this file names a
 * subject, technology, benchmark or algorithm, so a fallback can never leak one topic's
 * vocabulary into another topic's video.
 */
import { synthesizeFallbackText as say, synthesizeFallbackNumber } from "./fallbackText.mjs";

const has = (list) => Array.isArray(list) && list.length > 0;
const pad2 = (n) => String(n).padStart(2, "0");
const three = [0, 1, 2];
const four = [0, 1, 2, 3];

/** Each builder returns the payload fields to merge, or null when the scene already has them. */
const BUILDERS = {
  "flowchart-process": (s, t, cap) =>
    has(s.flowData?.steps)
      ? null
      : {
          flowData: {
            steps: three.map((k) => ({
              stepNumber: pad2(k + 1),
              title: k === 1 && t ? t : say(s, "step", k),
              desc: cap(k),
              isHighlighted: k === 1,
            })),
          },
        },
  "kpi-counter-ring": (s, t, cap) => ({
    kpiData: {
      value: String(synthesizeFallbackNumber(s, 0)),
      label: t || say(s, "metric", 0),
      trend: say(s, "metric", 1),
      progress: 75,
      subtitle: cap(0) || say(s, "target", 0),
      ...(s.kpiData || {}),
    },
  }),
  "interactive-diff": (s) => ({
    diffData: {
      titleLeft: say(s, "state", 1),
      badgeLeft: say(s, "index", 1),
      linesLeft: three.map((k) => say(s, "state", 1 + k)),
      titleRight: say(s, "state", 0),
      badgeRight: say(s, "index", 0),
      linesRight: three.map((k) => say(s, "target", k)),
      ...(s.diffData || {}),
    },
  }),
  "code-terminal": (s, t, cap) => ({
    codeDemo: {
      filename: "example.txt",
      language: "Text",
      lines: four.map((k) => cap(k) || say(s, "step", k)),
      output: cap(4) || say(s, "state", 0),
      ...(s.codeDemo || {}),
    },
  }),
  "kinetic-text": (s, t, cap) => {
    if (s.kineticData) return null;
    const words = t.split(/\s+/).filter(Boolean);
    return {
      kineticData: {
        badge: say(s, "index", 0),
        mainWord: (words[0] || say(s, "metric", 0)).toUpperCase(),
        accentWord: (words.slice(1, 3).join(" ") || say(s, "target", 0)).toUpperCase(),
        subtitle: s.subtitle || cap(0),
      },
    };
  },
  "radial-orbit": (s, t, cap) =>
    has(s.orbitData?.satellites)
      ? null
      : {
          orbitData: {
            centerTitle: t || say(s, "node", 0),
            centerSub: say(s, "node", 0),
            satellites: four.map((k) => ({ label: say(s, "node", k + 1), desc: cap(k) })),
          },
        },
  "step-ladder": (s, t, cap) =>
    has(s.stepData?.steps)
      ? null
      : {
          stepData: {
            steps: three.map((k) => ({
              stepNumber: pad2(k + 1),
              title: k === 1 && t ? t : say(s, "step", k),
              desc: cap(k),
              status: k === 2 ? "Complete" : "Active",
            })),
          },
        },
  "live-feed": (s, t, cap) =>
    has(s.feedData?.items)
      ? null
      : {
          feedData: {
            items: four.map((k) => ({
              icon: "●",
              text: k === 0 && t ? t : cap(k) || say(s, "state", k),
              tag: say(s, "index", k),
              status: k === 0 ? "Active" : "Observed",
            })),
          },
        },
  "isometric-stack": (s, t, cap) =>
    has(s.stackData?.layers)
      ? null
      : {
          stackData: {
            layers: three.map((k) => ({
              name: k === 1 && t ? t : say(s, "node", k),
              tech: say(s, "index", k),
              role: cap(k) || say(s, "state", k),
            })),
          },
        },
};

Object.assign(BUILDERS, {
  "data-graph": (s, t) => {
    if (has(s.chartData?.bars)) return null;
    const nums = four.map((k) => synthesizeFallbackNumber(s, k));
    const top = Math.max(...nums, 1);
    return {
      chartData: {
        title: t || say(s, "metric", 0),
        badge: say(s, "target", 0),
        bars: nums.map((n, k) => ({
          label: say(s, "metric", k),
          value: String(n),
          height: Math.max(12, Math.round((n / top) * 90)),
        })),
      },
    };
  },
  "bento-grid": (s, t, cap) =>
    s.bento
      ? null
      : {
          bento: {
            mainCard: {
              title: t || say(s, "metric", 0),
              desc: s.subtitle || cap(0),
              badge: say(s, "index", 0),
            },
            subCard1: { title: say(s, "metric", 1), badge: say(s, "index", 1) },
            subCard2: { title: say(s, "metric", 2), badge: say(s, "index", 2) },
          },
        },
  "quote-callout": (s, t, cap) =>
    s.quoteData
      ? null
      : {
          quoteData: {
            quote: s.subtitle || cap(0) || t,
            author: t || say(s, "node", 0),
            context: say(s, "state", 0),
            badge: say(s, "index", 0),
          },
        },
  "chat-exchange": (s, t, cap) =>
    has(s.chatData?.messages)
      ? null
      : {
          chatData: {
            channelName: t || say(s, "node", 0),
            messages: three.map((k) => ({
              sender: say(s, "node", k),
              text: cap(k) || say(s, "state", k),
              isAi: k > 0,
              time: "",
            })),
          },
        },
  "bento-metric-grid": (s, t) =>
    has(s.bentoData?.metrics)
      ? null
      : {
          bentoData: {
            metrics: three.map((k) => ({
              label: k === 0 && t ? t : say(s, "metric", k),
              value: synthesizeFallbackNumber(s, k),
              unit: "",
              detail: "",
              hero: k === 0,
            })),
          },
        },
  "terminal-flow": (s, t, cap) =>
    has(s.terminalData?.lines)
      ? null
      : {
          terminalData: {
            bullets: three.map((k) => ({ text: k === 0 && t ? t : cap(k) })).filter((b) => b.text),
            lines: three.map((k) => ({ prompt: ">", text: say(s, "step", k), output: cap(k) })),
          },
        },
  "step-progression": (s, t, cap) =>
    has(s.progressData?.steps)
      ? null
      : {
          progressData: {
            steps: three.map((k) => ({
              label: say(s, "step", k),
              caption: k === 0 && t ? t : cap(k),
            })),
          },
        },
  "vector-cluster-graph": (s) => ({
    queryLabel:
      typeof s.queryLabel === "string" && s.queryLabel.trim()
        ? s.queryLabel.trim()
        : say(s, "node", 0),
    ...(has(s.clusters)
      ? {}
      : {
          clusters: three.map((k) => ({
            name: say(s, "node", k),
            nodeCount: [16, 9, 12][k],
            active: k === 0,
          })),
        }),
    ...(s.stats && typeof s.stats === "object"
      ? {}
      : { stats: { metric: say(s, "state", 0), latency: say(s, "target", 0) } }),
  }),
});

/** Returns a copy of `scene` whose archetype payload is guaranteed non-empty. */
export function enrichScene(scene, archetype) {
  const title = typeof scene.title === "string" ? scene.title.trim() : "";
  const cap = (k) => say(scene, "caption", k);
  const patch = BUILDERS[archetype]?.(scene, title, cap);
  return patch ? { ...scene, ...patch } : { ...scene };
}
