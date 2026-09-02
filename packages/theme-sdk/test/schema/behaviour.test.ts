import { describe, expect, it } from "vitest";
import { createId } from "../../src/ids.js";
import { BehaviourRuleSchema } from "../../src/schema/behaviour.js";
import { ConditionSchema } from "../../src/schema/interaction.js";
import { ComponentLayerSchema } from "../../src/schema/layers.js";

function baseComponentLayer() {
  return {
    id: createId(),
    type: "component" as const,
    name: "Generate Draft",
    componentKey: "generate-draft-action",
    componentRequirementId: createId(),
    styleOverrides: [],
    transform: { x: 0, y: 0, width: 200, height: 60, rotationDeg: 0, scaleX: 1, scaleY: 1 },
    opacity: 1,
    visible: true,
    locked: false,
    zIndex: 0,
    responsive: [],
    interactionStates: [],
  };
}

describe("Condition schema extensions", () => {
  it("accepts a compare condition against every runtime variable value type", () => {
    expect(ConditionSchema.safeParse({ type: "compare", variable: { kind: "progressPercent" }, operator: "gte", value: 50 }).success).toBe(true);
    expect(ConditionSchema.safeParse({ type: "compare", variable: { kind: "eventStatus" }, operator: "eq", value: "active" }).success).toBe(true);
    expect(ConditionSchema.safeParse({ type: "compare", variable: { kind: "optedIn" }, operator: "eq", value: true }).success).toBe(true);
  });

  it("accepts an inclusive numeric inRange condition", () => {
    const result = ConditionSchema.safeParse({ type: "inRange", variable: { kind: "watchedCount" }, min: 0, max: 10 });
    expect(result.success).toBe(true);
  });

  it("accepts a boolean condition over an interaction flag, with or without an explicit layerId", () => {
    expect(ConditionSchema.safeParse({ type: "boolean", variable: { kind: "interactionFlag", which: "hover" }, equals: true }).success).toBe(true);
    expect(ConditionSchema.safeParse({ type: "boolean", variable: { kind: "interactionFlag", which: "hover", layerId: createId() }, equals: true }).success).toBe(true);
  });

  it("nests compare/inRange/boolean inside and/or/not just like the original node types", () => {
    const nested = {
      type: "and",
      conditions: [
        { type: "compare", variable: { kind: "progressPercent" }, operator: "gte", value: 25 },
        { type: "not", condition: { type: "boolean", variable: { kind: "eventCompleted" }, equals: true } },
      ],
    };
    expect(ConditionSchema.safeParse(nested).success).toBe(true);
  });

  it("rejects an unknown variable kind", () => {
    expect(ConditionSchema.safeParse({ type: "boolean", variable: { kind: "profileEmail" }, equals: true }).success).toBe(false);
  });
});

describe("ComponentLayer copyVariants", () => {
  it("accepts named variants with stable ids per slot key", () => {
    const variantId = createId();
    const layer = { ...baseComponentLayer(), copyVariants: { headline: [{ id: variantId, text: "Almost there!" }] } };
    const result = ComponentLayerSchema.safeParse(layer);
    expect(result.success).toBe(true);
  });

  it("keeps copyOverrides and copyVariants independent", () => {
    const layer = { ...baseComponentLayer(), copyOverrides: { headline: "Default wording" }, copyVariants: { headline: [{ id: createId(), text: "Variant wording" }] } };
    const result = ComponentLayerSchema.safeParse(layer);
    expect(result.success).toBe(true);
  });
});

describe("BehaviourRule schema", () => {
  it("accepts a minimal whileTrue rule with a single action", () => {
    const rule = {
      id: createId(),
      name: "Show CTA once opted in",
      trigger: { type: "whileTrue" },
      condition: { type: "boolean", variable: { kind: "optedIn" }, equals: true },
      actions: [{ type: "show", layerId: createId() }],
    };
    const result = BehaviourRuleSchema.safeParse(rule);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.enabled).toBe(true);
      expect(result.data.priority).toBe(0);
    }
  });

  it("defaults condition to always when omitted", () => {
    const rule = { id: createId(), name: "Always-on rule", trigger: { type: "pageEnter", pageId: createId() }, actions: [{ type: "startAnimation", animationId: createId() }] };
    const result = BehaviourRuleSchema.safeParse(rule);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.condition).toEqual({ type: "always" });
  });

  it("accepts every documented action type", () => {
    const ids = { layer: createId(), stateGroup: createId(), state: createId(), req: createId(), anim: createId(), popup: createId(), page: createId(), variant: createId() };
    const actions = [
      { type: "show", layerId: ids.layer },
      { type: "hide", layerId: ids.layer },
      { type: "setEnabled", layerId: ids.layer, enabled: false },
      { type: "setImageState", stateGroupId: ids.stateGroup, stateId: ids.state },
      { type: "applyStyleOverride", layerId: ids.layer, componentRequirementId: ids.req, property: "opacity", value: 0.5 },
      { type: "startAnimation", animationId: ids.anim },
      { type: "stopAnimation", animationId: ids.anim },
      { type: "restartAnimation", animationId: ids.anim },
      { type: "openPopup", popupId: ids.popup },
      { type: "closePopup", popupId: ids.popup },
      { type: "navigateToPage", pageId: ids.page },
      { type: "selectCopyVariant", layerId: ids.layer, slotKey: "headline", variantId: ids.variant },
    ];
    for (const action of actions) {
      const rule = { id: createId(), name: "n", trigger: { type: "whileTrue" }, actions: [action] };
      expect(BehaviourRuleSchema.safeParse(rule).success, JSON.stringify(action)).toBe(true);
    }
  });

  it("rejects a rule with zero actions", () => {
    const rule = { id: createId(), name: "n", trigger: { type: "whileTrue" }, actions: [] };
    expect(BehaviourRuleSchema.safeParse(rule).success).toBe(false);
  });

  it("rejects an unsafe escape-hatch shape like a raw script action", () => {
    const rule = { id: createId(), name: "n", trigger: { type: "whileTrue" }, actions: [{ type: "runScript", code: "alert(1)" }] };
    expect(BehaviourRuleSchema.safeParse(rule).success).toBe(false);
  });

  it("accepts every lifecycle and interaction trigger", () => {
    const layerId = createId();
    const pageId = createId();
    const popupId = createId();
    const triggers = [
      { type: "pageEnter", pageId },
      { type: "pageExit", pageId },
      { type: "popupOpen", popupId },
      { type: "popupClose", popupId },
      { type: "click", layerId },
      { type: "hoverStart", layerId },
      { type: "hoverEnd", layerId },
      { type: "focus", layerId },
      { type: "blur", layerId },
      { type: "eventPhaseChange", toPhase: "active" },
      { type: "conditionBecomesTrue", condition: { type: "boolean", variable: { kind: "draftGenerated" }, equals: true } },
    ];
    for (const trigger of triggers) {
      const rule = { id: createId(), name: "n", trigger, actions: [{ type: "show", layerId }] };
      expect(BehaviourRuleSchema.safeParse(rule).success, JSON.stringify(trigger)).toBe(true);
    }
  });
});
