import { z } from "zod";
import { IdSchema, RelativeAssetPathSchema, Sha256Schema } from "./primitives.js";

export const AssetKindSchema = z.enum(["image", "svg", "font"]);
export type AssetKind = z.infer<typeof AssetKindSchema>;

/**
 * Extension-to-kind allowlist. This is intentionally closed: anything not
 * listed here is rejected by the security layer regardless of what a
 * project or theme document claims its `kind` is.
 */
export const SAFE_ASSET_EXTENSIONS: Record<AssetKind, readonly string[]> = {
  image: [".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif"],
  svg: [".svg"],
  font: [".woff2", ".woff", ".ttf", ".otf"],
};

export const AssetRecordSchema = z.strictObject({
  id: IdSchema,
  kind: AssetKindSchema,
  /** Path relative to the package's `assets/` directory. */
  path: RelativeAssetPathSchema,
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  sha256: Sha256Schema,
  /** Pixel dimensions, for image/svg assets that declare them. */
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  alt: z.string().optional(),
  /**
   * The current human-facing name shown in the Asset Workspace —
   * `path` is content-addressed and never meaningful to a user. Starts
   * as the sanitised import filename but is freely renamable afterward
   * without touching `path`/`sha256`/any layer reference (both are keyed
   * off `id`, never off this field).
   */
  name: z.string().min(1).max(255).optional(),
  /** The untouched filename as originally imported, kept even after a rename so "where did this come from" stays answerable. Immutable once set. */
  originalFileName: z.string().min(1).max(255).optional(),
  /** Editor-only organisation — searchable, freeform. Never meaningful to the runtime. */
  tags: z.array(z.string().min(1)).optional(),
  /** Editor-only organisation — which `AssetFolder` this asset is filed under, if any. */
  folderId: IdSchema.optional(),
});
export type AssetRecord = z.infer<typeof AssetRecordSchema>;

/** Editor-only folders for organising the Asset Workspace — never meaningful to the compiled runtime theme. */
export const AssetFolderSchema = z.strictObject({
  id: IdSchema,
  name: z.string().min(1),
  parentId: IdSchema.optional(),
});
export type AssetFolder = z.infer<typeof AssetFolderSchema>;

export const ImageStateSchema = z.strictObject({
  id: IdSchema,
  name: z.string().min(1),
  assetId: IdSchema,
});
export type ImageState = z.infer<typeof ImageStateSchema>;

/**
 * A named group of interchangeable image states for one visual slot, e.g.
 * default/hover/disabled artwork for the same layer. `defaultStateId` must
 * be one of `states[].id`.
 */
export const ImageStateGroupSchema = z.strictObject({
  id: IdSchema,
  name: z.string().min(1),
  states: z.array(ImageStateSchema).min(1),
  defaultStateId: IdSchema,
});
export type ImageStateGroup = z.infer<typeof ImageStateGroupSchema>;
