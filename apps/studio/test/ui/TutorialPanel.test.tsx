import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { withTempDir } from "../helpers/tempDir.js";
import { makeAppContext } from "../helpers/renderApp.js";
import { AppProvider, type AppContextValue } from "../../src/AppContext.js";
import { TutorialProvider, useTutorial } from "../../src/tutorial/TutorialContext.js";
import { TutorialPanel } from "../../src/ui/tutorial/TutorialPanel.js";
import { loadTutorialState } from "../../src/tutorial/tutorialState.js";
import { StudioShell } from "../../src/ui/shell/StudioShell.js";
import { TUTORIAL_STEPS } from "../../src/tutorial/tutorialContent.js";

/** A genuinely fresh context — no prior tutorial state at all, so the real first-run auto-open fires (see `makeAppContext`'s own doc comment on why this is opt-in, not the default). */
function freshContext(dir: string) {
  return makeAppContext(dir, undefined, { freshTutorial: true });
}

async function readyProjectContext(dir: string) {
  const context = await makeAppContext(dir);
  context.session.newProject("Tutorial Test Event");
  await context.session.saveAs(join(dir, "event.fdstudio"), "file");
  return context;
}

function renderTutorialApp(context: AppContextValue, extra: React.ReactNode = null) {
  return render(
    <AppProvider value={context}>
      <TutorialProvider>
        {extra}
        <TutorialPanel />
      </TutorialProvider>
    </AppProvider>,
  );
}

async function openFreshTutorial(context: AppContextValue) {
  renderTutorialApp(context);
  await waitFor(() => screen.getByRole("dialog", { name: "FDraft Studio Tutorial" }));
}

async function startTutorial(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Start Tutorial" }));
}

/** A minimal "Help" trigger for tests that need to reopen the tutorial without mounting the full StudioShell/StartupScreen. */
function HelpTrigger(): React.ReactNode {
  const tutorial = useTutorial();
  return (
    <button type="button" onClick={() => tutorial.open()}>
      Open tutorial
    </button>
  );
}

