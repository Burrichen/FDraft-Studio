import { createId } from "@fdraft/theme-sdk";
import type { AssetFolder, AssetRecord, Id, ImageState, ImageStateGroup, StudioProjectDocument } from "@fdraft/theme-sdk";
import type { Command } from "../history/commandStack.js";

function updateAsset(assets: AssetRecord[], id: Id, updater: (asset: AssetRecord) => AssetRecord): AssetRecord[] {
  return assets.map((a) => (a.id === id ? updater(a) : a));
}

/** Adds a newly-imported asset record. The caller is responsible for merging the asset's bytes into the session's byte pool separately — see `ProjectSession.importAsset`. */
export function buildAddAssetCommand(record: AssetRecord): Command<StudioProjectDocument> {
  return {
    label: "Import asset",
    do: (project) => ({ ...project, assets: [...project.assets, record] }),
    undo: (project) => ({ ...project, assets: project.assets.filter((a) => a.id !== record.id) }),
  };
}

export function renameAsset(project: StudioProjectDocument, assetId: Id, name: string): Command<StudioProjectDocument> | null {
  const before = project.assets.find((a) => a.id === assetId);
  if (!before || (before.name ?? before.originalFileName) === name) return null;
  const beforeName = before.name;
  return {
    label: "Rename asset",
    do: (p) => ({ ...p, assets: updateAsset(p.assets, assetId, (a) => ({ ...a, name })) }),
    undo: (p) => ({ ...p, assets: updateAsset(p.assets, assetId, (a) => ({ ...a, name: beforeName })) }),
  };
}

export function moveAssetToFolder(assetId: Id, before: Id | undefined, after: Id | undefined): Command<StudioProjectDocument> {
  return {
    label: "Move asset",
    do: (project) => ({ ...project, assets: updateAsset(project.assets, assetId, (a) => ({ ...a, folderId: after })) }),
    undo: (project) => ({ ...project, assets: updateAsset(project.assets, assetId, (a) => ({ ...a, folderId: before })) }),
  };
}

export function setAssetTags(project: StudioProjectDocument, assetId: Id, tags: string[]): Command<StudioProjectDocument> | null {
  const before = project.assets.find((a) => a.id === assetId);
  if (!before) return null;
  const beforeTags = before.tags;
  return {
    label: "Edit asset tags",
    do: (p) => ({ ...p, assets: updateAsset(p.assets, assetId, (a) => ({ ...a, tags })) }),
    undo: (p) => ({ ...p, assets: updateAsset(p.assets, assetId, (a) => ({ ...a, tags: beforeTags })) }),
  };
}

/**
 * Replaces an asset's *content* (new bytes, new content-addressed path,
 * new hash/size/dimensions) while keeping its `id` — and therefore every
 * layer/mask/state-group reference to it, and every placed object's own
 * position/properties, which are never keyed off asset content — exactly
 * unchanged. The caller merges the new bytes into the byte pool
 * separately, the same way a fresh import does.
 */
export function buildReplaceAssetSourceCommand(assetId: Id, before: AssetRecord, after: Omit<AssetRecord, "id" | "name" | "tags" | "folderId" | "originalFileName">): Command<StudioProjectDocument> {
  return {
    label: "Replace asset source",
    do: (project) => ({ ...project, assets: updateAsset(project.assets, assetId, (a) => ({ ...a, ...after, id: assetId })) }),
    undo: (project) => ({ ...project, assets: updateAsset(project.assets, assetId, () => before) }),
  };
}

/** A duplicate is a genuinely new asset id pointing at the *same* content-addressed bytes (no re-upload needed) — cheap, and independently renamable/taggable from the original afterward. */
export function buildDuplicateAssetCommand(project: StudioProjectDocument, assetId: Id): Command<StudioProjectDocument> | null {
  const source = project.assets.find((a) => a.id === assetId);
  if (!source) return null;
  const existingNames = new Set(project.assets.map((a) => a.name ?? a.originalFileName).filter((n): n is string => !!n));
  const baseName = source.name ?? source.originalFileName ?? "Asset";
  let name = `${baseName} copy`;
  let n = 2;
  while (existingNames.has(name)) {
    name = `${baseName} copy ${n}`;
    n += 1;
  }
  const clone: AssetRecord = { ...source, id: createId(), name };

  return {
    label: "Duplicate asset",
    do: (p) => ({ ...p, assets: [...p.assets, clone] }),
    undo: (p) => ({ ...p, assets: p.assets.filter((a) => a.id !== clone.id) }),
  };
}

