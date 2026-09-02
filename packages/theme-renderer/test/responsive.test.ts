import { describe, expect, it } from "vitest";
import { pickActiveBreakpoint, resolveResponsiveGeometry } from "../src/responsive.js";

const breakpoints = [
  { id: "mobile", name: "Mobile", minWidthPx: 0 },
  { id: "tablet", name: "Tablet", minWidthPx: 768 },
  { id: "desktop", name: "Desktop", minWidthPx: 1200 },
];

describe("pickActiveBreakpoint", () => {
  it("picks the widest breakpoint at or below the viewport width", () => {
    expect(pickActiveBreakpoint(breakpoints, 320)?.id).toBe("mobile");
    expect(pickActiveBreakpoint(breakpoints, 900)?.id).toBe("tablet");
    expect(pickActiveBreakpoint(breakpoints, 1920)?.id).toBe("desktop");
  });

  it("returns undefined when no breakpoint matches", () => {
    expect(pickActiveBreakpoint([{ id: "wide", name: "Wide", minWidthPx: 2000 }], 320)).toBeUndefined();
  });
});

const canvas = { width: 1000, height: 1000 };
const baseTransform = { x: 100, y: 100, width: 200, height: 200, rotationDeg: 0, scaleX: 1, scaleY: 1 };

describe("resolveResponsiveGeometry", () => {
  it("returns the base geometry when no constraint matches the active breakpoint", () => {
    const result = resolveResponsiveGeometry(baseTransform, true, [], "mobile", canvas);
    expect(result).toEqual({ transform: baseTransform, visible: true });
  });

  it("applies a transformOverride for the matching breakpoint", () => {
    const result = resolveResponsiveGeometry(
      baseTransform,
      true,
      [{ breakpointId: "mobile", anchors: [], transformOverride: { width: 50, height: 50 } }],
      "mobile",
      canvas,
    );
    expect(result.transform).toEqual({ ...baseTransform, width: 50, height: 50 });
  });

  it("applies a visibility override", () => {
    const result = resolveResponsiveGeometry(baseTransform, true, [{ breakpointId: "mobile", anchors: [], visible: false }], "mobile", canvas);
    expect(result.visible).toBe(false);
  });

  it("resolves a 'right' edge anchor relative to the canvas width", () => {
    const result = resolveResponsiveGeometry(
      baseTransform,
      true,
      [{ breakpointId: "mobile", anchors: [{ edge: "right", offset: 20, unit: "px" }] }],
      "mobile",
      canvas,
    );
    // canvas.width(1000) - offset(20) - width(200) = 780
    expect(result.transform.x).toBe(780);
  });

  it("resolves a percent-unit anchor against the canvas dimension", () => {
    const result = resolveResponsiveGeometry(
      baseTransform,
      true,
      [{ breakpointId: "mobile", anchors: [{ edge: "top", offset: 10, unit: "percent" }] }],
      "mobile",
      canvas,
    );
    expect(result.transform.y).toBe(100); // 10% of 1000
  });
});
