import { createId } from "@fdraft/theme-sdk";
import type { BehaviourAction, BehaviourRule, Condition, MasterPage, Page, Popup, StudioProjectDocument, Layer, Id, BehaviourTrigger } from "@fdraft/theme-sdk";
import type { Command } from "../history/commandStack.js";

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

/** The first layer found anywhere in the project (masters, then pages, then popups) — a safe, always-valid default action target for a brand-new rule. `undefined` only for a project with no layers at all anywhere. */
export function findFirstLayerId(project: StudioProjectDocument): Id | undefined {
  return listAllLayers(project)[0]?.id;
}

/** Every layer anywhere in the project (masters, pages, popups, recursively through groups) — the raw material for a rule editor's target pickers. */
export function listAllLayers(project: StudioProjectDocument): Layer[] {
  const containers: (MasterPage | Page | Popup)[] = [...project.masters, ...project.pages, ...project.popups];
  return containers.flatMap((c) => allLayers(c.layers));
}

/** Every animation declared anywhere in the project — animations are container-scoped in the schema, but a Behaviour rule addresses one by id alone. */
export function listAllAnimations(project: StudioProjectDocument): { id: Id; name: string }[] {
  const containers: (MasterPage | Page | Popup)[] = [...project.masters, ...project.pages, ...project.popups];
  return containers.flatMap((c) => c.animations.map((a) => ({ id: a.id, name: a.name })));
}

/** A new rule always starts schema-valid (at least one action) — `undefined` only when the project has no layer anywhere to default the action at, in which case the caller should ask for a layer to be added first. */
export function createDefaultBehaviourRule(project: StudioProjectDocument, name = "New rule"): BehaviourRule | undefined {
  const layerId = findFirstLayerId(project);
  if (!layerId) return undefined;
  return {
    id: createId(),
    name,
    enabled: true,
    priority: 0,
    trigger: { type: "whileTrue" },
    condition: { type: "always" },
    actions: [{ type: "show", layerId }],
  };
}

function updateRule(project: StudioProjectDocument, ruleId: Id, update: (rule: BehaviourRule) => BehaviourRule): StudioProjectDocument {
  return { ...project, behaviourRules: project.behaviourRules.map((r) => (r.id === ruleId ? update(r) : r)) };
}

export function buildAddBehaviourRuleCommand(rule: BehaviourRule): Command<StudioProjectDocument> {
  return {
    label: "Add rule",
    do: (p) => ({ ...p, behaviourRules: [...p.behaviourRules, rule] }),
    undo: (p) => ({ ...p, behaviourRules: p.behaviourRules.filter((r) => r.id !== rule.id) }),
  };
}

export function buildDuplicateBehaviourRuleCommand(ruleId: Id): Command<StudioProjectDocument> {
  const newId = createId();
  return {
    label: "Duplicate rule",
    do: (p) => {
      const index = p.behaviourRules.findIndex((r) => r.id === ruleId);
      if (index === -1) return p;
      const original = p.behaviourRules[index]!;
      const clone: BehaviourRule = { ...original, id: newId, name: `${original.name} copy` };
      const next = [...p.behaviourRules];
      next.splice(index + 1, 0, clone);
      return { ...p, behaviourRules: next };
    },
    undo: (p) => ({ ...p, behaviourRules: p.behaviourRules.filter((r) => r.id !== newId) }),
  };
}

export function buildDeleteBehaviourRuleCommand(ruleId: Id): Command<StudioProjectDocument> {
  let removedIndex = -1;
  let removed: BehaviourRule | undefined;
  return {
    label: "Delete rule",
    do: (p) => {
      removedIndex = p.behaviourRules.findIndex((r) => r.id === ruleId);
      removed = p.behaviourRules[removedIndex];
      return { ...p, behaviourRules: p.behaviourRules.filter((r) => r.id !== ruleId) };
    },
    undo: (p) => {
      if (!removed || removedIndex === -1) return p;
      const next = [...p.behaviourRules];
      next.splice(removedIndex, 0, removed);
      return { ...p, behaviourRules: next };
    },
  };
}

export function buildRenameBehaviourRuleCommand(ruleId: Id, name: string): Command<StudioProjectDocument> {
  return {
    label: "Rename rule",
    do: (p) => updateRule(p, ruleId, (r) => ({ ...r, name })),
    undo: (p) => p,
  };
}

export function buildSetBehaviourRuleEnabledCommand(ruleId: Id, enabled: boolean): Command<StudioProjectDocument> {
  return {
    label: enabled ? "Enable rule" : "Disable rule",
    do: (p) => updateRule(p, ruleId, (r) => ({ ...r, enabled })),
    undo: (p) => updateRule(p, ruleId, (r) => ({ ...r, enabled: !enabled })),
  };
}

export function buildSetBehaviourRulePriorityCommand(ruleId: Id, priority: number): Command<StudioProjectDocument> {
  return {
    label: "Set rule priority",
    do: (p) => updateRule(p, ruleId, (r) => ({ ...r, priority })),
    undo: (p) => p,
  };
}

export function buildSetBehaviourRuleTriggerCommand(ruleId: Id, trigger: BehaviourTrigger): Command<StudioProjectDocument> {
  return {
    label: "Change rule trigger",
    do: (p) => updateRule(p, ruleId, (r) => ({ ...r, trigger })),
    undo: (p) => p,
  };
}

export function buildSetBehaviourRuleConditionCommand(ruleId: Id, condition: Condition): Command<StudioProjectDocument> {
  return {
    label: "Change rule condition",
    do: (p) => updateRule(p, ruleId, (r) => ({ ...r, condition })),
    undo: (p) => p,
  };
}

export function buildSetBehaviourRuleActionsCommand(ruleId: Id, actions: BehaviourAction[]): Command<StudioProjectDocument> {
  return {
    label: "Change rule actions",
    do: (p) => updateRule(p, ruleId, (r) => ({ ...r, actions })),
    undo: (p) => p,
  };
}

/** Swaps a rule with its immediate neighbour — a simpler, always-valid alternative to drag reordering. A no-op command (schema-safe) at either end of the list. */
export function buildReorderBehaviourRuleCommand(ruleId: Id, direction: "up" | "down"): Command<StudioProjectDocument> {
  return {
    label: direction === "up" ? "Move rule up" : "Move rule down",
    do: (p) => {
      const index = p.behaviourRules.findIndex((r) => r.id === ruleId);
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (index === -1 || targetIndex < 0 || targetIndex >= p.behaviourRules.length) return p;
      const next = [...p.behaviourRules];
      const [moved] = next.splice(index, 1);
      next.splice(targetIndex, 0, moved!);
      return { ...p, behaviourRules: next };
    },
    undo: (p) => {
      const index = p.behaviourRules.findIndex((r) => r.id === ruleId);
      const originalIndex = direction === "up" ? index + 1 : index - 1;
      if (index === -1 || originalIndex < 0 || originalIndex >= p.behaviourRules.length) return p;
      const next = [...p.behaviourRules];
      const [moved] = next.splice(index, 1);
      next.splice(originalIndex, 0, moved!);
      return { ...p, behaviourRules: next };
    },
  };
}
