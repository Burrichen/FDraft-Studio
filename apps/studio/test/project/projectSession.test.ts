// @vitest-environment node
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import type { ShapeLayer } from "@fdraft/theme-sdk";
import { unpackFdtheme } from "@fdraft/theme-sdk/packaging";
import { createNodeTestPlatform } from "../helpers/nodePlatform.js";
import { withTempDir } from "../helpers/tempDir.js";
import { resolveStudioPaths } from "../../src/project/paths.js";
import { ProjectSession } from "../../src/project/projectSession.js";
import { openProjectFromPath } from "../../src/project/projectFile.js";
import { listRecoveryCandidates, loadRecoveryPayload, writeAutosave } from "../../src/recovery/recovery.js";
import type { ContainerRef } from "../../src/editor/containerRef.js";
import { getContainerLayers } from "../../src/editor/containerRef.js";
import { buildPasteCommand } from "../../src/editor/layerCommands.js";
import { buildAddAssetCommand } from "../../src/assets/assetCommands.js";

const SDK_VERSION = "0.1.0-test";

function rect(id: string): ShapeLayer {
  return {
    id,
    type: "shape",
    name: id,
    shape: "rect",
    transform: { x: 0, y: 0, width: 10, height: 10, rotationDeg: 0, scaleX: 1, scaleY: 1 },
    opacity: 1,
    visible: true,
    locked: false,
    zIndex: 0,
    responsive: [],
    interactionStates: [],
  };
}

async function makeSession(dir: string) {
  const platform = createNodeTestPlatform({ appDataDir: join(dir, "appdata"), appConfigDir: join(dir, "appconfig") });
  const paths = await resolveStudioPaths(platform);
  return { platform, paths, session: new ProjectSession(platform, paths, SDK_VERSION) };
}

describe("ProjectSession: new/open/save", () => {
  it("starts empty", async () => {
    await withTempDir(async (dir) => {
      const { session } = await makeSession(dir);
      expect(session.getState().status).toBe("empty");
    });
  });

  it("newProject creates an unsaved, non-dirty project ready to Save As", async () => {
    await withTempDir(async (dir) => {
      const { session } = await makeSession(dir);
      session.newProject("My Event");
      const state = session.getState();
      expect(state.status).toBe("ready");
      expect(state.open?.project.metadata.name).toBe("My Event");
      expect(state.dirty).toBe(false); // a fresh, unedited template is not "dirty"
    });
  });

  it("newProjectFromTemplate starts from the chosen starter template", async () => {
    await withTempDir(async (dir) => {
      const { session } = await makeSession(dir);
      session.newProjectFromTemplate("Halloween Bash", "standard-fdraft");
      const state = session.getState();
      expect(state.open?.project.metadata.name).toBe("Halloween Bash");
      expect(state.open?.project.pages).toHaveLength(8);
      expect(state.dirty).toBe(false);
    });
  });

  it("saveAs then save persists edits and clears dirty", async () => {
    await withTempDir(async (dir) => {
      const { platform, session } = await makeSession(dir);
      session.newProject("Event");
      const path = join(dir, "event.fdstudio");
      await session.saveAs(path, "file");
      expect(session.getState().dirty).toBe(false);
      expect(session.getState().open?.path).toBe(path);

      session.editMetadata({ name: "Renamed Event" });
      expect(session.getState().dirty).toBe(true);

      await session.save();
      expect(session.getState().dirty).toBe(false);

      const reopened = await openProjectFromPath(platform, path);
      expect(reopened.project.metadata.name).toBe("Renamed Event");
    });
  });

  it("open() surfaces a clean error state for a missing path instead of throwing uncaught", async () => {
    await withTempDir(async (dir) => {
      const { session } = await makeSession(dir);
      await expect(session.open(join(dir, "does-not-exist.fdstudio"))).rejects.toThrow();
      expect(session.getState().status).toBe("error");
      expect(session.getState().errorMessage).toMatch(/moved or deleted|not found|no such/i);
    });
  });
});

