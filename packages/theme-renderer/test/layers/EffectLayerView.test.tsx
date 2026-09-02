import { describe, expect, it, vi } from "vitest";
import type { ColorToken, EffectLayer } from "@fdraft/theme-sdk";
import { EffectLayerView } from "../../src/layers/EffectLayerView.js";
import { EMPTY_DOCUMENT, renderWithRendererContext } from "../helpers/renderLayer.js";
import { DEFAULT_HOST_SETTINGS } from "../../src/types.js";
import { RendererProvider, buildRendererContextValue } from "../../src/RendererContext.js";
import { render } from "@testing-library/react";

function makeLayer(overrides: Partial<EffectLayer> = {}): EffectLayer {
  return {
    id: "effect-1",
    type: "effect",
    name: "Snow",
    effect: { id: "decl-1", name: "Snow", kind: "snow", intensity: 0.5, speed: 1, opacity: 1, seed: 1 },
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

describe("EffectLayerView", () => {
  it("renders a canvas for a particle-based kind on the high performance tier", () => {
    const { container } = renderWithRendererContext(<EffectLayerView layer={makeLayer()} />, {
      hostSettings: { reducedMotion: false, performanceTier: "high" },
    });
    expect(container.querySelector('[data-fdraft-effect-kind="snow"]')).toBeTruthy();
    const canvas = container.querySelector("canvas");
    expect(canvas).toBeTruthy();
    expect(canvas?.getAttribute("aria-hidden")).toBe("true");
    expect(canvas?.style.pointerEvents).toBe("none");
  });

  it("renders an SVG turbulence filter for filmGrain instead of a canvas", () => {
    const { container } = renderWithRendererContext(<EffectLayerView layer={makeLayer({ effect: { id: "decl-2", name: "Grain", kind: "filmGrain", intensity: 0.5, speed: 1, opacity: 0.2, seed: 1 } })} />, {
      hostSettings: { reducedMotion: false, performanceTier: "high" },
    });
    expect(container.querySelector("canvas")).toBeNull();
    expect(container.querySelector("svg feTurbulence")).toBeTruthy();
  });

  it("renders nothing at all on the low performance tier", () => {
    const { container } = renderWithRendererContext(<EffectLayerView layer={makeLayer()} />, {
      hostSettings: { reducedMotion: false, performanceTier: "low" },
    });
    expect(container.innerHTML).toBe("");
  });

  it("renders on the medium tier", () => {
    const { container } = renderWithRendererContext(<EffectLayerView layer={makeLayer()} />, {
      hostSettings: { reducedMotion: false, performanceTier: "medium" },
    });
    expect(container.querySelector("canvas")).toBeTruthy();
  });

  it("is skipped when it isn't in the render's allowedEffectLayerIds cap", () => {
    const contextValue = buildRendererContextValue(EMPTY_DOCUMENT, { resolveAsset: () => undefined }, {}, { hostSettings: DEFAULT_HOST_SETTINGS, allowedEffectLayerIds: new Set(["some-other-effect"]) });
    const { container } = render(
      <RendererProvider value={contextValue}>
        <EffectLayerView layer={makeLayer()} />
      </RendererProvider>,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders when it is in the render's allowedEffectLayerIds cap", () => {
    const contextValue = buildRendererContextValue(EMPTY_DOCUMENT, { resolveAsset: () => undefined }, {}, { hostSettings: DEFAULT_HOST_SETTINGS, allowedEffectLayerIds: new Set(["effect-1"]) });
    const { container } = render(
      <RendererProvider value={contextValue}>
        <EffectLayerView layer={makeLayer()} />
      </RendererProvider>,
    );
    expect(container.querySelector("canvas")).toBeTruthy();
  });

  it("is never blocked by the cap when the context doesn't specify one (e.g. an isolated layer test)", () => {
    const { container } = renderWithRendererContext(<EffectLayerView layer={makeLayer()} />);
    expect(container.querySelector("canvas")).toBeTruthy();
  });

  it("resolves colorTokenId to a real hex color and passes it down for drawing", () => {
    const color: ColorToken = { id: "c1", name: "Ember Orange", value: "#ff5500" };
    const drawSpy = { fillStyle: "", strokeStyle: "" };
    const fakeCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      ellipse: vi.fn(),
      fill: vi.fn(),
      fillRect: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      setTransform: vi.fn(),
      get fillStyle() {
        return drawSpy.fillStyle;
      },
      set fillStyle(v: string) {
        drawSpy.fillStyle = v;
      },
      get strokeStyle() {
        return drawSpy.strokeStyle;
      },
      set strokeStyle(v: string) {
        drawSpy.strokeStyle = v;
      },
      globalAlpha: 1,
      lineWidth: 1,
    };
    const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(fakeCtx as unknown as CanvasRenderingContext2D);

    renderWithRendererContext(<EffectLayerView layer={makeLayer({ effect: { id: "decl-3", name: "Embers", kind: "embers", intensity: 1, speed: 1, opacity: 1, seed: 1, colorTokenId: "c1" } })} />, {
      document: { ...EMPTY_DOCUMENT, tokens: { ...EMPTY_DOCUMENT.tokens, colors: [color] } },
      hostSettings: { reducedMotion: true, performanceTier: "high" }, // reducedMotion forces exactly one synchronous static-frame draw, no rAF loop to wait for.
    });

    expect(drawSpy.fillStyle).toBe("#ff5500");
    getContextSpy.mockRestore();
  });
});
