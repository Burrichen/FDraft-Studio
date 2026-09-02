import type { ColorToken, DesignTokens, Id } from "@fdraft/theme-sdk";
import { resolveColor } from "./RendererContext.js";

/** A linear-only gradient (see `GradientTokenSchema`'s doc comment) as a CSS `background-image` value. */
export function resolveGradientCss(colorsById: Map<Id, ColorToken>, tokens: DesignTokens, gradientTokenId: Id | undefined): string | undefined {
  if (gradientTokenId === undefined) return undefined;
  const gradient = tokens.gradients.find((g) => g.id === gradientTokenId);
  if (!gradient) return undefined;
  const stops = gradient.stops
    .map((stop) => {
      const color = resolveColor(colorsById, stop.colorTokenId);
      return color ? `${color} ${stop.offset * 100}%` : undefined;
    })
    .filter((s): s is string => !!s);
  if (stops.length < 2) return undefined;
  return `linear-gradient(${gradient.angleDeg}deg, ${stops.join(", ")})`;
}

/** Composes one or more `ShadowToken`s (in order) into a single CSS `box-shadow` value — "one or more bounded shadows." */
export function resolveBoxShadowCss(colorsById: Map<Id, ColorToken>, tokens: DesignTokens, shadowTokenIds: Id[] | undefined): string | undefined {
  if (!shadowTokenIds || shadowTokenIds.length === 0) return undefined;
  const parts = shadowTokenIds
    .map((id) => tokens.shadows.find((s) => s.id === id))
    .filter((s): s is NonNullable<typeof s> => !!s)
    .map((s) => {
      const color = resolveColor(colorsById, s.colorTokenId) ?? "transparent";
      return `${s.inset ? "inset " : ""}${s.offsetX}px ${s.offsetY}px ${s.blur}px ${s.spread}px ${color}`;
    });
  return parts.length > 0 ? parts.join(", ") : undefined;
}

export function resolveRadiusPx(tokens: DesignTokens, radiusTokenId: Id | undefined): number | undefined {
  if (radiusTokenId === undefined) return undefined;
  return tokens.radii.find((r) => r.id === radiusTokenId)?.value;
}
