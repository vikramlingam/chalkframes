/**
 * Browser-safe variables entry (`@chalkframes/core/variables`) — the complete
 * composition-variables surface in one import: schema types, the declaration
 * parser, runtime value resolution, and value validation. Deliberately free of
 * the Node-only modules reachable from the core/parsers root entries, so
 * browser consumers (SDK, Studio, embedders) can bundle it.
 */

export type {
  CompositionVariable,
  CompositionVariableType,
  CompositionVariableBase,
  StringVariable,
  NumberVariable,
  ColorVariable,
  BooleanVariable,
  EnumVariable,
  FontVariable,
  ImageVariable,
} from "@chalkframes/parsers/composition";
export {
  COMPOSITION_VARIABLE_TYPES,
  parseCompositionVariables,
  isCompositionVariable,
  isScalarVariableValue,
  scanVariableUsage,
} from "@chalkframes/parsers/composition";
export type { VariableUsageScan } from "@chalkframes/parsers/composition";

export { getVariables, readDeclaredDefaults } from "./runtime/getVariables.js";
export {
  validateVariables,
  formatVariableValidationIssue,
  type VariableValidationIssue,
} from "./runtime/validateVariables.js";
