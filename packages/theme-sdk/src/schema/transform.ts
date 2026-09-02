import { z } from "zod";
import { IdSchema } from "./primitives.js";

export const TransformSchema = z.strictObject({
  x: z.number(),
  y: z.number(),
  width: z.number().nonnegative(),
  height: z.number().nonnegative(),
  rotationDeg: z.number(),
  scaleX: z.number(),
  scaleY: z.number(),
});
export type Transform = z.infer<typeof TransformSchema>;

/** A crop rectangle expressed in the source asset's normalised 0-1 space, so it survives asset re-export at any resolution. */
export const CropSchema = z.strictObject({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0).max(1),
  height: z.number().min(0).max(1),
});
export type Crop = z.infer<typeof CropSchema>;

export const MaskTypeSchema = z.enum(["none", "rect", "ellipse", "path", "image"]);

export const MaskSchema = z.strictObject({
  type: MaskTypeSchema,
  /** SVG path data for `type: "path"`. Bounded length; sanitised the same way as SVG assets. */
  pathData: z.string().max(4096).optional(),
  /** Source asset for `type: "image"` (luminance/alpha mask). */
  assetId: IdSchema.optional(),
});
export type Mask = z.infer<typeof MaskSchema>;

export const AnchorEdgeSchema = z.enum(["left", "right", "top", "bottom", "centerX", "centerY"]);
export const LengthUnitSchema = z.enum(["px", "percent"]);

export const ResponsiveAnchorSchema = z.strictObject({
  edge: AnchorEdgeSchema,
  offset: z.number(),
  unit: LengthUnitSchema,
});
export type ResponsiveAnchor = z.infer<typeof ResponsiveAnchorSchema>;

/**
 * A per-breakpoint override. `transformOverride` is a partial `Transform`
 * so a breakpoint only needs to state what changes from the base layer
 * transform.
 */
export const ResponsiveConstraintSchema = z.strictObject({
  breakpointId: IdSchema,
  anchors: z.array(ResponsiveAnchorSchema),
  visible: z.boolean().optional(),
  transformOverride: TransformSchema.partial().optional(),
});
export type ResponsiveConstraint = z.infer<typeof ResponsiveConstraintSchema>;
