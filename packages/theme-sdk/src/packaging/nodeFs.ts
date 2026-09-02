/**
 * Node-only convenience I/O for the "unpacked project directory" dev mode
 * (`CLAUDE.md` / `INTEGRATION_WORKFLOW.md`: "Support an unpacked project
 * directory during development so Git diffs remain readable"). Everything
 * else in this package works on in-memory bytes so it can run inside a
 * Tauri webview or a browser; only this module — used by the CLI and by
 * tests — touches the real filesystem.
 */
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import type { FdstudioPackInput, FdstudioUnpackResult } from "./fdstudio.js";
import { buildFdstudioFileSet, finalizeFdstudioFileSet } from "./fdstudio.js";

async function listFilesRecursively(root: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else out.push(full);
    }
  }
  await walk(root);
  return out;
}

/** Writes a Studio project as a plain, Git-diffable directory tree instead of a zipped `.fdstudio` archive. */
export async function writeUnpackedProject(directoryPath: string, input: FdstudioPackInput): Promise<void> {
  const { files } = await buildFdstudioFileSet(input);

  // Start from a clean directory so a renamed/removed asset doesn't linger.
  await rm(directoryPath, { recursive: true, force: true });
  await mkdir(directoryPath, { recursive: true });

  for (const [path, bytes] of Object.entries(files)) {
    const destination = join(directoryPath, ...path.split("/"));
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, bytes);
  }
}

/** Reads a directory previously written by `writeUnpackedProject`, migrating and verifying it exactly like `unpackFdstudio` would. */
export async function readUnpackedProject(directoryPath: string): Promise<FdstudioUnpackResult> {
  const absoluteFiles = await listFilesRecursively(directoryPath);
  const files: Record<string, Uint8Array> = {};
  for (const absolutePath of absoluteFiles) {
    const relativePath = relative(directoryPath, absolutePath).split(sep).join("/");
    files[relativePath] = new Uint8Array(await readFile(absolutePath));
  }
  return await finalizeFdstudioFileSet(files);
}

export async function directoryExists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}
