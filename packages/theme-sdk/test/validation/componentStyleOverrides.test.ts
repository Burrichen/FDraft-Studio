import { describe, expect, it } from "vitest";
import { buildSampleProject } from "../helpers/sampleProject.js";
import { validateProject } from "../../src/validation/validateProject.js";

describe("component style override allowlist", () => {
  it("accepts a style override within the requirement's allowedProperties", async () => {
    const { project } = await buildSampleProject();
    const result = validateProject(project);
    expect(result.valid).toBe(true);
  });

  it("rejects a style override using a property outside the requirement's allowedProperties", async () => {
    const { project } = await buildSampleProject();
    const componentLayer = project.pages[0]!.layers.find((l) => l.type === "component");
    if (!componentLayer || componentLayer.type !== "component") throw new Error("fixture missing component layer");

    const mutated = {
      ...project,
      pages: [
        {
          ...project.pages[0]!,
          layers: project.pages[0]!.layers.map((l) =>
            l.id === componentLayer.id
              ? { ...componentLayer, styleOverrides: [{ ...componentLayer.styleOverrides[0]!, style: { fontSize: 40 } }] }
              : l,
          ),
        },
      ],
    };

    const result = validateProject(mutated);
    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "DISALLOWED_STYLE_PROPERTY" }));
  });
});
