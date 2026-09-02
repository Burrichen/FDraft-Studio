// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createId, createProject, type StudioProjectDocument } from "@fdraft/theme-sdk";
import { inferAssetKind, planAssetImport } from "../../src/assets/assetImport.js";

function project(): StudioProjectDocument {
  return createProject({ id: createId(), name: "Test" });
}

const PNG_BYTES = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4]);

describe("inferAssetKind", () => {
  it("maps known extensions to their kind, case-insensitively", () => {
    expect(inferAssetKind("photo.PNG")).toBe("image");
    expect(inferAssetKind("icon.svg")).toBe("svg");
    expect(inferAssetKind("Heading.woff2")).toBe("font");
  });

  it("returns undefined for an unsupported extension", () => {
    expect(inferAssetKind("script.exe")).toBeUndefined();
    expect(inferAssetKind("noextension")).toBeUndefined();
  });
});

describe("planAssetImport", () => {
  it("rejects an unsupported file type", async () => {
    await expect(planAssetImport("virus.exe", PNG_BYTES, project())).rejects.toMatchObject({ code: "DANGEROUS_FILE_TYPE" });
  });

  it("rejects an empty file", async () => {
    await expect(planAssetImport("empty.png", new Uint8Array(0), project())).rejects.toMatchObject({ code: "SCHEMA_VALIDATION_FAILED" });
  });

  it("rejects a file over the size limit", async () => {
    const huge = new Uint8Array(50 * 1024 * 1024 + 1);
    await expect(planAssetImport("huge.png", huge, project())).rejects.toMatchObject({ code: "FILE_TOO_LARGE" });
  });

  it("plans a plain image import with a content-addressed path", async () => {
    const plan = await planAssetImport("Photo.png", PNG_BYTES, project());
    expect(plan.kind).toBe("image");
    expect(plan.path).toMatch(/^assets\/[0-9a-f]{64}\.png$/);
    expect(plan.mimeType).toBe("image/png");
    expect(plan.reused).toBe(false);
    expect(plan.fileName).toBe("Photo.png");
  });

  it("detects duplicate content already present in the project and offers to reuse it", async () => {
    const first = await planAssetImport("Photo.png", PNG_BYTES, project());
    const withExisting: StudioProjectDocument = { ...project(), assets: [{ id: "existing-id", kind: "image", path: first.path, mimeType: "image/png", sizeBytes: first.sizeBytes, sha256: first.sha256, name: "Original Photo.png" }] };

    const second = await planAssetImport("Photo Copy.png", PNG_BYTES, withExisting);
    expect(second.reused).toBe(true);
    expect(second.existingAssetId).toBe("existing-id");
    expect(second.path).toBe(first.path);
    expect(second.fileName).toBe("Original Photo.png"); // keeps the existing asset's name, doesn't invent a new one
  });

  it("disambiguates a display name that collides with a different asset's name", async () => {
    const withExisting: StudioProjectDocument = { ...project(), assets: [{ id: createId(), kind: "image", path: "assets/aaaa.png", mimeType: "image/png", sizeBytes: 1, sha256: "a".repeat(64), name: "logo.png" }] };
    const plan = await planAssetImport("logo.png", PNG_BYTES, withExisting);
    expect(plan.fileName).toBe("logo (2).png");
  });

  it("sanitises an SVG with a stripped script and accepts it, reporting what was removed", async () => {
    const svgText = `<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><circle r="1"/></svg>`;
    const bytes = new TextEncoder().encode(svgText);
    const plan = await planAssetImport("icon.svg", bytes, project());
    expect(plan.kind).toBe("svg");
    expect(new TextDecoder().decode(plan.bytes)).not.toContain("<script");
    expect(plan.svgStripped?.length).toBeGreaterThan(0);
  });

  it("rejects an SVG with no <svg> root even after attempted sanitisation", async () => {
    const bytes = new TextEncoder().encode(`<not-svg><script>alert(1)</script></not-svg>`);
    await expect(planAssetImport("bad.svg", bytes, project())).rejects.toMatchObject({ code: "UNSAFE_SVG" });
  });

  it("accepts an already-clean SVG unchanged", async () => {
    const svgText = `<svg xmlns="http://www.w3.org/2000/svg"><circle r="1"/></svg>`;
    const bytes = new TextEncoder().encode(svgText);
    const plan = await planAssetImport("icon.svg", bytes, project());
    expect(new TextDecoder().decode(plan.bytes)).toBe(svgText);
    expect(plan.svgStripped).toBeUndefined();
  });
});
