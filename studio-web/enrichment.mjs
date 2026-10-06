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
  "rag-retrieval-pipeline": (s, t, cap) =>
    has(s.ragData?.stages)
      ? null
      : {
          ragData: {
            queryText: t || say(s, "target", 0),
            retrievedCount: synthesizeFallbackNumber(s, 0) || 5,
            stages: [0, 1, 2, 3, 4].map((k) => ({
              name: say(s, "step", k),
              detail: cap(k) || say(s, "state", k),
            })),
          },
        },
  "agent-scratchpad": (s, t, cap) =>
    has(s.agentData?.steps)
      ? null
      : {
          agentData: {
            steps: [
              { type: "thought", content: cap(0) || say(s, "state", 0), meta: say(s, "step", 0) },
              { type: "action", content: t || say(s, "target", 0), meta: say(s, "step", 1) },
              {
                type: "observation",
                content: cap(1) || say(s, "metric", 0),
                meta: say(s, "step", 2),
              },
              { type: "answer", content: cap(2) || say(s, "state", 1), meta: say(s, "step", 3) },
            ],
          },
        },
  "prompt-budget-canvas": (s) =>
    has(s.budgetData?.segments)
      ? null
      : {
          budgetData: {
            totalTokens: (synthesizeFallbackNumber(s, 0) || 8) * 1000,
            segments: [
              { label: say(s, "node", 0), tokens: 1500 },
              { label: say(s, "node", 1), tokens: 2500 },
              { label: say(s, "node", 2), tokens: 2000 },
              { label: say(s, "node", 3), tokens: 2000 },
            ],
          },
        },
  "embedding-similarity-space": (s, t) =>
    has(s.similarityData?.candidates)
      ? null
      : {
          similarityData: {
            queryLabel: t || say(s, "target", 0),
            candidates: three.map((k) => ({
              label: say(s, "node", k),
              score: 0.95 - k * 0.12,
              match: k === 0,
            })),
          },
        },
  "tool-calling-schema": (s, t, cap) =>
    s.toolData
      ? null
      : {
          toolData: {
            functionName: (t || say(s, "node", 0)).toLowerCase().replace(/[^a-z0-9]/g, "_"),
            description: cap(0) || say(s, "state", 0),
            parameters: three.map((k) => ({
              name: say(s, "metric", k)
                .toLowerCase()
                .replace(/[^a-z0-9]/g, "_"),
              type: k === 1 ? "number" : "string",
              desc: cap(k) || say(s, "state", k),
              required: k === 0,
            })),
          },
        },
  "context-window-gauge": (s, t) =>
    s.gaugeData
      ? null
      : {
          gaugeData: {
            currentTokens: (synthesizeFallbackNumber(s, 0) || 64) * 1000,
            maxTokens: 128000,
            label: t || say(s, "target", 0),
            status: "safe",
          },
        },
  "eval-benchmark-matrix": (s) =>
    has(s.benchmarkData?.benchmarks)
      ? null
      : {
          benchmarkData: {
            benchmarks: three.map((k) => ({
              name: say(s, "metric", k),
              scores: [
                { model: say(s, "node", 0), score: 88 - k * 4, isHero: true },
                { model: say(s, "node", 1), score: 76 - k * 5 },
                { model: say(s, "node", 2), score: 68 - k * 3 },
              ],
            })),
          },
        },
  "data-lineage-flow": (s, t, cap) =>
    has(s.lineageData?.stages)
      ? null
      : {
          lineageData: {
            stages: four.map((k) => ({
              title: say(s, "node", k),
              subtitle: cap(k) || say(s, "state", k),
              items: [say(s, "metric", k), say(s, "target", k)],
            })),
          },
        },
  "microservice-mesh": (s, t) =>
    has(s.meshData?.nodes)
      ? null
      : {
          meshData: {
            nodes: [
              { id: "gateway", label: t || say(s, "node", 0), role: "Gateway", status: "ok" },
              { id: "srv1", label: say(s, "node", 1), role: "Service A", status: "ok" },
              { id: "srv2", label: say(s, "node", 2), role: "Service B", status: "ok" },
              { id: "srv3", label: say(s, "node", 3), role: "Service C", status: "ok" },
            ],
            links: [
              { from: "gateway", to: "srv1", label: "2ms" },
              { from: "gateway", to: "srv2", label: "5ms" },
              { from: "srv2", to: "srv3", label: "8ms" },
            ],
          },
        },
  "database-shard-map": (s, t) =>
    has(s.shardData?.shards)
      ? null
      : {
          shardData: {
            routerKey: t || say(s, "index", 0),
            shards: three.map((k) => ({
              name: `${say(s, "node", k)}`,
              range: `[0x${k * 40}..0x${(k + 1) * 40}]`,
              count: synthesizeFallbackNumber(s, k) || (k + 1) * 12,
              active: k === 0,
            })),
          },
        },
  "memory-layout-stack": (s) =>
    s.memoryData
      ? null
      : {
          memoryData: {
            stackFrames: three.map((k) => ({
              func: say(s, "step", k),
              vars: [say(s, "metric", k), say(s, "target", k)],
            })),
            heapObjects: three.map((k) => ({
              addr: `0x7ffe${k}0`,
              label: say(s, "node", k),
            })),
          },
        },
  "dag-pipeline": (s, t) =>
    has(s.dagData?.nodes)
      ? null
      : {
          dagData: {
            nodes: [
              { id: "n1", label: t || say(s, "step", 0), status: "done" },
              { id: "n2", label: say(s, "step", 1), status: "running" },
              { id: "n3", label: say(s, "step", 2), status: "pending" },
              { id: "n4", label: say(s, "step", 3), status: "pending" },
            ],
            edges: [
              ["n1", "n2"],
              ["n1", "n3"],
              ["n2", "n4"],
              ["n3", "n4"],
            ],
          },
        },
  "event-bus-pubsub": (s, t, cap) =>
    has(s.eventData?.events)
      ? null
      : {
          eventData: {
            topic: t || say(s, "target", 0),
            events: three.map((k) => ({
              id: `evt-${k + 1}`,
              payload: cap(k) || say(s, "state", k),
              targetConsumer: say(s, "node", k),
            })),
          },
        },
  "compiler-ast": (s, t) =>
    s.astData
      ? null
      : {
          astData: {
            root: {
              label: t || say(s, "node", 0),
              children: [
                {
                  label: say(s, "step", 0),
                  children: [{ label: say(s, "metric", 0) }, { label: say(s, "target", 0) }],
                },
                {
                  label: say(s, "step", 1),
                  children: [{ label: say(s, "metric", 1) }],
                },
              ],
            },
          },
        },
  "raft-consensus": () => ({
    consensusData: {
      leaderId: "node-1",
      nodes: [
        { id: "node-1", role: "leader", term: 3, logIndex: 42 },
        { id: "node-2", role: "follower", term: 3, logIndex: 42 },
        { id: "node-3", role: "follower", term: 3, logIndex: 41 },
      ],
    },
  }),
  "git-branch-graph": (s, t) =>
    has(s.gitData?.commits)
      ? null
      : {
          gitData: {
            branches: [
              { name: "main", color: "var(--accent)" },
              {
                name: (say(s, "step", 0) || "feature").toLowerCase().replace(/[^a-z0-9]/g, "-"),
                color: "var(--accent-2)",
              },
            ],
            commits: [
              { id: "c1", branch: "main", message: say(s, "step", 0) },
              { id: "c2", branch: "feature", message: say(s, "step", 1) },
              { id: "c3", branch: "main", message: t || say(s, "step", 2), isMerge: true },
            ],
          },
        },
  "browser-devtools": (s) =>
    has(s.devtoolsData?.requests)
      ? null
      : {
          devtoolsData: {
            tab: "network",
            requests: three.map((k) => ({
              path: `/${say(s, "step", k)
                .toLowerCase()
                .replace(/[^a-z0-9]/g, "-")}`,
              method: k === 0 ? "POST" : "GET",
              status: 200,
              durationMs: 45 + k * 30,
            })),
          },
        },
  "security-threat-model": (s) =>
    has(s.securityData?.zones)
      ? null
      : {
          securityData: {
            zones: [
              { name: say(s, "node", 0), trusted: true },
              { name: say(s, "node", 1), trusted: false },
            ],
            threats: three.map((k) => ({
              label: say(s, "step", k),
              blocked: k !== 1,
            })),
          },
        },
  "kanban-sprint": (s, t) =>
    has(s.kanbanData?.columns)
      ? null
      : {
          kanbanData: {
            columns: [
              {
                name: "Backlog",
                cards: [{ title: say(s, "step", 0), tag: say(s, "target", 0), estimate: "3d" }],
              },
              {
                name: "Active",
                cards: [
                  { title: t || say(s, "step", 1), tag: say(s, "target", 1), estimate: "2d" },
                ],
              },
              {
                name: "Complete",
                cards: [{ title: say(s, "step", 2), tag: say(s, "target", 2), estimate: "1d" }],
              },
            ],
          },
        },
  "changelog-timeline": (s) =>
    has(s.changelogData?.releases)
      ? null
      : {
          changelogData: {
            releases: [
              {
                version: "v2.0",
                date: "Latest",
                highlights: [say(s, "step", 0), say(s, "step", 1)],
                isLatest: true,
              },
              {
                version: "v1.9",
                date: "Stable",
                highlights: [say(s, "step", 2)],
                isLatest: false,
              },
            ],
          },
        },
  "circuit-breaker-status": (s) =>
    s.circuitData
      ? null
      : {
          circuitData: {
            state: "closed",
            failureRate: (synthesizeFallbackNumber(s, 0) || 2) * 0.01,
            threshold: 0.05,
          },
        },
  "rate-limiter-bucket": (s) =>
    s.limiterData
      ? null
      : {
          limiterData: {
            capacity: (synthesizeFallbackNumber(s, 0) || 100) * 10,
            currentTokens: (synthesizeFallbackNumber(s, 1) || 75) * 10,
            refillRate: "50/sec",
            droppedCount: 0,
          },
        },
  "audit-log-stream": (s) =>
    has(s.auditData?.logs)
      ? null
      : {
          auditData: {
            logs: three.map((k) => ({
              timestamp: `10:14:0${k + 1}`,
              actor: `client-${k + 1}`,
              action: say(s, "step", k),
              resource: say(s, "target", k),
              status: "allow",
            })),
          },
        },
  "confusion-matrix": (s) =>
    s.matrixData
      ? null
      : {
          matrixData: {
            tp: synthesizeFallbackNumber(s, 0) || 840,
            fp: synthesizeFallbackNumber(s, 1) || 45,
            fn: synthesizeFallbackNumber(s, 2) || 30,
            tn: synthesizeFallbackNumber(s, 3) || 920,
            metricLabels: { precision: "94.9%", sensitivity: "96.5%" },
          },
        },
  "quantile-distribution": (s) =>
    s.quantileData
      ? null
      : {
          quantileData: {
            p50: synthesizeFallbackNumber(s, 0) || 12,
            p90: synthesizeFallbackNumber(s, 1) || 45,
            p99: synthesizeFallbackNumber(s, 2) || 125,
            unit: "ms",
          },
        },
  "radar-capability": (s) =>
    has(s.radarData?.axes)
      ? null
      : {
          radarData: {
            axes: [0, 1, 2, 3, 4].map((k) => ({ name: say(s, "metric", k), maxVal: 100 })),
            series: [
              { label: "Target", values: [88, 92, 85, 90, 86], isHero: true },
              { label: "Baseline", values: [70, 75, 68, 72, 65], isHero: false },
            ],
          },
        },
  "sankey-cost-flow": (s) =>
    has(s.sankeyData?.streams)
      ? null
      : {
          sankeyData: {
            total: `$${synthesizeFallbackNumber(s, 0) || 50}k`,
            streams: three.map((k) => ({
              source: "Budget",
              target: say(s, "node", k),
              value: (k + 1) * 15,
              label: say(s, "step", k),
            })),
          },
        },
  "cohort-retention-grid": (s) =>
    has(s.cohortData?.cohorts)
      ? null
      : {
          cohortData: {
            cohorts: [
              { label: "Cohort 1", size: 1200, percentages: [100, 78, 65, 58, 52] },
              { label: "Cohort 2", size: 1450, percentages: [100, 82, 70, 63] },
              { label: "Cohort 3", size: 1600, percentages: [100, 85, 74] },
            ],
          },
        },
  "multi-metric-dashboard": (s) =>
    has(s.dashboardData?.metrics)
      ? null
      : {
          dashboardData: {
            metrics: [0, 1, 2, 3].map((k) => ({
              title: say(s, "metric", k),
              value: `${synthesizeFallbackNumber(s, k) || (k + 1) * 25}%`,
              change: `+${k + 2}.4%`,
              sparkline: [20, 25, 22, 28, 32, 30, 38 + k * 5],
            })),
          },
        },
  "ab-test-confidence": () => ({
    abData: {
      variantA: { label: "Control", mean: 12.4, conversion: "12.4%" },
      variantB: { label: "Candidate", mean: 14.8, conversion: "14.8%" },
      pValue: 0.003,
      significant: true,
    },
  }),
  "carousel-3d-showcase": (s, t, cap) =>
    has(s.carouselData?.items)
      ? null
      : {
          carouselData: {
            items: four.map((k) => ({
              badge: `0${k + 1}`,
              title: say(s, "step", k),
              desc: cap(k) || say(s, "caption", k),
              tag: say(s, "state", k),
            })),
          },
        },
  "3d-motion-hero": (s, t, cap) => ({
    hero3dData: {
      mainTitle: t || say(s, "metric", 0),
      subTitle: s.subtitle || cap(0) || say(s, "target", 0),
      badge: say(s, "index", 0),
      geometryStyle: "polyhedron",
      ...(s.hero3dData || {}),
    },
  }),
  "code-slice-reveal": (s, t, cap) => ({
    sliceData: {
      filename: "pipeline.ts",
      language: "TypeScript",
      diffTag: "FEATURE",
      lines: four.map((k) => cap(k) || say(s, "step", k)),
      output: cap(4) || say(s, "state", 0),
      ...(s.sliceData || {}),
    },
  }),
});

/** Returns a copy of `scene` whose archetype payload is guaranteed non-empty. */
export function enrichScene(scene, archetype) {
  const title = typeof scene.title === "string" ? scene.title.trim() : "";
  const cap = (k) => say(scene, "caption", k);
  const patch = BUILDERS[archetype]?.(scene, title, cap);
  return patch ? { ...scene, ...patch } : { ...scene };
}
