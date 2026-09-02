// @vitest-environment node
import { describe, expect, it } from "vitest";
import { angleDeg, computeSnapOffset, rectsIntersect, resizeTransform, roundTransform, snapLinesForRect, transformBounds, unionRect } from "../../src/editor/geometry.js";

describe("roundTransform", () => {
  it("rounds position/size to 2 decimals and scale to 4", () => {
    const rounded = roundTransform({ x: 1.23456, y: 2.987654, width: 10.001, height: 5, rotationDeg: 45, scaleX: 1.00001234, scaleY: 1, });
    expect(rounded).toEqual({ x: 1.23, y: 2.99, width: 10, height: 5, rotationDeg: 45, scaleX: 1, scaleY: 1 });
  });

  it("normalises rotation into [0, 360)", () => {
    expect(roundTransform({ x: 0, y: 0, width: 1, height: 1, rotationDeg: -90, scaleX: 1, scaleY: 1 }).rotationDeg).toBe(270);
    expect(roundTransform({ x: 0, y: 0, width: 1, height: 1, rotationDeg: 405, scaleX: 1, scaleY: 1 }).rotationDeg).toBe(45);
  });
});

describe("transformBounds", () => {
  it("is exactly x/y/width/height when unrotated", () => {
    expect(transformBounds({ x: 10, y: 20, width: 100, height: 50, rotationDeg: 0, scaleX: 1, scaleY: 1 })).toEqual({ x: 10, y: 20, width: 100, height: 50 });
  });

  it("grows the bounding box for a rotated rect", () => {
    // A 100x100 square rotated 45° has a bounding box of side 100*sqrt(2) ≈ 141.42.
    const bounds = transformBounds({ x: 0, y: 0, width: 100, height: 100, rotationDeg: 45, scaleX: 1, scaleY: 1 });
    expect(bounds.width).toBeCloseTo(141.42, 1);
    expect(bounds.height).toBeCloseTo(141.42, 1);
  });
});

describe("unionRect / rectsIntersect", () => {
  it("unions multiple rects into their combined bounding box", () => {
    const union = unionRect([
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 20, y: 5, width: 10, height: 10 },
    ]);
    expect(union).toEqual({ x: 0, y: 0, width: 30, height: 15 });
  });

  it("returns undefined for an empty list", () => {
    expect(unionRect([])).toBeUndefined();
  });

  it("detects overlap and non-overlap correctly", () => {
    expect(rectsIntersect({ x: 0, y: 0, width: 10, height: 10 }, { x: 5, y: 5, width: 10, height: 10 })).toBe(true);
    expect(rectsIntersect({ x: 0, y: 0, width: 10, height: 10 }, { x: 20, y: 20, width: 10, height: 10 })).toBe(false);
    expect(rectsIntersect({ x: 0, y: 0, width: 10, height: 10 }, { x: 10, y: 10, width: 10, height: 10 })).toBe(false); // touching edges, not overlapping
  });
});

describe("snapping", () => {
  it("produces edge and center candidate lines", () => {
    expect(snapLinesForRect({ x: 10, y: 20, width: 100, height: 50 })).toEqual({ x: [10, 60, 110], y: [20, 45, 70] });
  });

  it("snaps to the nearest target line within the threshold, independently per axis", () => {
    const moving = snapLinesForRect({ x: 98, y: 200, width: 100, height: 50 }); // left edge at 98, close to 100
    const result = computeSnapOffset(moving, [100, 500], [1000], 5);
    expect(result.dx).toBe(2); // moves the shape's left edge from 98 to 100
    expect(result.snappedXAt).toBe(100);
    expect(result.dy).toBe(0); // nothing within threshold on Y
    expect(result.snappedYAt).toBeUndefined();
  });

  it("does not snap when nothing is within the threshold", () => {
    const moving = snapLinesForRect({ x: 0, y: 0, width: 10, height: 10 });
    const result = computeSnapOffset(moving, [500], [500], 5);
    expect(result).toEqual({ dx: 0, dy: 0, snappedXAt: undefined, snappedYAt: undefined });
  });
});

describe("resizeTransform", () => {
  const base = { x: 10, y: 10, width: 100, height: 50, rotationDeg: 0, scaleX: 1, scaleY: 1 };

  it("dragging the east handle grows width and keeps the left edge fixed (unrotated)", () => {
    const next = resizeTransform(base, "e", { x: 20, y: 0 });
    expect(next).toMatchObject({ x: 10, y: 10, width: 120, height: 50 });
  });

  it("dragging the west handle grows width leftward and keeps the right edge fixed", () => {
    const next = resizeTransform(base, "w", { x: -20, y: 0 });
    expect(next.width).toBe(120);
    expect(next.x).toBe(-10); // right edge (110) stays put: 110 - 120 = -10
  });

  it("a corner handle resizes both axes, keeping the opposite corner fixed", () => {
    const next = resizeTransform(base, "se", { x: 20, y: 10 });
    expect(next).toMatchObject({ x: 10, y: 10, width: 120, height: 60 });
  });

  it("proportional corner resize locks the aspect ratio, driven by the horizontal delta", () => {
    const next = resizeTransform(base, "se", { x: 50, y: 5 }, { proportional: true });
    expect(next.width).toBe(150);
    expect(next.height).toBe(75); // 50 * (150/100)
  });

  it("never shrinks below the minimum size", () => {
    const next = resizeTransform(base, "e", { x: -1000, y: 0 });
    expect(next.width).toBeGreaterThanOrEqual(4);
  });

  it("resizing a 90°-rotated box along its local axis moves canvas Y, not X, keeping the opposite edge fixed on screen", () => {
    const rotated = { ...base, rotationDeg: 90 };
    // At 90°, the box's local +X axis points along canvas +Y, so dragging "e" with a canvas-Y delta grows local width.
    const next = resizeTransform(rotated, "e", { x: 0, y: 20 });
    expect(next.width).toBeCloseTo(120, 5);
    expect(next.height).toBeCloseTo(50, 5);
    // The opposite (local left) edge's center-line should stay fixed on screen.
    const centerBefore = { x: rotated.x + rotated.width / 2, y: rotated.y + rotated.height / 2 };
    const centerAfter = { x: next.x + next.width / 2, y: next.y + next.height / 2 };
    // Local left-edge midpoint in canvas space, before and after, computed via the rotation used internally.
    const localLeftBefore = { x: centerBefore.x - rotated.width / 2 * Math.cos((90 * Math.PI) / 180), y: centerBefore.y - rotated.width / 2 * Math.sin((90 * Math.PI) / 180) };
    const localLeftAfter = { x: centerAfter.x - next.width / 2 * Math.cos((90 * Math.PI) / 180), y: centerAfter.y - next.width / 2 * Math.sin((90 * Math.PI) / 180) };
    expect(localLeftAfter.x).toBeCloseTo(localLeftBefore.x, 5);
    expect(localLeftAfter.y).toBeCloseTo(localLeftBefore.y, 5);
  });
});

describe("angleDeg", () => {
  it("computes the angle from center to point in atan2 convention", () => {
    expect(angleDeg({ x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(0, 5);
    expect(angleDeg({ x: 0, y: 0 }, { x: 0, y: 10 })).toBeCloseTo(90, 5);
    expect(angleDeg({ x: 0, y: 0 }, { x: -10, y: 0 })).toBeCloseTo(180, 5);
  });
});
