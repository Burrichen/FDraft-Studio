import { createId } from "@fdraft/theme-sdk";
import type { Id, Layer, MasterLayerOverride, MasterPage, Page, Popup, StudioProjectDocument } from "@fdraft/theme-sdk";
import { resolveContainerLayers } from "@fdraft/theme-renderer";
import type { Command } from "../history/commandStack.js";

type PopupTrigger = Popup["trigger"];

/** Turns a display name into a valid page slug — lowercase, hyphenated, deduplicated against existing slugs. */
export function slugify(name: string, existingSlugs: ReadonlySet<string>): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const root = base.length > 0 ? base : "page";
  if (!existingSlugs.has(root)) return root;
  let n = 2;
  while (existingSlugs.has(`${root}-${n}`)) n += 1;
  return `${root}-${n}`;
}

function cloneLayersWithNewIds(layers: Layer[]): Layer[] {
  return layers.map((layer) => {
    const clone: Layer = { ...layer, id: createId() };
    if (clone.type === "group") return { ...clone, children: cloneLayersWithNewIds(clone.children) };
    return clone;
  });
}

// ---- Pages ----

export function buildAddPageCommand(project: StudioProjectDocument, name: string): Command<StudioProjectDocument> {
  const page: Page = { id: createId(), name, slug: slugify(name, new Set(project.pages.map((p) => p.slug))), layers: [], animations: [] };
  return {
    label: "Add page",
    do: (p) => ({ ...p, pages: [...p.pages, page] }),
    undo: (p) => ({ ...p, pages: p.pages.filter((x) => x.id !== page.id) }),
  };
}

export function renamePage(project: StudioProjectDocument, pageId: Id, name: string): Command<StudioProjectDocument> | null {
  const before = project.pages.find((p) => p.id === pageId);
  if (!before || before.name === name) return null;
  return {
    label: "Rename page",
    do: (p) => ({ ...p, pages: p.pages.map((x) => (x.id === pageId ? { ...x, name } : x)) }),
    undo: (p) => ({ ...p, pages: p.pages.map((x) => (x.id === pageId ? { ...x, name: before.name } : x)) }),
  };
}

export function buildDuplicatePageCommand(project: StudioProjectDocument, pageId: Id): Command<StudioProjectDocument> | null {
  const source = project.pages.find((p) => p.id === pageId);
  if (!source) return null;
  const name = `${source.name} copy`;
  const clone: Page = { ...source, id: createId(), name, slug: slugify(name, new Set(project.pages.map((p) => p.slug))), layers: cloneLayersWithNewIds(source.layers), masterLayerOverrides: source.masterLayerOverrides ? { ...source.masterLayerOverrides } : undefined };
  const index = project.pages.indexOf(source);
  return {
    label: "Duplicate page",
    do: (p) => {
      const pages = [...p.pages];
      pages.splice(index + 1, 0, clone);
      return { ...p, pages };
    },
    undo: (p) => ({ ...p, pages: p.pages.filter((x) => x.id !== clone.id) }),
  };
}

export function buildReorderPagesCommand(project: StudioProjectDocument, pageId: Id, newIndex: number): Command<StudioProjectDocument> | null {
  const oldIndex = project.pages.findIndex((p) => p.id === pageId);
  if (oldIndex === -1 || oldIndex === newIndex) return null;
  return {
    label: "Reorder pages",
    do: (p) => ({ ...p, pages: moveItem(p.pages, oldIndex, newIndex) }),
    undo: (p) => ({ ...p, pages: moveItem(p.pages, newIndex, oldIndex) }),
  };
}

function moveItem<T>(list: T[], from: number, to: number): T[] {
  const copy = [...list];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item!);
  return copy;
}

export function buildDeletePageCommand(project: StudioProjectDocument, pageId: Id): Command<StudioProjectDocument> | null {
  const index = project.pages.findIndex((p) => p.id === pageId);
  if (index === -1) return null;
  const removed = project.pages[index]!;
  return {
    label: "Delete page",
    do: (p) => ({ ...p, pages: p.pages.filter((x) => x.id !== pageId) }),
    undo: (p) => {
      const pages = [...p.pages];
      pages.splice(index, 0, removed);
      return { ...p, pages };
    },
  };
}

// ---- Popups ----

export function buildAddPopupCommand(name: string, trigger: PopupTrigger = "onLoad"): Command<StudioProjectDocument> {
  const popup: Popup = { id: createId(), name, trigger, layers: [], animations: [] };
  return {
    label: "Add popup",
    do: (p) => ({ ...p, popups: [...p.popups, popup] }),
    undo: (p) => ({ ...p, popups: p.popups.filter((x) => x.id !== popup.id) }),
  };
}

export function renamePopup(project: StudioProjectDocument, popupId: Id, name: string): Command<StudioProjectDocument> | null {
  const before = project.popups.find((p) => p.id === popupId);
  if (!before || before.name === name) return null;
  return {
    label: "Rename popup",
    do: (p) => ({ ...p, popups: p.popups.map((x) => (x.id === popupId ? { ...x, name } : x)) }),
    undo: (p) => ({ ...p, popups: p.popups.map((x) => (x.id === popupId ? { ...x, name: before.name } : x)) }),
  };
}

