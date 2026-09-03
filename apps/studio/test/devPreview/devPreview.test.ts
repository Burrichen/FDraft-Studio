// @vitest-environment node
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createId, type StudioProjectDocument } from "@fdraft/theme-sdk";
import { unpackFdtheme } from "@fdraft/theme-sdk/packaging";
import { createNodeTestPlatform } from "../helpers/nodePlatform.js";
import { withTempDir } from "../helpers/tempDir.js";
import { createMinimalProjectTemplate, type OpenProject } from "../../src/project/projectFile.js";
import { buildDevPreview, checkFDraftReachable, cleanupDevPreview, devPreviewTempPath } from "../../src/devPreview/devPreview.js";

const OPTIONS = { minRendererVersion: "0.1.0" };

function platformIn(dir: string) {
  return createNodeTestPlatform({ appDataDir: join(dir, "appdata"), appConfigDir: join(dir, "appconfig") });
}

function openProjectFor(project: StudioProjectDocument, assets: Record<string, Uint8Array> = {}): OpenProject {
  return { kind: "file", path: "unused.fdstudio", project, assets, lastSavedAt: undefined };
}

describe("devPreviewTempPath", () => {
  it("lives under appDataDir/dev-preview, keyed by the project's own id", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const path = await devPreviewTempPath(platform, "project-123");
      expect(path).toBe(join(dir, "appdata", "dev-preview", "project-123.fdtheme"));
      expect(await platform.exists(join(dir, "appdata", "dev-preview"))).toBe(true);
    });
  });
});

describe("buildDevPreview", () => {
  it("compiles and writes a real, reopenable .fdtheme for a valid project", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const project = createMinimalProjectTemplate("Dev Preview");
      const result = await buildDevPreview(platform, openProjectFor(project), OPTIONS);
      expect(result.status).toBe("ready");
      const bytes = await platform.readFile(result.tempPath);
      const { document } = await unpackFdtheme(bytes);
      expect(document.manifest.themeName).toBe("Dev Preview");
    });
  });

  it("reports invalid and leaves any previously-built preview file untouched", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const project = createMinimalProjectTemplate("Dev Preview Invalid");
      const good = await buildDevPreview(platform, openProjectFor(project), OPTIONS);
      expect(good.status).toBe("ready");
      const goodBytes = await platform.readFile(good.tempPath);

      const broken: StudioProjectDocument = {
        ...project,
        pages: [
          {
            ...project.pages[0]!,
            layers: [
              { id: createId(), type: "image", name: "broken", assetId: createId(), transform: { x: 0, y: 0, width: 1, height: 1, rotationDeg: 0, scaleX: 1, scaleY: 1 }, opacity: 1, visible: true, locked: false, zIndex: 0, responsive: [], interactionStates: [] },
            ],
          },
        ],
      };
      const result = await buildDevPreview(platform, openProjectFor(broken), OPTIONS);
      expect(result.status).toBe("invalid");
      expect(result.analysis?.blockingErrors.length).toBeGreaterThan(0);

      const stillThere = await platform.readFile(good.tempPath);
      expect(stillThere).toEqual(goodBytes);
    });
  });

  it("rebuilds the same project's preview at the same path on a second call", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const project = createMinimalProjectTemplate("Dev Preview Rebuild");
      const first = await buildDevPreview(platform, openProjectFor(project), OPTIONS);
      const renamed = { ...project, metadata: { ...project.metadata, name: "Renamed" } };
      const second = await buildDevPreview(platform, openProjectFor(renamed), OPTIONS);
      expect(second.tempPath).toBe(first.tempPath);
      const { document } = await unpackFdtheme(await platform.readFile(second.tempPath));
      expect(document.manifest.themeName).toBe("Renamed");
    });
  });
});

describe("cleanupDevPreview", () => {
  it("removes the temp preview file if present, and is a no-op if not", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const project = createMinimalProjectTemplate("Dev Preview Cleanup");
      const result = await buildDevPreview(platform, openProjectFor(project), OPTIONS);
      expect(await platform.exists(result.tempPath)).toBe(true);

      await cleanupDevPreview(platform, project.metadata.id);
      expect(await platform.exists(result.tempPath)).toBe(false);

      await expect(cleanupDevPreview(platform, project.metadata.id)).resolves.not.toThrow();
    });
  });
});

describe("checkFDraftReachable", () => {
  it("is true for any real HTTP response, even a 404", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
    expect(await checkFDraftReachable("http://localhost:3000", fetchImpl)).toBe(true);
  });

  it("is false when the fetch throws (nothing listening)", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    expect(await checkFDraftReachable("http://localhost:3000", fetchImpl)).toBe(false);
  });

  it("passes an AbortSignal that fires after the given timeout", async () => {
    let signalPassed: AbortSignal | undefined;
    const fetchImpl = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      signalPassed = init?.signal ?? undefined;
      return new Promise((_resolve, reject) => {
        signalPassed?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      });
    });
    const reachable = await checkFDraftReachable("http://localhost:3000", fetchImpl, 10);
    expect(reachable).toBe(false);
    expect(signalPassed?.aborted).toBe(true);
  });
});
