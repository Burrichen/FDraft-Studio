import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAppContext } from "../AppContext.js";
import { loadTutorialState, saveTutorialState, type TutorialState } from "./tutorialState.js";

export interface TutorialContextValue {
  /** Whether the tutorial modal is currently open. */
  isOpen: boolean;
  /** Open the tutorial from any real trigger (Help menu, Startup Screen, or the first-run welcome offer). */
  open: () => void;
  /** Close without marking completion — used by "Skip for Now" and "Close Tutorial" alike; the tutorial can be dismissed at any point without penalty. */
  close: () => void;
  /** Mark the tutorial completed (reached Finish) and close. */
  finish: () => void;
  /** Whether the tutorial has ever been shown (started, skipped, or completed) — false only before the very first time. */
  hasBeenShown: boolean;
  /** Whether the tutorial has been completed at least once. */
  completed: boolean;
}

const TutorialReactContext = createContext<TutorialContextValue | undefined>(undefined);

/**
 * Mounted once, above both `<StudioShell>` and `<StartupScreen>` (see
 * `App.tsx`) — `StudioShell` itself returns `null` with no project open,
 * so tutorial state can never live inside it if the tutorial must also
 * be reachable from the Startup Screen and from a genuine first-run
 * welcome offer before any project exists. Rendering the tutorial modal
 * as a sibling overlay at this level, rather than inside either screen,
 * is what makes "preserve unsaved changes and return to the same editing
 * state when closed" true for free — nothing about opening or closing it
 * ever unmounts the project session underneath.
 */
export function TutorialProvider({ children }: { children: ReactNode }): ReactNode {
  const { platform, paths } = useAppContext();
  const [isOpen, setIsOpen] = useState(false);
  const [state, setState] = useState<TutorialState>({ completed: false, hasBeenShown: false });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadTutorialState(platform, paths).then((loadedState) => {
      if (cancelled) return;
      setState(loadedState);
      setLoaded(true);
      // Optional first-run welcome flow — offered exactly once, only
      // after the persisted state is known, and only if the tutorial has
      // never been shown before. Never prevents opening/recovering a
      // project: it opens as a dismissible overlay, not a blocking gate.
      if (!loadedState.hasBeenShown) setIsOpen(true);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once at boot, keyed by the stable platform/paths from AppContext.
  }, []);

  function persist(next: TutorialState): void {
    setState(next);
    void saveTutorialState(platform, paths, next);
  }

  function open(): void {
    setIsOpen(true);
  }

  function close(): void {
    setIsOpen(false);
    if (loaded && !state.hasBeenShown) persist({ ...state, hasBeenShown: true });
  }

  function finish(): void {
    setIsOpen(false);
    persist({ completed: true, hasBeenShown: true });
  }

  return (
    <TutorialReactContext.Provider value={{ isOpen, open, close, finish, hasBeenShown: state.hasBeenShown, completed: state.completed }}>
      {children}
    </TutorialReactContext.Provider>
  );
}

export function useTutorial(): TutorialContextValue {
  const value = useContext(TutorialReactContext);
  if (!value) throw new Error("useTutorial must be used within <TutorialProvider>");
  return value;
}