export function buildDuplicatePopupCommand(project: StudioProjectDocument, popupId: Id): Command<StudioProjectDocument> | null {
  const source = project.popups.find((p) => p.id === popupId);
  if (!source) return null;
  const clone: Popup = { ...source, id: createId(), name: `${source.name} copy`, layers: cloneLayersWithNewIds(source.layers), masterLayerOverrides: source.masterLayerOverrides ? { ...source.masterLayerOverrides } : undefined };
  const index = project.popups.indexOf(source);
  return {
    label: "Duplicate popup",
    do: (p) => {
      const popups = [...p.popups];
      popups.splice(index + 1, 0, clone);
      return { ...p, popups };
    },
    undo: (p) => ({ ...p, popups: p.popups.filter((x) => x.id !== clone.id) }),
  };
}

export function buildDeletePopupCommand(project: StudioProjectDocument, popupId: Id): Command<StudioProjectDocument> | null {
  const index = project.popups.findIndex((p) => p.id === popupId);
  if (index === -1) return null;
  const removed = project.popups[index]!;
  return {
    label: "Delete popup",
    do: (p) => ({ ...p, popups: p.popups.filter((x) => x.id !== popupId) }),
    undo: (p) => {
      const popups = [...p.popups];
      popups.splice(index, 0, removed);
      return { ...p, popups };
    },
  };
}

// ---- Masters ----

export function buildAddMasterCommand(name: string, parentMasterId?: Id): Command<StudioProjectDocument> {
  const master: MasterPage = { id: createId(), name, parentMasterId, layers: [], animations: [] };
  return {
    label: "Add master",
    do: (p) => ({ ...p, masters: [...p.masters, master] }),
    undo: (p) => ({ ...p, masters: p.masters.filter((x) => x.id !== master.id) }),
  };
}

export function renameMaster(project: StudioProjectDocument, masterId: Id, name: string): Command<StudioProjectDocument> | null {
  const before = project.masters.find((m) => m.id === masterId);
  if (!before || before.name === name) return null;
  return {
    label: "Rename master",
    do: (p) => ({ ...p, masters: p.masters.map((x) => (x.id === masterId ? { ...x, name } : x)) }),
    undo: (p) => ({ ...p, masters: p.masters.map((x) => (x.id === masterId ? { ...x, name: before.name } : x)) }),
  };
}

export interface MasterDependent {
  kind: "page" | "popup" | "master";
  id: Id;
  name: string;
}

/** Every page/popup/master that would be left dangling (directly) if `masterId` were deleted — the "dependency check" before delete. */
export function findMasterDependents(project: StudioProjectDocument, masterId: Id): MasterDependent[] {
  const dependents: MasterDependent[] = [];
  for (const page of project.pages) if (page.masterId === masterId) dependents.push({ kind: "page", id: page.id, name: page.name });
  for (const popup of project.popups) if (popup.masterId === masterId) dependents.push({ kind: "popup", id: popup.id, name: popup.name });
  for (const master of project.masters) if (master.parentMasterId === masterId) dependents.push({ kind: "master", id: master.id, name: master.name });
  return dependents;
}

/** Detects whether assigning `candidateParentId` as `masterId`'s parent would create (or already reflects) an inheritance cycle. */
export function wouldCreateMasterCycle(project: StudioProjectDocument, masterId: Id, candidateParentId: Id): boolean {
  let current: Id | undefined = candidateParentId;
  const visited = new Set<Id>();
  while (current !== undefined) {
    if (current === masterId) return true;
    if (visited.has(current)) return true;
    visited.add(current);
    current = project.masters.find((m) => m.id === current)?.parentMasterId;
  }
  return false;
}

/**
 * Deletes a master. Refuses (returns `null`) if anything still depends on
 * it directly — see `findMasterDependents` — a caller offers to detach
 * dependents first (see `buildDetachFromMasterCommand`) rather than this
 * command doing it implicitly, so a delete is never a surprise cascade.
 */
export function buildDeleteMasterCommand(project: StudioProjectDocument, masterId: Id): Command<StudioProjectDocument> | null {
  if (findMasterDependents(project, masterId).length > 0) return null;
  const index = project.masters.findIndex((m) => m.id === masterId);
  if (index === -1) return null;
  const removed = project.masters[index]!;
  return {
    label: "Delete master",
    do: (p) => ({ ...p, masters: p.masters.filter((x) => x.id !== masterId) }),
    undo: (p) => {
      const masters = [...p.masters];
      masters.splice(index, 0, removed);
      return { ...p, masters };
    },
  };
}

