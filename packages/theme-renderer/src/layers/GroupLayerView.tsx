import type { ReactNode } from "react";
import type { GroupLayer } from "@fdraft/theme-sdk";
import { useRendererContext } from "../RendererContext.js";
import { useLayerGeometry } from "./useLayerGeometry.js";
import { LayerTree } from "./LayerTree.js";

/**
 * A group is an organisational wrapper, not a new coordinate origin:
 * every layer's `transform` is always canvas-absolute (see
 * `transformStyle.ts`), at any nesting depth. This wrapper only applies
 * the group's own opacity/visibility (which cascades to its children the
 * way nested CSS opacity naturally does) and its `data-fdraft-layer-id`
 * marker; it does not offset children by the group's own transform.
 * Parent-relative nested coordinates are a reserved gap for a later
 * layout phase.
 */
export function GroupLayerView({ layer }: { layer: GroupLayer }): ReactNode {
  const { hostSettings } = useRendererContext();
  const { visible, opacity } = useLayerGeometry(layer);

  return (
    <div
      data-fdraft-layer-id={layer.id}
      data-fdraft-layer-type="group"
      data-fdraft-layer-locked={layer.locked || undefined}
      style={{
        position: "absolute",
        inset: 0,
        opacity,
        zIndex: layer.zIndex,
        display: visible ? undefined : "none",
        transition: hostSettings.reducedMotion ? "none" : undefined,
        // This wrapper spans the whole stage but has no visual footprint of
        // its own — only its children (each individually positioned via
        // their own transform) should ever be a hit-test target. Without
        // this, a group placed above other content in z-order would
        // silently swallow every pointer event over the entire canvas,
        // including areas nowhere near any of its actual children.
        pointerEvents: "none",
      }}
    >
      <LayerTree layers={layer.children} />
    </div>
  );
}
