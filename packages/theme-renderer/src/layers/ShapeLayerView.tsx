import type { CSSProperties, ReactNode } from "react";
import type { ShapeLayer } from "@fdraft/theme-sdk";
import { useRendererContext, resolveColor } from "../RendererContext.js";
import { resolveBoxShadowCss, resolveGradientCss, resolveRadiusPx } from "../tokenStyle.js";
import { LayerFrame } from "./LayerFrame.js";

export function ShapeLayerView({ layer }: { layer: ShapeLayer }): ReactNode {
  const { document, colorsById } = useRendererContext();
  const fill = resolveColor(colorsById, layer.fillColorTokenId);
  const gradientFill = resolveGradientCss(colorsById, document.tokens, layer.fillGradientTokenId);
  const border = layer.strokeBorderTokenId !== undefined ? document.tokens.borders.find((b) => b.id === layer.strokeBorderTokenId) : undefined;
  const strokeColor = border ? resolveColor(colorsById, border.colorTokenId) : undefined;
  const borderStyle: CSSProperties = border ? { borderWidth: border.width, borderStyle: border.style, borderColor: strokeColor } : {};
  const boxShadow = resolveBoxShadowCss(colorsById, document.tokens, layer.shadowTokenIds);
  const radiusPx = resolveRadiusPx(document.tokens, layer.cornerRadiusTokenId);

  if (layer.shape === "path") {
    return (
      <LayerFrame layer={layer}>
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          {layer.pathData && <path d={layer.pathData} fill={fill ?? "none"} stroke={strokeColor} strokeWidth={border?.width} />}
        </svg>
      </LayerFrame>
    );
  }

  return (
    <LayerFrame
      layer={layer}
      style={{
        backgroundColor: gradientFill ? undefined : fill,
        backgroundImage: gradientFill,
        borderRadius: layer.shape === "ellipse" ? "50%" : radiusPx,
        boxShadow,
        ...borderStyle,
      }}
    />
  );
}