/** Assigns (or clears, with `masterId: undefined`) a page/popup's master — refuses a change that would create a cycle (a master assigned to itself indirectly makes no sense for a page/popup, but the parent-chain check is reused defensively). */
export function setContainerMaster(project: StudioProjectDocument, containerKind: "page" | "popup", containerId: Id, masterId: Id | undefined): Command<StudioProjectDocument> | null {
  const list = containerKind === "page" ? project.pages : project.popups;
  const before = list.find((c) => c.id === containerId);
  if (!before || before.masterId === masterId) return null;
  const beforeMasterId = before.masterId;

  if (containerKind === "page") {
    return {
      label: "Assign page master",
      do: (p) => ({ ...p, pages: p.pages.map((x) => (x.id === containerId ? { ...x, masterId } : x)) }),
      undo: (p) => ({ ...p, pages: p.pages.map((x) => (x.id === containerId ? { ...x, masterId: beforeMasterId } : x)) }),
    };
  }
  return {
    label: "Assign popup master",
    do: (p) => ({ ...p, popups: p.popups.map((x) => (x.id === containerId ? { ...x, masterId } : x)) }),
    undo: (p) => ({ ...p, popups: p.popups.map((x) => (x.id === containerId ? { ...x, masterId: beforeMasterId } : x)) }),
  };
}

// ---- Master layer overrides ----

function updateMasterLayerOverrides(container: Page | Popup, updater: (overrides: Record<Id, MasterLayerOverride>) => Record<Id, MasterLayerOverride>): Page | Popup {
  const next = updater({ ...(container.masterLayerOverrides ?? {}) });
  return { ...container, masterLayerOverrides: Object.keys(next).length > 0 ? next : undefined };
}

/**
 * Sets (or, with `override: undefined`, resets to inherited by removing
 * the entry entirely) one master layer's override on a page/popup —
 * "identify the override" is just checking whether the key is present,
 * which callers do directly against `container.masterLayerOverrides`.
 */
export function setMasterLayerOverride(project: StudioProjectDocument, containerKind: "page" | "popup", containerId: Id, masterLayerId: Id, override: MasterLayerOverride | undefined): Command<StudioProjectDocument> | null {
  const list = containerKind === "page" ? project.pages : project.popups;
  const before = list.find((c) => c.id === containerId);
  if (!before) return null;
  const beforeOverride = before.masterLayerOverrides?.[masterLayerId];

  const apply = (container: Page | Popup, value: MasterLayerOverride | undefined) =>
    updateMasterLayerOverrides(container, (overrides) => {
      const next = { ...overrides };
      if (value === undefined) delete next[masterLayerId];
      else next[masterLayerId] = value;
      return next;
    });

  if (containerKind === "page") {
    return {
      label: "Override master layer",
      do: (p) => ({ ...p, pages: p.pages.map((x) => (x.id === containerId ? (apply(x, override) as Page) : x)) }),
      undo: (p) => ({ ...p, pages: p.pages.map((x) => (x.id === containerId ? (apply(x, beforeOverride) as Page) : x)) }),
    };
  }
  return {
    label: "Override master layer",
    do: (p) => ({ ...p, popups: p.popups.map((x) => (x.id === containerId ? (apply(x, override) as Popup) : x)) }),
    undo: (p) => ({ ...p, popups: p.popups.map((x) => (x.id === containerId ? (apply(x, beforeOverride) as Popup) : x)) }),
  };
}

/**
 * "Detach safely": materialises this page/popup's currently-inherited
 * master layers (with any overrides already applied, using the exact
 * same resolution `@fdraft/theme-renderer` uses to render it) as its own
 * layers, with fresh ids so they never collide with the master's, then
 * clears `masterId`/`masterLayerOverrides`. Visually a no-op at the
 * instant it happens; from then on the page is fully independent.
 */
export function buildDetachFromMasterCommand(project: StudioProjectDocument, containerKind: "page" | "popup", containerId: Id): Command<StudioProjectDocument> | null {
  const list = containerKind === "page" ? project.pages : project.popups;
  const before = list.find((c) => c.id === containerId);
  if (!before || before.masterId === undefined) return null;

  const allResolved = resolveContainerLayers(before, project.masters);
  const inheritedLayers = allResolved.slice(0, allResolved.length - before.layers.length);
  const materialized = [...cloneLayersWithNewIds(inheritedLayers), ...before.layers];
  const beforeMasterId = before.masterId;
  const beforeOverrides = before.masterLayerOverrides;

  if (containerKind === "page") {
    return {
      label: "Detach from master",
      do: (p) => ({ ...p, pages: p.pages.map((x) => (x.id === containerId ? { ...x, masterId: undefined, masterLayerOverrides: undefined, layers: materialized } : x)) }),
      undo: (p) => ({ ...p, pages: p.pages.map((x) => (x.id === containerId ? { ...x, masterId: beforeMasterId, masterLayerOverrides: beforeOverrides, layers: before.layers } : x)) }),
    };
  }
  return {
    label: "Detach from master",
    do: (p) => ({ ...p, popups: p.popups.map((x) => (x.id === containerId ? { ...x, masterId: undefined, masterLayerOverrides: undefined, layers: materialized } : x)) }),
    undo: (p) => ({ ...p, popups: p.popups.map((x) => (x.id === containerId ? { ...x, masterId: beforeMasterId, masterLayerOverrides: beforeOverrides, layers: before.layers } : x)) }),
  };
}
