import type { BehaviourAction, BehaviourRule, BehaviourTrigger, Id, SafeComponentStyleProperty, StyleValue } from "@fdraft/theme-sdk";
import { evaluateCondition } from "./conditions.js";
import type { HostSettings, RenderState } from "./types.js";

/**
 * One rule's candidacy for one conflict target — kept even when the rule
 * didn't win (disabled, or its condition was false) so a trace/debug view
 * can show *why* a rule didn't apply, not just which one did.
 */
export interface BehaviourTraceCandidate {
  ruleId: Id;
  ruleName: string;
  enabled: boolean;
  conditionMet: boolean;
  priority: number;
}

export interface BehaviourTraceEntry {
  /** A stable, human-inspectable key for the thing being contended over — e.g. `visibility:<layerId>`, `imageState:<stateGroupId>`. */
  targetKey: string;
  /** In rule declaration order. */
  candidates: BehaviourTraceCandidate[];
  winningRuleId?: Id;
}

export interface BehaviourResolution {
  visibilityOverrides: Record<Id, boolean>;
  enabledOverrides: Record<Id, boolean>;
  imageStateOverrides: Record<Id, Id>;
  styleOverrides: Record<Id, Partial<Record<SafeComponentStyleProperty, StyleValue>>>;
  copyVariantOverrides: Record<Id, Record<string, Id>>;
  /**
   * Whether a `manual`-triggered animation (see `AnimationTrigger`) is
   * currently active, keyed by the `AnimationDeclaration`'s own id. This is
   * how "on hover/focus/pressed" and continuously-looping "idle" animations
   * are built: a `whileTrue` rule with an `interactionFlag`/`always`
   * condition and a `startAnimation`/`stopAnimation` action — no edge
   * dispatch plumbing needed, the same conflict resolution as every other
   * continuous target applies. `restartAnimation` has no continuous
   * meaning (it's inherently a one-shot pulse) and only ever applies
   * through `resolveTriggeredRule`.
   */
  animationActiveOverrides: Record<Id, boolean>;
  trace: BehaviourTraceEntry[];
}

export const EMPTY_BEHAVIOUR_RESOLUTION: BehaviourResolution = {
  visibilityOverrides: {},
  enabledOverrides: {},
  imageStateOverrides: {},
  styleOverrides: {},
  copyVariantOverrides: {},
  animationActiveOverrides: {},
  trace: [],
};

/** The one conflict target a "continuous" (`whileTrue`) action affects, if any. Imperative-only actions (navigate, open/close popup, `restartAnimation`) have no continuous target — they only ever apply through `resolveTriggeredRule`. */
function continuousTargetKey(action: BehaviourAction): string | undefined {
  switch (action.type) {
    case "show":
    case "hide":
      return `visibility:${action.layerId}`;
    case "setEnabled":
      return `enabled:${action.layerId}`;
    case "setImageState":
      return `imageState:${action.stateGroupId}`;
    case "applyStyleOverride":
      return `style:${action.layerId}:${action.property}`;
    case "selectCopyVariant":
      return `copyVariant:${action.layerId}:${action.slotKey}`;
    case "startAnimation":
    case "stopAnimation":
      return `animation:${action.animationId}`;
    default:
      return undefined;
  }
}

function applyAction(action: BehaviourAction, out: BehaviourResolution): void {
  switch (action.type) {
    case "show":
      out.visibilityOverrides[action.layerId] = true;
      return;
    case "hide":
      out.visibilityOverrides[action.layerId] = false;
      return;
    case "setEnabled":
      out.enabledOverrides[action.layerId] = action.enabled;
      return;
    case "setImageState":
      out.imageStateOverrides[action.stateGroupId] = action.stateId;
      return;
    case "applyStyleOverride":
      out.styleOverrides[action.layerId] = { ...out.styleOverrides[action.layerId], [action.property]: action.value };
      return;
    case "selectCopyVariant":
      out.copyVariantOverrides[action.layerId] = { ...out.copyVariantOverrides[action.layerId], [action.slotKey]: action.variantId };
      return;
    case "startAnimation":
      out.animationActiveOverrides[action.animationId] = true;
      return;
    case "stopAnimation":
      out.animationActiveOverrides[action.animationId] = false;
      return;
    default:
      return;
  }
}

/**
 * Resolves every `whileTrue` rule's effect on the current render, fresh,
 * with no memory of a previous render — the same deterministic function
 * Studio's preview and FDraft's real runtime both call. Rules are
 * evaluated against one snapshot of `renderState`; they never see each
 * other's resulting overrides within the same pass, so evaluation is a
 * single non-recursive walk that always terminates regardless of what a
 * theme declares (an authored "loop" is a dead/contradictory rule to fix,
 * never a runtime hang — see `checkBehaviourRules`'s
 * `BEHAVIOUR_SELF_TRIGGER_LOOP`).
 *
 * Conflict resolution: when two enabled, currently-true rules target the
 * same thing (e.g. both show/hide the same layer), the higher `priority`
 * wins; equal priority is broken by declaration order, **later wins**.
 */
