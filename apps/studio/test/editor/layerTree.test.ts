// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { GroupLayer, Layer, ShapeLayer } from "@fdraft/theme-sdk";
import {
  ancestorChain,
  findLayer,
  findParentId,
  flattenLayers,
  insertLayerInto,
  isSameOrDescendant,
  removeLayer,
  siblingsOf,
  topLevelAncestor,
  updateLayer,
  updateLayers,
} from "../../src/editor/layerTree.js";

const baseTransform = { x: 0, y: 0, width: 10, height: 10, rotationDeg: 0, scaleX: 1, scaleY: 1 };

function shape(id: string): ShapeLayer {
  return {
    id,
    type: "shape",
    name: id,
    shape: "rect",
    transform: baseTransform,
    opacity: 1,
    visible: true,
    locked: false,
    zIndex: 0,
    responsive: [],
    interactionStates: [],
  };
}

function group(id: string, children: Layer[]): GroupLayer {
  return { id, type: "group", name: id, transform: baseTransform, opacity: 1, visible: true, locked: false, zIndex: 0, responsive: [], interactionStates: [], children };
}

// tree: root -> [a, groupB -> [b1, groupC -> [c1]]]
function sampleTree(): Layer[] {
  return [shape("a"), group("groupB", [shape("b1"), group("groupC", [shape("c1")])])];
}

describe("flattenLayers / findLayer / findParentId", () => {
  it("flattens depth-first including group containers", () => {
    const flat = flattenLayers(sampleTree()).map((l) => l.id);
    expect(flat).toEqual(["a", "groupB", "b1", "groupC", "c1"]);
  });

  it("finds a deeply nested layer", () => {
    expect(findLayer(sampleTree(), "c1")?.id).toBe("c1");
    expect(findLayer(sampleTree(), "missing")).toBeUndefined();
  });

  it("reports the correct parent at every depth", () => {
    const tree = sampleTree();
    expect(findParentId(tree, "a")).toBe("root");
    expect(findParentId(tree, "b1")).toBe("groupB");
    expect(findParentId(tree, "c1")).toBe("groupC");
    expect(findParentId(tree, "missing")).toBeUndefined();
  });

  it("computes the full ancestor chain, nearest first", () => {
    expect(ancestorChain(sampleTree(), "c1")).toEqual(["groupC", "groupB"]);
    expect(ancestorChain(sampleTree(), "a")).toEqual([]);
  });
});

describe("topLevelAncestor", () => {
  it("returns the id itself for a top-level layer", () => {
    expect(topLevelAncestor(sampleTree(), "a")).toBe("a");
  });

  it("returns the outermost group for a deeply nested layer", () => {
    expect(topLevelAncestor(sampleTree(), "c1")).toBe("groupB");
    expect(topLevelAncestor(sampleTree(), "b1")).toBe("groupB");
  });
});

describe("isSameOrDescendant (cycle prevention)", () => {
  it("is true for a group and itself", () => {
    expect(isSameOrDescendant(sampleTree(), "groupB", "groupB")).toBe(true);
  });

  it("is true for any nested descendant", () => {
    expect(isSameOrDescendant(sampleTree(), "groupB", "c1")).toBe(true);
    expect(isSameOrDescendant(sampleTree(), "groupB", "groupC")).toBe(true);
  });

  it("is false for unrelated layers or a non-group", () => {
    expect(isSameOrDescendant(sampleTree(), "groupB", "a")).toBe(false);
    expect(isSameOrDescendant(sampleTree(), "a", "b1")).toBe(false);
  });
});

describe("updateLayer / updateLayers", () => {
  it("replaces exactly one layer anywhere in the tree, leaving everything else identical", () => {
    const tree = sampleTree();
    const next = updateLayer(tree, "c1", (l) => ({ ...l, name: "renamed" }));
    expect(findLayer(next, "c1")?.name).toBe("renamed");
    // Unrelated branches are reference-identical (no needless re-render churn).
    expect(next[0]).toBe(tree[0]);
  });

  it("updates every layer whose id is in the given set", () => {
    const tree = sampleTree();
    const next = updateLayers(tree, new Set(["a", "c1"]), (l) => ({ ...l, locked: true }));
    expect(findLayer(next, "a")?.locked).toBe(true);
    expect(findLayer(next, "c1")?.locked).toBe(true);
    expect(findLayer(next, "b1")?.locked).toBe(false);
  });
});

describe("removeLayer / insertLayerInto / siblingsOf", () => {
  it("removes a top-level layer and reports where it came from", () => {
    const tree = sampleTree();
    const { layers, removed } = removeLayer(tree, "a");
    expect(layers.map((l) => l.id)).toEqual(["groupB"]);
    expect(removed?.parentId).toBe("root");
    expect(removed?.index).toBe(0);
  });

  it("removes a deeply nested layer and reports its real parent", () => {
    const { layers, removed } = removeLayer(sampleTree(), "c1");
    expect(removed?.parentId).toBe("groupC");
    expect(findLayer(layers, "c1")).toBeUndefined();
    expect(findLayer(layers, "groupC")).toBeDefined(); // the now-empty group itself remains
  });

  it("reinserts a removed layer into a different group (a real reparent/move)", () => {
    const tree = sampleTree();
    const { layers: afterRemove, removed } = removeLayer(tree, "c1");
    const afterInsert = insertLayerInto(afterRemove, "root", removed!.layer);
    expect(findParentId(afterInsert, "c1")).toBe("root");
    expect(siblingsOf(afterInsert, "root").map((l) => l.id)).toEqual(["a", "groupB", "c1"]);
  });

  it("inserts at a specific index within a group's children", () => {
    const tree = sampleTree();
    const newLayer = shape("b0");
    const next = insertLayerInto(tree, "groupB", newLayer, 0);
    expect(siblingsOf(next, "groupB").map((l) => l.id)).toEqual(["b0", "b1", "groupC"]);
  });
});
