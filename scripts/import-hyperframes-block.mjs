#!/usr/bin/env node
/**
 * Chalk Frames — HyperFrames Block & Component Registry Importer
 *
 * Imports any motion block or component from the open-source HyperFrames registry
 * (heygen-com/hyperframes) directly into Chalk Frames.
 *
 * Downloads composition HTML, associated textures and assets, and makes them
 * fully deterministic and locally runnable without runtime network dependencies.
 *
 * Usage:
 *   bun run import:block <block-id>
 *   node scripts/import-hyperframes-block.mjs canopy-part-title
 */

import fs from "node:fs";
import path from "node:path";

const GITHUB_RAW = "https://raw.githubusercontent.com/heygen-com/hyperframes/main";
const POPULAR_BLOCKS = [
  "canopy-part-title",
  "code-slice-hero",
  "carousel-circle-1",
  "carousel-circle-2",
  "carousel-circle-3",
  "bar-chart-race",
  "app-showcase",
  "apple-money-count",
  "camera-dolly-zoom",
  "camcorder-hud",
  "ai-chat-reveal",
];

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText} for ${url}`);
  }
  return res.json();
}

async function fetchBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText} for ${url}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText} for ${url}`);
  }
  return res.text();
}

async function main() {
  const blockId = process.argv[2]?.trim().toLowerCase();

  if (!blockId || blockId === "--help" || blockId === "-h") {
    console.log(`
╔══════════════════════════════════════════════════════════════════════╗
║               Chalk Frames — Motion Registry Importer                ║
╚══════════════════════════════════════════════════════════════════════╝

Import any production-grade 3D motion, carousel, or graphic block from
HeyGen HyperFrames' open-source 400+ item catalog directly into Chalk Frames.

Usage:
  bun run import:block <block-id>
  node scripts/import-hyperframes-block.mjs <block-id>

Popular ready-to-install blocks:
${POPULAR_BLOCKS.map((b) => `  - ${b}`).join("\n")}

Browse the full catalog at: https://hyperframes.heygen.com/catalog
`);
    process.exit(blockId ? 0 : 1);
  }

  console.log(`\n🔍 Fetching metadata for block: "${blockId}"...`);

  let registryMeta = null;
  let basePath = `registry/blocks/${blockId}`;

  try {
    registryMeta = await fetchJson(`${GITHUB_RAW}/${basePath}/registry-item.json`);
  } catch {
    // Try components directory if not in blocks
    try {
      basePath = `registry/components/${blockId}`;
      registryMeta = await fetchJson(`${GITHUB_RAW}/${basePath}/registry-item.json`);
    } catch {
      console.error(
        `\n❌ Block "${blockId}" not found in HyperFrames registry/blocks or registry/components.`,
      );
      console.error(`Browse available blocks at https://hyperframes.heygen.com/catalog`);
      process.exit(1);
    }
  }

  console.log(`✔ Found: ${registryMeta.title || blockId}`);
  if (registryMeta.description) {
    console.log(`  Description: ${registryMeta.description}`);
  }
  console.log(
    `  Duration: ${registryMeta.duration || 5}s | Resolution: ${registryMeta.dimensions?.width || 1920}x${registryMeta.dimensions?.height || 1080}`,
  );

  const outDir = path.resolve(process.cwd(), "compositions", "imported", blockId);
  fs.mkdirSync(outDir, { recursive: true });

  const files = Array.isArray(registryMeta.files) ? registryMeta.files : [];
  console.log(`\n📦 Downloading ${files.length} composition file(s)...`);

  let mainHtmlFile = null;

  for (const file of files) {
    const rawPath = file.path;
    const destRel = file.path;
    const destAbs = path.join(outDir, destRel);
    fs.mkdirSync(path.dirname(destAbs), { recursive: true });

    let sourceUrl = file.url;
    if (!sourceUrl) {
      sourceUrl = `${GITHUB_RAW}/${basePath}/${rawPath}`;
    }

    process.stdout.write(`  → Downloading ${rawPath}... `);
    try {
      if (rawPath.endsWith(".html") || rawPath.endsWith(".json") || rawPath.endsWith(".md")) {
        let content = await fetchText(sourceUrl);
        // Ensure local asset paths are relative to the composition
        content = content.replace(new RegExp(`compositions/${blockId}/assets/`, "g"), "assets/");
        fs.writeFileSync(destAbs, content, "utf8");
        if (rawPath.endsWith(".html")) {
          mainHtmlFile = destAbs;
        }
      } else {
        const buffer = await fetchBuffer(sourceUrl);
        fs.writeFileSync(destAbs, buffer);
      }
      console.log(`OK`);
    } catch (e) {
      console.log(`FAILED (${e.message})`);
    }
  }

  // Save the manifest copy locally
  fs.writeFileSync(
    path.join(outDir, "registry-item.json"),
    JSON.stringify(registryMeta, null, 2),
    "utf8",
  );

  console.log(`\n🎉 Successfully imported "${blockId}" into Chalk Frames!`);
  console.log(`   Location: compositions/imported/${blockId}/`);
  if (mainHtmlFile) {
    console.log(`   Main Composition: ${path.relative(process.cwd(), mainHtmlFile)}`);
  }

  console.log(`\n💡 To render directly to MP4:`);
  console.log(
    `   bun run packages/cli/dist/index.js render -c compositions/imported/${blockId}/${path.basename(mainHtmlFile || `${blockId}.html`)} -o ${blockId}.mp4\n`,
  );
}

main().catch((err) => {
  console.error("\nUnexpected error:", err);
  process.exit(1);
});
