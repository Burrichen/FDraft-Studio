import { resolveContainerLayers, resolveComponentCopy, type ComponentCopyContractRegistry, type ComponentCopySlotDeclaration } from "@fdraft/theme-renderer";
import type { ComponentLayer, Id, Layer, SimulationScenario, StudioProjectDocument } from "@fdraft/theme-sdk";

export type CopyReviewCategory = "fallbackToDefault" | "missing" | "unresolvedPlaceholder" | "inaccessible" | "clipped";

export type CopyTextSource = { kind: "default" } | { kind: "variant"; variantId: Id; variantLabel: string };

export interface CopyReviewTarget {
  containerKind: "master" | "page" | "popup";
  containerId: Id;
  containerName: string;
  layerId: Id;
  layerName: string;
  componentKey: string;
  slotKey: string;
  slotLabel: string;
  textSource: CopyTextSource;
}

export interface CopyReviewFinding extends CopyReviewTarget {
  category: CopyReviewCategory;
  detail: string;
  scenarioId?: Id;
  scenarioName?: string;
  viewportId?: string;
}

function isComponentLayer(layer: Layer): layer is ComponentLayer {
  return layer.type === "component";
}

function walkLayers(layers: Layer[], visit: (layer: Layer) => void): void {
  for (const layer of layers) {
    visit(layer);
    if (layer.type === "group") walkLayers(layer.children, visit);
  }
}

/** Every text source (the slot's current override plus every declared variant) that a slot's text might actually render as — the raw material every finding-collector below iterates over. */
function collectSlotTextSources(layer: ComponentLayer, slot: ComponentCopySlotDeclaration): { source: CopyTextSource; overrides: Record<string, string> | undefined }[] {
  const sources: { source: CopyTextSource; overrides: Record<string, string> | undefined }[] = [{ source: { kind: "default" }, overrides: layer.copyOverrides }];
  for (const variant of layer.copyVariants?.[slot.key] ?? []) {
    sources.push({ source: { kind: "variant", variantId: variant.id, variantLabel: variant.text.slice(0, 24) }, overrides: { ...layer.copyOverrides, [slot.key]: variant.text } });
  }
  return sources;
}

/** Every (container, component layer, declared copy slot) triple in the project — masters walked directly, pages/popups via their *effective*, master-inheritance-resolved layer list, recursing into groups. */
export function collectComponentCopyTargets(project: StudioProjectDocument, copyContracts: ComponentCopyContractRegistry): { layer: ComponentLayer; slot: ComponentCopySlotDeclaration; base: Omit<CopyReviewTarget, "slotKey" | "slotLabel" | "textSource"> }[] {
  const results: { layer: ComponentLayer; slot: ComponentCopySlotDeclaration; base: Omit<CopyReviewTarget, "slotKey" | "slotLabel" | "textSource"> }[] = [];
  const containers: { kind: "master" | "page" | "popup"; id: Id; name: string; layers: Layer[] }[] = [
    ...project.masters.map((m) => ({ kind: "master" as const, id: m.id, name: m.name, layers: m.layers })),
    ...project.pages.map((p) => ({ kind: "page" as const, id: p.id, name: p.name, layers: resolveContainerLayers(p, project.masters) })),
    ...project.popups.map((p) => ({ kind: "popup" as const, id: p.id, name: p.name, layers: resolveContainerLayers(p, project.masters) })),
  ];
  for (const container of containers) {
    walkLayers(container.layers, (layer) => {
      if (!isComponentLayer(layer)) return;
      const slots = copyContracts[layer.componentKey] ?? [];
      for (const slot of slots) {
        results.push({
          layer,
          slot,
          base: { containerKind: container.kind, containerId: container.id, containerName: container.name, layerId: layer.id, layerName: layer.name, componentKey: layer.componentKey },
        });
      }
    });
  }
  return results;
}

/**
 * Findings that depend only on the project's own stored data — never a
 * scenario or viewport. `fallbackToDefault` mirrors exactly the check
 * `CopySlotField` itself uses ("Using FDraft default"); `missing` catches
 * a required slot whose stored override is whitespace-only (masked back to
 * the default by `resolveComponentCopy` at render time, but still worth
 * surfacing as a distinct authoring mistake); `inaccessible` catches a
 * slot with no `accessibleNameFallback` whose resolved text is empty.
 */
export function computeStaticCopyFindings(project: StudioProjectDocument, copyContracts: ComponentCopyContractRegistry): CopyReviewFinding[] {
  const findings: CopyReviewFinding[] = [];
  for (const { layer, slot, base } of collectComponentCopyTargets(project, copyContracts)) {
    const target: CopyReviewTarget = { ...base, slotKey: slot.key, slotLabel: slot.label, textSource: { kind: "default" } };
    const rawOverride = layer.copyOverrides?.[slot.key];

    if (rawOverride === undefined) {
      findings.push({ ...target, category: "fallbackToDefault", detail: `Using the FDraft default: "${slot.defaultText}".` });
    } else if (slot.required && rawOverride.trim().length === 0) {
      findings.push({ ...target, category: "missing", detail: "Required slot's stored override is blank — it will render the FDraft default instead of what was likely intended." });
    }

    const resolved = resolveComponentCopy([slot], layer.copyOverrides, undefined)[slot.key] ?? "";
    if (resolved.trim().length === 0 && !slot.accessibleNameFallback) {
      findings.push({ ...target, category: "inaccessible", detail: "Resolves to empty text with no accessibleNameFallback — assistive technology has nothing to announce here." });
    }
  }
  return findings;
}

/**
 * Findings that depend on a simulated scenario's `placeholderValues` —
 * scans every text source's *resolved* output (default override, plus
 * every declared copy variant) for a `{{token}}` left untouched by
 * `resolveComponentCopy`/`substitutePlaceholders`, exactly the same
 * leave-as-literal-text convention that function already uses.
 */
const UNRESOLVED_PLACEHOLDER_PATTERN = /\{\{\w+\}\}/g;

export function computeUnresolvedPlaceholderFindings(project: StudioProjectDocument, copyContracts: ComponentCopyContractRegistry, scenarios: SimulationScenario[]): CopyReviewFinding[] {
  const findings: CopyReviewFinding[] = [];
  const targets = collectComponentCopyTargets(project, copyContracts);
  for (const { layer, slot, base } of targets) {
    for (const { source, overrides } of collectSlotTextSources(layer, slot)) {
      for (const scenario of scenarios) {
        const resolved = resolveComponentCopy([slot], overrides, scenario.placeholderValues)[slot.key] ?? "";
        const unresolved = resolved.match(UNRESOLVED_PLACEHOLDER_PATTERN);
        if (unresolved) {
          findings.push({
            ...base,
            slotKey: slot.key,
            slotLabel: slot.label,
            textSource: source,
            category: "unresolvedPlaceholder",
            detail: `${unresolved.join(", ")} left unresolved under scenario "${scenario.name}": "${resolved}".`,
            scenarioId: scenario.id,
            scenarioName: scenario.name,
          });
        }
      }
    }
  }
  return findings;
}
