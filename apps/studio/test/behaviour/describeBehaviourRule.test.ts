// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createId, createProject } from "@fdraft/theme-sdk";
import type { BehaviourRule, StudioProjectDocument } from "@fdraft/theme-sdk";
import { buildBehaviourNameLookups, describeBehaviourRule, describeCondition } from "../../src/behaviour/describeBehaviourRule.js";

function project(): StudioProjectDocument {
  const p = createProject({ id: createId(), name: "Test" });
  p.pages.push({
    id: "page-1",
    name: "Home",
    slug: "home",
    layers: [{ id: "layer-1", type: "shape", name: "CTA Button", shape: "rect", transform: { x: 0, y: 0, width: 100, height: 100, rotationDeg: 0, scaleX: 1, scaleY: 1 }, opacity: 1, visible: true, locked: false, zIndex: 0, responsive: [], interactionStates: [] }],
    animations: [],
  });
  p.popups.push({ id: "popup-1", name: "Welcome popup", trigger: "onLoad", layers: [], animations: [] });
  p.imageStateGroups.push({ id: "group-1", name: "Candy Bowl", defaultStateId: "state-1", states: [{ id: "state-1", name: "Empty", assetId: createId() }, { id: "state-2", name: "Full", assetId: createId() }] });
  return p;
}

describe("describeCondition", () => {
  it("describes always, compare, inRange, and boolean plainly", () => {
    const lookups = buildBehaviourNameLookups(project());
    expect(describeCondition({ type: "always" }, lookups)).toBe("always");
    expect(describeCondition({ type: "compare", variable: { kind: "progressPercent" }, operator: "gte", value: 50 }, lookups)).toContain("progress");
    expect(describeCondition({ type: "inRange", variable: { kind: "watchedCount" }, min: 0, max: 10 }, lookups)).toContain("between 0 and 10");
    expect(describeCondition({ type: "boolean", variable: { kind: "optedIn" }, equals: true }, lookups)).toContain("opted in");
  });

  it("names the image-state group and state by their real names, not raw ids", () => {
    const lookups = buildBehaviourNameLookups(project());
    const description = describeCondition({ type: "stateEquals", stateGroupId: "group-1", stateId: "state-2" }, lookups);
    expect(description).toContain("Candy Bowl");
    expect(description).toContain("Full");
    expect(description).not.toContain("group-1");
  });

  it("composes and/or/not readably", () => {
    const lookups = buildBehaviourNameLookups(project());
    const nested = describeCondition(
      {
        type: "and",
        conditions: [
          { type: "inRange", variable: { kind: "progressPercent" }, min: 0, max: 100 },
          { type: "not", condition: { type: "boolean", variable: { kind: "eventCompleted" }, equals: true } },
        ],
      },
      lookups,
    );
    expect(nested).toContain("all of");
    expect(nested).toContain("not (");
  });

  it("names the specific layer an interactionFlag condition targets, not a vague 'this layer'", () => {
    const lookups = buildBehaviourNameLookups(project());
    const description = describeCondition({ type: "boolean", variable: { kind: "interactionFlag", which: "hover", layerId: "layer-1" }, equals: true }, lookups);
    expect(description).toContain("CTA Button");
    expect(description).not.toContain("this layer");
  });

  it("falls back to a shortened id when a reference is broken", () => {
    const lookups = buildBehaviourNameLookups(project());
    const description = describeCondition({ type: "stateEquals", stateGroupId: "missing-group", stateId: "missing-state" }, lookups);
    expect(description).not.toBe("");
  });
});

describe("describeBehaviourRule", () => {
  it("names the trigger's target and the action's target by their real names", () => {
    const lookups = buildBehaviourNameLookups(project());
    const rule: BehaviourRule = {
      id: createId(),
      name: "Show CTA on Home",
      enabled: true,
      priority: 0,
      trigger: { type: "pageEnter", pageId: "page-1" },
      condition: { type: "always" },
      actions: [{ type: "show", layerId: "layer-1" }],
    };
    const description = describeBehaviourRule(rule, lookups);
    expect(description).toContain("Home");
    expect(description).toContain("CTA Button");
    expect(description).not.toContain("page-1");
    expect(description).not.toContain("layer-1");
  });

  it("omits the condition clause entirely when it's always", () => {
    const lookups = buildBehaviourNameLookups(project());
    const rule: BehaviourRule = { id: createId(), name: "n", enabled: true, priority: 0, trigger: { type: "whileTrue" }, condition: { type: "always" }, actions: [{ type: "hide", layerId: "layer-1" }] };
    expect(describeBehaviourRule(rule, lookups)).not.toContain("if");
  });

  it("includes the condition clause when it's not always", () => {
    const lookups = buildBehaviourNameLookups(project());
    const rule: BehaviourRule = {
      id: createId(),
      name: "n",
      enabled: true,
      priority: 0,
      trigger: { type: "whileTrue" },
      condition: { type: "boolean", variable: { kind: "draftGenerated" }, equals: true },
      actions: [{ type: "openPopup", popupId: "popup-1" }],
    };
    const description = describeBehaviourRule(rule, lookups);
    expect(description).toContain("if");
    expect(description).toContain("Welcome popup");
  });

  it("joins multiple actions with 'and'", () => {
    const lookups = buildBehaviourNameLookups(project());
    const rule: BehaviourRule = {
      id: createId(),
      name: "n",
      enabled: true,
      priority: 0,
      trigger: { type: "whileTrue" },
      condition: { type: "always" },
      actions: [{ type: "show", layerId: "layer-1" }, { type: "setImageState", stateGroupId: "group-1", stateId: "state-2" }],
    };
    const description = describeBehaviourRule(rule, lookups);
    expect(description).toContain(" and ");
  });
});
