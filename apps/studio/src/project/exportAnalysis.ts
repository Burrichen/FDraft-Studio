import { detectCapabilities, isSdkError, validateProject, type StudioProjectDocument, type ThemeCapability, type ValidationIssue } from "@fdraft/theme-sdk";
import { compileProjectToFdtheme, packFdstudio } from "@fdraft/theme-sdk/packaging";
import { findUnusedAssets } from "../assets/assetUsageSummary.js";
import { pruneAssetsToProject } from "./projectFile.js";

export interface ExportAnalysis {
  valid: boolean;
  /** From schema/semantic validation, or a packaging failure (e.g. a genuinely missing asset) caught while actually building the package — either one blocks export. */
  blockingErrors: ValidationIssue[];
  /** Non-fatal, informational — shown alongside the blocking errors but never prevents export. */
  warnings: string[];
  capabilities: ThemeCapability[];
  requiredComponentKeys: string[];
  assetCount: number;
  usedAssetCount: number;
  /** `undefined` only when the package could not be built at all (see `blockingErrors`). */
  packageSizeBytes: number | undefined;
}

const LARGE_PACKAGE_WARNING_BYTES = 25 * 1024 * 1024;

function packagingErrorToIssue(error: unknown): ValidationIssue {
  if (isSdkError(error)) return { code: error.code, path: error.path ?? "", message: error.message };
  return { code: "SCHEMA_VALIDATION_FAILED", path: "", message: error instanceof Error ? error.message : String(error) };
}

/**
 * Everything the export-preview UI needs to show *before* committing to a
 * `.fdtheme` export: compatibility/capabilities, asset counts, real
 * package size (actually compiled and packed, not estimated), and a
 * warnings/blocking-errors split. Never writes anything — `exportRuntimeTheme`
 * does the real, atomic write once the user confirms.
 */
export async function analyzeThemeExport(project: StudioProjectDocument, projectAssets: Record<string, Uint8Array>, options: { minRendererVersion: string }): Promise<ExportAnalysis> {
  const validation = validateProject(project);
  const unused = findUnusedAssets(project);
  const warnings: string[] = [];
  if (unused.length > 0) warnings.push(`${unused.length} asset${unused.length === 1 ? "" : "s"} not used anywhere in the project will be excluded from the package.`);

  if (!validation.valid) {
    return { valid: false, blockingErrors: validation.issues, warnings, capabilities: [], requiredComponentKeys: [], assetCount: project.assets.length, usedAssetCount: project.assets.length - unused.length, packageSizeBytes: undefined };
  }

  const capabilities = detectCapabilities(project);
  const requiredComponentKeys = [...new Set(project.componentRequirements.map((c) => c.componentKey))].sort();

  try {
    const bytes = await compileProjectToFdtheme(project, projectAssets, options);
    if (bytes.byteLength > LARGE_PACKAGE_WARNING_BYTES) {
      warnings.push(`This package is ${(bytes.byteLength / (1024 * 1024)).toFixed(1)} MB — consider optimising large images before shipping.`);
    }
    return {
      valid: true,
      blockingErrors: [],
      warnings,
      capabilities,
      requiredComponentKeys,
      assetCount: project.assets.length,
      usedAssetCount: project.assets.length - unused.length,
      packageSizeBytes: bytes.byteLength,
    };
  } catch (error) {
    return {
      valid: false,
      blockingErrors: [packagingErrorToIssue(error)],
      warnings,
      capabilities,
      requiredComponentKeys,
      assetCount: project.assets.length,
      usedAssetCount: project.assets.length - unused.length,
      packageSizeBytes: undefined,
    };
  }
}

/** The `.fdstudio` analog — simpler, since there's no compile/capability step, just real validation + a real packed size. */
export async function analyzeProjectExport(project: StudioProjectDocument, projectAssets: Record<string, Uint8Array>, sdkVersion: string): Promise<ExportAnalysis> {
  const validation = validateProject(project);
  if (!validation.valid) {
    return { valid: false, blockingErrors: validation.issues, warnings: [], capabilities: [], requiredComponentKeys: [], assetCount: project.assets.length, usedAssetCount: project.assets.length, packageSizeBytes: undefined };
  }
  try {
    const bytes = await packFdstudio({ project, assets: pruneAssetsToProject(projectAssets, project), sdkVersion });
    return { valid: true, blockingErrors: [], warnings: [], capabilities: [], requiredComponentKeys: [], assetCount: project.assets.length, usedAssetCount: project.assets.length, packageSizeBytes: bytes.byteLength };
  } catch (error) {
    return { valid: false, blockingErrors: [packagingErrorToIssue(error)], warnings: [], capabilities: [], requiredComponentKeys: [], assetCount: project.assets.length, usedAssetCount: project.assets.length, packageSizeBytes: undefined };
  }
}
