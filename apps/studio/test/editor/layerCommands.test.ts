// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createId, createProject } from "@fdraft/theme-sdk";
import type { GroupLayer, Layer, ShapeLayer, StudioProjectDocument, TextLayer } from "@fdraft/theme-sdk";
import type { ContainerRef } from "../../src/editor/containerRef.js";
import { getContainerLayers } from "../../src/editor/containerRef.js";
import {
  buildAlignCommand,
  buildDeleteCommand,
  buildDistributeCommand,
  buildDuplicateCommand,
  buildGroupCommand,
  buildPasteCommand,
  buildReparentCommand,
  buildUngroupCommand,
  buildZOrderCommand,
  renameLayer,
  setComponentCopyOverride,
  setComponentZoneKind,
  setLayerCrop,
  setLayerOpacity,
  setLayerText,
  setLayerTransforms,
  setLayersLocked,
  setLayersVisible,
} from "../../src/editor/layerCommands.js";
import type { ComponentLayer } from "@fdraft/theme-sdk";

function rect(id: string, overrides: Partial<ShapeLayer> = {}): ShapeLayer {
  return {
    id,
    type: "shape",
    name: id,
    shape: "rect",
    transform: { x: 0, y: 0, width: 10, height: 10, rotationDeg: 0, scaleX: 1, scaleY: 1 },
    opacity: 1,
    visible: true,
    locked: false,
    zIndex: 0,
    responsive: [],
    interactionStates: [],
    ...overrides,
  };
}

function componentLayer(id: string, overrides: Partial<ComponentLayer> = {}): ComponentLayer {
  return {
    id,
    type: "component",
    name: id,
    componentKey: "page-title",
    componentRequirementId: "req-1",
    styleOverrides: [],
    transform: { x: 0, y: 0, width: 10, height: 10, rotationDeg: 0, scaleX: 1, scaleY: 1 },
    opacity: 1,
    visible: true,
    locked: false,
    zIndex: 0,
    responsive: [],
    interactionStates: [],
    ...overrides,
  };
}

function text(id: string, value: string): TextLayer {
  return {
    id,
    type: "text",
    name: id,
    text: value,
    fontSizePx: 16,
    align: "left",
    transform: { x: 0, y: 0, width: 10, height: 10, rotationDeg: 0, scaleX: 1, scaleY: 1 },
    opacity: 1,
    visible: true,
    locked: false,
    zIndex: 0,
    responsive: [],
    interactionStates: [],
  };
}

function group(id: string, children: Layer[], overrides: Partial<GroupLayer> = {}): GroupLayer {
  return {
    id,
    type: "group",
    name: id,
    transform: { x: 0, y: 0, width: 10, height: 10, rotationDeg: 0, scaleX: 1, scaleY: 1 },
    opacity: 1,
    visible: true,
    locked: false,
    zIndex: 0,
    responsive: [],
    interactionStates: [],
    children,
    ...overrides,
  };
}

function projectWithLayers(layers: Layer[]): { project: StudioProjectDocument; ref: ContainerRef } {
  const project = createProject({ id: createId(), name: "Test" });
  const pageId = createId();
  project.pages.push({ id: pageId, name: "Home", slug: "home", layers, animations: [] });
  return { project, ref: { kind: "page", id: pageId } };
}

describe("setLayerTransforms", () => {
  it("applies and undoes a move, rounding the committed value", () => {
    const { project, ref } = projectWithLayers([rect("a")]);
    const cmd = setLayerTransforms(ref, [{ layerId: "a", before: rect("a").transform, after: { ...rect("a").transform, x: 5.123456, y: 5 } }]);
    const after = cmd.do(project);
    expect(getContainerLayers(after, ref)[0]?.transform.x).toBe(5.12);
    const undone = cmd.undo(after);
    expect(getContainerLayers(undone, ref)[0]?.transform.x).toBe(0);
  });

  it("moves multiple layers as a single command", () => {
    const { project, ref } = projectWithLayers([rect("a"), rect("b")]);
    const cmd = setLayerTransforms(ref, [
      { layerId: "a", before: rect("a").transform, after: { ...rect("a").transform, x: 1 } },
      { layerId: "b", before: rect("b").transform, after: { ...rect("b").transform, x: 2 } },
    ]);
    const after = cmd.do(project);
    const layers = getContainerLayers(after, ref);
    expect(layers[0]?.transform.x).toBe(1);
    expect(layers[1]?.transform.x).toBe(2);
  });
});

