import { useMemo, useState } from "react";
import { ThemeRenderer, resolveActiveBehaviourRules, type ComponentAdapterRegistry, type ComponentCopyContractRegistry, type AssetResolver, type LayerInteractionFlags } from "@fdraft/theme-renderer";
import type { BehaviourRule, Id, SimulationScenario } from "@fdraft/theme-sdk";
import { useAppContext } from "../../AppContext.js";
import { useProjectSessionState } from "../../project/useProjectSession.js";
import {
  createDefaultBehaviourRule,
  buildAddBehaviourRuleCommand,
  buildDuplicateBehaviourRuleCommand,
  buildDeleteBehaviourRuleCommand,
  buildRenameBehaviourRuleCommand,
  buildSetBehaviourRuleEnabledCommand,
  buildSetBehaviourRulePriorityCommand,
  buildSetBehaviourRuleTriggerCommand,
  buildSetBehaviourRuleConditionCommand,
  buildSetBehaviourRuleActionsCommand,
  buildReorderBehaviourRuleCommand,
  listAllLayers,
} from "../../behaviour/behaviourCommands.js";
import { buildBehaviourNameLookups, describeBehaviourRule } from "../../behaviour/describeBehaviourRule.js";
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
import { SimulationPanel } from "../simulation/SimulationPanel.js";
import { BehaviourTracePanel } from "./BehaviourTracePanel.js";
import { ConditionEditor } from "./ConditionEditor.js";
import { ActionEditor } from "./ActionEditor.js";
import "./behaviour.css";

export interface BehaviourWorkspaceProps {
  resolver: AssetResolver;
  componentAdapters: ComponentAdapterRegistry;
  copyContracts: ComponentCopyContractRegistry;
}

type TriggerType = BehaviourRule["trigger"]["type"];
const TRIGGER_TYPES: TriggerType[] = ["whileTrue", "pageEnter", "pageExit", "popupOpen", "popupClose", "click", "hoverStart", "hoverEnd", "focus", "blur", "eventPhaseChange", "conditionBecomesTrue"];

const BUILT_IN_SCENARIO_IDS = new Set(DEFAULT_SIMULATION_SCENARIOS.map((s) => s.id));

/**
 * Behaviour Mode: a no-code rule list + editor on the left/right, a live
 * simulated preview in the center, and a trace/debug panel explaining
 * which rule won each contested target for the *current* simulated
 * render state. The simulator only ever produces a `RenderState`/
 * `HostSettings` pair — the exact same shape FDraft's real runtime
 * supplies — and every rule is resolved through
 * `resolveActiveBehaviourRules`, the one shared evaluator
 * `@fdraft/theme-renderer` also uses for the live preview itself, so
 * nothing here is a second, Studio-only interpretation of what a rule
 * does.
 */
