// @vitest-environment node
import { join } from "node:path";
import { writeFile, mkdir } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { createNodeTestPlatform } from "../helpers/nodePlatform.js";
import { withTempDir } from "../helpers/tempDir.js";
import {
  createMinimalProjectTemplate,
  duplicateProject,
  exportProjectBackup,
  exportRuntimeTheme,
  importProjectFromFdtheme,
  openProjectFromPath,
  pruneAssetsToProject,
  saveProject,
  saveProjectAs,
} from "../../src/project/projectFile.js";
import { compileTheme, createId, type StudioProjectDocument } from "@fdraft/theme-sdk";
import { packFdtheme, sha256Hex, unpackFdtheme } from "@fdraft/theme-sdk/packaging";

async function withOneImageAsset(project: StudioProjectDocument): Promise<{ project: StudioProjectDocument; assets: Record<string, Uint8Array>; assetId: string; path: string }> {
  const bytes = new TextEncoder().encode("fake-png-bytes");
  const hash = await sha256Hex(bytes);
  const path = `assets/${hash}.png`;
  const assetId = createId();
  const next: StudioProjectDocument = { ...project, assets: [...project.assets, { id: assetId, kind: "image", path, mimeType: "image/png", sizeBytes: bytes.byteLength, sha256: hash }] };
  return { project: next, assets: { [path]: bytes }, assetId, path };
}

const SDK_VERSION = "0.1.0-test";

function platformIn(dir: string) {
  return createNodeTestPlatform({ appDataDir: join(dir, "appdata"), appConfigDir: join(dir, "appconfig") });
}

describe("new / save / open round trip", () => {
  it("creates a minimal template, saves it as a .fdstudio file, and reopens it identically", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const project = createMinimalProjectTemplate("My Event");
      const path = join(dir, "My Event.fdstudio");

      const saved = await saveProject(platform, { kind: "file", path, project, assets: {}, lastSavedAt: undefined }, SDK_VERSION);
      expect(saved.lastSavedAt).toBeTypeOf("number");

      const reopened = await openProjectFromPath(platform, path);
      expect(reopened.project).toEqual(project);
      expect(reopened.kind).toBe("file");
    });
  });

  it("creates, saves, and reopens an unpacked project directory identically", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const project = createMinimalProjectTemplate("Dir Event");
      const path = join(dir, "DirEvent");

      await saveProject(platform, { kind: "directory", path, project, assets: {}, lastSavedAt: undefined }, SDK_VERSION);
      const reopened = await openProjectFromPath(platform, path);
      expect(reopened.project).toEqual(project);
      expect(reopened.kind).toBe("directory");
    });
  });

  it("Save As writes to a new path without touching the original", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const project = createMinimalProjectTemplate("Original");
      const originalPath = join(dir, "original.fdstudio");
      const saved = await saveProject(platform, { kind: "file", path: originalPath, project, assets: {}, lastSavedAt: undefined }, SDK_VERSION);

      const newPath = join(dir, "copy.fdstudio");
      const savedAs = await saveProjectAs(platform, saved, newPath, "file", SDK_VERSION);

      expect(savedAs.path).toBe(newPath);
      expect(await platform.exists(originalPath)).toBe(true);
      expect(await platform.exists(newPath)).toBe(true);
      const reopenedOriginal = await openProjectFromPath(platform, originalPath);
      expect(reopenedOriginal.project.metadata.name).toBe("Original");
    });
  });
});

describe("duplicateProject", () => {
  it("produces a project with a new id, saved to a new path, leaving the source untouched", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const project = createMinimalProjectTemplate("Source");
      const sourcePath = join(dir, "source.fdstudio");
      const source = await saveProject(platform, { kind: "file", path: sourcePath, project, assets: {}, lastSavedAt: undefined }, SDK_VERSION);

      const destPath = join(dir, "duplicate.fdstudio");
      const duplicate = await duplicateProject(platform, source, destPath, "file", SDK_VERSION);

      expect(duplicate.project.metadata.id).not.toBe(project.metadata.id);
      expect(duplicate.project.metadata.name).toBe("Source");
      const reopenedSource = await openProjectFromPath(platform, sourcePath);
      expect(reopenedSource.project.metadata.id).toBe(project.metadata.id);
    });
  });
});

describe("exportProjectBackup", () => {
  it("writes a standalone .fdstudio snapshot without touching the open project's own path", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const project = createMinimalProjectTemplate("Backed Up");
      const path = join(dir, "DirProject"); // directory-kind project
      const open = await saveProject(platform, { kind: "directory", path, project, assets: {}, lastSavedAt: undefined }, SDK_VERSION);

      const backupPath = join(dir, "backup.fdstudio");
      await exportProjectBackup(platform, open, backupPath, SDK_VERSION);

      expect(await platform.exists(backupPath)).toBe(true);
      const reopenedBackup = await openProjectFromPath(platform, backupPath);
      expect(reopenedBackup.kind).toBe("file");
      expect(reopenedBackup.project.metadata.name).toBe("Backed Up");
    });
  });
});

