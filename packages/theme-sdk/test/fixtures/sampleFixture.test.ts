import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { readUnpackedProject } from "../../src/packaging/nodeFs.js";
import { buildSampleProject } from "../helpers/sampleProject.js";

const fixtureDir = fileURLToPath(new URL("../../../../fixtures/projects/sample-event", import.meta.url));

describe("committed sample-event fixture", () => {
  it("matches what scripts/write-sample-fixture.ts would (re)generate", async () => {
    const onDisk = await readUnpackedProject(fixtureDir);
    const builder = await buildSampleProject();

    expect(onDisk.project).toEqual(builder.project);
    expect(onDisk.migrationsApplied).toEqual([]);
    for (const path of Object.keys(builder.assets)) {
      expect(onDisk.assets[path]).toEqual(builder.assets[path]);
    }
  });
});
