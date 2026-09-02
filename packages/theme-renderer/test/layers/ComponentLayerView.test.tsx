import { describe, expect, it } from "vitest";
import type { ComponentLayer, ComponentRequirement } from "@fdraft/theme-sdk";
import { ComponentLayerView } from "../../src/layers/ComponentLayerView.js";
import { EMPTY_DOCUMENT, renderWithRendererContext } from "../helpers/renderLayer.js";
import type { ComponentAdapterProps } from "../../src/types.js";

const baseTransform = { x: 0, y: 0, width: 200, height: 60, rotationDeg: 0, scaleX: 1, scaleY: 1 };

const requirement: ComponentRequirement = {
  id: "req-1",
  componentKey: "points-counter",
  required: true,
  allowedProperties: ["color", "backgroundColor"],
};

function makeLayer(overrides: Partial<ComponentLayer> = {}): ComponentLayer {
  return {
    id: "comp-1",
    type: "component",
    name: "Points",
    componentKey: "points-counter",
    componentRequirementId: "req-1",
    styleOverrides: [],
    transform: baseTransform,
    opacity: 1,
    visible: true,
    locked: false,
    zIndex: 0,
    responsive: [],
    interactionStates: [],
    ...overrides,
  };
}

function SampleAdapter({ style, widthPx, heightPx, copy, enabled }: ComponentAdapterProps) {
  return (
    <div data-testid="sample-adapter" data-width={widthPx} data-height={heightPx} data-enabled={enabled} style={style}>
      {copy.label ?? "points"}
    </div>
  );
}

