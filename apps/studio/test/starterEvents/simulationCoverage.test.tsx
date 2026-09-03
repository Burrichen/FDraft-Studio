/**
 * Permanent proof that all three official starter events (Halloween,
 * Christmas, "F* You, It's January!") compile, publish, and render
 * successfully — updated for the real closure of FDraft's compatibility
 * gap (FDraft commit `006035c`: all 14 default-template component keys
 * plus `behaviour`/`effects`). A blocked publish is now a TEST FAILURE,
 * not an accepted/documented outcome — see docs/IMPLEMENTATION_STATUS.md
 * row 15 for the dogfooding pass this test file was updated alongside.
 *
 * Publish is proven against a SYNTHETIC, real-shaped FDraft repo fixture
 * (mirroring `test/publish/publishToFDraft.test.ts`'s own established
 * convention) rather than the real sibling `../FDraft` checkout, so this
 * test is hermetic and portable to CI — it never depends on or mutates a
 * real sibling repository. The fixture's `compatibility.ts`/
 * `installed-versions.generated.ts` content is a byte-for-byte copy of
 * FDraft's real, currently-committed contract (copied by hand at the time
 * this test was written — see the header comment on
 * `FDRAFT_REAL_SHAPED_COMPATIBILITY` below for how to keep it in sync).
 *
 * Each event is rebuilt fresh into a temp directory by invoking its real
 * `scripts/build-<event>.ts` driver — never a hand-rolled fixture.
 */
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import type { AssetResolver, HostSettings } from "@fdraft/theme-renderer";
import { unpackFdstudio, unpackFdtheme } from "@fdraft/theme-sdk/packaging";
import { ThemeRenderer, resolveActiveBehaviourRules } from "@fdraft/theme-renderer";
import { createStudioComponentAdapterRegistry, createStudioCopyContractRegistry } from "../../src/componentAdapters/studioAdapters.js";
import { scenarioToLiveState, deriveHostSettings, deriveRenderState } from "../../src/simulation/simulationState.js";
import { createNodeTestPlatform } from "../helpers/nodePlatform.js";

const execFileAsync = promisify(execFile);
const STUDIO_ROOT = join(import.meta.dirname, "../..");

// pnpm's Windows .bin shims (tsx.CMD/tsx.ps1) aren't directly spawnable by
// execFile's default no-shell CreateProcess call the way the POSIX
// extensionless `tsx` shim is — resolving tsx's own real entry point and
// running it through the current Node binary works identically on every
// platform, with no shell/PATHEXT involved (also sidesteps any shell-
// quoting risk for a work directory path that happens to contain spaces).
const tsxCliPath = join(dirname(createRequire(import.meta.url).resolve("tsx/package.json")), "dist/cli.mjs");

const VIEWPORTS = [
  { name: "mobile", widthPx: 390 },
  { name: "laptop", widthPx: 1366 },
  { name: "desktop", widthPx: 1920 },
];

const PERFORMANCE_TIERS: HostSettings["performanceTier"][] = ["low", "medium", "high"];

const EVENTS = ["halloween", "christmas", "january"] as const;

/**
 * Byte-for-byte the real content of FDraft's own
 * `src/infrastructure/theme-runtime/installed-versions.generated.ts` and
 * `compatibility.ts` as of commit `006035c` (feature/fdraft-theme-runtime)
 * — all 14 default-template component keys plus `event-progress`, and
 * `behaviour`/`effects` alongside `responsive`/`masters`/`popups`. If
 * FDraft's real contract changes again, update this to match — the point
 * of this fixture is to prove Studio's real publish plumbing against
 * FDraft's REAL shape, not an aspirational one.
 */
