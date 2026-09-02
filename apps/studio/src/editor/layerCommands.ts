import { createId } from "@fdraft/theme-sdk";
import type { Crop, Id, Layer, Mask, StudioProjectDocument, TextLayer, Transform } from "@fdraft/theme-sdk";
import type { Command } from "../history/commandStack.js";
import type { ContainerRef } from "./containerRef.js";
import { getContainerLayers, updateContainerLayers } from "./containerRef.js";
import {
  findLayer,
  findParentId,
  insertLayerInto,
  isGroupLayer,
  isSameOrDescendant,
  removeLayer,
  siblingsOf,
  updateLayer,
  updateLayers,
} from "./layerTree.js";
import { roundTransform } from "./geometry.js";

// ---- Transform (move/resize/rotate) — one command however many layers a gesture touched ----

export interface LayerTransformChange {
  layerId: Id;
  before: Transform;
  after: Transform;
}

export function setLayerTransforms(ref: ContainerRef, changes: LayerTransformChange[], label = "Transform"): Command<StudioProjectDocument> {
  const rounded = changes.map((c) => ({ ...c, after: roundTransform(c.after) }));
  return {
    label,
    do: (project) =>
      updateContainerLayers(project, ref, (layers) => {
        let next = layers;
        for (const c of rounded) next = updateLayer(next, c.layerId, (l) => ({ ...l, transform: c.after }));
        return next;
      }),
    undo: (project) =>
      updateContainerLayers(project, ref, (layers) => {
        let next = layers;
        for (const c of rounded) next = updateLayer(next, c.layerId, (l) => ({ ...l, transform: c.before }));
        return next;
      }),
  };
}

// ---- Generic single-field property changes ----

function setLayerField<K extends "opacity" | "visible" | "locked" | "name">(
  ref: ContainerRef,
  layerId: Id,
  field: K,
  before: Layer[K],
  after: Layer[K],
  label: string,
): Command<StudioProjectDocument> {
  return {
    label,
    do: (project) => updateContainerLayers(project, ref, (layers) => updateLayer(layers, layerId, (l) => ({ ...l, [field]: after }))),
    undo: (project) => updateContainerLayers(project, ref, (layers) => updateLayer(layers, layerId, (l) => ({ ...l, [field]: before }))),
  };
}

export function setLayerOpacity(ref: ContainerRef, layerId: Id, before: number, after: number): Command<StudioProjectDocument> {
  return setLayerField(ref, layerId, "opacity", before, Math.min(1, Math.max(0, after)), "Change opacity");
}

export function renameLayer(ref: ContainerRef, layerId: Id, before: string, after: string): Command<StudioProjectDocument> {
  return setLayerField(ref, layerId, "name", before, after, "Rename layer");
}

/** Toggles visibility/lock for however many layers are selected — one command either way. */
export function setLayersVisible(ref: ContainerRef, layerIds: Id[], visible: boolean): Command<StudioProjectDocument> {
  const idSet = new Set(layerIds);
  return {
    label: visible ? "Show layers" : "Hide layers",
    do: (project) => updateContainerLayers(project, ref, (layers) => updateLayers(layers, idSet, (l) => ({ ...l, visible }))),
    undo: (project) => updateContainerLayers(project, ref, (layers) => updateLayers(layers, idSet, (l) => ({ ...l, visible: !visible }))),
  };
}

export function setLayersLocked(ref: ContainerRef, layerIds: Id[], locked: boolean): Command<StudioProjectDocument> {
  const idSet = new Set(layerIds);
  return {
    label: locked ? "Lock layers" : "Unlock layers",
    do: (project) => updateContainerLayers(project, ref, (layers) => updateLayers(layers, idSet, (l) => ({ ...l, locked }))),
    undo: (project) => updateContainerLayers(project, ref, (layers) => updateLayers(layers, idSet, (l) => ({ ...l, locked: !locked }))),
  };
}

// ---- Crop / mask (image layers only, but kept generic for any layer with these fields) ----

