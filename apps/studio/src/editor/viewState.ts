import type { Rect } from "./geometry.js";

export interface ViewState {
  /** Canvas units per screen pixel — 1 = 100%. */
  zoom: number;
  /** Screen-pixel offset of canvas-space (0,0) within the viewport. */
  panX: number;
  panY: number;
}

export const DEFAULT_ZOOM = 1;
export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 8;

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

export function screenToCanvas(view: ViewState, screenX: number, screenY: number): { x: number; y: number } {
  return { x: (screenX - view.panX) / view.zoom, y: (screenY - view.panY) / view.zoom };
}

export function canvasToScreen(view: ViewState, canvasX: number, canvasY: number): { x: number; y: number } {
  return { x: canvasX * view.zoom + view.panX, y: canvasY * view.zoom + view.panY };
}

/** Zooms around a fixed screen-space anchor point (e.g. the cursor), so the point under the cursor stays put. */
export function zoomAround(view: ViewState, anchorScreenX: number, anchorScreenY: number, nextZoom: number): ViewState {
  const zoom = clampZoom(nextZoom);
  const anchorCanvas = screenToCanvas(view, anchorScreenX, anchorScreenY);
  return {
    zoom,
    panX: anchorScreenX - anchorCanvas.x * zoom,
    panY: anchorScreenY - anchorCanvas.y * zoom,
  };
}

/** Fits `content` inside a `viewportWidth`×`viewportHeight` viewport with even padding on all sides, centred. */
export function zoomToFit(content: Rect, viewportWidth: number, viewportHeight: number, paddingPx = 48): ViewState {
  const availableW = Math.max(1, viewportWidth - paddingPx * 2);
  const availableH = Math.max(1, viewportHeight - paddingPx * 2);
  const zoom = clampZoom(Math.min(availableW / content.width, availableH / content.height));
  const contentCenterX = content.x + content.width / 2;
  const contentCenterY = content.y + content.height / 2;
  return {
    zoom,
    panX: viewportWidth / 2 - contentCenterX * zoom,
    panY: viewportHeight / 2 - contentCenterY * zoom,
  };
}

export function resetView(viewportWidth: number, viewportHeight: number, pageWidth: number, pageHeight: number): ViewState {
  return zoomToFit({ x: 0, y: 0, width: pageWidth, height: pageHeight }, viewportWidth, viewportHeight);
}
