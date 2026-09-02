import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { validateProject } from "../../src/validation/validateProject.js";

const fixturesRoot = new URL("../../../../fixtures/invalid/", import.meta.url);

async function readFixtureJson(fileName: string): Promise<unknown> {
  return JSON.parse(await readFile(new URL(fileName, fixturesRoot), "utf8"));
}

describe("semantic validation", () => {
  it("flags a duplicate id", async () => {
    const result = validateProject(await readFixtureJson("duplicate-ids.project.json"));
    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "DUPLICATE_ID" }));
  });

  it("flags a broken (dangling) reference", async () => {
    const result = validateProject(await readFixtureJson("broken-reference.project.json"));
    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "BROKEN_REFERENCE", path: "pages[0].layers[0].assetId" }),
    );
  });

  it("flags a circular master inheritance chain", async () => {
    const result = validateProject(await readFixtureJson("circular-master.project.json"));
    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "CIRCULAR_MASTER" }));
  });
});
