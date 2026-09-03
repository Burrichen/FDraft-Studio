import type { FilePlatform } from "../platform/types.js";
import { readDirectoryFileSet, writeDirectoryFileSet } from "../project/directoryFileSet.js";

export interface PublishDiffEntry {
  path: string;
  kind: "added" | "changed" | "removed";
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false;
  for (let i = 0; i < a.byteLength; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** A pure, read-only preview of what publishing `next` over `existing` would change — safe to compute and show before any write happens. */
export function diffFileSets(existing: Record<string, Uint8Array>, next: Record<string, Uint8Array>): PublishDiffEntry[] {
  const entries: PublishDiffEntry[] = [];
  for (const path of Object.keys(next)) {
    if (!(path in existing)) entries.push({ path, kind: "added" });
    else if (!bytesEqual(existing[path]!, next[path]!)) entries.push({ path, kind: "changed" });
  }
  for (const path of Object.keys(existing)) {
    if (!(path in next)) entries.push({ path, kind: "removed" });
  }
  return entries.sort((a, b) => a.path.localeCompare(b.path));
}

/** Reads `destDir`'s current contents for diffing — an empty map (not an error) when the directory doesn't exist yet, i.e. this is a first publish. */
export async function readExistingPublishedFiles(platform: FilePlatform, destDir: string): Promise<Record<string, Uint8Array>> {
  if (!(await platform.exists(destDir))) return {};
  return readDirectoryFileSet(platform, destDir);
}

/**
 * Atomically replaces `destDir` with `files`, staging into a sibling temp
 * directory first (so a crash mid-write never touches the live directory)
 * and — unlike `atomicWriteDirectory`'s ephemeral crash-safety backup,
 * which is deleted the moment the swap succeeds — *keeps* the directory's
 * prior contents at `<destDir>.previous`, a deliberate, recoverable
 * "undo my last publish" artifact. Only one generation is kept: a second
 * publish discards the `.previous` from the *publish before that*, never
 * builds an unbounded history.
 */
export async function publishDirectorySwap(platform: FilePlatform, destDir: string, files: Record<string, Uint8Array>): Promise<{ hadPrevious: boolean }> {
  const tempDir = `${destDir}.tmp-${platform.randomId()}`;
  await writeDirectoryFileSet(platform, tempDir, files);

  const previousDir = `${destDir}.previous`;
  const destinationExists = await platform.exists(destDir);
  if (!destinationExists) {
    await platform.rename(tempDir, destDir);
    return { hadPrevious: false };
  }

  if (await platform.exists(previousDir)) await platform.remove(previousDir, { recursive: true });
  await platform.rename(destDir, previousDir);
  try {
    await platform.rename(tempDir, destDir);
  } catch (error) {
    await platform.rename(previousDir, destDir).catch(() => {});
    throw error;
  }
  return { hadPrevious: true };
}

export async function hasPublishBackup(platform: FilePlatform, destDir: string): Promise<boolean> {
  return platform.exists(`${destDir}.previous`);
}

/** Restores `destDir` from its `.previous` backup, if one exists — the explicit "undo last publish" action. Returns `false` (a no-op, not an error) when there's nothing to roll back to. */
export async function rollbackLastPublish(platform: FilePlatform, destDir: string): Promise<boolean> {
  const previousDir = `${destDir}.previous`;
  if (!(await platform.exists(previousDir))) return false;
  const tempAside = `${destDir}.rolled-back-${platform.randomId()}`;
  if (await platform.exists(destDir)) await platform.rename(destDir, tempAside);
  await platform.rename(previousDir, destDir);
  if (await platform.exists(tempAside)) await platform.remove(tempAside, { recursive: true });
  return true;
}
