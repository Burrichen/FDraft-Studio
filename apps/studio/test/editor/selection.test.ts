// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { GroupLayer, Layer, ShapeLayer } from "@fdraft/theme-sdk";
import { clearSelection, marqueeSelect, pruneSelection, selectAll, selectSingle, selectionTouchesGroup, toggleSelection } from "../../src/editor/selection.js";

function rect(id: string, x = 0, y = 0, w = 10, h = 10): ShapeLayer {
  return {
    id,
    type: "shape",
    name: id,
    shape: "rect",
    transform: { x, y, width: w, height: h, rotationDeg: 0, scaleX: 1, scaleY: 1 },
    opacity: 1,
    visible: true,
    locked: false,
    zIndex: 0,
    responsive: [],
    interactionStates: [],
  };
}

function group(id: string, children: Layer[]): GroupLayer {
  return { id, type: "group", name: id, transform: { x: 0, y: 0, width: 10, height: 10, rotationDeg: 0, scaleX: 1, scaleY: 1 }, opacity: 1, visible: true, locked: false, zIndex: 0, responsive: [], interactionStates: [], children };
}

describe("selectSingle / toggleSelection / clearSelection", () => {
  it("single-select produces exactly one selected id", () => {
    expect([...selectSingle("c")]).toEqual(["c"]);
  });

  it("shift-add onto an existing single selection grows it", () => {
    const sel = toggleSelection(selectSingle("a"), "b");
    expect([...sel].sort()).toEqual(["a", "b"]);
  });

  it("shift-click toggles membership without touching the rest", () => {
    const sel = toggleSelection(new Set(["a", "b"]), "a");
    expect([...sel].sort()).toEqual(["b"]);
  });

  it("clearSelection is empty", () => {
    expect(clearSelection().size).toBe(0);
  });
});

describe("selectAll", () => {
  it("selects every layer including nested ones", () => {
    const layers = [rect("a"), group("g", [rect("b")])];
    expect([...selectAll(layers)].sort()).toEqual(["a", "b", "g"]);
  });
});

describe("marqueeSelect", () => {
  it("selects top-level layers whose bounds intersect the marquee", () => {
    const layers = [rect("a", 0, 0), rect("b", 100, 100), group("g", [rect("c", 5, 5)])];
    const sel = marqueeSelect(layers, { x: -5, y: -5, width: 20, height: 20 });
    expect([...sel].sort()).toEqual(["a", "g"]); // group hit by its own bounds, not by reaching into its children
  });

  it("selects nothing when the marquee misses everything", () => {
    const layers = [rect("a", 0, 0)];
    expect(marqueeSelect(layers, { x: 1000, y: 1000, width: 10, height: 10 }).size).toBe(0);
  });
});

describe("pruneSelection", () => {
  it("drops ids that no longer exist and preserves reference-equality when nothing changed", () => {
    const layers = [rect("a")];
    const sel = new Set(["a", "gone"]);
    const pruned = pruneSelection(layers, sel);
    expect([...pruned]).toEqual(["a"]);

    const stable = new Set(["a"]);
    expect(pruneSelection(layers, stable)).toBe(stable);
  });
});

describe("selectionTouchesGroup", () => {
  it("is true when the group itself or a descendant is selected", () => {
    const layers = [group("g", [rect("c")])];
    expect(selectionTouchesGroup(layers, new Set(["c"]), "g")).toBe(true);
    expect(selectionTouchesGroup(layers, new Set(["g"]), "g")).toBe(true);
    expect(selectionTouchesGroup(layers, new Set(["other"]), "g")).toBe(false);
  });
});
