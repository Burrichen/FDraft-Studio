import { describe, expect, it } from "vitest";
import type { AssetRecord, BehaviourRule, ImageStateGroup } from "@fdraft/theme-sdk";
import { resolveActiveBehaviourRules } from "../../src/behaviourResolve.js";
import type { RenderState } from "../../src/types.js";

/**
 * A tested fixture proving an image-state group can be driven by
 * configured progress ranges through the real Behaviour evaluator — the
 * same mechanism (not a Studio-only shortcut) FDraft's real runtime would
 * use. "Candy Bowl" is deliberately just editable project content here
 * (three states an author named and three ranges an author picked), not
 * hard-coded Halloween logic anywhere in the renderer itself — swap the
 * asset ids/labels/ranges and the exact same rules/evaluator work for any
 * themed progress indicator.
 */

const CANDY_BOWL_GROUP_ID = "candy-bowl-group";
const EMPTY_ID = "candy-bowl-empty";
const HALF_ID = "candy-bowl-half";
const FULL_ID = "candy-bowl-full";

const candyBowlGroup: ImageStateGroup = {
  id: CANDY_BOWL_GROUP_ID,
  name: "Candy Bowl",
  defaultStateId: EMPTY_ID,
  states: [
    { id: EMPTY_ID, name: "Empty bowl", assetId: "asset-empty" },
    { id: HALF_ID, name: "Half-full bowl", assetId: "asset-half" },
    { id: FULL_ID, name: "Full bowl", assetId: "asset-full" },
  ],
};

const candyBowlAssets: AssetRecord[] = [
  { id: "asset-empty", kind: "image", path: "assets/empty.png", mimeType: "image/png", sizeBytes: 3, sha256: "a".repeat(64) },
  { id: "asset-half", kind: "image", path: "assets/half.png", mimeType: "image/png", sizeBytes: 3, sha256: "b".repeat(64) },
  { id: "asset-full", kind: "image", path: "assets/full.png", mimeType: "image/png", sizeBytes: 3, sha256: "c".repeat(64) },
];

/** Author-editable content: which range of `progressPercent` selects which state — nothing here is fixed by the renderer. */
const candyBowlRules: BehaviourRule[] = [
  {
    id: "candy-bowl-empty-rule",
    name: "Show empty bowl while progress is low",
    enabled: true,
    priority: 0,
    trigger: { type: "whileTrue" },
    condition: { type: "inRange", variable: { kind: "progressPercent" }, min: 0, max: 33 },
    actions: [{ type: "setImageState", stateGroupId: CANDY_BOWL_GROUP_ID, stateId: EMPTY_ID }],
  },
  {
    id: "candy-bowl-half-rule",
    name: "Show half-full bowl at moderate progress",
    enabled: true,
    priority: 0,
    trigger: { type: "whileTrue" },
    condition: { type: "inRange", variable: { kind: "progressPercent" }, min: 34, max: 66 },
    actions: [{ type: "setImageState", stateGroupId: CANDY_BOWL_GROUP_ID, stateId: HALF_ID }],
  },
  {
    id: "candy-bowl-full-rule",
    name: "Show full bowl once progress is high",
    enabled: true,
    priority: 0,
    trigger: { type: "whileTrue" },
    condition: { type: "inRange", variable: { kind: "progressPercent" }, min: 67, max: 100 },
    actions: [{ type: "setImageState", stateGroupId: CANDY_BOWL_GROUP_ID, stateId: FULL_ID }],
  },
];

function resolveStateAt(progressPercent: number): string | undefined {
  const renderState: RenderState = { activeImageStates: {}, event: { progressPercent } };
  return resolveActiveBehaviourRules(candyBowlRules, renderState).imageStateOverrides[CANDY_BOWL_GROUP_ID];
}

describe("Candy Bowl image-state-group fixture", () => {
  it("declares three states over one image-state group, backed by real assets", () => {
    expect(candyBowlGroup.states).toHaveLength(3);
    expect(candyBowlAssets).toHaveLength(3);
  });

  it("shows the empty bowl at 0% and at the low-range boundary", () => {
    expect(resolveStateAt(0)).toBe(EMPTY_ID);
    expect(resolveStateAt(33)).toBe(EMPTY_ID);
  });

  it("shows the half-full bowl through the middle range, inclusive at both edges", () => {
    expect(resolveStateAt(34)).toBe(HALF_ID);
    expect(resolveStateAt(50)).toBe(HALF_ID);
    expect(resolveStateAt(66)).toBe(HALF_ID);
  });

  it("shows the full bowl at the high range, including 100%", () => {
    expect(resolveStateAt(67)).toBe(FULL_ID);
    expect(resolveStateAt(100)).toBe(FULL_ID);
  });

  it("changes state exactly at each configured boundary, not one value early or late", () => {
    expect(resolveStateAt(33)).toBe(EMPTY_ID);
    expect(resolveStateAt(34)).toBe(HALF_ID);
    expect(resolveStateAt(66)).toBe(HALF_ID);
    expect(resolveStateAt(67)).toBe(FULL_ID);
  });

  it("has no active override when progress is outside every configured range (a gap is legitimate editable content, not a bug)", () => {
    const renderState: RenderState = { activeImageStates: {}, event: { progressPercent: undefined } };
    expect(resolveActiveBehaviourRules(candyBowlRules, renderState).imageStateOverrides[CANDY_BOWL_GROUP_ID]).toBeUndefined();
  });

  it("the ranges themselves are ordinary rule conditions — re-pointing them to a different progress scheme requires no renderer change", () => {
    const rescheduled: BehaviourRule[] = candyBowlRules.map((r) => (r.id === "candy-bowl-full-rule" ? { ...r, condition: { type: "inRange", variable: { kind: "progressPercent" }, min: 90, max: 100 } } : r));
    const renderState: RenderState = { activeImageStates: {}, event: { progressPercent: 80 } };
    expect(resolveActiveBehaviourRules(rescheduled, renderState).imageStateOverrides[CANDY_BOWL_GROUP_ID]).toBeUndefined();
  });
});
