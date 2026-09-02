import { SdkError } from "../errors.js";
import { compareSemVer, majorVersion } from "../compat.js";
import {
  CURRENT_PROJECT_FORMAT_VERSION,
  MIN_SUPPORTED_PROJECT_FORMAT_VERSION,
} from "../schema/versions.js";
import { validateProject } from "../validation/validateProject.js";
import type { StudioProjectDocument } from "../schema/project.js";

export interface MigrationStep {
  fromVersion: string;
  toVersion: string;
  description: string;
  /** Transforms a document at `fromVersion`'s (unvalidated) shape into `toVersion`'s shape. */
  migrate: (document: Record<string, unknown>) => Record<string, unknown>;
}

export interface AppliedMigration {
  fromVersion: string;
  toVersion: string;
  description: string;
}

export interface MigrationResult {
  document: StudioProjectDocument;
  migrationsApplied: AppliedMigration[];
}

/**
 * Ordered registry of project-format migrations. Each entry upgrades
 * exactly one version step; `migrateProject` chains them. Add new entries
 * here — in order — whenever `CURRENT_PROJECT_FORMAT_VERSION` bumps.
 */
export const PROJECT_MIGRATIONS: MigrationStep[] = [
  {
    fromVersion: "0.9.0",
    toVersion: "1.0.0",
    description:
      "Renamed `stateGroups` to `imageStateGroups`; added `componentRequirements` (defaults to empty); added `tokens.breakpoints` (defaults to empty).",
    migrate: (doc) => {
      const { stateGroups, ...rest } = doc as { stateGroups?: unknown } & Record<string, unknown>;
      const tokens = (rest.tokens ?? {}) as Record<string, unknown>;
      return {
        ...rest,
        formatVersion: "1.0.0",
        imageStateGroups: stateGroups ?? [],
        componentRequirements: rest.componentRequirements ?? [],
        tokens: {
          ...tokens,
          breakpoints: tokens.breakpoints ?? [],
        },
      };
    },
  },
];

function readFormatVersion(data: unknown): string {
  if (
    typeof data !== "object" ||
    data === null ||
    !("formatVersion" in data) ||
    typeof (data as Record<string, unknown>).formatVersion !== "string"
  ) {
    throw new SdkError({
      code: "INVALID_PACKAGE_FORMAT",
      message: "document is missing a string `formatVersion` field",
    });
  }
  return (data as Record<string, unknown>).formatVersion as string;
}

/**
 * Migrates a project document of any supported historical
 * `formatVersion` up to {@link CURRENT_PROJECT_FORMAT_VERSION}, then
 * validates the result. Documents already at the current version are
 * validated directly with no migration steps applied.
 */
export function migrateProject(data: unknown): MigrationResult {
  const formatVersion = readFormatVersion(data);

  if (majorVersion(formatVersion) > majorVersion(CURRENT_PROJECT_FORMAT_VERSION)) {
    throw new SdkError({
      code: "UNSUPPORTED_FUTURE_VERSION",
      message: `project format ${formatVersion} is a newer major version than this SDK supports (current: ${CURRENT_PROJECT_FORMAT_VERSION}). Upgrade @fdraft/theme-sdk before opening this project.`,
      details: { formatVersion, currentVersion: CURRENT_PROJECT_FORMAT_VERSION },
    });
  }

  if (compareSemVer(formatVersion, MIN_SUPPORTED_PROJECT_FORMAT_VERSION) < 0) {
    throw new SdkError({
      code: "UNSUPPORTED_LEGACY_VERSION",
      message: `project format ${formatVersion} is older than the oldest version this SDK can migrate (${MIN_SUPPORTED_PROJECT_FORMAT_VERSION}).`,
      details: { formatVersion, minSupportedVersion: MIN_SUPPORTED_PROJECT_FORMAT_VERSION },
    });
  }

  let current = data as Record<string, unknown>;
  let currentVersion = formatVersion;
  const migrationsApplied: AppliedMigration[] = [];

  while (currentVersion !== CURRENT_PROJECT_FORMAT_VERSION) {
    const step = PROJECT_MIGRATIONS.find((s) => s.fromVersion === currentVersion);
    if (!step) {
      throw new SdkError({
        code: "MIGRATION_NOT_FOUND",
        message: `no migration registered from project format ${currentVersion} toward ${CURRENT_PROJECT_FORMAT_VERSION}`,
        details: { fromVersion: currentVersion },
      });
    }
    current = step.migrate(current);
    migrationsApplied.push({ fromVersion: step.fromVersion, toVersion: step.toVersion, description: step.description });
    currentVersion = step.toVersion;
  }

  const result = validateProject(current);
  if (!result.valid || !result.document) {
    throw new SdkError({
      code: "SCHEMA_VALIDATION_FAILED",
      message: `document failed validation after migrating to ${CURRENT_PROJECT_FORMAT_VERSION}`,
      details: result.issues,
    });
  }

  return { document: result.document, migrationsApplied };
}
