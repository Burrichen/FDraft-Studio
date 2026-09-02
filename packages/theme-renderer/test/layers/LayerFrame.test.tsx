import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import type { ShapeLayer } from "@fdraft/theme-sdk";
import { LayerFrame } from "../../src/layers/LayerFrame.js";
import { renderWithRendererContext } from "../helpers/renderLayer.js";

function shapeLayer(id: string): ShapeLayer {
  return {
    id,
    type: "shape",
    name: id,
    shape: "rect",
    transform: { x: 0, y: 0, width: 100, height: 100, rotationDeg: 0, scaleX: 1, scaleY: 1 },
    opacity: 1,
    visible: true,
    locked: false,
    zIndex: 0,
    responsive: [],
    interactionStates: [],
  };
}

describe("LayerFrame interaction flags", () => {
  it("reports hover start/end via onInteractionFlagChange", () => {
    const onChange = vi.fn();
    renderWithRendererContext(
      <LayerFrame layer={shapeLayer("box")}>
        <span>content</span>
      </LayerFrame>,
      { onInteractionFlagChange: onChange },
    );
    const node = screen.getByText("content").parentElement!;
    fireEvent.mouseEnter(node);
    expect(onChange).toHaveBeenCalledWith("box", "hover", true);
    fireEvent.mouseLeave(node);
    expect(onChange).toHaveBeenCalledWith("box", "hover", false);
  });

  it("reports focus/blur", () => {
    const onChange = vi.fn();
    renderWithRendererContext(
      <LayerFrame layer={shapeLayer("box")}>
        <span>content</span>
      </LayerFrame>,
      { onInteractionFlagChange: onChange },
    );
    const node = screen.getByText("content").parentElement!;
    fireEvent.focus(node);
    expect(onChange).toHaveBeenCalledWith("box", "focus", true);
    fireEvent.blur(node);
    expect(onChange).toHaveBeenCalledWith("box", "focus", false);
  });

  it("reports pressed on pointer down/up, and clears it on mouse leave", () => {
    const onChange = vi.fn();
    renderWithRendererContext(
      <LayerFrame layer={shapeLayer("box")}>
        <span>content</span>
      </LayerFrame>,
      { onInteractionFlagChange: onChange },
    );
    const node = screen.getByText("content").parentElement!;
    fireEvent.pointerDown(node);
    expect(onChange).toHaveBeenCalledWith("box", "pressed", true);
    fireEvent.mouseLeave(node);
    expect(onChange).toHaveBeenCalledWith("box", "pressed", false);
  });

  it("toggles selected on click based on the current renderState", () => {
    const onChange = vi.fn();
    renderWithRendererContext(
      <LayerFrame layer={shapeLayer("box")}>
        <span>content</span>
      </LayerFrame>,
      { onInteractionFlagChange: onChange, renderState: { activeImageStates: {}, interactionFlags: { box: { selected: false } } } },
    );
    const node = screen.getByText("content").parentElement!;
    fireEvent.click(node);
    expect(onChange).toHaveBeenCalledWith("box", "selected", true);
  });

  it("never attaches interaction handlers when no callback is supplied", () => {
    renderWithRendererContext(
      <LayerFrame layer={shapeLayer("box")}>
        <span>content</span>
      </LayerFrame>,
    );
    const node = screen.getByText("content").parentElement!;
    expect(() => fireEvent.mouseEnter(node)).not.toThrow();
  });
});
