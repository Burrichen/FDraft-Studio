import { createId, createProject } from "@fdraft/theme-sdk";
import type { ComponentLayer, ComponentRequirement, Page, StudioProjectDocument } from "@fdraft/theme-sdk";
import { FDRAFT_EVENT_ALLOWED_PROPERTIES, FDRAFT_EVENT_COMPONENT_METADATA, FDRAFT_EVENT_PAGES } from "./fdraftEventContract.js";

/**
 * Builds the guaranteed "FDraft Default Event" project: all 8 registered
 * surfaces, each composed of real component-registry placements. Every
 * component's copy comes from its own declared default text at render
 * time (`resolveComponentCopy` in `@fdraft/theme-renderer`) — this
 * builder never writes a `copyOverrides` value, so what a user sees the
 * moment they open this template *is* "the current approved FDraft
 * default," verbatim, for every slot.
 */
export function createFdraftDefaultEventProject(name: string): StudioProjectDocument {
  const project = createProject({ id: createId(), name });

  const requirementIdByComponentKey = new Map<string, string>();
  const componentRequirements: ComponentRequirement[] = [];
  for (const componentKey of Object.keys(FDRAFT_EVENT_COMPONENT_METADATA)) {
    const metadata = FDRAFT_EVENT_COMPONENT_METADATA[componentKey]!;
    const id = createId();
    requirementIdByComponentKey.set(componentKey, id);
    componentRequirements.push({
      id,
      componentKey,
      required: metadata.required,
      allowedProperties: FDRAFT_EVENT_ALLOWED_PROPERTIES,
      singleton: metadata.singleton,
      compatibleZoneKinds: metadata.compatibleZoneKinds,
      minWidthPx: metadata.minWidthPx,
      minHeightPx: metadata.minHeightPx,
    });
  }

  const pages: Page[] = FDRAFT_EVENT_PAGES.map((contractPage) => {
    const layers: ComponentLayer[] = contractPage.components.map((placement, layerIndex) => {
      const requirementId = requirementIdByComponentKey.get(placement.componentKey);
      if (!requirementId) throw new Error(`No component requirement registered for "${placement.componentKey}" — add it to FDRAFT_EVENT_COMPONENT_METADATA`);
      return {
        id: createId(),
        type: "component",
        name: placement.componentKey,
        componentKey: placement.componentKey,
        componentRequirementId: requirementId,
        styleOverrides: [],
        zoneKind: placement.zoneKind,
        transform: placement.transform,
        opacity: 1,
        visible: true,
        locked: false,
        zIndex: layerIndex,
        responsive: [],
        interactionStates: [],
      };
    });
    return { id: createId(), name: contractPage.name, slug: contractPage.slug, layers, animations: [] };
  });

  return { ...project, componentRequirements, pages };
}
