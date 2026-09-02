// @vitest-environment node
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createNodeTestPlatform } from "../helpers/nodePlatform.js";
import { withTempDir } from "../helpers/tempDir.js";
import { atomicWriteFile, atomicWriteDirectory } from "../../src/project/atomicSave.js";
import { readDirectoryFileSet } from "../../src/project/directoryFileSet.js";

function platformIn(dir: string) {
  return createNodeTestPlatform({ appDataDir: join(dir, "appdata"), appConfigDir: join(dir, "appconfig") });
}

describe("atomicWriteFile", () => {
  it("writes the destination file and leaves no temp sibling behind on success", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const dest = join(dir, "project.fdstudio");
      await atomicWriteFile(platform, dest, new TextEncoder().encode("hello"));

      expect(await readFile(dest, "utf8")).toBe("hello");
      const siblings = await platform.readDir(dir);
      expect(siblings.map((e) => e.name)).toEqual(["project.fdstudio"]);
    });
  });

  it("never touches the destination when validation fails, and cleans up the temp file", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const dest = join(dir, "project.fdstudio");
      await atomicWriteFile(platform, dest, new TextEncoder().encode("good"));

      let caught: unknown;
      try {
        await atomicWriteFile(platform, dest, new TextEncoder().encode("bad"), async () => {
          throw new Error("invalid package");
        });
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(Error);
      expect(await readFile(dest, "utf8")).toBe("good"); // untouched
      const siblings = await platform.readDir(dir);
      expect(siblings.map((e) => e.name)).toEqual(["project.fdstudio"]); // no orphaned .tmp-*
    });
  });

  it("replaces an existing file's content only after a successful validation", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const dest = join(dir, "project.fdstudio");
      await atomicWriteFile(platform, dest, new TextEncoder().encode("v1"));
      await atomicWriteFile(platform, dest, new TextEncoder().encode("v2"), async () => {});
      expect(await readFile(dest, "utf8")).toBe("v2");
    });
  });
});

describe("atomicWriteDirectory", () => {
  it("creates a fresh destination directory from a file map", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const dest = join(dir, "MyProject");
      await atomicWriteDirectory(platform, dest, { "project.json": new TextEncoder().encode("{}"), "assets/a.png": new Uint8Array([1, 2, 3]) });

      const files = await readDirectoryFileSet(platform, dest);
      expect(Object.keys(files).sort()).toEqual(["assets/a.png", "project.json"]);
    });
  });

  it("replaces an existing directory's contents wholesale, leaving no .tmp-*/.bak-* siblings on success", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const dest = join(dir, "MyProject");
      await atomicWriteDirectory(platform, dest, { "project.json": new TextEncoder().encode("v1"), "assets/old.png": new Uint8Array([1]) });
      await atomicWriteDirectory(platform, dest, { "project.json": new TextEncoder().encode("v2") });

      const files = await readDirectoryFileSet(platform, dest);
      expect(files).toEqual({ "project.json": new TextEncoder().encode("v2") });

      const siblings = await platform.readDir(dir);
      expect(siblings.map((e) => e.name)).toEqual(["MyProject"]);
    });
  });

  it("never touches the destination directory when validation fails", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const dest = join(dir, "MyProject");
      await atomicWriteDirectory(platform, dest, { "project.json": new TextEncoder().encode("good") });

      let caught: unknown;
      try {
        await atomicWriteDirectory(platform, dest, { "project.json": new TextEncoder().encode("bad") }, async () => {
          throw new Error("invalid");
        });
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(Error);
      const files = await readDirectoryFileSet(platform, dest);
      expect(files).toEqual({ "project.json": new TextEncoder().encode("good") });

      const siblings = await platform.readDir(dir);
      expect(siblings.map((e) => e.name)).toEqual(["MyProject"]); // no orphaned temp/backup dirs
    });
  });

  it("simulates a crash between the two renames: recovers by keeping the original via the backup", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const dest = join(dir, "MyProject");
      await atomicWriteDirectory(platform, dest, { "project.json": new TextEncoder().encode("original") });

      // Reproduce exactly what atomicWriteDirectory's second half does, but
      // stop after the *first* rename (dest -> backup) to simulate a crash
      // before the swap-in completes.
      const tempDir = `${dest}.tmp-crash`;
      await writeSingleFile(platform, tempDir, "project.json", "new-but-never-arrives");
      const backupDir = `${dest}.bak-crash`;
      await platform.rename(dest, backupDir);
      // <-- process "crashes" here; destination is now missing, backup holds the original.

      // Recovery on next launch: destination missing, a .bak-* sibling with
      // real content exists — the safe move is to restore it.
      expect(await platform.exists(dest)).toBe(false);
      await platform.rename(backupDir, dest);

      const files = await readDirectoryFileSet(platform, dest);
      expect(files["project.json"]).toEqual(new TextEncoder().encode("original"));
    });
  });
});

async function writeSingleFile(platform: ReturnType<typeof platformIn>, dir: string, name: string, content: string): Promise<void> {
  await platform.mkdir(dir);
  await platform.writeFile(platform.join(dir, name), new TextEncoder().encode(content));
}
