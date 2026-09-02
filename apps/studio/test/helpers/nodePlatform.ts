import { randomUUID } from "node:crypto";
import {
  readFile as fsReadFile,
  writeFile as fsWriteFile,
  mkdir as fsMkdir,
  readdir as fsReaddir,
  rm as fsRm,
  rename as fsRename,
  stat as fsStat,
} from "node:fs/promises";
import type { DialogPlatform, DirEntry, StatResult, StudioPlatform } from "../../src/platform/types.js";
import { basenamePath, dirnamePath, joinPath } from "../../src/platform/pathUtils.js";

/**
 * A real filesystem, real `node:fs`-backed `StudioPlatform` for tests —
 * used against a fresh temp directory per test so atomic-save/crash-
 * recovery/snapshot logic is exercised against actual rename/mkdir/rm
 * semantics, not a mock. Dialogs are scripted (see `NodeTestDialogs`)
 * since there's no real native dialog to show in a test run.
 */
export class NodeTestDialogs implements DialogPlatform {
  openFileQueue: (string | null)[] = [];
  openFilesQueue: (string[] | null)[] = [];
  openDirectoryQueue: (string | null)[] = [];
  saveFileQueue: (string | null)[] = [];
  confirmQueue: boolean[] = [];
  confirmCalls: string[] = [];

  // Arrow-function class fields (own enumerable properties), not prototype
  // methods — `createNodeTestPlatform` builds the returned platform via
  // `{...otherStuff, ...dialogs}`, and object-spread only copies a class
  // instance's *own* properties, never its prototype methods.
  openFile = async (): Promise<string | null> => {
    return this.openFileQueue.shift() ?? null;
  };
  openFiles = async (): Promise<string[] | null> => {
    return this.openFilesQueue.shift() ?? null;
  };
  openDirectory = async (): Promise<string | null> => {
    return this.openDirectoryQueue.shift() ?? null;
  };
  saveFile = async (): Promise<string | null> => {
    return this.saveFileQueue.shift() ?? null;
  };
  confirm = async (message: string): Promise<boolean> => {
    this.confirmCalls.push(message);
    return this.confirmQueue.shift() ?? false;
  };
}

export interface NodePlatformOptions {
  appDataDir: string;
  appConfigDir: string;
  /** Overrides `now()` for deterministic timestamp assertions; defaults to `Date.now`. */
  clock?: () => number;
}

export function createNodeTestPlatform(options: NodePlatformOptions, dialogs: DialogPlatform = new NodeTestDialogs()): StudioPlatform {
  return {
    readFile: async (path) => new Uint8Array(await fsReadFile(path)),
    readTextFile: (path) => fsReadFile(path, "utf8"),
    writeFile: async (path, data) => {
      await fsWriteFile(path, data);
    },
    writeTextFile: async (path, data) => {
      await fsWriteFile(path, data, "utf8");
    },
    exists: async (path) => {
      try {
        await fsStat(path);
        return true;
      } catch {
        return false;
      }
    },
    mkdir: async (path) => {
      await fsMkdir(path, { recursive: true });
    },
    readDir: async (path): Promise<DirEntry[]> => {
      const entries = await fsReaddir(path, { withFileTypes: true });
      return entries.map((entry) => ({ name: entry.name, isDirectory: entry.isDirectory(), isFile: entry.isFile() }));
    },
    remove: async (path, removeOptions) => {
      await fsRm(path, { recursive: removeOptions?.recursive ?? false, force: false });
    },
    rename: async (oldPath, newPath) => {
      await fsRename(oldPath, newPath);
    },
    stat: async (path): Promise<StatResult> => {
      const info = await fsStat(path);
      return { isDirectory: info.isDirectory(), isFile: info.isFile(), mtimeMs: info.mtimeMs, size: info.size };
    },

    join: joinPath,
    dirname: dirnamePath,
    basename: basenamePath,

    appDataDir: async () => options.appDataDir,
    appConfigDir: async () => options.appConfigDir,

    now: () => (options.clock ? options.clock() : Date.now()),
    randomId: () => randomUUID(),

    ...dialogs,
  };
}
