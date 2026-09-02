import { describe, expect, it } from "vitest";
import { createId } from "../../src/ids.js";
import { createEmptyProject } from "../../src/schema/project.js";
import type { StudioProjectDocument } from "../../src/schema/project.js";
import type { ImageLayer, TextLayer } from "../../src/schema/layers.js";
import { collectUsedAssetIds, findAssetUsage } from "../../src/compile/assetUsage.js";

const baseTransform = { x: 0, y: 0, width: 10, height: 10, rotationDeg: 0, scaleX: 1, scaleY: 1 };

function imageLayer(id: string, assetId: string, overrides: Partial<ImageLayer> = {}): ImageLayer {
  return { id, type: "image", name: id, assetId, transform: baseTransform, opacity: 1, visible: true, locked: false, zIndex: 0, responsive: [], interactionStates: [], ...overrides };
}

function textLayer(id: string, fontTokenId: string | undefined): TextLayer {
  return { id, type: "text", name: id, text: "hi", fontSizePx: 16, align: "left", fontTokenId, transform: baseTransform, opacity: 1, visible: true, locked: false, zIndex: 0, responsive: [], interactionStates: [] };
}

function baseProject(): StudioProjectDocument {
  return createEmptyProject({ id: createId(), name: "Test" });
}

describe("findAssetUsage / collectUsedAssetIds", () => {
  it("finds a direct image-layer reference", () => {
    const project = baseProject();
    const assetId = createId();
    project.pages.push({ id: createId(), name: "Home", slug: "home", layers: [imageLayer("l1", assetId)], animations: [] });

    const usage = findAssetUsage(project);
    expect(usage).toContainEqual(expect.objectContaining({ assetId, via: "layerImage", containerKind: "page", layerId: "l1" }));
    expect(collectUsedAssetIds(project).has(assetId)).toBe(true);
  });

  it("finds a mask asset reference distinct from the layer's own image asset", () => {
    const project = baseProject();
    const imageAssetId = createId();
    const maskAssetId = createId();
    project.pages.push({
      id: createId(),
      name: "Home",
      slug: "home",
      layers: [imageLayer("l1", imageAssetId, { mask: { type: "image", assetId: maskAssetId } })],
      animations: [],
    });

    const used = collectUsedAssetIds(project);
    expect(used.has(imageAssetId)).toBe(true);
    expect(used.has(maskAssetId)).toBe(true);
    expect(findAssetUsage(project)).toContainEqual(expect.objectContaining({ assetId: maskAssetId, via: "layerMask" }));
  });

  it("counts an unreferenced asset as unused", () => {
    const project = baseProject();
    const usedId = createId();
    const unusedId = createId();
    project.pages.push({ id: createId(), name: "Home", slug: "home", layers: [imageLayer("l1", usedId)], animations: [] });

    const used = collectUsedAssetIds(project);
    expect(used.has(usedId)).toBe(true);
    expect(used.has(unusedId)).toBe(false);
  });

  it("only counts an image-state-group's assets when the group is actually referenced by a layer", () => {
    const stateAssetA = createId();
    const stateAssetB = createId();
    const groupId = createId();
    const stateAId = createId();
    const stateBId = createId();

    const referenced = baseProject();
    referenced.imageStateGroups = [{ id: groupId, name: "Candy Bowl", defaultStateId: stateAId, states: [{ id: stateAId, name: "full", assetId: stateAssetA }, { id: stateBId, name: "empty", assetId: stateAssetB }] }];
    referenced.pages.push({ id: createId(), name: "Home", slug: "home", layers: [imageLayer("l1", stateAssetA, { stateGroupId: groupId })], animations: [] });
    const usedReferenced = collectUsedAssetIds(referenced);
    // Both states count as used once the group is referenced, even the non-default one.
    expect(usedReferenced.has(stateAssetA)).toBe(true);
    expect(usedReferenced.has(stateAssetB)).toBe(true);

    const unreferenced = baseProject();
    unreferenced.imageStateGroups = referenced.imageStateGroups;
    // No layer references groupId this time.
    const usedUnreferenced = collectUsedAssetIds(unreferenced);
    expect(usedUnreferenced.has(stateAssetA)).toBe(false);
    expect(usedUnreferenced.has(stateAssetB)).toBe(false);
  });

  it("only counts a font token's asset when a text layer actually uses that font token", () => {
    const fontAssetId = createId();
    const fontTokenId = createId();

    const project = baseProject();
    project.tokens.fonts = [{ id: fontTokenId, name: "Heading", assetId: fontAssetId, fallbackFamily: "sans-serif", weight: 400 }];
    project.pages.push({ id: createId(), name: "Home", slug: "home", layers: [textLayer("t1", fontTokenId)], animations: [] });
    expect(collectUsedAssetIds(project).has(fontAssetId)).toBe(true);

    const unused = baseProject();
    unused.tokens.fonts = project.tokens.fonts;
    unused.pages.push({ id: createId(), name: "Home", slug: "home", layers: [textLayer("t1", undefined)], animations: [] });
    expect(collectUsedAssetIds(unused).has(fontAssetId)).toBe(false);
  });

  it("finds references nested inside a group layer", () => {
    const assetId = createId();
    const project = baseProject();
    project.pages.push({
      id: createId(),
      name: "Home",
      slug: "home",
      layers: [{ id: "g1", type: "group", name: "g1", transform: baseTransform, opacity: 1, visible: true, locked: false, zIndex: 0, responsive: [], interactionStates: [], children: [imageLayer("l1", assetId)] }],
      animations: [],
    });
    expect(collectUsedAssetIds(project).has(assetId)).toBe(true);
  });
});
