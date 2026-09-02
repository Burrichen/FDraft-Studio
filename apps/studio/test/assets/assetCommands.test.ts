// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createId, createProject, type AssetRecord, type StudioProjectDocument } from "@fdraft/theme-sdk";
import {
  buildAddAssetCommand,
  buildAddFolderCommand,
  buildAddImageStateCommand,
  buildAddImageStateGroupCommand,
  buildDeleteAssetsCommand,
  buildDeleteFolderCommand,
  buildDeleteImageStateCommand,
  buildDuplicateAssetCommand,
  buildReplaceAssetSourceCommand,
  moveAssetToFolder,
  renameAsset,
  renameFolder,
  renameImageStateGroup,
  setAssetTags,
  setImageStateAsset,
  setImageStateGroupDefault,
} from "../../src/assets/assetCommands.js";

function project(): StudioProjectDocument {
  return createProject({ id: createId(), name: "Test" });
}

function asset(id: string, overrides: Partial<AssetRecord> = {}): AssetRecord {
  return { id, kind: "image", path: `assets/${id}.png`, mimeType: "image/png", sizeBytes: 10, sha256: "a".repeat(64), name: `${id}.png`, ...overrides };
}

describe("buildAddAssetCommand / buildDeleteAssetsCommand", () => {
  it("adds and undoes", () => {
    const p = project();
    const record = asset("a1");
    const cmd = buildAddAssetCommand(record);
    const after = cmd.do(p);
    expect(after.assets).toEqual([record]);
    expect(cmd.undo(after).assets).toEqual([]);
  });

  it("deletes one or more assets and undo restores them", () => {
    const p = { ...project(), assets: [asset("a1"), asset("a2")] };
    const cmd = buildDeleteAssetsCommand(p, ["a1"])!;
    const after = cmd.do(p);
    expect(after.assets.map((a) => a.id)).toEqual(["a2"]);
    const undone = cmd.undo(after);
    expect(undone.assets.map((a) => a.id).sort()).toEqual(["a1", "a2"]);
  });

  it("returns null deleting nothing", () => {
    expect(buildDeleteAssetsCommand(project(), ["missing"])).toBeNull();
  });
});

describe("renameAsset / setAssetTags / moveAssetToFolder", () => {
  it("renames and undoes", () => {
    const p = { ...project(), assets: [asset("a1")] };
    const cmd = renameAsset(p, "a1", "New Name.png")!;
    const after = cmd.do(p);
    expect(after.assets[0]!.name).toBe("New Name.png");
    expect(cmd.undo(after).assets[0]!.name).toBe("a1.png");
  });

  it("returns null when the name is unchanged", () => {
    const p = { ...project(), assets: [asset("a1")] };
    expect(renameAsset(p, "a1", "a1.png")).toBeNull();
  });

  it("sets tags and undoes", () => {
    const p = { ...project(), assets: [asset("a1")] };
    const cmd = setAssetTags(p, "a1", ["hero", "poster"])!;
    const after = cmd.do(p);
    expect(after.assets[0]!.tags).toEqual(["hero", "poster"]);
    expect(cmd.undo(after).assets[0]!.tags).toBeUndefined();
  });

  it("moves an asset to a folder and back", () => {
    const p = { ...project(), assets: [asset("a1")] };
    const cmd = moveAssetToFolder("a1", undefined, "folder-1");
    const after = cmd.do(p);
    expect(after.assets[0]!.folderId).toBe("folder-1");
    expect(cmd.undo(after).assets[0]!.folderId).toBeUndefined();
  });
});

