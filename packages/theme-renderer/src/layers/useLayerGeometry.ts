import type { LayerBase } from "@fdraft/theme-sdk";
import { useRendererContext } from "../RendererContext.js";
import { resolveResponsiveGeometry } from "../responsive.js";
import { resolveInteractionOverride } from "../interactionState.js";

export interface EffectiveLayerState {
  transform: LayerBase["transform"];
  visible: boolean;
  opacity: number;
}

/** Combines a layer's base transform/visibility/opacity with its active breakpoint override, its first matching interaction-state override, and finally any active Behaviour rule's `show`/`hide` override — in that order, each taking precedence over the last. */
export function useLayerGeometry(layer: LayerBase): EffectiveLayerState {
  const { document, activeBreakpointId, renderState, hostSettings, behaviourResolution } = useRendererContext();

  const responsive = resolveResponsiveGeometry(layer.transform, layer.visible, layer.responsive, activeBreakpointId, document.canvas);
  const interaction = resolveInteractionOverride(layer.interactionStates, renderState, layer.id, { hostSettings });
  const behaviourVisible = behaviourResolution.visibilityOverrides[layer.id];

  return {
    transform: responsive.transform,
    visible: behaviourVisible ?? interaction.visible ?? responsive.visible,
    opacity: interaction.opacity ?? layer.opacity,
  };
}