describe("opening malformed packages", () => {
  it("rejects a .fdstudio file that isn't a valid ZIP at all", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const path = join(dir, "corrupt.fdstudio");
      await writeFile(path, "not a zip file");
      await expect(openProjectFromPath(platform, path)).rejects.toThrow();
    });
  });

  it("rejects an unpacked directory missing project.json", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const path = join(dir, "IncompleteProject");
      await mkdir(path, { recursive: true });
      await writeFile(join(path, "manifest.json"), JSON.stringify({ packageFormat: "fdstudio", sdkVersion: "x", projectFormatVersion: "1.0.0", files: [] }));
      await expect(openProjectFromPath(platform, path)).rejects.toThrow();
    });
  });
});

describe("pruneAssetsToProject", () => {
  it("drops bytes for paths the project no longer references, keeps referenced ones", async () => {
    const base = createMinimalProjectTemplate("Prune Test");
    const { project, assets, path } = await withOneImageAsset(base);
    const stalePath = "assets/no-longer-referenced.png";
    const withStale = { ...assets, [stalePath]: new TextEncoder().encode("orphan") };

    const pruned = pruneAssetsToProject(withStale, project);
    expect(Object.keys(pruned)).toEqual([path]);
  });

  it("omits an entry entirely when a referenced asset's bytes are genuinely missing (repair case)", async () => {
    const base = createMinimalProjectTemplate("Missing Asset Test");
    const { project } = await withOneImageAsset(base);
    expect(pruneAssetsToProject({}, project)).toEqual({});
  });
});

describe("save round trip prunes a stale byte pool automatically", () => {
  it("saves and reopens cleanly even when open.assets carries bytes for a deleted asset reference", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const base = createMinimalProjectTemplate("Event");
      const { project, assets } = await withOneImageAsset(base);
      // Simulate: the asset reference was deleted (undo-tracked) but its bytes are still sitting in the additive-only pool.
      const projectWithoutAsset = { ...project, assets: [] };
      const path = join(dir, "event.fdstudio");

      const saved = await saveProject(platform, { kind: "file", path, project: projectWithoutAsset, assets, lastSavedAt: undefined }, SDK_VERSION);
      expect(saved.lastSavedAt).toBeTypeOf("number");

      const reopened = await openProjectFromPath(platform, path);
      expect(reopened.project.assets).toEqual([]);
      expect(reopened.assets).toEqual({});
    });
  });
});

describe("exportRuntimeTheme", () => {
  it("compiles and writes a real, reopenable .fdtheme file", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const base = createMinimalProjectTemplate("Theme Export");
      const destPath = join(dir, "event.fdtheme");

      await exportRuntimeTheme(platform, { kind: "file", path: join(dir, "unused.fdstudio"), project: base, assets: {}, lastSavedAt: undefined }, destPath, { minRendererVersion: "0.1.0" });

      const bytes = await platform.readFile(destPath);
      const { document } = await unpackFdtheme(bytes);
      expect(document.manifest.themeName).toBe("Theme Export");
    });
  });

  it("excludes an asset nothing references from the exported package", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const base = createMinimalProjectTemplate("Theme Export Unused");
      const { project, assets, assetId } = await withOneImageAsset(base);
      const destPath = join(dir, "event.fdtheme");

      await exportRuntimeTheme(platform, { kind: "file", path: join(dir, "unused.fdstudio"), project, assets, lastSavedAt: undefined }, destPath, { minRendererVersion: "0.1.0" });

      const bytes = await platform.readFile(destPath);
      const { document, assets: themeAssets } = await unpackFdtheme(bytes);
      expect(document.assets.some((a) => a.id === assetId)).toBe(false);
      expect(Object.keys(themeAssets)).toEqual([]);
    });
  });

  it("leaves a previously-exported file intact when a later export fails", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const base = createMinimalProjectTemplate("Theme Export Failure");
      const destPath = join(dir, "event.fdtheme");
      await exportRuntimeTheme(platform, { kind: "file", path: join(dir, "unused.fdstudio"), project: base, assets: {}, lastSavedAt: undefined }, destPath, { minRendererVersion: "0.1.0" });
      const goodBytes = await platform.readFile(destPath);

      // A layer referencing a non-existent asset makes compile fail (MISSING_ASSET) after the good file already exists.
      const broken: StudioProjectDocument = { ...base, pages: [{ ...base.pages[0]!, layers: [{ id: createId(), type: "image", name: "broken", assetId: createId(), transform: { x: 0, y: 0, width: 1, height: 1, rotationDeg: 0, scaleX: 1, scaleY: 1 }, opacity: 1, visible: true, locked: false, zIndex: 0, responsive: [], interactionStates: [] }] }] };
      await expect(exportRuntimeTheme(platform, { kind: "file", path: join(dir, "unused.fdstudio"), project: broken, assets: {}, lastSavedAt: undefined }, destPath, { minRendererVersion: "0.1.0" })).rejects.toThrow();

      const stillThere = await platform.readFile(destPath);
      expect(stillThere).toEqual(goodBytes);
    });
  });
});

describe("importProjectFromFdtheme", () => {
  it("imports a compiled theme into a new project with a fresh id and honest warnings", async () => {
    const project = createMinimalProjectTemplate("Compiled Source");
    const bundle = compileTheme(project, {}, { minRendererVersion: "0.1.0" });
    const fdthemeBytes = await packFdtheme(bundle);

    const result = await importProjectFromFdtheme(fdthemeBytes);

    expect(result.project.metadata.id).not.toBe(project.metadata.id);
    expect(result.project.pages).toEqual(project.pages);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some((w) => w.includes("cannot be recovered"))).toBe(true);
  });
});
