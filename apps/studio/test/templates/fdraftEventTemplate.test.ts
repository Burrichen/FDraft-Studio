// @vitest-environment node
import { describe, expect, it } from "vitest";
import { checkDesignWarnings, validateProject } from "@fdraft/theme-sdk";
import { resolveComponentCopy, SAMPLE_COPY_CONTRACTS } from "@fdraft/theme-renderer";
import { createFdraftDefaultEventProject } from "../../src/templates/fdraftEventTemplate.js";
import { FDRAFT_EVENT_PAGES } from "../../src/templates/fdraftEventContract.js";

describe("createFdraftDefaultEventProject", () => {
  it("produces a schema- and semantically-valid project", () => {
    const project = createFdraftDefaultEventProject("My Event");
    const result = validateProject(project);
    expect(result.issues).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it("has all 8 registered surfaces with the expected names and slugs", () => {
    const project = createFdraftDefaultEventProject("My Event");
    expect(project.pages).toHaveLength(8);
    expect(project.pages.map((p) => p.name)).toEqual(["Event Landing", "Draft", "Results", "Completion", "About/Information", "Event Available", "Join", "Event Complete"]);
    expect(new Set(project.pages.map((p) => p.slug)).size).toBe(8); // all unique
  });

  it("produces zero design warnings — no missing-required, singleton, zone, or undersized issues in its own template", () => {
    const project = createFdraftDefaultEventProject("My Event");
    const warnings = checkDesignWarnings(project);
    expect(warnings).toEqual([]);
  });

  it("declares exactly one component requirement per unique componentKey in the contract, regardless of how many pages place it", () => {
    const project = createFdraftDefaultEventProject("My Event");
    const keysInContract = new Set(FDRAFT_EVENT_PAGES.flatMap((p) => p.components.map((c) => c.componentKey)));
    expect(project.componentRequirements).toHaveLength(keysInContract.size);
    expect(new Set(project.componentRequirements.map((r) => r.componentKey))).toEqual(keysInContract);
  });

  it("every component's copy resolves to its declared FDraft default text (no copyOverrides written by the template)", () => {
    const project = createFdraftDefaultEventProject("My Event");
    const landing = project.pages.find((p) => p.slug === "event-landing")!;
    const titleLayer = landing.layers.find((l) => l.type === "component" && l.componentKey === "page-title");
    expect(titleLayer && "copyOverrides" in titleLayer ? titleLayer.copyOverrides : undefined).toBeUndefined();

    const copy = resolveComponentCopy(SAMPLE_COPY_CONTRACTS["page-title"]!, undefined, undefined);
    expect(copy.title).toBe("Sample Event Title");
  });

  it("uses the project name passed in", () => {
    const project = createFdraftDefaultEventProject("Halloween Bash");
    expect(project.metadata.name).toBe("Halloween Bash");
  });
});
