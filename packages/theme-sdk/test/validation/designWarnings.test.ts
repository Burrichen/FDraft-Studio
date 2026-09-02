import { describe, expect, it } from "vitest";
import { createId } from "../../src/ids.js";
import { createEmptyProject } from "../../src/schema/project.js";
import type { StudioProjectDocument } from "../../src/schema/project.js";
import type { ComponentLayer, ShapeLayer, TextLayer } from "../../src/schema/layers.js";
import type { ComponentRequirement } from "../../src/schema/components.js";
import { checkDesignWarnings, contrastRatio } from "../../src/validation/designWarnings.js";

const baseTransform = { x: 0, y: 0, width: 200, height: 50, rotationDeg: 0, scaleX: 1, scaleY: 1 };

function project(): StudioProjectDocument {
  return createEmptyProject({ id: createId(), name: "Test" });
}

function textLayer(id: string, colorTokenId: string | undefined, overrides: Partial<TextLayer> = {}): TextLayer {
  return { id, type: "text", name: id, text: "hi", fontSizePx: 16, align: "left", colorTokenId, transform: baseTransform, opacity: 1, visible: true, locked: false, zIndex: 1, responsive: [], interactionStates: [], ...overrides };
}

function shapeLayer(id: string, fillColorTokenId: string | undefined, overrides: Partial<ShapeLayer> = {}): ShapeLayer {
  return { id, type: "shape", name: id, shape: "rect", fillColorTokenId, transform: baseTransform, opacity: 1, visible: true, locked: false, zIndex: 0, responsive: [], interactionStates: [], ...overrides };
}

function componentLayer(id: string, requirementId: string, overrides: Partial<ComponentLayer> = {}): ComponentLayer {
  return { id, type: "component", name: id, componentKey: "test-component", componentRequirementId: requirementId, styleOverrides: [], transform: baseTransform, opacity: 1, visible: true, locked: false, zIndex: 0, responsive: [], interactionStates: [], ...overrides };
}

function requirement(overrides: Partial<ComponentRequirement> = {}): ComponentRequirement {
  return { id: createId(), componentKey: "test-component", required: false, allowedProperties: [], ...overrides };
}

describe("contrastRatio", () => {
  it("is 21:1 for black on white", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
  });

  it("is 1:1 for identical colors", () => {
    expect(contrastRatio("#336699", "#336699")).toBeCloseTo(1, 5);
  });

  it("is symmetric regardless of argument order", () => {
    expect(contrastRatio("#111111", "#eeeeee")).toBeCloseTo(contrastRatio("#eeeeee", "#111111"), 10);
  });
});

