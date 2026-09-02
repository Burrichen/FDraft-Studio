import { z } from "zod";
import { SdkError } from "../errors.js";
import { SemVerSchema } from "../schema/primitives.js";
import { FileHashRecordSchema, type FileHashRecord } from "../schema/theme.js";
import type { StudioProjectDocument } from "../schema/project.js";
import { migrateProject, type AppliedMigration } from "../migration/registry.js";
import { createDeterministicZip, readZipSafely } from "./zip.js";
import { canonicalJsonBytes } from "./canonicalJson.js";
import { sha256Hex } from "./hash.js";
import { assertManifestHashesValid } from "./verify.js";

export const PROJECT_JSON_PATH = "project.json";
export const MANIFEST_JSON_PATH = "manifest.json";

export const StudioPackageManifestSchema = z.strictObject({
  packageFormat: z.literal("fdstudio"),
  sdkVersion: z.string().min(1),
  projectFormatVersion: SemVerSchema,
  files: z.array(FileHashRecordSchema),
});
export type StudioPackageManifest = z.infer<typeof StudioPackageManifestSchema>;

export interface FdstudioPackInput {
  project: StudioProjectDocument;
  /** Every asset file the project references, keyed by its `assets/...` path. */
  assets: Record<string, Uint8Array>;
  sdkVersion: string;
}

function assetPathsReferencedBy(project: StudioProjectDocument): Set<string> {
  return new Set(project.assets.map((asset) => asset.path));
}

async function buildFileRecords(files: Record<string, Uint8Array>): Promise<FileHashRecord[]> {
  return Promise.all(
    Object.keys(files)
      .sort()
      .map(async (path) => ({ path, sha256: await sha256Hex(files[path]!), sizeBytes: files[path]!.byteLength })),
  );
}

export interface FdstudioFileSet {
  manifest: StudioPackageManifest;
  /** Every file the package must contain, keyed by its in-package path, including `manifest.json` and `project.json`. */
  files: Record<string, Uint8Array>;
}

/**
 * Builds the exact set of files (and their manifest) a `.fdstudio` package
 * contains, without deciding how they're stored — `packFdstudio` zips
 * them, `writeUnpackedProject` (in `./nodeFs.js`) writes them to a plain
 * directory so Git can diff them.
 */
export async function buildFdstudioFileSet(input: FdstudioPackInput): Promise<FdstudioFileSet> {
  const referenced = assetPathsReferencedBy(input.project);
  const provided = new Set(Object.keys(input.assets));

  for (const path of referenced) {
    if (!provided.has(path)) {
      throw new SdkError({ code: "MISSING_ASSET", message: `project references asset "${path}" but no bytes were provided for it`, path });
    }
  }
  for (const path of provided) {
    if (!referenced.has(path)) {
      throw new SdkError({ code: "MISSING_ASSET", message: `asset "${path}" was provided but is not referenced by any AssetRecord in the project`, path });
    }
  }

  const projectBytes = canonicalJsonBytes(input.project);
  const archiveFiles: Record<string, Uint8Array> = { [PROJECT_JSON_PATH]: projectBytes, ...input.assets };
  const files = await buildFileRecords(archiveFiles);

  const manifest: StudioPackageManifest = {
    packageFormat: "fdstudio",
    sdkVersion: input.sdkVersion,
    projectFormatVersion: input.project.formatVersion,
    files,
  };

  return { manifest, files: { [MANIFEST_JSON_PATH]: canonicalJsonBytes(manifest), ...archiveFiles } };
}

/** Packs a validated Studio project and its assets into `.fdstudio` archive bytes. */
export async function packFdstudio(input: FdstudioPackInput): Promise<Uint8Array> {
  const { files } = await buildFdstudioFileSet(input);
  return createDeterministicZip(files);
}

export interface FdstudioUnpackResult {
  project: StudioProjectDocument;
  assets: Record<string, Uint8Array>;
  manifest: StudioPackageManifest;
  migrationsApplied: AppliedMigration[];
}

/**
 * Verifies and parses an already-extracted `.fdstudio` file set —
 * `{path: bytes}` for every file the package contains. Shared by
 * `unpackFdstudio` (extracts a ZIP first) and `readUnpackedProject` in
 * `./nodeFs.js` (reads a plain directory instead).
 */
export async function finalizeFdstudioFileSet(files: Record<string, Uint8Array>): Promise<FdstudioUnpackResult> {
  const manifestBytes = files[MANIFEST_JSON_PATH];
  if (!manifestBytes) {
    throw new SdkError({ code: "INVALID_PACKAGE_FORMAT", message: `archive is missing "${MANIFEST_JSON_PATH}"` });
  }
  const manifestParsed = StudioPackageManifestSchema.safeParse(JSON.parse(new TextDecoder().decode(manifestBytes)));
  if (!manifestParsed.success) {
    throw new SdkError({
      code: "INVALID_PACKAGE_FORMAT",
      message: `"${MANIFEST_JSON_PATH}" does not match the expected .fdstudio manifest shape`,
      details: manifestParsed.error.issues,
    });
  }
  const manifest = manifestParsed.data;

  await assertManifestHashesValid(files, manifest.files, [MANIFEST_JSON_PATH]);

  const projectBytes = files[PROJECT_JSON_PATH];
  if (!projectBytes) {
    throw new SdkError({ code: "INVALID_PACKAGE_FORMAT", message: `archive is missing "${PROJECT_JSON_PATH}"` });
  }
  const rawProject: unknown = JSON.parse(new TextDecoder().decode(projectBytes));
  const { document: project, migrationsApplied } = migrateProject(rawProject);

  const assets: Record<string, Uint8Array> = {};
  for (const asset of project.assets) {
    const bytes = files[asset.path];
    if (!bytes) {
      throw new SdkError({ code: "MISSING_ASSET", message: `project references asset "${asset.path}" but it is not present in the archive`, path: asset.path });
    }
    const actualHash = await sha256Hex(bytes);
    if (actualHash !== asset.sha256) {
      throw new SdkError({
        code: "ASSET_HASH_MISMATCH",
        message: `asset "${asset.path}" hash mismatch: project declares ${asset.sha256}, archive has ${actualHash}`,
        path: asset.path,
      });
    }
    assets[asset.path] = bytes;
  }

  return { project, assets, manifest, migrationsApplied };
}

export async function unpackFdstudio(archiveBytes: Uint8Array): Promise<FdstudioUnpackResult> {
  return finalizeFdstudioFileSet(readZipSafely(archiveBytes));
}