const FDRAFT_REAL_SHAPED_VERSIONS = `export const INSTALLED_THEME_SDK_VERSION = "0.1.0";\nexport const INSTALLED_THEME_RENDERER_VERSION = "0.1.0";\n`;
const FDRAFT_REAL_SHAPED_COMPATIBILITY = `export const FDRAFT_SUPPORTED_COMPONENT_KEYS = [
  "page-title",
  "event-information",
  "event-countdown",
  "draft-controls",
  "film-grid",
  "event-progress",
  "points-counter",
  "generate-draft-action",
  "profile-badge",
  "event-navigation",
  "draft-progress",
  "complete-watch-action",
  "challenge-card",
  "results-completion-content",
  "event-points-counter",
] as const;

export const FDRAFT_SUPPORTED_CAPABILITIES = [
  "responsive",
  "masters",
  "popups",
  "behaviour",
  "effects",
] as const;
`;

async function buildFdraftFixtureRepo(dir: string): Promise<string> {
  const platform = createNodeTestPlatform({ appDataDir: join(dir, "appdata"), appConfigDir: join(dir, "appconfig") });
  const repo = join(dir, "FDraft");
  const runtimeDir = join(repo, "src", "infrastructure", "theme-runtime");
  await platform.mkdir(runtimeDir);
  await platform.writeTextFile(join(repo, "package.json"), JSON.stringify({ name: "fdraft", dependencies: { "@fdraft/theme-sdk": "https://example.com/x.tgz" } }));
  await platform.writeTextFile(join(runtimeDir, "installed-versions.generated.ts"), FDRAFT_REAL_SHAPED_VERSIONS);
  await platform.writeTextFile(join(runtimeDir, "compatibility.ts"), FDRAFT_REAL_SHAPED_COMPATIBILITY);
  return repo;
}

interface BuiltEvent {
  fdstudioPath: string;
  fdthemePath: string;
  publishStdout: string;
}

let workDir: string;
let fdraftFixtureRepo: string;
const builtSlugs: Record<(typeof EVENTS)[number], BuiltEvent> = {} as never;

beforeAll(async () => {
  workDir = await mkdtemp(join(tmpdir(), "fdraft-starter-events-"));
  fdraftFixtureRepo = await buildFdraftFixtureRepo(workDir);
  for (const slug of EVENTS) {
    const eventWorkDir = join(workDir, slug);
    await mkdir(eventWorkDir, { recursive: true });
    const { stdout } = await execFileAsync(process.execPath, [tsxCliPath, `scripts/build-${slug}.ts`, eventWorkDir, fdraftFixtureRepo], { cwd: STUDIO_ROOT });
    builtSlugs[slug] = { fdstudioPath: join(eventWorkDir, `${slug}.fdstudio`), fdthemePath: join(eventWorkDir, `${slug}.fdtheme`), publishStdout: stdout };
  }
}, 120_000);

afterAll(async () => {
  if (workDir) await rm(workDir, { recursive: true, force: true });
});