export function setLayerCrop(ref: ContainerRef, layerId: Id, before: Crop | undefined, after: Crop | undefined): Command<StudioProjectDocument> {
  return {
    label: "Crop image",
    do: (project) => updateContainerLayers(project, ref, (layers) => updateLayer(layers, layerId, (l) => (l.type === "image" ? { ...l, crop: after } : l))),
    undo: (project) => updateContainerLayers(project, ref, (layers) => updateLayer(layers, layerId, (l) => (l.type === "image" ? { ...l, crop: before } : l))),
  };
}

export function setShapeFillColor(ref: ContainerRef, layerId: Id, before: Id | undefined, after: Id | undefined): Command<StudioProjectDocument> {
  return {
    label: "Change fill color",
    do: (project) => updateContainerLayers(project, ref, (layers) => updateLayer(layers, layerId, (l) => (l.type === "shape" ? { ...l, fillColorTokenId: after } : l))),
    undo: (project) => updateContainerLayers(project, ref, (layers) => updateLayer(layers, layerId, (l) => (l.type === "shape" ? { ...l, fillColorTokenId: before } : l))),
  };
}

export function setShapeCornerRadius(ref: ContainerRef, layerId: Id, before: Id | undefined, after: Id | undefined): Command<StudioProjectDocument> {
  return {
    label: "Change corner radius",
    do: (project) => updateContainerLayers(project, ref, (layers) => updateLayer(layers, layerId, (l) => (l.type === "shape" ? { ...l, cornerRadiusTokenId: after } : l))),
    undo: (project) => updateContainerLayers(project, ref, (layers) => updateLayer(layers, layerId, (l) => (l.type === "shape" ? { ...l, cornerRadiusTokenId: before } : l))),
  };
}

export function setLayerMask(ref: ContainerRef, layerId: Id, before: Mask | undefined, after: Mask | undefined): Command<StudioProjectDocument> {
  return {
    label: "Change mask",
    do: (project) => updateContainerLayers(project, ref, (layers) => updateLayer(layers, layerId, (l) => (l.type === "image" ? { ...l, mask: after } : l))),
    undo: (project) => updateContainerLayers(project, ref, (layers) => updateLayer(layers, layerId, (l) => (l.type === "image" ? { ...l, mask: before } : l))),
  };
}

// ---- Text (used by both canvas inline editing and the Copy Workspace) ----

export function setLayerText(ref: ContainerRef, layerId: Id, before: string, after: string): Command<StudioProjectDocument> {
  return {
    label: "Edit text",
    do: (project) => updateContainerLayers(project, ref, (layers) => updateLayer(layers, layerId, (l) => (l.type === "text" ? { ...l, text: after } : l))),
    undo: (project) => updateContainerLayers(project, ref, (layers) => updateLayer(layers, layerId, (l) => (l.type === "text" ? { ...l, text: before } : l))),
  };
}

export function setLayerTextAlign(ref: ContainerRef, layerId: Id, before: TextLayer["align"], after: TextLayer["align"]): Command<StudioProjectDocument> {
  return {
    label: "Change text alignment",
    do: (project) => updateContainerLayers(project, ref, (layers) => updateLayer(layers, layerId, (l) => (l.type === "text" ? { ...l, align: after } : l))),
    undo: (project) => updateContainerLayers(project, ref, (layers) => updateLayer(layers, layerId, (l) => (l.type === "text" ? { ...l, align: before } : l))),
  };
}

// ---- Component layers (copy overrides, zone assignment) ----

/**
 * Sets (or, with `after: undefined`, clears) one declared copy slot's
 * theme-authored override — never the component's action/route/event
 * logic, only what it displays. Clearing falls back to the adapter's own
 * approved default text at render time (`resolveComponentCopy` in
 * `@fdraft/theme-renderer`), enforced there, not here.
 */