describe("simple property commands", () => {
  it("opacity clamps into [0,1] and undoes", () => {
    const { project, ref } = projectWithLayers([rect("a")]);
    const cmd = setLayerOpacity(ref, "a", 1, 1.5);
    const after = cmd.do(project);
    expect(getContainerLayers(after, ref)[0]?.opacity).toBe(1);
    const cmd2 = setLayerOpacity(ref, "a", 1, -0.5);
    expect(getContainerLayers(cmd2.do(project), ref)[0]?.opacity).toBe(0);
  });

  it("renames and undoes", () => {
    const { project, ref } = projectWithLayers([rect("a")]);
    const cmd = renameLayer(ref, "a", "a", "Header background");
    const after = cmd.do(project);
    expect(getContainerLayers(after, ref)[0]?.name).toBe("Header background");
    expect(getContainerLayers(cmd.undo(after), ref)[0]?.name).toBe("a");
  });

  it("show/hide and lock/unlock apply to a whole selection as one command", () => {
    const { project, ref } = projectWithLayers([rect("a"), rect("b")]);
    const hide = setLayersVisible(ref, ["a", "b"], false);
    const hidden = hide.do(project);
    expect(getContainerLayers(hidden, ref).every((l) => l.visible === false)).toBe(true);
    expect(getContainerLayers(hide.undo(hidden), ref).every((l) => l.visible === true)).toBe(true);

    const lock = setLayersLocked(ref, ["a"], true);
    const locked = lock.do(project);
    expect(getContainerLayers(locked, ref)[0]?.locked).toBe(true);
    expect(getContainerLayers(locked, ref)[1]?.locked).toBe(false);
  });

  it("crop sets and clears", () => {
    const { shape: _shape, ...base } = rect("a");
    const image: Layer = { ...base, type: "image", assetId: createId() };
    const { project, ref } = projectWithLayers([image]);
    const crop = { x: 0, y: 0, width: 5, height: 5 };
    const cmd = setLayerCrop(ref, "a", undefined, crop);
    const after = cmd.do(project);
    expect((getContainerLayers(after, ref)[0] as { crop?: unknown }).crop).toEqual(crop);
    expect((getContainerLayers(cmd.undo(after), ref)[0] as { crop?: unknown }).crop).toBeUndefined();
  });

  it("edits text", () => {
    const { project, ref } = projectWithLayers([text("t", "Welcome!")]);
    const cmd = setLayerText(ref, "t", "Welcome!", "Welcome to the event!");
    const after = cmd.do(project);
    expect((getContainerLayers(after, ref)[0] as TextLayer).text).toBe("Welcome to the event!");
    expect((getContainerLayers(cmd.undo(after), ref)[0] as TextLayer).text).toBe("Welcome!");
  });
});

describe("component copy overrides / zone assignment", () => {
  it("sets a copy override and undoes", () => {
    const { project, ref } = projectWithLayers([componentLayer("c")]);
    const cmd = setComponentCopyOverride(ref, "c", "title", undefined, "Custom Title");
    const after = cmd.do(project);
    expect((getContainerLayers(after, ref)[0] as ComponentLayer).copyOverrides).toEqual({ title: "Custom Title" });
    expect((getContainerLayers(cmd.undo(after), ref)[0] as ComponentLayer).copyOverrides).toBeUndefined();
  });

  it("clears a copy override back to undefined (falls back to the adapter default at render time)", () => {
    const { project, ref } = projectWithLayers([componentLayer("c", { copyOverrides: { title: "Custom Title" } })]);
    const cmd = setComponentCopyOverride(ref, "c", "title", "Custom Title", undefined);
    const after = cmd.do(project);
    expect((getContainerLayers(after, ref)[0] as ComponentLayer).copyOverrides).toBeUndefined();
    expect((getContainerLayers(cmd.undo(after), ref)[0] as ComponentLayer).copyOverrides).toEqual({ title: "Custom Title" });
  });

  it("preserves other slots when editing one", () => {
    const { project, ref } = projectWithLayers([componentLayer("c", { copyOverrides: { eventName: "Halloween" } })]);
    const cmd = setComponentCopyOverride(ref, "c", "dateRange", undefined, "Oct 31");
    const after = cmd.do(project);
    expect((getContainerLayers(after, ref)[0] as ComponentLayer).copyOverrides).toEqual({ eventName: "Halloween", dateRange: "Oct 31" });
  });

  it("assigns a zone and undoes", () => {
    const { project, ref } = projectWithLayers([componentLayer("c")]);
    const cmd = setComponentZoneKind(ref, "c", undefined, "header");
    const after = cmd.do(project);
    expect((getContainerLayers(after, ref)[0] as ComponentLayer).zoneKind).toBe("header");
    expect((getContainerLayers(cmd.undo(after), ref)[0] as ComponentLayer).zoneKind).toBeUndefined();
  });
});

