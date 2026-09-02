import type { ReactNode } from "react";
import type { Layer } from "@fdraft/theme-sdk";
import { RenderErrorBoundary } from "../ErrorBoundary.js";
import { LayerView } from "./LayerView.js";

function LayerErrorFallback(layer: Layer, error: Error): ReactNode {
  return (
    <div
      data-fdraft-error="layer-render-failed"
      data-fdraft-layer-id={layer.id}
      title={error.message}
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "repeating-linear-gradient(45deg, #f8d7da, #f8d7da 8px, #fff 8px, #fff 16px)",
        color: "#58151c",
        fontSize: "0.7rem",
        boxSizing: "border-box",
      }}
    >
      Layer failed to render
    </div>
  );
}

/** Renders a list of sibling layers, isolating each one behind its own error boundary so a single bad layer can't blank the rest of a valid page. */
export function LayerTree({ layers }: { layers: Layer[] }): ReactNode {
  return (
    <>
      {layers.map((layer) => (
        <RenderErrorBoundary key={layer.id} fallback={(error) => LayerErrorFallback(layer, error)}>
          <LayerView layer={layer} />
        </RenderErrorBoundary>
      ))}
    </>
  );
}