export function setComponentCopyOverride(ref: ContainerRef, layerId: Id, slotKey: string, before: string | undefined, after: string | undefined): Command<StudioProjectDocument> {
  const apply = (layer: Layer, value: string | undefined): Layer => {
    if (layer.type !== "component") return layer;
    const overrides = { ...(layer.copyOverrides ?? {}) };
    if (value === undefined) delete overrides[slotKey];
    else overrides[slotKey] = value;
    return { ...layer, copyOverrides: Object.keys(overrides).length > 0 ? overrides : undefined };
  };
  return {
    label: "Edit component copy",
    do: (project) => updateContainerLayers(project, ref, (layers) => updateLayer(layers, layerId, (l) => apply(l, after))),
    undo: (project) => updateContainerLayers(project, ref, (layers) => updateLayer(layers, layerId, (l) => apply(l, before))),
  };
}

export function setComponentZoneKind(ref: ContainerRef, layerId: Id, before: Extract<Layer, { type: "component" }>["zoneKind"], after: Extract<Layer, { type: "component" }>["zoneKind"]): Command<StudioProjectDocument> {
  return {
    label: "Assign zone",
    do: (project) => updateContainerLayers(project, ref, (layers) => updateLayer(layers, layerId, (l) => (l.type === "component" ? { ...l, zoneKind: after } : l))),
    undo: (project) => updateContainerLayers(project, ref, (layers) => updateLayer(layers, layerId, (l) => (l.type === "component" ? { ...l, zoneKind: before } : l))),
  };
}

// ---- Z-order ----

export type ZOrderOp = "forward" | "backward" | "front" | "back";

export function buildZOrderCommand(project: StudioProjectDocument, ref: ContainerRef, layerIds: Id[], op: ZOrderOp): Command<StudioProjectDocument> | null {
  const layers = getContainerLayers(project, ref);
  const byParent = new Map<Id | "root", Id[]>();
  for (const id of layerIds) {
    const parent = findParentId(layers, id);
    if (parent === undefined) continue;
    const list = byParent.get(parent) ?? [];
    list.push(id);
    byParent.set(parent, list);
  }
  if (byParent.size === 0) return null;

  const changes: { layerId: Id; before: number; after: number }[] = [];

  for (const [parentId, ids] of byParent) {
    const siblings = [...siblingsOf(layers, parentId)].sort((a, b) => a.zIndex - b.zIndex);
    const zIndexOf = new Map(siblings.map((l) => [l.id, l.zIndex]));

    if (op === "front") {
      const max = Math.max(...siblings.map((l) => l.zIndex));
      ids.forEach((id, i) => changes.push({ layerId: id, before: zIndexOf.get(id)!, after: max + i + 1 }));
    } else if (op === "back") {
      const min = Math.min(...siblings.map((l) => l.zIndex));
      ids.forEach((id, i) => changes.push({ layerId: id, before: zIndexOf.get(id)!, after: min - ids.length + i }));
    } else if (op === "forward") {
      // Topmost-selected first, so a chain of adjacent selected layers doesn't swap with itself.
      for (const id of [...ids].sort((a, b) => zIndexOf.get(b)! - zIndexOf.get(a)!)) {
        const idx = siblings.findIndex((l) => l.id === id);
        const next = siblings[idx + 1];
        if (next && !ids.includes(next.id)) {
          changes.push({ layerId: id, before: zIndexOf.get(id)!, after: next.zIndex });
          changes.push({ layerId: next.id, before: next.zIndex, after: zIndexOf.get(id)! });
        }
      }
    } else {
      // backward: bottommost-selected first.
      for (const id of [...ids].sort((a, b) => zIndexOf.get(a)! - zIndexOf.get(b)!)) {
        const idx = siblings.findIndex((l) => l.id === id);
        const prev = siblings[idx - 1];
        if (prev && !ids.includes(prev.id)) {
          changes.push({ layerId: id, before: zIndexOf.get(id)!, after: prev.zIndex });
          changes.push({ layerId: prev.id, before: prev.zIndex, after: zIndexOf.get(id)! });
        }
      }
    }
  }

  if (changes.length === 0) return null;

  return {
    label: op === "front" ? "Bring to front" : op === "back" ? "Send to back" : op === "forward" ? "Bring forward" : "Send backward",
    do: (proj) =>
      updateContainerLayers(proj, ref, (ls) => {
        let next = ls;
        for (const c of changes) next = updateLayer(next, c.layerId, (l) => ({ ...l, zIndex: c.after }));
        return next;
      }),
    undo: (proj) =>
      updateContainerLayers(proj, ref, (ls) => {
        let next = ls;
        for (const c of changes) next = updateLayer(next, c.layerId, (l) => ({ ...l, zIndex: c.before }));
        return next;
      }),
  };
}

