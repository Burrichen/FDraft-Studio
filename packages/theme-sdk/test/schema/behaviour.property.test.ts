import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { BehaviourRuleSchema } from "../../src/schema/behaviour.js";

/** Property-based tests over a real slice of the trigger/condition/action variety, complementing the fixed examples in behaviour.test.ts. */
const idArb = fc.uuid();

const triggerArb = fc.oneof(
  fc.record({ type: fc.constant("whileTrue") }),
  fc.record({ type: fc.constant("pageEnter"), pageId: idArb }),
  fc.record({ type: fc.constant("popupOpen"), popupId: idArb }),
  fc.record({ type: fc.constant("click"), layerId: idArb }),
  fc.record({ type: fc.constant("eventPhaseChange"), toPhase: fc.string({ minLength: 1, maxLength: 20 }) }),
);

const conditionArb = fc.oneof(
  fc.record({ type: fc.constant("always") }),
  fc.record({ type: fc.constant("boolean"), variable: fc.record({ kind: fc.constant("draftGenerated") }), equals: fc.boolean() }),
  fc.record({
    type: fc.constant("compare"),
    variable: fc.record({ kind: fc.constant("progressPercent") }),
    operator: fc.constantFrom("eq", "neq", "gt", "gte", "lt", "lte"),
    value: fc.double({ min: 0, max: 100, noNaN: true }),
  }),
);

const actionArb = fc.oneof(
  fc.record({ type: fc.constant("show"), layerId: idArb }),
  fc.record({ type: fc.constant("hide"), layerId: idArb }),
  fc.record({ type: fc.constant("setEnabled"), layerId: idArb, enabled: fc.boolean() }),
  fc.record({ type: fc.constant("startAnimation"), animationId: idArb }),
);

const ruleArb = fc.record({
  id: idArb,
  name: fc.string({ minLength: 1, maxLength: 40 }),
  enabled: fc.boolean(),
  priority: fc.integer({ min: -100, max: 100 }),
  trigger: triggerArb,
  condition: conditionArb,
  actions: fc.array(actionArb, { minLength: 1, maxLength: 5 }),
});

describe("BehaviourRuleSchema (property-based)", () => {
  it("accepts every generated trigger/condition/action combination", () => {
    fc.assert(
      fc.property(ruleArb, (candidate) => {
        const result = BehaviourRuleSchema.safeParse(candidate);
        expect(result.success, JSON.stringify(result.success ? null : result.error?.issues)).toBe(true);
      }),
    );
  });

  it("round-trips through JSON without changing the parsed value", () => {
    fc.assert(
      fc.property(ruleArb, (candidate) => {
        const parsed = BehaviourRuleSchema.parse(candidate);
        const roundTripped = BehaviourRuleSchema.parse(JSON.parse(JSON.stringify(parsed)) as unknown);
        expect(roundTripped).toEqual(parsed);
      }),
    );
  });

  it("always rejects a rule with an empty actions array, regardless of trigger/condition", () => {
    fc.assert(
      fc.property(ruleArb, (candidate) => {
        expect(BehaviourRuleSchema.safeParse({ ...candidate, actions: [] }).success).toBe(false);
      }),
    );
  });
});
