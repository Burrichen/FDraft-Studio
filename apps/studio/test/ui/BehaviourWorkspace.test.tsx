import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { withTempDir } from "../helpers/tempDir.js";
import { makeAppContext, renderWithApp } from "../helpers/renderApp.js";
import { StudioShell } from "../../src/ui/shell/StudioShell.js";

async function readyContextWithLayer(dir: string) {
  const context = await makeAppContext(dir);
  context.session.newProject("Behaviour Test Event");
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
  return context;
}

describe("BehaviourWorkspace", () => {
  it("shows an empty state and a disabled Add rule button before any layer exists", async () => {
    await withTempDir(async (dir) => {
      const context = await makeAppContext(dir);
      context.session.newProject("Empty");
      await context.session.saveAs(join(dir, "e.fdstudio"), "file");
      renderWithApp(<StudioShell />, context);
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Behaviour" }));
      expect(screen.getByText("No rules yet.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "+ Add rule" })).toBeDisabled();
    });
  });

  it("adds a rule with a schema-valid default, shown as a readable sentence", async () => {
    await withTempDir(async (dir) => {
      const context = await readyContextWithLayer(dir);
      renderWithApp(<StudioShell />, context);
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Behaviour" }));
      await user.click(screen.getByRole("button", { name: "+ Add rule" }));

      await waitFor(() => {
        expect(context.session.getState().open!.project.behaviourRules).toHaveLength(1);
      });
      expect(screen.getAllByText(/show "Box"/).length).toBeGreaterThan(0);
    });
  });

  it("toggles a rule's enabled state", async () => {
    await withTempDir(async (dir) => {
      const context = await readyContextWithLayer(dir);
      renderWithApp(<StudioShell />, context);
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Behaviour" }));
      await user.click(screen.getByRole("button", { name: "+ Add rule" }));
      await waitFor(() => expect(context.session.getState().open!.project.behaviourRules).toHaveLength(1));

      const checkbox = screen.getByRole("checkbox", { name: /enabled/ });
      expect(checkbox).toBeChecked();
      await user.click(checkbox);
      await waitFor(() => expect(context.session.getState().open!.project.behaviourRules[0]!.enabled).toBe(false));
    });
  });

  it("duplicates and deletes a rule", async () => {
    await withTempDir(async (dir) => {
      const context = await readyContextWithLayer(dir);
      renderWithApp(<StudioShell />, context);
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Behaviour" }));
      await user.click(screen.getByRole("button", { name: "+ Add rule" }));
      await waitFor(() => expect(context.session.getState().open!.project.behaviourRules).toHaveLength(1));

      await user.click(screen.getByRole("button", { name: /Duplicate/ }));
      await waitFor(() => expect(context.session.getState().open!.project.behaviourRules).toHaveLength(2));

      const deleteButtons = screen.getAllByRole("button", { name: /^Delete/ });
      await user.click(deleteButtons[0]!);
      await waitFor(() => expect(context.session.getState().open!.project.behaviourRules).toHaveLength(1));
    });
  });

  it("editing the condition to a numeric compare updates the readable summary and the live trace", async () => {
    await withTempDir(async (dir) => {
      const context = await readyContextWithLayer(dir);
      renderWithApp(<StudioShell />, context);
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Behaviour" }));
      await user.click(screen.getByRole("button", { name: "+ Add rule" }));
      await waitFor(() => expect(context.session.getState().open!.project.behaviourRules).toHaveLength(1));

      await user.click(screen.getByRole("button", { name: "New rule" }));
      const editor = screen.getByRole("heading", { name: "Condition" }).closest(".behaviour-editor")!;
      await user.selectOptions(within(editor).getByLabelText("Condition type"), "is between (inclusive)");

      await waitFor(() => {
        const rule = context.session.getState().open!.project.behaviourRules[0]!;
        expect(rule.condition).toEqual({ type: "inRange", variable: { kind: "progressPercent" }, min: 0, max: 100 });
      });
      expect(screen.getAllByText(/between 0 and 100/).length).toBeGreaterThan(0);

      await user.click(screen.getByRole("button", { name: "Show trace" }));
      const trace = screen.getByRole("region", { name: "Behaviour rule trace" });
      expect(within(trace).getByText(/condition true/)).toBeInTheDocument();

      const progressInput = screen.getByLabelText("Progress %");
      await user.clear(progressInput);
      await user.type(progressInput, "150");

      await waitFor(() => {
        expect(within(screen.getByRole("region", { name: "Behaviour rule trace" })).getByText(/condition false/)).toBeInTheDocument();
      });
    });
  });

  it("a real hover over the live preview drives an interactionFlag condition, not a manual simulator toggle", async () => {
    await withTempDir(async (dir) => {
      const context = await readyContextWithLayer(dir);
      renderWithApp(<StudioShell />, context);
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Behaviour" }));
      await user.click(screen.getByRole("button", { name: "+ Add rule" }));
      await waitFor(() => expect(context.session.getState().open!.project.behaviourRules).toHaveLength(1));
      await user.click(screen.getByRole("button", { name: "New rule" }));

      const editor = screen.getByRole("heading", { name: "Condition" }).closest(".behaviour-editor")!;
      await user.selectOptions(within(editor).getByLabelText("Condition type"), "is true/false");
      await user.selectOptions(within(editor).getByLabelText("Variable"), "interactionFlag");

      await waitFor(() => {
        const rule = context.session.getState().open!.project.behaviourRules[0]!;
        expect(rule.condition).toEqual({ type: "boolean", variable: { kind: "interactionFlag", which: "hover", layerId: "box" }, equals: true });
      });

      await user.click(screen.getByRole("button", { name: "Show trace" }));
      const trace = screen.getByRole("region", { name: "Behaviour rule trace" });
      expect(within(trace).getByText(/condition false/)).toBeInTheDocument();

      const boxNode = document.querySelector('[data-fdraft-layer-id="box"]')!;
      fireEvent.mouseEnter(boxNode);

      await waitFor(() => {
        expect(within(screen.getByRole("region", { name: "Behaviour rule trace" })).getByText(/condition true/)).toBeInTheDocument();
      });
    });
  });
});