/** Deletes one or more asset records. Their bytes are left in the session's byte pool (nothing else references them, so they're pruned automatically at the next save) — this is what makes the delete cleanly undoable. */
export function buildDeleteAssetsCommand(project: StudioProjectDocument, assetIds: Id[]): Command<StudioProjectDocument> | null {
  const toDelete = project.assets.filter((a) => assetIds.includes(a.id));
  if (toDelete.length === 0) return null;
  const deleteSet = new Set(assetIds);
  return {
    label: toDelete.length > 1 ? "Delete assets" : "Delete asset",
    do: (p) => ({ ...p, assets: p.assets.filter((a) => !deleteSet.has(a.id)) }),
    undo: (p) => ({ ...p, assets: [...p.assets, ...toDelete] }),
  };
}

// ---- Folders ----

export function buildAddFolderCommand(name: string, parentId?: Id): Command<StudioProjectDocument> {
  const folder: AssetFolder = { id: createId(), name, parentId };
  return {
    label: "New folder",
    do: (project) => ({ ...project, assetFolders: [...project.assetFolders, folder] }),
    undo: (project) => ({ ...project, assetFolders: project.assetFolders.filter((f) => f.id !== folder.id) }),
  };
}

export function renameFolder(project: StudioProjectDocument, folderId: Id, name: string): Command<StudioProjectDocument> | null {
  const before = project.assetFolders.find((f) => f.id === folderId);
  if (!before || before.name === name) return null;
  return {
    label: "Rename folder",
    do: (p) => ({ ...p, assetFolders: p.assetFolders.map((f) => (f.id === folderId ? { ...f, name } : f)) }),
    undo: (p) => ({ ...p, assetFolders: p.assetFolders.map((f) => (f.id === folderId ? { ...f, name: before.name } : f)) }),
  };
}

/** Deletes a folder, moving any asset or subfolder directly inside it back to the top level (never deletes assets). */
export function buildDeleteFolderCommand(project: StudioProjectDocument, folderId: Id): Command<StudioProjectDocument> | null {
  const folder = project.assetFolders.find((f) => f.id === folderId);
  if (!folder) return null;
  const movedAssetIds = project.assets.filter((a) => a.folderId === folderId).map((a) => a.id);
  const movedChildFolderIds = project.assetFolders.filter((f) => f.parentId === folderId).map((f) => f.id);

  return {
    label: "Delete folder",
    do: (p) => ({
      ...p,
      assetFolders: p.assetFolders.filter((f) => f.id !== folderId).map((f) => (movedChildFolderIds.includes(f.id) ? { ...f, parentId: undefined } : f)),
      assets: p.assets.map((a) => (movedAssetIds.includes(a.id) ? { ...a, folderId: undefined } : a)),
    }),
    undo: (p) => ({
      ...p,
      assetFolders: [...p.assetFolders.map((f) => (movedChildFolderIds.includes(f.id) ? { ...f, parentId: folderId } : f)), folder],
      assets: p.assets.map((a) => (movedAssetIds.includes(a.id) ? { ...a, folderId } : a)),
    }),
  };
}

// ---- Image state groups ----

export function buildAddImageStateGroupCommand(name: string, states: { name: string; assetId: Id }[]): Command<StudioProjectDocument> | null {
  if (states.length === 0) return null;
  const builtStates: ImageState[] = states.map((s) => ({ id: createId(), name: s.name, assetId: s.assetId }));
  const group: ImageStateGroup = { id: createId(), name, states: builtStates, defaultStateId: builtStates[0]!.id };
  return {
    label: "New image state group",
    do: (project) => ({ ...project, imageStateGroups: [...project.imageStateGroups, group] }),
    undo: (project) => ({ ...project, imageStateGroups: project.imageStateGroups.filter((g) => g.id !== group.id) }),
  };
}

