import { describe, expect, it } from "vitest";
import { createId, createProject, validateProject, compileTheme, detectCapabilities, type StudioProjectDocument, type Layer } from "../../src/index.js";
import { compileProjectToFdtheme, packFdtheme, sha256Hex } from "../../src/packagingIndex.js";

const PAGE_COUNT = 25;
const LAYERS_PER_PAGE = 14; // 10 shape + 2 text + 1 image + 1 effect
const ASSET_COUNT = 10;

function rectTransform(i: number) {
  return { x: (i % 10) * 150, y: Math.floor(i / 10) * 150, width: 120, height: 120, rotationDeg: 0, scaleX: 1, scaleY: 1 };
}

async function buildLargeProject(): Promise<{ project: StudioProjectDocument; assets: Record<string, Uint8Array> }> {
  const assets: Record<string, Uint8Array> = {};
  const assetIds: string[] = [];
  for (let a = 0; a < ASSET_COUNT; a++) {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, a, a + 1, a + 2]);
    const hash = await sha256Hex(bytes);
    const path = `assets/${hash}.png`;
    assets[path] = bytes;
    assetIds.push(createId());
  }

  const project = createProject({ id: createId(), name: "Scale Test Event" });
  project.assets = assetIds.map((id, i) => ({ id, kind: "image" as const, path: Object.keys(assets)[i]!, mimeType: "image/png", sizeBytes: assets[Object.keys(assets)[i]!]!.byteLength, sha256: Object.keys(assets)[i]!.split("/")[1]!.replace(".png", "") }));

  for (let p = 0; p < PAGE_COUNT; p++) {
    const layers: Layer[] = [];
    for (let i = 0; i < 10; i++) {
      layers.push({ id: createId(), type: "shape", name: `Box ${i}`, shape: "rect", transform: rectTransform(i), opacity: 1, visible: true, locked: false, zIndex: i, responsive: [], interactionStates: [] });
    }
    for (let i = 0; i < 2; i++) {
      layers.push({ id: createId(), type: "text", name: `Text ${i}`, text: `Page ${p} text ${i}`, fontSizePx: 24, align: "center", transform: rectTransform(10 + i), opacity: 1, visible: true, locked: false, zIndex: 10 + i, responsive: [], interactionStates: [] });
    }
    layers.push({ id: createId(), type: "image", name: "Image", assetId: assetIds[p % ASSET_COUNT]!, transform: rectTransform(12), opacity: 1, visible: true, locked: false, zIndex: 12, responsive: [], interactionStates: [] });
    layers.push({
      id: createId(),
      type: "effect",
      name: "Snow",
      transform: { x: 0, y: 0, width: 1920, height: 1080, rotationDeg: 0, scaleX: 1, scaleY: 1 },
      opacity: 1,
      visible: true,
      locked: false,
      zIndex: 13,
      responsive: [],
      interactionStates: [],
      effect: { id: createId(), name: "Snow effect", kind: "snow", intensity: 0.5, speed: 1, opacity: 1, seed: p },
    });

    project.pages.push({ id: createId(), name: `Page ${p}`, slug: `page-${p}`, layers, animations: [] });
  }

  return { project, assets };
}

describe("realistic-scale project (performance/scale test, no timing assertions)", () => {
  it(`validates, compiles, and packs a project with ${PAGE_COUNT} pages × ~${LAYERS_PER_PAGE} layers and ${ASSET_COUNT} assets`, async () => {
    const { project, assets } = await buildLargeProject();

    const totalLayers = project.pages.reduce((sum, p) => sum + p.layers.length, 0);
    expect(project.pages).toHaveLength(PAGE_COUNT);
    expect(totalLayers).toBe(PAGE_COUNT * LAYERS_PER_PAGE);

    const validation = validateProject(project);
    expect(validation.valid, JSON.stringify(validation.issues)).toBe(true);

    const capabilities = detectCapabilities(project);
    expect(capabilities).toContain("effects");

    const bundle = compileTheme(project, assets, { minRendererVersion: "0.1.0" });
    expect(bundle.document.pages).toHaveLength(PAGE_COUNT);

    const fdthemeBytes = await compileProjectToFdtheme(project, assets, { minRendererVersion: "0.1.0" });
    expect(fdthemeBytes.byteLength).toBeGreaterThan(0);

    // Every distinct asset is referenced across the many pages, so the compiled/packed asset count matches the referenced set exactly — proves reuse (content-addressing) isn't silently duplicating bytes at scale.
    const { assets: packedAssets } = await import("../../src/packagingIndex.js").then((m) => m.unpackFdtheme(fdthemeBytes));
    expect(Object.keys(packedAssets)).toHaveLength(ASSET_COUNT);
  }, 30_000);

  it("re-packing an unchanged large project is deterministic (identical bytes)", async () => {
    const { project, assets } = await buildLargeProject();
    const first = await packFdtheme(compileTheme(project, assets, { minRendererVersion: "0.1.0" }));
    const second = await packFdtheme(compileTheme(project, assets, { minRendererVersion: "0.1.0" }));
    expect(first).toEqual(second);
  }, 30_000);
});
