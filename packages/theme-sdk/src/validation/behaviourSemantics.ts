import type { BehaviourAction, BehaviourRule, BehaviourTrigger } from "../schema/behaviour.js";
import type { Condition } from "../schema/interaction.js";
import { RUNTIME_VARIABLE_VALUE_TYPE } from "../schema/interaction.js";
import type { Layer } from "../schema/layers.js";
import type { MasterPage, Page, Popup } from "../schema/pages.js";
import type { ComponentRequirement } from "../schema/components.js";
import type { Id } from "../schema/primitives.js";
import type { ValidationIssue } from "./semantic.js";

function allLayers(layers: Layer[]): Layer[] {
  const out: Layer[] = [];
  (function walk(ls: Layer[]) {
    for (const l of ls) {
      out.push(l);
      if (l.type === "group") walk(l.children);
    }
  })(layers);
  return out;
}

interface BehaviourLookups {
  layersById: Map<Id, Layer>;
  pageIds: Set<Id>;
  popupIds: Set<Id>;
  animationIds: Set<Id>;
  stateGroups: Map<Id, Set<Id>>;
  componentRequirementsById: Map<Id, ComponentRequirement>;
}

function buildLookups(doc: {
  masters: MasterPage[];
  pages: Page[];
  popups: Popup[];
  imageStateGroups: { id: Id; states: { id: Id }[] }[];
  componentRequirements: ComponentRequirement[];
}): BehaviourLookups {
  const layersById = new Map<Id, Layer>();
  const animationIds = new Set<Id>();
  const containers: (MasterPage | Page | Popup)[] = [...doc.masters, ...doc.pages, ...doc.popups];
  for (const container of containers) {
    for (const layer of allLayers(container.layers)) layersById.set(layer.id, layer);
    for (const animation of container.animations) animationIds.add(animation.id);
  }
  return {
    layersById,
    pageIds: new Set(doc.pages.map((p) => p.id)),
    popupIds: new Set(doc.popups.map((p) => p.id)),
    animationIds,
    stateGroups: new Map(doc.imageStateGroups.map((g) => [g.id, new Set(g.states.map((s) => s.id))])),
    componentRequirementsById: new Map(doc.componentRequirements.map((c) => [c.id, c])),
  };
}

/** Every image-state-group id a condition reads, via either `stateEquals` or a `compare`/`boolean`/`inRange` node over an `imageState` variable — the raw material for self-trigger-loop detection. */
function collectReadStateGroupIds(condition: Condition, out: Set<Id>): void {
  switch (condition.type) {
    case "stateEquals":
      out.add(condition.stateGroupId);
      return;
    case "compare":
    case "boolean":
      if (condition.variable.kind === "imageState") out.add(condition.variable.stateGroupId);
      return;
    case "inRange":
      if (condition.variable.kind === "imageState") out.add(condition.variable.stateGroupId);
      return;
    case "and":
    case "or":
      condition.conditions.forEach((c) => collectReadStateGroupIds(c, out));
      return;
    case "not":
      collectReadStateGroupIds(condition.condition, out);
      return;
    default:
      return;
  }
}

/** Every `layerId` an `interactionFlag` variable explicitly names anywhere in a condition tree — the raw material for a broken-reference check (an *omitted* `layerId` is ambient/contextual and never checked here). */
function collectInteractionFlagLayerRefs(condition: Condition, path: string, out: { layerId: Id; path: string }[]): void {
  switch (condition.type) {
    case "compare":
    case "boolean":
      if (condition.variable.kind === "interactionFlag" && condition.variable.layerId !== undefined) out.push({ layerId: condition.variable.layerId, path });
      return;
    case "and":
    case "or":
      condition.conditions.forEach((c, i) => collectInteractionFlagLayerRefs(c, `${path}.conditions[${i}]`, out));
      return;
    case "not":
      collectInteractionFlagLayerRefs(condition.condition, `${path}.condition`, out);
      return;
    default:
      return;
  }
}

