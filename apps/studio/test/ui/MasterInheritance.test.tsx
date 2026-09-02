import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { withTempDir } from "../helpers/tempDir.js";
import { makeAppContext, renderWithApp } from "../helpers/renderApp.js";
import { StudioShell } from "../../src/ui/shell/StudioShell.js";
import { buildAddMasterCommand } from "../../src/project/containerCommands.js";

async function readyContext(dir: string) {
  const context = await makeAppContext(dir);
  context.session.newProject("Master Test Event");
  const path = join(dir, "event.fdstudio");
  await context.session.saveAs(path, "file");
  return context;
}

describe("Page/master navigation and inheritance", () => {
  it("adds a page from the Left Panel and it becomes selectable", async () => {
    await withTempDir(async (dir) => {
      const context = await readyContext(dir);
      renderWithApp(<StudioShell />, context);
      const user = userEvent.setup();

      await user.click(screen.getByRole("button", { name: "Add page" }));
      await waitFor(() => expect(context.session.getState().open?.project.pages).toHaveLength(2));
      expect(screen.getByRole("button", { name: "New Page" })).toBeInTheDocument();
    });
  });

  it("renames a page via the inline editor", async () => {
    await withTempDir(async (dir) => {
      const context = await readyContext(dir);
      renderWithApp(<StudioShell />, context);
      const user = userEvent.setup();

      await user.click(screen.getByRole("button", { name: "Rename Home" }));
      const input = screen.getByLabelText("Rename Home");
      await user.clear(input);
      await user.type(input, "Landing");
      await user.tab();

      await waitFor(() => expect(context.session.getState().open?.project.pages[0]!.name).toBe("Landing"));
    });
  });

  it("assigns a master to a page, overrides an inherited layer, and detaches it — all reflected in the underlying project", async () => {
    await withTempDir(async (dir) => {
      const context = await readyContext(dir);
      // Seed a master with one layer directly in the session for this test.
      context.session.applyCommand(buildAddMasterCommand("Base Master"));
      const masterId = context.session.getState().open!.project.masters[0]!.id;
      context.session.applyCommand({
        label: "seed master layer",
        do: (p) => ({ ...p, masters: p.masters.map((m) => (m.id === masterId ? { ...m, layers: [{ id: "bg-layer", type: "shape" as const, name: "Background", shape: "rect" as const, transform: { x: 0, y: 0, width: 100, height: 100, rotationDeg: 0, scaleX: 1, scaleY: 1 }, opacity: 1, visible: true, locked: false, zIndex: 0, responsive: [], interactionStates: [] }] } : m)) }),
        undo: (p) => p,
      });

      renderWithApp(<StudioShell />, context);
      const user = userEvent.setup();

      const masterSelect = screen.getByLabelText("Inherits from");
      await user.selectOptions(masterSelect, "Base Master");
      await waitFor(() => expect(context.session.getState().open?.project.pages[0]!.masterId).toBe(masterId));

      expect(screen.getByText("Background")).toBeInTheDocument();
      const visibleCheckbox = screen.getByRole("checkbox", { name: "Visible" });
      await user.click(visibleCheckbox);
      await waitFor(() => expect(context.session.getState().open?.project.pages[0]!.masterLayerOverrides?.["bg-layer"]).toEqual({ visible: false }));
      expect(screen.getByText("Overridden")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Detach from master" }));
      await waitFor(() => expect(context.session.getState().open?.project.pages[0]!.masterId).toBeUndefined());
      const detachedLayers = context.session.getState().open!.project.pages[0]!.layers;
      expect(detachedLayers).toHaveLength(1);
      expect(detachedLayers[0]!.visible).toBe(false); // the override survived materialisation
      expect(detachedLayers[0]!.id).not.toBe("bg-layer");
    });
  });

  it("refuses to delete a master still used by a page, via a confirm dialog", async () => {
    await withTempDir(async (dir) => {
      const context = await readyContext(dir);
      context.session.applyCommand(buildAddMasterCommand("Base Master"));
      const masterId = context.session.getState().open!.project.masters[0]!.id;
      renderWithApp(<StudioShell />, context);
      const user = userEvent.setup();

      await user.selectOptions(screen.getByLabelText("Inherits from"), "Base Master");
      await waitFor(() => expect(context.session.getState().open?.project.pages[0]!.masterId).toBe(masterId));

      context.dialogs.confirmQueue = [true]; // acknowledges the "cannot delete" notice, doesn't matter which
      await user.click(screen.getByRole("button", { name: "Delete Base Master" }));

      expect(context.session.getState().open?.project.masters).toHaveLength(1); // never actually deleted
    });
  });
});
