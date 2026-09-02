// @vitest-environment node
import { describe, expect, it } from "vitest";
import { validateProject } from "@fdraft/theme-sdk";
import { createStarterProject, STARTER_TEMPLATES } from "../../src/templates/starterTemplates.js";

describe("STARTER_TEMPLATES", () => {
  it("lists exactly the five required starter templates", () => {
    expect(STARTER_TEMPLATES.map((t) => t.id)).toEqual(["standard-fdraft", "immersive", "minimal", "poster", "blank"]);
  });
});

describe("createStarterProject", () => {
  it.each(STARTER_TEMPLATES.map((t) => t.id))("produces a schema-valid project for '%s'", (id) => {
    const project = createStarterProject(id, "My Project");
    const result = validateProject(project);
    expect(result.issues).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it("blank has no pages at all", () => {
    expect(createStarterProject("blank", "Empty").pages).toEqual([]);
  });

  it("minimal has exactly one page with a title layer", () => {
    const project = createStarterProject("minimal", "My Project");
    expect(project.pages).toHaveLength(1);
    expect(project.pages[0]!.layers.some((l) => l.type === "text")).toBe(true);
  });

  it("poster uses a tall, portrait canvas", () => {
    const project = createStarterProject("poster", "My Poster");
    expect(project.canvas!.height).toBeGreaterThan(project.canvas!.width);
  });

  it("immersive fills the full default canvas with a background layer", () => {
    const project = createStarterProject("immersive", "My Event");
    const bg = project.pages[0]!.layers.find((l) => l.type === "shape")!;
    expect(bg.transform.width).toBe(project.canvas!.width);
    expect(bg.transform.height).toBe(project.canvas!.height);
  });

  it("standard-fdraft is the full 8-page default event template", () => {
    expect(createStarterProject("standard-fdraft", "My Event").pages).toHaveLength(8);
  });

  it("every template uses the project name passed in", () => {
    for (const { id } of STARTER_TEMPLATES) {
      expect(createStarterProject(id, "Named Project").metadata.name).toBe("Named Project");
    }
  });
});
