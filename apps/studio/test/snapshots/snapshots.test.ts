// @vitest-environment node
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createNodeTestPlatform } from "../helpers/nodePlatform.js";
import { withTempDir } from "../helpers/tempDir.js";
import { resolveStudioPaths } from "../../src/project/paths.js";
import { createMinimalProjectTemplate, openProjectFromPath, saveProject } from "../../src/project/projectFile.js";
import { createSnapshot, listSnapshots, MAX_SNAPSHOTS_PER_PROJECT, restoreSnapshotAsNewVersion } from "../../src/snapshots/snapshots.js";

const SDK_VERSION = "0.1.0-test";

function makeTickingClock(startAt = 1_000): () => number {
  let value = startAt;
  return () => {
    value += 1;
    return value;
  };
}

function platformIn(dir: string) {
  return createNodeTestPlatform({ appDataDir: join(dir, "appdata"), appConfigDir: join(dir, "appconfig"), clock: makeTickingClock() });
}

describe("snapshots", () => {
  it("creates a named snapshot and lists it newest first", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const paths = await resolveStudioPaths(platform);
      const projectPath = join(dir, "event.fdstudio");
      const open = await saveProject(platform, { kind: "file", path: projectPath, project: createMinimalProjectTemplate("Event"), assets: {}, lastSavedAt: undefined }, SDK_VERSION);

      await createSnapshot(platform, paths, open, "Before redesign", SDK_VERSION);
      await createSnapshot(platform, paths, open, "After redesign", SDK_VERSION);

      const list = await listSnapshots(platform, paths, projectPath);
      expect(list.map((s) => s.label)).toEqual(["After redesign", "Before redesign"]);
    });
  });

  it("restores a snapshot as a new project file without touching the original", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const paths = await resolveStudioPaths(platform);
      const projectPath = join(dir, "event.fdstudio");
      let open = await saveProject(platform, { kind: "file", path: projectPath, project: createMinimalProjectTemplate("V1"), assets: {}, lastSavedAt: undefined }, SDK_VERSION);
      const snapshot = await createSnapshot(platform, paths, open, "V1 snapshot", SDK_VERSION);

      // Project moves on...
      open = await saveProject(platform, { ...open, project: { ...open.project, metadata: { ...open.project.metadata, name: "V2" } } }, SDK_VERSION);

      const restoredPath = join(dir, "event-restored.fdstudio");
      const restored = await restoreSnapshotAsNewVersion(platform, paths, projectPath, snapshot.id, restoredPath, "file", SDK_VERSION);

      expect(restored.project.metadata.name).toBe("V1");
      const stillCurrent = await openProjectFromPath(platform, projectPath);
      expect(stillCurrent.project.metadata.name).toBe("V2"); // untouched
    });
  });

  it("prunes the oldest snapshots beyond MAX_SNAPSHOTS_PER_PROJECT", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const paths = await resolveStudioPaths(platform);
      const projectPath = join(dir, "event.fdstudio");
      const open = await saveProject(platform, { kind: "file", path: projectPath, project: createMinimalProjectTemplate("Event"), assets: {}, lastSavedAt: undefined }, SDK_VERSION);

      for (let i = 0; i < MAX_SNAPSHOTS_PER_PROJECT + 5; i += 1) {
        await createSnapshot(platform, paths, open, `Snapshot ${i}`, SDK_VERSION);
      }

      const list = await listSnapshots(platform, paths, projectPath);
      expect(list.length).toBe(MAX_SNAPSHOTS_PER_PROJECT);
      expect(list[0]!.label).toBe(`Snapshot ${MAX_SNAPSHOTS_PER_PROJECT + 4}`); // newest kept
      expect(list.some((s) => s.label === "Snapshot 0")).toBe(false); // oldest pruned
    });
  });
});
