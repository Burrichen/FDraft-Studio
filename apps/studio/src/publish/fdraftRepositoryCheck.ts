import type { FilePlatform } from "../platform/types.js";

export interface FDraftRepositoryCheck {
  plausible: boolean;
  markersFound: string[];
  markersMissing: string[];
}

/**
 * Best-effort only — "candidate until independently verified," the same
 * caveat `docs/architecture/RENDERER_HOST_NOTES.md` already uses for
 * anything about FDraft's real layout observed from outside it. Never a
 * hard guarantee; the real safety net is `readFDraftCompatibility`, which
 * actually parses FDraft's committed integration files.
 */
export async function checkFDraftRepositoryPlausibility(platform: FilePlatform, repoPath: string): Promise<FDraftRepositoryCheck> {
  const markersFound: string[] = [];
  const markersMissing: string[] = [];

  const packageJsonPath = platform.join(repoPath, "package.json");
  if (await platform.exists(packageJsonPath)) {
    try {
      const pkg = JSON.parse(await platform.readTextFile(packageJsonPath)) as { name?: string; dependencies?: Record<string, string> };
      if (pkg.name === "fdraft") markersFound.push('package.json "name" is "fdraft"');
      else markersMissing.push('package.json "name" is not "fdraft"');
      const deps = pkg.dependencies ?? {};
      if ("@fdraft/theme-sdk" in deps || "@fdraft/theme-renderer" in deps) markersFound.push("depends on @fdraft/theme-sdk or @fdraft/theme-renderer");
      else markersMissing.push("no @fdraft/theme-sdk or @fdraft/theme-renderer dependency found");
    } catch {
      markersMissing.push("package.json exists but could not be parsed as JSON");
    }
  } else {
    markersMissing.push("no package.json found at the selected folder");
  }

  if (await platform.exists(platform.join(repoPath, "src", "app"))) markersFound.push("has a src/app directory");
  else markersMissing.push("no src/app directory found");

  return { plausible: markersFound.length >= 2, markersFound, markersMissing };
}
