import type { FilePlatform } from "../platform/types.js";
import type { ProjectStorageKind } from "../project/projectFile.js";
import type { StudioPaths } from "../project/paths.js";
import { atomicWriteFile } from "../project/atomicSave.js";

export const MAX_RECENT_PROJECTS = 10;

export interface RecentProjectEntry {
  path: string;
  name: string;
  kind: ProjectStorageKind;
  lastOpenedAt: number;
}

export interface RecentProjectStatus extends RecentProjectEntry {
  /** True if `path` no longer exists — Studio shows this cleanly rather than failing to open it. */
  missing: boolean;
}

function isRecentProjectEntry(value: unknown): value is RecentProjectEntry {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.path === "string" && typeof v.name === "string" && (v.kind === "file" || v.kind === "directory") && typeof v.lastOpenedAt === "number";
}

/** Never throws: a corrupted or missing recent-projects file behaves exactly like an empty list, since it must never block Studio from starting. */
export async function loadRecentProjects(platform: FilePlatform, paths: StudioPaths): Promise<RecentProjectEntry[]> {
  if (!(await platform.exists(paths.recentProjectsFile))) return [];
  try {
    const parsed: unknown = JSON.parse(await platform.readTextFile(paths.recentProjectsFile));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecentProjectEntry);
  } catch {
    return [];
  }
}

function normalisedPathsEqual(a: string, b: string): boolean {
  const normalise = (path: string) => path.replace(/[\\/]+/g, "/").toLowerCase();
  return normalise(a) === normalise(b);
}

async function writeRecentProjects(platform: FilePlatform, paths: StudioPaths, entries: RecentProjectEntry[]): Promise<void> {
  await platform.mkdir(paths.appConfigDir);
  await atomicWriteFile(platform, paths.recentProjectsFile, new TextEncoder().encode(JSON.stringify(entries, null, 2)));
}

/** Moves `entry` to the front (de-duplicated by path), trimmed to `MAX_RECENT_PROJECTS`. */
export async function recordRecentProject(platform: FilePlatform, paths: StudioPaths, entry: RecentProjectEntry): Promise<RecentProjectEntry[]> {
  const existing = await loadRecentProjects(platform, paths);
  const withoutDuplicate = existing.filter((e) => !normalisedPathsEqual(e.path, entry.path));
  const next = [entry, ...withoutDuplicate].slice(0, MAX_RECENT_PROJECTS);
  await writeRecentProjects(platform, paths, next);
  return next;
}

/** Removes one entry by path — e.g. the user dismissing a "missing" recent project. */
export async function removeRecentProject(platform: FilePlatform, paths: StudioPaths, path: string): Promise<RecentProjectEntry[]> {
  const existing = await loadRecentProjects(platform, paths);
  const next = existing.filter((e) => !normalisedPathsEqual(e.path, path));
  await writeRecentProjects(platform, paths, next);
  return next;
}

/** Annotates each entry with whether its path still exists, so the startup screen can show a clean "not found" state instead of a failed open attempt. */
export async function checkRecentProjectPaths(platform: FilePlatform, entries: RecentProjectEntry[]): Promise<RecentProjectStatus[]> {
  return Promise.all(
    entries.map(async (entry) => ({
      ...entry,
      missing: !(await platform.exists(entry.path)),
    })),
  );
}
