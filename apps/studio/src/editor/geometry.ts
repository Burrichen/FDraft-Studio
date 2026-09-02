import type { Transform } from "@fdraft/theme-sdk";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function round(value: number, precision: number): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

/**
 * Applied once at the end of a drag/resize/rotate gesture (never during
 * the gesture itself, where full float precision keeps motion smooth).
 * Canvas coordinates are authored in design-space px on a ~1920-wide
 * canvas, so 2 decimal places is well below anything visually
 * meaningful — this is purely about not saving 15 significant digits of
 * floating-point drift into project JSON on every nudge.
 */
export function roundTransform(t: Transform): Transform {
  return {
    x: round(t.x, 2),
    y: round(t.y, 2),
    width: round(t.width, 2),
    height: round(t.height, 2),
    rotationDeg: round(((t.rotationDeg % 360) + 360) % 360, 2),
    scaleX: round(t.scaleX, 4),
    scaleY: round(t.scaleY, 4),
  };
}

/** The axis-aligned bounding box of a (possibly rotated) transform, in canvas space. */
export function transformBounds(t: Transform): Rect {
  if (t.rotationDeg % 360 === 0) {
    return { x: t.x, y: t.y, width: t.width, height: t.height };
  }
  const cx = t.x + t.width / 2;
  const cy = t.y + t.height / 2;
  const rad = (t.rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const halfW = t.width / 2;
  const halfH = t.height / 2;
  const corners: [number, number][] = [
    [-halfW, -halfH],
    [halfW, -halfH],
    [halfW, halfH],
    [-halfW, halfH],
  ].map(([dx, dy]) => [cx + dx! * cos - dy! * sin, cy + dx! * sin + dy! * cos]);
  const xs = corners.map((c) => c[0]);
  const ys = corners.map((c) => c[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function unionRect(rects: Rect[]): Rect | undefined {
  if (rects.length === 0) return undefined;
  const minX = Math.min(...rects.map((r) => r.x));
  const minY = Math.min(...rects.map((r) => r.y));
  const maxX = Math.max(...rects.map((r) => r.x + r.width));
  const maxY = Math.max(...rects.map((r) => r.y + r.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/** The three candidate snap lines per axis for a rect: both edges and the center. */
export function snapLinesForRect(r: Rect): { x: number[]; y: number[] } {
  return {
    x: [r.x, r.x + r.width / 2, r.x + r.width],
    y: [r.y, r.y + r.height / 2, r.y + r.height],
  };
}

export interface SnapResult {
  dx: number;
  dy: number;
  snappedXAt: number | undefined;
  snappedYAt: number | undefined;
}

/**
 * The smallest per-axis offset that would align one of `moving`'s three
 * candidate lines with one of the target lines, if within `threshold`
 * canvas units — independently for X and Y, so a drag can snap on one
 * axis without needing to also line up on the other.
 */
export function computeSnapOffset(moving: { x: number[]; y: number[] }, targetsX: number[], targetsY: number[], threshold: number): SnapResult {
  let bestDx = 0;
  let bestDxDist = threshold;
  let snappedXAt: number | undefined;
  for (const mx of moving.x) {
    for (const tx of targetsX) {
      const d = tx - mx;
      if (Math.abs(d) < bestDxDist) {
        bestDxDist = Math.abs(d);
        bestDx = d;
        snappedXAt = tx;
      }
    }
  }

  let bestDy = 0;
  let bestDyDist = threshold;
  let snappedYAt: number | undefined;
  for (const my of moving.y) {
    for (const ty of targetsY) {
      const d = ty - my;
      if (Math.abs(d) < bestDyDist) {
        bestDyDist = Math.abs(d);
        bestDy = d;
        snappedYAt = ty;
      }
    }
  }

  return { dx: bestDx, dy: bestDy, snappedXAt, snappedYAt };
}

export type ResizeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

/**
 * Resizes a (possibly rotated) transform by dragging one handle, keeping
 * the opposite edge/corner visually fixed on screen. `canvasDelta` is the
 * pointer's movement since gesture start, in canvas space — this
 * function does the rotation-aware conversion into the layer's own local
 * axes internally. `proportional` locks the aspect ratio for corner
 * handles, driven by the horizontal delta.
 */
export function resizeTransform(start: Transform, handle: ResizeHandle, canvasDelta: { x: number; y: number }, opts: { proportional?: boolean; minSize?: number } = {}): Transform {
  const minSize = opts.minSize ?? 4;
  const rad = (start.rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  // Inverse-rotate the canvas-space delta into the box's own (unrotated) local axes.
  const localDx = canvasDelta.x * cos + canvasDelta.y * sin;
  const localDy = -canvasDelta.x * sin + canvasDelta.y * cos;

  const affectsE = handle === "e" || handle === "ne" || handle === "se";
  const affectsW = handle === "w" || handle === "nw" || handle === "sw";
  const affectsS = handle === "s" || handle === "se" || handle === "sw";
  const affectsN = handle === "n" || handle === "ne" || handle === "nw";

  let w1 = start.width;
  let h1 = start.height;
  if (affectsE) w1 = Math.max(minSize, start.width + localDx);
  else if (affectsW) w1 = Math.max(minSize, start.width - localDx);
  if (affectsS) h1 = Math.max(minSize, start.height + localDy);
  else if (affectsN) h1 = Math.max(minSize, start.height - localDy);

  if (opts.proportional && (affectsE || affectsW) && (affectsN || affectsS)) {
    h1 = Math.max(minSize, start.height * (w1 / start.width));
  }

  const dW = w1 - start.width;
  const dH = h1 - start.height;
  const centerShiftLocalX = affectsE ? dW / 2 : affectsW ? -dW / 2 : 0;
  const centerShiftLocalY = affectsS ? dH / 2 : affectsN ? -dH / 2 : 0;
  const shiftCanvasX = centerShiftLocalX * cos - centerShiftLocalY * sin;
  const shiftCanvasY = centerShiftLocalX * sin + centerShiftLocalY * cos;

  const cx = start.x + start.width / 2 + shiftCanvasX;
  const cy = start.y + start.height / 2 + shiftCanvasY;

  return { ...start, x: cx - w1 / 2, y: cy - h1 / 2, width: w1, height: h1 };
}

/** The angle (degrees, atan2 convention) from `center` to `point` — used to turn a rotate-handle drag into a rotation delta. */
export function angleDeg(center: { x: number; y: number }, point: { x: number; y: number }): number {
  return (Math.atan2(point.y - center.y, point.x - center.x) * 180) / Math.PI;
}
