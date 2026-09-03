import type { FilePlatform } from "../platform/types.js";

export interface FDraftRepositoryLink {
  repoPath: string;
  linkedAtMs: number;
}

/**
 * A linked FDraft repository is a local-machine filesystem path — it has
 * no business inside the portable `.fdstudio` project document (which can
 * move between machines and users), so it's stored separately, keyed by
 * the project's own stable id, in Studio's own app-data directory. Never
 * committed anywhere, never travels with the project file.
 */
async function linkFilePath(platform: FilePlatform, projectId: string): Promise<string> {
  const dir = platform.join(await platform.appDataDir(), "fdraft-links");
  await platform.mkdir(dir);
  return platform.join(dir, `${projectId}.json`);
}

export async function loadFDraftLink(platform: FilePlatform, projectId: string): Promise<FDraftRepositoryLink | undefined> {
  const path = await linkFilePath(platform, projectId);
  if (!(await platform.exists(path))) return undefined;
  try {
    const parsed = JSON.parse(await platform.readTextFile(path)) as Partial<FDraftRepositoryLink>;
    if (typeof parsed.repoPath !== "string") return undefined;
    return { repoPath: parsed.repoPath, linkedAtMs: typeof parsed.linkedAtMs === "number" ? parsed.linkedAtMs : 0 };
  } catch {
    return undefined;
  }
}

export async function saveFDraftLink(platform: FilePlatform, projectId: string, repoPath: string): Promise<void> {
  const path = await linkFilePath(platform, projectId);
  const link: FDraftRepositoryLink = { repoPath, linkedAtMs: platform.now() };
  await platform.writeTextFile(path, JSON.stringify(link, null, 2));
}

export async function clearFDraftLink(platform: FilePlatform, projectId: string): Promise<void> {
  const path = await linkFilePath(platform, projectId);
  if (await platform.exists(path)) await platform.remove(path);
}
