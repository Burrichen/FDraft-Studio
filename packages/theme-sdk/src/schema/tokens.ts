import { z } from "zod";
import { HexColorSchema, IdSchema, UnitIntervalSchema } from "./primitives.js";

export const ColorTokenSchema = z.strictObject({
  id: IdSchema,
  name: z.string().min(1),
  value: HexColorSchema,
});
export type ColorToken = z.infer<typeof ColorTokenSchema>;

export const GradientStopSchema = z.strictObject({
  offset: UnitIntervalSchema,
  colorTokenId: IdSchema,
});
export type GradientStop = z.infer<typeof GradientStopSchema>;

export const GradientTokenSchema = z.strictObject({
  id: IdSchema,
  name: z.string().min(1),
  angleDeg: z.number(),
  stops: z.array(GradientStopSchema).min(2),
});
export type GradientToken = z.infer<typeof GradientTokenSchema>;

export const ShadowTokenSchema = z.strictObject({
  id: IdSchema,
  name: z.string().min(1),
  offsetX: z.number(),
  offsetY: z.number(),
  blur: z.number().nonnegative(),
  spread: z.number(),
  colorTokenId: IdSchema,
  inset: z.boolean(),
});
export type ShadowToken = z.infer<typeof ShadowTokenSchema>;

export const BorderStyleSchema = z.enum(["solid", "dashed", "dotted"]);

export const BorderTokenSchema = z.strictObject({
  id: IdSchema,
  name: z.string().min(1),
  width: z.number().nonnegative(),
  style: BorderStyleSchema,
  colorTokenId: IdSchema,
});
export type BorderToken = z.infer<typeof BorderTokenSchema>;

export const SpacingTokenSchema = z.strictObject({
  id: IdSchema,
  name: z.string().min(1),
  value: z.number().nonnegative(),
});
export type SpacingToken = z.infer<typeof SpacingTokenSchema>;

export const RadiusTokenSchema = z.strictObject({
  id: IdSchema,
  name: z.string().min(1),
  value: z.number().nonnegative(),
});
export type RadiusToken = z.infer<typeof RadiusTokenSchema>;

/**
 * A font token always points at a bundled, project-owned font asset — never
 * a remote URL. `fallbackFamily` is a plain CSS-safe generic family name
 * used only if the bundled asset fails to load; it must not be treated as a
 * way to request an arbitrary system/web font.
 */
export const FontTokenSchema = z.strictObject({
  id: IdSchema,
  name: z.string().min(1),
  assetId: IdSchema,
  fallbackFamily: z.enum(["sans-serif", "serif", "monospace"]),
  weight: z.union([
    z.literal(400),
    z.literal(500),
    z.literal(600),
    z.literal(700),
  ]),
  italic: z.boolean(),
});
export type FontToken = z.infer<typeof FontTokenSchema>;

export const BreakpointTokenSchema = z.strictObject({
  id: IdSchema,
  name: z.string().min(1),
  minWidthPx: z.number().int().nonnegative(),
});
export type BreakpointToken = z.infer<typeof BreakpointTokenSchema>;

export const DesignTokensSchema = z.strictObject({
  colors: z.array(ColorTokenSchema),
  gradients: z.array(GradientTokenSchema),
  shadows: z.array(ShadowTokenSchema),
  borders: z.array(BorderTokenSchema),
  spacing: z.array(SpacingTokenSchema),
  radii: z.array(RadiusTokenSchema),
  fonts: z.array(FontTokenSchema),
  breakpoints: z.array(BreakpointTokenSchema),
});
export type DesignTokens = z.infer<typeof DesignTokensSchema>;