describe("ComponentLayerView", () => {
  it("renders the registered adapter with resolved requirement/style/size", () => {
    const { getByTestId } = renderWithRendererContext(<ComponentLayerView layer={makeLayer()} />, {
      document: { ...EMPTY_DOCUMENT, componentRequirements: [requirement] },
      componentAdapters: { "points-counter": SampleAdapter },
    });
    const el = getByTestId("sample-adapter");
    expect(el).toBeInTheDocument();
    expect(el.getAttribute("data-width")).toBe("200");
    expect(el.getAttribute("data-height")).toBe("60");
  });

  it("shows a useful compatibility error when no adapter is registered for a required component", () => {
    const { container, getByText } = renderWithRendererContext(<ComponentLayerView layer={makeLayer()} />, {
      document: { ...EMPTY_DOCUMENT, componentRequirements: [requirement] },
      componentAdapters: {},
    });
    const fallback = container.querySelector('[data-fdraft-error="missing-component"]');
    expect(fallback).toBeTruthy();
    expect(fallback?.getAttribute("data-fdraft-component-key")).toBe("points-counter");
    expect(getByText("points-counter")).toBeInTheDocument();
  });

  it("shows a fallback when componentRequirementId doesn't match any declared requirement", () => {
    const { container } = renderWithRendererContext(<ComponentLayerView layer={makeLayer({ componentRequirementId: "missing-req" })} />, {
      document: EMPTY_DOCUMENT,
      componentAdapters: { "points-counter": SampleAdapter },
    });
    expect(container.querySelector('[data-fdraft-error="missing-component"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="sample-adapter"]')).toBeNull();
  });

  it("drops style properties outside the requirement's allowedProperties even if present in the data", () => {
    const layer = makeLayer({
      styleOverrides: [
        {
          id: "override-1",
          componentRequirementId: "req-1",
          // fontSize is not in this requirement's allowedProperties.
          style: { color: "#fff", fontSize: 40 } as unknown as ComponentLayer["styleOverrides"][number]["style"],
        },
      ],
    });
    const { getByTestId } = renderWithRendererContext(<ComponentLayerView layer={layer} />, {
      document: { ...EMPTY_DOCUMENT, componentRequirements: [requirement] },
      componentAdapters: { "points-counter": SampleAdapter },
    });
    const el = getByTestId("sample-adapter");
    expect(el.style.color).toBe("rgb(255, 255, 255)");
    expect(el.style.fontSize).toBe("");
  });

  it("passes resolved copy (default text) to the adapter when no override is set", () => {
    const { getByTestId } = renderWithRendererContext(<ComponentLayerView layer={makeLayer()} />, {
      document: { ...EMPTY_DOCUMENT, componentRequirements: [requirement] },
      componentAdapters: { "points-counter": SampleAdapter },
      copyContracts: { "points-counter": [{ key: "label", label: "Label", defaultText: "Default Points Label", required: true }] },
    });
    expect(getByTestId("sample-adapter").textContent).toBe("Default Points Label");
  });

  it("passes the theme-authored copy override to the adapter", () => {
    const { getByTestId } = renderWithRendererContext(<ComponentLayerView layer={makeLayer({ copyOverrides: { label: "Custom Label" } })} />, {
      document: { ...EMPTY_DOCUMENT, componentRequirements: [requirement] },
      componentAdapters: { "points-counter": SampleAdapter },
      copyContracts: { "points-counter": [{ key: "label", label: "Label", defaultText: "Default Points Label", required: true }] },
    });
    expect(getByTestId("sample-adapter").textContent).toBe("Custom Label");
  });

  it("substitutes an allowed runtime placeholder using RenderState.placeholderValues", () => {
    const { getByTestId } = renderWithRendererContext(<ComponentLayerView layer={makeLayer()} />, {
      document: { ...EMPTY_DOCUMENT, componentRequirements: [requirement] },
      componentAdapters: { "points-counter": SampleAdapter },
      copyContracts: { "points-counter": [{ key: "label", label: "Label", defaultText: "{{watchedCount}} watched", required: true, allowedPlaceholders: ["watchedCount"] }] },
      renderState: { activeImageStates: {}, placeholderValues: { watchedCount: "7" } },
    });
    expect(getByTestId("sample-adapter").textContent).toBe("7 watched");
  });

  it("defaults enabled to true with no Behaviour rules", () => {
    const { getByTestId } = renderWithRendererContext(<ComponentLayerView layer={makeLayer()} />, {
      document: { ...EMPTY_DOCUMENT, componentRequirements: [requirement] },
      componentAdapters: { "points-counter": SampleAdapter },
    });
    expect(getByTestId("sample-adapter").dataset.enabled).toBe("true");
  });

  it("applies a Behaviour setEnabled action", () => {
    const { getByTestId } = renderWithRendererContext(<ComponentLayerView layer={makeLayer()} />, {
      document: {
        ...EMPTY_DOCUMENT,
        componentRequirements: [requirement],
        behaviourRules: [{ id: "r1", name: "Disable while loading", enabled: true, priority: 0, trigger: { type: "whileTrue" }, condition: { type: "always" }, actions: [{ type: "setEnabled", layerId: "comp-1", enabled: false }] }],
      },
      componentAdapters: { "points-counter": SampleAdapter },
    });
    expect(getByTestId("sample-adapter").dataset.enabled).toBe("false");
  });

  it("applies a Behaviour applyStyleOverride action on top of the layer's own static style override", () => {
    const layer = makeLayer({ styleOverrides: [{ id: "o1", componentRequirementId: "req-1", style: { color: "#fff" } }] });
    const { getByTestId } = renderWithRendererContext(<ComponentLayerView layer={layer} />, {
      document: {
        ...EMPTY_DOCUMENT,
        componentRequirements: [requirement],
        behaviourRules: [{ id: "r1", name: "Highlight", enabled: true, priority: 0, trigger: { type: "whileTrue" }, condition: { type: "always" }, actions: [{ type: "applyStyleOverride", layerId: "comp-1", componentRequirementId: "req-1", property: "backgroundColor", value: "#f00" }] }],
      },
      componentAdapters: { "points-counter": SampleAdapter },
    });
    const el = getByTestId("sample-adapter");
    expect(el.style.color).toBe("rgb(255, 255, 255)");
    expect(el.style.backgroundColor).toBe("rgb(255, 0, 0)");
  });

  it("prefers an active selectCopyVariant action's text over both the default and the theme's own copyOverrides", () => {
    const layer = makeLayer({ copyOverrides: { label: "Static override" }, copyVariants: { label: [{ id: "variant-a", text: "Variant wording" }] } });
    const { getByTestId } = renderWithRendererContext(<ComponentLayerView layer={layer} />, {
      document: {
        ...EMPTY_DOCUMENT,
        componentRequirements: [requirement],
        behaviourRules: [{ id: "r1", name: "Pick variant", enabled: true, priority: 0, trigger: { type: "whileTrue" }, condition: { type: "always" }, actions: [{ type: "selectCopyVariant", layerId: "comp-1", slotKey: "label", variantId: "variant-a" }] }],
      },
      componentAdapters: { "points-counter": SampleAdapter },
      copyContracts: { "points-counter": [{ key: "label", label: "Label", defaultText: "Default Points Label", required: true }] },
    });
    expect(getByTestId("sample-adapter").textContent).toBe("Variant wording");
  });
});
