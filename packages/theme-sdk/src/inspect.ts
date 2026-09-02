import { SdkError } from "./errors.js";
import { readZipSafely } from "./packaging/zip.js";
import { StudioPackageManifestSchema, type StudioPackageManifest } from "./packaging/fdstudio.js";
import { RuntimeThemeManifestSchema, type RuntimeThemeManifest } from "./schema/theme.js";

export interface PackageInspection {
  fileCount: number;
  totalSizeBytes: number;
  files: string[];
}

export interface StudioPackageInspection extends PackageInspection {
  packageFormat: "fdstudio";
  manifest: StudioPackageManifest;
}

export interface ThemePackageInspection extends PackageInspection {
  packageFormat: "fdtheme";
  manifest: RuntimeThemeManifest;
}

/**
 * Lightweight, non-throwing-on-content-issues look at a package's manifest
 * and file listing — does not verify hashes (see `verifyManifestHashes`)
 * or run schema/semantic validation (see `validateProject`/`validateTheme`).
 * Intended for a quick "what is this file" CLI/UI summary.
 */
export function inspectPackage(archiveBytes: Uint8Array): StudioPackageInspection | ThemePackageInspection {
  const files = readZipSafely(archiveBytes);
  const manifestBytes = files["manifest.json"];
  if (!manifestBytes) {
    throw new SdkError({ code: "INVALID_PACKAGE_FORMAT", message: 'archive is missing "manifest.json"' });
  }

  let raw: unknown;
  try {
    raw = JSON.parse(new TextDecoder().decode(manifestBytes));
  } catch (error) {
    throw new SdkError({ code: "INVALID_PACKAGE_FORMAT", message: '"manifest.json" is not valid JSON', cause: error });
  }

  const packageFormat = (raw as { packageFormat?: unknown } | null)?.packageFormat;
  const fileNames = Object.keys(files);
  const totalSizeBytes = fileNames.reduce((sum, name) => sum + files[name]!.byteLength, 0);

  if (packageFormat === "fdstudio") {
    const parsed = StudioPackageManifestSchema.safeParse(raw);
    if (!parsed.success) {
      throw new SdkError({ code: "INVALID_PACKAGE_FORMAT", message: "invalid .fdstudio manifest", details: parsed.error.issues });
    }
    return { packageFormat: "fdstudio", manifest: parsed.data, fileCount: fileNames.length, totalSizeBytes, files: fileNames.sort() };
  }

  if (packageFormat === "fdtheme") {
    const parsed = RuntimeThemeManifestSchema.safeParse(raw);
    if (!parsed.success) {
      throw new SdkError({ code: "INVALID_PACKAGE_FORMAT", message: "invalid .fdtheme manifest", details: parsed.error.issues });
    }
    return { packageFormat: "fdtheme", manifest: parsed.data, fileCount: fileNames.length, totalSizeBytes, files: fileNames.sort() };
  }

  throw new SdkError({
    code: "INVALID_PACKAGE_FORMAT",
    message: `"manifest.json" has an unrecognised packageFormat "${String(packageFormat)}" (expected "fdstudio" or "fdtheme")`,
  });
}
