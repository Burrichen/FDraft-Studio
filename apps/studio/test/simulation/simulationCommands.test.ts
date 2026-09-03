// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createId, createProject } from "@fdraft/theme-sdk";
import type { SimulationScenario, StudioProjectDocument } from "@fdraft/theme-sdk";
import {
  createScenarioFromState,
  buildAddSimulationScenarioCommand,
  buildDuplicateSimulationScenarioCommand,
  buildDeleteSimulationScenarioCommand,
  buildRenameSimulationScenarioCommand,
  buildUpdateSimulationScenarioCommand,
} from "../../src/simulation/simulationCommands.js";

function baseState(): Omit<SimulationScenario, "id" | "name"> {
  return {
    eventStatus: "active",
    eventActive: true,
    eventAvailable: true,
    optedIn: true,
    draftGenerated: false,
    eventCompleted: false,
    progressPercent: 25,
    watchedCount: 2,
    targetCount: 10,
    performanceTier: "high",
    reducedMotion: false,
    dataProfile: "normal",
  };
}

function emptyProject(): StudioProjectDocument {
  return createProject({ id: createId(), name: "Test" });
}

describe("createScenarioFromState", () => {
  it("builds a schema-valid scenario with a fresh id from the given name and state", () => {
    const scenario = createScenarioFromState("My scenario", baseState());
    expect(scenario.name).toBe("My scenario");
    expect(scenario.id).toBeTruthy();
    expect(scenario.progressPercent).toBe(25);
  });
});

describe("simulationScenario commands", () => {
  it("adds and undoes a scenario", () => {
    const project = emptyProject();
    const scenario = createScenarioFromState("Scenario A", baseState());
    const command = buildAddSimulationScenarioCommand(scenario);
    const after = command.do(project);
    expect(after.simulationScenarios).toEqual([scenario]);
    expect(command.undo(after).simulationScenarios).toEqual([]);
  });

  it("duplicates a scenario right after the original, with a fresh id, and undoes cleanly", () => {
    const project = emptyProject();
    const scenario = createScenarioFromState("Scenario A", baseState());
    const withScenario = { ...project, simulationScenarios: [scenario] };
    const command = buildDuplicateSimulationScenarioCommand(scenario.id);
    const after = command.do(withScenario);
    expect(after.simulationScenarios).toHaveLength(2);
    expect(after.simulationScenarios[1]!.id).not.toBe(scenario.id);
    expect(after.simulationScenarios[1]!.name).toBe("Scenario A copy");
    expect(command.undo(after).simulationScenarios).toEqual([scenario]);
  });

  it("deletes a scenario and restores it at the same index on undo", () => {
    const project = emptyProject();
    const a = createScenarioFromState("A", baseState());
    const b = createScenarioFromState("B", baseState());
    const withScenarios = { ...project, simulationScenarios: [a, b] };
    const command = buildDeleteSimulationScenarioCommand(a.id);
    const after = command.do(withScenarios);
    expect(after.simulationScenarios).toEqual([b]);
    expect(command.undo(after).simulationScenarios).toEqual([a, b]);
  });

  it("renames a scenario", () => {
    const project = emptyProject();
    const scenario = createScenarioFromState("Old name", baseState());
    const withScenario = { ...project, simulationScenarios: [scenario] };
    const command = buildRenameSimulationScenarioCommand(scenario.id, "New name");
    expect(command.do(withScenario).simulationScenarios[0]!.name).toBe("New name");
  });

  it("updates a saved scenario's values to match a new live state, keeping its id/name", () => {
    const project = emptyProject();
    const scenario = createScenarioFromState("Scenario A", baseState());
    const withScenario = { ...project, simulationScenarios: [scenario] };
    const command = buildUpdateSimulationScenarioCommand(scenario.id, { ...baseState(), progressPercent: 90 });
    const after = command.do(withScenario);
    expect(after.simulationScenarios[0]!.progressPercent).toBe(90);
    expect(after.simulationScenarios[0]!.id).toBe(scenario.id);
    expect(after.simulationScenarios[0]!.name).toBe("Scenario A");
  });
});
