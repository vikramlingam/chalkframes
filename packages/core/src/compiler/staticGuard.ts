import { lintChalkframeHtml } from "@chalkframes/lint";

export type ChalkframeStaticFailureReason =
  | "missing_composition_id"
  | "missing_composition_dimensions"
  | "missing_timeline_registry"
  | "invalid_script_syntax"
  | "invalid_static_chalkframe_contract";

export type ChalkframeStaticGuardResult = {
  isValid: boolean;
  missingKeys: string[];
  failureReason: ChalkframeStaticFailureReason | null;
};

export async function validateChalkframeHtmlContract(
  html: string,
): Promise<ChalkframeStaticGuardResult> {
  const result = await lintChalkframeHtml(html);
  const missingKeys = result.findings
    .filter((finding) => finding.severity === "error")
    .map((finding) => finding.message);

  if (missingKeys.length === 0) {
    return { isValid: true, missingKeys: [], failureReason: null };
  }

  const joined = missingKeys.join(" ").toLowerCase();
  let failureReason: ChalkframeStaticFailureReason = "invalid_static_chalkframe_contract";
  if (joined.includes("data-composition-id")) {
    failureReason = "missing_composition_id";
  } else if (joined.includes("data-width") || joined.includes("data-height")) {
    failureReason = "missing_composition_dimensions";
  } else if (joined.includes("window.__timelines")) {
    failureReason = "missing_timeline_registry";
  } else if (joined.includes("script syntax")) {
    failureReason = "invalid_script_syntax";
  }

  return { isValid: false, missingKeys, failureReason };
}
