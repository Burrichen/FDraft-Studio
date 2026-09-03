/**
 * Prompt 13 Phase 4 proof: each starter event (Halloween, Christmas,
 * January) renders without crashing across every saved simulator
 * scenario, at mobile/laptop/desktop viewport widths, using the real
 * Simulate-mode derivation functions (`scenarioToLiveState`,
 * `deriveHostSettings`, `deriveRenderState` — the same functions the
 * Simulation panel, Behaviour Mode, and Preview mode all go through, per
 * `simulationState.ts`'s own doc comment) and the real
 * `createStudioComponentAdapterRegistry`/`createStudioCopyContractRegistry`
 * Studio itself uses for live preview.
 *
 * Each event is rebuilt fresh into a temp directory by invoking its real
 * `scripts/build-<event>.ts` driver (no `fdraftRepoPath` — this test
 * never touches the FDraft checkout), so this test has no dependency on
 * any previously-produced scratch output.
 */
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import type { AssetResolver } from "@fdraft/theme-renderer";
import { unpackFdstudio, unpackFdtheme } from "@fdraft/theme-sdk/packaging";
import { ThemeRenderer } from "@fdraft/theme-renderer";
import { createStudioComponentAdapterRegistry, createStudioCopyContractRegistry } from "../../src/componentAdapters/studioAdapters.js";
import { scenarioToLiveState, deriveHostSettings, deriveRenderState } from "../../src/simulation/simulationState.js";

const execFileAsync = promisify(execFile);
const STUDIO_ROOT = join(import.meta.dirname, "../..");

const VIEWPORTS = [
  { name: "mobile", widthPx: 390 },
  { name: "laptop", widthPx: 1366 },
  { name: "desktop", widthPx: 1920 },
];

const EVENTS = ["halloween", "christmas", "january"] as const;

let workDir: string;
const builtSlugs: Record<(typeof EVENTS)[number], { fdstudioPath: string; fdthemePath: string }> = {} as never;

beforeAll(async () => {
  workDir = await mkdtemp(join(tmpdir(), "fdraft-starter-events-"));
  for (const slug of EVENTS) {
    const eventWorkDir = join(workDir, slug);
    await mkdir(eventWorkDir, { recursive: true });
    await execFileAsync("node_modules/.bin/tsx", [`scripts/build-${slug}.ts`, eventWorkDir], { cwd: STUDIO_ROOT });
    builtSlugs[slug] = { fdstudioPath: join(eventWorkDir, `${slug}.fdstudio`), fdthemePath: join(eventWorkDir, `${slug}.fdtheme`) };
  }
}, 120_000);

afterAll(async () => {
  if (workDir) await rm(workDir, { recursive: true, force: true });
});

describe.each(EVENTS)("starter event: %s", (slug) => {
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
});
