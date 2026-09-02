import { z } from "zod";
import { CanvasSizeSchema, IdSchema, RelativeAssetPathSchema, Sha256Schema, SemVerSchema } from "./primitives.js";
import { DesignTokensSchema } from "./tokens.js";
import { AssetRecordSchema, ImageStateGroupSchema } from "./assets.js";
import { ComponentRequirementSchema } from "./components.js";
import { MasterPageSchema, PageSchema, PopupSchema } from "./pages.js";
import { BehaviourRuleSchema } from "./behaviour.js";

export const FileHashRecordSchema = z.strictObject({
  path: RelativeAssetPathSchema,
  sha256: Sha256Schema,
  sizeBytes: z.number().int().nonnegative(),
});
export type FileHashRecord = z.infer<typeof FileHashRecordSchema>;

export const ThemeCapabilitySchema = z.enum([
  "responsive",
  "animations",
  "effects",
  "masters",
  "popups",
  "behaviour",
]);
export type ThemeCapability = z.infer<typeof ThemeCapabilitySchema>;

/**
 * Deliberately timestamp-free: including a build time here would make
 * compiling identical input twice produce different manifest bytes, which
 * breaks the deterministic-hash requirement. Provenance/build-time
 * information belongs in release metadata outside the hashed package, not
 * in the manifest.
 */
export const RuntimeThemeManifestSchema = z.strictObject({
  packageFormat: z.literal("fdtheme"),
  themeFormatVersion: SemVerSchema,
  minRendererVersion: SemVerSchema,
  themeId: IdSchema,
  themeName: z.string().min(1),
  sourceProjectFormatVersion: SemVerSchema,
  requiredComponentKeys: z.array(z.string().min(1)),
  capabilities: z.array(ThemeCapabilitySchema),
  files: z.array(FileHashRecordSchema),
});
export type RuntimeThemeManifest = z.infer<typeof RuntimeThemeManifestSchema>;

/**
 * The compiled, runtime-only document FDraft consumes. Contains no editor
 * state, no history, and nothing outside what the renderer needs to draw
 * pages and popups.
 */
export const RuntimeThemeDocumentSchema = z.strictObject({
  manifest: RuntimeThemeManifestSchema,
  canvas: CanvasSizeSchema.optional(),
  tokens: DesignTokensSchema,
  assets: z.array(AssetRecordSchema),
  imageStateGroups: z.array(ImageStateGroupSchema),
  componentRequirements: z.array(ComponentRequirementSchema),
  masters: z.array(MasterPageSchema),
  pages: z.array(PageSchema),
  popups: z.array(PopupSchema),
  behaviourRules: z.array(BehaviourRuleSchema),
});
export type RuntimeThemeDocument = z.infer<typeof RuntimeThemeDocumentSchema>;
