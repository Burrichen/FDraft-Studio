/**
 * Everything Studio's project-lifecycle/history/recovery logic needs from
 * its host, behind one interface. `tauriPlatform.ts` implements this
 * against real Tauri plugins for the shipped app; tests implement it
 * against real `node:fs` in a temp directory (see
 * `test/helpers/nodePlatform.ts`) — so atomic-save/crash-recovery
 * behaviour is tested against a real filesystem's actual semantics
 * without needing a Tauri/Rust runtime at all.
 */

export interface DirEntry {
  name: string;
  isDirectory: boolean;
  isFile: boolean;
}

export interface StatResult {
  isDirectory: boolean;
  isFile: boolean;
  /** Milliseconds since epoch, when available. */
  mtimeMs: number | undefined;
  size: number;
}

export interface DialogFilter {
  name: string;
  extensions: string[];
}

export interface FilePlatform {
  readFile(path: string): Promise<Uint8Array>;
  readTextFile(path: string): Promise<string>;
  writeFile(path: string, data: Uint8Array): Promise<void>;
  writeTextFile(path: string, data: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  mkdir(path: string): Promise<void>;
  readDir(path: string): Promise<DirEntry[]>;
  /** Non-recursive by default; pass `{ recursive: true }` to remove a directory tree. */
  remove(path: string, options?: { recursive?: boolean }): Promise<void>;
  /** Atomic on both POSIX (rename(2)) and Windows (MoveFileEx) when `oldPath`/`newPath` are on the same volume. */
  rename(oldPath: string, newPath: string): Promise<void>;
  stat(path: string): Promise<StatResult>;

  join(...segments: string[]): string;
  dirname(path: string): string;
  basename(path: string): string;

  appDataDir(): Promise<string>;
  appConfigDir(): Promise<string>;

  /** Milliseconds since epoch — a seam so recovery/autosave timing is deterministic in tests. */
  now(): number;
  /** A short random id for temp-file/backup-directory suffixes — a seam for deterministic test assertions. */
  randomId(): string;
}

export interface DialogPlatform {
  openFile(options?: { title?: string; filters?: DialogFilter[] }): Promise<string | null>;
  /** Multi-select variant, for batch asset import. */
  openFiles(options?: { title?: string; filters?: DialogFilter[] }): Promise<string[] | null>;
  openDirectory(options?: { title?: string }): Promise<string | null>;
  saveFile(options?: { title?: string; defaultPath?: string; filters?: DialogFilter[] }): Promise<string | null>;
  confirm(message: string, options?: { title?: string; kind?: "warning" | "info" }): Promise<boolean>;
}

export interface StudioPlatform extends FilePlatform, DialogPlatform {}
