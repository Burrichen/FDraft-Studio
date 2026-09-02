// @vitest-environment node
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createNodeTestPlatform } from "../helpers/nodePlatform.js";
import { withTempDir } from "../helpers/tempDir.js";
import { resolveStudioPaths } from "../../src/project/paths.js";
import { createMinimalProjectTemplate, saveProject } from "../../src/project/projectFile.js";
import { discardRecovery, isRecoveryNewer, listRecoveryCandidates, loadRecoveryPayload, writeAutosave } from "../../src/recovery/recovery.js";

const SDK_VERSION = "0.1.0-test";

function platformIn(dir: string, clock?: () => number) {
  return createNodeTestPlatform({ appDataDir: join(dir, "appdata"), appConfigDir: join(dir, "appconfig"), clock });
}

/** A strictly-increasing clock so `lastSavedAt`/`savedAt` timestamps recorded microseconds apart in a test are never accidentally equal, the way two real `Date.now()` calls in the same millisecond would be. */
function makeTickingClock(startAt = 1_000): () => number {
  let value = startAt;
  return () => {
    value += 1;
    return value;
  };
}

describe("crash recovery", () => {
  it("writes an autosave to the recovery dir without touching the real project file", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const paths = await resolveStudioPaths(platform);
      const projectPath = join(dir, "event.fdstudio");
      const saved = await saveProject(platform, { kind: "file", path: projectPath, project: createMinimalProjectTemplate("Event"), assets: {}, lastSavedAt: undefined }, SDK_VERSION);

      const edited = { ...saved, project: { ...saved.project, metadata: { ...saved.project.metadata, name: "Unsaved Edit" } } };
      await writeAutosave(platform, paths, edited, SDK_VERSION);

      // The real file on disk still has the saved name, not the unsaved edit.
      const onDisk = await platform.readFile(projectPath);
      expect(new TextDecoder().decode(onDisk)).not.toContain("Unsaved Edit");

      const candidates = await listRecoveryCandidates(platform, paths);
      expect(candidates).toHaveLength(1);
      expect(candidates[0]!.projectPath).toBe(projectPath);
    });
  });

  it("full flow: autosave, simulate a crash (no clean close), detect and restore on next launch", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir, makeTickingClock());
      const paths = await resolveStudioPaths(platform);
      const projectPath = join(dir, "event.fdstudio");
      const saved = await saveProject(platform, { kind: "file", path: projectPath, project: createMinimalProjectTemplate("Event"), assets: {}, lastSavedAt: undefined }, SDK_VERSION);

      const edited = { ...saved, project: { ...saved.project, metadata: { ...saved.project.metadata, name: "Recovered Name" } } };
      await writeAutosave(platform, paths, edited, SDK_VERSION);
      // No explicit save, no clean shutdown — simulating a crash right here.

      // "Next launch": scan for recovery candidates for this project.
      const candidates = await listRecoveryCandidates(platform, paths);
      const candidate = candidates.find((c) => c.projectPath === projectPath);
      expect(candidate).toBeDefined();
      expect(isRecoveryNewer(candidate!, saved.lastSavedAt)).toBe(true);

      const restored = await loadRecoveryPayload(platform, paths, candidate!);
      expect(restored.project.metadata.name).toBe("Recovered Name");

      await discardRecovery(platform, paths, candidate!.key);
      expect(await listRecoveryCandidates(platform, paths)).toHaveLength(0);
    });
  });

  it("does not offer recovery once a real save is newer than the autosave", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const paths = await resolveStudioPaths(platform);
      const projectPath = join(dir, "event.fdstudio");
      let open = await saveProject(platform, { kind: "file", path: projectPath, project: createMinimalProjectTemplate("Event"), assets: {}, lastSavedAt: undefined }, SDK_VERSION);

      await writeAutosave(platform, paths, open, SDK_VERSION);
      const [candidate] = await listRecoveryCandidates(platform, paths);

      // User saves for real *after* the autosave — recovery should no longer be offered.
      open = await saveProject(platform, { ...open, lastSavedAt: candidate!.savedAt + 1000 }, SDK_VERSION);
      expect(isRecoveryNewer(candidate!, open.lastSavedAt)).toBe(false);
    });
  });

  it("ignores a corrupted recovery record instead of crashing the scan", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const paths = await resolveStudioPaths(platform);
      await platform.mkdir(paths.recoveryDir);
      await platform.writeTextFile(platform.join(paths.recoveryDir, "broken.meta.json"), "{ not json");

      expect(await listRecoveryCandidates(platform, paths)).toEqual([]);
    });
  });
});
