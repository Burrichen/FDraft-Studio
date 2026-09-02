import type { StudioProjectDocument } from "../schema/project.js";
import type { RuntimeThemeDocument } from "../schema/theme.js";
import type { Layer } from "../schema/layers.js";
import type { MasterPage, Page, Popup } from "../schema/pages.js";
import type { Condition } from "../schema/interaction.js";
import type { Id } from "../schema/primitives.js";
import type { DesignTokens } from "../schema/tokens.js";
import type { AssetFolder, ImageStateGroup } from "../schema/assets.js";
import type { ComponentRequirement } from "../schema/components.js";
import type { BehaviourRule } from "../schema/behaviour.js";
import type { SdkErrorCode } from "../errors.js";
import { checkBehaviourRules } from "./behaviourSemantics.js";

export interface ValidationIssue {
  code: SdkErrorCode;
  path: string;
  message: string;
}

interface IdRef {
  id: Id;
  path: string;
}

/** A document shape both `StudioProjectDocument` and `RuntimeThemeDocument` share, for semantic checks. */
export interface SemanticDocument {
  tokens: DesignTokens;
  assets: { id: Id; folderId?: Id }[];
  /** Editor-only — absent on `RuntimeThemeDocument`, which never carries folders. */
  assetFolders?: AssetFolder[];
  imageStateGroups: ImageStateGroup[];
  componentRequirements: ComponentRequirement[];
  masters: MasterPage[];
  pages: Page[];
  popups: Popup[];
  behaviourRules: BehaviourRule[];
}

function collectLayerRefs(layers: Layer[], basePath: string, refs: IdRef[]): void {
  layers.forEach((layer, index) => {
    const path = `${basePath}[${index}]`;
    refs.push({ id: layer.id, path });
    layer.interactionStates.forEach((state, stateIndex) => {
      refs.push({ id: state.id, path: `${path}.interactionStates[${stateIndex}]` });
    });
    if (layer.type === "group") {
      collectLayerRefs(layer.children, `${path}.children`, refs);
    }
  });
}

function collectAllIds(doc: SemanticDocument): IdRef[] {
  const refs: IdRef[] = [];
  const push = (id: Id, path: string) => refs.push({ id, path });

  doc.tokens.colors.forEach((t, i) => push(t.id, `tokens.colors[${i}]`));
  doc.tokens.gradients.forEach((t, i) => push(t.id, `tokens.gradients[${i}]`));
  doc.tokens.shadows.forEach((t, i) => push(t.id, `tokens.shadows[${i}]`));
  doc.tokens.borders.forEach((t, i) => push(t.id, `tokens.borders[${i}]`));
  doc.tokens.spacing.forEach((t, i) => push(t.id, `tokens.spacing[${i}]`));
  doc.tokens.radii.forEach((t, i) => push(t.id, `tokens.radii[${i}]`));
  doc.tokens.fonts.forEach((t, i) => push(t.id, `tokens.fonts[${i}]`));
  doc.tokens.breakpoints.forEach((t, i) => push(t.id, `tokens.breakpoints[${i}]`));

  doc.assets.forEach((a, i) => push(a.id, `assets[${i}]`));

  doc.assetFolders?.forEach((f, i) => push(f.id, `assetFolders[${i}]`));

  doc.imageStateGroups.forEach((group, i) => {
    push(group.id, `imageStateGroups[${i}]`);
    group.states.forEach((s, j) => push(s.id, `imageStateGroups[${i}].states[${j}]`));
  });

  doc.componentRequirements.forEach((c, i) => push(c.id, `componentRequirements[${i}]`));

  doc.masters.forEach((master, i) => {
    push(master.id, `masters[${i}]`);
    collectLayerRefs(master.layers, `masters[${i}].layers`, refs);
    master.animations.forEach((a, j) => push(a.id, `masters[${i}].animations[${j}]`));
  });

  doc.pages.forEach((page, i) => {
    push(page.id, `pages[${i}]`);
    collectLayerRefs(page.layers, `pages[${i}].layers`, refs);
    page.animations.forEach((a, j) => push(a.id, `pages[${i}].animations[${j}]`));
  });

  doc.popups.forEach((popup, i) => {
    push(popup.id, `popups[${i}]`);
    collectLayerRefs(popup.layers, `popups[${i}].layers`, refs);
    popup.animations.forEach((a, j) => push(a.id, `popups[${i}].animations[${j}]`));
  });

  doc.behaviourRules.forEach((rule, i) => push(rule.id, `behaviourRules[${i}]`));

  return refs;
}

