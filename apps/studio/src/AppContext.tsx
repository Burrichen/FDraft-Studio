import { createContext, useContext } from "react";
import type { StudioPlatform } from "./platform/types.js";
import type { StudioPaths } from "./project/paths.js";
import type { ProjectSession } from "./project/projectSession.js";

export interface AppContextValue {
  platform: StudioPlatform;
  paths: StudioPaths;
  session: ProjectSession;
}

const AppReactContext = createContext<AppContextValue | undefined>(undefined);

export const AppProvider = AppReactContext.Provider;

export function useAppContext(): AppContextValue {
  const value = useContext(AppReactContext);
  if (!value) throw new Error("useAppContext must be used within <AppProvider>");
  return value;
}