export function resolveActiveBehaviourRules(rules: BehaviourRule[], renderState: RenderState, hostSettings?: HostSettings): BehaviourResolution {
  const whileTrueRules = rules.filter((r) => r.trigger.type === "whileTrue");

  const candidatesByTarget = new Map<string, { rule: BehaviourRule; conditionMet: boolean; action: BehaviourAction }[]>();
  for (const rule of whileTrueRules) {
    const conditionMet = rule.enabled && evaluateCondition(rule.condition, renderState, { hostSettings });
    for (const action of rule.actions) {
      const key = continuousTargetKey(action);
      if (!key) continue;
      const list = candidatesByTarget.get(key) ?? [];
      list.push({ rule, conditionMet, action });
      candidatesByTarget.set(key, list);
    }
  }

  const out: BehaviourResolution = { visibilityOverrides: {}, enabledOverrides: {}, imageStateOverrides: {}, styleOverrides: {}, copyVariantOverrides: {}, animationActiveOverrides: {}, trace: [] };

  for (const [targetKey, candidates] of candidatesByTarget) {
    let winner: (typeof candidates)[number] | undefined;
    for (const candidate of candidates) {
      if (!candidate.conditionMet) continue;
      if (!winner || candidate.rule.priority >= winner.rule.priority) winner = candidate;
    }
    if (winner) applyAction(winner.action, out);
    out.trace.push({
      targetKey,
      candidates: candidates.map((c) => ({ ruleId: c.rule.id, ruleName: c.rule.name, enabled: c.rule.enabled, conditionMet: c.conditionMet, priority: c.rule.priority })),
      winningRuleId: winner?.rule.id,
    });
  }

  return out;
}

/** One externally-observed edge event a host dispatches at the moment it happens — everything `BehaviourTrigger` can match except the continuous `whileTrue` case. */
export type BehaviourTriggerEvent = Exclude<BehaviourTrigger, { type: "whileTrue" }>;

function triggerMatchesEvent(trigger: BehaviourTrigger, event: BehaviourTriggerEvent): boolean {
  if (trigger.type !== event.type) return false;
  switch (trigger.type) {
    case "pageEnter":
    case "pageExit":
      return trigger.pageId === (event as Extract<BehaviourTriggerEvent, { type: "pageEnter" | "pageExit" }>).pageId;
    case "popupOpen":
    case "popupClose":
      return trigger.popupId === (event as Extract<BehaviourTriggerEvent, { type: "popupOpen" | "popupClose" }>).popupId;
    case "click":
    case "hoverStart":
    case "hoverEnd":
    case "focus":
    case "blur":
      return trigger.layerId === (event as Extract<BehaviourTriggerEvent, { type: "click" | "hoverStart" | "hoverEnd" | "focus" | "blur" }>).layerId;
    case "eventPhaseChange":
      return trigger.toPhase === (event as Extract<BehaviourTriggerEvent, { type: "eventPhaseChange" }>).toPhase;
    case "conditionBecomesTrue":
      return true; // matched by trigger.type alone; its own condition is checked as this candidate's conditionMet below.
    default:
      return false;
  }
}

export interface TriggeredRuleResolution {
  winner?: BehaviourRule;
  trace: BehaviourTraceCandidate[];
}

/**
 * Resolves which single enabled, condition-true rule fires for one edge
 * event (a click, a page becoming current, a `conditionBecomesTrue`
 * trigger's own condition holding right now). The caller — the host
 * mounting this renderer — decides *when* to call this (the actual click,
 * the actual page transition, or its own before/after diff of
 * `renderState` for a `conditionBecomesTrue` edge) and is responsible for
 * actually executing the winning rule's actions via its own host adapter
 * (navigation, popup open/close, animation control); this function only
 * ever returns data, never performs a side effect itself.
 */
export function resolveTriggeredRule(rules: BehaviourRule[], event: BehaviourTriggerEvent, renderState: RenderState, hostSettings?: HostSettings): TriggeredRuleResolution {
  const candidates: BehaviourTraceCandidate[] = [];
  let winner: BehaviourRule | undefined;

  for (const rule of rules) {
    if (!triggerMatchesEvent(rule.trigger, event)) continue;
    // A `conditionBecomesTrue` trigger carries its own condition (what edge it means), in addition to the rule's own gating `condition` — both must hold.
    const triggerConditionMet = rule.trigger.type === "conditionBecomesTrue" ? evaluateCondition(rule.trigger.condition, renderState, { hostSettings }) : true;
    const conditionMet = rule.enabled && triggerConditionMet && evaluateCondition(rule.condition, renderState, { hostSettings });
    candidates.push({ ruleId: rule.id, ruleName: rule.name, enabled: rule.enabled, conditionMet, priority: rule.priority });
    if (conditionMet && (!winner || rule.priority >= winner.priority)) winner = rule;
  }

  return { winner, trace: candidates };
}