describe("ProjectSession: undo/redo", () => {
  it("editMetadata is undoable/redoable and updates dirty/history flags", async () => {
    await withTempDir(async (dir) => {
      const { session } = await makeSession(dir);
      session.newProject("Original");
      const path = join(dir, "event.fdstudio");
      await session.saveAs(path, "file");
      expect(session.getState().canUndo).toBe(false);

      session.editMetadata({ name: "Edited" });
      expect(session.getState().open?.project.metadata.name).toBe("Edited");
      expect(session.getState().canUndo).toBe(true);
      expect(session.getState().dirty).toBe(true);

      session.undo();
      expect(session.getState().open?.project.metadata.name).toBe("Original");
      expect(session.getState().dirty).toBe(false); // back to exactly the saved content
      expect(session.getState().canRedo).toBe(true);

      session.redo();
      expect(session.getState().open?.project.metadata.name).toBe("Edited");
    });
  });
});

describe("ProjectSession: applyCommand and transactions", () => {
  it("applyCommand runs a layer command as one undo step", async () => {
    await withTempDir(async (dir) => {
      const { session } = await makeSession(dir);
      session.newProject("Event");
      const pageId = session.getState().open!.project.pages[0]!.id;
      const ref: ContainerRef = { kind: "page", id: pageId };
      session.applyCommand(buildPasteCommand(ref, [rect("a")], { dx: 0, dy: 0 }));
      expect(getContainerLayers(session.getState().open!.project, ref)).toHaveLength(1);
      expect(session.getState().canUndo).toBe(true);

      session.undo();
      expect(getContainerLayers(session.getState().open!.project, ref)).toHaveLength(0);
      expect(session.getState().canRedo).toBe(true);
    });
  });

  it("beginTransaction/commitTransaction folds several applyCommand calls into a single undo step", async () => {
    await withTempDir(async (dir) => {
      const { session } = await makeSession(dir);
      session.newProject("Event");
      const pageId = session.getState().open!.project.pages[0]!.id;
      const ref: ContainerRef = { kind: "page", id: pageId };

      session.beginTransaction("Add two layers");
      session.applyCommand(buildPasteCommand(ref, [rect("a")], { dx: 0, dy: 0 }));
      session.applyCommand(buildPasteCommand(ref, [rect("b")], { dx: 0, dy: 0 }));
      expect(getContainerLayers(session.getState().open!.project, ref)).toHaveLength(2);
      session.commitTransaction();

      expect(session.getState().canUndo).toBe(true);
      expect(session.getState().undoLabel).toBe("Add two layers");

      session.undo();
      expect(getContainerLayers(session.getState().open!.project, ref)).toHaveLength(0); // both additions undone together
      expect(session.getState().canUndo).toBe(false);
    });
  });

  it("commitTransaction with nothing applied is a harmless no-op", async () => {
    await withTempDir(async (dir) => {
      const { session } = await makeSession(dir);
      session.newProject("Event");
      session.beginTransaction("Empty");
      session.commitTransaction();
      expect(session.getState().canUndo).toBe(false);
    });
  });
});

describe("ProjectSession: assets", () => {
  it("mergeAssetBytes adds to the byte pool and applyCommand records the reference as one undoable step", async () => {
    await withTempDir(async (dir) => {
      const { session } = await makeSession(dir);
      session.newProject("Event");
      const bytes = new TextEncoder().encode("fake-image-bytes");
      const record = { id: "a1", kind: "image" as const, path: "assets/a1.png", mimeType: "image/png", sizeBytes: bytes.byteLength, sha256: "a".repeat(64), name: "a1.png" };

      session.mergeAssetBytes({ [record.path]: bytes });
      expect(session.getState().open?.assets[record.path]).toBe(bytes);

      session.applyCommand(buildAddAssetCommand(record));
      expect(session.getState().open?.project.assets).toEqual([record]);
      expect(session.getState().canUndo).toBe(true);

      session.undo();
      expect(session.getState().open?.project.assets).toEqual([]);
      // The byte pool still has the bytes even though the reference was undone — pruned only at save time.
      expect(session.getState().open?.assets[record.path]).toBe(bytes);
    });
  });

  it("exportRuntimeTheme compiles and writes a real .fdtheme file", async () => {
    await withTempDir(async (dir) => {
      const { session } = await makeSession(dir);
      session.newProject("Theme Export");
      const destPath = join(dir, "event.fdtheme");
      await session.exportRuntimeTheme(destPath, { minRendererVersion: "0.1.0" });

      const { document } = await unpackFdtheme(await readFile(destPath));
      expect(document.manifest.themeName).toBe("Theme Export");
    });
  });
});

