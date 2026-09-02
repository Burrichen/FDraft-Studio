import { describe, expect, it } from "vitest";
import type { BehaviourRule } from "@fdraft/theme-sdk";
import { resolveActiveBehaviourRules, resolveTriggeredRule } from "../src/behaviourResolve.js";
import type { RenderState } from "../src/types.js";

function rule(overrides: Partial<BehaviourRule>): BehaviourRule {
  return {
    id: overrides.id ?? "rule",
    name: overrides.name ?? "rule",
    enabled: overrides.enabled ?? true,
    priority: overrides.priority ?? 0,
    trigger: overrides.trigger ?? { type: "whileTrue" },
    condition: overrides.condition ?? { type: "always" },
    actions: overrides.actions ?? [{ type: "show", layerId: "layer-1" }],
  };
}

describe("resolveActiveBehaviourRules", () => {
  it("applies a single matching whileTrue rule's action", () => {
    const rules = [rule({ id: "r1", actions: [{ type: "hide", layerId: "layer-1" }] })];
    const resolution = resolveActiveBehaviourRules(rules, { activeImageStates: {} });
    expect(resolution.visibilityOverrides["layer-1"]).toBe(false);
  });

  it("ignores a disabled rule", () => {
    const rules = [rule({ id: "r1", enabled: false, actions: [{ type: "hide", layerId: "layer-1" }] })];
    const resolution = resolveActiveBehaviourRules(rules, { activeImageStates: {} });
    expect(resolution.visibilityOverrides["layer-1"]).toBeUndefined();
  });

  it("ignores a rule whose condition is currently false", () => {
    const rules = [rule({ id: "r1", condition: { type: "boolean", variable: { kind: "optedIn" }, equals: true }, actions: [{ type: "hide", layerId: "layer-1" }] })];
    const resolution = resolveActiveBehaviourRules(rules, { activeImageStates: {} });
    expect(resolution.visibilityOverrides["layer-1"]).toBeUndefined();
  });

  it("higher priority wins when two enabled, true rules target the same layer", () => {
    const rules = [
      rule({ id: "low", priority: 0, actions: [{ type: "show", layerId: "layer-1" }] }),
      rule({ id: "high", priority: 5, actions: [{ type: "hide", layerId: "layer-1" }] }),
    ];
    const resolution = resolveActiveBehaviourRules(rules, { activeImageStates: {} });
    expect(resolution.visibilityOverrides["layer-1"]).toBe(false);
    const entry = resolution.trace.find((t) => t.targetKey === "visibility:layer-1")!;
    expect(entry.winningRuleId).toBe("high");
    expect(entry.candidates).toHaveLength(2);
  });

  it("equal priority is broken by declaration order — later wins", () => {
    const rules = [
      rule({ id: "first", priority: 1, actions: [{ type: "show", layerId: "layer-1" }] }),
      rule({ id: "second", priority: 1, actions: [{ type: "hide", layerId: "layer-1" }] }),
    ];
    const resolution = resolveActiveBehaviourRules(rules, { activeImageStates: {} });
    expect(resolution.visibilityOverrides["layer-1"]).toBe(false);
  });

  it("resolves independent targets independently — a conflict on one layer doesn't affect another", () => {
    const rules = [
      rule({ id: "a", actions: [{ type: "hide", layerId: "layer-1" }] }),
      rule({ id: "b", actions: [{ type: "show", layerId: "layer-2" }] }),
    ];
    const resolution = resolveActiveBehaviourRules(rules, { activeImageStates: {} });
    expect(resolution.visibilityOverrides).toEqual({ "layer-1": false, "layer-2": true });
  });

  it("resolves setImageState, applyStyleOverride, setEnabled, and selectCopyVariant independently", () => {
    const rules = [
      rule({ id: "state", actions: [{ type: "setImageState", stateGroupId: "candy-bowl", stateId: "full" }] }),
      rule({ id: "style", actions: [{ type: "applyStyleOverride", layerId: "layer-1", componentRequirementId: "req-1", property: "opacity", value: 0.5 }] }),
      rule({ id: "enable", actions: [{ type: "setEnabled", layerId: "layer-2", enabled: false }] }),
      rule({ id: "variant", actions: [{ type: "selectCopyVariant", layerId: "layer-3", slotKey: "headline", variantId: "variant-a" }] }),
    ];
    const resolution = resolveActiveBehaviourRules(rules, { activeImageStates: {} });
    expect(resolution.imageStateOverrides["candy-bowl"]).toBe("full");
    expect(resolution.styleOverrides["layer-1"]).toEqual({ opacity: 0.5 });
    expect(resolution.enabledOverrides["layer-2"]).toBe(false);
    expect(resolution.copyVariantOverrides["layer-3"]).toEqual({ headline: "variant-a" });
  });

  it("does not evaluate edge-triggered rules as continuous", () => {
    const rules = [rule({ id: "r1", trigger: { type: "pageEnter", pageId: "page-1" }, actions: [{ type: "hide", layerId: "layer-1" }] })];
    const resolution = resolveActiveBehaviourRules(rules, { activeImageStates: {} });
    expect(resolution.visibilityOverrides).toEqual({});
  });

  it("records every candidate for a target in the trace even when it didn't win", () => {
    const rules = [
      rule({ id: "loses", priority: 0, condition: { type: "always" }, actions: [{ type: "show", layerId: "layer-1" }] }),
      rule({ id: "disabled", enabled: false, actions: [{ type: "hide", layerId: "layer-1" }] }),
      rule({ id: "wins", priority: 1, actions: [{ type: "hide", layerId: "layer-1" }] }),
    ];
    const resolution = resolveActiveBehaviourRules(rules, { activeImageStates: {} });
    const entry = resolution.trace.find((t) => t.targetKey === "visibility:layer-1")!;
    expect(entry.candidates).toHaveLength(3);
    expect(entry.candidates.find((c) => c.ruleId === "disabled")!.enabled).toBe(false);
    expect(entry.winningRuleId).toBe("wins");
  });
});

