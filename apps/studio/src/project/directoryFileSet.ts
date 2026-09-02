import type { FilePlatform } from "../platform/types.js";

/** Reads every file under `rootDir` into a flat `{relativePath: bytes}` map, using forward-slash-joined relative paths regardless of host OS. */
export async function readDirectoryFileSet(platform: FilePlatform, rootDir: string): Promise<Record<string, Uint8Array>> {
  const files: Record<string, Uint8Array> = {};

  async function walk(absoluteDir: string, relativePrefix: string): Promise<void> {
    const entries = await platform.readDir(absoluteDir);
    for (const entry of entries) {
      const absoluteChild = platform.join(absoluteDir, entry.name);
      const relativeChild = relativePrefix ? `${relativePrefix}/${entry.name}` : entry.name;
      if (entry.isDirectory) {
        await walk(absoluteChild, relativeChild);
      } else {
        files[relativeChild] = await platform.readFile(absoluteChild);
      }
    }
  }

  await walk(rootDir, "");
  return files;
}

/** Writes a flat `{relativePath: bytes}` map into `rootDir`, creating intermediate directories as needed. Does not clear `rootDir` first — callers writing into a fresh temp directory get that for free. */
export async function writeDirectoryFileSet(platform: FilePlatform, rootDir: string, files: Record<string, Uint8Array>): Promise<void> {
  await platform.mkdir(rootDir);
  for (const [relativePath, bytes] of Object.entries(files)) {
    const segments = relativePath.split("/");
    const absolutePath = platform.join(rootDir, ...segments);
    await platform.mkdir(platform.dirname(absolutePath));
    await platform.writeFile(absolutePath, bytes);
  }
}
