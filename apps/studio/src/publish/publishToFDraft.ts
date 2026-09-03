import { compileProjectToFdtheme } from "@fdraft/theme-sdk/packaging";
import type { ValidationIssue } from "@fdraft/theme-sdk";
import type { FilePlatform } from "../platform/types.js";
import { exceedsWindowsMaxPath } from "../platform/pathUtils.js";
import type { OpenProject } from "../project/projectFile.js";
import { pruneAssetsToProject } from "../project/projectFile.js";
import { analyzeThemeExport } from "../project/exportAnalysis.js";
import { slugify, isPathSafeSlug } from "./slug.js";
import { readFDraftCompatibility, checkProjectAgainstFDraft, type PublishCompatibilityCheck } from "./fdraftCompatibility.js";
import { diffFileSets, publishDirectorySwap, readExistingPublishedFiles, type PublishDiffEntry } from "./publishDirectorySwap.js";

const MIN_RENDERER_VERSION = "0.1.0";
const THEME_PROJECTS_DIR = "theme-projects";
const THEME_PACKS_DIR = ["src", "theme-packs"];

export type PublishBlockReason =
  | { kind: "invalidSlug"; detail: string }
  | { kind: "pathTooLong"; path: string }
  | { kind: "validation"; issues: ValidationIssue[] }
  | { kind: "compatibilityUnavailable"; detail: string }
  | { kind: "incompatible"; check: PublishCompatibilityCheck }
  | { kind: "slugCollision"; existingProjectName: string };

export interface PublishPlan {
  blocked: PublishBlockReason[];
  slug: string;
  sourceDir: string;
  packDir: string;
  sourceIsAlreadyCanonical: boolean;
  sourceDiff: PublishDiffEntry[];
  packDiff: PublishDiffEntry[];
  /** Set only when a *different* project already occupies this slug — publishing requires explicit extra confirmation, never silent overwrite. */
  slugCollision: { existingProjectId: string; existingProjectName: string } | undefined;
  sourceFiles: Record<string, Uint8Array>;
  packFiles: Record<string, Uint8Array>;
}

