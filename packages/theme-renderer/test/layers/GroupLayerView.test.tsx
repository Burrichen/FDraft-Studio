import { describe, expect, it } from "vitest";
import type { GroupLayer } from "@fdraft/theme-sdk";
import { GroupLayerView } from "../../src/layers/GroupLayerView.js";
import { renderWithRendererContext } from "../helpers/renderLayer.js";

const baseTransform = { x: 0, y: 0, width: 100, height: 100, rotationDeg: 0, scaleX: 1, scaleY: 1 };

function makeGroup(overrides: Partial<GroupLayer> = {}): GroupLayer {
  return {
    id: "group-1",
    type: "group",
    name: "Group",
    transform: baseTransform,
    opacity: 1,
    visible: true,
    locked: false,
    zIndex: 0,
    responsive: [],
    interactionStates: [],
    children: [
      {
        id: "child-1",
        type: "shape",
        name: "Child",
        shape: "rect",
        transform: baseTransform,
        opacity: 1,
        visible: true,
        locked: false,
        zIndex: 0,
        responsive: [],
        interactionStates: [],
      },
    ],
    ...overrides,
  };
}

describe("GroupLayerView", () => {
  it("renders its children", () => {
    const { container } = renderWithRendererContext(<GroupLayerView layer={makeGroup()} />);
    expect(container.querySelector('[data-fdraft-layer-id="child-1"]')).toBeTruthy();
  });

  it("hides all children at once when the group itself is invisible", () => {
    const { container } = renderWithRendererContext(<GroupLayerView layer={makeGroup({ visible: false })} />);
    const wrapper = container.querySelector('[data-fdraft-layer-id="group-1"]') as HTMLElement;
    expect(wrapper.style.display).toBe("none");
  });

  it("never intercepts pointer events itself, even though it spans the whole stage", () => {
    // A group above other content in z-order must not swallow clicks
    // anywhere on the canvas — only its actual children (individually
    // positioned) should ever be a hit-test target. See the comment in
    // GroupLayerView.tsx for the full rationale.
    const { container } = renderWithRendererContext(<GroupLayerView layer={makeGroup()} />);
    const wrapper = container.querySelector('[data-fdraft-layer-id="group-1"]') as HTMLElement;
    expect(wrapper.style.pointerEvents).toBe("none");
  });

  it("keeps a child clickable despite the group wrapper's pointer-events:none", () => {
    const { container } = renderWithRendererContext(<GroupLayerView layer={makeGroup()} />);
    const child = container.querySelector('[data-fdraft-layer-id="child-1"]') as HTMLElement;
    expect(child.style.pointerEvents).toBe("auto");
  });
});
