// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createId, createProject, type AssetRecord, type ImageLayer, type StudioProjectDocument } from "@fdraft/theme-sdk";
import { sha256Hex } from "@fdraft/theme-sdk/packaging";
import { findAssetHealthIssues, findUnusedAssets, summarizeAssetUsage } from "../../src/assets/assetUsageSummary.js";

function project(): StudioProjectDocument {
  return createProject({ id: createId(), name: "Test" });
}

function asset(id: string, overrides: Partial<AssetRecord> = {}): AssetRecord {
  return { id, kind: "image", path: `assets/${id}.png`, mimeType: "image/png", sizeBytes: 10, sha256: "a".repeat(64), name: `${id}.png`, ...overrides };
}

function imageLayer(id: string, assetId: string): ImageLayer {
  return { id, type: "image", name: id, assetId, transform: { x: 0, y: 0, width: 10, height: 10, rotationDeg: 0, scaleX: 1, scaleY: 1 }, opacity: 1, visible: true, locked: false, zIndex: 0, responsive: [], interactionStates: [] };
}

describe("summarizeAssetUsage / findUnusedAssets", () => {
  it("counts references and lists unused assets", () => {
    const p: StudioProjectDocument = {
      ...project(),
      assets: [asset("used"), asset("unused")],
      pages: [{ id: createId(), name: "Home", slug: "home", layers: [imageLayer("l1", "used")], animations: [] }],
    };

    const usage = summarizeAssetUsage(p);
    expect(usage.get("used")?.count).toBe(1);
    expect(usage.has("unused")).toBe(false);

    const unused = findUnusedAssets(p);
    expect(unused.map((a) => a.id)).toEqual(["unused"]);
  });

  it("counts multiple references to the same asset", () => {
    const p: StudioProjectDocument = {
      ...project(),
      assets: [asset("shared")],
      pages: [{ id: createId(), name: "Home", slug: "home", layers: [imageLayer("l1", "shared"), imageLayer("l2", "shared")], animations: [] }],
    };
    expect(summarizeAssetUsage(p).get("shared")?.count).toBe(2);
  });
});

describe("findAssetHealthIssues", () => {
  it("flags a missing asset (no bytes at all)", async () => {
    const p = { ...project(), assets: [asset("a1")] };
    const issues = await findAssetHealthIssues(p, {});
    expect(issues).toEqual([{ assetId: "a1", kind: "missing" }]);
  });

  it("flags a hash mismatch (bytes present but corrupted/altered)", async () => {
    const bytes = new TextEncoder().encode("real content");
    const realHash = await sha256Hex(bytes);
    const p = { ...project(), assets: [asset("a1", { sha256: realHash, path: "assets/a1.png" })] };
    const corrupted = new TextEncoder().encode("different content");
    const issues = await findAssetHealthIssues(p, { "assets/a1.png": corrupted });
    expect(issues).toEqual([{ assetId: "a1", kind: "hash-mismatch" }]);
  });

  it("reports no issues for a healthy asset", async () => {
    const bytes = new TextEncoder().encode("real content");
    const realHash = await sha256Hex(bytes);
    const p = { ...project(), assets: [asset("a1", { sha256: realHash, path: "assets/a1.png" })] };
    const issues = await findAssetHealthIssues(p, { "assets/a1.png": bytes });
    expect(issues).toEqual([]);
  });
});
