import type { Id, InteractionState } from "@fdraft/theme-sdk";
import { evaluateCondition } from "./conditions.js";
import type { RenderState } from "./types.js";
import type { RuntimeVariableContext } from "./variables.js";

export interface InteractionOverride {
  visible?: boolean;
  opacity?: number;
}

/** The first matching interaction state (in declaration order) whose condition is currently true, if any. `layerId` lets a state's condition reference *this* layer's own hover/focus/pressed/selected flag via `interactionFlag`. */
export function resolveInteractionOverride(states: InteractionState[], renderState: RenderState, layerId?: Id, context: RuntimeVariableContext = {}): InteractionOverride {
  for (const state of states) {
    if (evaluateCondition(state.condition, renderState, { ...context, layerId })) {
      const override: InteractionOverride = {};
      if (state.visible !== undefined) override.visible = state.visible;
      if (state.opacity !== undefined) override.opacity = state.opacity;
      return override;
    }
  }
  return {};
}