function collectTypeMismatches(condition: Condition, path: string, issues: ValidationIssue[]): void {
  switch (condition.type) {
    case "compare": {
      const expected = RUNTIME_VARIABLE_VALUE_TYPE[condition.variable.kind];
      const actual = typeof condition.value;
      if (actual !== expected) {
        issues.push({ code: "BEHAVIOUR_TYPE_MISMATCH", path: `${path}.value`, message: `comparing ${condition.variable.kind} (${expected}) against a ${actual} value` });
      } else if ((condition.operator === "gt" || condition.operator === "gte" || condition.operator === "lt" || condition.operator === "lte") && expected !== "number") {
        issues.push({ code: "BEHAVIOUR_TYPE_MISMATCH", path: `${path}.operator`, message: `"${condition.operator}" is a numeric comparison but ${condition.variable.kind} is ${expected}` });
      }
      return;
    }
    case "inRange":
      if (RUNTIME_VARIABLE_VALUE_TYPE[condition.variable.kind] !== "number") {
        issues.push({ code: "BEHAVIOUR_TYPE_MISMATCH", path, message: `inRange requires a numeric variable, but ${condition.variable.kind} is ${RUNTIME_VARIABLE_VALUE_TYPE[condition.variable.kind]}` });
      }
      return;
    case "boolean":
      if (RUNTIME_VARIABLE_VALUE_TYPE[condition.variable.kind] !== "boolean") {
        issues.push({ code: "BEHAVIOUR_TYPE_MISMATCH", path, message: `a boolean check requires a boolean variable, but ${condition.variable.kind} is ${RUNTIME_VARIABLE_VALUE_TYPE[condition.variable.kind]}` });
      }
      return;
    case "and":
    case "or":
      condition.conditions.forEach((c, i) => collectTypeMismatches(c, `${path}.conditions[${i}]`, issues));
      return;
    case "not":
      collectTypeMismatches(condition.condition, `${path}.condition`, issues);
      return;
    default:
      return;
  }
}

function checkTriggerReferences(trigger: BehaviourTrigger, path: string, lookups: BehaviourLookups, issues: ValidationIssue[]): void {
  switch (trigger.type) {
    case "pageEnter":
    case "pageExit":
      if (!lookups.pageIds.has(trigger.pageId)) issues.push({ code: "BROKEN_REFERENCE", path: `${path}.pageId`, message: `pageId ${trigger.pageId} does not exist` });
      return;
    case "popupOpen":
    case "popupClose":
      if (!lookups.popupIds.has(trigger.popupId)) issues.push({ code: "BROKEN_REFERENCE", path: `${path}.popupId`, message: `popupId ${trigger.popupId} does not exist` });
      return;
    case "click":
    case "hoverStart":
    case "hoverEnd":
    case "focus":
    case "blur":
      if (!lookups.layersById.has(trigger.layerId)) issues.push({ code: "BROKEN_REFERENCE", path: `${path}.layerId`, message: `layerId ${trigger.layerId} does not exist` });
      return;
    case "conditionBecomesTrue":
      collectTypeMismatches(trigger.condition, `${path}.condition`, issues);
      return;
    case "whileTrue":
    case "eventPhaseChange":
      return;
  }
}

function checkActionReferences(action: BehaviourAction, path: string, lookups: BehaviourLookups, issues: ValidationIssue[]): void {
  const checkLayer = (layerId: Id, field = "layerId") => {
    if (!lookups.layersById.has(layerId)) issues.push({ code: "BROKEN_REFERENCE", path: `${path}.${field}`, message: `${field} ${layerId} does not exist` });
  };
  const checkStateGroup = (stateGroupId: Id, stateId?: Id) => {
    const group = lookups.stateGroups.get(stateGroupId);
    if (!group) {
      issues.push({ code: "BROKEN_REFERENCE", path: `${path}.stateGroupId`, message: `stateGroupId ${stateGroupId} does not exist` });
    } else if (stateId !== undefined && !group.has(stateId)) {
      issues.push({ code: "BROKEN_REFERENCE", path: `${path}.stateId`, message: `stateId ${stateId} does not exist in state group ${stateGroupId}` });
    }
  };

  switch (action.type) {
    case "show":
    case "hide": {
      checkLayer(action.layerId);
      const layer = lookups.layersById.get(action.layerId);
      if (action.type === "hide" && layer?.type === "component") {
        const requirement = lookups.componentRequirementsById.get(layer.componentRequirementId);
        if (requirement?.required) {
          issues.push({ code: "BEHAVIOUR_UNSAFE_ACTION", path, message: `hiding layer ${action.layerId} would hide a required component (${requirement.componentKey})` });
        }
      }
      return;
    }
    case "setEnabled": {
      checkLayer(action.layerId);
      const layer = lookups.layersById.get(action.layerId);
      if (!action.enabled && layer?.type === "component") {
        const requirement = lookups.componentRequirementsById.get(layer.componentRequirementId);
        if (requirement?.required) {
          issues.push({ code: "BEHAVIOUR_UNSAFE_ACTION", path, message: `disabling layer ${action.layerId} would disable a required component (${requirement.componentKey})` });
        }
      }
      return;
    }
    case "setImageState":
      checkStateGroup(action.stateGroupId, action.stateId);
      return;
    case "applyStyleOverride": {
      checkLayer(action.layerId);
      const layer = lookups.layersById.get(action.layerId);
      const requirement = lookups.componentRequirementsById.get(action.componentRequirementId);
      if (!requirement) {
        issues.push({ code: "BROKEN_REFERENCE", path: `${path}.componentRequirementId`, message: `componentRequirementId ${action.componentRequirementId} does not exist` });
      } else {
        if (!requirement.allowedProperties.includes(action.property)) {
          issues.push({ code: "DISALLOWED_STYLE_PROPERTY", path: `${path}.property`, message: `"${action.property}" is not in componentRequirement ${requirement.id}'s allowedProperties (${requirement.allowedProperties.join(", ") || "none"})` });
        }
        if (layer?.type === "component" && layer.componentRequirementId !== action.componentRequirementId) {
          issues.push({ code: "BROKEN_REFERENCE", path: `${path}.componentRequirementId`, message: `layer ${action.layerId} does not use componentRequirement ${action.componentRequirementId}` });
        }
      }
      return;
    }
    case "startAnimation":
    case "stopAnimation":
    case "restartAnimation":
      if (!lookups.animationIds.has(action.animationId)) issues.push({ code: "BROKEN_REFERENCE", path: `${path}.animationId`, message: `animationId ${action.animationId} does not exist` });
      return;
    case "openPopup":
    case "closePopup":
      if (!lookups.popupIds.has(action.popupId)) issues.push({ code: "BROKEN_REFERENCE", path: `${path}.popupId`, message: `popupId ${action.popupId} does not exist` });
      return;
    case "navigateToPage":
      if (!lookups.pageIds.has(action.pageId)) issues.push({ code: "BROKEN_REFERENCE", path: `${path}.pageId`, message: `pageId ${action.pageId} does not exist` });
      return;
    case "selectCopyVariant": {
      checkLayer(action.layerId);
      const layer = lookups.layersById.get(action.layerId);
      if (layer?.type === "component") {
        const variants = layer.copyVariants?.[action.slotKey];
        if (!variants || !variants.some((v) => v.id === action.variantId)) {
          issues.push({ code: "BROKEN_REFERENCE", path: `${path}.variantId`, message: `variantId ${action.variantId} does not exist for slot "${action.slotKey}" on layer ${action.layerId}` });
        }
      }
      return;
    }
  }
}

