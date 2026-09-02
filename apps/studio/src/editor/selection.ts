import type { Id, Layer } from "@fdraft/theme-sdk";
import { flattenLayers, isSameOrDescendant } from "./layerTree.js";
import { rectsIntersect, transformBounds, type Rect } from "./geometry.js";

export type Selection = ReadonlySet<Id>;

export const EMPTY_SELECTION: Selection = new Set();

/** A plain click: replaces the selection with just this layer. */
export function selectSingle(id: Id): Selection {
  return new Set([id]);
}

/** Shift-click: toggles one layer's membership without disturbing the rest of the selection. */
export function toggleSelection(current: Selection, id: Id): Selection {
  const next = new Set(current);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export function selectAll(layers: Layer[]): Selection {
  return new Set(flattenLayers(layers).map((l) => l.id));
}

export function clearSelection(): Selection {
  return EMPTY_SELECTION;
}

/**
 * Layers whose bounds intersect a marquee-drag rectangle, top-level only
 * (dragging a marquee over a group selects the group, not its children —
 * matching click-to-select behaviour, which never reaches inside a group
 * either).
 */
export function marqueeSelect(layers: Layer[], marquee: Rect): Selection {
  const hits = layers.filter((l) => rectsIntersect(transformBounds(l.transform), marquee));
  return new Set(hits.map((l) => l.id));
}

/**
 * Drops any selected id that no longer exists in `layers` (e.g. the layer
 * was deleted, or was inside a group that got ungrouped/deleted) — keeps
 * selection state from silently referencing stale ids after an edit.
 */
export function pruneSelection(layers: Layer[], selection: Selection): Selection {
  const live = new Set(flattenLayers(layers).map((l) => l.id));
  const next = new Set([...selection].filter((id) => live.has(id)));
  return next.size === selection.size ? selection : next;
}

/** True if any selected id is a descendant of (or equal to) `groupId` — used to keep a group's own selection state visually in sync when one of its children is picked. */
export function selectionTouchesGroup(layers: Layer[], selection: Selection, groupId: Id): boolean {
  return [...selection].some((id) => id === groupId || isSameOrDescendant(layers, groupId, id));
}
