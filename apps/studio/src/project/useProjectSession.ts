import { useSyncExternalStore } from "react";
import type { ProjectSession, ProjectSessionState } from "./projectSession.js";

/** Idiomatic React 19 binding for `ProjectSession`'s plain subscribe/getState store — no extra state library needed. */
export function useProjectSessionState(session: ProjectSession): ProjectSessionState {
  return useSyncExternalStore(session.subscribe, session.getState, session.getState);
}