// ---- Delete / duplicate / paste ----

export interface RemovedLayerRecord {
  layer: Layer;
  parentId: Id | "root";
  index: number;
}

export function buildDeleteCommand(project: StudioProjectDocument, ref: ContainerRef, layerIds: Id[]): Command<StudioProjectDocument> | null {
  const layers = getContainerLayers(project, ref);
  const records: RemovedLayerRecord[] = [];
  for (const id of layerIds) {
    const layer = findLayer(layers, id);
    const parentId = findParentId(layers, id);
    if (layer && parentId !== undefined) records.push({ layer, parentId, index: siblingsOf(layers, parentId).findIndex((l) => l.id === id) });
  }
  if (records.length === 0) return null;

  return {
    label: records.length > 1 ? "Delete layers" : "Delete layer",
    do: (proj) =>
      updateContainerLayers(proj, ref, (ls) => {
        let next = ls;
        for (const r of records) next = removeLayer(next, r.layer.id).layers;
        return next;
      }),
    undo: (proj) =>
      updateContainerLayers(proj, ref, (ls) => {
        let next = ls;
        // Reinsert in original index order (ascending) so relative order is restored.
        for (const r of [...records].sort((a, b) => a.index - b.index)) {
          next = insertLayerInto(next, r.parentId, r.layer, r.index);
        }
        return next;
      }),
  };
}

/** Deep-clones a layer subtree with fresh ids throughout (a duplicated group must not share ids with its source). */
function cloneWithNewIds(layer: Layer): Layer {
  const clone: Layer = { ...layer, id: createId() };
  if (isGroupLayer(clone)) return { ...clone, children: clone.children.map(cloneWithNewIds) };
  return clone;
}

const DUPLICATE_OFFSET_PX = 24;

export function buildDuplicateCommand(project: StudioProjectDocument, ref: ContainerRef, layerIds: Id[]): Command<StudioProjectDocument> | null {
  const layers = getContainerLayers(project, ref);
  const toDuplicate = layerIds.map((id) => ({ source: findLayer(layers, id), parentId: findParentId(layers, id) })).filter((x): x is { source: Layer; parentId: Id | "root" } => !!x.source && x.parentId !== undefined);
  if (toDuplicate.length === 0) return null;

  const clones = toDuplicate.map(({ source, parentId }) => {
    const cloned = cloneWithNewIds(source);
    const offset: Layer = { ...cloned, transform: { ...cloned.transform, x: cloned.transform.x + DUPLICATE_OFFSET_PX, y: cloned.transform.y + DUPLICATE_OFFSET_PX } };
    return { clone: offset, parentId };
  });

  return {
    label: clones.length > 1 ? "Duplicate layers" : "Duplicate layer",
    do: (proj) =>
      updateContainerLayers(proj, ref, (ls) => {
        let next = ls;
        for (const { clone, parentId } of clones) next = insertLayerInto(next, parentId, clone);
        return next;
      }),
    undo: (proj) =>
      updateContainerLayers(proj, ref, (ls) => {
        let next = ls;
        for (const { clone } of clones) next = removeLayer(next, clone.id).layers;
        return next;
      }),
  };
}

/** Pastes previously-copied layers (already-cloned, fresh ids) at the top level of the target container, optionally offset. */
export function buildPasteCommand(ref: ContainerRef, layers: Layer[], offset: { dx: number; dy: number }): Command<StudioProjectDocument> {
  const pasted = layers.map((l) => cloneWithNewIds({ ...l, transform: { ...l.transform, x: l.transform.x + offset.dx, y: l.transform.y + offset.dy } }));
  return {
    label: "Paste",
    do: (project) =>
      updateContainerLayers(project, ref, (ls) => {
        let next = ls;
        for (const l of pasted) next = insertLayerInto(next, "root", l);
        return next;
      }),
    undo: (project) =>
      updateContainerLayers(project, ref, (ls) => {
        let next = ls;
        for (const l of pasted) next = removeLayer(next, l.id).layers;
        return next;
      }),
  };
}

