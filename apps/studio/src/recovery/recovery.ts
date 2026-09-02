import { packFdstudio, unpackFdstudio } from "@fdraft/theme-sdk/packaging";
import type { FilePlatform } from "../platform/types.js";
import type { StudioPaths } from "../project/paths.js";
import { projectStorageKey } from "../project/paths.js";
import type { OpenProject } from "../project/projectFile.js";
import { atomicWriteFile } from "../project/atomicSave.js";

export interface RecoveryRecord {
  key: string;
  projectPath: string;
  projectKind: OpenProject["kind"];
  /** When this autosave was written. */
  savedAt: number;
  /** The real project's own `lastSavedAt` at the moment of this autosave — lets a host decide whether the autosave is actually newer than what's on disk. */
  sourceLastSavedAt: number | undefined;
}

function recoveryFilePaths(platform: FilePlatform, paths: StudioPaths, key: string): { payload: string; meta: string } {
  return {
    payload: platform.join(paths.recoveryDir, `${key}.fdstudio`),
    meta: platform.join(paths.recoveryDir, `${key}.meta.json`),
  };
}

/**
 * Writes the current in-memory project to its own recovery slot —
 * *never* to `open.path` itself, so autosave can never overwrite an
 * explicitly saved package with invalid or merely-newer-but-unreviewed
 * data. Validated before being written, same as a real save.
 */
export async function writeAutosave(platform: FilePlatform, paths: StudioPaths, open: OpenProject, sdkVersion: string): Promise<void> {
  const key = projectStorageKey(platform, open.path);
  const { payload, meta } = recoveryFilePaths(platform, paths, key);

  await platform.mkdir(paths.recoveryDir);
  const bytes = await packFdstudio({ project: open.project, assets: open.assets, sdkVersion });
  await atomicWriteFile(platform, payload, bytes, async (written) => {
    await unpackFdstudio(written);
  });

  const record: RecoveryRecord = {
    key,
    projectPath: open.path,
    projectKind: open.kind,
    savedAt: platform.now(),
    sourceLastSavedAt: open.lastSavedAt,
  };
  await atomicWriteFile(platform, meta, new TextEncoder().encode(JSON.stringify(record, null, 2)));
}

/** Every recovery record currently on disk, skipping any individually-corrupted entry rather than failing the whole scan. */
export async function listRecoveryCandidates(platform: FilePlatform, paths: StudioPaths): Promise<RecoveryRecord[]> {
  if (!(await platform.exists(paths.recoveryDir))) return [];
  const entries = await platform.readDir(paths.recoveryDir);
  const records: RecoveryRecord[] = [];
  for (const entry of entries) {
    if (!entry.isFile || !entry.name.endsWith(".meta.json")) continue;
    try {
      const text = await platform.readTextFile(platform.join(paths.recoveryDir, entry.name));
      const record = JSON.parse(text) as RecoveryRecord;
      if (typeof record.key === "string" && typeof record.projectPath === "string") records.push(record);
    } catch {
      // A corrupted recovery record must never block recovery for other projects.
    }
  }
  return records;
}

/** True if this autosave is newer than whatever was last explicitly saved for real — i.e. worth offering to the user. */
export function isRecoveryNewer(record: RecoveryRecord, currentLastSavedAt: number | undefined): boolean {
  if (currentLastSavedAt === undefined) return true;
  return record.savedAt > currentLastSavedAt;
}

/** Loads a recovery payload back into an `OpenProject`-shaped value, re-validating it exactly like opening a real file would. */
export async function loadRecoveryPayload(platform: FilePlatform, paths: StudioPaths, record: RecoveryRecord): Promise<OpenProject> {
  const { payload } = recoveryFilePaths(platform, paths, record.key);
  const bytes = await platform.readFile(payload);
  const { project, assets } = await unpackFdstudio(bytes);
  return { kind: record.projectKind, path: record.projectPath, project, assets, lastSavedAt: record.sourceLastSavedAt };
}

/** Discards a recovery slot — after the user chooses "discard", or once its content has been folded into a real save. */
export async function discardRecovery(platform: FilePlatform, paths: StudioPaths, key: string): Promise<void> {
  const { payload, meta } = recoveryFilePaths(platform, paths, key);
  await platform.remove(payload).catch(() => {});
  await platform.remove(meta).catch(() => {});
}
