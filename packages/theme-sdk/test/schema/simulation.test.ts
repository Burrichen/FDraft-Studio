import { describe, expect, it } from "vitest";
import { createId } from "../../src/ids.js";
import { SimulationScenarioSchema } from "../../src/schema/simulation.js";
import { StudioProjectDocumentSchema, createEmptyProject } from "../../src/schema/project.js";

function baseScenario() {
  return {
    id: createId(),
    name: "Active, halfway through",
    eventStatus: "active",
    eventActive: true,
    eventAvailable: true,
    optedIn: true,
    draftGenerated: false,
    eventCompleted: false,
    progressPercent: 50,
    watchedCount: 5,
    targetCount: 10,
    performanceTier: "high" as const,
    reducedMotion: false,
  };
}

describe("SimulationScenario schema", () => {
  it("accepts a minimal scenario and defaults dataProfile to normal", () => {
    const result = SimulationScenarioSchema.safeParse(baseScenario());
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.dataProfile).toBe("normal");
  });

  it("accepts every documented dataProfile value", () => {
    for (const dataProfile of ["normal", "empty", "loading", "error", "longTitle", "maxFilmCards"]) {
      const result = SimulationScenarioSchema.safeParse({ ...baseScenario(), dataProfile });
      expect(result.success, dataProfile).toBe(true);
    }
  });

  it("rejects an unknown dataProfile value", () => {
    expect(SimulationScenarioSchema.safeParse({ ...baseScenario(), dataProfile: "huge" }).success).toBe(false);
  });

  it("accepts optional currentPageId/currentPopupId, dateTimeOverrideMs, and placeholderValues", () => {
    const scenario = {
      ...baseScenario(),
      currentPageId: createId(),
      dateTimeOverrideMs: Date.parse("2026-10-31T18:00:00Z"),
      placeholderValues: { eventName: "Halloween Watch Party" },
    };
    expect(SimulationScenarioSchema.safeParse(scenario).success).toBe(true);
  });

  it("rejects progressPercent outside 0-100", () => {
    expect(SimulationScenarioSchema.safeParse({ ...baseScenario(), progressPercent: 150 }).success).toBe(false);
    expect(SimulationScenarioSchema.safeParse({ ...baseScenario(), progressPercent: -1 }).success).toBe(false);
  });

  it("rejects a negative watchedCount/targetCount", () => {
    expect(SimulationScenarioSchema.safeParse({ ...baseScenario(), watchedCount: -1 }).success).toBe(false);
    expect(SimulationScenarioSchema.safeParse({ ...baseScenario(), targetCount: -1 }).success).toBe(false);
  });

  it("rejects an unsafe escape-hatch field like a raw script/expression", () => {
    expect(SimulationScenarioSchema.safeParse({ ...baseScenario(), script: "alert(1)" }).success).toBe(false);
  });
});

describe("StudioProjectDocument.simulationScenarios", () => {
  it("defaults to an empty array when absent, same as behaviourRules/assetFolders", () => {
    const project = createEmptyProject({ id: createId(), name: "Untitled" });
    const { simulationScenarios: _omitted, ...withoutScenarios } = project;
    const result = StudioProjectDocumentSchema.safeParse(withoutScenarios);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.simulationScenarios).toEqual([]);
  });

  it("round-trips a saved scenario through the full project schema", () => {
    const project = { ...createEmptyProject({ id: createId(), name: "Untitled" }), simulationScenarios: [baseScenario()] };
    const result = StudioProjectDocumentSchema.safeParse(project);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.simulationScenarios).toHaveLength(1);
  });
});
