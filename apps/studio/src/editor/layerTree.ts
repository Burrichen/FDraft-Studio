import type { GroupLayer, Id, Layer } from "@fdraft/theme-sdk";

/** True only for a group layer — the sole layer type with children. */
export function isGroupLayer(layer: Layer): layer is GroupLayer {
  return layer.type === "group";
}

/** Depth-first, includes group containers themselves alongside their children. */
export function flattenLayers(layers: Layer[]): Layer[] {
  const out: Layer[] = [];
  for (const layer of layers) {
    out.push(layer);
    if (isGroupLayer(layer)) out.push(...flattenLayers(layer.children));
  }
  return out;
}

export function findLayer(layers: Layer[], id: Id): Layer | undefined {
  for (const layer of layers) {
    if (layer.id === id) return layer;
    if (isGroupLayer(layer)) {
      const found = findLayer(layer.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

/** The id of `id`'s containing group, `"root"` if it's top-level in the container, or `undefined` if `id` doesn't exist. */
export function findParentId(layers: Layer[], id: Id): Id | "root" | undefined {
  for (const layer of layers) {
    if (layer.id === id) return "root";
    if (isGroupLayer(layer)) {
      if (layer.children.some((c) => c.id === id)) return layer.id;
      const found = findParentId(layer.children, id);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

/** Every id from `id` up to (not including) the root — nearest ancestor first. */
export function ancestorChain(layers: Layer[], id: Id): Id[] {
  const chain: Id[] = [];
  let current: Id | "root" | undefined = findParentId(layers, id);
  while (current !== undefined && current !== "root") {
    chain.push(current);
    current = findParentId(layers, current);
  }
  return chain;
}

/** True if `candidateId` is `ancestorId` itself or nested anywhere inside it — the check that prevents a group being moved into its own descendant. */
export function isSameOrDescendant(layers: Layer[], ancestorId: Id, candidateId: Id): boolean {
  if (ancestorId === candidateId) return true;
  const ancestor = findLayer(layers, ancestorId);
  if (!ancestor || !isGroupLayer(ancestor)) return false;
  return flattenLayers(ancestor.children).some((l) => l.id === candidateId);
}

/** Recursively rebuilds the tree, replacing every layer for which `updater` returns a new value (identity-compared) — used for all immutable single/multi-layer edits. */
export function mapLayers(layers: Layer[], updater: (layer: Layer) => Layer): Layer[] {
  return layers.map((layer) => {
    const updated = updater(layer);
    if (isGroupLayer(updated)) {
      const newChildren = mapLayers(updated.children, updater);
      return newChildren === updated.children ? updated : { ...updated, children: newChildren };
    }
    return updated;
  });
}

export function updateLayer(layers: Layer[], id: Id, updater: (layer: Layer) => Layer): Layer[] {
  return mapLayers(layers, (layer) => (layer.id === id ? updater(layer) : layer));
}

export function updateLayers(layers: Layer[], ids: ReadonlySet<Id>, updater: (layer: Layer) => Layer): Layer[] {
  return mapLayers(layers, (layer) => (ids.has(layer.id) ? updater(layer) : layer));
}

/** Removes one layer (from wherever it is in the tree) and returns both the new tree and the removed layer plus where it was, for undo and for reparenting (e.g. group/move). */
export interface RemovedLayer {
  layer: Layer;
  parentId: Id | "root";
  index: number;
}

export function removeLayer(layers: Layer[], id: Id): { layers: Layer[]; removed: RemovedLayer | undefined } {
  const index = layers.findIndex((l) => l.id === id);
  if (index !== -1) {
    const removed = layers[index]!;
    return { layers: [...layers.slice(0, index), ...layers.slice(index + 1)], removed: { layer: removed, parentId: "root", index } };
  }
  for (const layer of layers) {
    if (isGroupLayer(layer)) {
      const result = removeLayer(layer.children, id);
      if (result.removed) {
        return {
          layers: layers.map((l) => (l.id === layer.id ? { ...layer, children: result.layers } : l)),
          removed: { ...result.removed, parentId: result.removed.parentId === "root" ? layer.id : result.removed.parentId },
        };
      }
    }
  }
  return { layers, removed: undefined };
}

/** Inserts `layer` into the top-level of `layers` at `index` (default: end). To insert into a group, call on that group's `children` and rewrap. */
export function insertLayerAt(layers: Layer[], layer: Layer, index: number = layers.length): Layer[] {
  return [...layers.slice(0, index), layer, ...layers.slice(index)];
}

/** Inserts `layer` as a child of the group `parentId`, or at the top level if `parentId === "root"`. */
export function insertLayerInto(layers: Layer[], parentId: Id | "root", layer: Layer, index?: number): Layer[] {
  if (parentId === "root") return insertLayerAt(layers, layer, index ?? layers.length);
  return mapLayers(layers, (l) => (l.id === parentId && isGroupLayer(l) ? { ...l, children: insertLayerAt(l.children, layer, index ?? l.children.length) } : l));
}

/** The outermost ancestor of `id` within the container — `id` itself if it's already top-level. Used for click-to-select, which selects a whole group rather than reaching inside it. */
export function topLevelAncestor(layers: Layer[], id: Id): Id {
  const chain = ancestorChain(layers, id);
  return chain.length > 0 ? chain[chain.length - 1]! : id;
}

/** The sibling array a layer currently lives in — the container's top level for `"root"`, or a group's `children`. */
export function siblingsOf(layers: Layer[], parentId: Id | "root"): Layer[] {
  if (parentId === "root") return layers;
  const parent = findLayer(layers, parentId);
  return parent && isGroupLayer(parent) ? parent.children : [];
}
