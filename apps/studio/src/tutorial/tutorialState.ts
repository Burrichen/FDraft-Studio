import type { FilePlatform } from "../platform/types.js";
import type { StudioPaths } from "../project/paths.js";
import { atomicWriteFile } from "../project/atomicSave.js";

/**
 * Local-only tutorial progress — never project content, never synced
 * anywhere, mirrors `recentProjects.ts`'s exact read/write/atomic-write
 * pattern (a plain JSON file in `appConfigDir`) rather than introducing a
 * new persistence mechanism.
 */
export interface TutorialState {
  /** True once the user has reached the Finish step or explicitly closed on a later revisit — the signal the optional first-run welcome flow checks before offering itself again. */
  completed: boolean;
  /** True the moment the tutorial has been shown at all (started, skipped, or completed) — distinct from `completed`, since "skip for now" must not re-trigger the first-run welcome flow every single launch. */
  hasBeenShown: boolean;
}

const DEFAULT_STATE: TutorialState = { completed: false, hasBeenShown: false };

function isTutorialState(value: unknown): value is TutorialState {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.completed === "boolean" && typeof v.hasBeenShown === "boolean";
}

/** Never throws: a corrupted or missing tutorial-state file behaves exactly like "never seen," since it must never block Studio from starting. */
export async function loadTutorialState(platform: FilePlatform, paths: StudioPaths): Promise<TutorialState> {
  if (!(await platform.exists(paths.tutorialStateFile))) return DEFAULT_STATE;
  try {
    const parsed: unknown = JSON.parse(await platform.readTextFile(paths.tutorialStateFile));
    return isTutorialState(parsed) ? parsed : DEFAULT_STATE;
  } catch {
    return DEFAULT_STATE;
  }
}

export async function saveTutorialState(platform: FilePlatform, paths: StudioPaths, state: TutorialState): Promise<void> {
  await platform.mkdir(paths.appConfigDir);
  await atomicWriteFile(platform, paths.tutorialStateFile, new TextEncoder().encode(JSON.stringify(state, null, 2)));
}
