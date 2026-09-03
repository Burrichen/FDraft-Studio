import { useState } from "react";
import type { Id, SimulationDataProfile, SimulationScenario } from "@fdraft/theme-sdk";
import type { SimulationLiveState } from "../../simulation/simulationState.js";
import "./simulation.css";

const DATA_PROFILES: SimulationDataProfile[] = ["normal", "empty", "loading", "error", "longTitle", "maxFilmCards"];

function toDateTimeLocalValue(epochMs: number | undefined): string {
  if (epochMs === undefined) return "";
  const d = new Date(epochMs);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export interface SimulationPanelProps {
  state: SimulationLiveState;
  onChange: (next: SimulationLiveState) => void;
  pages: { id: Id; name: string }[];
  popups: { id: Id; name: string }[];
  /** Built-in defaults first, then the project's own saved scenarios — display order. */
  scenarios: SimulationScenario[];
  builtInScenarioIds: ReadonlySet<Id>;
  activeScenarioId?: Id;
  onApplyScenario: (scenario: SimulationScenario) => void;
  onSaveAsNewScenario: () => void;
  onUpdateScenario: (scenarioId: Id) => void;
  onRenameScenario: (scenarioId: Id, name: string) => void;
  onDeleteScenario: (scenarioId: Id) => void;
  onDuplicateScenario: (scenarioId: Id) => void;
}

/**
 * The one shared Simulation panel — a set of safe mock values (never the
 * real Windows clock or FDraft profile/draft/points/watch data) plus a
 * picker over built-in and project-saved scenarios. Reused by Behaviour
 * Mode's live simulator and by the dedicated Simulate workspace, so the two
 * can never drift into offering different controls for the same thing.
 */
export function SimulationPanel({
  state,
  onChange,
  pages,
  popups,
  scenarios,
  builtInScenarioIds,
  activeScenarioId,
  onApplyScenario,
  onSaveAsNewScenario,
  onUpdateScenario,
  onRenameScenario,
  onDeleteScenario,
  onDuplicateScenario,
}: SimulationPanelProps): React.ReactNode {
  const [placeholderDraft, setPlaceholderDraft] = useState({ key: "", value: "" });
  const activeScenario = scenarios.find((s) => s.id === activeScenarioId);
  const activeIsBuiltIn = activeScenarioId !== undefined && builtInScenarioIds.has(activeScenarioId);

  function set<K extends keyof SimulationLiveState>(key: K, value: SimulationLiveState[K]): void {
    onChange({ ...state, [key]: value });
  }

  function addPlaceholder(): void {
    const key = placeholderDraft.key.trim();
    if (!key) return;
    set("placeholderValues", { ...(state.placeholderValues ?? {}), [key]: placeholderDraft.value });
    setPlaceholderDraft({ key: "", value: "" });
  }

  function removePlaceholder(key: string): void {
    const next = { ...(state.placeholderValues ?? {}) };
    delete next[key];
    set("placeholderValues", Object.keys(next).length > 0 ? next : undefined);
  }

  return (
    <div className="simulation-panel">
      <div className="simulation-scenarios">
        <h3>Scenarios</h3>
        <ul className="simulation-scenario-list">
          {scenarios.map((scenario) => {
            const builtIn = builtInScenarioIds.has(scenario.id);
            return (
              <li key={scenario.id} className={scenario.id === activeScenarioId ? "simulation-scenario-row simulation-scenario-row-active" : "simulation-scenario-row"}>
                <button type="button" className="simulation-scenario-name" onClick={() => onApplyScenario(scenario)} title={scenario.description}>
                  {scenario.name}
                  {builtIn && <span className="simulation-scenario-builtin"> (built-in)</span>}
                </button>
                <button type="button" onClick={() => onDuplicateScenario(scenario.id)} aria-label={`Duplicate ${scenario.name}`}>
                  Duplicate
                </button>
                {!builtIn && (
                  <button type="button" onClick={() => onDeleteScenario(scenario.id)} aria-label={`Delete ${scenario.name}`}>
                    Delete
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        <div className="simulation-scenario-actions">
          <button type="button" onClick={onSaveAsNewScenario}>
            + Save current as new scenario
          </button>
          {activeScenario && !activeIsBuiltIn && (
            <>
              <button type="button" onClick={() => onUpdateScenario(activeScenario.id)}>
                Update "{activeScenario.name}" with current values
              </button>
              <label className="simulation-scenario-rename">
                Rename
                <input value={activeScenario.name} onChange={(e) => onRenameScenario(activeScenario.id, e.target.value)} aria-label="Active scenario name" />
              </label>
            </>
          )}
        </div>
      </div>

      <div className="simulation-state-form">
        <h3>Simulate render context</h3>
        <label>
          Current page
          <select
            aria-label="Current page"
            value={state.currentPageId ?? ""}
            onChange={(e) => onChange({ ...state, currentPageId: e.target.value || undefined, currentPopupId: undefined })}
          >
            <option value="">(none)</option>
            {pages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Current popup
          <select
            aria-label="Current popup"
            value={state.currentPopupId ?? ""}
            onChange={(e) => onChange({ ...state, currentPopupId: e.target.value || undefined, currentPageId: undefined })}
          >
            <option value="">(none)</option>
            {popups.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Event status
          <input value={state.eventStatus} onChange={(e) => set("eventStatus", e.target.value)} />
        </label>
        <label>
          <input type="checkbox" checked={state.eventActive} onChange={(e) => set("eventActive", e.target.checked)} /> Event active
        </label>
        <label>
          <input type="checkbox" checked={state.eventAvailable} onChange={(e) => set("eventAvailable", e.target.checked)} /> Event available
        </label>
        <label>
          <input type="checkbox" checked={state.optedIn} onChange={(e) => set("optedIn", e.target.checked)} /> Opted in
        </label>
        <label>
          <input type="checkbox" checked={state.draftGenerated} onChange={(e) => set("draftGenerated", e.target.checked)} /> Draft generated
        </label>
        <label>
          <input type="checkbox" checked={state.eventCompleted} onChange={(e) => set("eventCompleted", e.target.checked)} /> Event completed
        </label>
        <label>
          Progress %
          <input type="number" min={0} max={100} value={state.progressPercent} onChange={(e) => set("progressPercent", Number(e.target.value))} />
        </label>
        <label>
          Watched count
          <input type="number" min={0} value={state.watchedCount} onChange={(e) => set("watchedCount", Number(e.target.value))} />
        </label>
        <label>
          Target count
          <input type="number" min={0} value={state.targetCount} onChange={(e) => set("targetCount", Number(e.target.value))} />
        </label>
        <label>
          Performance tier
          <select value={state.performanceTier} onChange={(e) => set("performanceTier", e.target.value as SimulationLiveState["performanceTier"])}>
            <option value="high">high</option>
            <option value="medium">medium</option>
            <option value="low">low</option>
          </select>
        </label>
        <label>
          <input type="checkbox" checked={state.reducedMotion} onChange={(e) => set("reducedMotion", e.target.checked)} /> Reduced motion
        </label>
        <label>
          Representative data
          <select aria-label="Representative data" value={state.dataProfile} onChange={(e) => set("dataProfile", e.target.value as SimulationDataProfile)}>
            {DATA_PROFILES.map((profile) => (
              <option key={profile} value={profile}>
                {profile}
              </option>
            ))}
          </select>
        </label>
        <label>
          Simulated date/time
          <input
            type="datetime-local"
            aria-label="Simulated date/time"
            value={toDateTimeLocalValue(state.dateTimeOverrideMs)}
            onChange={(e) => set("dateTimeOverrideMs", e.target.value ? new Date(e.target.value).getTime() : undefined)}
          />
        </label>

        <div className="simulation-placeholders">
          <h4>Placeholder values</h4>
          {Object.entries(state.placeholderValues ?? {}).map(([key, value]) => (
            <div key={key} className="simulation-placeholder-row">
              <span>{`{{${key}}}`}</span>
              <input
                aria-label={`Placeholder value for ${key}`}
                value={value}
                onChange={(e) => set("placeholderValues", { ...(state.placeholderValues ?? {}), [key]: e.target.value })}
              />
              <button type="button" onClick={() => removePlaceholder(key)} aria-label={`Remove placeholder ${key}`}>
                Remove
              </button>
            </div>
          ))}
          <div className="simulation-placeholder-row">
            <input aria-label="New placeholder name" placeholder="name" value={placeholderDraft.key} onChange={(e) => setPlaceholderDraft({ ...placeholderDraft, key: e.target.value })} />
            <input aria-label="New placeholder value" placeholder="value" value={placeholderDraft.value} onChange={(e) => setPlaceholderDraft({ ...placeholderDraft, value: e.target.value })} />
            <button type="button" onClick={addPlaceholder} disabled={!placeholderDraft.key.trim()}>
              + Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
