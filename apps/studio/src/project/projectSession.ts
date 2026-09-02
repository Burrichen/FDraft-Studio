import type { ProjectMetadata, StudioProjectDocument } from "@fdraft/theme-sdk";
import type { StudioPlatform } from "../platform/types.js";
import type { StudioPaths } from "./paths.js";
import {
  createMinimalProjectTemplate,
  duplicateProject,
  exportProjectBackup,
  exportRuntimeTheme as exportRuntimeThemeFile,
  importProjectFromFdtheme,
  openProjectFromPath,
  saveProject,
  saveProjectAs,
  type OpenProject,
  type ProjectStorageKind,
  type RuntimeThemeExportOptions,
} from "./projectFile.js";
import { CommandStack, type Command } from "../history/commandStack.js";
import { setProjectMetadataCommand } from "../history/projectCommands.js";
import { writeAutosave } from "../recovery/recovery.js";
import { createStarterProject, type StarterTemplateId } from "../templates/starterTemplates.js";

export interface ProjectSessionState {
  status: "empty" | "loading" | "ready" | "error";
  open: OpenProject | null;
  /** True whenever the in-memory project differs from what's actually on disk. */
  dirty: boolean;
  errorMessage: string | null;
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: string | undefined;
  redoLabel: string | undefined;
  /** Surfaced once after `importFdtheme`, cleared on the next state-changing action. */
  importWarnings: string[] | null;
}

const INITIAL_STATE: ProjectSessionState = {
  status: "empty",
  open: null,
  dirty: false,
  errorMessage: null,
  canUndo: false,
  canRedo: false,
  undoLabel: undefined,
  redoLabel: undefined,
  importWarnings: null,
};

/** True for filesystem errors that mean "the path Studio expected is gone" — moved, renamed, or deleted out from under it. */
export function isMissingPathError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /ENOENT|no such file|cannot find|not found/i.test(message);
}

/**
 * The single stateful integration point between Studio's project-lifecycle
 * logic and the UI: current project, dirty flag, undo/redo, and autosave
 * scheduling. Framework-agnostic (plain subscribe/getState, à la an
 * external store) so it's usable from `useSyncExternalStore` without
 * dragging React into anything testable here.
 */