describe("checkDesignWarnings: component requirements", () => {
  it("flags a required component that's never placed", () => {
    const req = requirement({ required: true });
    const p = { ...project(), componentRequirements: [req] };
    p.pages.push({ id: createId(), name: "Home", slug: "home", layers: [], animations: [] });
    const warnings = checkDesignWarnings(p);
    expect(warnings).toContainEqual(expect.objectContaining({ code: "MISSING_REQUIRED_COMPONENT" }));
  });

  it("does not flag a required component that is placed", () => {
    const req = requirement({ required: true });
    const p = { ...project(), componentRequirements: [req] };
    p.pages.push({ id: createId(), name: "Home", slug: "home", layers: [componentLayer("c1", req.id)], animations: [] });
    expect(checkDesignWarnings(p)).toEqual([]);
  });

  it("does not flag a required component placed on only one of several pages — 'required' is project-wide, not per-page", () => {
    const req = requirement({ required: true });
    const p = { ...project(), componentRequirements: [req] };
    p.pages.push({ id: createId(), name: "Draft", slug: "draft", layers: [componentLayer("c1", req.id)], animations: [] });
    p.pages.push({ id: createId(), name: "Results", slug: "results", layers: [], animations: [] }); // legitimately doesn't use it
    expect(checkDesignWarnings(p)).toEqual([]);
  });

  it("flags a duplicate singleton component within one container", () => {
    const req = requirement({ singleton: true });
    const p = { ...project(), componentRequirements: [req] };
    p.pages.push({ id: createId(), name: "Home", slug: "home", layers: [componentLayer("c1", req.id), componentLayer("c2", req.id)], animations: [] });
    expect(checkDesignWarnings(p)).toContainEqual(expect.objectContaining({ code: "DUPLICATE_SINGLETON_COMPONENT" }));
  });

  it("does not flag a singleton component placed once", () => {
    const req = requirement({ singleton: true });
    const p = { ...project(), componentRequirements: [req] };
    p.pages.push({ id: createId(), name: "Home", slug: "home", layers: [componentLayer("c1", req.id)], animations: [] });
    expect(checkDesignWarnings(p)).toEqual([]);
  });

  it("flags a component placed in an incompatible zone", () => {
    const req = requirement({ compatibleZoneKinds: ["header"] });
    const p = { ...project(), componentRequirements: [req] };
    p.pages.push({ id: createId(), name: "Home", slug: "home", layers: [componentLayer("c1", req.id, { zoneKind: "footer" })], animations: [] });
    expect(checkDesignWarnings(p)).toContainEqual(expect.objectContaining({ code: "INCOMPATIBLE_ZONE" }));
  });

  it("does not flag a component placed in a compatible zone", () => {
    const req = requirement({ compatibleZoneKinds: ["header", "footer"] });
    const p = { ...project(), componentRequirements: [req] };
    p.pages.push({ id: createId(), name: "Home", slug: "home", layers: [componentLayer("c1", req.id, { zoneKind: "footer" })], animations: [] });
    expect(checkDesignWarnings(p)).toEqual([]);
  });

  it("flags an undersized component", () => {
    const req = requirement({ minWidthPx: 300, minHeightPx: 100 });
    const p = { ...project(), componentRequirements: [req] };
    p.pages.push({ id: createId(), name: "Home", slug: "home", layers: [componentLayer("c1", req.id)], animations: [] }); // 200x50 < 300x100
    expect(checkDesignWarnings(p)).toContainEqual(expect.objectContaining({ code: "UNDERSIZED_COMPONENT" }));
  });
});

describe("checkDesignWarnings: contrast and coverage", () => {
  it("flags low-contrast text over an overlapping background shape", () => {
    const p = project();
    p.tokens.colors = [{ id: "light-gray", name: "Light Gray", value: "#eeeeee" }, { id: "white", name: "White", value: "#ffffff" }];
    p.pages.push({
      id: createId(),
      name: "Home",
      slug: "home",
      layers: [shapeLayer("bg", "white", { zIndex: 0 }), textLayer("t1", "light-gray", { zIndex: 1 })],
      animations: [],
    });
    expect(checkDesignWarnings(p)).toContainEqual(expect.objectContaining({ code: "LOW_CONTRAST_TEXT" }));
  });

  it("does not flag high-contrast text", () => {
    const p = project();
    p.tokens.colors = [{ id: "black", name: "Black", value: "#000000" }, { id: "white", name: "White", value: "#ffffff" }];
    p.pages.push({
      id: createId(),
      name: "Home",
      slug: "home",
      layers: [shapeLayer("bg", "white", { zIndex: 0 }), textLayer("t1", "black", { zIndex: 1 })],
      animations: [],
    });
    expect(checkDesignWarnings(p)).toEqual([]);
  });

  it("does not flag text and shape that don't overlap spatially", () => {
    const p = project();
    p.tokens.colors = [{ id: "light-gray", name: "Light Gray", value: "#eeeeee" }, { id: "white", name: "White", value: "#ffffff" }];
    p.pages.push({
      id: createId(),
      name: "Home",
      slug: "home",
      layers: [shapeLayer("bg", "white", { zIndex: 0, transform: { ...baseTransform, x: 1000 } }), textLayer("t1", "light-gray", { zIndex: 1 })],
      animations: [],
    });
    expect(checkDesignWarnings(p)).toEqual([]);
  });

  it("flags a decorative layer covering a protected component", () => {
    const req = requirement();
    const p = { ...project(), componentRequirements: [req] };
    p.pages.push({
      id: createId(),
      name: "Home",
      slug: "home",
      layers: [componentLayer("c1", req.id, { zIndex: 0 }), shapeLayer("deco", undefined, { zIndex: 1 })],
      animations: [],
    });
    expect(checkDesignWarnings(p)).toContainEqual(expect.objectContaining({ code: "DECORATIVE_LAYER_COVERS_COMPONENT" }));
  });

  it("does not flag a decorative layer beneath a component", () => {
    const req = requirement();
    const p = { ...project(), componentRequirements: [req] };
    p.pages.push({
      id: createId(),
      name: "Home",
      slug: "home",
      layers: [shapeLayer("deco", undefined, { zIndex: 0 }), componentLayer("c1", req.id, { zIndex: 1 })],
      animations: [],
    });
    expect(checkDesignWarnings(p)).toEqual([]);
  });
});

