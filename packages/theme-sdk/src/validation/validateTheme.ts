import { RuntimeThemeDocumentSchema, type RuntimeThemeDocument } from "../schema/theme.js";
import { checkSemantics, type ValidationIssue } from "./semantic.js";
import type { ValidationResult } from "./validateProject.js";
import { compareSemVer } from "../compat.js";

export function validateTheme(data: unknown): ValidationResult<RuntimeThemeDocument> {
  const result = RuntimeThemeDocumentSchema.safeParse(data);
  if (!result.success) {
    const issues: ValidationIssue[] = result.error.issues.map((issue) => ({
      code: "SCHEMA_VALIDATION_FAILED",
      path: issue.path.join("."),
      message: issue.message,
    }));
    return { valid: false, issues };
  }
  const semanticIssues = checkSemantics(result.data);
  return {
    valid: semanticIssues.length === 0,
    document: result.data,
    issues: semanticIssues,
  };
}

/**
 * Checks whether a renderer declaring `rendererVersion` may load a theme
 * whose manifest declares `minRendererVersion`. Uses plain semver
 * precedence (major.minor.patch, prerelease ignored for ordering) — no
 * external semver dependency.
 */
export function isRendererCompatible(minRendererVersion: string, rendererVersion: string): boolean {
  return compareSemVer(rendererVersion, minRendererVersion) >= 0;
}
