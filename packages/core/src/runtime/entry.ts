import { initSandboxRuntimeModular, installAuthoredMediaCapture } from "./init";
import { installAuthoredOpacityCapture } from "./colorGrading";
import { deferMediaUntilDue } from "./preloadMedia";
import { hideTimedClipsUntilFirstPass } from "./timedClipHide";
import { fitTextFontSize } from "../text/fitTextFontSize";
import { pretext } from "../text/pretext";
import { assetUrl } from "./assetUrl";
import { getVariables } from "./getVariables";
import { clearRuntimeData, registerRuntimeDataHandler, setRuntimeData } from "./runtimeData";

type ChalkframeWindow = Window & {
  __chalkframeRuntimeBootstrapped?: boolean;
  __chalkframes?: {
    assetUrl: typeof assetUrl;
    fitTextFontSize: typeof fitTextFontSize;
    getVariables: typeof getVariables;
    pretext: typeof pretext;
    registerRuntimeDataHandler: typeof registerRuntimeDataHandler;
    setRuntimeData: typeof setRuntimeData;
    clearRuntimeData: typeof clearRuntimeData;
  };
};

// Inline composition scripts can run before DOMContentLoaded.
// Ensure timeline registry exists at script evaluation time.
(window as ChalkframeWindow).__timelines = (window as ChalkframeWindow).__timelines || {};

// Stamp color-graded elements with their authored inline opacity BEFORE the
// composition's animation scripts (and the grading hide) mutate it — must run
// at script evaluation time, while the document is still parsing.
installAuthoredOpacityCapture();
installAuthoredMediaCapture();

hideTimedClipsUntilFirstPass();
deferMediaUntilDue();

// Expose runtime helpers immediately so composition scripts can use them
// before DOMContentLoaded (font sizing runs during script evaluation, and
// getVariables is read by composition setup before the timeline is built).
(window as ChalkframeWindow).__chalkframes = {
  assetUrl,
  fitTextFontSize,
  getVariables,
  pretext,
  registerRuntimeDataHandler,
  setRuntimeData,
  clearRuntimeData,
};

function bootstrapChalkframeRuntime(): void {
  const win = window as ChalkframeWindow;
  if (win.__chalkframeRuntimeBootstrapped) {
    return;
  }
  win.__chalkframeRuntimeBootstrapped = true;
  initSandboxRuntimeModular();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrapChalkframeRuntime, { once: true });
} else {
  bootstrapChalkframeRuntime();
}
