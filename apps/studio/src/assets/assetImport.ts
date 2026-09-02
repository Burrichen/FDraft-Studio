import { SdkError, sanitizeSvg, SAFE_ASSET_EXTENSIONS, type AssetKind, type StudioProjectDocument } from "@fdraft/theme-sdk";
import { computeAssetPath, MAX_FILE_SIZE_BYTES, sha256Hex } from "@fdraft/theme-sdk/packaging";
import { dedupeDisplayName, sanitizeDisplayFileName } from "./fileNames.js";

const MIME_BY_EXTENSION: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
};

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot).toLowerCase();
}

/** Which `AssetKind` a filename's extension belongs to, or `undefined` if it isn't in the closed safe-extension allowlist at all. */
export function inferAssetKind(fileName: string): AssetKind | undefined {
  const ext = extensionOf(fileName);
  for (const kind of Object.keys(SAFE_ASSET_EXTENSIONS) as AssetKind[]) {
    if (SAFE_ASSET_EXTENSIONS[kind].includes(ext)) return kind;
  }
  return undefined;
}

export interface AssetImportPlan {
  /** Final display name — sanitised and, if it collides with an existing asset's name, disambiguated. */
  fileName: string;
  kind: AssetKind;
  /** The bytes to actually store — for SVG this is the *sanitised* text re-encoded, never the original raw bytes. */
  bytes: Uint8Array;
  path: string;
  sha256: string;
  sizeBytes: number;
  mimeType: string;
  /** True when this exact content already exists as an asset in the project — the caller should offer to reuse rather than add a duplicate. */
  reused: boolean;
  existingAssetId?: string;
  /** SVG only: which unsafe constructs were stripped before the file was accepted, for an honest "here's what we removed" notice. */
  svgStripped?: string[];
}

/**
 * Validates and prepares one imported file — extension/size checks, SVG
 * sanitisation (never accepts unsafe SVG, even by stripping down to
 * something clean-but-different from what the user picked, without
 * telling them), content-addressed hashing, duplicate-content detection
 * against the project's existing assets, and display-name
 * sanitisation/collision handling. Never mutates `project` — the actual
 * `AssetRecord` is created by a `Command`, exactly like every other
 * project edit, so importing is undoable.
 */
export async function planAssetImport(fileName: string, rawBytes: Uint8Array, project: StudioProjectDocument): Promise<AssetImportPlan> {
  const kind = inferAssetKind(fileName);
  if (!kind) {
    const ext = extensionOf(fileName);
    throw new SdkError({ code: "DANGEROUS_FILE_TYPE", message: `"${fileName}" has extension "${ext}", which isn't a supported asset type` });
  }
  if (rawBytes.byteLength === 0) {
    throw new SdkError({ code: "SCHEMA_VALIDATION_FAILED", message: `"${fileName}" is empty` });
  }
  if (rawBytes.byteLength > MAX_FILE_SIZE_BYTES) {
    throw new SdkError({ code: "FILE_TOO_LARGE", message: `"${fileName}" is ${rawBytes.byteLength} bytes, exceeding the per-file limit of ${MAX_FILE_SIZE_BYTES}` });
  }

  let bytes = rawBytes;
  let svgStripped: string[] | undefined;
  if (kind === "svg") {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(rawBytes);
    const result = sanitizeSvg(text);
    if (!result.clean || result.sanitized === undefined) {
      throw new SdkError({ code: "UNSAFE_SVG", message: `"${fileName}" contains unsafe SVG content that could not be safely cleaned`, details: result.removed });
    }
    bytes = new TextEncoder().encode(result.sanitized);
    if (result.removed.length > 0) svgStripped = result.removed.map((issue) => issue.message);
  }

  const sha256 = await sha256Hex(bytes);
  const path = await computeAssetPath(kind, bytes, fileName);
  const existing = project.assets.find((a) => a.sha256 === sha256);

  const displayName = sanitizeDisplayFileName(fileName);
  const existingNames = new Set(project.assets.map((a) => a.name ?? a.originalFileName).filter((n): n is string => !!n));
  const finalName = existing ? (existing.name ?? existing.originalFileName ?? displayName) : dedupeDisplayName(displayName, existingNames);

  return {
    fileName: finalName,
    kind,
    bytes,
    path,
    sha256,
    sizeBytes: bytes.byteLength,
    mimeType: MIME_BY_EXTENSION[extensionOf(fileName)] ?? "application/octet-stream",
    reused: !!existing,
    existingAssetId: existing?.id,
    svgStripped,
  };
}
