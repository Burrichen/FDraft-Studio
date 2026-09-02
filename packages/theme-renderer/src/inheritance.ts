import type { Id, Layer, MasterLayerOverride, MasterPage, Page, Popup } from "@fdraft/theme-sdk";
import { RendererError } from "./errors.js";

/**
 * Walks a master's `parentMasterId` chain from most-distant ancestor to
 * the master itself, so later (more specific) layers can be composed on
 * top of earlier (more general) ones. The SDK's semantic validation
 * already rejects a cyclic chain before a theme is considered valid — this
 * is a defensive second check so a renderer fed unvalidated data fails
 * safely instead of looping forever.
 */
export function resolveMasterChain(masters: MasterPage[], masterId: Id | undefined): MasterPage[] {
  if (masterId === undefined) return [];
  const byId = new Map(masters.map((m) => [m.id, m]));
  const chain: MasterPage[] = [];
  const visited = new Set<Id>();

  let current: Id | undefined = masterId;
  while (current !== undefined) {
    if (visited.has(current)) {
      throw new RendererError("CIRCULAR_MASTER_CHAIN", `master inheritance cycle detected at ${current}`);
    }
    const master = byId.get(current);
    if (!master) {
      throw new RendererError("MISSING_MASTER", `master ${current} does not exist`);
    }
    visited.add(current);
    chain.unshift(master);
    current = master.parentMasterId;
  }

  return chain;
}

/**
 * Applies a container's `masterLayerOverrides` (keyed by the *master
 * layer's own id*, anywhere in its tree, including nested inside a
 * group) on top of the inherited layers — deliberately narrow
 * (position/size/rotation, visibility, opacity only; see
 * `MasterLayerOverrideSchema`'s doc comment) so an override can never
 * change what an inherited layer displays, only where/whether it
 * appears on this specific page.
 */
function applyMasterLayerOverrides(layers: Layer[], overrides: Record<Id, MasterLayerOverride> | undefined): Layer[] {
  if (!overrides || Object.keys(overrides).length === 0) return layers;
  return layers.map((layer) => {
    const override = overrides[layer.id];
    let next: Layer = override
      ? {
          ...layer,
          transform: override.transform ? { ...layer.transform, ...override.transform } : layer.transform,
          visible: override.visible ?? layer.visible,
          opacity: override.opacity ?? layer.opacity,
        }
      : layer;
    if (next.type === "group") {
      const children = applyMasterLayerOverrides(next.children, overrides);
      if (children !== next.children) next = { ...next, children };
    }
    return next;
  });
}

/**
 * The deterministic layer stack for a page/popup: every ancestor master's
 * own layers (root-most first, with this container's own
 * `masterLayerOverrides` applied), then the page/popup's own layers last —
 * later entries paint over earlier ones, matching each container's `zIndex`
 * only *within* its own layer list (cross-container stacking is
 * intentionally simple for this phase: master content is always the base).
 */
export function resolveContainerLayers(container: Page | Popup, masters: MasterPage[]): Layer[] {
  const chain = resolveMasterChain(masters, container.masterId);
  const inherited = applyMasterLayerOverrides(chain.flatMap((master) => master.layers), container.masterLayerOverrides);
  return [...inherited, ...container.layers];
}
