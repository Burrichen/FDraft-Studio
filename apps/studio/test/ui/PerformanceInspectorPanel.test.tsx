import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { withTempDir } from "../helpers/tempDir.js";
import { makeAppContext, renderWithApp } from "../helpers/renderApp.js";
import { StudioShell } from "../../src/ui/shell/StudioShell.js";

describe("PerformanceInspectorPanel", () => {
  it("opens from the top bar and shows real counts that update as the project changes", async () => {
    await withTempDir(async (dir) => {
      const context = await makeAppContext(dir);
      context.session.newProject("Perf Test");
      await context.session.saveAs(join(dir, "e.fdstudio"), "file");
      renderWithApp(<StudioShell />, context);
      const user = userEvent.setup();

      await user.click(screen.getByRole("button", { name: "Open performance inspector" }));
      expect(await screen.findByRole("heading", { name: "Performance inspector" })).toBeInTheDocument();
      expect(screen.getByText("None in this project.")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Close" }));
      await user.selectOptions(screen.getByLabelText("Add effect layer"), "confetti");
      await waitFor(() => expect(context.session.getState().open!.project.pages[0]!.layers).toHaveLength(1));

      await user.click(screen.getByRole("button", { name: "Open performance inspector" }));
      expect(await screen.findByText(/confetti/)).toBeInTheDocument();
    });
  });

  it("shows the low-tier no-motion notice and zero particles when switching the preview tier", async () => {
    await withTempDir(async (dir) => {
      const context = await makeAppContext(dir);
      context.session.newProject("Perf Test 2");
      await context.session.saveAs(join(dir, "e.fdstudio"), "file");
      renderWithApp(<StudioShell />, context);
      const user = userEvent.setup();

      await user.selectOptions(screen.getByLabelText("Add effect layer"), "stars");
      await waitFor(() => expect(context.session.getState().open!.project.pages[0]!.layers).toHaveLength(1));

      await user.click(screen.getByRole("button", { name: "Open performance inspector" }));
      await user.selectOptions(screen.getByLabelText("Preview tier"), "low");

      expect(screen.getByText(/fully disabled at the Low tier/)).toBeInTheDocument();
      expect(screen.getByText(/~0 particles/)).toBeInTheDocument();
    });
  });
});
