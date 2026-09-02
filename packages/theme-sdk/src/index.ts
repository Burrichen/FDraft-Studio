/**
 * The main, browser-safe entry point: data model, validation, migration,
 * compile. See `@fdraft/theme-sdk/packaging` for pack/unpack/inspect/hash
 * (Node-only) and `@fdraft/theme-sdk/node` for filesystem helpers.
 */
export * from "./schema/index.js";
export * from "./errors.js";
export { createId } from "./ids.js";
export { compareSemVer, parseSemVer, majorVersion } from "./compat.js";
export { checkSvgSafety, isSvgSafe, sanitizeSvg, type SvgSafetyIssue, type SvgSanitizeResult } from "./validation/svg.js";
export { checkSemantics, checkDuplicateIds, checkBrokenReferences, checkCircularMasters, type ValidationIssue } from "./validation/semantic.js";
export { checkBehaviourRules } from "./validation/behaviourSemantics.js";
export { checkDesignWarnings, contrastRatio, type DesignWarning } from "./validation/designWarnings.js";
export { PROJECT_MIGRATIONS } from "./migration/registry.js";
export type { MigrationStep, AppliedMigration } from "./migration/registry.js";

export * from "./api.js";
