import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { withTempDir } from "../helpers/tempDir.js";
import { makeAppContext, renderWithApp } from "../helpers/renderApp.js";
import { StudioShell } from "../../src/ui/shell/StudioShell.js";
import { openProjectFromPath } from "../../src/project/projectFile.js";

async function readyContext(dir: string) {
  const context = await makeAppContext(dir);
  context.session.newProject("Shell Test Event");
  const path = join(dir, "event.fdstudio");
  await context.session.saveAs(path, "file");
  return context;
}

describe("StudioShell", () => {
  it("renders the command bar, panels, and central stage for an open project", async () => {
    await withTempDir(async (dir) => {
      const context = await readyContext(dir);
      renderWithApp(<StudioShell />, context);

      expect(screen.getByRole("banner")).toBeInTheDocument();
      expect(screen.getByRole("navigation", { name: "Pages and layers" })).toBeInTheDocument();
      expect(screen.getByRole("complementary", { name: "Properties" })).toBeInTheDocument();
      expect(screen.getByRole("navigation", { name: "Editor mode" })).toBeInTheDocument();
      expect(screen.getAllByText("Shell Test Event").length).toBeGreaterThan(0);
    });
  });

  it("collapses side panels without touching the central stage", async () => {
    await withTempDir(async (dir) => {
      const context = await readyContext(dir);
      renderWithApp(<StudioShell />, context);

      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Toggle Pages and Layers panel" }));
      expect(screen.queryByRole("navigation", { name: "Pages and layers" })).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Toggle Properties panel" }));
      expect(screen.queryByRole("complementary", { name: "Properties" })).not.toBeInTheDocument();
    });
  });

  it("Preview mode hides every editor control", async () => {
    await withTempDir(async (dir) => {
      const context = await readyContext(dir);
      renderWithApp(<StudioShell />, context);

      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Preview" }));

      expect(screen.queryByRole("banner")).not.toBeInTheDocument();
      expect(screen.queryByRole("navigation", { name: "Pages and layers" })).not.toBeInTheDocument();
      expect(screen.queryByRole("complementary", { name: "Properties" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Exit Preview" })).toBeInTheDocument();
    });
  });

  it("Assets mode replaces the Design layout with the Asset Workspace, and switching back restores it", async () => {
    await withTempDir(async (dir) => {
      const context = await readyContext(dir);
      renderWithApp(<StudioShell />, context);

      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Assets" }));

      expect(screen.queryByRole("navigation", { name: "Pages and layers" })).not.toBeInTheDocument();
      expect(screen.queryByRole("complementary", { name: "Properties" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Import…" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Folders" })).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Design" }));
      expect(screen.getByRole("navigation", { name: "Pages and layers" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Import…" })).not.toBeInTheDocument();
    });
  });

  it("editing the project name in the Properties panel is undoable and saves", async () => {
    await withTempDir(async (dir) => {
      const context = await readyContext(dir);
      renderWithApp(<StudioShell />, context);

      const user = userEvent.setup();
      const nameInput = screen.getByLabelText("Name");
      await user.clear(nameInput);
      await user.type(nameInput, "Renamed Event");
      await user.tab(); // blur

      await waitFor(() => expect(context.session.getState().dirty).toBe(true));
      expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled();

      await user.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => expect(context.session.getState().dirty).toBe(false));

      const reopened = await openProjectFromPath(context.platform, context.session.getState().open!.path);
      expect(reopened.project.metadata.name).toBe("Renamed Event");
    });
  });
});
