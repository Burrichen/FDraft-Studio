import { describe, expect, it } from "vitest";
import type { AssetRecord, ImageLayer, ImageStateGroup } from "@fdraft/theme-sdk";
import { ImageLayerView } from "../../src/layers/ImageLayerView.js";
import { EMPTY_DOCUMENT, renderWithRendererContext } from "../helpers/renderLayer.js";

const baseTransform = { x: 0, y: 0, width: 100, height: 100, rotationDeg: 0, scaleX: 1, scaleY: 1 };

function makeLayer(overrides: Partial<ImageLayer> = {}): ImageLayer {
  return {
    id: "layer-1",
    type: "image",
    name: "Test image",
    assetId: "asset-1",
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

const asset: AssetRecord = { id: "asset-1", kind: "image", path: "assets/a.png", mimeType: "image/png", sizeBytes: 3, sha256: "a".repeat(64) };

describe("ImageLayerView", () => {
  it("renders an <img> with the resolver's URL and a real alt attribute", () => {
    const { container } = renderWithRendererContext(<ImageLayerView layer={makeLayer()} />, {
      document: { ...EMPTY_DOCUMENT, assets: [asset] },
      assetResolver: { resolveAsset: (id) => (id === "asset-1" ? "blob:resolved-url" : undefined) },
    });
    const img = container.querySelector("img");
    expect(img).toBeTruthy();
    expect(img?.getAttribute("src")).toBe("blob:resolved-url");
    expect(img?.getAttribute("alt")).toBe("Test image");
  });

  it("renders a safe fallback instead of a broken <img> when the asset can't be resolved", () => {
    const { container } = renderWithRendererContext(<ImageLayerView layer={makeLayer()} />, {
      document: { ...EMPTY_DOCUMENT, assets: [asset] },
      assetResolver: { resolveAsset: () => undefined },
    });
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector('[data-fdraft-error="missing-asset"]')).toBeTruthy();
  });

  it("renders a safe fallback when the assetId isn't in the document's own assets array at all", () => {
    const { container } = renderWithRendererContext(<ImageLayerView layer={makeLayer({ assetId: "not-declared" })} />, {
      document: EMPTY_DOCUMENT,
      assetResolver: { resolveAsset: () => "blob:should-not-be-used" },
    });
    expect(container.querySelector("img")).toBeNull();
  });

  it("prefers the active image-state's asset over the layer's base assetId", () => {
    const stateGroup: ImageStateGroup = {
      id: "group-1",
      name: "States",
      defaultStateId: "state-default",
      states: [
        { id: "state-default", name: "Default", assetId: "asset-1" },
        { id: "state-hover", name: "Hover", assetId: "asset-2" },
      ],
    };
    const asset2: AssetRecord = { ...asset, id: "asset-2", path: "assets/b.png" };
    const layer = makeLayer({ stateGroupId: "group-1" });

    const { container } = renderWithRendererContext(<ImageLayerView layer={layer} />, {
      document: { ...EMPTY_DOCUMENT, assets: [asset, asset2], imageStateGroups: [stateGroup] },
      assetResolver: { resolveAsset: (id) => `blob:${id}` },
      renderState: { activeImageStates: { "group-1": "state-hover" } },
    });
    expect(container.querySelector("img")?.getAttribute("src")).toBe("blob:asset-2");
  });

  it("falls back to the group's default state when no state is active", () => {
    const stateGroup: ImageStateGroup = {
      id: "group-1",
      name: "States",
      defaultStateId: "state-default",
      states: [
        { id: "state-default", name: "Default", assetId: "asset-1" },
        { id: "state-hover", name: "Hover", assetId: "asset-2" },
      ],
    };
    const layer = makeLayer({ stateGroupId: "group-1" });

    const { container } = renderWithRendererContext(<ImageLayerView layer={layer} />, {
      document: { ...EMPTY_DOCUMENT, assets: [asset], imageStateGroups: [stateGroup] },
      assetResolver: { resolveAsset: (id) => `blob:${id}` },
    });
    expect(container.querySelector("img")?.getAttribute("src")).toBe("blob:asset-1");
  });

  it("prefers a Behaviour rule's setImageState action over the host-supplied active state", () => {
    const stateGroup: ImageStateGroup = {
      id: "group-1",
      name: "States",
      defaultStateId: "state-default",
      states: [
        { id: "state-default", name: "Default", assetId: "asset-1" },
        { id: "state-hover", name: "Hover", assetId: "asset-2" },
      ],
    };
    const asset2: AssetRecord = { ...asset, id: "asset-2", path: "assets/b.png" };
    const layer = makeLayer({ stateGroupId: "group-1" });

    const { container } = renderWithRendererContext(<ImageLayerView layer={layer} />, {
      document: {
        ...EMPTY_DOCUMENT,
        assets: [asset, asset2],
        imageStateGroups: [stateGroup],
        behaviourRules: [
          {
            id: "rule-1",
            name: "Force hover state",
            enabled: true,
            priority: 0,
            trigger: { type: "whileTrue" },
            condition: { type: "always" },
            actions: [{ type: "setImageState", stateGroupId: "group-1", stateId: "state-hover" }],
          },
        ],
      },
      assetResolver: { resolveAsset: (id) => `blob:${id}` },
      // The host itself has no active state here at all — the rule alone decides.
      renderState: { activeImageStates: {} },
    });
    expect(container.querySelector("img")?.getAttribute("src")).toBe("blob:asset-2");
  });
});
