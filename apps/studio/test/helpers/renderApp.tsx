import { join } from "node:path";
import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { createNodeTestPlatform, NodeTestDialogs } from "./nodePlatform.js";
import { resolveStudioPaths } from "../../src/project/paths.js";
import { ProjectSession } from "../../src/project/projectSession.js";
import { AppProvider, type AppContextValue } from "../../src/AppContext.js";

const SDK_VERSION = "0.1.0-test";

export async function makeAppContext(dir: string, dialogs = new NodeTestDialogs()): Promise<AppContextValue & { dialogs: NodeTestDialogs }> {
  const platform = createNodeTestPlatform({ appDataDir: join(dir, "appdata"), appConfigDir: join(dir, "appconfig") }, dialogs);
  const paths = await resolveStudioPaths(platform);
  const session = new ProjectSession(platform, paths, SDK_VERSION);
  return { platform, paths, session, dialogs };
}

export function renderWithApp(ui: ReactElement, context: AppContextValue) {
  return render(<AppProvider value={context}>{ui}</AppProvider>);
}