export function checkDuplicateIds(doc: SemanticDocument): ValidationIssue[] {
  const refs = collectAllIds(doc);
  const byId = new Map<Id, string[]>();
  for (const ref of refs) {
    const paths = byId.get(ref.id);
    if (paths) paths.push(ref.path);
    else byId.set(ref.id, [ref.path]);
  }
  const issues: ValidationIssue[] = [];
  for (const [id, paths] of byId) {
    if (paths.length > 1) {
      issues.push({
        code: "DUPLICATE_ID",
        path: paths[0]!,
        message: `id ${id} is used ${paths.length} times: ${paths.join(", ")}`,
      });
    }
  }
  return issues;
}

function collectConditionRefs(condition: Condition, path: string, out: { stateGroupId: Id; stateId: Id; path: string }[]): void {
  switch (condition.type) {
    case "stateEquals":
      out.push({ stateGroupId: condition.stateGroupId, stateId: condition.stateId, path });
      return;
    case "and":
    case "or":
      condition.conditions.forEach((c, i) => collectConditionRefs(c, `${path}.conditions[${i}]`, out));
      return;
    case "not":
      collectConditionRefs(condition.condition, `${path}.condition`, out);
      return;
    default:
      return;
  }
}

function checkLayerReferences(
  layers: Layer[],
  basePath: string,
  ids: {
    assetIds: Set<Id>;
    colorIds: Set<Id>;
    fontIds: Set<Id>;
    borderIds: Set<Id>;
    componentRequirementIds: Set<Id>;
    componentRequirementsById: Map<Id, ComponentRequirement>;
    breakpointIds: Set<Id>;
    stateGroups: Map<Id, Set<Id>>;
  },
  issues: ValidationIssue[],
): void {
  layers.forEach((layer, index) => {
    const path = `${basePath}[${index}]`;

    const checkRef = (id: Id | undefined, set: Set<Id>, field: string) => {
      if (id !== undefined && !set.has(id)) {
        issues.push({ code: "BROKEN_REFERENCE", path: `${path}.${field}`, message: `${field} ${id} does not exist` });
      }
    };

    layer.responsive.forEach((constraint, j) => {
      checkRef(constraint.breakpointId, ids.breakpointIds, `responsive[${j}].breakpointId`);
    });

    if (layer.type === "image") {
      checkRef(layer.assetId, ids.assetIds, "assetId");
      if (layer.stateGroupId !== undefined) {
        checkRef(layer.stateGroupId, new Set(ids.stateGroups.keys()), "stateGroupId");
      }
      if (layer.mask?.assetId !== undefined) checkRef(layer.mask.assetId, ids.assetIds, "mask.assetId");
    } else if (layer.type === "text") {
      if (layer.fontTokenId !== undefined) checkRef(layer.fontTokenId, ids.fontIds, "fontTokenId");
      if (layer.colorTokenId !== undefined) checkRef(layer.colorTokenId, ids.colorIds, "colorTokenId");
    } else if (layer.type === "shape") {
      if (layer.fillColorTokenId !== undefined) checkRef(layer.fillColorTokenId, ids.colorIds, "fillColorTokenId");
      if (layer.strokeBorderTokenId !== undefined) checkRef(layer.strokeBorderTokenId, ids.borderIds, "strokeBorderTokenId");
    } else if (layer.type === "component") {
      checkRef(layer.componentRequirementId, ids.componentRequirementIds, "componentRequirementId");
      layer.styleOverrides.forEach((override, j) => {
        const requirement = ids.componentRequirementsById.get(override.componentRequirementId);
        if (!requirement) {
          issues.push({
            code: "BROKEN_REFERENCE",
            path: `${path}.styleOverrides[${j}].componentRequirementId`,
            message: `componentRequirementId ${override.componentRequirementId} does not exist`,
          });
          return;
        }
        for (const property of Object.keys(override.style)) {
          if (!requirement.allowedProperties.includes(property as (typeof requirement.allowedProperties)[number])) {
            issues.push({
              code: "DISALLOWED_STYLE_PROPERTY",
              path: `${path}.styleOverrides[${j}].style.${property}`,
              message: `"${property}" is not in componentRequirement ${requirement.id}'s allowedProperties (${requirement.allowedProperties.join(", ") || "none"})`,
            });
          }
        }
      });
    }

    layer.interactionStates.forEach((state, j) => {
      const refs: { stateGroupId: Id; stateId: Id; path: string }[] = [];
      collectConditionRefs(state.condition, `${path}.interactionStates[${j}].condition`, refs);
      for (const ref of refs) {
        const group = ids.stateGroups.get(ref.stateGroupId);
        if (!group) {
          issues.push({ code: "BROKEN_REFERENCE", path: `${ref.path}.stateGroupId`, message: `stateGroupId ${ref.stateGroupId} does not exist` });
        } else if (!group.has(ref.stateId)) {
          issues.push({ code: "BROKEN_REFERENCE", path: `${ref.path}.stateId`, message: `stateId ${ref.stateId} does not exist in state group ${ref.stateGroupId}` });
        }
      }
    });

    if (layer.type === "group") {
      checkLayerReferences(layer.children, `${path}.children`, ids, issues);
    }
  });
}

