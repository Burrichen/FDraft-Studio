import { describe, expect, it } from "vitest";
import { createId } from "../../src/ids.js";
import { AnimationDeclarationSchema, EffectDeclarationSchema, EffectKindSchema, MAX_ANIMATION_REPEAT_COUNT, MAX_ANIMATION_RANDOM_OFFSET_MS, MAX_EFFECT_PARTICLE_SIZE_PX } from "../../src/schema/interaction.js";

function baseAnimation(overrides: Record<string, unknown> = {}) {
  return {
    id: createId(),
    name: "Test animation",
    trigger: "onEnter",
    targetLayerId: createId(),
    durationMs: 500,
    delayMs: 0,
    easing: "easeOut",
    ...overrides,
  };
}

describe("AnimationDeclarationSchema", () => {
  it("accepts a preset motion", () => {
    const result = AnimationDeclarationSchema.safeParse(baseAnimation({ motion: { type: "preset", preset: "fade" } }));
    expect(result.success).toBe(true);
  });

  it("accepts every documented preset", () => {
    const presets = ["fade", "rise", "fall", "slideLeft", "slideRight", "scalePop", "float", "wobble", "pulse", "sway"];
    for (const preset of presets) {
      const result = AnimationDeclarationSchema.safeParse(baseAnimation({ motion: { type: "preset", preset } }));
      expect(result.success, preset).toBe(true);
    }
  });

  it("accepts a custom keyframe list with 2-12 entries", () => {
    const keyframes = [
      { offsetPercent: 0, opacity: 0 },
      { offsetPercent: 100, opacity: 1 },
    ];
    expect(AnimationDeclarationSchema.safeParse(baseAnimation({ motion: { type: "keyframes", keyframes } })).success).toBe(true);
  });

  it("rejects a keyframe list with fewer than 2 entries", () => {
    const result = AnimationDeclarationSchema.safeParse(baseAnimation({ motion: { type: "keyframes", keyframes: [{ offsetPercent: 0 }] } }));
    expect(result.success).toBe(false);
  });

  it("rejects a keyframe list longer than the max", () => {
    const keyframes = Array.from({ length: 13 }, (_, i) => ({ offsetPercent: i * 8 }));
    const result = AnimationDeclarationSchema.safeParse(baseAnimation({ motion: { type: "keyframes", keyframes } }));
    expect(result.success).toBe(false);
  });

  it("still accepts the legacy property/from/to shape with no motion", () => {
    const result = AnimationDeclarationSchema.safeParse(baseAnimation({ property: "opacity", from: 0, to: 1 }));
    expect(result.success).toBe(true);
  });

  it("rejects an animation with neither motion nor a complete legacy property/from/to", () => {
    expect(AnimationDeclarationSchema.safeParse(baseAnimation()).success).toBe(false);
    expect(AnimationDeclarationSchema.safeParse(baseAnimation({ property: "opacity" })).success).toBe(false);
  });

  it("defaults direction to normal and intensity to 1", () => {
    const result = AnimationDeclarationSchema.safeParse(baseAnimation({ motion: { type: "preset", preset: "fade" } }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.direction).toBe("normal");
      expect(result.data.intensity).toBe(1);
    }
  });

  it("accepts every repeat mode and rejects a count above the max", () => {
    expect(AnimationDeclarationSchema.safeParse(baseAnimation({ motion: { type: "preset", preset: "fade" }, repeat: { mode: "once" } })).success).toBe(true);
    expect(AnimationDeclarationSchema.safeParse(baseAnimation({ motion: { type: "preset", preset: "fade" }, repeat: { mode: "infinite" } })).success).toBe(true);
    expect(AnimationDeclarationSchema.safeParse(baseAnimation({ motion: { type: "preset", preset: "fade" }, repeat: { mode: "count", count: MAX_ANIMATION_REPEAT_COUNT } })).success).toBe(true);
    expect(AnimationDeclarationSchema.safeParse(baseAnimation({ motion: { type: "preset", preset: "fade" }, repeat: { mode: "count", count: MAX_ANIMATION_REPEAT_COUNT + 1 } })).success).toBe(false);
  });

  it("rejects a randomOffsetMs above the max", () => {
    const result = AnimationDeclarationSchema.safeParse(baseAnimation({ motion: { type: "preset", preset: "fade" }, randomOffsetMs: MAX_ANIMATION_RANDOM_OFFSET_MS + 1 }));
    expect(result.success).toBe(false);
  });

  it("accepts the manual trigger", () => {
    const result = AnimationDeclarationSchema.safeParse(baseAnimation({ trigger: "manual", motion: { type: "preset", preset: "pulse" } }));
    expect(result.success).toBe(true);
  });
});

describe("EffectDeclarationSchema", () => {
  function baseEffect(overrides: Record<string, unknown> = {}) {
    return { id: createId(), name: "Test effect", kind: "snow", intensity: 0.5, ...overrides };
  }

  it("accepts every documented effect kind", () => {
    const kinds = EffectKindSchema.options;
    expect(kinds).toEqual(["rain", "snow", "fog", "leaves", "dust", "stars", "embers", "confetti", "fireflies", "filmGrain", "clouds"]);
    for (const kind of kinds) {
      expect(EffectDeclarationSchema.safeParse(baseEffect({ kind })).success, kind).toBe(true);
    }
  });

  it("defaults speed/opacity/seed sensibly", () => {
    const result = EffectDeclarationSchema.safeParse(baseEffect());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.speed).toBe(1);
      expect(result.data.opacity).toBe(1);
      expect(result.data.seed).toBe(0);
    }
  });

  it("accepts a size range where min <= max, within bounds", () => {
    expect(EffectDeclarationSchema.safeParse(baseEffect({ sizeRange: { minPx: 4, maxPx: 12 } })).success).toBe(true);
    expect(EffectDeclarationSchema.safeParse(baseEffect({ sizeRange: { minPx: 4, maxPx: MAX_EFFECT_PARTICLE_SIZE_PX } })).success).toBe(true);
  });

  it("rejects a size range where min > max", () => {
    expect(EffectDeclarationSchema.safeParse(baseEffect({ sizeRange: { minPx: 20, maxPx: 10 } })).success).toBe(false);
  });

  it("rejects a size above the max particle size", () => {
    expect(EffectDeclarationSchema.safeParse(baseEffect({ sizeRange: { minPx: 4, maxPx: MAX_EFFECT_PARTICLE_SIZE_PX + 1 } })).success).toBe(false);
  });

  it("rejects intensity outside 0-1", () => {
    expect(EffectDeclarationSchema.safeParse(baseEffect({ intensity: 1.5 })).success).toBe(false);
    expect(EffectDeclarationSchema.safeParse(baseEffect({ intensity: -0.1 })).success).toBe(false);
  });

  it("rejects a speed above the max", () => {
    expect(EffectDeclarationSchema.safeParse(baseEffect({ speed: 5.1 })).success).toBe(false);
  });

  it("rejects a directionDeg outside 0-360", () => {
    expect(EffectDeclarationSchema.safeParse(baseEffect({ directionDeg: 361 })).success).toBe(false);
    expect(EffectDeclarationSchema.safeParse(baseEffect({ directionDeg: -1 })).success).toBe(false);
  });
});
