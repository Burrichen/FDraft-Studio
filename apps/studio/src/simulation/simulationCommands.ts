import { createId } from "@fdraft/theme-sdk";
import type { Id, SimulationScenario, StudioProjectDocument } from "@fdraft/theme-sdk";
import type { Command } from "../history/commandStack.js";

function updateScenario(project: StudioProjectDocument, scenarioId: Id, update: (scenario: SimulationScenario) => SimulationScenario): StudioProjectDocument {
  return { ...project, simulationScenarios: project.simulationScenarios.map((s) => (s.id === scenarioId ? update(s) : s)) };
}

/** Builds a new, project-saved scenario from the Simulation panel's current live state, ready to hand to `buildAddSimulationScenarioCommand`. */
export function createScenarioFromState(name: string, state: Omit<SimulationScenario, "id" | "name">): SimulationScenario {
  return { id: createId(), name, ...state };
}

export function buildAddSimulationScenarioCommand(scenario: SimulationScenario): Command<StudioProjectDocument> {
  return {
    label: "Save scenario",
    do: (p) => ({ ...p, simulationScenarios: [...p.simulationScenarios, scenario] }),
    undo: (p) => ({ ...p, simulationScenarios: p.simulationScenarios.filter((s) => s.id !== scenario.id) }),
  };
}

export function buildDuplicateSimulationScenarioCommand(scenarioId: Id): Command<StudioProjectDocument> {
  const newId = createId();
  return {
    label: "Duplicate scenario",
    do: (p) => {
      const index = p.simulationScenarios.findIndex((s) => s.id === scenarioId);
      if (index === -1) return p;
      const original = p.simulationScenarios[index]!;
      const clone: SimulationScenario = { ...original, id: newId, name: `${original.name} copy` };
      const next = [...p.simulationScenarios];
      next.splice(index + 1, 0, clone);
      return { ...p, simulationScenarios: next };
    },
    undo: (p) => ({ ...p, simulationScenarios: p.simulationScenarios.filter((s) => s.id !== newId) }),
  };
}

export function buildDeleteSimulationScenarioCommand(scenarioId: Id): Command<StudioProjectDocument> {
  let removedIndex = -1;
  let removed: SimulationScenario | undefined;
  return {
    label: "Delete scenario",
    do: (p) => {
      removedIndex = p.simulationScenarios.findIndex((s) => s.id === scenarioId);
      removed = p.simulationScenarios[removedIndex];
      return { ...p, simulationScenarios: p.simulationScenarios.filter((s) => s.id !== scenarioId) };
    },
    undo: (p) => {
      if (!removed || removedIndex === -1) return p;
      const next = [...p.simulationScenarios];
      next.splice(removedIndex, 0, removed);
      return { ...p, simulationScenarios: next };
    },
  };
}

export function buildRenameSimulationScenarioCommand(scenarioId: Id, name: string): Command<StudioProjectDocument> {
  return {
    label: "Rename scenario",
    do: (p) => updateScenario(p, scenarioId, (s) => ({ ...s, name })),
    undo: (p) => p,
  };
}

/** Overwrites a saved scenario's values with the panel's current live state — "update this saved preset to match what I've got dialed in now." */
export function buildUpdateSimulationScenarioCommand(scenarioId: Id, state: Omit<SimulationScenario, "id" | "name">): Command<StudioProjectDocument> {
  return {
    label: "Update scenario",
    do: (p) => updateScenario(p, scenarioId, (s) => ({ ...s, ...state })),
    undo: (p) => p,
  };
}
