// @vitest-environment node
import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { createNodeTestPlatform } from "../helpers/nodePlatform.js";
import { withTempDir } from "../helpers/tempDir.js";
import { resolveStudioPaths } from "../../src/project/paths.js";
import { checkRecentProjectPaths, loadRecentProjects, recordRecentProject, removeRecentProject } from "../../src/recent/recentProjects.js";

function platformIn(dir: string) {
  return createNodeTestPlatform({ appDataDir: join(dir, "appdata"), appConfigDir: join(dir, "appconfig") });
}

describe("recent projects", () => {
  it("starts empty when no recent-projects file exists yet", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const paths = await resolveStudioPaths(platform);
      expect(await loadRecentProjects(platform, paths)).toEqual([]);
    });
  });

  it("records entries most-recent-first and de-duplicates by path", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const paths = await resolveStudioPaths(platform);

      await recordRecentProject(platform, paths, { path: "/a.fdstudio", name: "A", kind: "file", lastOpenedAt: 1 });
      await recordRecentProject(platform, paths, { path: "/b.fdstudio", name: "B", kind: "file", lastOpenedAt: 2 });
      const afterReopeningA = await recordRecentProject(platform, paths, { path: "/a.fdstudio", name: "A", kind: "file", lastOpenedAt: 3 });

      expect(afterReopeningA.map((e) => e.path)).toEqual(["/a.fdstudio", "/b.fdstudio"]);
      expect(afterReopeningA[0]!.lastOpenedAt).toBe(3);
    });
  });

  it("caps the list at MAX_RECENT_PROJECTS, dropping the oldest", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const paths = await resolveStudioPaths(platform);
      let list = await loadRecentProjects(platform, paths);
      for (let i = 0; i < 15; i += 1) {
        list = await recordRecentProject(platform, paths, { path: `/p${i}.fdstudio`, name: `P${i}`, kind: "file", lastOpenedAt: i });
      }
      expect(list.length).toBe(10);
      expect(list[0]!.path).toBe("/p14.fdstudio");
      expect(list.some((e) => e.path === "/p0.fdstudio")).toBe(false);
    });
  });

  it("removeRecentProject drops exactly one entry", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const paths = await resolveStudioPaths(platform);
      await recordRecentProject(platform, paths, { path: "/a.fdstudio", name: "A", kind: "file", lastOpenedAt: 1 });
      await recordRecentProject(platform, paths, { path: "/b.fdstudio", name: "B", kind: "file", lastOpenedAt: 2 });

      const after = await removeRecentProject(platform, paths, "/a.fdstudio");
      expect(after.map((e) => e.path)).toEqual(["/b.fdstudio"]);
    });
  });

  it("ignores a corrupted recent-projects file instead of failing startup", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const paths = await resolveStudioPaths(platform);
      await platform.mkdir(paths.appConfigDir);
      await writeFile(paths.recentProjectsFile, "{ this is not valid json");

      expect(await loadRecentProjects(platform, paths)).toEqual([]);
    });
  });

  it("flags recent entries whose paths no longer exist, without throwing", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const paths = await resolveStudioPaths(platform);
      const realPath = join(dir, "real.fdstudio");
      await platform.writeTextFile(realPath, "{}");

      const entries = await recordRecentProject(platform, paths, { path: realPath, name: "Real", kind: "file", lastOpenedAt: 1 });
      const withMoved = [...entries, { path: join(dir, "moved-or-deleted.fdstudio"), name: "Gone", kind: "file" as const, lastOpenedAt: 2 }];

      const statuses = await checkRecentProjectPaths(platform, withMoved);
      expect(statuses.find((s) => s.name === "Real")?.missing).toBe(false);
      expect(statuses.find((s) => s.name === "Gone")?.missing).toBe(true);
    });
  });
});
