// @vitest-environment node
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createNodeTestPlatform } from "../helpers/nodePlatform.js";
import { withTempDir } from "../helpers/tempDir.js";
import { clearFDraftLink, loadFDraftLink, saveFDraftLink } from "../../src/publish/fdraftLink.js";

function platformIn(dir: string) {
  return createNodeTestPlatform({ appDataDir: join(dir, "appdata"), appConfigDir: join(dir, "appconfig") });
}

describe("fdraftLink", () => {
  it("returns undefined when nothing has been linked yet", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      expect(await loadFDraftLink(platform, "project-1")).toBeUndefined();
    });
  });

  it("round-trips a saved link", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      await saveFDraftLink(platform, "project-1", "/Users/dev/FDraft");
      const link = await loadFDraftLink(platform, "project-1");
      expect(link?.repoPath).toBe("/Users/dev/FDraft");
    });
  });

  it("keeps links for different projects independent", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      await saveFDraftLink(platform, "project-1", "/Users/dev/FDraft-one");
      await saveFDraftLink(platform, "project-2", "/Users/dev/FDraft-two");
      expect((await loadFDraftLink(platform, "project-1"))?.repoPath).toBe("/Users/dev/FDraft-one");
      expect((await loadFDraftLink(platform, "project-2"))?.repoPath).toBe("/Users/dev/FDraft-two");
    });
  });

  it("clears a link", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      await saveFDraftLink(platform, "project-1", "/Users/dev/FDraft");
      await clearFDraftLink(platform, "project-1");
      expect(await loadFDraftLink(platform, "project-1")).toBeUndefined();
      await expect(clearFDraftLink(platform, "project-1")).resolves.not.toThrow();
    });
  });

  it("treats a corrupted link file as absent rather than throwing", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const linkDir = join(dir, "appdata", "fdraft-links");
      await platform.mkdir(linkDir);
      await platform.writeTextFile(join(linkDir, "project-1.json"), "{ not valid json");
      expect(await loadFDraftLink(platform, "project-1")).toBeUndefined();
    });
  });
});
