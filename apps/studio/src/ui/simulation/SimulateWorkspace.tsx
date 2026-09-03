import { useMemo, useState } from "react";
import { ThemeRenderer, resolveActiveBehaviourRules, type ComponentAdapterRegistry, type ComponentCopyContractRegistry, type AssetResolver, type LayerInteractionFlags } from "@fdraft/theme-renderer";
import type { Id, SimulationScenario } from "@fdraft/theme-sdk";
import { useAppContext } from "../../AppContext.js";
import { useProjectSessionState } from "../../project/useProjectSession.js";
import { buildBehaviourNameLookups } from "../../behaviour/describeBehaviourRule.js";
import { BehaviourTracePanel } from "../behaviour/BehaviourTracePanel.js";
import { DEFAULT_SIMULATION_LIVE_STATE, deriveHostSettings, deriveRenderState, scenarioToLiveState, type SimulationLiveState } from "../../simulation/simulationState.js";
import { DEFAULT_SIMULATION_SCENARIOS } from "../../simulation/defaultScenarios.js";
import {
  createScenarioFromState,
  buildAddSimulationScenarioCommand,
  buildDuplicateSimulationScenarioCommand,
  buildDeleteSimulationScenarioCommand,
  buildRenameSimulationScenarioCommand,
  buildUpdateSimulationScenarioCommand,
} from "../../simulation/simulationCommands.js";
import { SimulationPanel } from "./SimulationPanel.js";
import "../behaviour/behaviour.css";
import "./simulation-workspace.css";

export interface SimulateWorkspaceProps {
  resolver: AssetResolver;
  componentAdapters: ComponentAdapterRegistry;
  copyContracts: ComponentCopyContractRegistry;
}

const BUILT_IN_SCENARIO_IDS = new Set(DEFAULT_SIMULATION_SCENARIOS.map((s) => s.id));

/**
 * The dedicated Simulation panel: pick a built-in or saved scenario (or
 * dial in safe mock values by hand — never the real Windows clock or
 * FDraft profile/draft/points/watch data), see it rendered live through
 * the exact same `ThemeRenderer` FDraft uses, and see which Behaviour
 * rules are winning for that render state. A separate, project-wide
 * counterpart to Behaviour Mode's own embedded simulator (which stays
 * focused on rule-authoring) — both are built on the same
 * `SimulationPanel`/`simulationState` primitives so they can never drift
 * into offering different controls for the same thing.
 */
export function SimulateWorkspace({ resolver, componentAdapters, copyContracts }: SimulateWorkspaceProps): React.ReactNode {
  const { session } = useAppContext();
  const state = useProjectSessionState(session);
  const project = state.open!.project;

  const [sim, setSim] = useState<SimulationLiveState>(() => ({
    ...DEFAULT_SIMULATION_LIVE_STATE,
    currentPageId: project.pages[0]?.id,
    currentPopupId: project.pages[0] ? undefined : project.popups[0]?.id,
  }));
  const [activeScenarioId, setActiveScenarioId] = useState<Id | undefined>(undefined);
  const [interactionFlags, setInteractionFlags] = useState<Record<Id, LayerInteractionFlags>>({});

  const previewTarget: { kind: "page"; pageId: Id } | { kind: "popup"; popupId: Id } | undefined = sim.currentPageId
    ? { kind: "page", pageId: sim.currentPageId }
    : sim.currentPopupId
      ? { kind: "popup", popupId: sim.currentPopupId }
      : undefined;

  const scenarios = useMemo(() => [...DEFAULT_SIMULATION_SCENARIOS, ...project.simulationScenarios], [project.simulationScenarios]);
  const lookups = useMemo(() => buildBehaviourNameLookups(project), [project]);
  const hostSettings = useMemo(() => deriveHostSettings(sim), [sim]);
  const renderState = useMemo(() => deriveRenderState(sim, interactionFlags), [sim, interactionFlags]);
  const resolution = useMemo(() => resolveActiveBehaviourRules(project.behaviourRules, renderState, hostSettings), [project.behaviourRules, renderState, hostSettings]);

  function apply(command: Parameters<typeof session.applyCommand>[0]): void {
    session.applyCommand(command);
  }

  function handleApplyScenario(scenario: SimulationScenario): void {
    setSim(scenarioToLiveState(scenario));
    setActiveScenarioId(scenario.id);
  }

  function handleSaveAsNewScenario(): void {
    const scenario = createScenarioFromState(`Scenario ${project.simulationScenarios.length + 1}`, sim);
    apply(buildAddSimulationScenarioCommand(scenario));
    setActiveScenarioId(scenario.id);
  }

  function handleDeleteScenario(scenarioId: Id): void {
    apply(buildDeleteSimulationScenarioCommand(scenarioId));
    if (scenarioId === activeScenarioId) setActiveScenarioId(undefined);
  }

  return (
    <div className="simulate-workspace">
      <div className="simulate-panel-column">
        <SimulationPanel
          state={sim}
          onChange={setSim}
          pages={project.pages}
          popups={project.popups}
          scenarios={scenarios}
          builtInScenarioIds={BUILT_IN_SCENARIO_IDS}
          activeScenarioId={activeScenarioId}
          onApplyScenario={handleApplyScenario}
          onSaveAsNewScenario={handleSaveAsNewScenario}
          onUpdateScenario={(scenarioId) => apply(buildUpdateSimulationScenarioCommand(scenarioId, sim))}
          onRenameScenario={(scenarioId, name) => apply(buildRenameSimulationScenarioCommand(scenarioId, name))}
          onDeleteScenario={handleDeleteScenario}
          onDuplicateScenario={(scenarioId) => apply(buildDuplicateSimulationScenarioCommand(scenarioId))}
        />
      </div>
      <div className="simulate-preview-column">
        <div className="simulate-live-preview">
          {previewTarget ? (
            <ThemeRenderer
              document={project}
              assetResolver={resolver}
              componentAdapters={componentAdapters}
              copyContracts={copyContracts}
              target={previewTarget}
              hostSettings={hostSettings}
              renderState={renderState}
              onInteractionFlagChange={(layerId, which, value) => setInteractionFlags((prev) => ({ ...prev, [layerId]: { ...prev[layerId], [which]: value } }))}
            />
          ) : (
            <p className="simulate-empty">This project has no pages or popups yet.</p>
          )}
        </div>
        <BehaviourTracePanel resolution={resolution} lookups={lookups} />
      </div>
    </div>
  );
}