describe("Tutorial", () => {
  afterEach(() => cleanup());

  it("opens from the Help menu inside an open project", async () => {
    await withTempDir(async (dir) => {
      const context = await readyProjectContext(dir);
      const user = userEvent.setup();
      renderTutorialApp(context, <StudioShell />);

      expect(screen.queryByRole("dialog", { name: "FDraft Studio Tutorial" })).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: /help menu — open tutorial/i }));
      expect(screen.getByRole("dialog", { name: "FDraft Studio Tutorial" })).toBeInTheDocument();
    });
  });

  it("presents itself automatically on first run, with no prior tutorial state", async () => {
    await withTempDir(async (dir) => {
      const context = await freshContext(dir);
      await openFreshTutorial(context);
    });
  });

  it("does not re-offer itself automatically once it has already been shown (the ordinary test-fixture default)", async () => {
    await withTempDir(async (dir) => {
      const context = await makeAppContext(dir);
      renderTutorialApp(context);
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(screen.queryByRole("dialog", { name: "FDraft Studio Tutorial" })).not.toBeInTheDocument();
    });
  });

  it("Skip for Now closes the tutorial and records it as shown, without marking it completed", async () => {
    await withTempDir(async (dir) => {
      const context = await freshContext(dir);
      const user = userEvent.setup();
      await openFreshTutorial(context);

      await user.click(screen.getByRole("button", { name: "Skip for Now" }));
      expect(screen.queryByRole("dialog", { name: "FDraft Studio Tutorial" })).not.toBeInTheDocument();

      // TutorialContext.close() fires its state-persisting write without
      // awaiting it (a deliberate fire-and-forget, matching recentProjects'
      // own established pattern) — poll for the write to land rather than
      // assuming it's already flushed to disk the instant the click resolves.
      await waitFor(async () => {
        const saved = await loadTutorialState(context.platform, context.paths);
        expect(saved).toEqual({ completed: false, hasBeenShown: true });
      });
    });
  });

  it("Back and Next move between real steps, Back disabled on the first step", async () => {
    await withTempDir(async (dir) => {
      const context = await freshContext(dir);
      const user = userEvent.setup();
      await openFreshTutorial(context);
      await startTutorial(user);

      expect(screen.getByRole("heading", { name: TUTORIAL_STEPS[0]!.title })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();

      await user.click(screen.getByRole("button", { name: "Next" }));
      expect(screen.getByRole("heading", { name: TUTORIAL_STEPS[1]!.title })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Back" })).not.toBeDisabled();

      await user.click(screen.getByRole("button", { name: "Back" }));
      expect(screen.getByRole("heading", { name: TUTORIAL_STEPS[0]!.title })).toBeInTheDocument();
    });
  });

  it("reaching Finish persists completion and closes the tutorial", async () => {
    await withTempDir(async (dir) => {
      const context = await freshContext(dir);
      const user = userEvent.setup();
      await openFreshTutorial(context);
      await startTutorial(user);

      for (let i = 0; i < TUTORIAL_STEPS.length - 1; i += 1) {
        await user.click(screen.getByRole("button", { name: "Next" }));
      }
      expect(screen.getByRole("heading", { name: TUTORIAL_STEPS.at(-1)!.title })).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Finish" }));

      expect(screen.queryByRole("dialog", { name: "FDraft Studio Tutorial" })).not.toBeInTheDocument();
      await waitFor(async () => {
        const saved = await loadTutorialState(context.platform, context.paths);
        expect(saved).toEqual({ completed: true, hasBeenShown: true });
      });
    });
  });

  it("Restart Tutorial returns to the first step from anywhere", async () => {
    await withTempDir(async (dir) => {
      const context = await freshContext(dir);
      const user = userEvent.setup();
      await openFreshTutorial(context);
      await startTutorial(user);

      await user.click(screen.getByRole("button", { name: "Next" }));
      await user.click(screen.getByRole("button", { name: "Next" }));
      expect(screen.getByRole("heading", { name: TUTORIAL_STEPS[2]!.title })).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Restart Tutorial" }));
      expect(screen.getByRole("heading", { name: TUTORIAL_STEPS[0]!.title })).toBeInTheDocument();
    });
  });

  it("closing and reopening shows the splash screen again, not stuck mid-step", async () => {
    await withTempDir(async (dir) => {
      const context = await freshContext(dir);
      const user = userEvent.setup();
      renderTutorialApp(context, <HelpTrigger />);
      await waitFor(() => screen.getByRole("dialog", { name: "FDraft Studio Tutorial" }));

      await startTutorial(user);
      await user.click(screen.getByRole("button", { name: "Next" }));
      expect(screen.getByRole("heading", { name: TUTORIAL_STEPS[1]!.title })).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Close Tutorial" }));
      expect(screen.queryByRole("dialog", { name: "FDraft Studio Tutorial" })).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Open tutorial" }));
      expect(screen.getByRole("dialog", { name: "FDraft Studio Tutorial" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Start Tutorial" })).toBeInTheDocument();
    });
  });

  it("Escape closes the tutorial (keyboard-only operation)", async () => {
    await withTempDir(async (dir) => {
      const context = await freshContext(dir);
      const user = userEvent.setup();
      await openFreshTutorial(context);
      await user.keyboard("{Escape}");
      expect(screen.queryByRole("dialog", { name: "FDraft Studio Tutorial" })).not.toBeInTheDocument();
    });
  });

  it("focuses a real element inside the dialog on open (visible focus)", async () => {
    await withTempDir(async (dir) => {
      const context = await freshContext(dir);
      await openFreshTutorial(context);
      const dialog = screen.getByRole("dialog", { name: "FDraft Studio Tutorial" });
      expect(dialog.contains(document.activeElement)).toBe(true);
      expect(document.activeElement?.tagName).toBe("BUTTON");
    });
  });

  it("keyboard-only: Tab reaches Start Tutorial and Enter activates it", async () => {
    await withTempDir(async (dir) => {
      const context = await freshContext(dir);
      const user = userEvent.setup();
      await openFreshTutorial(context);
      // The close (✕) button is focused first; Tab moves to Start Tutorial.
      await user.tab();
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Start Tutorial" }));
      await user.keyboard("{Enter}");
      expect(screen.getByRole("heading", { name: TUTORIAL_STEPS[0]!.title })).toBeInTheDocument();
    });
  });

  it("never auto-advances on its own — no timer-driven motion for reduced-motion to need to suppress", async () => {
    await withTempDir(async (dir) => {
      vi.useFakeTimers();
      try {
        const context = await freshContext(dir);
        renderTutorialApp(context);
        await vi.waitFor(() => expect(screen.getByRole("dialog", { name: "FDraft Studio Tutorial" })).toBeInTheDocument());
        await vi.advanceTimersByTimeAsync(60_000);
        expect(screen.getByRole("button", { name: "Start Tutorial" })).toBeInTheDocument();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  it("renders without throwing at a small window width (zoom/small-window safety)", async () => {
    await withTempDir(async (dir) => {
      const context = await freshContext(dir);
      const originalWidth = window.innerWidth;
      Object.defineProperty(window, "innerWidth", { value: 320, configurable: true });
      window.dispatchEvent(new Event("resize"));
      try {
        await openFreshTutorial(context);
        const dialog = screen.getByRole("dialog", { name: "FDraft Studio Tutorial" });
        expect(dialog.querySelector(".tutorial-modal")).not.toBeNull();
      } finally {
        Object.defineProperty(window, "innerWidth", { value: originalWidth, configurable: true });
      }
    });
  });

  it("opening and closing the tutorial never touches the open project's dirty state or mode", async () => {
    await withTempDir(async (dir) => {
      const context = await readyProjectContext(dir);
      const user = userEvent.setup();
      renderTutorialApp(context, <StudioShell />);

      const dirtyBefore = context.session.getState().dirty;
      await user.click(screen.getByRole("button", { name: /help menu — open tutorial/i }));
      expect(screen.getByRole("dialog", { name: "FDraft Studio Tutorial" })).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Skip for Now" }));
      expect(screen.queryByRole("dialog", { name: "FDraft Studio Tutorial" })).not.toBeInTheDocument();

      expect(context.session.getState().dirty).toBe(dirtyBefore);
      expect(screen.getAllByText("Tutorial Test Event").length).toBeGreaterThan(0);
    });
  });

  it("never calls fetch — every step and bundled doc is offline content", async () => {
    await withTempDir(async (dir) => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      const context = await freshContext(dir);
      const user = userEvent.setup();
      await openFreshTutorial(context);
      await startTutorial(user);
      for (let i = 0; i < TUTORIAL_STEPS.length - 1; i += 1) {
        await user.click(screen.getByRole("button", { name: "Next" }));
      }
      await user.click(screen.getByRole("button", { name: "Open User Guide" }));
      expect(screen.getByRole("dialog", { name: "User Guide" })).toBeInTheDocument();
      expect(fetchSpy).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    });
  });

  it("missing tutorial asset handling: the bundled doc viewer never crashes, even given empty or malformed content", async () => {
    const { renderMarkdown } = await import("../../src/ui/tutorial/renderMarkdown.js");
    for (const input of ["", "   \n\n  ", "not markdown at all, just a plain sentence.", "# \n- \n"]) {
      expect(() => render(<div>{renderMarkdown(input)}</div>)).not.toThrow();
      cleanup();
    }
  });

  it("both Troubleshooting and User Guide open cleanly from the final step, each with real headings from the bundled content", async () => {
    await withTempDir(async (dir) => {
      const context = await freshContext(dir);
      const user = userEvent.setup();
      await openFreshTutorial(context);
      await startTutorial(user);
      for (let i = 0; i < TUTORIAL_STEPS.length - 1; i += 1) {
        await user.click(screen.getByRole("button", { name: "Next" }));
      }
      await user.click(screen.getByRole("button", { name: "Open Troubleshooting" }));
      expect(screen.getByRole("dialog", { name: "Troubleshooting" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: /FDraft Studio — Troubleshooting/i })).toBeInTheDocument();
    });
  });
});
