import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { withTempDir } from "../helpers/tempDir.js";
import { makeAppContext, renderWithApp } from "../helpers/renderApp.js";
import { StudioShell } from "../../src/ui/shell/StudioShell.js";

async function readyContext(dir: string) {
  const context = await makeAppContext(dir);
  context.session.newProjectFromTemplate("Halloween Bash", "standard-fdraft");
  const path = join(dir, "event.fdstudio");
  await context.session.saveAs(path, "file");
  return context;
}

describe("Component copy and zone editing", () => {
  it("selecting the page-title component on Event Landing shows its declared copy slot with the FDraft default as a placeholder", async () => {
    await withTempDir(async (dir) => {
      const context = await readyContext(dir);
      renderWithApp(<StudioShell />, context);
      const user = userEvent.setup();

      // Event Landing is the first page — select its page-title layer via the Layers panel.
      await user.click(screen.getByRole("button", { name: "page-title" }));

      const titleField = await screen.findByLabelText("Title");
      expect((titleField as HTMLTextAreaElement).placeholder).toBe("Sample Event Title");
      expect(screen.getByText("Using FDraft default")).toBeInTheDocument();
    });
  });

  it("editing a copy slot writes a copyOverrides entry, and clearing it removes the override again", async () => {
    await withTempDir(async (dir) => {
      const context = await readyContext(dir);
      renderWithApp(<StudioShell />, context);
      const user = userEvent.setup();

      await user.click(screen.getByRole("button", { name: "page-title" }));
      const titleField = await screen.findByLabelText("Title");
      await user.type(titleField, "Spooky Season Kickoff");
      await user.tab();

      await waitFor(() => {
        const landing = context.session.getState().open!.project.pages[0]!;
        const titleLayer = landing.layers.find((l) => l.type === "component" && l.componentKey === "page-title");
        expect(titleLayer && "copyOverrides" in titleLayer ? titleLayer.copyOverrides?.title : undefined).toBe("Spooky Season Kickoff");
      });

      await user.clear(screen.getByLabelText("Title"));
      await user.tab();
      await waitFor(() => {
        const landing = context.session.getState().open!.project.pages[0]!;
        const titleLayer = landing.layers.find((l) => l.type === "component" && l.componentKey === "page-title");
        expect(titleLayer && "copyOverrides" in titleLayer ? titleLayer.copyOverrides : undefined).toBeUndefined();
      });
    });
  });

  it("assigns a zone to a component and it's reflected in the project", async () => {
    await withTempDir(async (dir) => {
      const context = await readyContext(dir);
      renderWithApp(<StudioShell />, context);
      const user = userEvent.setup();

      await user.click(screen.getByRole("button", { name: "page-title" }));
      const zoneSelect = await screen.findByLabelText("Zone");
      await user.selectOptions(zoneSelect, "header");

      await waitFor(() => {
        const landing = context.session.getState().open!.project.pages[0]!;
        const titleLayer = landing.layers.find((l) => l.type === "component" && l.componentKey === "page-title");
        expect(titleLayer && "zoneKind" in titleLayer ? titleLayer.zoneKind : undefined).toBe("header");
      });
    });
  });
});
