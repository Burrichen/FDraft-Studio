// @vitest-environment node
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createNodeTestPlatform } from "../helpers/nodePlatform.js";
import { withTempDir } from "../helpers/tempDir.js";
import { diffFileSets, hasPublishBackup, publishDirectorySwap, readExistingPublishedFiles, rollbackLastPublish } from "../../src/publish/publishDirectorySwap.js";

function platformIn(dir: string) {
  return createNodeTestPlatform({ appDataDir: join(dir, "appdata"), appConfigDir: join(dir, "appconfig") });
}

const enc = (s: string) => new TextEncoder().encode(s);

describe("diffFileSets", () => {
  it("reports added, changed, and removed files, sorted", () => {
    const existing = { "a.txt": enc("old"), "b.txt": enc("same") };
    const next = { "b.txt": enc("same"), "c.txt": enc("new") };
    expect(diffFileSets(existing, next)).toEqual([
      { path: "a.txt", kind: "removed" },
      { path: "c.txt", kind: "added" },
    ]);
  });

  it("flags a byte-level content change even at the same path", () => {
    const existing = { "theme.fdtheme": enc("v1") };
    const next = { "theme.fdtheme": enc("v2") };
    expect(diffFileSets(existing, next)).toEqual([{ path: "theme.fdtheme", kind: "changed" }]);
  });

  it("reports nothing for two identical file sets", () => {
    const files = { "a.txt": enc("same") };
    expect(diffFileSets(files, { ...files })).toEqual([]);
  });
});

describe("readExistingPublishedFiles", () => {
  it("returns an empty map for a directory that doesn't exist yet (first publish)", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      expect(await readExistingPublishedFiles(platform, join(dir, "nope"))).toEqual({});
    });
  });
});

describe("publishDirectorySwap / rollbackLastPublish", () => {
  it("writes a fresh directory when none existed before, with no backup", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const dest = join(dir, "src", "theme-packs", "my-event");
      const result = await publishDirectorySwap(platform, dest, { "theme.fdtheme": enc("v1") });
      expect(result.hadPrevious).toBe(false);
      expect(await platform.readFile(join(dest, "theme.fdtheme"))).toEqual(enc("v1"));
      expect(await hasPublishBackup(platform, dest)).toBe(false);
    });
  });

  it("keeps the prior contents as a recoverable .previous backup on a second publish", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const dest = join(dir, "src", "theme-packs", "my-event");
      await publishDirectorySwap(platform, dest, { "theme.fdtheme": enc("v1") });
      const second = await publishDirectorySwap(platform, dest, { "theme.fdtheme": enc("v2") });

      expect(second.hadPrevious).toBe(true);
      expect(await platform.readFile(join(dest, "theme.fdtheme"))).toEqual(enc("v2"));
      expect(await hasPublishBackup(platform, dest)).toBe(true);
      expect(await platform.readFile(join(`${dest}.previous`, "theme.fdtheme"))).toEqual(enc("v1"));
    });
  });

  it("rollbackLastPublish restores the previous version and removes the .previous marker", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const dest = join(dir, "src", "theme-packs", "my-event");
      await publishDirectorySwap(platform, dest, { "theme.fdtheme": enc("v1") });
      await publishDirectorySwap(platform, dest, { "theme.fdtheme": enc("v2") });

      const rolledBack = await rollbackLastPublish(platform, dest);
      expect(rolledBack).toBe(true);
      expect(await platform.readFile(join(dest, "theme.fdtheme"))).toEqual(enc("v1"));
      expect(await hasPublishBackup(platform, dest)).toBe(false);
    });
  });

  it("rollbackLastPublish is a no-op returning false when there's nothing to roll back to", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const dest = join(dir, "src", "theme-packs", "my-event");
      await publishDirectorySwap(platform, dest, { "theme.fdtheme": enc("v1") });
      expect(await rollbackLastPublish(platform, dest)).toBe(false);
    });
  });

  it("only ever keeps one generation of backup — a third publish discards the oldest", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const dest = join(dir, "src", "theme-packs", "my-event");
      await publishDirectorySwap(platform, dest, { "theme.fdtheme": enc("v1") });
      await publishDirectorySwap(platform, dest, { "theme.fdtheme": enc("v2") });
      await publishDirectorySwap(platform, dest, { "theme.fdtheme": enc("v3") });

      expect(await platform.readFile(join(dest, "theme.fdtheme"))).toEqual(enc("v3"));
      expect(await platform.readFile(join(`${dest}.previous`, "theme.fdtheme"))).toEqual(enc("v2"));
    });
  });

  it("removes a file that's no longer part of the published set", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const dest = join(dir, "theme-projects", "my-event");
      await publishDirectorySwap(platform, dest, { "project.json": enc("{}"), "assets/old.png": enc("bytes") });
      await publishDirectorySwap(platform, dest, { "project.json": enc("{}") });

      expect(await platform.exists(join(dest, "assets", "old.png"))).toBe(false);
      expect(await platform.exists(join(dest, "project.json"))).toBe(true);
    });
  });

  it("leaves an unrelated sibling file in the parent directory untouched", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const packsRoot = join(dir, "src", "theme-packs");
      await platform.mkdir(packsRoot);
      await platform.writeTextFile(join(packsRoot, "README.md"), "unrelated");

      await publishDirectorySwap(platform, join(packsRoot, "my-event"), { "theme.fdtheme": enc("v1") });

      expect(await platform.readTextFile(join(packsRoot, "README.md"))).toBe("unrelated");
    });
  });
});
