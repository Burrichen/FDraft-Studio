import { unzipSync, zipSync, type Zippable } from "fflate";
import { SdkError } from "../errors.js";
import {
  assertSafeArchiveEntry,
  assertSafeArchiveFileCount,
  assertSafeArchiveTotalSize,
} from "./security.js";

/**
 * Fixed timestamp so that zipping the same logical file contents twice
 * produces byte-identical output — no build timestamp, no local time
 * zone, no per-run entropy. Combined with sorting entries by path and a
 * fixed `os` byte, this makes `createDeterministicZip` reproducible.
 * ZIP's DOS date field only represents 1980-2099, so the Unix epoch isn't
 * usable here — this is just an arbitrary fixed point within that range.
 */
const DETERMINISTIC_MTIME = new Date("2000-01-01T00:00:00Z");

/** Builds a ZIP archive whose bytes depend only on the file contents and paths given, never on when or on what machine it was built. */
export function createDeterministicZip(files: Record<string, Uint8Array>): Uint8Array {
  const zippable: Zippable = {};
  for (const path of Object.keys(files).sort()) {
    zippable[path] = [files[path]!, { mtime: DETERMINISTIC_MTIME, os: 0, level: 9 }];
  }
  return zipSync(zippable, { mtime: DETERMINISTIC_MTIME, os: 0 });
}

/**
 * Safely extracts a ZIP archive: every entry's path and declared
 * compressed/uncompressed size is checked with the security policy in
 * `./security.js` *before* that entry is inflated, so a malicious archive
 * is rejected without ever materialising its decompressed payload.
 */
export function readZipSafely(archiveBytes: Uint8Array): Record<string, Uint8Array> {
  let fileCount = 0;
  let totalUncompressed = 0;

  let unzipped: Record<string, Uint8Array>;
  try {
    unzipped = unzipSync(archiveBytes, {
      filter: (file) => {
        fileCount += 1;
        assertSafeArchiveFileCount(fileCount);
        assertSafeArchiveEntry({
          path: file.name,
          compressedSize: file.size,
          uncompressedSize: file.originalSize,
        });
        totalUncompressed += file.originalSize;
        assertSafeArchiveTotalSize(totalUncompressed);
        return true;
      },
    });
  } catch (error) {
    if (error instanceof SdkError) throw error;
    throw new SdkError({
      code: "INVALID_PACKAGE_FORMAT",
      message: "could not read archive: it is not a valid ZIP file",
      cause: error,
    });
  }

  // Directory entries (paths ending in "/") carry no useful content.
  for (const path of Object.keys(unzipped)) {
    if (path.endsWith("/")) delete unzipped[path];
  }

  return unzipped;
}
