import { describe, expect, it } from "vitest";
import { buildSampleProject } from "../helpers/sampleProject.js";
import { validateProject } from "../../src/validation/validateProject.js";
import { StudioProjectDocumentSchema } from "../../src/schema/project.js";

describe("sample project fixture", () => {
  it("is schema-valid and semantically sound", async () => {
    const { project } = await buildSampleProject();
    const result = validateProject(project);
    expect(result.issues).toEqual([]);
    expect(result.valid).toBe(true);
    expect(result.document).toBeDefined();
  });

  it("round-trips through JSON without loss", async () => {
    const { project } = await buildSampleProject();
    const roundTripped = StudioProjectDocumentSchema.parse(JSON.parse(JSON.stringify(project)));
    expect(roundTripped).toEqual(project);
  });

  it("exercises every required data-model area", async () => {
    const { project } = await buildSampleProject();
    expect(project.masters).toHaveLength(1);
    expect(project.pages).toHaveLength(1);
    expect(project.popups).toHaveLength(1);
    expect(project.imageStateGroups).toHaveLength(1);
    expect(project.componentRequirements).toHaveLength(1);

    const page = project.pages[0]!;
    expect(page.animations).toHaveLength(1);
    expect(page.layers.some((l) => l.type === "image")).toBe(true);
    expect(page.layers.some((l) => l.type === "text")).toBe(true);
    expect(page.layers.some((l) => l.type === "component")).toBe(true);
    expect(page.layers[0]!.responsive).toHaveLength(1);
    expect(page.layers[0]!.interactionStates[0]!.condition.type).toBe("stateEquals");

    const master = project.masters[0]!;
    expect(master.layers.some((l) => l.type === "group")).toBe(true);
  });
});
