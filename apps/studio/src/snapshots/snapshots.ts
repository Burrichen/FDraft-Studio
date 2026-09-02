import { packFdstudio, unpackFdstudio } from "@fdraft/theme-sdk/packaging";
import type { FilePlatform } from "../platform/types.js";
import type { StudioPaths } from "../project/paths.js";
import { projectStorageKey } from "../project/paths.js";
import type { OpenProject, ProjectStorageKind } from "../project/projectFile.js";
import { saveProject } from "../project/projectFile.js";
import { atomicWriteFile } from "../project/atomicSave.js";

/**
 * Bounded but generous: named snapshots are for deliberate "keep this
 * version" checkpoints, not infinite history, so the oldest beyond this
 * cap is pruned automatically whenever a new one is taken. Documented
 * here as the one place this policy is decided.
 */
export const MAX_SNAPSHOTS_PER_PROJECT = 20;

export interface SnapshotRecord {
  id: string;
  label: string;
  createdAt: number;
  projectPath: string;
}

function snapshotDirFor(platform: FilePlatform, paths: StudioPaths, projectPath: string): string {
  return platform.join(paths.snapshotsDir, projectStorageKey(platform, projectPath));
}

function snapshotFilePaths(platform: FilePlatform, snapshotDir: string, id: string): { payload: string; meta: string } {
  return { payload: platform.join(snapshotDir, `${id}.fdstudio`), meta: platform.join(snapshotDir, `${id}.meta.json`) };
}

export async function listSnapshots(platform: FilePlatform, paths: StudioPaths, projectPath: string): Promise<SnapshotRecord[]> {
  const dir = snapshotDirFor(platform, paths, projectPath);
  if (!(await platform.exists(dir))) return [];
  const entries = await platform.readDir(dir);
  const records: SnapshotRecord[] = [];
  for (const entry of entries) {
    if (!entry.isFile || !entry.name.endsWith(".meta.json")) continue;
    try {
      const record = JSON.parse(await platform.readTextFile(platform.join(dir, entry.name))) as SnapshotRecord;
      if (typeof record.id === "string") records.push(record);
    } catch {
      // One corrupted snapshot record must never hide the rest.
    }
  }
  return records.sort((a, b) => b.createdAt - a.createdAt);
}

async function deleteSnapshot(platform: FilePlatform, snapshotDir: string, id: string): Promise<void> {
  const { payload, meta } = snapshotFilePaths(platform, snapshotDir, id);
  await platform.remove(payload).catch(() => {});
  await platform.remove(meta).catch(() => {});
}

async function enforceRetention(platform: FilePlatform, paths: StudioPaths, projectPath: string): Promise<void> {
  const records = await listSnapshots(platform, paths, projectPath); // newest first
  if (records.length <= MAX_SNAPSHOTS_PER_PROJECT) return;
  const dir = snapshotDirFor(platform, paths, projectPath);
  for (const stale of records.slice(MAX_SNAPSHOTS_PER_PROJECT)) {
    await deleteSnapshot(platform, dir, stale.id);
  }
}

/** Takes a named, immutable snapshot of the project's current in-memory state. Pruned automatically to `MAX_SNAPSHOTS_PER_PROJECT`, oldest first. */
export async function createSnapshot(platform: FilePlatform, paths: StudioPaths, open: OpenProject, label: string, sdkVersion: string): Promise<SnapshotRecord> {
  const dir = snapshotDirFor(platform, paths, open.path);
  await platform.mkdir(dir);

  const id = platform.randomId();
  const { payload, meta } = snapshotFilePaths(platform, dir, id);
  const bytes = await packFdstudio({ project: open.project, assets: open.assets, sdkVersion });
  await atomicWriteFile(platform, payload, bytes, async (written) => {
    await unpackFdstudio(written);
  });

  const record: SnapshotRecord = { id, label, createdAt: platform.now(), projectPath: open.path };
  await atomicWriteFile(platform, meta, new TextEncoder().encode(JSON.stringify(record, null, 2)));

  await enforceRetention(platform, paths, open.path);
  return record;
}

async function loadSnapshotPayload(platform: FilePlatform, paths: StudioPaths, projectPath: string, id: string): Promise<{ project: OpenProject["project"]; assets: OpenProject["assets"] }> {
  const dir = snapshotDirFor(platform, paths, projectPath);
  const { payload } = snapshotFilePaths(platform, dir, id);
  const bytes = await platform.readFile(payload);
  const { project, assets } = await unpackFdstudio(bytes);
  return { project, assets };
}

/**
 * Restores a snapshot by saving it to a brand-new path — deliberately
 * never overwrites the current project file, so restoring an old
 * snapshot can never silently discard newer work still on disk.
 */
export async function restoreSnapshotAsNewVersion(
  platform: FilePlatform,
  paths: StudioPaths,
  projectPath: string,
  id: string,
  destPath: string,
  destKind: ProjectStorageKind,
  sdkVersion: string,
): Promise<OpenProject> {
  const { project, assets } = await loadSnapshotPayload(platform, paths, projectPath, id);
  return saveProject(platform, { kind: destKind, path: destPath, project, assets, lastSavedAt: undefined }, sdkVersion);
}

export async function deleteSnapshotById(platform: FilePlatform, paths: StudioPaths, projectPath: string, id: string): Promise<void> {
  await deleteSnapshot(platform, snapshotDirFor(platform, paths, projectPath), id);
}
