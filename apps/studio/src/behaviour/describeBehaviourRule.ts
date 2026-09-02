import type { BehaviourAction, BehaviourRule, BehaviourTrigger, Condition, Id, Layer, MasterPage, Page, Popup, RuntimeVariable, StudioProjectDocument } from "@fdraft/theme-sdk";

export interface BehaviourNameLookups {
  layerName(id: Id): string;
  pageName(id: Id): string;
  popupName(id: Id): string;
  stateGroupName(id: Id): string;
  stateName(stateGroupId: Id, stateId: Id): string;
  animationName(id: Id): string;
}

function allLayersWithNames(layers: Layer[], out: Map<Id, string>): void {
  for (const layer of layers) {
    out.set(layer.id, layer.name);
    if (layer.type === "group") allLayersWithNames(layer.children, out);
  }
}

/** Builds all five id->name lookups once per project, so every rule/condition/action description reads names instead of raw UUIDs. Falls back to a shortened id when something no longer exists (a broken reference — still describable, just not by name). */
export function buildBehaviourNameLookups(project: StudioProjectDocument): BehaviourNameLookups {
  const layerNames = new Map<Id, string>();
  const animationNames = new Map<Id, string>();
  const containers: (MasterPage | Page | Popup)[] = [...project.masters, ...project.pages, ...project.popups];
  for (const container of containers) {
    allLayersWithNames(container.layers, layerNames);
    for (const animation of container.animations) animationNames.set(animation.id, animation.name);
  }
  const pageNames = new Map(project.pages.map((p) => [p.id, p.name] as const));
  const popupNames = new Map(project.popups.map((p) => [p.id, p.name] as const));
  const stateGroupNames = new Map(project.imageStateGroups.map((g) => [g.id, g.name] as const));
  const stateNames = new Map(project.imageStateGroups.flatMap((g) => g.states.map((s) => [`${g.id}:${s.id}`, s.name] as const)));

  const short = (id: Id) => `${id.slice(0, 8)}…`;
  return {
    layerName: (id) => layerNames.get(id) ?? short(id),
    pageName: (id) => pageNames.get(id) ?? short(id),
    popupName: (id) => popupNames.get(id) ?? short(id),
    stateGroupName: (id) => stateGroupNames.get(id) ?? short(id),
    stateName: (groupId, stateId) => stateNames.get(`${groupId}:${stateId}`) ?? short(stateId),
    animationName: (id) => animationNames.get(id) ?? short(id),
  };
}

const VARIABLE_LABEL: Record<RuntimeVariable["kind"], string> = {
  eventStatus: "the event status",
  eventActive: "the event is active",
  eventAvailable: "the event is available",
  optedIn: "the visitor has opted in",
  currentPageId: "the current page",
  currentPopupId: "the current popup",
  draftGenerated: "the draft has been generated",
  progressPercent: "progress",
  watchedCount: "the watched count",
  targetCount: "the target count",
  eventCompleted: "the event is completed",
  performanceTier: "the performance tier",
  reducedMotion: "reduced motion is on",
  interactionFlag: "this layer's interaction state",
  imageState: "the image state",
  dateTime: "the date/time",
};

const INTERACTION_FLAG_PAST_TENSE: Record<"hover" | "focus" | "pressed" | "selected", string> = {
  hover: "hovered",
  focus: "focused",
  pressed: "pressed",
  selected: "selected",
};

function describeVariable(variable: RuntimeVariable, lookups: BehaviourNameLookups): string {
  if (variable.kind === "interactionFlag") {
    const subject = variable.layerId !== undefined ? `"${lookups.layerName(variable.layerId)}"` : "this layer";
    return `${subject} is ${INTERACTION_FLAG_PAST_TENSE[variable.which]}`;
  }
  return VARIABLE_LABEL[variable.kind];
}

const OPERATOR_LABEL: Record<string, string> = { eq: "is", neq: "is not", gt: "is more than", gte: "is at least", lt: "is less than", lte: "is at most" };

export function describeCondition(condition: Condition, lookups: BehaviourNameLookups): string {
  switch (condition.type) {
    case "always":
      return "always";
    case "eventPhase":
      return `the event status is "${condition.phase}"`;
    case "stateEquals":
      return `${lookups.stateGroupName(condition.stateGroupId)} is set to "${lookups.stateName(condition.stateGroupId, condition.stateId)}"`;
    case "compare":
      return `${describeVariable(condition.variable, lookups)} ${OPERATOR_LABEL[condition.operator]} ${JSON.stringify(condition.value)}`;
    case "inRange":
      return `${describeVariable(condition.variable, lookups)} is between ${condition.min} and ${condition.max}`;
    case "boolean":
      return condition.equals ? describeVariable(condition.variable, lookups) : `${describeVariable(condition.variable, lookups)} is false`;
    case "and":
      return `all of: ${condition.conditions.map((c) => describeCondition(c, lookups)).join("; ")}`;
    case "or":
      return `any of: ${condition.conditions.map((c) => describeCondition(c, lookups)).join("; ")}`;
    case "not":
      return `not (${describeCondition(condition.condition, lookups)})`;
  }
}

