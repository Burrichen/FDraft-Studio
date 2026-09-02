import { z } from "zod";
import type { Id } from "./primitives.js";
import { IdSchema } from "./primitives.js";
import {
  CropSchema,
  MaskSchema,
  ResponsiveConstraintSchema,
  TransformSchema,
  type Crop,
  type Mask,
  type ResponsiveConstraint,
  type Transform,
} from "./transform.js";
import {
  InteractionStateSchema,
  EffectDeclarationSchema,
  type InteractionState,
  type EffectDeclaration,
} from "./interaction.js";
import { ComponentStyleOverrideSchema, ZoneKindSchema, type ComponentStyleOverride } from "./components.js";

const LayerBaseFields = {
  id: IdSchema,
  name: z.string().min(1),
  transform: TransformSchema,
  opacity: z.number().min(0).max(1),
  visible: z.boolean(),
  locked: z.boolean(),
  zIndex: z.number().int(),
  responsive: z.array(ResponsiveConstraintSchema).default([]),
  interactionStates: z.array(InteractionStateSchema).default([]),
};

/** Fields shared by every layer type, independent of its schema. */
export interface LayerBase {
  id: Id;
  name: string;
  transform: Transform;
  opacity: number;
  visible: boolean;
  locked: boolean;
  zIndex: number;
  responsive: ResponsiveConstraint[];
  interactionStates: InteractionState[];
}

export const ImageLayerSchema = z.strictObject({
  ...LayerBaseFields,
  type: z.literal("image"),
  assetId: IdSchema,
  stateGroupId: IdSchema.optional(),
  crop: CropSchema.optional(),
  mask: MaskSchema.optional(),
});
export type ImageLayer = z.infer<typeof ImageLayerSchema>;

export const TextAlignSchema = z.enum(["left", "center", "right", "justify"]);
export const TextWrapSchema = z.enum(["normal", "nowrap", "balance"]);
export const FontWeightSchema = z.union([z.literal(400), z.literal(500), z.literal(600), z.literal(700)]);

export const TextLayerSchema = z.strictObject({
  ...LayerBaseFields,
  type: z.literal("text"),
  text: z.string().max(10_000),
  fontTokenId: IdSchema.optional(),
  fontSizePx: z.number().positive(),
  colorTokenId: IdSchema.optional(),
  align: TextAlignSchema,
  /** Overrides the chosen font token's own weight for this layer only, when set. */
  fontWeightOverride: FontWeightSchema.optional(),
  lineHeightMultiplier: z.number().positive().optional(),
  letterSpacingPx: z.number().optional(),
  wrap: TextWrapSchema.optional(),
});
export type TextLayer = z.infer<typeof TextLayerSchema>;

export const ShapeKindSchema = z.enum(["rect", "ellipse", "line", "path"]);

export const ShapeLayerSchema = z.strictObject({
  ...LayerBaseFields,
  type: z.literal("shape"),
  shape: ShapeKindSchema,
  fillColorTokenId: IdSchema.optional(),
  /** Takes precedence over `fillColorTokenId` when both are set. */
  fillGradientTokenId: IdSchema.optional(),
  strokeBorderTokenId: IdSchema.optional(),
  cornerRadiusTokenId: IdSchema.optional(),
  /** Composed into a single CSS `box-shadow` list, in array order — "one or more bounded shadows." */
  shadowTokenIds: z.array(IdSchema).optional(),
  /** Only used when `shape === "path"`. Bounded length, sanitised like SVG path data. */
  pathData: z.string().max(4096).optional(),
});
export type ShapeLayer = z.infer<typeof ShapeLayerSchema>;

export const EffectLayerSchema = z.strictObject({
  ...LayerBaseFields,
  type: z.literal("effect"),
  effect: EffectDeclarationSchema,
});
export type EffectLayer = z.infer<typeof EffectLayerSchema>;

/** A protected FDraft component placed on the canvas (e.g. a real poster grid, opt-in button). */
export const ComponentLayerSchema = z.strictObject({
  ...LayerBaseFields,
  type: z.literal("component"),
  componentKey: z.string().min(1),
  componentRequirementId: IdSchema,
  styleOverrides: z.array(ComponentStyleOverrideSchema).default([]),
  /** Which UI region this placement belongs to — checked against its requirement's `compatibleZoneKinds`, if any. */
  zoneKind: ZoneKindSchema.optional(),
  /**
   * Theme-authored text for this component's declared copy slots (keyed
   * by the adapter's own `ComponentCopySlotDeclaration.key`, defined in
   * `@fdraft/theme-renderer`) — never the component's action/route/event
   * logic, only what it displays. A missing or blank entry for a
   * *required* slot falls back to the adapter's own approved default
   * text at render time, never to an empty string.
   */
  copyOverrides: z.record(z.string().min(1), z.string().max(2000)).optional(),
  /**
   * Named alternative wordings for a declared copy slot (keyed by the same
   * slot key as `copyOverrides`), each with its own stable `id`. Plain
   * copy text only — never a Behaviour expression, conditional code, HTML,
   * or data lookup. A Behaviour rule's `selectCopyVariant` action picks
   * one of these by id at runtime; the slot falls back to `copyOverrides`/
   * the adapter's own default when no variant is currently selected.
   */
  copyVariants: z.record(z.string().min(1), z.array(z.strictObject({ id: IdSchema, text: z.string().max(2000) }))).optional(),
});
export type ComponentLayer = z.infer<typeof ComponentLayerSchema>;

/** A named zone where FDraft injects real, non-theme content at render time. */
export const SlotLayerSchema = z.strictObject({
  ...LayerBaseFields,
  type: z.literal("slot"),
  slotKey: z.string().min(1),
});
export type SlotLayer = z.infer<typeof SlotLayerSchema>;

/**
 * A group's own schema is defined further down (it must reference
 * `LayerSchema`, which must in turn reference this type) — declared here by
 * hand since `z.infer` isn't available until both sides of the recursion
 * exist.
 */
export interface GroupLayer extends LayerBase {
  type: "group";
  children: Layer[];
}

export type Layer =
  | ImageLayer
  | TextLayer
  | ShapeLayer
  | EffectLayer
  | ComponentLayer
  | SlotLayer
  | GroupLayer;

export const LayerSchema: z.ZodType<Layer> = z.lazy(() =>
  z.discriminatedUnion("type", [
    ImageLayerSchema,
    TextLayerSchema,
    ShapeLayerSchema,
    EffectLayerSchema,
    ComponentLayerSchema,
    SlotLayerSchema,
    GroupLayerSchema,
  ]),
);

// Deliberately left without an explicit `z.ZodType<GroupLayer>` annotation:
// annotating it (even via `as`) erases the internal "discriminable" marker
// `z.discriminatedUnion` needs from each member, which breaks both the
// type-check and (silently) the runtime discriminated-union optimisation
// for `LayerSchema` above. `LayerSchema`'s own annotation is enough to
// break the mutual-recursion cycle for TypeScript.
export const GroupLayerSchema = z.lazy(() =>
  z.strictObject({
    ...LayerBaseFields,
    type: z.literal("group"),
    children: z.array(LayerSchema).min(1),
  }),
);

// Re-exported only so downstream modules can name these without reaching
// into ./transform.js / ./interaction.js / ./components.js directly.
export type { Crop, Mask, ComponentStyleOverride, EffectDeclaration };
