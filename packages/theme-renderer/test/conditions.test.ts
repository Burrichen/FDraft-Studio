import { describe, expect, it } from "vitest";
import type { Condition } from "@fdraft/theme-sdk";
import { evaluateCondition } from "../src/conditions.js";
import type { RenderState } from "../src/types.js";

describe("evaluateCondition", () => {
  it("always is true", () => {
    expect(evaluateCondition({ type: "always" }, { activeImageStates: {} })).toBe(true);
  });

  it("eventPhase matches the current phase exactly", () => {
    const state: RenderState = { activeImageStates: {}, eventPhase: "live" };
    expect(evaluateCondition({ type: "eventPhase", phase: "live" }, state)).toBe(true);
    expect(evaluateCondition({ type: "eventPhase", phase: "ended" }, state)).toBe(false);
  });

  it("stateEquals matches the active state for that group", () => {
    const state: RenderState = { activeImageStates: { group1: "hover" } };
    expect(evaluateCondition({ type: "stateEquals", stateGroupId: "group1", stateId: "hover" }, state)).toBe(true);
    expect(evaluateCondition({ type: "stateEquals", stateGroupId: "group1", stateId: "default" }, state)).toBe(false);
    expect(evaluateCondition({ type: "stateEquals", stateGroupId: "group2", stateId: "hover" }, state)).toBe(false);
  });

  it("and/or/not compose correctly", () => {
    const state: RenderState = { activeImageStates: {}, eventPhase: "live" };
    const isLive: Condition = { type: "eventPhase", phase: "live" };
    const isEnded: Condition = { type: "eventPhase", phase: "ended" };

    expect(evaluateCondition({ type: "and", conditions: [isLive, { type: "always" }] }, state)).toBe(true);
    expect(evaluateCondition({ type: "and", conditions: [isLive, isEnded] }, state)).toBe(false);
    expect(evaluateCondition({ type: "or", conditions: [isEnded, isLive] }, state)).toBe(true);
    expect(evaluateCondition({ type: "not", condition: isEnded }, state)).toBe(true);
  });
});