/**
 * Structural checks over `behaviourRules`: impossible references (a
 * trigger/action pointing at a layer/page/popup/state/animation/copy
 * variant that doesn't exist), type mismatches (comparing a variable
 * against the wrong kind of value, or with an operator that doesn't apply
 * to it), unsafe actions (hiding/disabling a required component), and an
 * obvious self-trigger loop (a rule whose own condition reads the exact
 * image-state group its own action writes). This can never catch every
 * possible authoring mistake — it is a static, structural pass, not a
 * simulation of every reachable render state — but it catches the classes
 * of mistake that would otherwise silently do nothing or contradict
 * themselves at runtime.
 */
export function checkBehaviourRules(doc: {
  masters: MasterPage[];
  pages: Page[];
  popups: Popup[];
  imageStateGroups: { id: Id; states: { id: Id }[] }[];
  componentRequirements: ComponentRequirement[];
  behaviourRules: BehaviourRule[];
}): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const lookups = buildLookups(doc);

  doc.behaviourRules.forEach((rule, i) => {
    const path = `behaviourRules[${i}]`;
    checkTriggerReferences(rule.trigger, `${path}.trigger`, lookups, issues);
    collectTypeMismatches(rule.condition, `${path}.condition`, issues);
    rule.actions.forEach((action, j) => checkActionReferences(action, `${path}.actions[${j}]`, lookups, issues));

    const interactionFlagLayerRefs: { layerId: Id; path: string }[] = [];
    collectInteractionFlagLayerRefs(rule.condition, `${path}.condition`, interactionFlagLayerRefs);
    if (rule.trigger.type === "conditionBecomesTrue") collectInteractionFlagLayerRefs(rule.trigger.condition, `${path}.trigger.condition`, interactionFlagLayerRefs);
    for (const ref of interactionFlagLayerRefs) {
      if (!lookups.layersById.has(ref.layerId)) issues.push({ code: "BROKEN_REFERENCE", path: `${ref.path}.variable.layerId`, message: `layerId ${ref.layerId} does not exist` });
    }

    const readStateGroups = new Set<Id>();
    collectReadStateGroupIds(rule.condition, readStateGroups);
    if (rule.trigger.type === "conditionBecomesTrue") collectReadStateGroupIds(rule.trigger.condition, readStateGroups);
    const writtenStateGroups = new Set(rule.actions.filter((a): a is Extract<BehaviourAction, { type: "setImageState" }> => a.type === "setImageState").map((a) => a.stateGroupId));
    for (const stateGroupId of writtenStateGroups) {
      if (readStateGroups.has(stateGroupId)) {
        issues.push({ code: "BEHAVIOUR_SELF_TRIGGER_LOOP", path, message: `rule "${rule.name}" both reads and writes the state of image-state group ${stateGroupId} — it can never stabilise` });
      }
    }
  });

  return issues;
}
