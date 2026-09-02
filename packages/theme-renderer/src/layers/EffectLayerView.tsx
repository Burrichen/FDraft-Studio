import type { ReactNode } from "react";
import type { EffectLayer } from "@fdraft/theme-sdk";
import { useRendererContext, resolveColor } from "../RendererContext.js";
import { performanceCapsFor } from "../performanceCaps.js";
import { LayerFrame } from "./LayerFrame.js";
import { EffectCanvas } from "./EffectCanvas.js";
import { FilmGrainEffect } from "./FilmGrainEffect.js";

/**
 * Renders one configurable effect layer through the single shared
 * particle engine (`EffectCanvas`) or, for `filmGrain`, the cheaper
 * SVG-turbulence path — never a bespoke per-kind implementation, and
 * never hundreds of editor-created image layers standing in for one.
 * Skipped entirely on the "low" performance tier (no `animationsEnabled`/
 * `effectsEnabled`), and skipped when this layer didn't make the current
 * render's `allowedEffectLayerIds` cut — both are real, structural
 * protection against an unbounded number of simultaneous effects, not
 * just a visual suggestion.
 */
export function EffectLayerView({ layer }: { layer: EffectLayer }): ReactNode {
  const { hostSettings, allowedEffectLayerIds, colorsById } = useRendererContext();
  const caps = performanceCapsFor(hostSettings);

  if (!caps.effectsEnabled) return null;
  if (allowedEffectLayerIds && !allowedEffectLayerIds.has(layer.id)) return null;

  const colorHex = resolveColor(colorsById, layer.effect.colorTokenId);

  return (
    <LayerFrame layer={layer}>
      <div data-fdraft-effect-kind={layer.effect.kind} style={{ width: "100%", height: "100%", overflow: "hidden" }}>
        {layer.effect.kind === "filmGrain" ? (
          <FilmGrainEffect effect={layer.effect} reducedMotion={hostSettings.reducedMotion} />
        ) : (
          <EffectCanvas effect={layer.effect} caps={caps} reducedMotion={hostSettings.reducedMotion} colorHex={colorHex} />
        )}
      </div>
    </LayerFrame>
  );
}