export class ProjectSession {
  private state: ProjectSessionState = INITIAL_STATE;
  private readonly listeners = new Set<() => void>();
  private readonly commandStack = new CommandStack<StudioProjectDocument>();
  private savedSnapshotJson: string | null = null;
  private autosaveTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly platform: StudioPlatform,
    private readonly paths: StudioPaths,
    private readonly sdkVersion: string,
  ) {}

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getState = (): ProjectSessionState => this.state;

  private setState(patch: Partial<ProjectSessionState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }

  private setOpen(open: OpenProject, extra: Partial<ProjectSessionState> = {}): void {
    this.commandStack.clear();
    this.savedSnapshotJson = JSON.stringify(open.project);
    this.setState({
      status: "ready",
      open,
      dirty: false,
      errorMessage: null,
      canUndo: false,
      canRedo: false,
      undoLabel: undefined,
      redoLabel: undefined,
      ...extra,
    });
  }

  private refreshDirtyAndHistory(project: StudioProjectDocument): void {
    if (!this.state.open) return;
    this.setState({
      open: { ...this.state.open, project },
      dirty: JSON.stringify(project) !== this.savedSnapshotJson,
      canUndo: this.commandStack.canUndo,
      canRedo: this.commandStack.canRedo,
      undoLabel: this.commandStack.undoLabel,
      redoLabel: this.commandStack.redoLabel,
    });
  }

  // ---- Lifecycle ----------------------------------------------------

  newProject(name: string): void {
    const project = createMinimalProjectTemplate(name);
    this.setOpen({ kind: "file", path: "", project, assets: {}, lastSavedAt: undefined });
  }

  /** Same as `newProject`, but starting from one of `STARTER_TEMPLATES` instead of the single-blank-page default. */
  newProjectFromTemplate(name: string, templateId: StarterTemplateId): void {
    const project = createStarterProject(templateId, name);
    this.setOpen({ kind: "file", path: "", project, assets: {}, lastSavedAt: undefined });
  }

  async open(path: string): Promise<void> {
    this.setState({ status: "loading", errorMessage: null });
    try {
      const open = await openProjectFromPath(this.platform, path);
      this.setOpen(open);
    } catch (error) {
      this.setState({ status: "error", errorMessage: describeError(error) });
      throw error;
    }
  }

  async save(): Promise<void> {
    if (!this.state.open) return;
    if (!this.state.open.path) {
      throw new Error("This project has never been saved — use Save As.");
    }
    const saved = await saveProject(this.platform, this.state.open, this.sdkVersion);
    this.savedSnapshotJson = JSON.stringify(saved.project);
    this.setState({ open: saved, dirty: false, errorMessage: null });
  }

  async saveAs(path: string, kind: ProjectStorageKind): Promise<void> {
    if (!this.state.open) return;
    const saved = await saveProjectAs(this.platform, this.state.open, path, kind, this.sdkVersion);
    this.savedSnapshotJson = JSON.stringify(saved.project);
    this.setState({ open: saved, dirty: false, errorMessage: null });
  }

  /** Returns `true` if the project is now closed (never dirty, or the caller confirmed discarding changes). */
  async close(confirmDiscard: () => Promise<boolean>): Promise<boolean> {
    if (this.state.dirty && !(await confirmDiscard())) return false;
    this.stopAutosave();
    this.commandStack.clear();
    this.savedSnapshotJson = null;
    this.setState(INITIAL_STATE);
    return true;
  }

  /**
   * Resumes a project from a recovered autosave payload. Always marked
   * dirty, regardless of how it compares to whatever's on disk at
   * `open.path` — recovered content has never actually been saved to that
   * path in this form, so treating it as "clean" would risk it being
   * silently discarded (e.g. by a careless close) before the user reviews
   * and explicitly saves it.
   */
  resumeFromRecovery(open: OpenProject): void {
    this.commandStack.clear();
    this.savedSnapshotJson = null;
    this.setState({
      status: "ready",
      open,
      dirty: true,
      errorMessage: null,
      canUndo: false,
      canRedo: false,
      undoLabel: undefined,
      redoLabel: undefined,
      importWarnings: null,
    });
  }

  async duplicate(destPath: string, destKind: ProjectStorageKind): Promise<OpenProject> {
    if (!this.state.open) throw new Error("No project is open");
    return duplicateProject(this.platform, this.state.open, destPath, destKind, this.sdkVersion);
  }

  async importFdtheme(bytes: Uint8Array): Promise<void> {
    const result = await importProjectFromFdtheme(bytes);
    this.setOpen({ kind: "file", path: "", project: result.project, assets: result.assets, lastSavedAt: undefined }, { importWarnings: result.warnings });
  }

  async exportBackup(destPath: string): Promise<void> {
    if (!this.state.open) throw new Error("No project is open");
    await exportProjectBackup(this.platform, this.state.open, destPath, this.sdkVersion);
  }

  async exportRuntimeTheme(destPath: string, options: RuntimeThemeExportOptions): Promise<void> {
    if (!this.state.open) throw new Error("No project is open");
    await exportRuntimeThemeFile(this.platform, this.state.open, destPath, options);
  }

  /**
   * Merges newly-imported or replaced asset bytes into the session's
   * byte pool. Deliberately *not* undo-tracked (bytes aren't part of the
   * `Command<StudioProjectDocument>` state the command stack manages) —
   * the pool only ever grows during a session, so undoing/redoing an
   * asset-record change always finds its bytes still here; stale,
   * no-longer-referenced entries are pruned automatically at the next
   * save (see `pruneAssetsToProject`). Callers pair this with an
   * `applyCommand` call that adds/changes the corresponding
   * `AssetRecord` — see `assets/assetCommands.ts`.
   */
  mergeAssetBytes(bytes: Record<string, Uint8Array>): void {
    const open = this.requireOpen();
    this.setState({ open: { ...open, assets: { ...open.assets, ...bytes } } });
  }

  // ---- Editing (undo/redo) ------------------------------------------

  editMetadata(patch: Partial<Pick<ProjectMetadata, "name" | "description">>): void {
    this.applyCommand(setProjectMetadataCommand(patch, this.requireOpen().project.metadata));
  }

  /**
   * The general entry point every layer/canvas/Copy-Workspace edit goes
   * through. Outside a transaction this is one undo step; inside one
   * (see `beginTransaction`), it's buffered and folded into the single
   * step that `commitTransaction` produces.
   */
  applyCommand(command: Command<StudioProjectDocument>): void {
    const open = this.requireOpen();
    const next = this.commandStack.execute(open.project, command);
    this.refreshDirtyAndHistory(next);
  }

  /**
   * Groups every `applyCommand` call until `commitTransaction` into one
   * undo step. Not used for continuous gestures like drag/resize — those
   * hold their own local "draft" state and call `applyCommand` exactly
   * once at gesture end — this is for compound operations that
   * genuinely need several distinct command objects applied in sequence
   * but must still undo as a single unit.
   */
  beginTransaction(label: string): void {
    this.commandStack.beginTransaction(label);
  }

  /** No-ops if nothing was applied since `beginTransaction`. Always refreshes undo/redo flags, even on a no-op, since callers shouldn't have to special-case it. */
  commitTransaction(): void {
    this.commandStack.commitTransaction();
    this.refreshDirtyAndHistory(this.requireOpen().project);
  }

  undo(): void {
    const open = this.requireOpen();
    const next = this.commandStack.undo(open.project);
    this.refreshDirtyAndHistory(next);
  }

  redo(): void {
    const open = this.requireOpen();
    const next = this.commandStack.redo(open.project);
    this.refreshDirtyAndHistory(next);
  }

  private requireOpen(): OpenProject {
    if (!this.state.open) throw new Error("No project is open");
    return this.state.open;
  }

  // ---- Autosave -------------------------------------------------------

  startAutosave(intervalMs: number): void {
    this.stopAutosave();
    this.autosaveTimer = setInterval(() => {
      void this.autosaveTick();
    }, intervalMs);
  }

  stopAutosave(): void {
    if (this.autosaveTimer !== null) {
      clearInterval(this.autosaveTimer);
      this.autosaveTimer = null;
    }
  }

  /** Exposed for tests; runs one autosave cycle immediately without waiting for the timer. */
  async autosaveTick(): Promise<void> {
    const open = this.state.open;
    if (!open || !open.path || !this.state.dirty) return;
    try {
      await writeAutosave(this.platform, this.paths, open, this.sdkVersion);
    } catch {
      // Autosave failing silently must never interrupt editing — the
      // user's explicit Save is still the source of truth and will
      // surface any real problem loudly.
    }
  }
}

function describeError(error: unknown): string {
  if (isMissingPathError(error)) return "This project's file or folder could not be found. It may have been moved or deleted.";
  return error instanceof Error ? error.message : String(error);
}
