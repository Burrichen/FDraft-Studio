// @vitest-environment node
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createNodeTestPlatform } from "../helpers/nodePlatform.js";
import { withTempDir } from "../helpers/tempDir.js";
import { checkProjectAgainstFDraft, readFDraftCompatibility } from "../../src/publish/fdraftCompatibility.js";

function platformIn(dir: string) {
  return createNodeTestPlatform({ appDataDir: join(dir, "appdata"), appConfigDir: join(dir, "appconfig") });
}

// Mirrors the real, committed shape of FDraft's own files exactly (see
// docs/fdraft-theme-runtime/INTEGRATION.md in ../FDraft), so this test
// proves the regex extraction against genuine syntax, not an idealised one.
const REAL_SHAPED_VERSIONS_FILE = `// GENERATED FILE — do not edit by hand.
// Regenerate with \`pnpm run sync-theme-runtime-versions\`.

export const INSTALLED_THEME_SDK_VERSION = "0.1.0";
export const INSTALLED_THEME_RENDERER_VERSION = "0.1.0";
`;

const REAL_SHAPED_COMPATIBILITY_FILE = `export const FDRAFT_SUPPORTED_COMPONENT_KEYS = [
  "page-title", "event-information", "event-countdown", "draft-controls",
  "film-grid", "event-progress", "points-counter",
] as const;

export const FDRAFT_SUPPORTED_CAPABILITIES = [
  "responsive", "masters", "popups",
] as const;
`;

async function writeFDraftIntegrationFiles(platform: ReturnType<typeof platformIn>, repoPath: string, versions = REAL_SHAPED_VERSIONS_FILE, compatibility = REAL_SHAPED_COMPATIBILITY_FILE) {
  const dir = platform.join(repoPath, "src", "infrastructure", "theme-runtime");
  await platform.mkdir(dir);
  await platform.writeTextFile(platform.join(dir, "installed-versions.generated.ts"), versions);
  await platform.writeTextFile(platform.join(dir, "compatibility.ts"), compatibility);
}

describe("readFDraftCompatibility", () => {
  it("reports missing when the integration files don't exist", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const repo = join(dir, "FDraft");
      await platform.mkdir(repo);
      const result = await readFDraftCompatibility(platform, repo);
      expect(result.status).toBe("missing");
      expect(result.detail).toContain("installed-versions.generated.ts");
    });
  });

  it("parses real-shaped committed files correctly", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const repo = join(dir, "FDraft");
      await writeFDraftIntegrationFiles(platform, repo);
      const result = await readFDraftCompatibility(platform, repo);
      expect(result.status).toBe("ok");
      expect(result.compatibility).toEqual({
        installedSdkVersion: "0.1.0",
        installedRendererVersion: "0.1.0",
        supportedComponentKeys: ["page-title", "event-information", "event-countdown", "draft-controls", "film-grid", "event-progress", "points-counter"],
        supportedCapabilities: ["responsive", "masters", "popups"],
      });
    });
  });

  it("reports unparseable when the files exist but don't contain the expected constants", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const repo = join(dir, "FDraft");
      await writeFDraftIntegrationFiles(platform, repo, "export const SOMETHING_ELSE = 1;\n", "export const ALSO_SOMETHING_ELSE = [];\n");
      const result = await readFDraftCompatibility(platform, repo);
      expect(result.status).toBe("unparseable");
    });
  });
});

describe("checkProjectAgainstFDraft", () => {
  const fdraft = { installedSdkVersion: "0.1.0", installedRendererVersion: "0.1.0", supportedComponentKeys: ["page-title", "points-counter"], supportedCapabilities: ["responsive", "masters", "popups"] };

  it("is compatible when everything the project needs is supported", () => {
    const result = checkProjectAgainstFDraft({ minRendererVersion: "0.1.0", requiredComponentKeys: ["page-title"], capabilities: ["responsive"] }, fdraft);
    expect(result).toEqual({ compatible: true, reasons: [] });
  });

  it("flags an unsupported component key by name", () => {
    const result = checkProjectAgainstFDraft({ minRendererVersion: "0.1.0", requiredComponentKeys: ["film-grid"], capabilities: [] }, fdraft);
    expect(result.compatible).toBe(false);
    expect(result.reasons[0]).toContain("film-grid");
  });

  it("flags an unsupported capability by name", () => {
    const result = checkProjectAgainstFDraft({ minRendererVersion: "0.1.0", requiredComponentKeys: [], capabilities: ["animations"] }, fdraft);
    expect(result.compatible).toBe(false);
    expect(result.reasons[0]).toContain("animations");
  });

  it("flags a renderer version requirement FDraft's installed renderer doesn't meet", () => {
    const result = checkProjectAgainstFDraft({ minRendererVersion: "0.2.0", requiredComponentKeys: [], capabilities: [] }, fdraft);
    expect(result.compatible).toBe(false);
    expect(result.reasons[0]).toContain("0.2.0");
  });

  it("reports every failing reason at once, not just the first", () => {
    const result = checkProjectAgainstFDraft({ minRendererVersion: "0.2.0", requiredComponentKeys: ["film-grid"], capabilities: ["animations"] }, fdraft);
    expect(result.reasons).toHaveLength(3);
  });
});
