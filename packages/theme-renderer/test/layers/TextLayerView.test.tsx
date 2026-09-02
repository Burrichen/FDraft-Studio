import { describe, expect, it } from "vitest";
import type { TextLayer } from "@fdraft/theme-sdk";
import { TextLayerView } from "../../src/layers/TextLayerView.js";
import { renderWithRendererContext } from "../helpers/renderLayer.js";

const baseTransform = { x: 0, y: 0, width: 100, height: 50, rotationDeg: 0, scaleX: 1, scaleY: 1 };

function makeLayer(overrides: Partial<TextLayer> = {}): TextLayer {
  return {
    id: "text-1",
    type: "text",
    name: "Text",
    text: "Hello world",
    fontSizePx: 16,
    align: "left",
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

describe("TextLayerView", () => {
  it("renders the theme-authored text as visible text content", () => {
    const { getByText } = renderWithRendererContext(<TextLayerView layer={makeLayer()} />);
    expect(getByText("Hello world")).toBeInTheDocument();
  });

  it("never interprets theme text as markup, even if it looks like HTML/script", () => {
    const dangerous = '<img src=x onerror="window.__pwned = true">';
    const { container } = renderWithRendererContext(<TextLayerView layer={makeLayer({ text: dangerous })} />);

    // The literal string is present as text...
    expect(container.textContent).toContain(dangerous);
    // ...and was never parsed as an element: no <img> exists in the tree,
    // and no elements have "0" children where a script/img could hide.
    expect(container.querySelector("img")).toBeNull();
    expect(container.innerHTML).not.toContain("<img");
  });

  it("applies fontWeightOverride, lineHeightMultiplier, and letterSpacingPx", () => {
    const { getByText } = renderWithRendererContext(<TextLayerView layer={makeLayer({ fontWeightOverride: 700, lineHeightMultiplier: 1.4, letterSpacingPx: 2 })} />);
    const el = getByText("Hello world");
    expect(el.style.fontWeight).toBe("700");
    expect(el.style.lineHeight).toBe("1.4");
    expect(el.style.letterSpacing).toBe("2px");
  });

  it("does not wrap when wrap is 'nowrap', while still preserving authored line breaks", () => {
    const { getByText } = renderWithRendererContext(<TextLayerView layer={makeLayer({ wrap: "nowrap" })} />);
    expect(getByText("Hello world").style.whiteSpace).toBe("pre");
  });

  it("wraps normally by default", () => {
    const { getByText } = renderWithRendererContext(<TextLayerView layer={makeLayer()} />);
    expect(getByText("Hello world").style.whiteSpace).toBe("pre-wrap");
  });
});