describe("z-order", () => {
  it("brings a layer to front (highest zIndex among siblings)", () => {
    const { project, ref } = projectWithLayers([rect("a", { zIndex: 0 }), rect("b", { zIndex: 1 }), rect("c", { zIndex: 2 })]);
    const cmd = buildZOrderCommand(project, ref, ["a"], "front");
    expect(cmd).not.toBeNull();
    const after = cmd!.do(project);
    const a = getContainerLayers(after, ref).find((l) => l.id === "a")!;
    expect(a.zIndex).toBeGreaterThan(2);
    const undone = cmd!.undo(after);
    expect(getContainerLayers(undone, ref).find((l) => l.id === "a")!.zIndex).toBe(0);
  });

  it("sends a layer to back (lowest zIndex among siblings)", () => {
    const { project, ref } = projectWithLayers([rect("a", { zIndex: 0 }), rect("b", { zIndex: 1 })]);
    const cmd = buildZOrderCommand(project, ref, ["b"], "back")!;
    const after = cmd.do(project);
    expect(getContainerLayers(after, ref).find((l) => l.id === "b")!.zIndex).toBeLessThan(0);
  });

  it("swaps with the adjacent sibling for forward/backward", () => {
    const { project, ref } = projectWithLayers([rect("a", { zIndex: 0 }), rect("b", { zIndex: 1 })]);
    const cmd = buildZOrderCommand(project, ref, ["a"], "forward")!;
    const after = cmd.do(project);
    const layers = getContainerLayers(after, ref);
    expect(layers.find((l) => l.id === "a")!.zIndex).toBe(1);
    expect(layers.find((l) => l.id === "b")!.zIndex).toBe(0);
    const undone = cmd.undo(after);
    expect(getContainerLayers(undone, ref).find((l) => l.id === "a")!.zIndex).toBe(0);
  });

  it("returns null when nothing can move", () => {
    const { project, ref } = projectWithLayers([rect("a", { zIndex: 0 })]);
    expect(buildZOrderCommand(project, ref, ["a"], "forward")).toBeNull();
  });
});

describe("delete / duplicate / paste", () => {
  it("deletes and undo restores original position", () => {
    const { project, ref } = projectWithLayers([rect("a"), rect("b"), rect("c")]);
    const cmd = buildDeleteCommand(project, ref, ["b"])!;
    const after = cmd.do(project);
    expect(getContainerLayers(after, ref).map((l) => l.id)).toEqual(["a", "c"]);
    const undone = cmd.undo(after);
    expect(getContainerLayers(undone, ref).map((l) => l.id)).toEqual(["a", "b", "c"]);
  });

  it("duplicates with fresh ids and an offset, and undo removes the clone", () => {
    const { project, ref } = projectWithLayers([rect("a")]);
    const cmd = buildDuplicateCommand(project, ref, ["a"])!;
    const after = cmd.do(project);
    const layers = getContainerLayers(after, ref);
    expect(layers).toHaveLength(2);
    const clone = layers[1]!;
    expect(clone.id).not.toBe("a");
    expect(clone.transform.x).toBe(24);
    expect(getContainerLayers(cmd.undo(after), ref)).toHaveLength(1);
  });

  it("duplicating a group deep-clones children with fresh ids", () => {
    const { project, ref } = projectWithLayers([group("g", [rect("c1")])]);
    const cmd = buildDuplicateCommand(project, ref, ["g"])!;
    const after = cmd.do(project);
    const clone = getContainerLayers(after, ref)[1] as GroupLayer;
    expect(clone.children[0]!.id).not.toBe("c1");
  });

  it("pastes fresh copies at an offset and undo removes them", () => {
    const { project, ref } = projectWithLayers([rect("a")]);
    const cmd = buildPasteCommand(ref, [rect("a")], { dx: 10, dy: 10 });
    const after = cmd.do(project);
    const layers = getContainerLayers(after, ref);
    expect(layers).toHaveLength(2);
    expect(layers[1]!.id).not.toBe("a");
    expect(layers[1]!.transform.x).toBe(10);
    expect(getContainerLayers(cmd.undo(after), ref)).toHaveLength(1);
  });
});

