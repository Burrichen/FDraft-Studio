import {
  readFile,
  readTextFile,
  writeFile,
  writeTextFile,
  exists,
  mkdir,
  readDir,
  remove,
  rename,
  stat,
} from "@tauri-apps/plugin-fs";
import { open as openDialog, save as saveDialog, confirm as confirmDialog } from "@tauri-apps/plugin-dialog";
import { appDataDir, appConfigDir } from "@tauri-apps/api/path";
import type { DialogFilter, StudioPlatform } from "./types.js";
import { basenamePath, dirnamePath, joinPath } from "./pathUtils.js";

/**
 * The real, shipped platform: every filesystem/dialog operation goes
 * through Tauri's official plugins (real OS calls via Rust), and
 * directory paths are cached after their first (async, IPC) lookup so
 * the rest of Studio's code can treat them as effectively-synchronous
 * facts once the app has started.
 */
export function createTauriPlatform(): StudioPlatform {
  return {
    readFile: (path) => readFile(path),
    readTextFile: (path) => readTextFile(path),
    writeFile: (path, data) => writeFile(path, data),
    writeTextFile: (path, data) => writeTextFile(path, data),
    exists: (path) => exists(path),
    mkdir: (path) => mkdir(path, { recursive: true }),
    readDir: (path) => readDir(path),
    remove: (path, options) => remove(path, { recursive: options?.recursive ?? false }),
    rename: (oldPath, newPath) => rename(oldPath, newPath),
    stat: async (path) => {
      const info = await stat(path);
      return {
        isDirectory: info.isDirectory,
        isFile: info.isFile,
        mtimeMs: info.mtime ? info.mtime.getTime() : undefined,
        size: info.size,
      };
    },

    join: joinPath,
    dirname: dirnamePath,
    basename: basenamePath,

    appDataDir,
    appConfigDir,

    now: () => Date.now(),
    randomId: () => crypto.randomUUID(),

    openFile: async (options) => {
      const result = await openDialog({
        title: options?.title,
        multiple: false,
        directory: false,
        filters: toTauriFilters(options?.filters),
      });
      return typeof result === "string" ? result : null;
    },
    openFiles: async (options) => {
      const result = await openDialog({
        title: options?.title,
        multiple: true,
        directory: false,
        filters: toTauriFilters(options?.filters),
      });
      if (!result) return null;
      return Array.isArray(result) ? result : [result];
    },
    openDirectory: async (options) => {
      const result = await openDialog({ title: options?.title, multiple: false, directory: true });
      return typeof result === "string" ? result : null;
    },
    saveFile: async (options) => {
      const result = await saveDialog({
        title: options?.title,
        defaultPath: options?.defaultPath,
        filters: toTauriFilters(options?.filters),
      });
      return result ?? null;
    },
    confirm: (message, options) => confirmDialog(message, { title: options?.title, kind: options?.kind }),
  };
}

function toTauriFilters(filters: DialogFilter[] | undefined): { name: string; extensions: string[] }[] | undefined {
  return filters?.map((f) => ({ name: f.name, extensions: f.extensions }));
}
