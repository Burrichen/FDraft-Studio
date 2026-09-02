import { z } from "zod";
import { IdSchema } from "./primitives.js";

/**
 * The full universe of style properties a theme is ever allowed to set on a
 * protected FDraft component. This list is closed by design: it excludes
 * anything that could change layout-breaking behaviour, load remote
 * content, or execute code (no `content`, no `background-image: url(...)`
 * pointing outside the package, no `behavior`/`expression`, etc). Component
 * requirements may further narrow this set with `allowedProperties`, but
 * can never widen it beyond this list.
 */
export const SAFE_COMPONENT_STYLE_PROPERTIES = [
  "color",
  "backgroundColor",
  "opacity",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "letterSpacing",
  "lineHeight",
  "textAlign",
  "textTransform",
  "padding",
  "margin",
  "borderRadius",
  "borderWidth",
  "borderStyle",
  "borderColor",
  "boxShadow",
] as const;
export type SafeComponentStyleProperty = (typeof SAFE_COMPONENT_STYLE_PROPERTIES)[number];

export const SafeComponentStylePropertySchema = z.enum(SAFE_COMPONENT_STYLE_PROPERTIES);

/**
 * The closed vocabulary of UI regions a `ComponentLayer` can be assigned
 * to and a `ComponentRequirement` can restrict itself to. Deliberately a
 * classification tag, not a spatial region with its own resizable
 * bounds — see `ComponentLayer.zoneKind` and
 * `ComponentRequirement.compatibleZoneKinds`.
 */
export const ZoneKindSchema = z.enum(["header", "sidebar", "main", "overlay", "footer"]);
export type ZoneKind = z.infer<typeof ZoneKindSchema>;

/**
 * A declaration that a page/theme depends on a specific FDraft-provided
 * component. `componentKey` is an opaque contract string agreed with
 * FDraft's real component adapters (e.g. `"film-poster"`,
 * `"opt-in-button"`) — the SDK does not know what it renders, only that the
 * key must exist for the theme to be usable.
 */
export const ComponentRequirementSchema = z.strictObject({
  id: IdSchema,
  componentKey: z.string().min(1),
  required: z.boolean(),
  /** Style properties this requirement permits a theme to override. */
  allowedProperties: z.array(SafeComponentStylePropertySchema),
  /** At most one placed instance of this component is meaningful per container (e.g. a single "generate draft" action) — a second placement is a validation warning, not a schema error, since a theme mid-edit may legitimately pass through that state. */
  singleton: z.boolean().optional(),
  /** Which UI regions this component may be placed in; omitted means "no zone restriction." */
  compatibleZoneKinds: z.array(ZoneKindSchema).optional(),
  /** The smallest size this component can be placed at and remain usable/reachable — below this, placement is a validation warning. */
  minWidthPx: z.number().positive().optional(),
  minHeightPx: z.number().positive().optional(),
});
export type ComponentRequirement = z.infer<typeof ComponentRequirementSchema>;

/** A style value is always a plain string or number — never a function, URL, or expression. */
export const StyleValueSchema = z.union([z.string().max(256), z.number()]);
export type StyleValue = z.infer<typeof StyleValueSchema>;

export const ComponentStyleOverrideSchema = z.strictObject({
  id: IdSchema,
  componentRequirementId: IdSchema,
  // partialRecord, not record: a theme sets *some* of the safe properties,
  // not all of them — z.record with an enum key type requires every key.
  style: z.partialRecord(SafeComponentStylePropertySchema, StyleValueSchema),
});
export type ComponentStyleOverride = z.infer<typeof ComponentStyleOverrideSchema>;
