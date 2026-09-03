import type { Id, SimulationScenario } from "@fdraft/theme-sdk";
import type { HostSettings, LayerInteractionFlags, RenderState } from "@fdraft/theme-renderer";

/**
 * Everything a saved `SimulationScenario` captures, minus its own identity
 * (`id`/`name`/`description`) — the shape the Simulation panel edits live
 * and derives a `RenderState`/`HostSettings` pair from. Kept as a plain
 * `Omit` of the schema type (not a hand-duplicated interface) so the two
 * can never silently drift apart.
 */
export type SimulationLiveState = Omit<SimulationScenario, "id" | "name" | "description">;

export const DEFAULT_SIMULATION_LIVE_STATE: SimulationLiveState = {
  eventStatus: "active",
  eventActive: true,
  eventAvailable: true,
  optedIn: false,
  draftGenerated: false,
  eventCompleted: false,
  progressPercent: 0,
  watchedCount: 0,
  targetCount: 10,
  performanceTier: "high",
  reducedMotion: false,
  dataProfile: "normal",
};

/** Strips a saved scenario's identity fields, leaving just the live state a panel edits. */
export function scenarioToLiveState(scenario: SimulationScenario): SimulationLiveState {
  const { id: _id, name: _name, description: _description, ...state } = scenario;
  return state;
}

export function deriveHostSettings(state: SimulationLiveState): HostSettings {
  return { performanceTier: state.performanceTier, reducedMotion: state.reducedMotion };
}

/**
 * The one place a `SimulationLiveState` becomes the `RenderState` the
 * shared renderer/evaluator actually consumes — Studio's Simulation panel,
 * Behaviour Mode, and Preview mode must all go through this, never
 * hand-build their own `RenderState` from simulator fields.
 */
export function deriveRenderState(state: SimulationLiveState, interactionFlags: Record<Id, LayerInteractionFlags>): RenderState {
  return {
    activeImageStates: {},
    eventPhase: state.eventStatus,
    currentPageId: state.currentPageId,
    currentPopupId: state.currentPopupId,
    interactionFlags,
    dateTimeValues: state.dateTimeOverrideMs !== undefined ? { now: state.dateTimeOverrideMs } : undefined,
    placeholderValues: state.placeholderValues,
    event: {
      eventActive: state.eventActive,
      eventAvailable: state.eventAvailable,
      optedIn: state.optedIn,
      draftGenerated: state.draftGenerated,
      eventCompleted: state.eventCompleted,
      progressPercent: state.progressPercent,
      watchedCount: state.watchedCount,
      targetCount: state.targetCount,
    },
  };
}
