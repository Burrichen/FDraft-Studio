import { z } from "zod";
import { IdSchema } from "./primitives.js";
import { LayerSchema } from "./layers.js";
import { ConditionSchema, AnimationDeclarationSchema } from "./interaction.js";
import { TransformSchema } from "./transform.js";

/**
 * A page/popup's explicit, per-layer override of one of its master's
 * layers — deliberately narrow (position/size/rotation and
 * visibility/opacity only, never content or type) rather than an
 * arbitrary partial-`Layer` patch, so an override can never turn a
 * master's image into a different kind of layer or change what it
 * displays, only where/whether it appears on this page. Keyed by the
 * *master layer's own id* on the container that inherits it — never
 * duplicated as a same-id layer on the page itself (which would trip
 * `DUPLICATE_ID`), and trivially "reset to inherited" by deleting the
 * entry, or "identify override" by checking whether the key exists.
 */
export const MasterLayerOverrideSchema = z.strictObject({
  transform: TransformSchema.partial().optional(),
  visible: z.boolean().optional(),
  opacity: z.number().min(0).max(1).optional(),
});
export type MasterLayerOverride = z.infer<typeof MasterLayerOverrideSchema>;

/**
 * A reusable base layout other pages/popups can inherit from.
 * `parentMasterId` allows multi-level inheritance chains; the SDK's
 * semantic validation rejects any cycle in that chain (see
 * `validation/semantic.ts`).
 */
export const MasterPageSchema = z.strictObject({
  id: IdSchema,
  name: z.string().min(1),
  parentMasterId: IdSchema.optional(),
  layers: z.array(LayerSchema).default([]),
  animations: z.array(AnimationDeclarationSchema).default([]),
});
export type MasterPage = z.infer<typeof MasterPageSchema>;

export const PageSchema = z.strictObject({
  id: IdSchema,
  name: z.string().min(1),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be a lowercase, hyphenated slug"),
  masterId: IdSchema.optional(),
  /** Overrides for this page's own inherited master layers — see `MasterLayerOverrideSchema`. Ignored/meaningless when `masterId` is unset. */
  masterLayerOverrides: z.record(IdSchema, MasterLayerOverrideSchema).optional(),
  layers: z.array(LayerSchema).default([]),
  animations: z.array(AnimationDeclarationSchema).default([]),
});
export type Page = z.infer<typeof PageSchema>;

export const PopupTriggerSchema = z.enum(["onLoad", "onEventPhase", "onCondition"]);

export const PopupSchema = z.strictObject({
  id: IdSchema,
  name: z.string().min(1),
  masterId: IdSchema.optional(),
  masterLayerOverrides: z.record(IdSchema, MasterLayerOverrideSchema).optional(),
  trigger: PopupTriggerSchema,
  condition: ConditionSchema.optional(),
  layers: z.array(LayerSchema).default([]),
  animations: z.array(AnimationDeclarationSchema).default([]),
});
export type Popup = z.infer<typeof PopupSchema>;
