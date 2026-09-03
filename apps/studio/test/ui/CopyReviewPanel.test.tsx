import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createId, createProject } from "@fdraft/theme-sdk";
import type { ComponentLayer, StudioProjectDocument } from "@fdraft/theme-sdk";
import { createStaticAssetResolver, type ComponentAdapterRegistry, type ComponentCopyContractRegistry } from "@fdraft/theme-renderer";
import { CopyReviewPanel } from "../../src/ui/copy/CopyReviewPanel.js";

const CONTRACTS: ComponentCopyContractRegistry = {
  "generate-draft-action": [{ key: "label", label: "Button label", defaultText: "Generate My Draft", required: true }],
};

const ADAPTERS: ComponentAdapterRegistry = {
  "generate-draft-action": (props) => <button type="button">{props.copy.label}</button>,
};

function projectWithComponentLayer(): StudioProjectDocument {
  const layer: ComponentLayer = {
    id: "cta-layer",
    type: "component",
    name: "CTA",
    componentKey: "generate-draft-action",
    componentRequirementId: createId(),
    styleOverrides: [],
    transform: { x: 0, y: 0, width: 200, height: 60, rotationDeg: 0, scaleX: 1, scaleY: 1 },
    opacity: 1,
    visible: true,
    locked: false,
    zIndex: 0,
    responsive: [],
    interactionStates: [],
  };
  const project = createProject({ id: createId(), name: "Test" });
  project.pages = [{ id: "page-1", name: "Home", slug: "home", layers: [layer], animations: [] }];
  return project;
}

function renderPanel(project: StudioProjectDocument) {
  const onClose = vi.fn();
  const onNavigate = vi.fn();
  render(
    <CopyReviewPanel project={project} copyContracts={CONTRACTS} resolver={createStaticAssetResolver({})} componentAdapters={ADAPTERS} onClose={onClose} onNavigate={onNavigate} />,
  );
  return { onClose, onNavigate };
}

describe("CopyReviewPanel", () => {
  it("flags a component's slot with no stored override as falling back to the FDraft default", () => {
    renderPanel(projectWithComponentLayer());
    expect(screen.getByRole("listitem")).toHaveTextContent("CTA");
    expect(screen.getByRole("listitem")).toHaveTextContent("Button label");
    expect(screen.getByRole("listitem")).toHaveTextContent('Using the FDraft default: "Generate My Draft".');
  });

  it("shows nothing to report for a project with no component copy slots", () => {
    const project = createProject({ id: createId(), name: "Empty" });
    renderPanel(project);
    expect(screen.getByText(/Nothing to report/)).toBeInTheDocument();
  });

  it("filters findings by category", async () => {
    const user = userEvent.setup();
    renderPanel(projectWithComponentLayer());
    await user.selectOptions(screen.getByLabelText("Category filter"), "missing");
    expect(screen.getByText(/Nothing to report in "Missing/)).toBeInTheDocument();
  });

  it("Go to calls onNavigate with the finding's page and layer selected", async () => {
    const user = userEvent.setup();
    const { onNavigate } = renderPanel(projectWithComponentLayer());
    await user.click(screen.getByRole("button", { name: "Go to" }));
    expect(onNavigate).toHaveBeenCalledWith({ kind: "page", pageId: "page-1" }, new Set(["cta-layer"]));
  });

  it("closes via the close button", async () => {
    const user = userEvent.setup();
    const { onClose } = renderPanel(projectWithComponentLayer());
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("scanning for clipped text completes without crashing and re-enables the button", async () => {
    const user = userEvent.setup();
    renderPanel(projectWithComponentLayer());
    const button = screen.getByRole("button", { name: "Scan for clipped text" });
    await user.click(button);
    expect(screen.getByRole("button", { name: "Scan for clipped text" })).not.toBeDisabled();
  });
});
