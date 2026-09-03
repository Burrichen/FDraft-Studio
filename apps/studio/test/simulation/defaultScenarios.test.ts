// @vitest-environment node
import { describe, expect, it } from "vitest";
import { SimulationScenarioSchema } from "@fdraft/theme-sdk";
import { DEFAULT_SIMULATION_SCENARIOS } from "../../src/simulation/defaultScenarios.js";

describe("DEFAULT_SIMULATION_SCENARIOS", () => {
  it("is schema-valid", () => {
    for (const scenario of DEFAULT_SIMULATION_SCENARIOS) {
      const result = SimulationScenarioSchema.safeParse(scenario);
      expect(result.success, `${scenario.name}: ${JSON.stringify(result.success ? null : result.error.issues)}`).toBe(true);
    }
  });

  it("has unique, fixed ids (never regenerated)", () => {
    const ids = DEFAULT_SIMULATION_SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has a unique, non-empty name per scenario", () => {
    const names = DEFAULT_SIMULATION_SCENARIOS.map((s) => s.name);
    expect(names.every((n) => n.length > 0)).toBe(true);
    expect(new Set(names).size).toBe(names.length);
  });

  it("covers every documented representative data profile", () => {
    const profiles = new Set(DEFAULT_SIMULATION_SCENARIOS.map((s) => s.dataProfile));
    for (const expected of ["normal", "empty", "loading", "error", "longTitle", "maxFilmCards"]) {
      expect(profiles.has(expected as never), expected).toBe(true);
    }
  });
});
