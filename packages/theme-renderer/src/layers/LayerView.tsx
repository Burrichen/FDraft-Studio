import type { ReactNode } from "react";
import type { Layer } from "@fdraft/theme-sdk";
import { ImageLayerView } from "./ImageLayerView.js";
import { TextLayerView } from "./TextLayerView.js";
import { ShapeLayerView } from "./ShapeLayerView.js";
import { GroupLayerView } from "./GroupLayerView.js";
import { SlotLayerView } from "./SlotLayerView.js";
import { ComponentLayerView } from "./ComponentLayerView.js";
import { EffectLayerView } from "./EffectLayerView.js";

/**
 * Dispatches on `layer.type`. The SDK's `Layer` union is closed and
 * exhaustively handled here — the `default` branch only exists to fail
 * safely (see `LayerTree`'s error boundary) if a renderer built against an
 * older SDK ever receives a layer type it doesn't yet know about.
 */
export function LayerView({ layer }: { layer: Layer }): ReactNode {
  switch (layer.type) {
    case "image":
      return <ImageLayerView layer={layer} />;
    case "text":
      return <TextLayerView layer={layer} />;
    case "shape":
      return <ShapeLayerView layer={layer} />;
    case "group":
      return <GroupLayerView layer={layer} />;
    case "slot":
      return <SlotLayerView layer={layer} />;
    case "component":
      return <ComponentLayerView layer={layer} />;
    case "effect":
      return <EffectLayerView layer={layer} />;
    default: {
      const unknown = layer as { type: string; id: string };
      throw new Error(`Unknown layer type "${unknown.type}" (layer ${unknown.id})`);
    }
  }
}
