// @vitest-environment node
import { describe, expect, it } from "vitest";
import { canvasToScreen, clampZoom, resetView, screenToCanvas, zoomAround, zoomToFit } from "../../src/editor/viewState.js";

describe("screenToCanvas / canvasToScreen", () => {
  it("round-trips through pan and zoom", () => {
    const view = { zoom: 2, panX: 50, panY: 20 };
    const screen = canvasToScreen(view, 30, 40);
    expect(screen).toEqual({ x: 110, y: 100 });
    expect(screenToCanvas(view, screen.x, screen.y)).toEqual({ x: 30, y: 40 });
  });
});

describe("clampZoom", () => {
  it("clamps to [MIN_ZOOM, MAX_ZOOM]", () => {
    expect(clampZoom(100)).toBeLessThanOrEqual(8);
    expect(clampZoom(-1)).toBeGreaterThanOrEqual(0.05);
  });
});

describe("zoomAround", () => {
  it("keeps the anchor point fixed on screen while zoom changes", () => {
    const view = { zoom: 1, panX: 0, panY: 0 };
    const anchorScreen = { x: 200, y: 150 };
    const anchorCanvasBefore = screenToCanvas(view, anchorScreen.x, anchorScreen.y);
    const next = zoomAround(view, anchorScreen.x, anchorScreen.y, 2);
    const anchorCanvasAfter = screenToCanvas(next, anchorScreen.x, anchorScreen.y);
    expect(anchorCanvasAfter.x).toBeCloseTo(anchorCanvasBefore.x, 5);
    expect(anchorCanvasAfter.y).toBeCloseTo(anchorCanvasBefore.y, 5);
    expect(next.zoom).toBe(2);
  });
});

describe("zoomToFit / resetView", () => {
  it("fits content within the viewport with padding, centred", () => {
    const view = zoomToFit({ x: 0, y: 0, width: 1000, height: 500 }, 1100, 700, 50);
    // available = 1000x600 -> zoom limited by width: 1000/1000=1, height: 600/500=1.2 -> min = 1
    expect(view.zoom).toBe(1);
    const screenCenter = canvasToScreen(view, 500, 250);
    expect(screenCenter.x).toBeCloseTo(550, 5);
    expect(screenCenter.y).toBeCloseTo(350, 5);
  });

  it("resetView fits the full page", () => {
    const view = resetView(800, 600, 400, 300);
    expect(view.zoom).toBeGreaterThan(0);
    const topLeft = canvasToScreen(view, 0, 0);
    const bottomRight = canvasToScreen(view, 400, 300);
    expect(bottomRight.x - topLeft.x).toBeCloseTo(400 * view.zoom, 5);
    expect(bottomRight.y - topLeft.y).toBeCloseTo(300 * view.zoom, 5);
  });
});
