import { describe, expect, it } from "vitest";
import type { ColorToken, ShapeLayer } from "@fdraft/theme-sdk";
import { ShapeLayerView } from "../../src/layers/ShapeLayerView.js";
import { EMPTY_DOCUMENT, renderWithRendererContext } from "../helpers/renderLayer.js";

const baseTransform = { x: 0, y: 0, width: 100, height: 100, rotationDeg: 0, scaleX: 1, scaleY: 1 };
const red: ColorToken = { id: "color-1", name: "Red", value: "#ff0000" };

function makeLayer(overrides: Partial<ShapeLayer> = {}): ShapeLayer {
  return {
    id: "shape-1",
    type: "shape",
    name: "Shape",
    shape: "rect",
    fillColorTokenId: "color-1",
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

describe("ShapeLayerView", () => {
  it("renders a rect with the resolved fill color", () => {
    const { container } = renderWithRendererContext(<ShapeLayerView layer={makeLayer()} />, {
      document: { ...EMPTY_DOCUMENT, tokens: { ...EMPTY_DOCUMENT.tokens, colors: [red] } },
    });
    const el = container.querySelector('[data-fdraft-layer-id="shape-1"]') as HTMLElement;
    expect(el.style.backgroundColor).toBe("rgb(255, 0, 0)");
    expect(el.style.borderRadius).toBe("");
  });

  it("renders an ellipse with border-radius: 50%", () => {
    const { container } = renderWithRendererContext(<ShapeLayerView layer={makeLayer({ shape: "ellipse" })} />, {
      document: { ...EMPTY_DOCUMENT, tokens: { ...EMPTY_DOCUMENT.tokens, colors: [red] } },
    });
    const el = container.querySelector('[data-fdraft-layer-id="shape-1"]') as HTMLElement;
    expect(el.style.borderRadius).toBe("50%");
  });

  it("renders a path shape as an SVG <path> using pathData as a plain attribute (never innerHTML)", () => {
    const { container } = renderWithRendererContext(
      <ShapeLayerView layer={makeLayer({ shape: "path", pathData: "M0 0 L10 10", fillColorTokenId: undefined })} />,
    );
    const path = container.querySelector("path");
    expect(path?.getAttribute("d")).toBe("M0 0 L10 10");
  });

  it("renders a corner radius from a RadiusToken", () => {
    const { container } = renderWithRendererContext(<ShapeLayerView layer={makeLayer({ cornerRadiusTokenId: "radius-1" })} />, {
      document: { ...EMPTY_DOCUMENT, tokens: { ...EMPTY_DOCUMENT.tokens, colors: [red], radii: [{ id: "radius-1", name: "Small", value: 8 }] } },
    });
    const el = container.querySelector('[data-fdraft-layer-id="shape-1"]') as HTMLElement;
    expect(el.style.borderRadius).toBe("8px");
  });

  it("renders a linear gradient fill instead of the solid color when both are set", () => {
    const blue: ColorToken = { id: "color-2", name: "Blue", value: "#0000ff" };
    const { container } = renderWithRendererContext(
      <ShapeLayerView layer={makeLayer({ fillGradientTokenId: "grad-1" })} />,
      {
        document: {
          ...EMPTY_DOCUMENT,
          tokens: { ...EMPTY_DOCUMENT.tokens, colors: [red, blue], gradients: [{ id: "grad-1", name: "Sunset", angleDeg: 90, stops: [{ offset: 0, colorTokenId: "color-1" }, { offset: 1, colorTokenId: "color-2" }] }] },
        },
      },
    );
    const el = container.querySelector('[data-fdraft-layer-id="shape-1"]') as HTMLElement;
    expect(el.style.backgroundImage).toContain("linear-gradient");
    expect(el.style.backgroundImage).toContain("90deg");
    expect(el.style.backgroundColor).toBe("");
  });

  it("composes multiple shadow tokens into one box-shadow list", () => {
    const { container } = renderWithRendererContext(<ShapeLayerView layer={makeLayer({ shadowTokenIds: ["s1", "s2"] })} />, {
      document: {
        ...EMPTY_DOCUMENT,
        tokens: {
          ...EMPTY_DOCUMENT.tokens,
          colors: [red],
          shadows: [
            { id: "s1", name: "Drop", offsetX: 0, offsetY: 2, blur: 4, spread: 0, colorTokenId: "color-1", inset: false },
            { id: "s2", name: "Inner", offsetX: 0, offsetY: 0, blur: 1, spread: 0, colorTokenId: "color-1", inset: true },
          ],
        },
      },
    });
    const el = container.querySelector('[data-fdraft-layer-id="shape-1"]') as HTMLElement;
    expect(el.style.boxShadow.split(",").length).toBe(2);
    expect(el.style.boxShadow).toContain("inset");
  });
});