// ---- Group / ungroup ----

export function buildGroupCommand(project: StudioProjectDocument, ref: ContainerRef, layerIds: Id[]): Command<StudioProjectDocument> | null {
  const layers = getContainerLayers(project, ref);
  if (layerIds.length < 2) return null;
  const parents = new Set(layerIds.map((id) => findParentId(layers, id)));
  if (parents.size !== 1) return null; // must be siblings
  const [parentId] = [...parents];
  if (parentId === undefined) return null;

  const siblings = siblingsOf(layers, parentId);
  const selected = siblings.filter((l) => layerIds.includes(l.id));
  if (selected.length !== layerIds.length) return null;
  const insertIndex = Math.min(...selected.map((l) => siblings.indexOf(l)));

  const xs = selected.map((l) => l.transform.x);
  const ys = selected.map((l) => l.transform.y);
  const groupTransform: Transform = {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...selected.map((l) => l.transform.x + l.transform.width)) - Math.min(...xs),
    height: Math.max(...selected.map((l) => l.transform.y + l.transform.height)) - Math.min(...ys),
    rotationDeg: 0,
    scaleX: 1,
    scaleY: 1,
  };

  const newGroup: Layer = {
    id: createId(),
    type: "group",
    name: "Group",
    transform: groupTransform,
    opacity: 1,
    visible: true,
    locked: false,
    zIndex: Math.max(...selected.map((l) => l.zIndex)),
    responsive: [],
    interactionStates: [],
    children: selected,
  };

  return {
    label: "Group",
    do: (proj) =>
      updateContainerLayers(proj, ref, (ls) => {
        let next = ls;
        for (const id of layerIds) next = removeLayer(next, id).layers;
        return insertLayerInto(next, parentId, newGroup, insertIndex);
      }),
    undo: (proj) =>
      updateContainerLayers(proj, ref, (ls) => {
        let next = removeLayer(ls, newGroup.id).layers;
        selected.forEach((l, i) => {
          next = insertLayerInto(next, parentId, l, insertIndex + i);
        });
        return next;
      }),
  };
}

export function buildUngroupCommand(project: StudioProjectDocument, ref: ContainerRef, groupId: Id): Command<StudioProjectDocument> | null {
  const layers = getContainerLayers(project, ref);
  const group = findLayer(layers, groupId);
  if (!group || !isGroupLayer(group)) return null;
  const parentId = findParentId(layers, groupId);
  if (parentId === undefined) return null;
  const siblings = siblingsOf(layers, parentId);
  const insertIndex = siblings.findIndex((l) => l.id === groupId);
  const children = group.children;

  return {
    label: "Ungroup",
    do: (proj) =>
      updateContainerLayers(proj, ref, (ls) => {
        let next = removeLayer(ls, groupId).layers;
        children.forEach((c, i) => {
          next = insertLayerInto(next, parentId, c, insertIndex + i);
        });
        return next;
      }),
    undo: (proj) =>
      updateContainerLayers(proj, ref, (ls) => {
        let next = ls;
        for (const c of children) next = removeLayer(next, c.id).layers;
        return insertLayerInto(next, parentId, group, insertIndex);
      }),
  };
}

