import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { withTempDir } from "../helpers/tempDir.js";
import { makeAppContext, renderWithApp } from "../helpers/renderApp.js";
import { StudioShell } from "../../src/ui/shell/StudioShell.js";

describe("Reduced-motion and performance-tier preview", () => {
  it("toggling reduced motion in the status bar actually suppresses a live animation in the canvas", async () => {
    await withTempDir(async (dir) => {
      const context = await makeAppContext(dir);
      context.session.newProject("Motion Test");
      await context.session.saveAs(join(dir, "e.fdstudio"), "file");
      context.session.applyCommand({
        label: "seed",
        do: (p) => ({
          ...p,
          pages: p.pages.map((page, i) =>
            i === 0
              ? {
                  ...page,
                  layers: [{ id: "box", type: "shape" as const, name: "Box", shape: "rect" as const, transform: { x: 0, y: 0, width: 100, height: 100, rotationDeg: 0, scaleX: 1, scaleY: 1 }, opacity: 1, visible: true, locked: false, zIndex: 0, responsive: [], interactionStates: [] }],
                  animations: [{ id: "anim-1", name: "Fade", trigger: "onEnter" as const, targetLayerId: "box", motion: { type: "preset" as const, preset: "fade" as const }, durationMs: 400, delayMs: 0, easing: "easeOut" as const, loop: false, direction: "normal" as const, intensity: 1 }],
                }
              : page,
          ),
        }),
        undo: (p) => p,
      });

      renderWithApp(<StudioShell />, context);
      const user = userEvent.setup();

      const getBoxFrame = () => document.querySelector('[data-fdraft-layer-id="box"]') as HTMLElement;
      await waitFor(() => expect(getBoxFrame().style.animationName).toMatch(/fdraft-anim-fade/));

      await user.click(screen.getByText("Preview reduced motion"));
      await waitFor(() => expect(getBoxFrame().style.animationName).toBe(""));

      await user.click(screen.getByText("Preview reduced motion"));
      await waitFor(() => expect(getBoxFrame().style.animationName).toMatch(/fdraft-anim-fade/));
    });
  });

  it("switching to the low performance tier disables effects in the canvas", async () => {
    await withTempDir(async (dir) => {
      const context = await makeAppContext(dir);
      context.session.newProject("Tier Test");
      await context.session.saveAs(join(dir, "e.fdstudio"), "file");
      renderWithApp(<StudioShell />, context);
      const user = userEvent.setup();

      await user.selectOptions(screen.getByLabelText("Add effect layer"), "snow");
      await waitFor(() => expect(context.session.getState().open!.project.pages[0]!.layers).toHaveLength(1));
      await waitFor(() => expect(document.querySelector("canvas")).toBeTruthy());

      await user.selectOptions(screen.getByLabelText("Performance tier"), "low");
      await waitFor(() => expect(document.querySelector("canvas")).toBeNull());
    });
  });
});
