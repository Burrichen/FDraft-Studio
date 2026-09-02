// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createId, createProject } from "@fdraft/theme-sdk";
import type { StudioProjectDocument } from "@fdraft/theme-sdk";
import { buildAddEffectLayerCommand, buildSetEffectDeclarationCommand } from "../../src/editor/effectCommands.js";
import { getContainerLayers } from "../../src/editor/containerRef.js";

function project(): StudioProjectDocument {
  const p = createProject({ id: createId(), name: "Test" });
  p.pages.push({ id: "page-1", name: "Home", slug: "home", layers: [], animations: [] });
  return p;
}

const ref = { kind: "page" as const, id: "page-1" };

describe("buildAddEffectLayerCommand", () => {
  it("adds an effect layer covering the full canvas, and undoes cleanly", () => {
    const p = project();
    const command = buildAddEffectLayerCommand(p, ref, "snow");
    const after = command.do(p);
    const layers = getContainerLayers(after, ref);
    expect(layers).toHaveLength(1);
    expect(layers[0]!.type).toBe("effect");
    if (layers[0]!.type === "effect") {
      expect(layers[0]!.effect.kind).toBe("snow");
      expect(layers[0]!.transform).toEqual({ x: 0, y: 0, width: p.canvas!.width, height: p.canvas!.height, rotationDeg: 0, scaleX: 1, scaleY: 1 });
    }
    expect(getContainerLayers(command.undo(after), ref)).toHaveLength(0);
  });

  it("places a new effect layer above existing siblings in z-order", () => {
    let p = project();
    p = buildAddEffectLayerCommand(p, ref, "rain").do(p);
    p = buildAddEffectLayerCommand(p, ref, "fog").do(p);
    const layers = getContainerLayers(p, ref);
    expect(layers[1]!.zIndex).toBeGreaterThan(layers[0]!.zIndex);
  });
});

describe("buildSetEffectDeclarationCommand", () => {
  it("updates an effect layer's declaration and undoes cleanly", () => {
    let p = project();
    p = buildAddEffectLayerCommand(p, ref, "snow").do(p);
    const layer = getContainerLayers(p, ref)[0]!;
    if (layer.type !== "effect") throw new Error("expected effect layer");
    const updated = { ...layer.effect, intensity: 0.9, speed: 2 };

    const command = buildSetEffectDeclarationCommand(ref, layer.id, layer.effect, updated);
    const after = command.do(p);
    const afterLayer = getContainerLayers(after, ref)[0]!;
    expect(afterLayer.type === "effect" && afterLayer.effect.intensity).toBe(0.9);

    const undone = command.undo(after);
    const undoneLayer = getContainerLayers(undone, ref)[0]!;
    expect(undoneLayer.type === "effect" && undoneLayer.effect.intensity).toBe(0.5);
  });
});
