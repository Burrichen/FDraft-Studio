import type { Layer } from "../schema/layers.js";
import type { MasterPage, Page, Popup } from "../schema/pages.js";
import type { HexColor } from "../schema/primitives.js";
import type { Condition } from "../schema/interaction.js";
import type { SemanticDocument } from "./semantic.js";

/**
 * Advisory, non-blocking design-quality checks — deliberately a separate
 * channel from `ValidationIssue`/`checkSemantics`. Those gate whether a
 * project can be packaged/compiled at all; a `DesignWarning` never does
 * (an "undersized target" or "possible low contrast" project must still
 * save and export) — a host surfaces these in an actionable panel
 * instead. See `checkSemantics` for the hard-error channel.
 */
export interface DesignWarning {
  code: "MISSING_REQUIRED_COMPONENT" | "DUPLICATE_SINGLETON_COMPONENT" | "INCOMPATIBLE_ZONE" | "UNDERSIZED_COMPONENT" | "LOW_CONTRAST_TEXT" | "DECORATIVE_LAYER_COVERS_COMPONENT" | "HOVER_ONLY_DISCOVERY";
  path: string;
  message: string;
}

/** Does this condition read `layerId`'s own `which` interaction flag anywhere in its tree? A variable with no explicit `layerId` is ambient — it means whatever layer the condition is already attached to, i.e. `layerId` itself. */
function referencesInteractionFlag(condition: Condition, which: "hover" | "focus" | "pressed" | "selected", layerId: string): boolean {
  switch (condition.type) {
    case "compare":
    case "boolean":
      return condition.variable.kind === "interactionFlag" && condition.variable.which === which && (condition.variable.layerId === undefined || condition.variable.layerId === layerId);
    case "and":
    case "or":
      return condition.conditions.some((c) => referencesInteractionFlag(c, which, layerId));
    case "not":
      return referencesInteractionFlag(condition.condition, which, layerId);
    default:
      return false;
  }
}

/**
 * A layer that's hidden by default and only ever revealed by a hover
 * condition, with no corresponding focus-based state that reveals the
 * same content — essential information should never be discoverable only
 * by hovering, since it then never reaches keyboard/touch users.
 */
function checkHoverOnlyDiscovery(layers: Layer[], path: string, out: DesignWarning[]): void {
  for (const layer of flatten(layers)) {
    if (layer.visible) continue;
    const hoverReveals = layer.interactionStates.some((s) => s.visible === true && referencesInteractionFlag(s.condition, "hover", layer.id));
    if (!hoverReveals) continue;
    const focusReveals = layer.interactionStates.some((s) => s.visible === true && referencesInteractionFlag(s.condition, "focus", layer.id));
    if (!focusReveals) {
      out.push({
        code: "HOVER_ONLY_DISCOVERY",
        path: `${path}.layers[${layer.id}]`,
        message: `"${layer.name}" is only revealed by a hover interaction state — add an equivalent focus-based state so keyboard/touch users can reach it too`,
      });
    }
  }
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function walkLayers(layers: Layer[], visit: (layer: Layer) => void): void {
  for (const layer of layers) {
    visit(layer);
    if (layer.type === "group") walkLayers(layer.children, visit);
  }
}

function flatten(layers: Layer[]): Layer[] {
  const out: Layer[] = [];
  walkLayers(layers, (l) => out.push(l));
  return out;
}

function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: HexColor): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

