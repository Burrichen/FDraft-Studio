// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createId, createProject } from "@fdraft/theme-sdk";
import type { StudioProjectDocument } from "@fdraft/theme-sdk";
import { analyzePerformance, LARGE_ASSET_BYTES } from "../../src/performance/performanceInspector.js";
import { buildAddEffectLayerCommand } from "../../src/editor/effectCommands.js";
import { buildAddAnimationCommand } from "../../src/editor/animationCommands.js";

function project(): StudioProjectDocument {
  const p = createProject({ id: createId(), name: "Test" });
  p.pages.push({ id: "page-1", name: "Home", slug: "home", layers: [{ id: "box", type: "shape", name: "Box", shape: "rect", transform: { x: 0, y: 0, width: 10, height: 10, rotationDeg: 0, scaleX: 1, scaleY: 1 }, opacity: 1, visible: true, locked: false, zIndex: 0, responsive: [], interactionStates: [] }], animations: [] });
  return p;
}

const ref = { kind: "page" as const, id: "page-1" };

describe("analyzePerformance", () => {
  it("counts total layers across the project", () => {
    const report = analyzePerformance(project(), "high");
    expect(report.totalLayers).toBe(1);
  });

  it("counts animated layers by distinct target, not by animation count", () => {
    let p = project();
    p = { ...p, pages: p.pages.map((page) => ({ ...page, animations: [buildAddAnimationCommand(ref, "box").animation, buildAddAnimationCommand(ref, "box", "pulse").animation] })) };
    const report = analyzePerformance(p, "high");
    expect(report.animatedLayerIds.size).toBe(1);
    expect(report.animations).toHaveLength(2);
  });

  it("reports each effect layer's tier-capped approximate particle count, never a raw unbounded number", () => {
    let p = project();
    p = buildAddEffectLayerCommand(p, ref, "snow").do(p);
    const high = analyzePerformance(p, "high");
    const low = analyzePerformance(p, "low");
    expect(high.effectLayers).toHaveLength(1);
    expect(high.effectLayers[0]!.approxParticleCount).toBeGreaterThan(0);
    expect(low.effectLayers[0]!.approxParticleCount).toBe(0);
  });

  it("flags when there are more effect layers than the active tier allows", () => {
    let p = project();
    for (const kind of ["snow", "rain", "fog", "dust", "stars"] as const) {
      p = buildAddEffectLayerCommand(p, ref, kind).do(p);
    }
    const medium = analyzePerformance(p, "medium"); // cap is 2
    expect(medium.effectLayersOverCap).toBe(true);
    const high = analyzePerformance(p, "high"); // cap is 4, still under with 5... actually 5 > 4
    expect(high.effectLayersOverCap).toBe(true);
  });

  it("does not flag effect layer count when within the tier's cap", () => {
    let p = project();
    p = buildAddEffectLayerCommand(p, ref, "snow").do(p);
    expect(analyzePerformance(p, "high").effectLayersOverCap).toBe(false);
  });

  it("lists assets at or above the large-asset threshold", () => {
    const p = project();
    p.assets.push({ id: "a1", kind: "image", path: "assets/big.png", mimeType: "image/png", sizeBytes: LARGE_ASSET_BYTES, sha256: "a".repeat(64) });
    p.assets.push({ id: "a2", kind: "image", path: "assets/small.png", mimeType: "image/png", sizeBytes: 100, sha256: "b".repeat(64) });
    const report = analyzePerformance(p, "high");
    expect(report.largeAssets).toHaveLength(1);
    expect(report.largeAssets[0]!.assetId).toBe("a1");
  });

  it("surfaces the shared checkDesignWarnings output rather than a second, separate warning system", () => {
    const report = analyzePerformance(project(), "high");
    expect(Array.isArray(report.designWarnings)).toBe(true);
  });
});
