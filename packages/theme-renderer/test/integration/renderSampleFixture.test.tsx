import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { validateProject, compileTheme, isRendererCompatible, type AssetResolver } from "@fdraft/theme-sdk";
import { readUnpackedProject } from "@fdraft/theme-sdk/node";
import { unpackFdtheme } from "@fdraft/theme-sdk/packaging";
import { ThemeRenderer } from "../../src/ThemeRenderer.js";
import { createSampleComponentAdapterRegistry } from "../../src/componentAdapters/registry.js";

// `import.meta.url` is unreliable to resolve repo-relative paths from
// under vitest's jsdom environment (it doesn't consistently report a
// `file:` URL there) — vitest's cwd is this package's root either way, so
// resolve from `process.cwd()` instead.
const fixturesRoot = join(process.cwd(), "../../fixtures");
const projectDir = join(fixturesRoot, "projects/sample-event");
const fdthemePath = join(fixturesRoot, "projects/sample-event.fdtheme");

const RENDERER_VERSION = "0.1.0";

describe("renderer + fixture lab integration: sample-event", () => {
  it("loads the unpacked project fixture, validates it, and renders it end to end with mock component data", async () => {
    // 1. Load exactly the way any real host would — via the public SDK.
    const { project, assets } = await readUnpackedProject(projectDir);

    // 2. Compatibility preflight before ever touching the renderer.
    const validation = validateProject(project);
    expect(validation.valid).toBe(true);

    const bundle = compileTheme(project, assets, { minRendererVersion: RENDERER_VERSION });
    expect(isRendererCompatible(bundle.document.manifest.minRendererVersion, RENDERER_VERSION)).toBe(true);

    // 3. A closed asset resolver: only ids present in the compiled document's own `assets` array resolve to anything.
    const resolver: AssetResolver = {
      resolveAsset: (assetId) => {
        const record = bundle.document.assets.find((a) => a.id === assetId);
        return record ? `mock://asset/${record.id}` : undefined;
      },
    };

    const page = bundle.document.pages[0]!;
    const { getByText, container } = render(
      <ThemeRenderer
        document={bundle.document}
        assetResolver={resolver}
        componentAdapters={createSampleComponentAdapterRegistry()}
        target={{ kind: "page", pageId: page.id }}
      />,
    );

    // The theme's own text layer renders as real text.
    expect(getByText("Welcome to the event!")).toBeInTheDocument();

    // The image layer resolved through the injected resolver.
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toMatch(/^mock:\/\/asset\//);

    // The fixture's "opt-in-button" component isn't in the sample registry
    // (deliberately — see componentAdapters/sampleAdapters.tsx) so this
    // proves the real missing-component compatibility path against real
    // fixture data, not a synthetic one.
    const missing = container.querySelector('[data-fdraft-error="missing-component"]');
    expect(missing?.getAttribute("data-fdraft-component-key")).toBe("opt-in-button");

    // No rendering failures anywhere in the tree.
    expect(container.querySelector('[data-fdraft-error="theme-render-failed"]')).toBeNull();
    expect(container.querySelector('[data-fdraft-error="layer-render-failed"]')).toBeNull();
  });

  it("renders the compiled .fdtheme binary fixture to the same page structure as compiling the project fresh", async () => {
    const fdthemeBytes = new Uint8Array(await readFile(fdthemePath));
    const { document: fromArchive } = await unpackFdtheme(fdthemeBytes);

    const { project, assets } = await readUnpackedProject(projectDir);
    const fromSource = compileTheme(project, assets, { minRendererVersion: RENDERER_VERSION }).document;

    expect(fromArchive.pages).toEqual(fromSource.pages);
    expect(fromArchive.masters).toEqual(fromSource.masters);

    const resolver: AssetResolver = { resolveAsset: (id) => `mock://asset/${id}` };
    const { container } = render(
      <ThemeRenderer
        document={fromArchive}
        assetResolver={resolver}
        componentAdapters={createSampleComponentAdapterRegistry()}
        target={{ kind: "page", pageId: fromArchive.pages[0]!.id }}
      />,
    );
    expect(container.querySelector('[data-fdraft-stage="true"]')).toBeTruthy();
  });

  it("renders the popup independently of the page (page/popup switching needs no shared mutable state)", async () => {
    const { project, assets } = await readUnpackedProject(projectDir);
    const bundle = compileTheme(project, assets, { minRendererVersion: RENDERER_VERSION });
    const popup = bundle.document.popups[0]!;
    const resolver: AssetResolver = { resolveAsset: (id) => `mock://asset/${id}` };

    const { getByText } = render(
      <ThemeRenderer
        document={bundle.document}
        assetResolver={resolver}
        componentAdapters={createSampleComponentAdapterRegistry()}
        target={{ kind: "popup", popupId: popup.id }}
      />,
    );
    expect(getByText("Don't miss this year's event!")).toBeInTheDocument();
  });
});
