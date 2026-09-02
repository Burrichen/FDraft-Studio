import type { ReactNode } from "react";
import type { Layer, Page, Popup } from "@fdraft/theme-sdk";
import { useRendererContext } from "./RendererContext.js";
import { stageStyle } from "./transformStyle.js";
import { LayerTree } from "./layers/LayerTree.js";

/** Renders one page or popup's fully-resolved (master-inherited) layer stack — already resolved by `ThemeRenderer`, which also needs it to compute the active effect-layer cap — inside the scaling canvas stage. */
export function PageStage({ container, kind, layers }: { container: Page | Popup; kind: "page" | "popup"; layers: Layer[] }): ReactNode {
  const { document: renderableDocument } = useRendererContext();
  return (
    <div
      data-fdraft-stage="true"
      data-fdraft-page-id={kind === "page" ? container.id : undefined}
      data-fdraft-popup-id={kind === "popup" ? container.id : undefined}
      style={stageStyle(renderableDocument.canvas)}
    >
      <LayerTree layers={layers} />
    </div>
  );
}
