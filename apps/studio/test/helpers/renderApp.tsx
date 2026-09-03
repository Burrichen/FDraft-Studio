import { join } from "node:path";
import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { createNodeTestPlatform, NodeTestDialogs } from "./nodePlatform.js";
import { resolveStudioPaths } from "../../src/project/paths.js";
import { ProjectSession } from "../../src/project/projectSession.js";
import { AppProvider, type AppContextValue } from "../../src/AppContext.js";
import { TutorialProvider } from "../../src/tutorial/TutorialContext.js";
import { saveTutorialState } from "../../src/tutorial/tutorialState.js";

const SDK_VERSION = "0.1.0-test";

/**
 * By default, seeds tutorial state as "already shown" — a fresh test
 * fixture is not a real first launch, and the tutorial's genuine
 * first-run auto-open (see `TutorialContext.tsx`) would otherwise pop
 * open an extra dialog in the middle of every unrelated test that
 * renders `<StudioShell>`/`<StartupScreen>` via `renderWithApp`. Tests
 * that specifically want to exercise first-run behaviour (see
 * `test/ui/TutorialPanel.test.tsx`) pass `{ freshTutorial: true }` to
 * opt out of this seeding instead.
 */
export async function makeAppContext(
  dir: string,
  dialogs = new NodeTestDialogs(),
  options: { freshTutorial?: boolean } = {},
): Promise<AppContextValue & { dialogs: NodeTestDialogs }> {
  const platform = createNodeTestPlatform({ appDataDir: join(dir, "appdata"), appConfigDir: join(dir, "appconfig") }, dialogs);
  const paths = await resolveStudioPaths(platform);
  const session = new ProjectSession(platform, paths, SDK_VERSION);
  if (!options.freshTutorial) {
    await saveTutorialState(platform, paths, { completed: true, hasBeenShown: true });
  }
  return { platform, paths, session, dialogs };
}

/**
 * `<StudioShell>`/`<StartupScreen>` both call `useTutorial()` (the Help
 * entry point) — real app code always mounts them inside
 * `<TutorialProvider>` (see `App.tsx`), so this test helper does the
 * same, otherwise every test rendering either component would need to
 * know about the tutorial feature just to avoid a thrown "must be used
 * within" error unrelated to what it's actually testing.
 */
export function renderWithApp(ui: ReactElement, context: AppContextValue) {
  return render(
    <AppProvider value={context}>
      <TutorialProvider>{ui}</TutorialProvider>
    </AppProvider>,
  );
}