describe("checkDesignWarnings: hover-only discovery", () => {
  it("flags a layer that's only revealed by a hover interaction state", () => {
    const p = project();
    p.pages.push({
      id: createId(),
      name: "Home",
      slug: "home",
      layers: [
        shapeLayer("hint", undefined, {
          visible: false,
          interactionStates: [{ id: createId(), name: "Hovered", condition: { type: "boolean", variable: { kind: "interactionFlag", which: "hover" }, equals: true }, visible: true }],
        }),
      ],
      animations: [],
    });
    expect(checkDesignWarnings(p)).toContainEqual(expect.objectContaining({ code: "HOVER_ONLY_DISCOVERY" }));
  });

  it("does not flag a layer that's also revealed by an equivalent focus state", () => {
    const p = project();
    p.pages.push({
      id: createId(),
      name: "Home",
      slug: "home",
      layers: [
        shapeLayer("hint", undefined, {
          visible: false,
          interactionStates: [
            { id: createId(), name: "Hovered", condition: { type: "boolean", variable: { kind: "interactionFlag", which: "hover" }, equals: true }, visible: true },
            { id: createId(), name: "Focused", condition: { type: "boolean", variable: { kind: "interactionFlag", which: "focus" }, equals: true }, visible: true },
          ],
        }),
      ],
      animations: [],
    });
    expect(checkDesignWarnings(p)).toEqual([]);
  });

  it("still flags a layer whose hover state explicitly names its own id, and still needs a matching focus state", () => {
    const p = project();
    p.pages.push({
      id: createId(),
      name: "Home",
      slug: "home",
      layers: [
        shapeLayer("hint", undefined, {
          visible: false,
          interactionStates: [{ id: createId(), name: "Hovered", condition: { type: "boolean", variable: { kind: "interactionFlag", which: "hover", layerId: "hint" }, equals: true }, visible: true }],
        }),
      ],
      animations: [],
    });
    expect(checkDesignWarnings(p)).toContainEqual(expect.objectContaining({ code: "HOVER_ONLY_DISCOVERY" }));
  });

  it("does not treat a hover condition naming a different layer as this layer's own discoverability", () => {
    const p = project();
    p.pages.push({
      id: createId(),
      name: "Home",
      slug: "home",
      layers: [
        shapeLayer("hint", undefined, {
          visible: false,
          interactionStates: [{ id: createId(), name: "Hovered", condition: { type: "boolean", variable: { kind: "interactionFlag", which: "hover", layerId: "some-other-layer" }, equals: true }, visible: true }],
        }),
      ],
      animations: [],
    });
    expect(checkDesignWarnings(p)).not.toContainEqual(expect.objectContaining({ code: "HOVER_ONLY_DISCOVERY" }));
  });

  it("does not flag a layer that's visible by default even if it also has a hover state", () => {
    const p = project();
    p.pages.push({
      id: createId(),
      name: "Home",
      slug: "home",
      layers: [
        shapeLayer("hint", undefined, {
          visible: true,
          interactionStates: [{ id: createId(), name: "Hovered", condition: { type: "boolean", variable: { kind: "interactionFlag", which: "hover" }, equals: true }, visible: true }],
        }),
      ],
      animations: [],
    });
    expect(checkDesignWarnings(p)).toEqual([]);
  });
});
