// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createId, createProject, type AssetRecord, type ImageLayer, type StudioProjectDocument } from "@fdraft/theme-sdk";
import { analyzeProjectExport, analyzeThemeExport } from "../../src/project/exportAnalysis.js";

function project(): StudioProjectDocument {
  const p = createProject({ id: createId(), name: "Analysis Test" });
  p.pages.push({ id: createId(), name: "Home", slug: "home", layers: [], animations: [] });
  return p;
}

function asset(overrides: Partial<AssetRecord> = {}): AssetRecord {
  const id = createId();
  return { id, kind: "image", path: `assets/${id}.png`, mimeType: "image/png", sizeBytes: 10, sha256: "a".repeat(64), name: `${id}.png`, ...overrides };
}

function imageLayer(assetId: string): ImageLayer {
  return { id: createId(), type: "image", name: "img", assetId, transform: { x: 0, y: 0, width: 10, height: 10, rotationDeg: 0, scaleX: 1, scaleY: 1 }, opacity: 1, visible: true, locked: false, zIndex: 0, responsive: [], interactionStates: [] };
}

describe("analyzeThemeExport", () => {
  it("reports blocking schema errors instead of attempting to compile", async () => {
    const p = project();
    p.pages[0]!.layers = [imageLayer(createId())]; // broken reference — no such asset
    const analysis = await analyzeThemeExport(p, {}, { minRendererVersion: "0.1.0" });
    expect(analysis.valid).toBe(false);
    expect(analysis.blockingErrors).toContainEqual(expect.objectContaining({ code: "BROKEN_REFERENCE" }));
    expect(analysis.packageSizeBytes).toBeUndefined();
  });

  it("reports a real package size and asset counts for a valid project", async () => {
    const p = project();
    const analysis = await analyzeThemeExport(p, {}, { minRendererVersion: "0.1.0" });
    expect(analysis.valid).toBe(true);
    expect(analysis.packageSizeBytes).toBeGreaterThan(0);
    expect(analysis.assetCount).toBe(0);
    expect(analysis.usedAssetCount).toBe(0);
  });

  it("warns about unused assets without blocking export", async () => {
    const p = { ...project(), assets: [asset()] };
    const analysis = await analyzeThemeExport(p, {}, { minRendererVersion: "0.1.0" });
    expect(analysis.valid).toBe(true);
    expect(analysis.assetCount).toBe(1);
    expect(analysis.usedAssetCount).toBe(0);
    expect(analysis.warnings.some((w) => w.includes("1 asset"))).toBe(true);
  });

  it("reports a blocking error when a used asset's bytes are genuinely missing", async () => {
    const record = asset();
    const p = { ...project(), assets: [record] };
    p.pages[0]!.layers = [imageLayer(record.id)];
    const analysis = await analyzeThemeExport(p, {}, { minRendererVersion: "0.1.0" }); // no bytes provided for record.path
    expect(analysis.valid).toBe(false);
    expect(analysis.blockingErrors).toContainEqual(expect.objectContaining({ code: "MISSING_ASSET" }));
  });

  it("reports capabilities and required components for a project that uses them", async () => {
    const p = project();
    p.popups.push({ id: createId(), name: "Popup", trigger: "onLoad", layers: [], animations: [] });
    const analysis = await analyzeThemeExport(p, {}, { minRendererVersion: "0.1.0" });
    expect(analysis.valid).toBe(true);
    expect(analysis.capabilities).toContain("popups");
  });
});

describe("analyzeProjectExport", () => {
  it("reports a real .fdstudio package size for a valid project", async () => {
    const analysis = await analyzeProjectExport(project(), {}, "0.1.0-test");
    expect(analysis.valid).toBe(true);
    expect(analysis.packageSizeBytes).toBeGreaterThan(0);
  });

  it("reports blocking errors for an invalid project", async () => {
    const p = project();
    p.pages[0]!.layers = [imageLayer(createId())];
    const analysis = await analyzeProjectExport(p, {}, "0.1.0-test");
    expect(analysis.valid).toBe(false);
    expect(analysis.blockingErrors.length).toBeGreaterThan(0);
  });
});
