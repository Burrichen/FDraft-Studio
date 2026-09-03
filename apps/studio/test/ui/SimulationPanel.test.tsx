import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SimulationScenario } from "@fdraft/theme-sdk";
import { SimulationPanel } from "../../src/ui/simulation/SimulationPanel.js";
import { DEFAULT_SIMULATION_LIVE_STATE } from "../../src/simulation/simulationState.js";

const BUILT_IN: SimulationScenario = {
  id: "built-in-1",
  name: "Built-in scenario",
  ...DEFAULT_SIMULATION_LIVE_STATE,
  progressPercent: 10,
};

const SAVED: SimulationScenario = {
  id: "saved-1",
  name: "Saved scenario",
  ...DEFAULT_SIMULATION_LIVE_STATE,
  progressPercent: 75,
};

function renderPanel(overrides: Partial<React.ComponentProps<typeof SimulationPanel>> = {}) {
  const props = {
    state: DEFAULT_SIMULATION_LIVE_STATE,
    onChange: vi.fn(),
    pages: [{ id: "page-1", name: "Home" }],
    popups: [],
    scenarios: [BUILT_IN, SAVED],
    builtInScenarioIds: new Set(["built-in-1"]),
    activeScenarioId: undefined,
    onApplyScenario: vi.fn(),
    onSaveAsNewScenario: vi.fn(),
    onUpdateScenario: vi.fn(),
    onRenameScenario: vi.fn(),
    onDeleteScenario: vi.fn(),
    onDuplicateScenario: vi.fn(),
    ...overrides,
  };
  render(<SimulationPanel {...props} />);
  return props;
}

describe("SimulationPanel", () => {
  it("marks built-in scenarios and offers no delete button for them, but does for saved ones", () => {
    renderPanel();
    expect(screen.getByText(/Built-in scenario/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete Built-in scenario" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete Saved scenario" })).toBeInTheDocument();
  });

  it("applies a scenario on click", async () => {
    const user = userEvent.setup();
    const props = renderPanel();
    await user.click(screen.getByRole("button", { name: "Saved scenario" }));
    expect(props.onApplyScenario).toHaveBeenCalledWith(SAVED);
  });

  it("duplicates a built-in scenario (allowed) and a saved scenario (allowed)", async () => {
    const user = userEvent.setup();
    const props = renderPanel();
    await user.click(screen.getByRole("button", { name: "Duplicate Built-in scenario" }));
    expect(props.onDuplicateScenario).toHaveBeenCalledWith("built-in-1");
  });

  it("saves the current live state as a new scenario", async () => {
    const user = userEvent.setup();
    const props = renderPanel();
    await user.click(screen.getByRole("button", { name: "+ Save current as new scenario" }));
    expect(props.onSaveAsNewScenario).toHaveBeenCalled();
  });

  it("offers update/rename only for the active scenario when it isn't built-in", () => {
    renderPanel({ activeScenarioId: "saved-1" });
    expect(screen.getByRole("button", { name: /Update "Saved scenario"/ })).toBeInTheDocument();
    expect(screen.getByLabelText("Active scenario name")).toHaveValue("Saved scenario");
  });

  it("hides update/rename when the active scenario is built-in", () => {
    renderPanel({ activeScenarioId: "built-in-1" });
    expect(screen.queryByRole("button", { name: /Update "/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Active scenario name")).not.toBeInTheDocument();
  });

  it("edits a boolean field via onChange", async () => {
    const user = userEvent.setup();
    const props = renderPanel();
    await user.click(screen.getByLabelText("Opted in"));
    expect(props.onChange).toHaveBeenCalledWith({ ...DEFAULT_SIMULATION_LIVE_STATE, optedIn: true });
  });

  it("edits progress percent as a number", () => {
    const props = renderPanel();
    fireEvent.change(screen.getByLabelText("Progress %"), { target: { value: "42" } });
    expect(props.onChange).toHaveBeenLastCalledWith({ ...DEFAULT_SIMULATION_LIVE_STATE, progressPercent: 42 });
  });

  it("adds a placeholder value", async () => {
    const user = userEvent.setup();
    const props = renderPanel();
    await user.type(screen.getByLabelText("New placeholder name"), "eventName");
    await user.type(screen.getByLabelText("New placeholder value"), "Halloween");
    await user.click(screen.getByRole("button", { name: "+ Add" }));
    expect(props.onChange).toHaveBeenLastCalledWith({ ...DEFAULT_SIMULATION_LIVE_STATE, placeholderValues: { eventName: "Halloween" } });
  });

  it("removes a placeholder value, clearing back to undefined once empty", async () => {
    const user = userEvent.setup();
    const props = renderPanel({ state: { ...DEFAULT_SIMULATION_LIVE_STATE, placeholderValues: { eventName: "Halloween" } } });
    await user.click(screen.getByRole("button", { name: "Remove placeholder eventName" }));
    expect(props.onChange).toHaveBeenLastCalledWith({ ...DEFAULT_SIMULATION_LIVE_STATE, placeholderValues: undefined });
  });
});
