// @vitest-environment node
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createId, type StudioProjectDocument } from "@fdraft/theme-sdk";
import { unpackFdtheme } from "@fdraft/theme-sdk/packaging";
import { createNodeTestPlatform } from "../helpers/nodePlatform.js";
import { withTempDir } from "../helpers/tempDir.js";
import { createMinimalProjectTemplate, type OpenProject } from "../../src/project/projectFile.js";
import { executePublish, planPublish } from "../../src/publish/publishToFDraft.js";
import { rollbackLastPublish } from "../../src/publish/publishDirectorySwap.js";

const REAL_SHAPED_VERSIONS_FILE = `export const INSTALLED_THEME_SDK_VERSION = "0.1.0";\nexport const INSTALLED_THEME_RENDERER_VERSION = "0.1.0";\n`;
const REAL_SHAPED_COMPATIBILITY_FILE = `export const FDRAFT_SUPPORTED_COMPONENT_KEYS = [\n  "page-title", "points-counter",\n] as const;\n\nexport const FDRAFT_SUPPORTED_CAPABILITIES = [\n  "responsive", "masters", "popups",\n] as const;\n`;

function platformIn(dir: string) {
  return createNodeTestPlatform({ appDataDir: join(dir, "appdata"), appConfigDir: join(dir, "appconfig") });
}

async function fdraftRepo(platform: ReturnType<typeof platformIn>, dir: string, withIntegration = true): Promise<string> {
  const repo = join(dir, "FDraft");
  await platform.mkdir(join(repo, "src", "app"));
  await platform.writeTextFile(join(repo, "package.json"), JSON.stringify({ name: "fdraft", dependencies: { "@fdraft/theme-sdk": "https://example.com/x.tgz" } }));
  if (withIntegration) {
    const runtimeDir = join(repo, "src", "infrastructure", "theme-runtime");
    await platform.mkdir(runtimeDir);
    await platform.writeTextFile(join(runtimeDir, "installed-versions.generated.ts"), REAL_SHAPED_VERSIONS_FILE);
    await platform.writeTextFile(join(runtimeDir, "compatibility.ts"), REAL_SHAPED_COMPATIBILITY_FILE);
  }
  return repo;
}

function openProjectFor(project: StudioProjectDocument, assets: Record<string, Uint8Array> = {}): OpenProject {
  return { kind: "file", path: "/Users/dev/Documents/event.fdstudio", project, assets, lastSavedAt: undefined };
}

