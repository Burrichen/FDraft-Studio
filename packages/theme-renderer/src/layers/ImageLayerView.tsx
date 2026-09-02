import type { CSSProperties, ReactNode } from "react";
import type { ImageLayer } from "@fdraft/theme-sdk";
import { useRendererContext } from "../RendererContext.js";
import { LayerFrame } from "./LayerFrame.js";
import { MissingAssetFallback } from "./MissingAssetFallback.js";

function maskClipPath(layer: ImageLayer): string | undefined {
  switch (layer.mask?.type) {
    case "ellipse":
      return "ellipse(50% 50% at 50% 50%)";
    case "rect":
      return "inset(0)";
    default:
      return undefined;
  }
}

export function ImageLayerView({ layer }: { layer: ImageLayer }): ReactNode {
  const { document, assetResolver, renderState, behaviourResolution } = useRendererContext();

  // A Behaviour rule's `setImageState` action, when one currently applies to this group, takes precedence over the host-supplied active state.
  const activeStateAssetId =
    layer.stateGroupId !== undefined ? (behaviourResolution.imageStateOverrides[layer.stateGroupId] ?? renderState.activeImageStates[layer.stateGroupId]) : undefined;
  const stateGroup = layer.stateGroupId !== undefined ? document.imageStateGroups.find((g) => g.id === layer.stateGroupId) : undefined;
  const activeState = stateGroup?.states.find((s) => s.id === activeStateAssetId) ?? stateGroup?.states.find((s) => s.id === stateGroup.defaultStateId);
  const effectiveAssetId = activeState?.assetId ?? layer.assetId;

  const asset = document.assets.find((a) => a.id === effectiveAssetId);
  const url = asset ? assetResolver.resolveAsset(asset.id) : undefined;

  if (!asset || !url) {
    return (
      <LayerFrame layer={layer}>
        <MissingAssetFallback assetId={effectiveAssetId} label={layer.name} />
      </LayerFrame>
    );
  }

  // Crop is approximated via object-position from crop.x/y only; crop.width/height
  // (zooming into a sub-rectangle) needs a scaled inner element and is a reserved gap.
  const imageStyle: CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    clipPath: maskClipPath(layer),
    objectPosition: layer.crop ? `${layer.crop.x * 100}% ${layer.crop.y * 100}%` : undefined,
  };

  return (
    <LayerFrame layer={layer}>
      <img src={url} alt={asset.alt ?? layer.name} style={imageStyle} draggable={false} />
    </LayerFrame>
  );
}
