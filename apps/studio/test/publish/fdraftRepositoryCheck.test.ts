// @vitest-environment node
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createNodeTestPlatform } from "../helpers/nodePlatform.js";
import { withTempDir } from "../helpers/tempDir.js";
import { checkFDraftRepositoryPlausibility } from "../../src/publish/fdraftRepositoryCheck.js";

function platformIn(dir: string) {
  return createNodeTestPlatform({ appDataDir: join(dir, "appdata"), appConfigDir: join(dir, "appconfig") });
}

describe("checkFDraftRepositoryPlausibility", () => {
  it("is plausible for a repo shaped like the real FDraft", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const repo = join(dir, "FDraft");
      await platform.mkdir(join(repo, "src", "app"));
      await platform.writeTextFile(join(repo, "package.json"), JSON.stringify({ name: "fdraft", dependencies: { "@fdraft/theme-sdk": "https://example.com/x.tgz" } }));

      const result = await checkFDraftRepositoryPlausibility(platform, repo);
      expect(result.plausible).toBe(true);
      expect(result.markersMissing).toEqual([]);
    });
  });

  it("is implausible for an empty/unrelated folder", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const repo = join(dir, "Documents");
      await platform.mkdir(repo);

      const result = await checkFDraftRepositoryPlausibility(platform, repo);
      expect(result.plausible).toBe(false);
      expect(result.markersMissing.length).toBeGreaterThan(0);
    });
  });

  it("is implausible for a differently-named Node project", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const repo = join(dir, "some-other-app");
      await platform.mkdir(repo);
      await platform.writeTextFile(join(repo, "package.json"), JSON.stringify({ name: "some-other-app", dependencies: { react: "^19.0.0" } }));

      const result = await checkFDraftRepositoryPlausibility(platform, repo);
      expect(result.plausible).toBe(false);
    });
  });

  it("treats an unparseable package.json as a missing marker, not a thrown error", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const repo = join(dir, "broken");
      await platform.mkdir(repo);
      await platform.writeTextFile(join(repo, "package.json"), "{ not json");

      await expect(checkFDraftRepositoryPlausibility(platform, repo)).resolves.toMatchObject({ plausible: false });
    });
  });
});
