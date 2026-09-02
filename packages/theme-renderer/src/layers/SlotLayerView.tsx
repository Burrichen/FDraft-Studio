import type { ReactNode } from "react";
import type { SlotLayer } from "@fdraft/theme-sdk";
import { useRendererContext } from "../RendererContext.js";
import { LayerFrame } from "./LayerFrame.js";

export function SlotLayerView({ layer }: { layer: SlotLayer }): ReactNode {
  const { slotContent } = useRendererContext();
  const content = slotContent[layer.slotKey];

  if (content !== undefined) {
    return (
      <LayerFrame layer={layer}>
        <div data-fdraft-slot-key={layer.slotKey} style={{ width: "100%", height: "100%" }}>
          {content}
        </div>
      </LayerFrame>
    );
  }

  return (
    <LayerFrame layer={layer}>
      <div
        data-fdraft-slot-key={layer.slotKey}
        data-fdraft-placeholder="slot"
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "1px dashed rgba(0,0,0,0.3)",
          fontSize: "0.75rem",
          color: "rgba(0,0,0,0.5)",
          boxSizing: "border-box",
        }}
      >
        Slot: {layer.slotKey}
      </div>
    </LayerFrame>
  );
}
