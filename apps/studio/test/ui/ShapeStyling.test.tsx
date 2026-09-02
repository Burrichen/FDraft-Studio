import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { withTempDir } from "../helpers/tempDir.js";
import { makeAppContext, renderWithApp } from "../helpers/renderApp.js";
import { StudioShell } from "../../src/ui/shell/StudioShell.js";

async function readyContextWithShape(dir: string) {
  const context = await makeAppContext(dir);
  context.session.newProject("Shape Styling Test");
  const path = join(dir, "event.fdstudio");
  await context.session.saveAs(path, "file");
  context.session.applyCommand({
    label: "seed",
    do: (p) => ({
      ...p,
      pages: p.pages.map((page, i) =>
        i === 0
          ? {
              ...page,
              layers: [
                { id: "box", type: "shape" as const, name: "Box", shape: "rect" as const, transform: { x: 0, y: 0, width: 100, height: 100, rotationDeg: 0, scaleX: 1, scaleY: 1 }, opacity: 1, visible: true, locked: false, zIndex: 0, responsive: [], interactionStates: [] },
              ],
            }
          : page,
      ),
    }),
    undo: (p) => p,
  });
  return context;
}

describe("Shape fill/corner-radius quick-create", () => {
  it("creates a new color token from zero and assigns it as the shape's fill", async () => {
    await withTempDir(async (dir) => {
      const context = await readyContextWithShape(dir);
      renderWithApp(<StudioShell />, context);
      const user = userEvent.setup();

      await user.click(screen.getByRole("button", { name: "Box" }));
      await user.selectOptions(await screen.findByLabelText("Fill color"), "+ New color…");

      await waitFor(() => {
        const project = context.session.getState().open!.project;
        expect(project.tokens.colors).toHaveLength(1);
        const box = project.pages[0]!.layers[0];
        expect(box && "fillColorTokenId" in box ? box.fillColorTokenId : undefined).toBe(project.tokens.colors[0]!.id);
      });
    });
  });

  it("creates a new radius token from zero and assigns it as the shape's corner radius", async () => {
    await withTempDir(async (dir) => {
      const context = await readyContextWithShape(dir);
      renderWithApp(<StudioShell />, context);
      const user = userEvent.setup();

      await user.click(screen.getByRole("button", { name: "Box" }));
      await user.selectOptions(await screen.findByLabelText("Corner radius"), "+ New radius…");

      await waitFor(() => {
        const project = context.session.getState().open!.project;
        expect(project.tokens.radii).toHaveLength(1);
        const box = project.pages[0]!.layers[0];
        expect(box && "cornerRadiusTokenId" in box ? box.cornerRadiusTokenId : undefined).toBe(project.tokens.radii[0]!.id);
      });
    });
  });
});