describe("planPublish", () => {
  it("plans a clean first publish for a compatible project with no blockers", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const repo = await fdraftRepo(platform, dir);
      const project = createMinimalProjectTemplate("My Halloween Event");

      const plan = await planPublish(platform, repo, openProjectFor(project));

      expect(plan.blocked).toEqual([]);
      expect(plan.slug).toBe("my-halloween-event");
      expect(plan.sourceDir).toBe(join(repo, "theme-projects", "my-halloween-event"));
      expect(plan.packDir).toBe(join(repo, "src", "theme-packs", "my-halloween-event"));
      expect(plan.sourceDiff).toEqual([{ path: "project.json", kind: "added" }]);
      expect(plan.packDiff).toEqual([{ path: "theme.fdtheme", kind: "added" }]);
      expect(plan.slugCollision).toBeUndefined();
    });
  });

  it("blocks with compatibilityUnavailable when FDraft's integration files are missing", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const repo = await fdraftRepo(platform, dir, false);
      const project = createMinimalProjectTemplate("Event");

      const plan = await planPublish(platform, repo, openProjectFor(project));

      expect(plan.blocked).toEqual([{ kind: "compatibilityUnavailable", detail: expect.stringContaining("installed-versions.generated.ts") }]);
    });
  });

  it("blocks with incompatible when the project uses a capability FDraft doesn't support", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const repo = await fdraftRepo(platform, dir);
      const project = createMinimalProjectTemplate("Animated Event");
      const layerId = createId();
      project.pages[0]!.layers = [{ id: layerId, type: "shape", name: "Box", shape: "rect", transform: { x: 0, y: 0, width: 100, height: 100, rotationDeg: 0, scaleX: 1, scaleY: 1 }, opacity: 1, visible: true, locked: false, zIndex: 0, responsive: [], interactionStates: [] }];
      project.pages[0]!.animations = [{ id: createId(), name: "Fade in", trigger: "onEnter", targetLayerId: layerId, motion: { type: "preset", preset: "fade" }, durationMs: 500, delayMs: 0, easing: "linear", loop: false, direction: "normal", intensity: 1 }];

      const plan = await planPublish(platform, repo, openProjectFor(project));

      expect(plan.blocked).toHaveLength(1);
      expect(plan.blocked[0]).toMatchObject({ kind: "incompatible" });
      if (plan.blocked[0]!.kind === "incompatible") {
        expect(plan.blocked[0]!.check.reasons[0]).toContain("animations");
      }
    });
  });

  it("blocks with validation when the project itself doesn't validate", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const repo = await fdraftRepo(platform, dir);
      const project = createMinimalProjectTemplate("Broken Event");
      project.pages[0]!.layers = [{ id: createId(), type: "image", name: "broken", assetId: createId(), transform: { x: 0, y: 0, width: 1, height: 1, rotationDeg: 0, scaleX: 1, scaleY: 1 }, opacity: 1, visible: true, locked: false, zIndex: 0, responsive: [], interactionStates: [] }];

      const plan = await planPublish(platform, repo, openProjectFor(project));

      expect(plan.blocked.some((b) => b.kind === "validation")).toBe(true);
    });
  });

  it("blocks with pathTooLong when the resulting slug would produce a path too long for Windows", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const repo = await fdraftRepo(platform, dir);
      const project = createMinimalProjectTemplate("x".repeat(300));

      const plan = await planPublish(platform, repo, openProjectFor(project));

      const pathTooLong = plan.blocked.find((b) => b.kind === "pathTooLong");
      expect(pathTooLong).toBeDefined();
    });
  });

  it("detects a slug collision with a different project and blocks it", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const repo = await fdraftRepo(platform, dir);
      const other = createMinimalProjectTemplate("Shared Slug");
      await platform.mkdir(join(repo, "theme-projects", "shared-slug"));
      await platform.writeTextFile(join(repo, "theme-projects", "shared-slug", "project.json"), JSON.stringify(other, null, 2));

      const mine = createMinimalProjectTemplate("Shared Slug");
      const plan = await planPublish(platform, repo, openProjectFor(mine));

      expect(plan.blocked.some((b) => b.kind === "slugCollision")).toBe(true);
    });
  });

  it("does not flag a collision when re-publishing the same project (same metadata.id)", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const repo = await fdraftRepo(platform, dir);
      const project = createMinimalProjectTemplate("My Event");
      await platform.mkdir(join(repo, "theme-projects", "my-event"));
      await platform.writeTextFile(join(repo, "theme-projects", "my-event", "project.json"), JSON.stringify(project, null, 2));

      const plan = await planPublish(platform, repo, openProjectFor(project));

      expect(plan.slugCollision).toBeUndefined();
      expect(plan.blocked).toEqual([]);
    });
  });

  it("computes an empty sourceDiff (nothing to change) when nothing has actually changed", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const repo = await fdraftRepo(platform, dir);
      const project = createMinimalProjectTemplate("Stable Event");
      await platform.mkdir(join(repo, "theme-projects", "stable-event"));
      await platform.writeTextFile(join(repo, "theme-projects", "stable-event", "project.json"), JSON.stringify(project, null, 2));

      const plan = await planPublish(platform, repo, openProjectFor(project));

      expect(plan.sourceDiff).toEqual([]);
    });
  });
});

