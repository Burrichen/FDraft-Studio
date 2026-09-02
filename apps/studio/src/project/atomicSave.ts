import type { FilePlatform } from "../platform/types.js";
import { readDirectoryFileSet, writeDirectoryFileSet } from "./directoryFileSet.js";

/**
 * Writes `bytes` to `destPath` atomically: write to a temporary sibling,
 * optionally validate it, then `rename` over the destination. `rename` is
 * atomic on the same volume on both POSIX (rename(2)) and Windows
 * (MoveFileEx) — a crash between the write and the rename leaves the
 * original file untouched and only an orphaned `.tmp-*` sibling behind,
 * never a half-written destination.
 */
export async function atomicWriteFile(platform: FilePlatform, destPath: string, bytes: Uint8Array, validate?: (bytes: Uint8Array) => Promise<void>): Promise<void> {
  const tempPath = `${destPath}.tmp-${platform.randomId()}`;
  await platform.writeFile(tempPath, bytes);
  if (validate) {
    try {
      await validate(bytes);
    } catch (error) {
      await platform.remove(tempPath).catch(() => {});
      throw error;
    }
  }
  await platform.rename(tempPath, destPath);
}

/**
 * Writes a directory's worth of files atomically: build a temporary
 * sibling directory in full, validate it, then swap it in for the
 * destination. Directory `rename` can't safely target an existing
 * non-empty directory on every platform, so the destination (if it
 * exists) is first renamed aside to a `.bak-*` sibling; if the final swap
 * fails, that backup is renamed back so the destination is never left
 * missing. The backup is only removed once the new directory is
 * successfully in place.
 */
export async function atomicWriteDirectory(
  platform: FilePlatform,
  destDir: string,
  files: Record<string, Uint8Array>,
  validate?: (tempDir: string) => Promise<void>,
): Promise<void> {
  const tempDir = `${destDir}.tmp-${platform.randomId()}`;
  await writeDirectoryFileSet(platform, tempDir, files);

  if (validate) {
    try {
      await validate(tempDir);
    } catch (error) {
      await platform.remove(tempDir, { recursive: true }).catch(() => {});
      throw error;
    }
  }

  const destinationExists = await platform.exists(destDir);
  if (!destinationExists) {
    await platform.rename(tempDir, destDir);
    return;
  }

  const backupDir = `${destDir}.bak-${platform.randomId()}`;
  await platform.rename(destDir, backupDir);
  try {
    await platform.rename(tempDir, destDir);
  } catch (error) {
    await platform.rename(backupDir, destDir).catch(() => {});
    throw error;
  }
  await platform.remove(backupDir, { recursive: true }).catch(() => {});
}

/** Re-reads a just-written temp directory back into a file map, for a `validate` callback that needs the bytes rather than just the path. */
export async function readBackForValidation(platform: FilePlatform, tempDir: string): Promise<Record<string, Uint8Array>> {
  return readDirectoryFileSet(platform, tempDir);
}
