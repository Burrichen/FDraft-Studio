import { StudioProjectDocumentSchema, type StudioProjectDocument } from "../schema/project.js";
import { checkSemantics, type ValidationIssue } from "./semantic.js";

export interface ValidationResult<T> {
  valid: boolean;
  document?: T;
  issues: ValidationIssue[];
}

/**
 * Validates a document that is *already* at the current project format
 * version's shape. Older documents must go through `migrateProject` first
 * — this function does not migrate.
 */
export function validateProject(data: unknown): ValidationResult<StudioProjectDocument> {
  const result = StudioProjectDocumentSchema.safeParse(data);
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