describe("evaluateCondition: compare/inRange/boolean", () => {
  it("compares a numeric event-context variable with every operator", () => {
    const state: RenderState = { activeImageStates: {}, event: { progressPercent: 50 } };
    expect(evaluateCondition({ type: "compare", variable: { kind: "progressPercent" }, operator: "eq", value: 50 }, state)).toBe(true);
    expect(evaluateCondition({ type: "compare", variable: { kind: "progressPercent" }, operator: "neq", value: 50 }, state)).toBe(false);
    expect(evaluateCondition({ type: "compare", variable: { kind: "progressPercent" }, operator: "gt", value: 49 }, state)).toBe(true);
    expect(evaluateCondition({ type: "compare", variable: { kind: "progressPercent" }, operator: "gte", value: 50 }, state)).toBe(true);
    expect(evaluateCondition({ type: "compare", variable: { kind: "progressPercent" }, operator: "lt", value: 51 }, state)).toBe(true);
    expect(evaluateCondition({ type: "compare", variable: { kind: "progressPercent" }, operator: "lte", value: 50 }, state)).toBe(true);
    expect(evaluateCondition({ type: "compare", variable: { kind: "progressPercent" }, operator: "gt", value: 50 }, state)).toBe(false);
  });

  it("compares a string variable", () => {
    const state: RenderState = { activeImageStates: {}, eventPhase: "active" };
    expect(evaluateCondition({ type: "compare", variable: { kind: "eventStatus" }, operator: "eq", value: "active" }, state)).toBe(true);
    expect(evaluateCondition({ type: "compare", variable: { kind: "eventStatus" }, operator: "eq", value: "ended" }, state)).toBe(false);
  });

  it("inRange is inclusive at both boundaries", () => {
    const state: RenderState = { activeImageStates: {}, event: { watchedCount: 10 } };
    expect(evaluateCondition({ type: "inRange", variable: { kind: "watchedCount" }, min: 10, max: 20 }, state)).toBe(true);
    expect(evaluateCondition({ type: "inRange", variable: { kind: "watchedCount" }, min: 0, max: 10 }, state)).toBe(true);
    expect(evaluateCondition({ type: "inRange", variable: { kind: "watchedCount" }, min: 11, max: 20 }, state)).toBe(false);
    expect(evaluateCondition({ type: "inRange", variable: { kind: "watchedCount" }, min: 0, max: 9 }, state)).toBe(false);
  });

  it("boolean checks a variable against an expected boolean", () => {
    const state: RenderState = { activeImageStates: {}, event: { optedIn: true } };
    expect(evaluateCondition({ type: "boolean", variable: { kind: "optedIn" }, equals: true }, state)).toBe(true);
    expect(evaluateCondition({ type: "boolean", variable: { kind: "optedIn" }, equals: false }, state)).toBe(false);
  });

  it("a missing/undisclosed variable value never throws and always compares false", () => {
    const state: RenderState = { activeImageStates: {} };
    expect(evaluateCondition({ type: "compare", variable: { kind: "progressPercent" }, operator: "eq", value: 0 }, state)).toBe(false);
    expect(evaluateCondition({ type: "compare", variable: { kind: "progressPercent" }, operator: "gte", value: 0 }, state)).toBe(false);
    expect(evaluateCondition({ type: "inRange", variable: { kind: "watchedCount" }, min: 0, max: 100 }, state)).toBe(false);
    expect(evaluateCondition({ type: "boolean", variable: { kind: "optedIn" }, equals: false }, state)).toBe(false);
  });

  it("reads performanceTier/reducedMotion from the supplied hostSettings context, not renderState", () => {
    const state: RenderState = { activeImageStates: {} };
    expect(evaluateCondition({ type: "compare", variable: { kind: "performanceTier" }, operator: "eq", value: "low" }, state, { hostSettings: { performanceTier: "low", reducedMotion: true } })).toBe(true);
    expect(evaluateCondition({ type: "boolean", variable: { kind: "reducedMotion" }, equals: true }, state, { hostSettings: { performanceTier: "low", reducedMotion: true } })).toBe(true);
    expect(evaluateCondition({ type: "boolean", variable: { kind: "reducedMotion" }, equals: true }, state)).toBe(false);
  });

  it("reads a per-layer interactionFlag only when layerId is provided in context", () => {
    const state: RenderState = { activeImageStates: {}, interactionFlags: { "layer-1": { hover: true } } };
    const hovered: Condition = { type: "boolean", variable: { kind: "interactionFlag", which: "hover" }, equals: true };
    expect(evaluateCondition(hovered, state, { layerId: "layer-1" })).toBe(true);
    expect(evaluateCondition(hovered, state, { layerId: "layer-2" })).toBe(false);
    expect(evaluateCondition(hovered, state)).toBe(false);
  });

  it("an interactionFlag variable's own explicit layerId is used regardless of ambient context — the case a project-wide Behaviour rule needs", () => {
    const state: RenderState = { activeImageStates: {}, interactionFlags: { "layer-1": { hover: true }, "layer-2": { hover: false } } };
    const hoveredLayer1: Condition = { type: "boolean", variable: { kind: "interactionFlag", which: "hover", layerId: "layer-1" }, equals: true };
    // No ambient layerId context at all — a whileTrue Behaviour rule has none — yet it still resolves correctly.
    expect(evaluateCondition(hoveredLayer1, state)).toBe(true);
    // Even with a *different* ambient layerId in context, the variable's own explicit layerId wins.
    expect(evaluateCondition(hoveredLayer1, state, { layerId: "layer-2" })).toBe(true);
  });

  it("nests compare/inRange/boolean inside and/or/not", () => {
    const state: RenderState = { activeImageStates: {}, event: { progressPercent: 60, eventCompleted: false } };
    const nested: Condition = {
      type: "and",
      conditions: [
        { type: "inRange", variable: { kind: "progressPercent" }, min: 50, max: 100 },
        { type: "not", condition: { type: "boolean", variable: { kind: "eventCompleted" }, equals: true } },
      ],
    };
    expect(evaluateCondition(nested, state)).toBe(true);
  });
});