/** WCAG 2.x contrast ratio, 1 (identical) to 21 (black on white). */
export function contrastRatio(a: HexColor, b: HexColor): number {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

const MIN_CONTRAST_NORMAL_TEXT = 4.5;
const MIN_CONTRAST_LARGE_TEXT = 3;
const LARGE_TEXT_PX = 24;

function checkContainer(container: MasterPage | Page | Popup, kindLabel: string, index: number, doc: SemanticDocument, out: DesignWarning[]): void {
  const path = `${kindLabel}[${index}]`;
  const layers = flatten(container.layers);
  const colorsById = new Map(doc.tokens.colors.map((c) => [c.id, c.value]));

  checkHoverOnlyDiscovery(container.layers, path, out);

  // Component-requirement checks: singleton duplicates, zone compatibility, undersized targets.
  const componentLayers = layers.filter((l): l is Extract<Layer, { type: "component" }> => l.type === "component");
  const requirementsById = new Map(doc.componentRequirements.map((r) => [r.id, r]));
  const countByRequirement = new Map<string, number>();

  for (const layer of componentLayers) {
    const requirement = requirementsById.get(layer.componentRequirementId);
    if (!requirement) continue;
    countByRequirement.set(requirement.id, (countByRequirement.get(requirement.id) ?? 0) + 1);

    if (requirement.compatibleZoneKinds && requirement.compatibleZoneKinds.length > 0) {
      if (!layer.zoneKind || !requirement.compatibleZoneKinds.includes(layer.zoneKind)) {
        out.push({
          code: "INCOMPATIBLE_ZONE",
          path: `${path}.layers[${layer.id}]`,
          message: `"${layer.name}" (${requirement.componentKey}) is placed in ${layer.zoneKind ?? "no zone"}, but this component only supports: ${requirement.compatibleZoneKinds.join(", ")}`,
        });
      }
    }

    if ((requirement.minWidthPx && layer.transform.width < requirement.minWidthPx) || (requirement.minHeightPx && layer.transform.height < requirement.minHeightPx)) {
      out.push({
        code: "UNDERSIZED_COMPONENT",
        path: `${path}.layers[${layer.id}]`,
        message: `"${layer.name}" (${requirement.componentKey}) is ${layer.transform.width}x${layer.transform.height}px, below its minimum usable size of ${requirement.minWidthPx ?? "-"}x${requirement.minHeightPx ?? "-"}px`,
      });
    }
  }

  for (const [requirementId, count] of countByRequirement) {
    const requirement = requirementsById.get(requirementId)!;
    if (requirement.singleton && count > 1) {
      out.push({ code: "DUPLICATE_SINGLETON_COMPONENT", path, message: `${count} instances of "${requirement.componentKey}" are placed, but only one is meaningful per container` });
    }
  }

  // Text-over-shape contrast, and decorative layers covering a protected component — both need z-order + overlap.
  const byZIndexAsc = [...layers].sort((a, b) => a.zIndex - b.zIndex);
  for (let i = 0; i < byZIndexAsc.length; i += 1) {
    const upper = byZIndexAsc[i]!;
    if (!upper.visible || upper.opacity <= 0.05) continue;
    const upperBounds: Rect = upper.transform;

    if (upper.type === "text" && upper.colorTokenId) {
      const textColor = colorsById.get(upper.colorTokenId);
      if (textColor) {
        for (let j = i - 1; j >= 0; j -= 1) {
          const lower = byZIndexAsc[j]!;
          if (lower.type !== "shape" || !lower.fillColorTokenId || !lower.visible) continue;
          if (!rectsOverlap(upperBounds, lower.transform)) continue;
          const bgColor = colorsById.get(lower.fillColorTokenId);
          if (!bgColor) continue;
          const ratio = contrastRatio(textColor, bgColor);
          const minRatio = upper.fontSizePx >= LARGE_TEXT_PX ? MIN_CONTRAST_LARGE_TEXT : MIN_CONTRAST_NORMAL_TEXT;
          if (ratio < minRatio) {
            out.push({
              code: "LOW_CONTRAST_TEXT",
              path: `${path}.layers[${upper.id}]`,
              message: `"${upper.name}" has a contrast ratio of ${ratio.toFixed(2)}:1 against "${lower.name}" beneath it, below the recommended ${minRatio}:1`,
            });
          }
          break; // only the nearest overlapping background beneath it is relevant
        }
      }
    }

    if (upper.type === "image" || upper.type === "shape" || upper.type === "effect") {
      for (let j = 0; j < byZIndexAsc.length; j += 1) {
        if (j === i) continue;
        const lower = byZIndexAsc[j]!;
        if (lower.type !== "component" || lower.zIndex >= upper.zIndex || !lower.visible) continue;
        if (!rectsOverlap(upperBounds, lower.transform)) continue;
        out.push({
          code: "DECORATIVE_LAYER_COVERS_COMPONENT",
          path: `${path}.layers[${upper.id}]`,
          message: `"${upper.name}" is a decorative layer positioned above "${lower.name}", a protected component — it may block interaction`,
        });
      }
    }
  }
}

/**
 * "Required" is a project-wide declaration ("this theme depends on
 * component X existing somewhere"), never a per-page one — a theme
 * legitimately has a required component on only one relevant page (e.g.
 * `draft-controls` only makes sense on the Draft page, not the Results
 * page). Checked once across every container's placements combined,
 * unlike singleton/zone/undersized, which are inherently per-placement.
 */
function checkMissingRequiredComponents(doc: SemanticDocument, out: DesignWarning[]): void {
  const placedRequirementIds = new Set<string>();
  const visitContainer = (container: MasterPage | Page | Popup) => {
    for (const layer of flatten(container.layers)) {
      if (layer.type === "component") placedRequirementIds.add(layer.componentRequirementId);
    }
  };
  doc.masters.forEach(visitContainer);
  doc.pages.forEach(visitContainer);
  doc.popups.forEach(visitContainer);

  for (const requirement of doc.componentRequirements) {
    if (requirement.required && !placedRequirementIds.has(requirement.id)) {
      out.push({ code: "MISSING_REQUIRED_COMPONENT", path: "componentRequirements", message: `Required component "${requirement.componentKey}" is not placed anywhere in the project` });
    }
  }
}

export function checkDesignWarnings(doc: SemanticDocument): DesignWarning[] {
  const out: DesignWarning[] = [];
  doc.masters.forEach((m, i) => checkContainer(m, "masters", i, doc, out));
  doc.pages.forEach((p, i) => checkContainer(p, "pages", i, doc, out));
  doc.popups.forEach((p, i) => checkContainer(p, "popups", i, doc, out));
  checkMissingRequiredComponents(doc, out);
  return out;
}
