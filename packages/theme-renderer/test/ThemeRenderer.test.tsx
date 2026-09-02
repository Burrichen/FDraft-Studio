import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import type { Layer, MasterPage, Page } from "@fdraft/theme-sdk";
import { ThemeRenderer } from "../src/ThemeRenderer.js";
import { EMPTY_DOCUMENT, NOOP_ASSET_RESOLVER } from "./helpers/renderLayer.js";

const textLayer: Layer = {
  id: "text-1",
  type: "text",
  name: "Text",
  text: "Hello",
  fontSizePx: 16,
  align: "left",
  transform: { x: 0, y: 0, width: 100, height: 20, rotationDeg: 0, scaleX: 1, scaleY: 1 },
  opacity: 1,
  visible: true,
  locked: false,
  zIndex: 0,
  responsive: [],
  interactionStates: [],
};

const page: Page = { id: "page-1", name: "Home", slug: "home", layers: [textLayer], animations: [] };

describe("ThemeRenderer", () => {
  it("renders a page's layers end to end", () => {
    const { getByText } = render(
      <ThemeRenderer
        document={{ ...EMPTY_DOCUMENT, pages: [page] }}
        assetResolver={NOOP_ASSET_RESOLVER}
        componentAdapters={{}}
        target={{ kind: "page", pageId: "page-1" }}
      />,
    );
    expect(getByText("Hello")).toBeInTheDocument();
  });

  it("shows the default safe fallback for a page id that doesn't exist, without throwing out of the component", () => {
    const onError = vi.fn();
    const { container } = render(
      <ThemeRenderer
        document={{ ...EMPTY_DOCUMENT, pages: [page] }}
        assetResolver={NOOP_ASSET_RESOLVER}
        componentAdapters={{}}
        target={{ kind: "page", pageId: "does-not-exist" }}
        onError={onError}
      />,
    );
    expect(container.querySelector('[data-fdraft-error="theme-render-failed"]')).toBeTruthy();
    expect(onError).toHaveBeenCalledOnce();
  });

  it("shows a safe fallback for a page whose master chain is circular, instead of hanging or crashing the host", () => {
    const masters: MasterPage[] = [
      { id: "m1", name: "M1", parentMasterId: "m2", layers: [], animations: [] },
      { id: "m2", name: "M2", parentMasterId: "m1", layers: [], animations: [] },
    ];
    const circularPage: Page = { ...page, id: "page-2", masterId: "m1" };

    const { container } = render(
      <ThemeRenderer
        document={{ ...EMPTY_DOCUMENT, masters, pages: [circularPage] }}
        assetResolver={NOOP_ASSET_RESOLVER}
        componentAdapters={{}}
        target={{ kind: "page", pageId: "page-2" }}
      />,
    );
    expect(container.querySelector('[data-fdraft-error="theme-render-failed"]')).toBeTruthy();
  });

  it("lets the host supply its own fallback UI", () => {
    const { getByText } = render(
      <ThemeRenderer
        document={{ ...EMPTY_DOCUMENT, pages: [page] }}
        assetResolver={NOOP_ASSET_RESOLVER}
        componentAdapters={{}}
        target={{ kind: "page", pageId: "missing" }}
        fallback={() => <div>Custom host fallback</div>}
      />,
    );
    expect(getByText("Custom host fallback")).toBeInTheDocument();
  });

  it("isolates one unknown/malformed layer without blanking its valid siblings", () => {
    const bogusLayer = { id: "bogus-1", type: "not-a-real-type" } as unknown as Layer;
    const mixedPage: Page = { ...page, id: "page-3", layers: [textLayer, bogusLayer] };

    const { getByText, container } = render(
      <ThemeRenderer
        document={{ ...EMPTY_DOCUMENT, pages: [mixedPage] }}
        assetResolver={NOOP_ASSET_RESOLVER}
        componentAdapters={{}}
        target={{ kind: "page", pageId: "page-3" }}
      />,
    );
    expect(getByText("Hello")).toBeInTheDocument();
    expect(container.querySelector('[data-fdraft-error="layer-render-failed"]')).toBeTruthy();
  });

  it("disables transitions on every layer when reducedMotion is set", () => {
    const { container } = render(
      <ThemeRenderer
        document={{ ...EMPTY_DOCUMENT, pages: [page] }}
        assetResolver={NOOP_ASSET_RESOLVER}
        componentAdapters={{}}
        target={{ kind: "page", pageId: "page-1" }}
        hostSettings={{ reducedMotion: true, performanceTier: "high" }}
      />,
    );
    const el = container.querySelector('[data-fdraft-layer-id="text-1"]') as HTMLElement;
    expect(el.style.transition).toBe("none");
  });

  it("selects the responsive breakpoint matching a small simulated viewport", () => {
    const responsivePage: Page = {
      ...page,
      id: "page-4",
      layers: [
        {
          ...textLayer,
          responsive: [{ breakpointId: "mobile", anchors: [], transformOverride: { width: 50 } }],
        },
      ],
    };
    const document = {
      ...EMPTY_DOCUMENT,
      tokens: { ...EMPTY_DOCUMENT.tokens, breakpoints: [{ id: "mobile", name: "Mobile", minWidthPx: 0 }] },
      pages: [responsivePage],
    };

    const { container } = render(
      <ThemeRenderer document={document} assetResolver={NOOP_ASSET_RESOLVER} componentAdapters={{}} target={{ kind: "page", pageId: "page-4" }} viewportWidthPx={320} />,
    );
    const el = container.querySelector('[data-fdraft-layer-id="text-1"]') as HTMLElement;
    // 50 / canvas width (1000 from EMPTY_DOCUMENT) = 5%
    expect(el.style.width).toBe("5%");
  });
});
