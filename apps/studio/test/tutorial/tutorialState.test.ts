// @vitest-environment node
import { join } from "node:path";
import { writeFile, mkdir } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { createNodeTestPlatform } from "../helpers/nodePlatform.js";
import { withTempDir } from "../helpers/tempDir.js";
import { resolveStudioPaths } from "../../src/project/paths.js";
import { loadTutorialState, saveTutorialState } from "../../src/tutorial/tutorialState.js";

function platformIn(dir: string) {
  return createNodeTestPlatform({ appDataDir: join(dir, "appdata"), appConfigDir: join(dir, "appconfig") });
}

describe("tutorial state persistence", () => {
  it("defaults to never-shown, never-completed when no file exists yet", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const paths = await resolveStudioPaths(platform);
      expect(await loadTutorialState(platform, paths)).toEqual({ completed: false, hasBeenShown: false });
    });
  });

  it("round-trips a saved state", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const paths = await resolveStudioPaths(platform);
      await saveTutorialState(platform, paths, { completed: true, hasBeenShown: true });
      expect(await loadTutorialState(platform, paths)).toEqual({ completed: true, hasBeenShown: true });
    });
  });

  it("treats a corrupted state file as never-shown, rather than failing to start", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const paths = await resolveStudioPaths(platform);
      await mkdir(join(dir, "appconfig"), { recursive: true });
      await writeFile(paths.tutorialStateFile, "{ not valid json", "utf-8");
      expect(await loadTutorialState(platform, paths)).toEqual({ completed: false, hasBeenShown: false });
    });
  });

  it("treats a well-formed but wrong-shaped file as never-shown", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const paths = await resolveStudioPaths(platform);
      await mkdir(join(dir, "appconfig"), { recursive: true });
      await writeFile(paths.tutorialStateFile, JSON.stringify({ unrelated: true }), "utf-8");
      expect(await loadTutorialState(platform, paths)).toEqual({ completed: false, hasBeenShown: false });
    });
  });
});
