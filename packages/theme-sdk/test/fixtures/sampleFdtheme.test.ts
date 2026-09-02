import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { unpackFdtheme } from "../../src/packaging/fdtheme.js";
import { buildSampleProject } from "../helpers/sampleProject.js";
import { compileTheme } from "../../src/compile/compileTheme.js";

const fdthemePath = fileURLToPath(new URL("../../../../fixtures/projects/sample-event.fdtheme", import.meta.url));

describe("committed sample-event.fdtheme fixture", () => {
  it("is a hash-verified, schema-valid compiled theme matching a fresh compile", async () => {
    const bytes = await readFile(fdthemePath);
    const { document } = await unpackFdtheme(new Uint8Array(bytes));

    const { project, assets } = await buildSampleProject();
    const fresh = compileTheme(project, assets, { minRendererVersion: "0.1.0" });

    expect(document.pages).toEqual(fresh.document.pages);
    expect(document.masters).toEqual(fresh.document.masters);
    expect(document.popups).toEqual(fresh.document.popups);
    expect(document.canvas).toEqual({ width: 1920, height: 1080 });
    expect(document.manifest.themeId).toBe(fresh.document.manifest.themeId);
  });
});
