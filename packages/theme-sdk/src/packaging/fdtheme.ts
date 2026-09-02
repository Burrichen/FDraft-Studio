import { SdkError } from "../errors.js";
import { RuntimeThemeManifestSchema, RuntimeThemeDocumentSchema, type RuntimeThemeDocument, type FileHashRecord } from "../schema/theme.js";
import { checkSemantics } from "../validation/semantic.js";
import { createDeterministicZip, readZipSafely } from "./zip.js";
import { canonicalJsonBytes } from "./canonicalJson.js";
import { sha256Hex } from "./hash.js";
import { assertManifestHashesValid } from "./verify.js";
import type { CompiledThemeBundle } from "../compile/compileTheme.js";

export const THEME_JSON_PATH = "theme.json";
export const MANIFEST_JSON_PATH = "manifest.json";

/** The theme document with its manifest's `files` field split out — packing is what decides final byte layout and hashes. */
type ThemeBody = Omit<RuntimeThemeDocument, "manifest">;

/** Packs a compiled theme bundle into deterministic `.fdtheme` archive bytes. */
export async function packFdtheme(bundle: CompiledThemeBundle): Promise<Uint8Array> {
  const { manifest: _manifest, ...body } = bundle.document;
  void _manifest;
  const themeBodyBytes = canonicalJsonBytes(body satisfies ThemeBody);

  const archiveFiles: Record<string, Uint8Array> = { [THEME_JSON_PATH]: themeBodyBytes, ...bundle.assets };
  const files: FileHashRecord[] = await Promise.all(
    Object.keys(archiveFiles)
      .sort()
      .map(async (path) => ({ path, sha256: await sha256Hex(archiveFiles[path]!), sizeBytes: archiveFiles[path]!.byteLength })),
  );

  const manifest = { ...bundle.document.manifest, files };

  return createDeterministicZip({
    [MANIFEST_JSON_PATH]: canonicalJsonBytes(manifest),
    ...archiveFiles,
  });
}

export interface FdthemeUnpackResult {
  document: RuntimeThemeDocument;
  /** Every asset the theme declares, keyed by its `assets/...` path — e.g. for a host importing a compiled theme back into an editable project. */
  assets: Record<string, Uint8Array>;
}

/** Unpacks and fully verifies `.fdtheme` archive bytes: manifest shape, file hashes, and semantic integrity. */
export async function unpackFdtheme(archiveBytes: Uint8Array): Promise<FdthemeUnpackResult> {
  const files = readZipSafely(archiveBytes);

  const manifestBytes = files[MANIFEST_JSON_PATH];
  if (!manifestBytes) {
    throw new SdkError({ code: "INVALID_PACKAGE_FORMAT", message: `archive is missing "${MANIFEST_JSON_PATH}"` });
  }
  const manifestParsed = RuntimeThemeManifestSchema.safeParse(JSON.parse(new TextDecoder().decode(manifestBytes)));
  if (!manifestParsed.success) {
    throw new SdkError({
      code: "INVALID_PACKAGE_FORMAT",
      message: `"${MANIFEST_JSON_PATH}" does not match the expected .fdtheme manifest shape`,
      details: manifestParsed.error.issues,
    });
  }
  const manifest = manifestParsed.data;

  await assertManifestHashesValid(files, manifest.files, [MANIFEST_JSON_PATH]);

  const themeBytes = files[THEME_JSON_PATH];
  if (!themeBytes) {
    throw new SdkError({ code: "INVALID_PACKAGE_FORMAT", message: `archive is missing "${THEME_JSON_PATH}"` });
  }
  const body: unknown = JSON.parse(new TextDecoder().decode(themeBytes));

  const documentParsed = RuntimeThemeDocumentSchema.safeParse({ ...(body as object), manifest });
  if (!documentParsed.success) {
    throw new SdkError({
      code: "SCHEMA_VALIDATION_FAILED",
      message: "theme document failed schema validation",
      details: documentParsed.error.issues,
    });
  }

  const semanticIssues = checkSemantics(documentParsed.data);
  if (semanticIssues.length > 0) {
    throw new SdkError({
      code: "BROKEN_REFERENCE",
      message: `theme document failed semantic validation (${semanticIssues.length} issue(s))`,
      details: semanticIssues,
    });
  }

  const assets: Record<string, Uint8Array> = {};
  for (const asset of documentParsed.data.assets) {
    const bytes = files[asset.path];
    if (!bytes) {
      throw new SdkError({ code: "MISSING_ASSET", message: `theme references asset "${asset.path}" but it is not present in the archive`, path: asset.path });
    }
    assets[asset.path] = bytes;
  }

  return { document: documentParsed.data, assets };
}
