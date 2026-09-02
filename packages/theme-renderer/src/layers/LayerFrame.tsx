import type { CSSProperties, ReactNode } from "react";
import type { Layer } from "@fdraft/theme-sdk";
import { useRendererContext } from "../RendererContext.js";
import { layerBoxStyle } from "../transformStyle.js";
import { useLayerGeometry } from "./useLayerGeometry.js";
import { useLayerAnimation } from "./useLayerAnimation.js";

export interface LayerFrameProps {
  layer: Layer;
  children?: ReactNode;
  /** Extra inline style merged on top of the computed geometry (e.g. background color for a shape). */
  style?: CSSProperties;
}

/**
 * The shared positioned wrapper every layer type renders through. Carries
 * the stable `data-fdraft-layer-*` markers a host (Studio's selection
 * overlay) can query — plain data attributes, never anything that changes
 * production rendering behaviour.
 */
/**
 * hover/focus/pressed/selected are always real DOM-derived signals, never
 * host-supplied business data — this is the one place the renderer wires
 * native pointer/focus/click events. It never keeps its own state; every
 * event is immediately reported to the host via `onInteractionFlagChange`
 * (a no-op when a host hasn't opted in), which is expected to fold it into
 * the `renderState` it re-supplies on the next render — see
 * `applyInteractionFlagChange`. `selected` toggles on click, based on
 * whatever the host's *current* `renderState` already says for this
 * layer; a theme with nothing referencing it simply never notices.
 */
export function LayerFrame({ layer, children, style }: LayerFrameProps): ReactNode {
  const { document, hostSettings, renderState, onInteractionFlagChange } = useRendererContext();
  const { transform, visible, opacity } = useLayerGeometry(layer);
  const animation = useLayerAnimation(layer.id, visible);
  const effectiveVisible = visible || animation.isExiting;

  const interactionHandlers = onInteractionFlagChange
    ? {
        onMouseEnter: () => onInteractionFlagChange(layer.id, "hover", true),
        onMouseLeave: () => {
          onInteractionFlagChange(layer.id, "hover", false);
          onInteractionFlagChange(layer.id, "pressed", false);
        },
        onFocus: () => onInteractionFlagChange(layer.id, "focus", true),
        onBlur: () => onInteractionFlagChange(layer.id, "focus", false),
        onPointerDown: () => onInteractionFlagChange(layer.id, "pressed", true),
        onPointerUp: () => onInteractionFlagChange(layer.id, "pressed", false),
        onClick: () => onInteractionFlagChange(layer.id, "selected", !(renderState.interactionFlags?.[layer.id]?.selected ?? false)),
      }
    : undefined;

  return (
    <div
      data-fdraft-layer-id={layer.id}
      data-fdraft-layer-type={layer.type}
      data-fdraft-layer-locked={layer.locked || undefined}
      style={{
        ...layerBoxStyle({ transform, canvas: document.canvas, opacity, visible: effectiveVisible, zIndex: layer.zIndex, reducedMotion: hostSettings.reducedMotion }),
        ...animation.style,
        ...style,
      }}
      {...interactionHandlers}
    >
      {children}
    </div>
  );
}