describe("executePublish", () => {
  it("writes a real, loadable .fdtheme and the readable project.json source", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const repo = await fdraftRepo(platform, dir);
      const project = createMinimalProjectTemplate("Publish Me");
      const plan = await planPublish(platform, repo, openProjectFor(project));

      const result = await executePublish(platform, repo, plan);

      expect(result.sourceWritten).toBe(true);
      expect(result.packWritten).toBe(true);
      expect(result.changedPaths).toEqual([join("theme-projects", "publish-me"), join("src", "theme-packs", "publish-me")]);

      const sourceJson = JSON.parse(await platform.readTextFile(join(repo, "theme-projects", "publish-me", "project.json"))) as { metadata: { name: string } };
      expect(sourceJson.metadata.name).toBe("Publish Me");

      const themeBytes = await platform.readFile(join(repo, "src", "theme-packs", "publish-me", "theme.fdtheme"));
      const { document } = await unpackFdtheme(themeBytes);
      expect(document.manifest.themeName).toBe("Publish Me");
    });
  });

  it("skips the source write when the project already lives at the canonical path", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const repo = await fdraftRepo(platform, dir);
      const project = createMinimalProjectTemplate("Canonical Event");
      const canonicalPath = join(repo, "theme-projects", "canonical-event", "project.json");
      const open: OpenProject = { kind: "file", path: canonicalPath, project, assets: {}, lastSavedAt: undefined };

      const plan = await planPublish(platform, repo, open);
      expect(plan.sourceIsAlreadyCanonical).toBe(true);

      const result = await executePublish(platform, repo, plan);
      expect(result.sourceWritten).toBe(false);
      expect(result.packWritten).toBe(true);
    });
  });

  it("preserves an unrelated file already in theme-projects/ and src/theme-packs/", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const repo = await fdraftRepo(platform, dir);
      await platform.mkdir(join(repo, "theme-projects"));
      await platform.writeTextFile(join(repo, "theme-projects", "README.md"), "unrelated readme");
      await platform.mkdir(join(repo, "theme-projects", "other-event"));
      await platform.writeTextFile(join(repo, "theme-projects", "other-event", "project.json"), "{}");

      const project = createMinimalProjectTemplate("New Event");
      const plan = await planPublish(platform, repo, openProjectFor(project));
      await executePublish(platform, repo, plan);

      expect(await platform.readTextFile(join(repo, "theme-projects", "README.md"))).toBe("unrelated readme");
      expect(await platform.exists(join(repo, "theme-projects", "other-event", "project.json"))).toBe(true);
    });
  });

  it("keeps a recoverable backup and rollbackLastPublish restores the previous published version", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const repo = await fdraftRepo(platform, dir);
      const project = createMinimalProjectTemplate("Rollback Event");

      const firstPlan = await planPublish(platform, repo, openProjectFor(project));
      await executePublish(platform, repo, firstPlan);

      // Same slug (name unchanged) but a different canvas size, so the compiled bytes genuinely differ.
      const edited = { ...project, canvas: { width: 1080, height: 1920 } };
      const secondPlan = await planPublish(platform, repo, openProjectFor(edited));
      const secondResult = await executePublish(platform, repo, secondPlan);
      expect(secondResult.packHadPrevious).toBe(true);

      const packDir = join(repo, "src", "theme-packs", "rollback-event");
      const rolledBack = await rollbackLastPublish(platform, packDir);
      expect(rolledBack).toBe(true);

      const { document } = await unpackFdtheme(await platform.readFile(join(packDir, "theme.fdtheme")));
      expect(document.canvas).toEqual({ width: 1920, height: 1080 });
    });
  });

  it("buildGitCommandsHint never runs git — it only produces text mentioning the changed paths", async () => {
    await withTempDir(async (dir) => {
      const platform = platformIn(dir);
      const repo = await fdraftRepo(platform, dir);
      const project = createMinimalProjectTemplate("Git Hint Event");
      const plan = await planPublish(platform, repo, openProjectFor(project));
      const result = await executePublish(platform, repo, plan);

      expect(result.gitCommandsHint).toContain("git status");
      expect(result.gitCommandsHint).toContain("git add");
      expect(result.gitCommandsHint).toContain("theme-projects");
      expect(result.gitCommandsHint).not.toContain("push");
    });
  });
});
