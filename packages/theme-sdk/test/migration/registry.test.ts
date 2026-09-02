import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { migrateProject } from "../../src/migration/registry.js";
import { unpackFdstudio } from "../../src/packaging/fdstudio.js";
import { createDeterministicZip } from "../../src/packaging/zip.js";
import { canonicalJsonBytes } from "../../src/packaging/canonicalJson.js";
import { sha256Hex } from "../../src/packaging/hash.js";
import { SdkError } from "../../src/errors.js";

const fixturesRoot = fileURLToPath(new URL("../../../../fixtures/", import.meta.url));

async function readFixtureJson(relativePath: string): Promise<unknown> {
  const text = await readFile(new URL(relativePath, `file://${fixturesRoot}`), "utf8");
  return JSON.parse(text);
}

describe("project format migration", () => {
  it("migrates a 0.9.0 project (renamed field, new arrays defaulted) to the current version", async () => {
    const legacy = await readFixtureJson("migrations/v0.9.0-project.json");
    const result = migrateProject(legacy);

    expect(result.migrationsApplied).toEqual([
      { fromVersion: "0.9.0", toVersion: "1.0.0", description: expect.stringContaining("stateGroups") },
    ]);
    expect(result.document.formatVersion).toBe("1.0.0");
    expect(result.document.componentRequirements).toEqual([]);
    expect(result.document.tokens.breakpoints).toEqual([]);
    expect(result.document.imageStateGroups).toHaveLength(1);
    expect(result.document.imageStateGroups[0]!.name).toBe("Legacy state group");
  });

  it("migrates the same fixture end-to-end through an actual .fdstudio archive", async () => {
    const legacy = (await readFixtureJson("migrations/v0.9.0-project.json")) as Record<string, unknown>;
    const assetBytes = new Uint8Array([1, 2, 3, 4]);
    const files: Record<string, Uint8Array> = {
      "project.json": canonicalJsonBytes(legacy),
      "assets/legacy.png": assetBytes,
    };
    const fileRecords = await Promise.all(
      Object.keys(files)
        .sort()
        .map(async (path) => ({ path, sha256: await sha256Hex(files[path]!), sizeBytes: files[path]!.byteLength })),
    );
    const manifest = { packageFormat: "fdstudio" as const, sdkVersion: "0.1.0-test", projectFormatVersion: "0.9.0", files: fileRecords };
    const archive = createDeterministicZip({ "manifest.json": canonicalJsonBytes(manifest), ...files });

    const result = await unpackFdstudio(archive);
    expect(result.migrationsApplied).toHaveLength(1);
    expect(result.project.formatVersion).toBe("1.0.0");
  });

  it("does not migrate a document already at the current version", async () => {
    const legacy = await readFixtureJson("migrations/v0.9.0-project.json");
    const migrated = migrateProject(legacy).document;
    const result = migrateProject(migrated);
    expect(result.migrationsApplied).toEqual([]);
    expect(result.document).toEqual(migrated);
  });

  it("rejects a future major version instead of guessing at it", async () => {
    const future = await readFixtureJson("unsupported-version/future-major.project.json");
    let caught: unknown;
    try {
      migrateProject(future);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(SdkError);
    expect((caught as SdkError).code).toBe("UNSUPPORTED_FUTURE_VERSION");
  });

  it("rejects a version older than the oldest migratable version", async () => {
    const ancient = await readFixtureJson("unsupported-version/too-old-legacy.project.json");
    let caught: unknown;
    try {
      migrateProject(ancient);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(SdkError);
    expect((caught as SdkError).code).toBe("UNSUPPORTED_LEGACY_VERSION");
  });

  it("rejects a document with no formatVersion field at all", () => {
    let caught: unknown;
    try {
      migrateProject({ metadata: { id: "x" } });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(SdkError);
    expect((caught as SdkError).code).toBe("INVALID_PACKAGE_FORMAT");
  });
});
