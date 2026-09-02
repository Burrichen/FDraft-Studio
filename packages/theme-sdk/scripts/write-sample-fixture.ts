/**
 * Materialises the hand-authored sample project (see
 * test/helpers/sampleProject.ts) as an unpacked, Git-diffable directory at
 * the repo-root `fixtures/projects/sample-event/`. Re-run this whenever
 * the sample project's structure changes; the output is deterministic.
 */
import { fileURLToPath } from "node:url";
import { buildSampleProject } from "../test/helpers/sampleProject.js";
import { writeUnpackedProject } from "../src/packaging/nodeFs.js";

const outputDir = fileURLToPath(new URL("../../../fixtures/projects/sample-event", import.meta.url));

async function main(): Promise<void> {
  const { project, assets } = await buildSampleProject();
  await writeUnpackedProject(outputDir, { project, assets, sdkVersion: "0.1.0" });
  console.log(`Wrote sample project fixture to ${outputDir}`);
}

main();
