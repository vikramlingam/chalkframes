import { buildChalkframesRuntimeScript } from "./chalkframesRuntime.engine";
import { CHALKFRAME_BRIDGE_SOURCES, CHALKFRAME_RUNTIME_GLOBALS } from "./runtimeContract";

export const CHALKFRAME_RUNTIME_ARTIFACTS = {
  iife: "chalkframe.runtime.iife.js",
  esm: "chalkframe.runtime.mjs",
  manifest: "chalkframe.manifest.json",
} as const;

export type ChalkframeRuntimeContract = {
  globals: typeof CHALKFRAME_RUNTIME_GLOBALS;
  messageSources: typeof CHALKFRAME_BRIDGE_SOURCES;
};

export const CHALKFRAME_RUNTIME_CONTRACT: ChalkframeRuntimeContract = {
  globals: CHALKFRAME_RUNTIME_GLOBALS,
  messageSources: CHALKFRAME_BRIDGE_SOURCES,
};

export function loadChalkframeRuntimeSource(): string | null {
  return buildChalkframesRuntimeScript();
}
