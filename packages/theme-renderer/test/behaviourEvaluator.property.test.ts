import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { BehaviourRule, Condition } from "@fdraft/theme-sdk";
import { evaluateCondition } from "../src/conditions.js";
import { resolveActiveBehaviourRules } from "../src/behaviourResolve.js";
import type { RenderState } from "../src/types.js";

/**
 * Property-based tests over generated `Condition`/`RenderState`/
 * `BehaviourRule[]` shapes, not hand-picked fixtures — the invariant under
 * test is the evaluator's own documented safety contract: a missing or
 * undisclosed variable value never throws, it simply makes a comparison
 * false, and `resolveActiveBehaviourRules` is a single non-recursive walk
 * that cannot loop or throw regardless of what a theme declares. This
 * complements (doesn't replace) the example-based tests in
 * `conditions.test.ts`/`behaviourResolve.test.ts`.
 */
const idArb = fc.uuid();

const leafConditionArb: fc.Arbitrary<Condition> = fc.oneof(
  fc.constant({ type: "always" as const }),
  fc.record({ type: fc.constant("eventPhase" as const), phase: fc.string({ minLength: 1, maxLength: 20 }) }),
  fc.record({ type: fc.constant("stateEquals" as const), stateGroupId: idArb, stateId: idArb }),
  fc.record({
    type: fc.constant("compare" as const),
    variable: fc.record({ kind: fc.constant("progressPercent" as const) }),
    operator: fc.constantFrom("eq", "neq", "gt", "gte", "lt", "lte"),
    value: fc.double({ min: -1000, max: 1000, noNaN: true }),
  }),
  fc.record({
    type: fc.constant("inRange" as const),
    variable: fc.record({ kind: fc.constant("watchedCount" as const) }),
    min: fc.integer({ min: -100, max: 100 }),
    max: fc.integer({ min: -100, max: 100 }),
  }),
  fc.record({
    type: fc.constant("boolean" as const),
    variable: fc.oneof(
      fc.record({ kind: fc.constant("draftGenerated" as const) }),
      fc.record({ kind: fc.constant("interactionFlag" as const), which: fc.constantFrom("hover", "focus", "pressed", "selected"), layerId: fc.option(idArb, { nil: undefined }) }),
    ),
    equals: fc.boolean(),
  }),
);

// One level of and/or/not nesting on top of the leaves, still bounded (no unbounded recursion needed to exercise the evaluator's tree-walking).
const conditionArb: fc.Arbitrary<Condition> = fc.oneof(
  leafConditionArb,
  fc.record({ type: fc.constant("and" as const), conditions: fc.array(leafConditionArb, { minLength: 1, maxLength: 3 }) }),
  fc.record({ type: fc.constant("or" as const), conditions: fc.array(leafConditionArb, { minLength: 1, maxLength: 3 }) }),
  fc.record({ type: fc.constant("not" as const), condition: leafConditionArb }),
);

const renderStateArb: fc.Arbitrary<RenderState> = fc.record({
  activeImageStates: fc.constant({}),
  eventPhase: fc.option(fc.string({ maxLength: 20 }), { nil: undefined }),
  currentPageId: fc.option(idArb, { nil: undefined }),
  currentPopupId: fc.option(idArb, { nil: undefined }),
  event: fc.option(
    fc.record({
      eventActive: fc.boolean(),
      eventAvailable: fc.boolean(),
      optedIn: fc.boolean(),
      draftGenerated: fc.boolean(),
      progressPercent: fc.double({ min: 0, max: 100, noNaN: true }),
      watchedCount: fc.nat(50),
      targetCount: fc.nat(50),
      eventCompleted: fc.boolean(),
    }),
    { nil: undefined },
  ),
  interactionFlags: fc.constant({}),
});

describe("evaluateCondition (property-based)", () => {
  it("never throws and always returns a boolean, for any generated condition against any generated (possibly sparse) render state", () => {
    fc.assert(
      fc.property(conditionArb, renderStateArb, (condition, state) => {
        const result = evaluateCondition(condition, state);
        expect(typeof result).toBe("boolean");
      }),
    );
  });

  it("never throws even against a completely empty render state (every variable undisclosed)", () => {
    fc.assert(
      fc.property(conditionArb, (condition) => {
        expect(() => evaluateCondition(condition, { activeImageStates: {} })).not.toThrow();
      }),
    );
  });
});

const actionArb = fc.oneof(
  fc.record({ type: fc.constant("show" as const), layerId: idArb }),
  fc.record({ type: fc.constant("hide" as const), layerId: idArb }),
  fc.record({ type: fc.constant("setImageState" as const), stateGroupId: idArb, stateId: idArb }),
);

const ruleArb: fc.Arbitrary<BehaviourRule> = fc.record({
  id: idArb,
  name: fc.string({ minLength: 1, maxLength: 30 }),
  enabled: fc.boolean(),
  priority: fc.integer({ min: -50, max: 50 }),
  trigger: fc.constant({ type: "whileTrue" as const }),
  condition: conditionArb,
  actions: fc.array(actionArb, { minLength: 1, maxLength: 3 }),
});

describe("resolveActiveBehaviourRules (property-based)", () => {
  it("never throws for any generated rule set, including rules that contest the same target", () => {
    fc.assert(
      fc.property(fc.array(ruleArb, { minLength: 0, maxLength: 15 }), renderStateArb, (rules, state) => {
        expect(() => resolveActiveBehaviourRules(rules, state)).not.toThrow();
      }),
    );
  });

  it("always returns a well-formed BehaviourResolution shape, and every trace entry names a real candidate rule", () => {
    fc.assert(
      fc.property(fc.array(ruleArb, { minLength: 0, maxLength: 15 }), renderStateArb, (rules, state) => {
        const resolution = resolveActiveBehaviourRules(rules, state);
        expect(Array.isArray(resolution.trace)).toBe(true);
        const ruleIds = new Set(rules.map((r) => r.id));
        for (const entry of resolution.trace) {
          for (const candidate of entry.candidates) {
            expect(ruleIds.has(candidate.ruleId)).toBe(true);
          }
        }
      }),
    );
  });

  it("a disabled rule never wins any contested target", () => {
    fc.assert(
      fc.property(fc.array(ruleArb, { minLength: 1, maxLength: 15 }), renderStateArb, (rules, state) => {
        const disabled = rules.map((r) => ({ ...r, enabled: false }));
        const resolution = resolveActiveBehaviourRules(disabled, state);
        expect(Object.keys(resolution.visibilityOverrides)).toHaveLength(0);
        expect(Object.keys(resolution.imageStateOverrides)).toHaveLength(0);
      }),
    );
  });
});
