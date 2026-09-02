import type { FilePlatform } from "../platform/types.js";

export interface StudioPaths {
  /** Studio's own app-data root (never a project's own contents — see CLAUDE.md/product contract). */
  appDataDir: string;
  /** Crash-recovery/autosave payloads, one subfolder per open project. */
  recoveryDir: string;
  /** Named snapshots, one subfolder per project. */
  snapshotsDir: string;
  /** Studio's own config (recent-projects list, window prefs) — never project content. */
  appConfigDir: string;
  recentProjectsFile: string;
}

export async function resolveStudioPaths(platform: FilePlatform): Promise<StudioPaths> {
  const appDataDir = await platform.appDataDir();
  const appConfigDir = await platform.appConfigDir();
  return {
    appDataDir,
    recoveryDir: platform.join(appDataDir, "recovery"),
    snapshotsDir: platform.join(appDataDir, "snapshots"),
    appConfigDir,
    recentProjectsFile: platform.join(appConfigDir, "recent-projects.json"),
  };
}

/**
 * A short, filesystem-safe, human-legible identifier for a project's own
 * recovery/snapshot subfolder — derived from its path, not its (mutable)
 * name, so renaming a project doesn't orphan its history.
 */
export function projectStorageKey(platform: FilePlatform, projectPath: string): string {
  const normalised = projectPath.replace(/[\\/]+/g, "/").toLowerCase();
  let hash = 0;
  for (let i = 0; i < normalised.length; i += 1) {
    hash = (hash * 31 + normalised.charCodeAt(i)) >>> 0;
  }
  const base = platform.basename(projectPath).replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${base}-${hash.toString(16)}`;
}
