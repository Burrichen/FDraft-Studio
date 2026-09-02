import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { AnimationDeclaration, ShapeLayer } from "@fdraft/theme-sdk";
import { LayerFrame } from "../../src/layers/LayerFrame.js";
import { EMPTY_DOCUMENT, NOOP_ASSET_RESOLVER, renderWithRendererContext } from "../helpers/renderLayer.js";
import { DEFAULT_HOST_SETTINGS } from "../../src/types.js";
import { RendererProvider, buildRendererContextValue } from "../../src/RendererContext.js";

function shapeLayer(overrides: Partial<ShapeLayer> = {}): ShapeLayer {
  return {
    id: "box",
    type: "shape",
    name: "box",
    shape: "rect",
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

function baseAnimation(overrides: Partial<AnimationDeclaration> = {}): AnimationDeclaration {
  return {
    id: "anim-1",
    name: "Test",
    trigger: "onEnter",
    targetLayerId: "box",
    durationMs: 300,
    delayMs: 0,
    easing: "easeOut",
    loop: false,
    direction: "normal",
    intensity: 1,
    motion: { type: "preset", preset: "fade" },
    ...overrides,
  } as AnimationDeclaration;
}

function frameNode(): HTMLElement {
  return screen.getByText("content").parentElement!;
}

describe("useLayerAnimation: onEnter", () => {
  it("applies a preset animation on mount", () => {
    renderWithRendererContext(
      <LayerFrame layer={shapeLayer()}>
        <span>content</span>
      </LayerFrame>,
      { containerAnimations: [baseAnimation()] },
    );
    expect(frameNode().style.animationName).toMatch(/fdraft-anim-fade/);
    expect(frameNode().style.animationDuration).toBe("300ms");
  });

  it("does nothing for a layer no animation targets", () => {
    renderWithRendererContext(
      <LayerFrame layer={shapeLayer({ id: "other" })}>
        <span>content</span>
      </LayerFrame>,
      { containerAnimations: [baseAnimation()] },
    );
    expect(frameNode().style.animationName).toBe("");
  });

  it("resolves a custom keyframe list to a dedicated keyframe name", () => {
    renderWithRendererContext(
      <LayerFrame layer={shapeLayer()}>
        <span>content</span>
      </LayerFrame>,
      { containerAnimations: [baseAnimation({ motion: { type: "keyframes", keyframes: [{ offsetPercent: 0, opacity: 0 }, { offsetPercent: 100, opacity: 1 }] } })] },
    );
    expect(frameNode().style.animationName).toBe("fdraft-anim-custom-anim-1");
  });

  it("resolves the legacy property/from/to shape when motion is absent", () => {
    const legacy = { ...baseAnimation(), motion: undefined, property: "opacity" as const, from: 0, to: 1 };
    renderWithRendererContext(
      <LayerFrame layer={shapeLayer()}>
        <span>content</span>
      </LayerFrame>,
      { containerAnimations: [legacy] },
    );
    expect(frameNode().style.animationName).toBe("fdraft-anim-custom-anim-1");
  });

  it("sets iteration count to infinite for a repeat:infinite idle animation", () => {
    renderWithRendererContext(
      <LayerFrame layer={shapeLayer()}>
        <span>content</span>
      </LayerFrame>,
      { containerAnimations: [baseAnimation({ motion: { type: "preset", preset: "float" }, repeat: { mode: "infinite" } })] },
    );
    expect(frameNode().style.animationIterationCount).toBe("infinite");
  });

  it("respects the legacy loop:true flag as infinite when repeat is absent", () => {
    renderWithRendererContext(
      <LayerFrame layer={shapeLayer()}>
        <span>content</span>
      </LayerFrame>,
      { containerAnimations: [baseAnimation({ loop: true })] },
    );
    expect(frameNode().style.animationIterationCount).toBe("infinite");
  });
});

describe("useLayerAnimation: reduced motion and performance tier", () => {
  it("applies nothing when reducedMotion is on", () => {
    renderWithRendererContext(
      <LayerFrame layer={shapeLayer()}>
        <span>content</span>
      </LayerFrame>,
      { containerAnimations: [baseAnimation()], hostSettings: { ...DEFAULT_HOST_SETTINGS, reducedMotion: true } },
    );
    expect(frameNode().style.animationName).toBe("");
  });

  it("applies nothing on the low performance tier", () => {
    renderWithRendererContext(
      <LayerFrame layer={shapeLayer()}>
        <span>content</span>
      </LayerFrame>,
      { containerAnimations: [baseAnimation()], hostSettings: { ...DEFAULT_HOST_SETTINGS, performanceTier: "low" } },
    );
    expect(frameNode().style.animationName).toBe("");
  });

  it("still applies on the medium tier", () => {
    renderWithRendererContext(
      <LayerFrame layer={shapeLayer()}>
        <span>content</span>
      </LayerFrame>,
      { containerAnimations: [baseAnimation()], hostSettings: { ...DEFAULT_HOST_SETTINGS, performanceTier: "medium" } },
    );
    expect(frameNode().style.animationName).toMatch(/fdraft-anim-fade/);
  });
});

describe("useLayerAnimation: manual trigger via Behaviour rules", () => {
  const manual = baseAnimation({ id: "anim-hover", trigger: "manual", motion: { type: "preset", preset: "pulse" } });
  const rule = {
    id: "r1",
    name: "Pulse on hover",
    enabled: true,
    priority: 0,
    trigger: { type: "whileTrue" as const },
    condition: { type: "boolean" as const, variable: { kind: "interactionFlag" as const, which: "hover" as const, layerId: "box" }, equals: true },
    actions: [{ type: "startAnimation" as const, animationId: "anim-hover" }],
  };

  it("does not play while the hover condition is false", () => {
    renderWithRendererContext(
      <LayerFrame layer={shapeLayer()}>
        <span>content</span>
      </LayerFrame>,
      { containerAnimations: [manual], document: { ...EMPTY_DOCUMENT, behaviourRules: [rule] }, renderState: { activeImageStates: {} } },
    );
    expect(frameNode().style.animationName).toBe("");
  });

  it("plays while a whileTrue rule's startAnimation makes it active", () => {
    renderWithRendererContext(
      <LayerFrame layer={shapeLayer()}>
        <span>content</span>
      </LayerFrame>,
      { containerAnimations: [manual], document: { ...EMPTY_DOCUMENT, behaviourRules: [rule] }, renderState: { activeImageStates: {}, interactionFlags: { box: { hover: true } } } },
    );
    expect(frameNode().style.animationName).toMatch(/fdraft-anim-pulse/);
  });
});

describe("useLayerAnimation: onExit", () => {
  it("keeps the layer visible and playing the exit animation for its full duration, then hides", () => {
    vi.useFakeTimers();
    try {
      const exit = baseAnimation({ id: "anim-exit", trigger: "onExit", durationMs: 200, motion: { type: "preset", preset: "fade" } });
      const contextValue = buildRendererContextValue(EMPTY_DOCUMENT, NOOP_ASSET_RESOLVER, {}, { hostSettings: DEFAULT_HOST_SETTINGS, containerAnimations: [exit] });

      const { rerender } = render(
        <RendererProvider value={contextValue}>
          <LayerFrame layer={shapeLayer({ visible: true })}>
            <span>content</span>
          </LayerFrame>
        </RendererProvider>,
      );
      expect(frameNode().style.display).not.toBe("none");

      rerender(
        <RendererProvider value={contextValue}>
          <LayerFrame layer={shapeLayer({ visible: false })}>
            <span>content</span>
          </LayerFrame>
        </RendererProvider>,
      );
      // Still rendered (exiting), with the exit animation applied.
      expect(frameNode().style.display).not.toBe("none");
      expect(frameNode().style.animationName).toMatch(/fdraft-anim-fade/);

      vi.advanceTimersByTime(250);
      rerender(
        <RendererProvider value={contextValue}>
          <LayerFrame layer={shapeLayer({ visible: false })}>
            <span>content</span>
          </LayerFrame>
        </RendererProvider>,
      );
      expect(frameNode().style.display).toBe("none");
    } finally {
      vi.useRealTimers();
    }
  });
});
