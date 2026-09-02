import { createId, createProject, CURRENT_PROJECT_FORMAT_VERSION, type StudioProjectDocument } from "@fdraft/theme-sdk";
import { buildFdstudioFileSet, compileProjectToFdtheme, finalizeFdstudioFileSet, packFdstudio, unpackFdstudio, unpackFdtheme } from "@fdraft/theme-sdk/packaging";
import type { FilePlatform } from "../platform/types.js";
import { atomicWriteDirectory, atomicWriteFile } from "./atomicSave.js";
import { readDirectoryFileSet } from "./directoryFileSet.js";

export const FDSTUDIO_EXTENSION = ".fdstudio";
export const FDTHEME_EXTENSION = ".fdtheme";

export type ProjectStorageKind = "file" | "directory";

export interface OpenProject {
  kind: ProjectStorageKind;
  path: string;
  project: StudioProjectDocument;
  assets: Record<string, Uint8Array>;
  /** `undefined` until the first successful save. */
  lastSavedAt: number | undefined;
}

/**
 * `open.assets` is deliberately an additive-only byte pool during a
 * session — importing/replacing an asset adds bytes, but undoing or
 * deleting an `AssetRecord` never removes its bytes from the pool (only
 * the *reference* is undo-tracked, via `ProjectSession`'s command stack).
 * That's what makes "redo" and "undo a delete" always find their bytes
 * still there. This is the one place that additive growth gets resolved
 * back down to exactly what `project.assets` currently references —
 * required before `packFdstudio`/`buildFdstudioFileSet`, which throw
 * `MISSING_ASSET` for *either* a referenced-but-absent path *or* an
 * extra, unreferenced one.
 */
export function pruneAssetsToProject(assets: Record<string, Uint8Array>, project: StudioProjectDocument): Record<string, Uint8Array> {
  const pruned: Record<string, Uint8Array> = {};
  for (const asset of project.assets) {
    const bytes = assets[asset.path];
    if (bytes) pruned[asset.path] = bytes;
  }
  return pruned;
}

/** A minimal but real starting point — one empty page — rather than a completely blank project. */
export function createMinimalProjectTemplate(name: string): StudioProjectDocument {
  const project = createProject({ id: createId(), name });
  project.pages.push({ id: createId(), name: "Home", slug: "home", layers: [], animations: [] });
  return project;
}

function isFdstudioFile(platform: FilePlatform, path: string): boolean {
  return platform.basename(path).toLowerCase().endsWith(FDSTUDIO_EXTENSION);
}

/** Opens either a single `.fdstudio` file or an unpacked project directory, detected from the path itself. */
export async function openProjectFromPath(platform: FilePlatform, path: string): Promise<OpenProject> {
  const info = await platform.stat(path);

  if (info.isDirectory) {
    const files = await readDirectoryFileSet(platform, path);
    const { project, assets } = await finalizeFdstudioFileSet(files);
    return { kind: "directory", path, project, assets, lastSavedAt: info.mtimeMs };
  }

  if (!isFdstudioFile(platform, path)) {
    throw new Error(`"${path}" is not a directory or a ${FDSTUDIO_EXTENSION} file`);
  }
  const bytes = await platform.readFile(path);
  const { project, assets } = await unpackFdstudio(bytes);
  return { kind: "file", path, project, assets, lastSavedAt: info.mtimeMs };
}

/**
 * Saves in place, atomically, re-validating whatever was actually written
 * (not just the in-memory value) before it's ever visible at `open.path` —
 * see `atomicSave.ts`.
 */
export async function saveProject(platform: FilePlatform, open: OpenProject, sdkVersion: string): Promise<OpenProject> {
  const assets = pruneAssetsToProject(open.assets, open.project);
  if (open.kind === "file") {
    const bytes = await packFdstudio({ project: open.project, assets, sdkVersion });
    await atomicWriteFile(platform, open.path, bytes, async (writtenBytes) => {
      await unpackFdstudio(writtenBytes);
    });
  } else {
    const { files } = await buildFdstudioFileSet({ project: open.project, assets, sdkVersion });
    await atomicWriteDirectory(platform, open.path, files, async (tempDir) => {
      const readBack = await readDirectoryFileSet(platform, tempDir);
      await finalizeFdstudioFileSet(readBack);
    });
  }
  return { ...open, lastSavedAt: platform.now() };
}

