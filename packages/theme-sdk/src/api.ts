/**
 * The universal, browser-safe half of the public surface: create, parse,
 * validate, migrate, compile. No `node:crypto`, `node:fs`, or ZIP handling
 * anywhere in this module's import graph — it must stay importable from a
 * browser bundle (a fixture lab, Studio's Tauri webview, FDraft's client
 * code) without pulling in Node-only code merely by being imported.
 *
 * Packing, unpacking, inspecting, and hashing packages live in
 * `@fdraft/theme-sdk/packaging` instead — genuinely Node-only for now
 * (ZIP + sha256), and deliberately a separate entry point so importing
 * this module never drags that code into a browser bundle.
 */
import { createEmptyProject, type ProjectMetadata, type StudioProjectDocument } from "./schema/project.js";
import { validateProject, type ValidationResult } from "./validation/validateProject.js";
import { validateTheme, isRendererCompatible } from "./validation/validateTheme.js";
import { migrateProject, type MigrationResult } from "./migration/registry.js";
import { compileTheme, detectCapabilities, type CompileThemeOptions, type CompiledThemeBundle } from "./compile/compileTheme.js";
import { collectUsedAssetIds, findAssetUsage, type AssetUsageKind, type AssetUsageRef } from "./compile/assetUsage.js";
import type { RuntimeThemeDocument } from "./schema/theme.js";

/** Creates a new, empty (but valid) Studio project document. */
export function createProject(metadata: ProjectMetadata): StudioProjectDocument {
  return createEmptyProject(metadata);
}

/** Parses and validates raw JSON as a current-format-version project. Use `migrateProject` first for documents that might be older. */
export function parseProject(data: unknown): ValidationResult<StudioProjectDocument> {
  return validateProject(data);
}

export { validateProject, validateTheme, isRendererCompatible, migrateProject };
export type { ValidationResult, MigrationResult };

export { compileTheme, detectCapabilities };
export type { CompileThemeOptions, CompiledThemeBundle };

export { findAssetUsage, collectUsedAssetIds };
export type { AssetUsageKind, AssetUsageRef };

export type { RuntimeThemeDocument };
