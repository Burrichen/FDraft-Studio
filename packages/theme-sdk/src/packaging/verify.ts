import { SdkError } from "../errors.js";
import type { FileHashRecord } from "../schema/theme.js";
import { sha256Hex } from "./hash.js";

export interface HashVerificationIssue {
  path: string;
  message: string;
}

/**
 * Verifies that every file a manifest declares is present with the exact
 * declared size and sha256, and that the archive contains no file outside
 * `extraAllowedPaths` (e.g. `manifest.json` itself) that the manifest
 * doesn't account for.
 */
export async function verifyManifestHashes(
  files: Record<string, Uint8Array>,
  fileRecords: FileHashRecord[],
  extraAllowedPaths: readonly string[] = [],
): Promise<HashVerificationIssue[]> {
  const issues: HashVerificationIssue[] = [];
  const declaredPaths = new Set(fileRecords.map((f) => f.path));

  for (const record of fileRecords) {
    const bytes = files[record.path];
    if (!bytes) {
      issues.push({ path: record.path, message: "declared in manifest but missing from archive" });
      continue;
    }
    if (bytes.byteLength !== record.sizeBytes) {
      issues.push({
        path: record.path,
        message: `size mismatch: manifest declares ${record.sizeBytes} bytes, archive has ${bytes.byteLength}`,
      });
      continue;
    }
    const actualHash = await sha256Hex(bytes);
    if (actualHash !== record.sha256) {
      issues.push({ path: record.path, message: `sha256 mismatch: manifest declares ${record.sha256}, archive has ${actualHash}` });
    }
  }

  for (const path of Object.keys(files)) {
    if (!declaredPaths.has(path) && !extraAllowedPaths.includes(path)) {
      issues.push({ path, message: "present in archive but not declared in manifest" });
    }
  }

  return issues;
}

export async function assertManifestHashesValid(
  files: Record<string, Uint8Array>,
  fileRecords: FileHashRecord[],
  extraAllowedPaths: readonly string[] = [],
): Promise<void> {
  const issues = await verifyManifestHashes(files, fileRecords, extraAllowedPaths);
  if (issues.length > 0) {
    throw new SdkError({
      code: "MANIFEST_HASH_MISMATCH",
      message: `${issues.length} file(s) failed manifest hash verification`,
      details: issues,
    });
  }
}
