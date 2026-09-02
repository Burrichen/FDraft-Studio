import { describe, expect, it } from "vitest";
import type { MasterPage, Page } from "@fdraft/theme-sdk";
import { resolveContainerLayers, resolveMasterChain } from "../src/inheritance.js";
import { RendererError } from "../src/errors.js";

function master(id: string, parentMasterId?: string, layerIds: string[] = []): MasterPage {
  return {
    id,
    name: id,
    ...(parentMasterId ? { parentMasterId } : {}),
    layers: layerIds.map((layerId) => makeLayer(layerId)),
    animations: [],
  };
}

function makeLayer(id: string) {
  return {
    id,
    name: id,
    type: "shape" as const,
    shape: "rect" as const,
    transform: { x: 0, y: 0, width: 10, height: 10, rotationDeg: 0, scaleX: 1, scaleY: 1 },
    opacity: 1,
    visible: true,
    locked: false,
    zIndex: 0,
    responsive: [],
    interactionStates: [],
  };
}

describe("resolveMasterChain", () => {
  it("returns an empty chain when no masterId is given", () => {
    expect(resolveMasterChain([master("a")], undefined)).toEqual([]);
  });

  it("orders a multi-level chain root-most first", () => {
    const grandparent = master("gp");
    const parent = master("p", "gp");
    const child = master("c", "p");
    const chain = resolveMasterChain([grandparent, parent, child], "c");
    expect(chain.map((m) => m.id)).toEqual(["gp", "p", "c"]);
  });

  it("throws MISSING_MASTER for a dangling masterId", () => {
    expect(() => resolveMasterChain([master("a")], "does-not-exist")).toThrow(RendererError);
    try {
      resolveMasterChain([master("a")], "does-not-exist");
    } catch (error) {
      expect((error as RendererError).code).toBe("MISSING_MASTER");
    }
  });

  it("throws CIRCULAR_MASTER_CHAIN instead of looping forever", () => {
    const a = master("a", "b");
    const b = master("b", "a");
    expect(() => resolveMasterChain([a, b], "a")).toThrow(RendererError);
    try {
      resolveMasterChain([a, b], "a");
    } catch (error) {
      expect((error as RendererError).code).toBe("CIRCULAR_MASTER_CHAIN");
    }
  });
});

describe("resolveContainerLayers", () => {
  it("puts master layers before the page's own layers", () => {
    const m = master("m", undefined, ["bg"]);
    const page: Page = { id: "pg", name: "Page", slug: "page", masterId: "m", layers: [makeLayer("fg")], animations: [] };
    const layers = resolveContainerLayers(page, [m]);
    expect(layers.map((l) => l.id)).toEqual(["bg", "fg"]);
  });

  it("returns just the page's own layers when it has no master", () => {
    const page: Page = { id: "pg", name: "Page", slug: "page", layers: [makeLayer("fg")], animations: [] };
    expect(resolveContainerLayers(page, []).map((l) => l.id)).toEqual(["fg"]);
  });

  it("applies a masterLayerOverride's transform/visibility/opacity to the inherited layer, without touching its id or type", () => {
    const m = master("m", undefined, ["bg"]);
    const page: Page = {
      id: "pg",
      name: "Page",
      slug: "page",
      masterId: "m",
      masterLayerOverrides: { bg: { transform: { x: 500 }, visible: false, opacity: 0.5 } },
      layers: [],
      animations: [],
    };
    const [bg] = resolveContainerLayers(page, [m]);
    expect(bg!.id).toBe("bg");
    expect(bg!.transform.x).toBe(500);
    expect(bg!.transform.y).toBe(0); // untouched fields of a partial transform override survive
    expect(bg!.visible).toBe(false);
    expect(bg!.opacity).toBe(0.5);
  });

  it("leaves an inherited layer with no override untouched", () => {
    const m = master("m", undefined, ["bg", "other"]);
    const page: Page = { id: "pg", name: "Page", slug: "page", masterId: "m", masterLayerOverrides: { bg: { visible: false } }, layers: [], animations: [] };
    const layers = resolveContainerLayers(page, [m]);
    const other = layers.find((l) => l.id === "other")!;
    expect(other.visible).toBe(true);
  });

  it("applies an override to a master layer nested inside a group", () => {
    const group = { id: "g1", name: "g1", type: "group" as const, transform: { x: 0, y: 0, width: 10, height: 10, rotationDeg: 0, scaleX: 1, scaleY: 1 }, opacity: 1, visible: true, locked: false, zIndex: 0, responsive: [], interactionStates: [], children: [makeLayer("nested")] };
    const m: MasterPage = { id: "m", name: "m", layers: [group], animations: [] };
    const page: Page = { id: "pg", name: "Page", slug: "page", masterId: "m", masterLayerOverrides: { nested: { visible: false } }, layers: [], animations: [] };
    const [resolvedGroup] = resolveContainerLayers(page, [m]);
    expect(resolvedGroup!.type).toBe("group");
    const nested = (resolvedGroup as typeof group).children[0]!;
    expect(nested.visible).toBe(false);
  });
});