export function renameImageStateGroup(project: StudioProjectDocument, groupId: Id, name: string): Command<StudioProjectDocument> | null {
  const before = project.imageStateGroups.find((g) => g.id === groupId);
  if (!before || before.name === name) return null;
  return {
    label: "Rename image state group",
    do: (p) => ({ ...p, imageStateGroups: p.imageStateGroups.map((g) => (g.id === groupId ? { ...g, name } : g)) }),
    undo: (p) => ({ ...p, imageStateGroups: p.imageStateGroups.map((g) => (g.id === groupId ? { ...g, name: before.name } : g)) }),
  };
}

export function setImageStateGroupDefault(project: StudioProjectDocument, groupId: Id, defaultStateId: Id): Command<StudioProjectDocument> | null {
  const before = project.imageStateGroups.find((g) => g.id === groupId);
  if (!before || !before.states.some((s) => s.id === defaultStateId) || before.defaultStateId === defaultStateId) return null;
  const beforeDefault = before.defaultStateId;
  return {
    label: "Set default image state",
    do: (p) => ({ ...p, imageStateGroups: p.imageStateGroups.map((g) => (g.id === groupId ? { ...g, defaultStateId } : g)) }),
    undo: (p) => ({ ...p, imageStateGroups: p.imageStateGroups.map((g) => (g.id === groupId ? { ...g, defaultStateId: beforeDefault } : g)) }),
  };
}

/** Adds a new named state to an existing group (e.g. adding "35" to Candy Bowl's full/75/empty). */
export function buildAddImageStateCommand(project: StudioProjectDocument, groupId: Id, stateName: string, assetId: Id): Command<StudioProjectDocument> | null {
  const group = project.imageStateGroups.find((g) => g.id === groupId);
  if (!group) return null;
  const state: ImageState = { id: createId(), name: stateName, assetId };
  return {
    label: "Add image state",
    do: (p) => ({ ...p, imageStateGroups: p.imageStateGroups.map((g) => (g.id === groupId ? { ...g, states: [...g.states, state] } : g)) }),
    undo: (p) => ({ ...p, imageStateGroups: p.imageStateGroups.map((g) => (g.id === groupId ? { ...g, states: g.states.filter((s) => s.id !== state.id) } : g)) }),
  };
}

/** Replaces which asset one state points at (e.g. re-pick the artwork for "75") — the state's own id/name, and therefore every condition referencing it, is unchanged. */
export function setImageStateAsset(project: StudioProjectDocument, groupId: Id, stateId: Id, assetId: Id): Command<StudioProjectDocument> | null {
  const group = project.imageStateGroups.find((g) => g.id === groupId);
  const state = group?.states.find((s) => s.id === stateId);
  if (!group || !state || state.assetId === assetId) return null;
  const beforeAssetId = state.assetId;
  return {
    label: "Change image state asset",
    do: (p) => ({ ...p, imageStateGroups: p.imageStateGroups.map((g) => (g.id === groupId ? { ...g, states: g.states.map((s) => (s.id === stateId ? { ...s, assetId } : s)) } : g)) }),
    undo: (p) => ({ ...p, imageStateGroups: p.imageStateGroups.map((g) => (g.id === groupId ? { ...g, states: g.states.map((s) => (s.id === stateId ? { ...s, assetId: beforeAssetId } : s)) } : g)) }),
  };
}

/** Removes one state from a group — refuses to remove the last state (a group must have at least one) or the current default (pick a new default first). */
export function buildDeleteImageStateCommand(project: StudioProjectDocument, groupId: Id, stateId: Id): Command<StudioProjectDocument> | null {
  const group = project.imageStateGroups.find((g) => g.id === groupId);
  const state = group?.states.find((s) => s.id === stateId);
  if (!group || !state || group.states.length <= 1 || group.defaultStateId === stateId) return null;
  const index = group.states.indexOf(state);
  return {
    label: "Delete image state",
    do: (p) => ({ ...p, imageStateGroups: p.imageStateGroups.map((g) => (g.id === groupId ? { ...g, states: g.states.filter((s) => s.id !== stateId) } : g)) }),
    undo: (p) => ({
      ...p,
      imageStateGroups: p.imageStateGroups.map((g) => (g.id === groupId ? { ...g, states: [...g.states.slice(0, index), state, ...g.states.slice(index)] } : g)),
    }),
  };
}
