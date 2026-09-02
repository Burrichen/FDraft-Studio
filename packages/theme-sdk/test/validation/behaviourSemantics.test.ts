import { describe, expect, it } from "vitest";
import { createId } from "../../src/ids.js";
import { createEmptyProject } from "../../src/schema/project.js";
import type { StudioProjectDocument } from "../../src/schema/project.js";
import type { ComponentLayer } from "../../src/schema/layers.js";
import type { BehaviourRule } from "../../src/schema/behaviour.js";
import { checkBehaviourRules } from "../../src/validation/behaviourSemantics.js";
import { checkSemantics } from "../../src/validation/semantic.js";

function project(): StudioProjectDocument {
  return createEmptyProject({ id: createId(), name: "Test" });
}

function componentLayer(overrides: Partial<ComponentLayer> = {}): ComponentLayer {
  return {
    id: createId(),
    type: "component",
    name: "CTA",
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
    ...overrides,
  };
}

function rule(overrides: Partial<BehaviourRule>): BehaviourRule {
  return {
    id: createId(),
    name: "Test rule",
    enabled: true,
    priority: 0,
    trigger: { type: "whileTrue" },
    condition: { type: "always" },
    actions: [{ type: "show", layerId: createId() }],
    ...overrides,
  };
}

describe("checkBehaviourRules", () => {
  it("reports no issues for a well-formed rule referencing real ids", () => {
    const layerId = createId();
    const pageId = createId();
    const p = { ...project(), pages: [{ id: pageId, name: "Home", slug: "home", layers: [componentLayer({ id: layerId })], animations: [] }] };
    const behaviourRules = [rule({ trigger: { type: "pageEnter", pageId }, actions: [{ type: "show", layerId }] })];
    expect(checkBehaviourRules({ ...p, behaviourRules })).toEqual([]);
  });

  it("flags a trigger referencing a page that does not exist", () => {
    const p = project();
    const behaviourRules = [rule({ trigger: { type: "pageEnter", pageId: "missing-page" } })];
    const issues = checkBehaviourRules({ ...p, behaviourRules });
    expect(issues).toContainEqual(expect.objectContaining({ code: "BROKEN_REFERENCE", path: "behaviourRules[0].trigger.pageId" }));
  });

  it("flags an action referencing a layer that does not exist", () => {
    const p = project();
    const behaviourRules = [rule({ actions: [{ type: "hide", layerId: "missing-layer" }] })];
    const issues = checkBehaviourRules({ ...p, behaviourRules });
    expect(issues).toContainEqual(expect.objectContaining({ code: "BROKEN_REFERENCE", path: "behaviourRules[0].actions[0].layerId" }));
  });

  it("flags a broken selectCopyVariant reference when the variant id does not exist on the layer", () => {
    const layerId = createId();
    const p = { ...project(), pages: [{ id: createId(), name: "Home", slug: "home", layers: [componentLayer({ id: layerId, copyVariants: { headline: [{ id: "real-variant", text: "Hi" }] } })], animations: [] }] };
    const behaviourRules = [rule({ actions: [{ type: "selectCopyVariant", layerId, slotKey: "headline", variantId: "missing-variant" }] })];
    const issues = checkBehaviourRules({ ...p, behaviourRules });
    expect(issues).toContainEqual(expect.objectContaining({ code: "BROKEN_REFERENCE", path: "behaviourRules[0].actions[0].variantId" }));
  });

  it("flags an interactionFlag condition whose explicit layerId does not exist", () => {
    const p = project();
    const behaviourRules = [rule({ condition: { type: "boolean", variable: { kind: "interactionFlag", which: "hover", layerId: "missing-layer" }, equals: true } })];
    const issues = checkBehaviourRules({ ...p, behaviourRules });
    expect(issues).toContainEqual(expect.objectContaining({ code: "BROKEN_REFERENCE", path: "behaviourRules[0].condition.variable.layerId" }));
  });

  it("does not flag an ambient interactionFlag condition with no explicit layerId", () => {
    const layerId = createId();
    const p = { ...project(), pages: [{ id: createId(), name: "Home", slug: "home", layers: [componentLayer({ id: layerId })], animations: [] }] };
    const behaviourRules = [rule({ condition: { type: "boolean", variable: { kind: "interactionFlag", which: "hover" }, equals: true }, actions: [{ type: "show", layerId }] })];
    expect(checkBehaviourRules({ ...p, behaviourRules })).toEqual([]);
  });

  it("flags a type mismatch comparing a string variable with a numeric value", () => {
    const p = project();
    const behaviourRules = [rule({ condition: { type: "compare", variable: { kind: "eventStatus" }, operator: "eq", value: 5 } })];
    const issues = checkBehaviourRules({ ...p, behaviourRules });
    expect(issues).toContainEqual(expect.objectContaining({ code: "BEHAVIOUR_TYPE_MISMATCH" }));
  });

  it("flags a type mismatch using a numeric comparison operator on a boolean variable", () => {
    const p = project();
    const behaviourRules = [rule({ condition: { type: "compare", variable: { kind: "optedIn" }, operator: "gt", value: true } })];
    const issues = checkBehaviourRules({ ...p, behaviourRules });
    expect(issues).toContainEqual(expect.objectContaining({ code: "BEHAVIOUR_TYPE_MISMATCH", path: "behaviourRules[0].condition.operator" }));
  });

  it("flags inRange used on a non-numeric variable", () => {
    const p = project();
    const behaviourRules = [rule({ condition: { type: "inRange", variable: { kind: "eventActive" }, min: 0, max: 1 } })];
    const issues = checkBehaviourRules({ ...p, behaviourRules });
    expect(issues).toContainEqual(expect.objectContaining({ code: "BEHAVIOUR_TYPE_MISMATCH" }));
  });

  it("does not flag a correctly-typed nested and/or/not condition tree", () => {
    const layerId = createId();
    const p = { ...project(), pages: [{ id: createId(), name: "Home", slug: "home", layers: [componentLayer({ id: layerId })], animations: [] }] };
    const behaviourRules = [
      rule({
        condition: {
          type: "and",
          conditions: [
            { type: "inRange", variable: { kind: "progressPercent" }, min: 0, max: 100 },
            { type: "not", condition: { type: "boolean", variable: { kind: "eventCompleted" }, equals: true } },
          ],
        },
        actions: [{ type: "show", layerId }],
      }),
    ];
    expect(checkBehaviourRules({ ...p, behaviourRules })).toEqual([]);
  });

  it("flags hiding a required component as an unsafe action", () => {
    const reqId = createId();
    const layerId = createId();
    const p = {
      ...project(),
      componentRequirements: [{ id: reqId, componentKey: "generate-draft-action", required: true, allowedProperties: [] }],
      pages: [{ id: createId(), name: "Home", slug: "home", layers: [componentLayer({ id: layerId, componentRequirementId: reqId })], animations: [] }],
    };
    const behaviourRules = [rule({ actions: [{ type: "hide", layerId }] })];
    const issues = checkBehaviourRules({ ...p, behaviourRules });
    expect(issues).toContainEqual(expect.objectContaining({ code: "BEHAVIOUR_UNSAFE_ACTION" }));
  });

  it("flags disabling a required component as an unsafe action", () => {
    const reqId = createId();
    const layerId = createId();
    const p = {
      ...project(),
      componentRequirements: [{ id: reqId, componentKey: "generate-draft-action", required: true, allowedProperties: [] }],
      pages: [{ id: createId(), name: "Home", slug: "home", layers: [componentLayer({ id: layerId, componentRequirementId: reqId })], animations: [] }],
    };
    const behaviourRules = [rule({ actions: [{ type: "setEnabled", layerId, enabled: false }] })];
    const issues = checkBehaviourRules({ ...p, behaviourRules });
    expect(issues).toContainEqual(expect.objectContaining({ code: "BEHAVIOUR_UNSAFE_ACTION" }));
  });

  it("does not flag hiding a non-required component", () => {
    const reqId = createId();
    const layerId = createId();
    const p = {
      ...project(),
      componentRequirements: [{ id: reqId, componentKey: "decorative-widget", required: false, allowedProperties: [] }],
      pages: [{ id: createId(), name: "Home", slug: "home", layers: [componentLayer({ id: layerId, componentRequirementId: reqId })], animations: [] }],
    };
    const behaviourRules = [rule({ actions: [{ type: "hide", layerId }] })];
    expect(checkBehaviourRules({ ...p, behaviourRules })).toEqual([]);
  });

  it("flags a disallowed style property in applyStyleOverride", () => {
    const reqId = createId();
    const layerId = createId();
    const p = {
      ...project(),
      componentRequirements: [{ id: reqId, componentKey: "generate-draft-action", required: false, allowedProperties: ["color"] as const }],
      pages: [{ id: createId(), name: "Home", slug: "home", layers: [componentLayer({ id: layerId, componentRequirementId: reqId })], animations: [] }],
    };
    const behaviourRules = [rule({ actions: [{ type: "applyStyleOverride", layerId, componentRequirementId: reqId, property: "boxShadow", value: "none" }] })];
    const issues = checkBehaviourRules({ ...p, behaviourRules });
    expect(issues).toContainEqual(expect.objectContaining({ code: "DISALLOWED_STYLE_PROPERTY" }));
  });

  it("detects a self-trigger loop where a rule reads and writes the same image-state group", () => {
    const stateGroupId = createId();
    const stateA = createId();
    const stateB = createId();
    const p = { ...project(), imageStateGroups: [{ id: stateGroupId, name: "Candy Bowl", states: [{ id: stateA, name: "Empty", assetId: createId() }, { id: stateB, name: "Full", assetId: createId() }], defaultStateId: stateA }] };
    const behaviourRules = [
      rule({
        condition: { type: "stateEquals", stateGroupId, stateId: stateA },
        actions: [{ type: "setImageState", stateGroupId, stateId: stateB }],
      }),
    ];
    const issues = checkBehaviourRules({ ...p, behaviourRules });
    expect(issues).toContainEqual(expect.objectContaining({ code: "BEHAVIOUR_SELF_TRIGGER_LOOP" }));
  });

  it("does not flag two different rules that read and write different state groups", () => {
    const groupA = createId();
    const groupB = createId();
    const stateA1 = createId();
    const stateB1 = createId();
    const p = {
      ...project(),
      imageStateGroups: [
        { id: groupA, name: "A", states: [{ id: stateA1, name: "s", assetId: createId() }], defaultStateId: stateA1 },
        { id: groupB, name: "B", states: [{ id: stateB1, name: "s", assetId: createId() }], defaultStateId: stateB1 },
      ],
    };
    const behaviourRules = [rule({ condition: { type: "stateEquals", stateGroupId: groupA, stateId: stateA1 }, actions: [{ type: "setImageState", stateGroupId: groupB, stateId: stateB1 }] })];
    expect(checkBehaviourRules({ ...p, behaviourRules })).toEqual([]);
  });
});

describe("checkSemantics integration", () => {
  it("flags duplicate behaviourRule ids via the shared DUPLICATE_ID check", () => {
    const sharedId = createId();
    const p = { ...project(), behaviourRules: [rule({ id: sharedId }), rule({ id: sharedId })] };
    const issues = checkSemantics(p);
    expect(issues.some((i) => i.code === "DUPLICATE_ID" && i.message.includes(sharedId))).toBe(true);
  });

  it("runs checkBehaviourRules as part of the full checkSemantics pass", () => {
    const p = { ...project(), behaviourRules: [rule({ trigger: { type: "pageEnter", pageId: "missing" } })] };
    const issues = checkSemantics(p);
    expect(issues.some((i) => i.code === "BROKEN_REFERENCE" && i.path === "behaviourRules[0].trigger.pageId")).toBe(true);
  });
});
