import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { withTempDir } from "../helpers/tempDir.js";
import { makeAppContext } from "../helpers/renderApp.js";
import { AppProvider } from "../../src/AppContext.js";
import { TutorialProvider, useTutorial } from "../../src/tutorial/TutorialContext.js";
import { TutorialPanel } from "../../src/ui/tutorial/TutorialPanel.js";

/**
 * A real, structural (never wall-clock/timing-based, per this project's
 * own established aversion to flaky CI timing assertions — see
 * `docs/IMPLEMENTATION_STATUS.md`'s "no automated wall-clock performance-
 * timing budget assertions" note) memory-leak check: repeatedly
 * open/close the tutorial dialog and confirm `useModalA11y`'s own
 * `keydown` listener (the one thing the tutorial adds to a shared,
 * long-lived target — `container`, effectively `document`-scoped across
 * the whole app lifetime) is removed exactly as many times as it's
 * added, every cycle. A leak here would mean listeners piling up for the
 * lifetime of the whole app, not just this one dialog.
 */
function HelpTrigger(): React.ReactNode {
  const tutorial = useTutorial();
  return (
    <button type="button" onClick={() => tutorial.open()}>
      Open
    </button>
  );
}

describe("tutorial memory-leak check", () => {
  afterEach(() => cleanup());

  it("adds and removes exactly one keydown listener per open/close cycle across many repeats, never accumulating", async () => {
    await withTempDir(async (dir) => {
      const context = await makeAppContext(dir, undefined, { freshTutorial: false });
      const user = userEvent.setup();

      render(
        <AppProvider value={context}>
          <TutorialProvider>
            <HelpTrigger />
            <TutorialPanel />
          </TutorialProvider>
        </AppProvider>,
      );

      // One warm-up cycle first, un-observed — `userEvent.setup()` and
      // the dialog's first real mount both register a small, constant
      // number of listeners of their own that have nothing to do with
      // repeated open/close (confirmed empirically: a fixed +3 offset
      // appeared regardless of cycle count before this warm-up was
      // added). Only listener churn from THIS test's own loop below is
      // what "no leak" needs to prove.
      async function cycle(): Promise<void> {
        await user.click(screen.getByRole("button", { name: "Open" }));
        await waitFor(() => screen.getByRole("dialog", { name: "FDraft Studio Tutorial" }));
        await user.keyboard("{Escape}");
        expect(screen.queryByRole("dialog", { name: "FDraft Studio Tutorial" })).not.toBeInTheDocument();
      }
      await cycle();

      const addSpy = vi.spyOn(EventTarget.prototype, "addEventListener");
      const removeSpy = vi.spyOn(EventTarget.prototype, "removeEventListener");

      const CYCLES = 25;
      for (let i = 0; i < CYCLES; i += 1) {
        await cycle();
      }

      const keydownAdds = addSpy.mock.calls.filter((call) => call[0] === "keydown").length;
      const keydownRemoves = removeSpy.mock.calls.filter((call) => call[0] === "keydown").length;
      expect(keydownAdds).toBe(CYCLES);
      expect(keydownRemoves).toBe(CYCLES);

      addSpy.mockRestore();
      removeSpy.mockRestore();
    });
  });
});
