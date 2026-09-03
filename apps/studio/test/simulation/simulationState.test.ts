// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createId } from "@fdraft/theme-sdk";
import { DEFAULT_SIMULATION_LIVE_STATE, deriveHostSettings, deriveRenderState, scenarioToLiveState } from "../../src/simulation/simulationState.js";

describe("deriveHostSettings", () => {
  it("maps performanceTier/reducedMotion straight through", () => {
    expect(deriveHostSettings({ ...DEFAULT_SIMULATION_LIVE_STATE, performanceTier: "medium", reducedMotion: true })).toEqual({ performanceTier: "medium", reducedMotion: true });
  });
});

describe("deriveRenderState", () => {
  it("maps event fields, eventStatus, and page/popup targeting", () => {
    const state = { ...DEFAULT_SIMULATION_LIVE_STATE, eventStatus: "ended", optedIn: true, progressPercent: 80, currentPageId: "page-1" };
    const renderState = deriveRenderState(state, {});
    expect(renderState.eventPhase).toBe("ended");
    expect(renderState.currentPageId).toBe("page-1");
    expect(renderState.currentPopupId).toBeUndefined();
    expect(renderState.event).toEqual({
      eventActive: true,
      eventAvailable: true,
      optedIn: true,
      draftGenerated: false,
      eventCompleted: false,
      progressPercent: 80,
      watchedCount: 0,
      targetCount: 10,
    });
  });

  it("omits dateTimeValues.now when no override is set, and includes it when one is", () => {
    expect(deriveRenderState(DEFAULT_SIMULATION_LIVE_STATE, {}).dateTimeValues).toBeUndefined();
    const withOverride = { ...DEFAULT_SIMULATION_LIVE_STATE, dateTimeOverrideMs: 1_700_000_000_000 };
    expect(deriveRenderState(withOverride, {}).dateTimeValues).toEqual({ now: 1_700_000_000_000 });
  });

  it("passes placeholderValues and interactionFlags straight through", () => {
    const state = { ...DEFAULT_SIMULATION_LIVE_STATE, placeholderValues: { eventName: "Halloween" } };
    const flags = { "layer-1": { hover: true } };
    const renderState = deriveRenderState(state, flags);
    expect(renderState.placeholderValues).toEqual({ eventName: "Halloween" });
    expect(renderState.interactionFlags).toBe(flags);
  });
});

describe("scenarioToLiveState", () => {
  it("strips id/name/description, keeping every other field", () => {
    const scenario = { id: createId(), name: "A scenario", description: "desc", ...DEFAULT_SIMULATION_LIVE_STATE, progressPercent: 42 };
    const state = scenarioToLiveState(scenario);
    expect(state).toEqual({ ...DEFAULT_SIMULATION_LIVE_STATE, progressPercent: 42 });
    expect(state).not.toHaveProperty("id");
    expect(state).not.toHaveProperty("name");
    expect(state).not.toHaveProperty("description");
  });
});
