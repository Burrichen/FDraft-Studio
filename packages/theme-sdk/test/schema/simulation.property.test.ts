import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SimulationScenarioSchema } from "../../src/schema/simulation.js";

/**
 * Property-based tests, not example-based — `fc.assert` runs the property
 * against many generated inputs (default: 100 per run), rather than a
 * handful of hand-picked fixtures. Complements (doesn't replace) the
 * example-based tests in `simulation.test.ts`.
 */
const scenarioArb = fc.record(
  {
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    description: fc.string({ maxLength: 100 }),
    eventStatus: fc.string({ minLength: 1, maxLength: 20 }),
    eventActive: fc.boolean(),
    eventAvailable: fc.boolean(),
    optedIn: fc.boolean(),
    draftGenerated: fc.boolean(),
    eventCompleted: fc.boolean(),
    progressPercent: fc.double({ min: 0, max: 100, noNaN: true }),
    watchedCount: fc.nat(1000),
    targetCount: fc.nat(1000),
    performanceTier: fc.constantFrom("low", "medium", "high"),
    reducedMotion: fc.boolean(),
    currentPageId: fc.uuid(),
    currentPopupId: fc.uuid(),
    dateTimeOverrideMs: fc.integer(),
    placeholderValues: fc.dictionary(fc.string({ minLength: 1, maxLength: 10 }), fc.string({ maxLength: 20 })),
    dataProfile: fc.constantFrom("normal", "empty", "loading", "error", "longTitle", "maxFilmCards"),
  },
  {
    requiredKeys: [
      "id",
      "name",
      "eventStatus",
      "eventActive",
      "eventAvailable",
      "optedIn",
      "draftGenerated",
      "eventCompleted",
      "progressPercent",
      "watchedCount",
      "targetCount",
      "performanceTier",
      "reducedMotion",
      "dataProfile",
    ],
  },
);

describe("SimulationScenarioSchema (property-based)", () => {
  it("accepts every schema-shaped generated value", () => {
    fc.assert(
      fc.property(scenarioArb, (candidate) => {
        expect(SimulationScenarioSchema.safeParse(candidate).success).toBe(true);
      }),
    );
  });

  it("round-trips through JSON without changing the parsed value", () => {
    fc.assert(
      fc.property(scenarioArb, (candidate) => {
        const parsed = SimulationScenarioSchema.parse(candidate);
        const roundTripped = SimulationScenarioSchema.parse(JSON.parse(JSON.stringify(parsed)) as unknown);
        expect(roundTripped).toEqual(parsed);
      }),
    );
  });

  it("always rejects a progressPercent outside the closed 0-100 range", () => {
    fc.assert(
      fc.property(scenarioArb, fc.double({ min: 100.0001, max: 1_000_000, noNaN: true }), (candidate, outOfRange) => {
        expect(SimulationScenarioSchema.safeParse({ ...candidate, progressPercent: outOfRange }).success).toBe(false);
      }),
    );
  });

  it("always rejects an unknown dataProfile value", () => {
    fc.assert(
      fc.property(
        scenarioArb,
        fc.string({ minLength: 1 }).filter((s) => !["normal", "empty", "loading", "error", "longTitle", "maxFilmCards"].includes(s)),
        (candidate, badProfile) => {
          expect(SimulationScenarioSchema.safeParse({ ...candidate, dataProfile: badProfile }).success).toBe(false);
        },
      ),
    );
  });
});
