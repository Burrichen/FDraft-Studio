import { migrateProject, validateTheme, isSdkError, type RuntimeThemeDocument, type StudioProjectDocument } from "@fdraft/theme-sdk";
import type { FixtureScenario } from "./fixtures/types.js";

export interface PreflightIssue {
  code: string;
  path: string;
  message: string;
}

export type PreflightResult =
  | { status: "valid"; document: StudioProjectDocument | RuntimeThemeDocument; migrationNote?: string }
  | { status: "invalid"; issues: PreflightIssue[] };

/**
 * The fixture lab's live compatibility preflight: runs the SDK's real
 * (crypto-free) validation/migration functions in the browser, on
 * whatever raw JSON a scenario carries — never trusting that Node-side
 * loading already implies validity for *this* run.
 */
export function runPreflight(scenario: FixtureScenario): PreflightResult {
  try {
    if (scenario.kind === "project") {
      const { document, migrationsApplied } = migrateProject(scenario.raw);
      return {
        status: "valid",
        document,
        migrationNote: migrationsApplied.length > 0 ? `Migrated from ${migrationsApplied[0]!.fromVersion} to ${document.formatVersion}.` : undefined,
      };
    }

    const result = validateTheme(scenario.raw);
    if (result.valid && result.document) {
      return { status: "valid", document: result.document };
    }
    return { status: "invalid", issues: result.issues };
  } catch (error) {
    if (isSdkError(error)) {
      const details = error.details;
      const issues: PreflightIssue[] = Array.isArray(details)
        ? (details as PreflightIssue[])
        : [{ code: error.code, path: "", message: error.message }];
      return { status: "invalid", issues };
    }
    return { status: "invalid", issues: [{ code: "UNKNOWN", path: "", message: String(error) }] };
  }
}
