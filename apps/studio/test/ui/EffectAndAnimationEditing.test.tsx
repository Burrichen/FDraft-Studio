import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { withTempDir } from "../helpers/tempDir.js";
import { makeAppContext, renderWithApp } from "../helpers/renderApp.js";
import { StudioShell } from "../../src/ui/shell/StudioShell.js";

async function readyContext(dir: string) {
  const context = await makeAppContext(dir);
  context.session.newProject("Effects Test Event");
  await context.session.saveAs(join(dir, "event.fdstudio"), "file");
  return context;
}

describe("Effect layer and animation editing", () => {
  it("adds an effect layer from the layers panel and edits its intensity", async () => {
    await withTempDir(async (dir) => {
      const context = await readyContext(dir);
      renderWithApp(<StudioShell />, context);
      const user = userEvent.setup();

      await user.selectOptions(screen.getByLabelText("Add effect layer"), "snow");

      await waitFor(() => {
        const project = context.session.getState().open!.project;
        const layers = project.pages[0]!.layers;
        expect(layers).toHaveLength(1);
        expect(layers[0]!.type).toBe("effect");
      });

      await user.click(screen.getByRole("button", { name: "Snow" }));
      expect(await screen.findByText(/Effect: snow/)).toBeInTheDocument();

      const intensitySlider = screen.getAllByRole("slider")[0]!;
      await user.click(intensitySlider);

      const project = context.session.getState().open!.project;
      const effectLayer = project.pages[0]!.layers[0]!;
      expect(effectLayer.type === "effect" && effectLayer.effect.kind).toBe("snow");
    });
  });

  it("adds, edits, and deletes an animation on a layer", async () => {
    await withTempDir(async (dir) => {
      const context = await readyContext(dir);
      context.session.applyCommand({
        label: "seed",
        do: (p) => ({
          ...p,
          pages: p.pages.map((page, i) =>
            i === 0
              ? {
                  ...page,
                  layers: [
                    {
                      id: "box",
                      type: "shape" as const,
                      name: "Box",
                      shape: "rect" as const,
                      transform: { x: 0, y: 0, width: 100, height: 100, rotationDeg: 0, scaleX: 1, scaleY: 1 },
                      opacity: 1,
                      visible: true,
                      locked: false,
                      zIndex: 0,
                      responsive: [],
                      interactionStates: [],
                    },
                  ],
                }
              : page,
          ),
        }),
        undo: (p) => p,
      });
      renderWithApp(<StudioShell />, context);
      const user = userEvent.setup();

      await user.click(screen.getByRole("button", { name: "Box" }));
      await user.click(await screen.findByRole("button", { name: "+ Add animation" }));

      await waitFor(() => {
        const project = context.session.getState().open!.project;
        expect(project.pages[0]!.animations).toHaveLength(1);
      });

      await user.selectOptions(screen.getByLabelText("Preset"), "wobble");
      await waitFor(() => {
        const project = context.session.getState().open!.project;
        const animation = project.pages[0]!.animations[0]!;
        expect(animation.motion).toEqual({ type: "preset", preset: "wobble" });
      });

      await user.selectOptions(screen.getByLabelText("Trigger"), "manual");
      await waitFor(() => {
        expect(context.session.getState().open!.project.pages[0]!.animations[0]!.trigger).toBe("manual");
      });

      const animationName = context.session.getState().open!.project.pages[0]!.animations[0]!.name;
      await user.click(screen.getByRole("button", { name: `Delete ${animationName}` }));
      await waitFor(() => {
        expect(context.session.getState().open!.project.pages[0]!.animations).toHaveLength(0);
      });
    });
  });
});
