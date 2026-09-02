import { SdkError } from "../errors.js";
import { validateProject } from "../validation/validateProject.js";
import type { StudioProjectDocument } from "../schema/project.js";
import type { RuntimeThemeDocument, ThemeCapability } from "../schema/theme.js";
import type { Layer } from "../schema/layers.js";
import type { MasterPage, Page, Popup } from "../schema/pages.js";
import { CURRENT_THEME_FORMAT_VERSION } from "../schema/versions.js";
import { collectUsedAssetIds } from "./assetUsage.js";

export interface CompileThemeOptions {
  /** The lowest `@fdraft/theme-renderer` version this theme is allowed to load in. */
  minRendererVersion: string;
}

export interface CompiledThemeBundle {
  /** A `RuntimeThemeDocument` with `manifest.files` left empty — populated later by `packFdtheme`, which knows the final serialised byte layout. */
  document: RuntimeThemeDocument;
  /** Only the asset bytes the compiled theme actually references. */
  assets: Record<string, Uint8Array>;
}

function walkLayers(layers: Layer[], visit: (layer: Layer) => void): void {
  for (const layer of layers) {
    visit(layer);
    if (layer.type === "group") walkLayers(layer.children, visit);
  }
}

export function detectCapabilities(project: StudioProjectDocument): ThemeCapability[] {
  const capabilities = new Set<ThemeCapability>();
  if (project.masters.length > 0) capabilities.add("masters");
  if (project.popups.length > 0) capabilities.add("popups");
  if (project.behaviourRules.length > 0) capabilities.add("behaviour");

  const containers: (MasterPage | Page | Popup)[] = [...project.masters, ...project.pages, ...project.popups];
  for (const container of containers) {
    if (container.animations.length > 0) capabilities.add("animations");
    walkLayers(container.layers, (layer) => {
      if (layer.responsive.length > 0) capabilities.add("responsive");
      if (layer.type === "effect") capabilities.add("effects");
    });
  }
  return [...capabilities].sort();
}

/**
 * Transforms a valid Studio project into the compiled, runtime-only shape
 * FDraft consumes: strips editor-only state, drops asset bytes nothing
 * references, and derives the manifest's component/capability
 * declarations. Does **not** serialise or hash anything — that happens in
 * `packFdtheme`, which controls the exact archive byte layout.
 */
export function compileTheme(
  project: StudioProjectDocument,
  projectAssets: Record<string, Uint8Array>,
  options: CompileThemeOptions,
): CompiledThemeBundle {
  const validation = validateProject(project);
  if (!validation.valid || !validation.document) {
    throw new SdkError({
      code: "SCHEMA_VALIDATION_FAILED",
      message: "cannot compile an invalid project",
      details: validation.issues,
    });
  }

  const usedAssetIds = collectUsedAssetIds(project);
  // `tags`/`folderId`/`originalFileName` are Studio's own Asset Workspace
  // organisation — never meaningful to the runtime, so they're dropped
  // here rather than carried into the shipped theme package.
  const usedAssets = project.assets
    .filter((asset) => usedAssetIds.has(asset.id))
    .map(({ tags: _tags, folderId: _folderId, originalFileName: _originalFileName, ...rest }) => rest);
  const assets: Record<string, Uint8Array> = {};
  for (const asset of usedAssets) {
    const bytes = projectAssets[asset.path];
    if (!bytes) {
      throw new SdkError({ code: "MISSING_ASSET", message: `asset "${asset.path}" is referenced but no bytes were provided`, path: asset.path });
    }
    assets[asset.path] = bytes;
  }

  const document: RuntimeThemeDocument = {
    manifest: {
      packageFormat: "fdtheme",
      themeFormatVersion: CURRENT_THEME_FORMAT_VERSION,
      minRendererVersion: options.minRendererVersion,
      themeId: project.metadata.id,
      themeName: project.metadata.name,
      sourceProjectFormatVersion: project.formatVersion,
      requiredComponentKeys: [...new Set(project.componentRequirements.map((c) => c.componentKey))].sort(),
      capabilities: detectCapabilities(project),
      files: [],
    },
    canvas: project.canvas,
    tokens: project.tokens,
    assets: usedAssets,
    imageStateGroups: project.imageStateGroups,
    componentRequirements: project.componentRequirements,
    masters: project.masters,
    pages: project.pages,
    popups: project.popups,
    behaviourRules: project.behaviourRules,
  };

  return { document, assets };
}