describe.each(EVENTS)("starter event: %s", (slug) => {
  it("compiles a valid project and PUBLISHES successfully against FDraft's real, current compatibility contract — a block is a test failure", () => {
    const { publishStdout } = builtSlugs[slug];
    expect(publishStdout, `${slug} publish output`).toMatch(/valid=true/);
    expect(publishStdout, `${slug} must publish, not be blocked`).toMatch(/PUBLISHED/);
    expect(publishStdout, `${slug} must not report a compatibility block`).not.toMatch(/BLOCKED/);
  });

  it("renders every saved simulator scenario at every viewport width without a render failure", async () => {
    const { fdstudioPath, fdthemePath } = builtSlugs[slug];
    const { project } = await unpackFdstudio(await readFile(fdstudioPath));
    const { document } = await unpackFdtheme(await readFile(fdthemePath));

    expect(project.simulationScenarios.length).toBeGreaterThan(0);
    const page = document.pages[0]!;

    const resolver: AssetResolver = {
      resolveAsset: (assetId) => {
        const record = document.assets.find((a) => a.id === assetId);
        return record ? `mock://asset/${record.id}` : undefined;
      },
    };
    const componentAdapters = createStudioComponentAdapterRegistry();
    const copyContracts = createStudioCopyContractRegistry();

    let combosRendered = 0;
    for (const scenario of project.simulationScenarios) {
      const liveState = scenarioToLiveState(scenario);
      const hostSettings = deriveHostSettings(liveState);
      const renderState = deriveRenderState(liveState, {});

      for (const viewport of VIEWPORTS) {
        const { container, unmount } = render(
          <ThemeRenderer
            document={document}
            assetResolver={resolver}
            componentAdapters={componentAdapters}
            copyContracts={copyContracts}
            target={{ kind: "page", pageId: page.id }}
            hostSettings={hostSettings}
            renderState={renderState}
            viewportWidthPx={viewport.widthPx}
          />,
        );

        expect(container.querySelector('[data-fdraft-error="theme-render-failed"]'), `${slug}/${scenario.name}/${viewport.name}: theme-render-failed`).toBeNull();
        expect(container.querySelector('[data-fdraft-error="layer-render-failed"]'), `${slug}/${scenario.name}/${viewport.name}: layer-render-failed`).toBeNull();
        combosRendered += 1;
        unmount();
      }
    }

    expect(combosRendered).toBe(project.simulationScenarios.length * VIEWPORTS.length);
  });

  it("renders without failure across every performance tier and both reduced-motion states, independent of any one saved scenario", async () => {
    const { fdstudioPath, fdthemePath } = builtSlugs[slug];
    const { project } = await unpackFdstudio(await readFile(fdstudioPath));
    const { document } = await unpackFdtheme(await readFile(fdthemePath));
    const page = document.pages[0]!;
    const baseScenario = project.simulationScenarios[0]!;

    const resolver: AssetResolver = {
      resolveAsset: (assetId) => {
        const record = document.assets.find((a) => a.id === assetId);
        return record ? `mock://asset/${record.id}` : undefined;
      },
    };
    const componentAdapters = createStudioComponentAdapterRegistry();
    const copyContracts = createStudioCopyContractRegistry();
    const liveState = scenarioToLiveState(baseScenario);
    const renderState = deriveRenderState(liveState, {});

    for (const performanceTier of PERFORMANCE_TIERS) {
      for (const reducedMotion of [false, true]) {
        const { container, unmount } = render(
          <ThemeRenderer
            document={document}
            assetResolver={resolver}
            componentAdapters={componentAdapters}
            copyContracts={copyContracts}
            target={{ kind: "page", pageId: page.id }}
            hostSettings={{ performanceTier, reducedMotion }}
            renderState={renderState}
          />,
        );
        expect(container.querySelector('[data-fdraft-error="theme-render-failed"]'), `${slug}/${performanceTier}/reducedMotion=${reducedMotion}`).toBeNull();
        expect(container.querySelector('[data-fdraft-error="layer-render-failed"]'), `${slug}/${performanceTier}/reducedMotion=${reducedMotion}`).toBeNull();
        unmount();
      }
    }
  });
});

describe("Halloween Candy Bowl — exact Behaviour Rule progress boundaries", () => {
  it("all four rules resolve to the exact intended image state at every documented boundary", async () => {
    const { fdthemePath } = builtSlugs.halloween;
    const { document } = await unpackFdtheme(await readFile(fdthemePath));
    const group = document.imageStateGroups.find((g) => g.name === "Candy Bowl");
    expect(group, "Candy Bowl image-state group must exist").toBeDefined();
    const stateIdByName = new Map(group!.states.map((s) => [s.name, s.id]));
    expect(document.behaviourRules?.length, "Candy Bowl must be driven by real Behaviour rules").toBe(4);

    const hostSettings: HostSettings = { performanceTier: "high", reducedMotion: false };
    const boundaries: [number, string][] = [
      [0, "Empty"],
      [24, "Empty"],
      [25, "Low"],
      [49, "Low"],
      [50, "Medium"],
      [74, "Medium"],
      [75, "Full"],
      [100, "Full"],
    ];

    for (const [progressPercent, expectedState] of boundaries) {
      const resolution = resolveActiveBehaviourRules(
        document.behaviourRules!,
        { activeImageStates: {}, event: { progressPercent } },
        hostSettings,
      );
      expect(resolution.imageStateOverrides[group!.id], `progressPercent=${progressPercent} should read ${expectedState}`).toBe(stateIdByName.get(expectedState));
    }
  });
});

