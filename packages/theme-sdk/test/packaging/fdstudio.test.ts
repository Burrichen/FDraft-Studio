import { describe, expect, it } from "vitest";
import { buildSampleProject } from "../helpers/sampleProject.js";
import { packFdstudio, unpackFdstudio, type StudioPackageManifest } from "../../src/packaging/fdstudio.js";
import { createDeterministicZip } from "../../src/packaging/zip.js";
import { canonicalJsonBytes } from "../../src/packaging/canonicalJson.js";
import { sha256Hex } from "../../src/packaging/hash.js";
import { SdkError } from "../../src/errors.js";

const SDK_VERSION = "0.1.0-test";

describe("fdstudio pack/unpack", () => {
  it("round-trips a project and its assets losslessly", async () => {
    const { project, assets } = await buildSampleProject();
    const archive = await packFdstudio({ project, assets, sdkVersion: SDK_VERSION });
    const result = await unpackFdstudio(archive);

    expect(result.project).toEqual(project);
    expect(Object.keys(result.assets).sort()).toEqual(Object.keys(assets).sort());
    for (const path of Object.keys(assets)) {
      expect(result.assets[path]).toEqual(assets[path]);
    }
    expect(result.migrationsApplied).toEqual([]);
  });

  it("round-trips an asset with a Unicode filename intact", async () => {
    const { project, assets } = await buildSampleProject();
    const unicodePath = "assets/hallowe’en-🎃.png";
    const renamedProject = { ...project, assets: project.assets.map((a, i) => (i === 0 ? { ...a, path: unicodePath } : a)) };
    const originalPath = project.assets[0]!.path;
    const renamedAssets = { ...assets, [unicodePath]: assets[originalPath]! };
    delete renamedAssets[originalPath];

    const archive = await packFdstudio({ project: renamedProject, assets: renamedAssets, sdkVersion: SDK_VERSION });
    const result = await unpackFdstudio(archive);

    expect(result.assets[unicodePath]).toEqual(assets[originalPath]);
    expect(result.project.assets.some((a) => a.path === unicodePath)).toBe(true);
  });

  it("packing the same input twice is byte-identical (deterministic)", async () => {
    const { project, assets } = await buildSampleProject();
    const first = await packFdstudio({ project, assets, sdkVersion: SDK_VERSION });
    const second = await packFdstudio({ project, assets, sdkVersion: SDK_VERSION });
    expect(Buffer.from(second).equals(Buffer.from(first))).toBe(true);
  });

  it("is stable even if asset insertion order differs", async () => {
    const { project, assets } = await buildSampleProject();
    const reordered = Object.fromEntries(Object.entries(assets).reverse());
    const a = await packFdstudio({ project, assets, sdkVersion: SDK_VERSION });
    const b = await packFdstudio({ project, assets: reordered, sdkVersion: SDK_VERSION });
    expect(Buffer.from(b).equals(Buffer.from(a))).toBe(true);
  });

  it("rejects packing when a referenced asset's bytes are missing", async () => {
    const { project, assets } = await buildSampleProject();
    const { [project.assets[0]!.path]: _omitted, ...incomplete } = assets;
    void _omitted;
    let caught: unknown;
    try {
      await packFdstudio({ project, assets: incomplete, sdkVersion: SDK_VERSION });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(SdkError);
    expect((caught as SdkError).code).toBe("MISSING_ASSET");
  });

  it("rejects packing an asset that no AssetRecord references", async () => {
    const { project, assets } = await buildSampleProject();
    const withOrphan = { ...assets, "assets/orphan.png": new Uint8Array([1, 2, 3]) };
    await expect(packFdstudio({ project, assets: withOrphan, sdkVersion: SDK_VERSION })).rejects.toThrow(SdkError);
  });

  it("detects a corrupted asset by comparing against its declared hash", async () => {
    const { project, assets } = await buildSampleProject();
    const archive = await packFdstudio({ project, assets, sdkVersion: SDK_VERSION });
    const result = await unpackFdstudio(archive);

    const somePath = project.assets[0]!.path;
    const corrupted = new Uint8Array(result.assets[somePath]!);
    corrupted[0] = (corrupted[0]! + 1) % 256;

    expect(await sha256Hex(corrupted)).not.toBe(project.assets[0]!.sha256);
  });

  it("rejects an archive missing manifest.json", async () => {
    const bogus = createDeterministicZip({ "project.json": new TextEncoder().encode("{}") });
    await expect(unpackFdstudio(bogus)).rejects.toThrow(SdkError);
  });

  it("rejects an archive whose asset bytes don't match the manifest hash", async () => {
    const { project, assets } = await buildSampleProject();

    // Rebuild the same archive but tamper with one asset's bytes after hashing.
    const somePath = project.assets[0]!.path;
    const tamperedAssets = { ...assets, [somePath]: new Uint8Array([...assets[somePath]!, 0xff]) };
    const projectBytes = canonicalJsonBytes(project);
    const files: Record<string, Uint8Array> = { "project.json": projectBytes, ...assets };
    const fileRecords = await Promise.all(
      Object.keys(files)
        .sort()
        .map(async (path) => ({ path, sha256: await sha256Hex(files[path]!), sizeBytes: files[path]!.byteLength })),
    );
    const goodManifest: StudioPackageManifest = {
      packageFormat: "fdstudio",
      sdkVersion: SDK_VERSION,
      projectFormatVersion: project.formatVersion,
      files: fileRecords,
    };
    // Archive claims the *original* hashes but ships the *tampered* bytes.
    const tamperedArchive = createDeterministicZip({
      "manifest.json": canonicalJsonBytes(goodManifest),
      "project.json": projectBytes,
      ...tamperedAssets,
    });

    let caught: unknown;
    try {
      await unpackFdstudio(tamperedArchive);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(SdkError);
    expect((caught as SdkError).code).toBe("MANIFEST_HASH_MISMATCH");
  });

  // Migration-through-unpack is covered in test/migration/registry.test.ts,
  // using the committed fixtures/migrations/v0.9.0-project.json fixture.
});
