/**
 * Compiles the hand-authored sample project into a real `.fdtheme` binary
 * and commits it at `fixtures/projects/sample-event.fdtheme` — a
 * renderer-parity fixture (see fixtures/README.md) that proves the
 * renderer can load an actually-compiled, hash-verified package rather
 * than a project the renderer's own host happens to compile on the fly.
 * Re-run whenever the sample project changes.
 */
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { buildSampleProject } from "../test/helpers/sampleProject.js";
import { compileTheme } from "../src/compile/compileTheme.js";
import { packFdtheme } from "../src/packaging/fdtheme.js";

const outputPath = fileURLToPath(new URL("../../../fixtures/projects/sample-event.fdtheme", import.meta.url));

async function main(): Promise<void> {
  const { project, assets } = await buildSampleProject();
  const bundle = compileTheme(project, assets, { minRendererVersion: "0.1.0" });
  const archive = await packFdtheme(bundle);
  await writeFile(outputPath, archive);
  console.log(`Wrote ${outputPath} (${archive.byteLength} bytes)`);
}

main();
