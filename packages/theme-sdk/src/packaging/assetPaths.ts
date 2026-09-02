import { SdkError } from "../errors.js";
import { SAFE_ASSET_EXTENSIONS, type AssetKind } from "../schema/assets.js";
import { sha256Hex } from "./hash.js";

/**
 * Content-addressed in-package path for an asset. Using the asset's own
 * hash (rather than the user's original filename) means re-importing an
 * unchanged file always produces the same path, identical assets from
 * different imports automatically de-duplicate, and there is never a
 * filename collision to resolve.
 */
export async function computeAssetPath(kind: AssetKind, bytes: Uint8Array, originalFileName: string): Promise<string> {
  const dot = originalFileName.lastIndexOf(".");
  const ext = dot === -1 ? "" : originalFileName.slice(dot).toLowerCase();
  const allowed = SAFE_ASSET_EXTENSIONS[kind];
  if (!allowed.includes(ext)) {
    throw new SdkError({
      code: "DANGEROUS_FILE_TYPE",
      message: `"${originalFileName}" has extension "${ext}", which is not valid for asset kind "${kind}" (allowed: ${allowed.join(", ")})`,
    });
  }
  return `assets/${await sha256Hex(bytes)}${ext}`;
}