function decodeText(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

/** Best-effort read of an existing `theme-projects/<slug>/project.json`'s identity — used only for the slug-collision check, never trusted for anything else. */
function tryReadExistingProjectIdentity(sourceFiles: Record<string, Uint8Array>): { id: string; name: string } | undefined {
  const bytes = sourceFiles["project.json"];
  if (!bytes) return undefined;
  try {
    const parsed = JSON.parse(decodeText(bytes)) as { metadata?: { id?: string; name?: string } };
    if (typeof parsed.metadata?.id === "string") return { id: parsed.metadata.id, name: parsed.metadata.name ?? "(unnamed)" };
  } catch {
    // Not JSON, or not shaped like a StudioProjectDocument — treated as "no identity to compare against," not an error.
  }
  return undefined;
}

/**
 * Compiles, validates, and checks compatibility, then computes exactly
 * what publishing would change — a pure preview. Never writes anything;
 * `executePublish` does the actual write, only after the caller has shown
 * this plan to the user and gotten explicit confirmation (required for
 * every publish, and required a second, explicit way for a slug
 * collision with a different project).
 */
export async function planPublish(platform: FilePlatform, repoPath: string, open: OpenProject): Promise<PublishPlan> {
  const blocked: PublishBlockReason[] = [];
  const slug = slugify(open.project.metadata.name);
  if (!isPathSafeSlug(slug)) blocked.push({ kind: "invalidSlug", detail: `"${slug}" is not a safe directory name.` });

  const sourceDir = platform.join(repoPath, THEME_PROJECTS_DIR, slug);
  const packDir = platform.join(repoPath, ...THEME_PACKS_DIR, slug);

  // Checked against the deepest path each side will actually write, on every host OS — never lets a publish silently produce a path Windows itself couldn't open later.
  const deepestSourcePath = platform.join(sourceDir, "project.json");
  const deepestPackPath = platform.join(packDir, "theme.fdtheme");
  for (const candidate of [deepestSourcePath, deepestPackPath]) {
    if (exceedsWindowsMaxPath(candidate)) blocked.push({ kind: "pathTooLong", path: candidate });
  }

  const analysis = await analyzeThemeExport(open.project, open.assets, { minRendererVersion: MIN_RENDERER_VERSION });
  if (!analysis.valid) blocked.push({ kind: "validation", issues: analysis.blockingErrors });

  const compatibilityResult = await readFDraftCompatibility(platform, repoPath);
  let compatibilityCheck: PublishCompatibilityCheck | undefined;
  if (compatibilityResult.status !== "ok") {
    blocked.push({ kind: "compatibilityUnavailable", detail: compatibilityResult.detail });
  } else {
    compatibilityCheck = checkProjectAgainstFDraft({ minRendererVersion: MIN_RENDERER_VERSION, requiredComponentKeys: analysis.requiredComponentKeys, capabilities: analysis.capabilities }, compatibilityResult.compatibility!);
    if (!compatibilityCheck.compatible) blocked.push({ kind: "incompatible", check: compatibilityCheck });
  }

  // Both diffs/file sets are still computed even when blocked, so the UI can show *what would have changed* alongside *why it's blocked* — never guessed, always the real staged output.
  const referencedAssets = pruneAssetsToProject(open.assets, open.project);
  const sourceFiles: Record<string, Uint8Array> = { "project.json": new TextEncoder().encode(JSON.stringify(open.project, null, 2)), ...referencedAssets };

  const existingSourceFiles = await readExistingPublishedFiles(platform, sourceDir);
  const existingIdentity = tryReadExistingProjectIdentity(existingSourceFiles);
  const slugCollision = existingIdentity && existingIdentity.id !== open.project.metadata.id ? { existingProjectId: existingIdentity.id, existingProjectName: existingIdentity.name } : undefined;
  if (slugCollision) blocked.push({ kind: "slugCollision", existingProjectName: slugCollision.existingProjectName });

  const sourceIsAlreadyCanonical = open.path === platform.join(sourceDir, "project.json");
  const sourceDiff = sourceIsAlreadyCanonical ? [] : diffFileSets(existingSourceFiles, sourceFiles);

  let packFiles: Record<string, Uint8Array> = {};
  let packDiff: PublishDiffEntry[] = [];
  if (analysis.valid) {
    const themeBytes = await compileProjectToFdtheme(open.project, open.assets, { minRendererVersion: MIN_RENDERER_VERSION });
    packFiles = { "theme.fdtheme": themeBytes };
    const existingPackFiles = await readExistingPublishedFiles(platform, packDir);
    packDiff = diffFileSets(existingPackFiles, packFiles);
  }

  return { blocked, slug, sourceDir, packDir, sourceIsAlreadyCanonical, sourceDiff, packDiff, slugCollision, sourceFiles, packFiles };
}

export interface PublishResult {
  sourceWritten: boolean;
  sourceHadPrevious: boolean;
  packWritten: boolean;
  packHadPrevious: boolean;
  changedPaths: string[];
  gitCommandsHint: string;
}

/**
 * Actually writes the plan's staged files — atomically, with a kept
 * `.previous` backup for each directory (see `publishDirectorySwap`).
 * Never runs `git`. Requires an already-unblocked, already-confirmed
 * `PublishPlan` — this function does not re-check compatibility/validity
 * itself, since re-running the real check is `planPublish`'s job and
 * calling it twice would risk racing against an edit made between plan
 * and confirm.
 */
export async function executePublish(platform: FilePlatform, repoPath: string, plan: PublishPlan): Promise<PublishResult> {
  let sourceWritten = false;
  let sourceHadPrevious = false;
  if (!plan.sourceIsAlreadyCanonical && plan.sourceDiff.length > 0) {
    const result = await publishDirectorySwap(platform, plan.sourceDir, plan.sourceFiles);
    sourceWritten = true;
    sourceHadPrevious = result.hadPrevious;
  }

  let packWritten = false;
  let packHadPrevious = false;
  if (plan.packDiff.length > 0) {
    const packResult = await publishDirectorySwap(platform, plan.packDir, plan.packFiles);
    packWritten = true;
    packHadPrevious = packResult.hadPrevious;
  }

  const changedPaths = [...(sourceWritten ? [platform.join(THEME_PROJECTS_DIR, plan.slug)] : []), ...(packWritten ? [platform.join(...THEME_PACKS_DIR, plan.slug)] : [])];

  return {
    sourceWritten,
    sourceHadPrevious,
    packWritten,
    packHadPrevious,
    changedPaths,
    gitCommandsHint: buildGitCommandsHint(repoPath, changedPaths),
  };
}

/** Plain text only — Studio never runs `git` itself (see CLAUDE.md's Git boundary). */
export function buildGitCommandsHint(repoPath: string, changedPaths: string[]): string {
  return [`cd "${repoPath}"`, "git status", `git add ${changedPaths.map((p) => `"${p}"`).join(" ")}`, `git commit -m "theme: publish"`].join("\n");
}
