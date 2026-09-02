import { SdkError } from "../errors.js";
import { SAFE_ASSET_EXTENSIONS } from "../schema/assets.js";

export const MAX_ARCHIVE_FILES = 5_000;
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB
export const MAX_TOTAL_UNCOMPRESSED_BYTES = 500 * 1024 * 1024; // 500 MB
/**
 * Per-file uncompressed:compressed ratio ceiling, checked against each
 * entry's ZIP-declared sizes *before* it is decompressed (fflate's unzip
 * `filter` callback exposes `size`/`originalSize` up front for exactly
 * this reason). Catches a single wildly over-compressed entry — the
 * classic zip-bomb shape — without ever inflating it.
 */
export const MAX_ARCHIVE_COMPRESSION_RATIO = 200;

/**
 * Extensions rejected outright, regardless of a project/theme document's
 * declared asset `kind`. Anything executable, interpretable, or capable of
 * carrying a payload beyond the closed image/svg/font allowlist.
 */
export const DANGEROUS_EXTENSIONS = [
  ".exe", ".dll", ".so", ".dylib", ".bin",
  ".sh", ".bash", ".zsh", ".bat", ".cmd", ".ps1", ".command", ".workflow",
  ".js", ".mjs", ".cjs", ".ts", ".py", ".rb", ".php", ".pl",
  ".jar", ".war", ".class",
  ".app", ".com", ".scr", ".vbs", ".vbe", ".wsf", ".wsh", ".msi", ".msix",
  ".apk", ".ipa", ".dmg", ".pkg", ".deb", ".rpm",
  ".lnk", ".reg", ".scpt", ".applescript",
] as const;

const SAFE_EXTENSIONS = new Set(Object.values(SAFE_ASSET_EXTENSIONS).flat());

function extensionOf(path: string): string {
  const dot = path.lastIndexOf(".");
  return dot === -1 ? "" : path.slice(dot).toLowerCase();
}

/**
 * True if `path` is safe to extract as a member of a `.fdstudio`/`.fdtheme`
 * archive: relative, forward-slash, no traversal, no absolute/drive-letter
 * form, and (for anything under `assets/`) on the closed safe-extension
 * allowlist.
 */
export function isPathSafeInArchive(path: string): boolean {
  if (path.length === 0) return false;
  if (path.includes("\\")) return false;
  if (path.startsWith("/")) return false;
  if (/^[a-zA-Z]:/.test(path)) return false;
  if (path.split("/").some((segment) => segment === ".." || segment === "." || segment === "")) return false;
  if (/^[a-z]+:\/\//i.test(path) || path.startsWith("//")) return false;
  return true;
}

export function assertSafeArchivePath(path: string): void {
  if (!isPathSafeInArchive(path)) {
    throw new SdkError({
      code: "ZIP_PATH_TRAVERSAL",
      message: `archive entry path "${path}" is not a safe relative path`,
      path,
    });
  }
  const ext = extensionOf(path);
  if ((DANGEROUS_EXTENSIONS as readonly string[]).includes(ext)) {
    throw new SdkError({
      code: "DANGEROUS_FILE_TYPE",
      message: `archive entry "${path}" has a disallowed file extension "${ext}"`,
      path,
    });
  }
  if (path.startsWith("assets/") && !SAFE_EXTENSIONS.has(ext)) {
    throw new SdkError({
      code: "DANGEROUS_FILE_TYPE",
      message: `asset "${path}" has an extension "${ext}" outside the safe image/svg/font allowlist`,
      path,
    });
  }
}

export interface ArchiveEntrySize {
  path: string;
  compressedSize: number;
  uncompressedSize: number;
}

/** Checks one ZIP entry's declared sizes/path *before* it is decompressed. */
export function assertSafeArchiveEntry(entry: ArchiveEntrySize): void {
  assertSafeArchivePath(entry.path);

  if (entry.uncompressedSize > MAX_FILE_SIZE_BYTES) {
    throw new SdkError({
      code: "FILE_TOO_LARGE",
      message: `"${entry.path}" is ${entry.uncompressedSize} bytes, exceeding the per-file limit of ${MAX_FILE_SIZE_BYTES}`,
      path: entry.path,
    });
  }

  const ratio = entry.uncompressedSize / Math.max(entry.compressedSize, 1);
  if (ratio > MAX_ARCHIVE_COMPRESSION_RATIO) {
    throw new SdkError({
      code: "COMPRESSION_RATIO_EXCEEDED",
      message: `"${entry.path}" has a compression ratio of ${ratio.toFixed(1)}:1, exceeding the limit of ${MAX_ARCHIVE_COMPRESSION_RATIO}:1 (possible archive bomb)`,
      path: entry.path,
    });
  }
}

export function assertSafeArchiveFileCount(fileCount: number): void {
  if (fileCount > MAX_ARCHIVE_FILES) {
    throw new SdkError({
      code: "ARCHIVE_TOO_MANY_FILES",
      message: `archive contains ${fileCount} files, exceeding the limit of ${MAX_ARCHIVE_FILES}`,
    });
  }
}

export function assertSafeArchiveTotalSize(totalUncompressedBytes: number): void {
  if (totalUncompressedBytes > MAX_TOTAL_UNCOMPRESSED_BYTES) {
    throw new SdkError({
      code: "ARCHIVE_TOO_LARGE",
      message: `archive expands to ${totalUncompressedBytes} bytes, exceeding the total limit of ${MAX_TOTAL_UNCOMPRESSED_BYTES}`,
    });
  }
}

/** Rejects any string field that looks like a remote/external reference rather than an in-package path. */
export function assertNoExternalUrl(value: string, path: string): void {
  if (/^[a-z]+:\/\//i.test(value) || value.startsWith("//") || value.startsWith("data:")) {
    throw new SdkError({
      code: "EXTERNAL_URL_NOT_ALLOWED",
      message: `"${path}" references an external or remote URL ("${value}"), which themes may not do`,
      path,
    });
  }
}