describe("buildReplaceAssetSourceCommand", () => {
  it("keeps the asset id while replacing its content, and undo restores the old content exactly", () => {
    const original = asset("a1", { sha256: "a".repeat(64), sizeBytes: 10, path: "assets/aaa.png" });
    const p = { ...project(), assets: [original] };
    const replacement = { kind: "image" as const, path: "assets/bbb.png", mimeType: "image/png", sizeBytes: 20, sha256: "b".repeat(64), width: 100, height: 50 };

    const cmd = buildReplaceAssetSourceCommand("a1", original, replacement);
    const after = cmd.do(p);
    expect(after.assets[0]!.id).toBe("a1"); // id preserved -> every layer reference stays valid
    expect(after.assets[0]!.path).toBe("assets/bbb.png");
    expect(after.assets[0]!.sha256).toBe("b".repeat(64));
    expect(after.assets[0]!.name).toBe(original.name); // display name untouched by a source replace

    const undone = cmd.undo(after);
    expect(undone.assets[0]).toEqual(original);
  });
});

describe("buildDuplicateAssetCommand", () => {
  it("creates a new id pointing at the same content, with a disambiguated name", () => {
    const original = asset("a1", { name: "Logo.png" });
    const p = { ...project(), assets: [original] };
    const cmd = buildDuplicateAssetCommand(p, "a1")!;
    const after = cmd.do(p);
    expect(after.assets).toHaveLength(2);
    const clone = after.assets[1]!;
    expect(clone.id).not.toBe("a1");
    expect(clone.path).toBe(original.path); // same bytes, no re-upload
    expect(clone.name).toBe("Logo.png copy");
    expect(cmd.undo(after).assets).toHaveLength(1);
  });
});

describe("folders", () => {
  it("adds a folder and undoes", () => {
    const p = project();
    const cmd = buildAddFolderCommand("Backgrounds");
    const after = cmd.do(p);
    expect(after.assetFolders).toHaveLength(1);
    expect(after.assetFolders[0]!.name).toBe("Backgrounds");
    expect(cmd.undo(after).assetFolders).toEqual([]);
  });

  it("renames a folder and undoes", () => {
    const p = { ...project(), assetFolders: [{ id: "f1", name: "Old" }] };
    const cmd = renameFolder(p, "f1", "New")!;
    const after = cmd.do(p);
    expect(after.assetFolders[0]!.name).toBe("New");
    expect(cmd.undo(after).assetFolders[0]!.name).toBe("Old");
  });

  it("deleting a folder moves its assets and child folders to the top level, and undo restores everything", () => {
    const p: StudioProjectDocument = {
      ...project(),
      assetFolders: [{ id: "f1", name: "Parent" }, { id: "f2", name: "Child", parentId: "f1" }],
      assets: [asset("a1", { folderId: "f1" })],
    };
    const cmd = buildDeleteFolderCommand(p, "f1")!;
    const after = cmd.do(p);
    expect(after.assetFolders.map((f) => f.id)).toEqual(["f2"]);
    expect(after.assetFolders[0]!.parentId).toBeUndefined();
    expect(after.assets[0]!.folderId).toBeUndefined();

    const undone = cmd.undo(after);
    expect(undone.assetFolders.find((f) => f.id === "f1")).toBeDefined();
    expect(undone.assetFolders.find((f) => f.id === "f2")!.parentId).toBe("f1");
    expect(undone.assets[0]!.folderId).toBe("f1");
  });
});

