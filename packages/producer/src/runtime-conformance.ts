import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  getVerifiedChalkframeRuntimeSource,
  resolveChalkframeManifestPath,
} from "./services/chalkframeRuntimeLoader.js";

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

const manifestPath = resolveChalkframeManifestPath();
const manifestRaw = readFileSync(manifestPath, "utf8");
const manifest = JSON.parse(manifestRaw) as {
  sha256?: string;
  artifacts?: { iife?: string };
};

const verifiedSource = getVerifiedChalkframeRuntimeSource();
const sourceSha = createHash("sha256").update(verifiedSource, "utf8").digest("hex");
assert(sourceSha === manifest.sha256, "Verified runtime hash does not match manifest sha256");

const servicesDir = resolve(fileURLToPath(new URL("./services", import.meta.url)));
const fileServerSource = readFileSync(resolve(servicesDir, "fileServer.ts"), "utf8");
assert(
  fileServerSource.includes("getVerifiedChalkframeRuntimeSource"),
  "Producer file server must inject runtime via getVerifiedChalkframeRuntimeSource",
);
assert(
  !fileServerSource.includes("loadChalkframeRuntimeSource"),
  "Producer file server must not inject runtime via loadChalkframeRuntimeSource",
);

console.log(
  JSON.stringify({
    event: "producer_runtime_conformance_ok",
    manifestPath,
    runtimeSha256: sourceSha,
  }),
);