describe("ProjectSession: close with unsaved changes", () => {
  it("does not close when the confirmation callback declines", async () => {
    await withTempDir(async (dir) => {
      const { session } = await makeSession(dir);
      session.newProject("Event");
      await session.saveAs(join(dir, "event.fdstudio"), "file");
      session.editMetadata({ name: "Dirty" });

      const closed = await session.close(async () => false);
      expect(closed).toBe(false);
      expect(session.getState().status).toBe("ready");
    });
  });

  it("closes immediately without prompting when there are no unsaved changes", async () => {
    await withTempDir(async (dir) => {
      const { session } = await makeSession(dir);
      session.newProject("Event");
      await session.saveAs(join(dir, "event.fdstudio"), "file");

      let promptCalls = 0;
      const closed = await session.close(async () => {
        promptCalls += 1;
        return true;
      });
      expect(closed).toBe(true);
      expect(promptCalls).toBe(0);
      expect(session.getState().status).toBe("empty");
    });
  });
});

describe("ProjectSession: resuming from recovery", () => {
  it("marks a recovered project dirty so it can never be silently treated as already saved", async () => {
    await withTempDir(async (dir) => {
      const { platform, paths, session } = await makeSession(dir);
      const path = join(dir, "event.fdstudio");
      session.newProject("Event");
      await session.saveAs(path, "file");
      session.editMetadata({ name: "Unsaved recovery content" });
      await writeAutosave(platform, paths, session.getState().open!, "0.1.0-test");
      const [record] = await listRecoveryCandidates(platform, paths);

      const recovered = await loadRecoveryPayload(platform, paths, record!);
      session.resumeFromRecovery(recovered);

      expect(session.getState().dirty).toBe(true);
      expect(session.getState().open?.project.metadata.name).toBe("Unsaved recovery content");
    });
  });
});

describe("ProjectSession: autosave", () => {
  it("writes a recovery entry only when the project is dirty and has a real path", async () => {
    await withTempDir(async (dir) => {
      const { platform, paths, session } = await makeSession(dir);

      session.newProject("Event"); // no path yet
      await session.autosaveTick();
      expect(await listRecoveryCandidates(platform, paths)).toEqual([]);

      const path = join(dir, "event.fdstudio");
      await session.saveAs(path, "file");
      await session.autosaveTick(); // not dirty right after a save
      expect(await listRecoveryCandidates(platform, paths)).toEqual([]);

      session.editMetadata({ name: "Unsaved" });
      await session.autosaveTick();
      const candidates = await listRecoveryCandidates(platform, paths);
      expect(candidates).toHaveLength(1);
    });
  });

  it("never throws out of autosaveTick even if the write fails", async () => {
    await withTempDir(async (dir) => {
      const { session, platform, paths } = await makeSession(dir);
      session.newProject("Event");
      await session.saveAs(join(dir, "event.fdstudio"), "file");
      session.editMetadata({ name: "Unsaved" });

      // Make the recovery dir unwritable by pre-creating it as a file, forcing a real failure.
      await platform.mkdir(paths.appDataDir);
      await platform.writeTextFile(paths.recoveryDir, "not a directory");

      await expect(session.autosaveTick()).resolves.toBeUndefined();
    });
  });
});

describe("ProjectSession: saveAs rejects a path too long for Windows before writing anything", () => {
  it("throws and leaves no file behind, rather than attempting a partial write", async () => {
    await withTempDir(async (dir) => {
      const { session, platform } = await makeSession(dir);
      session.newProject("Event");
      const tooLong = join(dir, "a".repeat(300), "event.fdstudio");

      await expect(session.saveAs(tooLong, "file")).rejects.toThrow(/exceeds Windows' path length limit/);
      expect(await platform.exists(tooLong)).toBe(false);
    });
  });
});