/** Reparents one layer under a new group (or to the root), used by Layers-tree drag-and-drop. Returns `null` for an illegal move (into itself or its own descendant). */
export function buildReparentCommand(project: StudioProjectDocument, ref: ContainerRef, layerId: Id, newParentId: Id | "root", newIndex: number): Command<StudioProjectDocument> | null {
  const layers = getContainerLayers(project, ref);
  if (newParentId !== "root" && isSameOrDescendant(layers, layerId, newParentId)) return null;
  const oldParentId = findParentId(layers, layerId);
  if (oldParentId === undefined) return null;
  const oldIndex = siblingsOf(layers, oldParentId).findIndex((l) => l.id === layerId);
  const layer = findLayer(layers, layerId);
  if (!layer) return null;

  return {
    label: "Reorder layer",
    do: (proj) => updateContainerLayers(proj, ref, (ls) => insertLayerInto(removeLayer(ls, layerId).layers, newParentId, layer, newIndex)),
    undo: (proj) => updateContainerLayers(proj, ref, (ls) => insertLayerInto(removeLayer(ls, layerId).layers, oldParentId, layer, oldIndex)),
  };
}

// ---- Align / distribute ----

export type AlignEdge = "left" | "center" | "right" | "top" | "middle" | "bottom";

export function buildAlignCommand(project: StudioProjectDocument, ref: ContainerRef, layerIds: Id[], edge: AlignEdge): Command<StudioProjectDocument> | null {
  const layers = getContainerLayers(project, ref);
  const targets = layerIds.map((id) => findLayer(layers, id)).filter((l): l is Layer => !!l);
  if (targets.length < 2) return null;

  const minX = Math.min(...targets.map((l) => l.transform.x));
  const maxX = Math.max(...targets.map((l) => l.transform.x + l.transform.width));
  const minY = Math.min(...targets.map((l) => l.transform.y));
  const maxY = Math.max(...targets.map((l) => l.transform.y + l.transform.height));

  const changes: LayerTransformChange[] = targets.map((l) => {
    const t = l.transform;
    let x = t.x;
    let y = t.y;
    if (edge === "left") x = minX;
    else if (edge === "right") x = maxX - t.width;
    else if (edge === "center") x = minX + (maxX - minX) / 2 - t.width / 2;
    else if (edge === "top") y = minY;
    else if (edge === "bottom") y = maxY - t.height;
    else if (edge === "middle") y = minY + (maxY - minY) / 2 - t.height / 2;
    return { layerId: l.id, before: t, after: { ...t, x, y } };
  });

  return setLayerTransforms(ref, changes, `Align ${edge}`);
}

export function buildDistributeCommand(project: StudioProjectDocument, ref: ContainerRef, layerIds: Id[], axis: "horizontal" | "vertical"): Command<StudioProjectDocument> | null {
  const layers = getContainerLayers(project, ref);
  const targets = layerIds.map((id) => findLayer(layers, id)).filter((l): l is Layer => !!l);
  if (targets.length < 3) return null;

  const sorted = [...targets].sort((a, b) => (axis === "horizontal" ? a.transform.x - b.transform.x : a.transform.y - b.transform.y));
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;

  if (axis === "horizontal") {
    const span = last.transform.x - (first.transform.x + first.transform.width);
    const totalGapWidth = sorted.slice(1, -1).reduce((sum, l) => sum + l.transform.width, 0);
    const gap = (span - totalGapWidth) / (sorted.length - 1);
    let cursor = first.transform.x + first.transform.width + gap;
    const changes: LayerTransformChange[] = [];
    for (const layer of sorted.slice(1, -1)) {
      changes.push({ layerId: layer.id, before: layer.transform, after: { ...layer.transform, x: cursor } });
      cursor += layer.transform.width + gap;
    }
    return changes.length > 0 ? setLayerTransforms(ref, changes, "Distribute horizontally") : null;
  }

  const span = last.transform.y - (first.transform.y + first.transform.height);
  const totalGapHeight = sorted.slice(1, -1).reduce((sum, l) => sum + l.transform.height, 0);
  const gap = (span - totalGapHeight) / (sorted.length - 1);
  let cursor = first.transform.y + first.transform.height + gap;
  const changes: LayerTransformChange[] = [];
  for (const layer of sorted.slice(1, -1)) {
    changes.push({ layerId: layer.id, before: layer.transform, after: { ...layer.transform, y: cursor } });
    cursor += layer.transform.height + gap;
  }
  return changes.length > 0 ? setLayerTransforms(ref, changes, "Distribute vertically") : null;
}
