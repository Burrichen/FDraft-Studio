import type { StudioProjectDocument } from "../schema/project.js";
import type { Layer } from "../schema/layers.js";
import type { Id } from "../schema/primitives.js";

export type AssetUsageKind = "layerImage" | "layerMask" | "imageStateGroup" | "fontToken";

/** One place a given asset id is actually referenced from — the raw material for both "unused asset" detection and a "where used" navigation list. */
export interface AssetUsageRef {
  assetId: Id;
  via: AssetUsageKind;
  /** The page/popup/master a `layerImage`/`layerMask` reference lives in — absent for the project-level `imageStateGroup`/`fontToken` kinds, which aren't scoped to any one container. */
  containerKind?: "master" | "page" | "popup";
  containerId?: Id;
  /** The layer that references the asset — present for `layerImage`/`layerMask`. */
  layerId?: Id;
  /** The image-state-group that references the asset via one of its states — present for `imageStateGroup`. */
  stateGroupId?: Id;
  /** The font token that references the asset — present for `fontToken`. */
  fontTokenId?: Id;
}

function walkLayers(layers: Layer[], visit: (layer: Layer) => void): void {
  for (const layer of layers) {
    visit(layer);
    if (layer.type === "group") walkLayers(layer.children, visit);
  }
}

/**
 * Every concrete reference to an asset anywhere in the project — layers
 * (including masks), image-state-group members, and font tokens. This is
 * the single source of truth both `compileTheme` (which asset bytes to
 * keep) and Studio's Asset Workspace (usage counts, "where used"
 * navigation, unused-asset detection) build on, so the two can never
 * silently disagree about what counts as "used."
 *
 * Mirrors `compileTheme`'s reachability rule exactly: only image-state
 * groups actually referenced by a layer contribute their states' assets
 * (an unreferenced group's assets are not "used" just by existing), but
 * every state of a *used* group counts, even ones not currently active.
 */
export function findAssetUsage(project: StudioProjectDocument): AssetUsageRef[] {
  const refs: AssetUsageRef[] = [];
  const usedStateGroupIds = new Set<Id>();
  const usedFontTokenIds = new Set<Id>();

  const containers: { kind: "master" | "page" | "popup"; id: Id; layers: Layer[] }[] = [
    ...project.masters.map((m) => ({ kind: "master" as const, id: m.id, layers: m.layers })),
    ...project.pages.map((p) => ({ kind: "page" as const, id: p.id, layers: p.layers })),
    ...project.popups.map((p) => ({ kind: "popup" as const, id: p.id, layers: p.layers })),
  ];

  for (const container of containers) {
    walkLayers(container.layers, (layer) => {
      if (layer.type === "image") {
        refs.push({ assetId: layer.assetId, via: "layerImage", containerKind: container.kind, containerId: container.id, layerId: layer.id });
        if (layer.stateGroupId !== undefined) usedStateGroupIds.add(layer.stateGroupId);
        if (layer.mask?.assetId !== undefined) {
          refs.push({ assetId: layer.mask.assetId, via: "layerMask", containerKind: container.kind, containerId: container.id, layerId: layer.id });
        }
      } else if (layer.type === "text" && layer.fontTokenId !== undefined) {
        usedFontTokenIds.add(layer.fontTokenId);
      }
    });
  }

  for (const group of project.imageStateGroups) {
    if (!usedStateGroupIds.has(group.id)) continue;
    for (const state of group.states) {
      refs.push({ assetId: state.assetId, via: "imageStateGroup", stateGroupId: group.id });
    }
  }

  for (const font of project.tokens.fonts) {
    if (usedFontTokenIds.has(font.id)) {
      refs.push({ assetId: font.assetId, via: "fontToken", fontTokenId: font.id });
    }
  }

  return refs;
}

/** The set of asset ids reachable via `findAssetUsage` — the exact rule `compileTheme` uses to decide which asset bytes to keep. */
export function collectUsedAssetIds(project: StudioProjectDocument): Set<Id> {
  return new Set(findAssetUsage(project).map((ref) => ref.assetId));
}