describe("image state groups", () => {
  it("adds a group with states and a default, and undoes", () => {
    const p = project();
    const cmd = buildAddImageStateGroupCommand("Candy Bowl", [
      { name: "full", assetId: "a-full" },
      { name: "empty", assetId: "a-empty" },
    ])!;
    const after = cmd.do(p);
    expect(after.imageStateGroups).toHaveLength(1);
    const group = after.imageStateGroups[0]!;
    expect(group.states.map((s) => s.name)).toEqual(["full", "empty"]);
    expect(group.defaultStateId).toBe(group.states[0]!.id);
    expect(cmd.undo(after).imageStateGroups).toEqual([]);
  });

  it("returns null for a group with no states", () => {
    expect(buildAddImageStateGroupCommand("Empty", [])).toBeNull();
  });

  it("renames a group and undoes", () => {
    const p = { ...project(), imageStateGroups: [{ id: "g1", name: "Old", defaultStateId: "s1", states: [{ id: "s1", name: "full", assetId: "a1" }] }] };
    const cmd = renameImageStateGroup(p, "g1", "New")!;
    const after = cmd.do(p);
    expect(after.imageStateGroups[0]!.name).toBe("New");
    expect(cmd.undo(after).imageStateGroups[0]!.name).toBe("Old");
  });

  it("changes the default state and undoes", () => {
    const p = {
      ...project(),
      imageStateGroups: [{ id: "g1", name: "Candy Bowl", defaultStateId: "s1", states: [{ id: "s1", name: "full", assetId: "a1" }, { id: "s2", name: "empty", assetId: "a2" }] }],
    };
    const cmd = setImageStateGroupDefault(p, "g1", "s2")!;
    const after = cmd.do(p);
    expect(after.imageStateGroups[0]!.defaultStateId).toBe("s2");
    expect(cmd.undo(after).imageStateGroups[0]!.defaultStateId).toBe("s1");
  });

  it("refuses to set an unknown state as default", () => {
    const p = { ...project(), imageStateGroups: [{ id: "g1", name: "g", defaultStateId: "s1", states: [{ id: "s1", name: "full", assetId: "a1" }] }] };
    expect(setImageStateGroupDefault(p, "g1", "unknown")).toBeNull();
  });

  it("adds a new state to an existing group and undoes", () => {
    const p = { ...project(), imageStateGroups: [{ id: "g1", name: "g", defaultStateId: "s1", states: [{ id: "s1", name: "full", assetId: "a1" }] }] };
    const cmd = buildAddImageStateCommand(p, "g1", "75", "a2")!;
    const after = cmd.do(p);
    expect(after.imageStateGroups[0]!.states.map((s) => s.name)).toEqual(["full", "75"]);
    expect(cmd.undo(after).imageStateGroups[0]!.states.map((s) => s.name)).toEqual(["full"]);
  });

  it("changes which asset a state points at, keeping the state's own id, and undoes", () => {
    const p = { ...project(), imageStateGroups: [{ id: "g1", name: "g", defaultStateId: "s1", states: [{ id: "s1", name: "full", assetId: "a1" }] }] };
    const cmd = setImageStateAsset(p, "g1", "s1", "a-new")!;
    const after = cmd.do(p);
    expect(after.imageStateGroups[0]!.states[0]!).toEqual({ id: "s1", name: "full", assetId: "a-new" });
    expect(cmd.undo(after).imageStateGroups[0]!.states[0]!.assetId).toBe("a1");
  });

  it("deletes a non-default state and undo restores it at its original position", () => {
    const p = {
      ...project(),
      imageStateGroups: [{ id: "g1", name: "g", defaultStateId: "s1", states: [{ id: "s1", name: "full", assetId: "a1" }, { id: "s2", name: "75", assetId: "a2" }, { id: "s3", name: "empty", assetId: "a3" }] }],
    };
    const cmd = buildDeleteImageStateCommand(p, "g1", "s2")!;
    const after = cmd.do(p);
    expect(after.imageStateGroups[0]!.states.map((s) => s.id)).toEqual(["s1", "s3"]);
    const undone = cmd.undo(after);
    expect(undone.imageStateGroups[0]!.states.map((s) => s.id)).toEqual(["s1", "s2", "s3"]);
  });

  it("refuses to delete the last remaining state", () => {
    const p = { ...project(), imageStateGroups: [{ id: "g1", name: "g", defaultStateId: "s1", states: [{ id: "s1", name: "full", assetId: "a1" }] }] };
    expect(buildDeleteImageStateCommand(p, "g1", "s1")).toBeNull();
  });

  it("refuses to delete the current default state", () => {
    const p = { ...project(), imageStateGroups: [{ id: "g1", name: "g", defaultStateId: "s1", states: [{ id: "s1", name: "full", assetId: "a1" }, { id: "s2", name: "empty", assetId: "a2" }] }] };
    expect(buildDeleteImageStateCommand(p, "g1", "s1")).toBeNull();
  });
});