/** Saves the current in-memory project to a different path/kind, without touching the original. */
export async function saveProjectAs(platform: FilePlatform, open: OpenProject, newPath: string, newKind: ProjectStorageKind, sdkVersion: string): Promise<OpenProject> {
  return saveProject(platform, { ...open, path: newPath, kind: newKind, lastSavedAt: undefined }, sdkVersion);
}

/** A duplicate is a genuinely separate project (new project id), saved immediately to `destPath`. */
export async function duplicateProject(platform: FilePlatform, open: OpenProject, destPath: string, destKind: ProjectStorageKind, sdkVersion: string): Promise<OpenProject> {
  const duplicated: StudioProjectDocument = { ...open.project, metadata: { ...open.project.metadata, id: createId() } };
  return saveProject(platform, { kind: destKind, path: destPath, project: duplicated, assets: open.assets, lastSavedAt: undefined }, sdkVersion);
}

/** A backup is always a standalone `.fdstudio` snapshot, regardless of the source project's own storage kind, and never touches the original. */
export async function exportProjectBackup(platform: FilePlatform, open: OpenProject, destPath: string, sdkVersion: string): Promise<void> {
  const bytes = await packFdstudio({ project: open.project, assets: pruneAssetsToProject(open.assets, open.project), sdkVersion });
  await atomicWriteFile(platform, destPath, bytes, async (writtenBytes) => {
    await unpackFdstudio(writtenBytes);
  });
}

export interface RuntimeThemeExportOptions {
  minRendererVersion: string;
}

/**
 * Compiles the current project straight to a `.fdtheme` archive and
 * writes it atomically — the export path the SDK had a function for
 * (`compileProjectToFdtheme`) but nothing in Studio ever called until
 * now. Re-unpacks what was actually written (not just the in-memory
 * bytes) before it's considered a successful export, exactly like every
 * other write in this file.
 */
export async function exportRuntimeTheme(platform: FilePlatform, open: OpenProject, destPath: string, options: RuntimeThemeExportOptions): Promise<void> {
  const bytes = await compileProjectToFdtheme(open.project, open.assets, options);
  await atomicWriteFile(platform, destPath, bytes, async (writtenBytes) => {
    await unpackFdtheme(writtenBytes);
  });
}

export interface ImportFdthemeResult {
  project: StudioProjectDocument;
  assets: Record<string, Uint8Array>;
  /** Concrete, honest statements about what a compiled theme can't perfectly reconstruct — shown to the user before they save. */
  warnings: string[];
}

/**
 * Imports a compiled `.fdtheme` into a brand-new editable project (a new
 * `metadata.id` — this is deliberately not "the same project" as whatever
 * Studio project may have originally produced the theme, since that
 * project isn't recoverable from the compiled artifact).
 */
export async function importProjectFromFdtheme(fdthemeBytes: Uint8Array): Promise<ImportFdthemeResult> {
  const { document, assets } = await unpackFdtheme(fdthemeBytes);

  const project: StudioProjectDocument = {
    formatVersion: CURRENT_PROJECT_FORMAT_VERSION,
    metadata: {
      id: createId(),
      name: document.manifest.themeName,
      description: `Imported from a compiled .fdtheme package (original theme id ${document.manifest.themeId}).`,
    },
    canvas: document.canvas,
    tokens: document.tokens,
    assets: document.assets,
    assetFolders: [],
    imageStateGroups: document.imageStateGroups,
    componentRequirements: document.componentRequirements,
    masters: document.masters,
    pages: document.pages,
    popups: document.popups,
    behaviourRules: document.behaviourRules,
  };

  const warnings = [
    "This project was created by importing a compiled .fdtheme package, not opened from an editable source.",
    "Any asset not referenced anywhere in the theme was already discarded when it was compiled and cannot be recovered here.",
    "Editor state (layer selection, canvas viewport, open panels) isn't part of a compiled theme and starts fresh.",
  ];

  return { project, assets, warnings };
}
