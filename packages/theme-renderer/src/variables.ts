import type { Id, RuntimeVariable } from "@fdraft/theme-sdk";
import type { HostSettings, RenderState } from "./types.js";

export type RuntimeValue = string | number | boolean | undefined;

/** Everything a `RuntimeVariable` might need beyond the render state itself — both optional, since most variables need neither. */
export interface RuntimeVariableContext {
  hostSettings?: HostSettings;
  /** Fallback layer for an `interactionFlag` variable that doesn't name one explicitly — the layer an `InteractionState` is already attached to; ignored otherwise, and ignored entirely when the variable carries its own `layerId`. */
  layerId?: Id;
}

/**
 * Reads one closed `RuntimeVariable` from the current render state. Never
 * throws on a missing value — an unset/undisclosed value simply reads as
 * `undefined`, which every comparison operator treats as "not equal, not
 * in range, not true" rather than a crash.
 */
export function readRuntimeVariable(variable: RuntimeVariable, state: RenderState, context: RuntimeVariableContext = {}): RuntimeValue {
  switch (variable.kind) {
    case "eventStatus":
      return state.eventPhase;
    case "eventActive":
      return state.event?.eventActive;
    case "eventAvailable":
      return state.event?.eventAvailable;
    case "optedIn":
      return state.event?.optedIn;
    case "currentPageId":
      return state.currentPageId;
    case "currentPopupId":
      return state.currentPopupId;
    case "draftGenerated":
      return state.event?.draftGenerated;
    case "progressPercent":
      return state.event?.progressPercent;
    case "watchedCount":
      return state.event?.watchedCount;
    case "targetCount":
      return state.event?.targetCount;
    case "eventCompleted":
      return state.event?.eventCompleted;
    case "performanceTier":
      return context.hostSettings?.performanceTier;
    case "reducedMotion":
      return context.hostSettings?.reducedMotion;
    case "interactionFlag": {
      const targetLayerId = variable.layerId ?? context.layerId;
      return targetLayerId !== undefined ? (state.interactionFlags?.[targetLayerId]?.[variable.which] ?? false) : undefined;
    }
    case "imageState":
      return state.activeImageStates[variable.stateGroupId];
    case "dateTime":
      return state.dateTimeValues?.[variable.key];
  }
}
