import { describe, expect, it } from "vitest";
import { buildSampleProject } from "../helpers/sampleProject.js";
import { compileTheme } from "../../src/compile/compileTheme.js";
import { packFdtheme, unpackFdtheme } from "../../src/packaging/fdtheme.js";
import { isRendererCompatible } from "../../src/validation/validateTheme.js";
import { createDeterministicZip, readZipSafely } from "../../src/packaging/zip.js";
import { canonicalJsonBytes } from "../../src/packaging/canonicalJson.js";
import { SdkError } from "../../src/errors.js";

describe("compileTheme", () => {
  it("strips editor-only fields and detects capabilities from the sample project", async () => {
    const { project, assets } = await buildSampleProject();
    const projectWithEditorState = { ...project, editorState: { selectedLayerIds: [project.pages[0]!.layers[0]!.id], openPanelIds: ["layers"] } };

    const { document } = compileTheme(projectWithEditorState, assets, { minRendererVersion: "0.1.0" });

    expect(document).not.toHaveProperty("editorState");
    expect(document.manifest.capabilities).toEqual(["animations", "behaviour", "masters", "popups", "responsive"]);
    expect(document.manifest.requiredComponentKeys).toEqual(["opt-in-button"]);
    expect(document.manifest.sourceProjectFormatVersion).toBe(project.formatVersion);
    expect(document.manifest.themeId).toBe(project.metadata.id);
  });

  it("prunes asset bytes nothing in the compiled graph references", async () => {
    const { project, assets } = await buildSampleProject();
    const unusedPath = "assets/unused.png";
    const projectWithUnusedAsset = {
      ...project,
      assets: [...project.assets, { id: "6b4a1e2d-3c4b-4a5d-9e6f-7a8b9c0d1e2f", kind: "image" as const, path: unusedPath, mimeType: "image/png", sizeBytes: 3, sha256: "a".repeat(64) }],
    };
    const assetsWithUnused = { ...assets, [unusedPath]: new Uint8Array([9, 9, 9]) };

    const { document, assets: compiledAssets } = compileTheme(projectWithUnusedAsset, assetsWithUnused, { minRendererVersion: "0.1.0" });

    expect(document.assets.some((a) => a.path === unusedPath)).toBe(false);
    expect(compiledAssets[unusedPath]).toBeUndefined();
    expect(Object.keys(compiledAssets).sort()).toEqual(Object.keys(assets).sort());
  });

  it("throws with schema/semantic details when compiling an invalid project", async () => {
    const { project, assets } = await buildSampleProject();
    const invalid = { ...project, pages: [{ ...project.pages[0]!, masterId: "00000000-0000-4000-8000-000000000000" }] };
    let caught: unknown;
    try {
      compileTheme(invalid, assets, { minRendererVersion: "0.1.0" });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(SdkError);
    expect((caught as SdkError).code).toBe("SCHEMA_VALIDATION_FAILED");
  });
});

describe("fdtheme pack/unpack", () => {
  it("round-trips a compiled theme losslessly", async () => {
    const { project, assets } = await buildSampleProject();
    const bundle = compileTheme(project, assets, { minRendererVersion: "0.1.0" });
    const archive = await packFdtheme(bundle);
    const { document, assets: unpackedAssets } = await unpackFdtheme(archive);

    expect(document.pages).toEqual(bundle.document.pages);
    expect(document.manifest.themeId).toBe(bundle.document.manifest.themeId);
    expect(document.manifest.files.length).toBeGreaterThan(0);
    expect(Object.keys(unpackedAssets).sort()).toEqual(Object.keys(bundle.assets).sort());
    for (const path of Object.keys(bundle.assets)) {
      expect(unpackedAssets[path]).toEqual(bundle.assets[path]);
    }
  });

  it("compiling and packing the same project twice is byte-identical", async () => {
    const { project, assets } = await buildSampleProject();
    const a = await packFdtheme(compileTheme(project, assets, { minRendererVersion: "0.1.0" }));
    const b = await packFdtheme(compileTheme(project, assets, { minRendererVersion: "0.1.0" }));
    expect(Buffer.from(b).equals(Buffer.from(a))).toBe(true);
  });

  it("rejects a .fdtheme with a tampered theme.json (hash mismatch)", async () => {
    const { project, assets } = await buildSampleProject();
    const archive = await packFdtheme(compileTheme(project, assets, { minRendererVersion: "0.1.0" }));

    // Extract the archive's raw (already-decompressed) files, corrupt
    // theme.json's bytes, and rebuild a new archive that still ships the
    // *original* manifest.json — i.e. a manifest declaring hashes that no
    // longer match what's actually in the package.
    const files = readZipSafely(archive);
    const tamperedFiles = { ...files, "theme.json": new Uint8Array([...files["theme.json"]!, 0x00]) };
    const tampered = createDeterministicZip(tamperedFiles);

    let caught: unknown;
    try {
      await unpackFdtheme(tampered);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(SdkError);
    expect((caught as SdkError).code).toBe("MANIFEST_HASH_MISMATCH");
  });

  it("rejects an archive missing theme.json", async () => {
    const { project, assets } = await buildSampleProject();
    const { document } = compileTheme(project, assets, { minRendererVersion: "0.1.0" });
    const manifestOnly = { ...document.manifest, files: [] };
    const archive = createDeterministicZip({ "manifest.json": canonicalJsonBytes(manifestOnly) });

    let caught: unknown;
    try {
      await unpackFdtheme(archive);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(SdkError);
    expect((caught as SdkError).code).toBe("INVALID_PACKAGE_FORMAT");
  });
});

describe("renderer compatibility", () => {
  it("accepts a renderer at or above the theme's minimum version", () => {
    expect(isRendererCompatible("0.1.0", "0.1.0")).toBe(true);
    expect(isRendererCompatible("0.1.0", "0.2.0")).toBe(true);
    expect(isRendererCompatible("1.2.3", "2.0.0")).toBe(true);
  });

  it("rejects a renderer below the theme's minimum version", () => {
    expect(isRendererCompatible("0.2.0", "0.1.0")).toBe(false);
    expect(isRendererCompatible("2.0.0", "1.9.9")).toBe(false);
  });
});