export function checkBrokenReferences(doc: SemanticDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const assetIds = new Set(doc.assets.map((a) => a.id));
  const colorIds = new Set(doc.tokens.colors.map((t) => t.id));
  const fontIds = new Set(doc.tokens.fonts.map((t) => t.id));
  const borderIds = new Set(doc.tokens.borders.map((t) => t.id));
  const breakpointIds = new Set(doc.tokens.breakpoints.map((t) => t.id));
  const componentRequirementIds = new Set(doc.componentRequirements.map((c) => c.id));
  const componentRequirementsById = new Map(doc.componentRequirements.map((c) => [c.id, c]));
  const masterIds = new Set(doc.masters.map((m) => m.id));
  const stateGroups = new Map(doc.imageStateGroups.map((g) => [g.id, new Set(g.states.map((s) => s.id))]));

  const folderIds = new Set((doc.assetFolders ?? []).map((f) => f.id));
  for (const folder of doc.assetFolders ?? []) {
    if (folder.parentId !== undefined && !folderIds.has(folder.parentId)) {
      issues.push({ code: "BROKEN_REFERENCE", path: `assetFolders[${folder.id}].parentId`, message: `parentId ${folder.parentId} does not exist` });
    }
  }
  doc.assets.forEach((asset, i) => {
    if (asset.folderId !== undefined && !folderIds.has(asset.folderId)) {
      issues.push({ code: "BROKEN_REFERENCE", path: `assets[${i}].folderId`, message: `folderId ${asset.folderId} does not exist` });
    }
  });

  for (const font of doc.tokens.fonts) {
    if (!assetIds.has(font.assetId)) {
      issues.push({ code: "BROKEN_REFERENCE", path: `tokens.fonts[${font.id}].assetId`, message: `assetId ${font.assetId} does not exist` });
    }
  }
  for (const group of doc.imageStateGroups) {
    if (!group.states.some((s) => s.id === group.defaultStateId)) {
      issues.push({ code: "BROKEN_REFERENCE", path: `imageStateGroups[${group.id}].defaultStateId`, message: `defaultStateId ${group.defaultStateId} is not one of this group's states` });
    }
    for (const state of group.states) {
      if (!assetIds.has(state.assetId)) {
        issues.push({ code: "BROKEN_REFERENCE", path: `imageStateGroups[${group.id}].states[${state.id}].assetId`, message: `assetId ${state.assetId} does not exist` });
      }
    }
  }

  const ids = { assetIds, colorIds, fontIds, borderIds, componentRequirementIds, componentRequirementsById, breakpointIds, stateGroups };

  const checkContainer = (container: MasterPage | Page | Popup, kind: string, index: number) => {
    const path = `${kind}[${index}]`;
    if ("masterId" in container && container.masterId !== undefined && !masterIds.has(container.masterId)) {
      issues.push({ code: "BROKEN_REFERENCE", path: `${path}.masterId`, message: `masterId ${container.masterId} does not exist` });
    }
    if ("parentMasterId" in container && container.parentMasterId !== undefined && !masterIds.has(container.parentMasterId)) {
      issues.push({ code: "BROKEN_REFERENCE", path: `${path}.parentMasterId`, message: `parentMasterId ${container.parentMasterId} does not exist` });
    }
    checkLayerReferences(container.layers, `${path}.layers`, ids, issues);

    const layerIds = new Set<Id>();
    (function collect(layers: Layer[]) {
      for (const layer of layers) {
        layerIds.add(layer.id);
        if (layer.type === "group") collect(layer.children);
      }
    })(container.layers);

    container.animations.forEach((animation, j) => {
      if (!layerIds.has(animation.targetLayerId)) {
        issues.push({
          code: "BROKEN_REFERENCE",
          path: `${path}.animations[${j}].targetLayerId`,
          message: `targetLayerId ${animation.targetLayerId} does not exist in this container's layers`,
        });
      }
    });
  };

  doc.masters.forEach((m, i) => checkContainer(m, "masters", i));
  doc.pages.forEach((p, i) => checkContainer(p, "pages", i));
  doc.popups.forEach((p, i) => checkContainer(p, "popups", i));

  // Effect layers may target another layer within the same tree.
  const checkEffectTargets = (layers: Layer[], allLayerIds: Set<Id>, path: string) => {
    layers.forEach((layer, i) => {
      const layerPath = `${path}[${i}]`;
      if (layer.type === "effect" && layer.effect.targetLayerId !== undefined && !allLayerIds.has(layer.effect.targetLayerId)) {
        issues.push({
          code: "BROKEN_REFERENCE",
          path: `${layerPath}.effect.targetLayerId`,
          message: `targetLayerId ${layer.effect.targetLayerId} does not exist in this container's layers`,
        });
      }
      if (layer.type === "group") checkEffectTargets(layer.children, allLayerIds, `${layerPath}.children`);
    });
  };
  const allInContainer = (layers: Layer[]): Set<Id> => {
    const set = new Set<Id>();
    (function collect(ls: Layer[]) {
      for (const l of ls) {
        set.add(l.id);
        if (l.type === "group") collect(l.children);
      }
    })(layers);
    return set;
  };
  doc.masters.forEach((m, i) => checkEffectTargets(m.layers, allInContainer(m.layers), `masters[${i}].layers`));
  doc.pages.forEach((p, i) => checkEffectTargets(p.layers, allInContainer(p.layers), `pages[${i}].layers`));
  doc.popups.forEach((p, i) => checkEffectTargets(p.layers, allInContainer(p.layers), `popups[${i}].layers`));

  return issues;
}

export function checkCircularMasters(doc: SemanticDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const parentOf = new Map(doc.masters.map((m) => [m.id, m.parentMasterId]));

  for (const master of doc.masters) {
    const visited = new Set<Id>();
    let current: Id | undefined = master.id;
    while (current !== undefined) {
      if (visited.has(current)) {
        issues.push({
          code: "CIRCULAR_MASTER",
          path: `masters[${master.id}]`,
          message: `master inheritance cycle detected starting at ${master.id}: ${[...visited, current].join(" -> ")}`,
        });
        break;
      }
      visited.add(current);
      current = parentOf.get(current);
    }
  }
  return issues;
}

/** Runs all structural (in-memory, non-filesystem) semantic checks. Asset *file* presence is checked separately by the packaging layer. */
export function checkSemantics(doc: SemanticDocument): ValidationIssue[] {
  return [...checkDuplicateIds(doc), ...checkBrokenReferences(doc), ...checkCircularMasters(doc), ...checkBehaviourRules(doc)];
}

export type { StudioProjectDocument, RuntimeThemeDocument };
