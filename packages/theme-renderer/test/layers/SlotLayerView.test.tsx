import { describe, expect, it } from "vitest";
import type { SlotLayer } from "@fdraft/theme-sdk";
import { SlotLayerView } from "../../src/layers/SlotLayerView.js";
import { renderWithRendererContext } from "../helpers/renderLayer.js";

function makeLayer(overrides: Partial<SlotLayer> = {}): SlotLayer {
  return {
    id: "slot-1",
    type: "slot",
    name: "Slot",
    slotKey: "hero-content",
    transform: { x: 0, y: 0, width: 100, height: 100, rotationDeg: 0, scaleX: 1, scaleY: 1 },
    opacity: 1,
    visible: true,
    locked: false,
    zIndex: 0,
    responsive: [],
    interactionStates: [],
    ...overrides,
  };
}

describe("SlotLayerView", () => {
  it("renders a placeholder shell when no host content is registered", () => {
    const { container, getByText } = renderWithRendererContext(<SlotLayerView layer={makeLayer()} />);
    expect(container.querySelector('[data-fdraft-placeholder="slot"]')).toBeTruthy();
    expect(getByText("Slot: hero-content")).toBeInTheDocument();
  });

  it("renders host-supplied content for a matching slotKey instead of the placeholder", () => {
    const { container, getByText } = renderWithRendererContext(<SlotLayerView layer={makeLayer()} />, {
      slotContent: { "hero-content": <span>Real host content</span> },
    });
    expect(container.querySelector('[data-fdraft-placeholder="slot"]')).toBeNull();
    expect(getByText("Real host content")).toBeInTheDocument();
  });
});
