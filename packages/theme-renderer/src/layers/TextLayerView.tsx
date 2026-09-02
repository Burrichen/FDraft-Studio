import type { ReactNode } from "react";
import type { TextLayer } from "@fdraft/theme-sdk";
import { useRendererContext, resolveColor } from "../RendererContext.js";
import { LayerFrame } from "./LayerFrame.js";
import { fontSizeToCqw } from "../transformStyle.js";

/**
 * Renders theme-authored text as a plain text node — never
 * `dangerouslySetInnerHTML`, so nothing in `layer.text` can ever be
 * interpreted as markup.
 *
 * Font: only the token's generic `fallbackFamily` is applied so far;
 * loading the bundled font asset itself (via `@font-face`) is a reserved
 * gap for the phase that builds the asset pipeline further.
 */
export function TextLayerView({ layer }: { layer: TextLayer }): ReactNode {
  const { document, colorsById } = useRendererContext();
  const fontToken = layer.fontTokenId !== undefined ? document.tokens.fonts.find((f) => f.id === layer.fontTokenId) : undefined;
  const color = resolveColor(colorsById, layer.colorTokenId);

  const whiteSpace = layer.wrap === "nowrap" ? "pre" : "pre-wrap";

  return (
    <LayerFrame layer={layer}>
      <div
        style={{
          width: "100%",
          height: "100%",
          fontSize: fontSizeToCqw(layer.fontSizePx, document.canvas),
          color,
          textAlign: layer.align,
          fontFamily: fontToken?.fallbackFamily,
          fontWeight: layer.fontWeightOverride ?? fontToken?.weight,
          fontStyle: fontToken?.italic ? "italic" : undefined,
          lineHeight: layer.lineHeightMultiplier,
          letterSpacing: layer.letterSpacingPx !== undefined ? `${layer.letterSpacingPx}px` : undefined,
          whiteSpace,
          textWrap: layer.wrap === "balance" ? "balance" : undefined,
          overflow: "hidden",
        }}
      >
        {layer.text}
      </div>
    </LayerFrame>
  );
}
