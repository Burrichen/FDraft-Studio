import { describe, expect, it } from "vitest";
import type { InteractionState } from "@fdraft/theme-sdk";
import { resolveInteractionOverride } from "../src/interactionState.js";
import type { RenderState } from "../src/types.js";

function hoverState(visible = true): InteractionState {
  return { id: "hover-state", name: "Hovered", condition: { type: "boolean", variable: { kind: "interactionFlag", which: "hover" }, equals: true }, visible };
}

function focusState(visible = true): InteractionState {
  return { id: "focus-state", name: "Focused", condition: { type: "boolean", variable: { kind: "interactionFlag", which: "focus" }, equals: true }, visible };
}

describe("resolveInteractionOverride", () => {
  it("returns no override when nothing matches", () => {
    expect(resolveInteractionOverride([hoverState()], { activeImageStates: {} }, "layer-1")).toEqual({});
  });

  it("resolves a hover-based state only for the exact layer that's hovered", () => {
    const state: RenderState = { activeImageStates: {}, interactionFlags: { "layer-1": { hover: true } } };
    expect(resolveInteractionOverride([hoverState()], state, "layer-1")).toEqual({ visible: true });
    expect(resolveInteractionOverride([hoverState()], state, "layer-2")).toEqual({});
  });

  it("gives keyboard focus the same result as mouse hover — focus/hover parity", () => {
    const hoverOnly: RenderState = { activeImageStates: {}, interactionFlags: { "layer-1": { hover: true } } };
    const focusOnly: RenderState = { activeImageStates: {}, interactionFlags: { "layer-1": { focus: true } } };
    const states = [hoverState(), focusState()];
    expect(resolveInteractionOverride(states, hoverOnly, "layer-1")).toEqual({ visible: true });
    expect(resolveInteractionOverride(states, focusOnly, "layer-1")).toEqual({ visible: true });
  });

  it("returns the first matching state in declaration order", () => {
    const state: RenderState = { activeImageStates: {}, interactionFlags: { "layer-1": { hover: true, focus: true } } };
    const states = [hoverState(true), { ...focusState(false) }];
    expect(resolveInteractionOverride(states, state, "layer-1")).toEqual({ visible: true });
  });
});
