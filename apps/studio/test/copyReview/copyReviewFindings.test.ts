// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createId, createProject } from "@fdraft/theme-sdk";
import type { ComponentLayer, StudioProjectDocument } from "@fdraft/theme-sdk";
import type { ComponentCopyContractRegistry } from "@fdraft/theme-renderer";
import { computeStaticCopyFindings, computeUnresolvedPlaceholderFindings, collectComponentCopyTargets } from "../../src/copyReview/copyReviewFindings.js";

function componentLayer(overrides: Partial<ComponentLayer> = {}): ComponentLayer {
  return {
    id: createId(),
    type: "component",
    name: "CTA",
    componentKey: "generate-draft-action",
    componentRequirementId: createId(),
    styleOverrides: [],
    transform: { x: 0, y: 0, width: 200, height: 60, rotationDeg: 0, scaleX: 1, scaleY: 1 },
    opacity: 1,
    visible: true,
    locked: false,
    zIndex: 0,
    responsive: [],
    interactionStates: [],
    ...overrides,
  };
}

function projectWithLayer(layer: ComponentLayer): StudioProjectDocument {
  const project = createProject({ id: createId(), name: "Test" });
  project.pages.push({ id: createId(), name: "Home", slug: "home", layers: [layer], animations: [] });
  return project;
}

const CONTRACTS: ComponentCopyContractRegistry = {
  "generate-draft-action": [
    { key: "label", label: "Button label", defaultText: "Generate My Draft", required: true, allowedPlaceholders: ["eventName"] },
    { key: "hint", label: "Hint", defaultText: "", required: false },
  ],
};

describe("collectComponentCopyTargets", () => {
  it("finds a component layer's declared slots, tagged with its containing page", () => {
    const layer = componentLayer();
    const project = projectWithLayer(layer);
    const targets = collectComponentCopyTargets(project, CONTRACTS);
    expect(targets).toHaveLength(2);
    expect(targets[0]!.base).toMatchObject({ containerKind: "page", containerName: "Home", layerId: layer.id, componentKey: "generate-draft-action" });
    expect(targets.map((t) => t.slot.key)).toEqual(["label", "hint"]);
  });

  it("finds nothing for a component key with no declared contract", () => {
    const project = projectWithLayer(componentLayer({ componentKey: "unknown-component" }));
    expect(collectComponentCopyTargets(project, CONTRACTS)).toEqual([]);
  });

  it("finds component layers nested inside a group", () => {
    const inner = componentLayer();
    const project = createProject({ id: createId(), name: "Test" });
    project.pages.push({
      id: createId(),
      name: "Home",
      slug: "home",
      layers: [{ id: createId(), type: "group", name: "Wrapper", transform: { x: 0, y: 0, width: 400, height: 400, rotationDeg: 0, scaleX: 1, scaleY: 1 }, opacity: 1, visible: true, locked: false, zIndex: 0, responsive: [], interactionStates: [], children: [inner] }],
      animations: [],
    });
    expect(collectComponentCopyTargets(project, CONTRACTS)).toHaveLength(2);
  });
});

describe("computeStaticCopyFindings", () => {
  it("flags a slot with no stored override as falling back to the FDraft default", () => {
    const project = projectWithLayer(componentLayer());
    const findings = computeStaticCopyFindings(project, CONTRACTS);
    const label = findings.find((f) => f.slotKey === "label");
    expect(label?.category).toBe("fallbackToDefault");
  });

  it("does not flag fallbackToDefault when an override is present", () => {
    const project = projectWithLayer(componentLayer({ copyOverrides: { label: "Build my draft" } }));
    const findings = computeStaticCopyFindings(project, CONTRACTS);
    expect(findings.find((f) => f.slotKey === "label" && f.category === "fallbackToDefault")).toBeUndefined();
  });

  it("flags a required slot with a whitespace-only stored override as missing", () => {
    const project = projectWithLayer(componentLayer({ copyOverrides: { label: "   " } }));
    const findings = computeStaticCopyFindings(project, CONTRACTS);
    expect(findings.some((f) => f.slotKey === "label" && f.category === "missing")).toBe(true);
  });

  it("does not flag an optional slot's explicit blank override as missing", () => {
    const project = projectWithLayer(componentLayer({ copyOverrides: { hint: "" } }));
    const findings = computeStaticCopyFindings(project, CONTRACTS);
    expect(findings.some((f) => f.slotKey === "hint" && f.category === "missing")).toBe(false);
  });

  it("flags an optional slot resolving empty with no accessibleNameFallback as inaccessible", () => {
    const project = projectWithLayer(componentLayer({ copyOverrides: { hint: "" } }));
    const findings = computeStaticCopyFindings(project, CONTRACTS);
    expect(findings.some((f) => f.slotKey === "hint" && f.category === "inaccessible")).toBe(true);
  });

  it("does not flag inaccessible when an accessibleNameFallback is declared", () => {
    const contracts: ComponentCopyContractRegistry = { "generate-draft-action": [{ key: "hint", label: "Hint", defaultText: "", required: false, accessibleNameFallback: "Generate draft" }] };
    const project = projectWithLayer(componentLayer({ copyOverrides: { hint: "" } }));
    const findings = computeStaticCopyFindings(project, contracts);
    expect(findings.some((f) => f.category === "inaccessible")).toBe(false);
  });
});

describe("computeUnresolvedPlaceholderFindings", () => {
  const scenario = { id: createId(), name: "Halloween", eventStatus: "active", eventActive: true, eventAvailable: true, optedIn: true, draftGenerated: false, eventCompleted: false, progressPercent: 0, watchedCount: 0, targetCount: 10, performanceTier: "high" as const, reducedMotion: false, dataProfile: "normal" as const };

  it("flags an unresolved placeholder left in the resolved text", () => {
    const project = projectWithLayer(componentLayer({ copyOverrides: { label: "Join {{eventName}} now" } }));
    const findings = computeUnresolvedPlaceholderFindings(project, CONTRACTS, [scenario]);
    expect(findings.some((f) => f.slotKey === "label" && f.category === "unresolvedPlaceholder")).toBe(true);
  });

  it("does not flag a placeholder the scenario actually supplies a value for", () => {
    const project = projectWithLayer(componentLayer({ copyOverrides: { label: "Join {{eventName}} now" } }));
    const withValue = { ...scenario, placeholderValues: { eventName: "Halloween Watch Party" } };
    const findings = computeUnresolvedPlaceholderFindings(project, CONTRACTS, [withValue]);
    expect(findings.some((f) => f.slotKey === "label")).toBe(false);
  });

  it("also checks a declared copy variant's text, not just the default override", () => {
    const project = projectWithLayer(componentLayer({ copyVariants: { label: [{ id: createId(), text: "Almost there {{eventName}}!" }] } }));
    const findings = computeUnresolvedPlaceholderFindings(project, CONTRACTS, [scenario]);
    const variantFinding = findings.find((f) => f.textSource.kind === "variant");
    expect(variantFinding).toBeDefined();
    expect(variantFinding?.category).toBe("unresolvedPlaceholder");
  });
});
