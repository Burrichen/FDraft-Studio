import { useEffect, useState } from "react";
import { createTauriPlatform } from "./platform/tauriPlatform.js";
import { resolveStudioPaths, type StudioPaths } from "./project/paths.js";
import { ProjectSession } from "./project/projectSession.js";
import { AppProvider, type AppContextValue } from "./AppContext.js";
import { useProjectSessionState } from "./project/useProjectSession.js";
import { StartupScreen } from "./ui/startup/StartupScreen.js";
import { StudioShell } from "./ui/shell/StudioShell.js";

const SDK_VERSION = "0.1.0";
const AUTOSAVE_INTERVAL_MS = 30_000;

function AppShell({ context }: { context: AppContextValue }): React.ReactNode {
  const state = useProjectSessionState(context.session);

  useEffect(() => {
    if (state.open?.path) {
      context.session.startAutosave(AUTOSAVE_INTERVAL_MS);
    } else {
      context.session.stopAutosave();
    }
    return () => context.session.stopAutosave();
  }, [context.session, state.open?.path]);

  return (
    <AppProvider value={context}>
      {state.status === "ready" ? <StudioShell /> : <StartupScreen />}
    </AppProvider>
  );
}

export function App(): React.ReactNode {
  const [context, setContext] = useState<AppContextValue | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const platform = createTauriPlatform();
        const paths: StudioPaths = await resolveStudioPaths(platform);
        const session = new ProjectSession(platform, paths, SDK_VERSION);
        if (!cancelled) setContext({ platform, paths, session });
      } catch (error) {
        if (!cancelled) setBootError(error instanceof Error ? error.message : String(error));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (bootError) {
    return (
      <div role="alert" style={{ padding: 24, fontFamily: "sans-serif" }}>
        FDraft Studio failed to start: {bootError}
      </div>
    );
  }

  if (!context) {
    return (
      <div role="status" style={{ padding: 24, fontFamily: "sans-serif" }}>
        Starting FDraft Studio…
      </div>
    );
  }

  return <AppShell context={context} />;
}