export function BehaviourWorkspace({ resolver, componentAdapters, copyContracts }: BehaviourWorkspaceProps): React.ReactNode {
  const { session } = useAppContext();
  const state = useProjectSessionState(session);
  const project = state.open!.project;

  const [selectedRuleId, setSelectedRuleId] = useState<string | undefined>(project.behaviourRules[0]?.id);
  const [sim, setSim] = useState<SimulationLiveState>(() => ({
    ...DEFAULT_SIMULATION_LIVE_STATE,
    currentPageId: project.pages[0]?.id,
    currentPopupId: project.pages[0] ? undefined : project.popups[0]?.id,
  }));
  const [activeScenarioId, setActiveScenarioId] = useState<Id | undefined>(undefined);
  // Real hover/focus/pressed/selected, exactly as FDraft's runtime would derive them — driven by actually
  // interacting with the live preview below, not a manual toggle, so a hover/focus-conditioned rule can be
  // checked by doing the real thing.
  const [interactionFlags, setInteractionFlags] = useState<Record<Id, LayerInteractionFlags>>({});
  const previewTarget: { kind: "page"; pageId: Id } | { kind: "popup"; popupId: Id } | undefined = sim.currentPageId
    ? { kind: "page", pageId: sim.currentPageId }
    : sim.currentPopupId
      ? { kind: "popup", popupId: sim.currentPopupId }
      : undefined;
  const scenarios = useMemo(() => [...DEFAULT_SIMULATION_SCENARIOS, ...project.simulationScenarios], [project.simulationScenarios]);

  const lookups = useMemo(() => buildBehaviourNameLookups(project), [project]);
  const layers = useMemo(() => listAllLayers(project), [project]);
  const selectedRule = project.behaviourRules.find((r) => r.id === selectedRuleId);

  const hostSettings = useMemo(() => deriveHostSettings(sim), [sim]);
  const renderState = useMemo(() => deriveRenderState(sim, interactionFlags), [sim, interactionFlags]);

  const resolution = useMemo(() => resolveActiveBehaviourRules(project.behaviourRules, renderState, hostSettings), [project.behaviourRules, renderState, hostSettings]);

  function apply(command: Parameters<typeof session.applyCommand>[0]): void {
    session.applyCommand(command);
  }

  function handleAddRule(): void {
    const rule = createDefaultBehaviourRule(project);
    if (!rule) return;
    apply(buildAddBehaviourRuleCommand(rule));
    setSelectedRuleId(rule.id);
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
    <div className="behaviour-workspace">
      <div className="behaviour-rule-list">
        <div className="behaviour-rule-list-header">
          <h3>Rules</h3>
          <button type="button" onClick={handleAddRule} disabled={layers.length === 0} title={layers.length === 0 ? "Add a layer to a page first" : undefined}>
            + Add rule
          </button>
        </div>
        {project.behaviourRules.length === 0 && <p className="behaviour-empty">No rules yet.</p>}
        <ul>
          {project.behaviourRules.map((rule, index) => (
            <li key={rule.id} className={rule.id === selectedRuleId ? "behaviour-rule-row behaviour-rule-row-selected" : "behaviour-rule-row"}>
              <label>
                <input type="checkbox" checked={rule.enabled} onChange={(e) => apply(buildSetBehaviourRuleEnabledCommand(rule.id, e.target.checked))} aria-label={`${rule.name} enabled`} />
              </label>
              <button type="button" className="behaviour-rule-name" onClick={() => setSelectedRuleId(rule.id)}>
                {rule.name}
              </button>
              <span className="behaviour-rule-summary">{describeBehaviourRule(rule, lookups)}</span>
              <button type="button" onClick={() => apply(buildReorderBehaviourRuleCommand(rule.id, "up"))} disabled={index === 0} aria-label={`Move ${rule.name} up`}>
                ↑
              </button>
              <button type="button" onClick={() => apply(buildReorderBehaviourRuleCommand(rule.id, "down"))} disabled={index === project.behaviourRules.length - 1} aria-label={`Move ${rule.name} down`}>
                ↓
              </button>
              <button type="button" onClick={() => apply(buildDuplicateBehaviourRuleCommand(rule.id))} aria-label={`Duplicate ${rule.name}`}>
                Duplicate
              </button>
              <button
                type="button"
                onClick={() => {
                  apply(buildDeleteBehaviourRuleCommand(rule.id));
                  if (rule.id === selectedRuleId) setSelectedRuleId(undefined);
                }}
                aria-label={`Delete ${rule.name}`}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="behaviour-preview">
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

        <p className="behaviour-hint">Hover, focus (Tab), click, or press on the preview below to try hover/focus/pressed/selected conditions for real.</p>
        <div className="behaviour-live-preview">
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
            <p className="behaviour-empty">This project has no pages or popups yet.</p>
          )}
        </div>

        <BehaviourTracePanel resolution={resolution} lookups={lookups} />
      </div>

      <div className="behaviour-editor">
        {!selectedRule ? (
          <p className="behaviour-empty">Select a rule to edit it.</p>
        ) : (
          <>
            <label>
              Name
              <input value={selectedRule.name} onChange={(e) => apply(buildRenameBehaviourRuleCommand(selectedRule.id, e.target.value))} />
            </label>
            <label>
              Priority
              <input type="number" value={selectedRule.priority} onChange={(e) => apply(buildSetBehaviourRulePriorityCommand(selectedRule.id, Number(e.target.value)))} />
            </label>

            <h4>Trigger</h4>
            <select
              aria-label="Trigger type"
              value={selectedRule.trigger.type}
              onChange={(e) => {
                const type = e.target.value as TriggerType;
                const trigger: BehaviourRule["trigger"] =
                  type === "whileTrue"
                    ? { type }
                    : type === "pageEnter" || type === "pageExit"
                      ? { type, pageId: project.pages[0]?.id ?? "" }
                      : type === "popupOpen" || type === "popupClose"
                        ? { type, popupId: project.popups[0]?.id ?? "" }
                        : type === "click" || type === "hoverStart" || type === "hoverEnd" || type === "focus" || type === "blur"
                          ? { type, layerId: layers[0]?.id ?? "" }
                          : type === "eventPhaseChange"
                            ? { type, toPhase: "active" }
                            : { type, condition: { type: "always" } };
                apply(buildSetBehaviourRuleTriggerCommand(selectedRule.id, trigger));
              }}
            >
              {TRIGGER_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            {(selectedRule.trigger.type === "pageEnter" || selectedRule.trigger.type === "pageExit") && (
              <select aria-label="Trigger page" value={selectedRule.trigger.pageId} onChange={(e) => apply(buildSetBehaviourRuleTriggerCommand(selectedRule.id, { type: selectedRule.trigger.type as "pageEnter" | "pageExit", pageId: e.target.value }))}>
                {project.pages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
            {(selectedRule.trigger.type === "popupOpen" || selectedRule.trigger.type === "popupClose") && (
              <select aria-label="Trigger popup" value={selectedRule.trigger.popupId} onChange={(e) => apply(buildSetBehaviourRuleTriggerCommand(selectedRule.id, { type: selectedRule.trigger.type as "popupOpen" | "popupClose", popupId: e.target.value }))}>
                {project.popups.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
            {(selectedRule.trigger.type === "click" || selectedRule.trigger.type === "hoverStart" || selectedRule.trigger.type === "hoverEnd" || selectedRule.trigger.type === "focus" || selectedRule.trigger.type === "blur") && (
              <select aria-label="Trigger layer" value={selectedRule.trigger.layerId} onChange={(e) => apply(buildSetBehaviourRuleTriggerCommand(selectedRule.id, { type: selectedRule.trigger.type as "click", layerId: e.target.value }))}>
                {layers.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            )}
            {selectedRule.trigger.type === "eventPhaseChange" && (
              <input aria-label="Trigger event status" value={selectedRule.trigger.toPhase} onChange={(e) => apply(buildSetBehaviourRuleTriggerCommand(selectedRule.id, { type: "eventPhaseChange", toPhase: e.target.value }))} />
            )}
            {selectedRule.trigger.type === "conditionBecomesTrue" && (
              <ConditionEditor
                condition={selectedRule.trigger.condition}
                project={project}
                onChange={(condition) => apply(buildSetBehaviourRuleTriggerCommand(selectedRule.id, { type: "conditionBecomesTrue", condition }))}
              />
            )}

            <h4>Condition</h4>
            <ConditionEditor condition={selectedRule.condition} project={project} onChange={(condition) => apply(buildSetBehaviourRuleConditionCommand(selectedRule.id, condition))} />

            <h4>Actions</h4>
            {selectedRule.actions.map((action, i) => (
              <ActionEditor
                key={i}
                action={action}
                project={project}
                onChange={(next) => apply(buildSetBehaviourRuleActionsCommand(selectedRule.id, selectedRule.actions.map((a, j) => (j === i ? next : a))))}
                onRemove={() => {
                  const remaining = selectedRule.actions.filter((_, j) => j !== i);
                  if (remaining.length > 0) apply(buildSetBehaviourRuleActionsCommand(selectedRule.id, remaining));
                }}
              />
            ))}
            <button
              type="button"
              onClick={() => {
                const layerId = layers[0]?.id;
                if (!layerId) return;
                apply(buildSetBehaviourRuleActionsCommand(selectedRule.id, [...selectedRule.actions, { type: "show", layerId }]));
              }}
            >
              + Add action
            </button>

            <p className="behaviour-rule-preview-sentence">{describeBehaviourRule(selectedRule, lookups)}</p>
          </>
        )}
      </div>
    </div>
  );
}
