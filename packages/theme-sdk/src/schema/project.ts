import { z } from "zod";
import { CanvasSizeSchema, DEFAULT_CANVAS_SIZE, IdSchema, SemVerSchema } from "./primitives.js";
import { DesignTokensSchema } from "./tokens.js";
import { AssetFolderSchema, AssetRecordSchema, ImageStateGroupSchema } from "./assets.js";
import { ComponentRequirementSchema } from "./components.js";
import { MasterPageSchema, PageSchema, PopupSchema } from "./pages.js";
import { BehaviourRuleSchema } from "./behaviour.js";
import { CURRENT_PROJECT_FORMAT_VERSION } from "./versions.js";

export const ProjectMetadataSchema = z.strictObject({
  id: IdSchema,
  name: z.string().min(1),
  description: z.string().optional(),
  createdWithStudioVersion: z.string().optional(),
  createdWithSdkVersion: z.string().optional(),
});
export type ProjectMetadata = z.infer<typeof ProjectMetadataSchema>;

/**
 * Editor-only working state: current selection, camera position, open
 * panels. Never meaningful outside a live editing session, and never
 * carried into a compiled `.fdtheme` — `compile()` drops this field
 * unconditionally, and `.fdtheme` packing has no field to put it in.
 */
export const EditorStateSchema = z.strictObject({
  selectedLayerIds: z.array(IdSchema).default([]),
  viewport: z.strictObject({ x: z.number(), y: z.number(), zoom: z.number().positive() }).optional(),
  openPanelIds: z.array(z.string()).default([]),
});
export type EditorState = z.infer<typeof EditorStateSchema>;

/**
 * The current-version shape of an editable Studio project. Documents at an
 * older `formatVersion` do **not** conform to this schema directly — they
 * are read with `unknown` shape, run through the migration registry, and
 * only then validated against this schema. See `migration/registry.ts`.
 */
export const StudioProjectDocumentSchema = z.strictObject({
  formatVersion: SemVerSchema,
  metadata: ProjectMetadataSchema,
  /** Defaults to {@link DEFAULT_CANVAS_SIZE} (1920x1080) when absent. */
  canvas: CanvasSizeSchema.optional(),
  tokens: DesignTokensSchema,
  assets: z.array(AssetRecordSchema),
  /** Editor-only organisational folders for the Asset Workspace — defaults to none for older documents. */
  assetFolders: z.array(AssetFolderSchema).default([]),
  imageStateGroups: z.array(ImageStateGroupSchema),
  componentRequirements: z.array(ComponentRequirementSchema),
  masters: z.array(MasterPageSchema),
  pages: z.array(PageSchema),
  popups: z.array(PopupSchema),
  /** Project-wide, declaration-ordered no-code rules — see `BehaviourRuleSchema`. Defaults to none for older documents. */
  behaviourRules: z.array(BehaviourRuleSchema).default([]),
  editorState: EditorStateSchema.optional(),
});
export type StudioProjectDocument = z.infer<typeof StudioProjectDocumentSchema>;

export function createEmptyProject(metadata: ProjectMetadata): StudioProjectDocument {
  return {
    formatVersion: CURRENT_PROJECT_FORMAT_VERSION,
    metadata,
    canvas: DEFAULT_CANVAS_SIZE,
    tokens: {
      colors: [],
      gradients: [],
      shadows: [],
      borders: [],
      spacing: [],
      radii: [],
      fonts: [],
      breakpoints: [],
    },
    assets: [],
    assetFolders: [],
    imageStateGroups: [],
    componentRequirements: [],
    masters: [],
    pages: [],
    popups: [],
    behaviourRules: [],
  };
}