describe("resolveTriggeredRule", () => {
  it("matches a click trigger on the exact layer and returns the winner", () => {
    const rules = [rule({ id: "r1", trigger: { type: "click", layerId: "button-1" }, actions: [{ type: "openPopup", popupId: "popup-1" }] })];
    const result = resolveTriggeredRule(rules, { type: "click", layerId: "button-1" }, { activeImageStates: {} });
    expect(result.winner?.id).toBe("r1");
  });

  it("does not match a click on a different layer", () => {
    const rules = [rule({ id: "r1", trigger: { type: "click", layerId: "button-1" } })];
    const result = resolveTriggeredRule(rules, { type: "click", layerId: "button-2" }, { activeImageStates: {} });
    expect(result.winner).toBeUndefined();
  });

  it("respects priority when two rules match the same edge event", () => {
    const rules = [
      rule({ id: "low", priority: 0, trigger: { type: "pageEnter", pageId: "page-1" } }),
      rule({ id: "high", priority: 10, trigger: { type: "pageEnter", pageId: "page-1" } }),
    ];
    const result = resolveTriggeredRule(rules, { type: "pageEnter", pageId: "page-1" }, { activeImageStates: {} });
    expect(result.winner?.id).toBe("high");
  });

  it("does not fire when the rule's own condition is false", () => {
    const rules = [rule({ id: "r1", trigger: { type: "click", layerId: "b" }, condition: { type: "boolean", variable: { kind: "optedIn" }, equals: true } })];
    const result = resolveTriggeredRule(rules, { type: "click", layerId: "b" }, { activeImageStates: {} });
    expect(result.winner).toBeUndefined();
    expect(result.trace[0]!.conditionMet).toBe(false);
  });

  it("fires a conditionBecomesTrue trigger only when its own condition currently holds", () => {
    const rules = [rule({ id: "r1", trigger: { type: "conditionBecomesTrue", condition: { type: "boolean", variable: { kind: "draftGenerated" }, equals: true } } })];
    const notYet: RenderState = { activeImageStates: {}, event: { draftGenerated: false } };
    const now: RenderState = { activeImageStates: {}, event: { draftGenerated: true } };
    expect(resolveTriggeredRule(rules, { type: "conditionBecomesTrue", condition: rules[0]!.trigger.type === "conditionBecomesTrue" ? rules[0]!.trigger.condition : { type: "always" } }, notYet).winner).toBeUndefined();
    expect(resolveTriggeredRule(rules, { type: "conditionBecomesTrue", condition: rules[0]!.trigger.type === "conditionBecomesTrue" ? rules[0]!.trigger.condition : { type: "always" } }, now).winner?.id).toBe("r1");
  });
});
