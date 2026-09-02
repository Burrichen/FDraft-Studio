import type { ReactNode } from "react";
import type { ComponentLayer, ComponentRequirement } from "@fdraft/theme-sdk";
import { useRendererContext } from "../RendererContext.js";
import { resolveComponentCopy } from "../copyResolution.js";
import { LayerFrame } from "./LayerFrame.js";
import { MissingComponentFallback } from "./MissingComponentFallback.js";
import { useLayerGeometry } from "./useLayerGeometry.js";

/**
 * Merges this layer's style overrides for `requirement`, restricted to
 * `requirement.allowedProperties` — defence in depth alongside the SDK's
 * own `DISALLOWED_STYLE_PROPERTY` validation, in case this layer is ever
 * rendered from data that skipped SDK validation.
 */
function resolveComponentStyle(layer: ComponentLayer, requirement: ComponentRequirement): Record<string, string | number> {
  const style: Record<string, string | number> = {};
  for (const override of layer.styleOverrides) {
    if (override.componentRequirementId !== requirement.id) continue;
    for (const [property, value] of Object.entries(override.style)) {
      if (value !== undefined && requirement.allowedProperties.includes(property as ComponentRequirement["allowedProperties"][number])) {
        style[property] = value;
      }
    }
  }
  return style;
}

export function ComponentLayerView({ layer }: { layer: ComponentLayer }): ReactNode {
  const { document, componentAdapters, copyContracts, renderState, behaviourResolution } = useRendererContext();
  const { transform } = useLayerGeometry(layer);

  const requirement = document.componentRequirements.find((r) => r.id === layer.componentRequirementId);
  if (!requirement) {
    return (
      <LayerFrame layer={layer}>
        <MissingComponentFallback componentKey={layer.componentKey} reason="This layer's componentRequirementId does not match any declared requirement." />
      </LayerFrame>
    );
  }

  const Adapter = componentAdapters[layer.componentKey];
  if (!Adapter) {
    return (
      <LayerFrame layer={layer}>
        <MissingComponentFallback
          componentKey={layer.componentKey}
          reason={
            requirement.required
              ? "This component is required by the theme but no adapter is registered for it on this host."
              : "No adapter is registered for this optional component on this host."
          }
        />
      </LayerFrame>
    );
  }

  // An active Behaviour `selectCopyVariant` action wins over the theme's own static override for that slot — resolved to plain text from the layer's own declared `copyVariants`, never a second copy of the same lookup logic.
  const activeVariants = behaviourResolution.copyVariantOverrides[layer.id];
  const effectiveOverrides: Record<string, string> | undefined = activeVariants
    ? {
        ...layer.copyOverrides,
        ...Object.fromEntries(
          Object.entries(activeVariants)
            .map(([slotKey, variantId]) => [slotKey, layer.copyVariants?.[slotKey]?.find((v) => v.id === variantId)?.text] as const)
            .filter((entry): entry is [string, string] => entry[1] !== undefined),
        ),
      }
    : layer.copyOverrides;
  const copy = resolveComponentCopy(copyContracts[layer.componentKey] ?? [], effectiveOverrides, renderState.placeholderValues);

  // An active Behaviour `applyStyleOverride` action wins over the theme's own static style override for the same property.
  const style = { ...resolveComponentStyle(layer, requirement), ...behaviourResolution.styleOverrides[layer.id] };
  const enabled = behaviourResolution.enabledOverrides[layer.id] ?? true;

  return (
    <LayerFrame layer={layer}>
      <Adapter
        componentKey={layer.componentKey}
        requirement={requirement}
        style={style}
        widthPx={transform.width}
        heightPx={transform.height}
        copy={copy}
        enabled={enabled}
      />
    </LayerFrame>
  );
}