describe("January effects — rain, clouds, and fog are real, declared effect layers", () => {
  it("all three effect kinds are present on the Event Landing page, each rendering without failure across performance tiers and reduced motion", async () => {
    const { fdthemePath } = builtSlugs.january;
    const { document } = await unpackFdtheme(await readFile(fdthemePath));
    const landing = document.pages.find((p) => p.name === "Event Landing")!;
    const effectLayers = landing.layers.filter((l) => l.type === "effect");
    const kinds = effectLayers.map((l) => (l as { effect: { kind: string } }).effect.kind).sort();
    expect(kinds).toEqual(["clouds", "fog", "rain"]);

    const resolver: AssetResolver = { resolveAsset: () => undefined };
    const componentAdapters = createStudioComponentAdapterRegistry();
    const copyContracts = createStudioCopyContractRegistry();
    const { project } = await unpackFdstudio(await readFile(builtSlugs.january.fdstudioPath));
    const renderState = deriveRenderState(scenarioToLiveState(project.simulationScenarios[0]!), {});

    for (const performanceTier of PERFORMANCE_TIERS) {
      for (const reducedMotion of [false, true]) {
        const { container, unmount } = render(
          <ThemeRenderer
            document={document}
            assetResolver={resolver}
            componentAdapters={componentAdapters}
            copyContracts={copyContracts}
            target={{ kind: "page", pageId: landing.id }}
            hostSettings={{ performanceTier, reducedMotion }}
            renderState={renderState}
          />,
        );
        expect(container.querySelector('[data-fdraft-error="theme-render-failed"]'), `january effects/${performanceTier}/reducedMotion=${reducedMotion}`).toBeNull();
        unmount();
      }
    }
  });

  it("keeps the labelled missing-art placeholder for scattered rubbish until real artwork is supplied", async () => {
    const { fdthemePath } = builtSlugs.january;
    const { document } = await unpackFdtheme(await readFile(fdthemePath));
    const landing = document.pages.find((p) => p.name === "Event Landing")!;
    const placeholder = landing.layers.find((l) => l.name.includes("MISSING ART") && l.name.includes("rubbish"));
    expect(placeholder, "the honest missing-art placeholder must still exist, not be silently dropped or replaced with invented art").toBeDefined();
  });
});

describe("Christmas — migrated off the temporary 7-key structure, same visual intent preserved", () => {
  it("now places all 14 default-template component keys, not the reduced 7-key set", async () => {
    const { fdthemePath } = builtSlugs.christmas;
    const { document } = await unpackFdtheme(await readFile(fdthemePath));
    const placedKeys = new Set<string>();
    for (const container of [...document.pages, ...document.popups]) {
      for (const layer of container.layers) {
        if (layer.type === "component") placedKeys.add(layer.componentKey);
      }
    }
    for (const key of [
      "generate-draft-action",
      "profile-badge",
      "event-navigation",
      "draft-progress",
      "complete-watch-action",
      "challenge-card",
      "results-completion-content",
      "event-points-counter",
    ]) {
      expect(placedKeys.has(key), `Christmas must now place "${key}" — the temporary 7-key workaround is gone`).toBe(true);
    }
  });

  it("still shows its real decorative Christmas artwork on Event Landing, unchanged", async () => {
    const { fdthemePath } = builtSlugs.christmas;
    const { document } = await unpackFdtheme(await readFile(fdthemePath));
    const landing = document.pages.find((p) => p.name === "Event Landing")!;
    const decorativeNames = landing.layers.filter((l) => l.type === "image").map((l) => l.name).sort();
    expect(decorativeNames).toEqual(["Candy Canes", "Fairy Lights", "Presents", "Snowman", "Stocking", "Tree"]);
  });
});
