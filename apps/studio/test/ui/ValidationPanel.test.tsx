import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { withTempDir } from "../helpers/tempDir.js";
import { makeAppContext, renderWithApp } from "../helpers/renderApp.js";
import { StudioShell } from "../../src/ui/shell/StudioShell.js";

async function readyContext(dir: string) {
  const context = await makeAppContext(dir);
  context.session.newProject("Validation Test Event");
  const path = join(dir, "event.fdstudio");
  await context.session.saveAs(path, "file");
  return context;
}

describe("ValidationPanel", () => {
  it("shows no blocking errors and no warnings for a freshly-created project", async () => {
    await withTempDir(async (dir) => {
      const context = await readyContext(dir);
      renderWithApp(<StudioShell />, context);
      const user = userEvent.setup();

      await user.click(screen.getByRole("button", { name: "Open validation panel" }));
      expect(await screen.findByText("Blocking errors (0)")).toBeInTheDocument();
      expect(screen.getByText("Warnings (0)")).toBeInTheDocument();
    });
  });

  it("flags an undersized required component as a warning with a working 'Go to' that navigates and selects it", async () => {
    await withTempDir(async (dir) => {
      const context = await readyContext(dir);
      context.session.applyCommand({
        label: "seed",
        do: (p) => ({
          ...p,
          componentRequirements: [{ id: "req-1", componentKey: "generate-draft-action", required: false, allowedProperties: [], minWidthPx: 200, minHeightPx: 60 }],
          pages: p.pages.map((page, i) =>
            i === 0
              ? {
                  ...page,
                  layers: [
                    {
                      id: "tiny-cta",
                      type: "component" as const,
                      name: "Tiny CTA",
                      componentKey: "generate-draft-action",
                      componentRequirementId: "req-1",
                      styleOverrides: [],
                      transform: { x: 0, y: 0, width: 50, height: 20, rotationDeg: 0, scaleX: 1, scaleY: 1 },
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

      await user.click(screen.getByRole("button", { name: "Open validation panel" }));
      expect(await screen.findByText("Warnings (1)")).toBeInTheDocument();
      expect(screen.getByText(/below its minimum usable size/)).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Go to" }));

      await waitFor(() => expect(screen.queryByText("Warnings (1)")).not.toBeInTheDocument()); // panel closed
      expect(screen.getByRole("button", { name: "Tiny CTA" })).toHaveAttribute("aria-pressed", "true"); // selected in the Layers panel
    });
  });
});