describe("group / ungroup / reparent", () => {
  it("groups sibling layers and undo restores them individually", () => {
    const { project, ref } = projectWithLayers([rect("a"), rect("b", { transform: { x: 20, y: 20, width: 10, height: 10, rotationDeg: 0, scaleX: 1, scaleY: 1 } })]);
    const cmd = buildGroupCommand(project, ref, ["a", "b"])!;
    const after = cmd.do(project);
    const layers = getContainerLayers(after, ref);
    expect(layers).toHaveLength(1);
    expect(layers[0]!.type).toBe("group");
    const g = layers[0] as GroupLayer;
    expect(g.children.map((c) => c.id).sort()).toEqual(["a", "b"]);
    const undone = cmd.undo(after);
    expect(getContainerLayers(undone, ref).map((l) => l.id)).toEqual(["a", "b"]);
  });

  it("refuses to group layers with different parents", () => {
    const { project, ref } = projectWithLayers([rect("a"), group("g", [rect("b")])]);
    expect(buildGroupCommand(project, ref, ["a", "b"])).toBeNull();
  });

  it("ungroups, splicing children back into the parent, and undo restores the group", () => {
    const { project, ref } = projectWithLayers([rect("a"), group("g", [rect("b"), rect("c")]), rect("d")]);
    const cmd = buildUngroupCommand(project, ref, "g")!;
    const after = cmd.do(project);
    expect(getContainerLayers(after, ref).map((l) => l.id)).toEqual(["a", "b", "c", "d"]);
    const undone = cmd.undo(after);
    expect(getContainerLayers(undone, ref).map((l) => l.id)).toEqual(["a", "g", "d"]);
  });

  it("reparents a layer into a group", () => {
    const { project, ref } = projectWithLayers([rect("a"), group("g", [rect("b")])]);
    const cmd = buildReparentCommand(project, ref, "a", "g", 0)!;
    const after = cmd.do(project);
    const g = getContainerLayers(after, ref).find((l) => l.id === "g") as GroupLayer;
    expect(g.children.map((c) => c.id)).toEqual(["a", "b"]);
    const undone = cmd.undo(after);
    expect(getContainerLayers(undone, ref).map((l) => l.id)).toEqual(["a", "g"]);
  });

  it("refuses to reparent a group into its own descendant (cycle)", () => {
    const { project, ref } = projectWithLayers([group("g", [group("inner", [rect("c1")])])]);
    expect(buildReparentCommand(project, ref, "g", "inner", 0)).toBeNull();
  });
});

describe("align / distribute", () => {
  const t = (x: number, y: number, w = 10, h = 10) => ({ x, y, width: w, height: h, rotationDeg: 0, scaleX: 1, scaleY: 1 });

  it("aligns left edges to the leftmost layer", () => {
    const { project, ref } = projectWithLayers([rect("a", { transform: t(0, 0) }), rect("b", { transform: t(50, 10) })]);
    const cmd = buildAlignCommand(project, ref, ["a", "b"], "left")!;
    const after = cmd.do(project);
    const layers = getContainerLayers(after, ref);
    expect(layers[0]!.transform.x).toBe(0);
    expect(layers[1]!.transform.x).toBe(0);
  });

  it("distributes three layers with even horizontal gaps", () => {
    const { project, ref } = projectWithLayers([rect("a", { transform: t(0, 0) }), rect("b", { transform: t(40, 0) }), rect("c", { transform: t(100, 0) })]);
    const cmd = buildDistributeCommand(project, ref, ["a", "b", "c"], "horizontal")!;
    const after = cmd.do(project);
    const b = getContainerLayers(after, ref).find((l) => l.id === "b")!;
    // Even gap between a's right edge (10) and c's left edge (100) for a 10-wide middle layer: gap = (90-10)/2 = 40 -> b.x = 10+40 = 50
    expect(b.transform.x).toBe(50);
  });

  it("returns null when fewer than 2 (align) or 3 (distribute) layers are given", () => {
    const { project, ref } = projectWithLayers([rect("a")]);
    expect(buildAlignCommand(project, ref, ["a"], "left")).toBeNull();
    expect(buildDistributeCommand(project, ref, ["a"], "horizontal")).toBeNull();
  });
});