export function describeTrigger(trigger: BehaviourTrigger, lookups: BehaviourNameLookups): string {
  switch (trigger.type) {
    case "whileTrue":
      return "while its condition holds";
    case "pageEnter":
      return `entering page "${lookups.pageName(trigger.pageId)}"`;
    case "pageExit":
      return `leaving page "${lookups.pageName(trigger.pageId)}"`;
    case "popupOpen":
      return `opening popup "${lookups.popupName(trigger.popupId)}"`;
    case "popupClose":
      return `closing popup "${lookups.popupName(trigger.popupId)}"`;
    case "click":
      return `clicking "${lookups.layerName(trigger.layerId)}"`;
    case "hoverStart":
      return `hovering "${lookups.layerName(trigger.layerId)}"`;
    case "hoverEnd":
      return `un-hovering "${lookups.layerName(trigger.layerId)}"`;
    case "focus":
      return `focusing "${lookups.layerName(trigger.layerId)}"`;
    case "blur":
      return `un-focusing "${lookups.layerName(trigger.layerId)}"`;
    case "eventPhaseChange":
      return `the event status changing to "${trigger.toPhase}"`;
    case "conditionBecomesTrue":
      return `${describeCondition(trigger.condition, lookups)} becoming true`;
  }
}

export function describeAction(action: BehaviourAction, lookups: BehaviourNameLookups): string {
  switch (action.type) {
    case "show":
      return `show "${lookups.layerName(action.layerId)}"`;
    case "hide":
      return `hide "${lookups.layerName(action.layerId)}"`;
    case "setEnabled":
      return `${action.enabled ? "enable" : "disable"} "${lookups.layerName(action.layerId)}"`;
    case "setImageState":
      return `set ${lookups.stateGroupName(action.stateGroupId)} to "${lookups.stateName(action.stateGroupId, action.stateId)}"`;
    case "applyStyleOverride":
      return `set "${lookups.layerName(action.layerId)}"'s ${action.property} to ${JSON.stringify(action.value)}`;
    case "startAnimation":
      return `start animation "${lookups.animationName(action.animationId)}"`;
    case "stopAnimation":
      return `stop animation "${lookups.animationName(action.animationId)}"`;
    case "restartAnimation":
      return `restart animation "${lookups.animationName(action.animationId)}"`;
    case "openPopup":
      return `open popup "${lookups.popupName(action.popupId)}"`;
    case "closePopup":
      return `close popup "${lookups.popupName(action.popupId)}"`;
    case "navigateToPage":
      return `navigate to page "${lookups.pageName(action.pageId)}"`;
    case "selectCopyVariant":
      return `use the "${action.slotKey}" copy variant on "${lookups.layerName(action.layerId)}"`;
  }
}

/** Turns a `BehaviourResolution` trace entry's machine target key (e.g. `visibility:<layerId>`) into a readable label for the trace/debug view. */
export function describeTargetKey(targetKey: string, lookups: BehaviourNameLookups): string {
  const [kind, ...rest] = targetKey.split(":");
  switch (kind) {
    case "visibility":
      return `Visibility of "${lookups.layerName(rest[0]!)}"`;
    case "enabled":
      return `Enabled state of "${lookups.layerName(rest[0]!)}"`;
    case "imageState":
      return `Image state of "${lookups.stateGroupName(rest[0]!)}"`;
    case "style":
      return `"${rest[1]}" style of "${lookups.layerName(rest[0]!)}"`;
    case "copyVariant":
      return `"${rest[1]}" copy variant of "${lookups.layerName(rest[0]!)}"`;
    default:
      return targetKey;
  }
}

/** A single readable sentence for a whole rule — used in the rule list, the editor header, and the trace/debug view. */
export function describeBehaviourRule(rule: BehaviourRule, lookups: BehaviourNameLookups): string {
  const trigger = describeTrigger(rule.trigger, lookups);
  const condition = rule.condition.type === "always" ? "" : `, if ${describeCondition(rule.condition, lookups)},`;
  const actions = rule.actions.map((a) => describeAction(a, lookups)).join(" and ");
  return `When ${trigger}${condition} then ${actions}.`;
}
