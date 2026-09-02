import { describe, expect, it } from "vitest";
import type { EffectDeclaration } from "@fdraft/theme-sdk";
import { createParticleField, stepParticles, particleOpacity, PARTICLE_KIND_CONFIG } from "../src/particleEngine.js";
import { PERFORMANCE_TIER_CAPS } from "../src/performanceCaps.js";
import { createSeededRandom } from "../src/seededRandom.js";

function effect(overrides: Partial<EffectDeclaration> = {}): EffectDeclaration {
  return { id: "e1", name: "Test", kind: "snow", intensity: 1, speed: 1, opacity: 1, seed: 42, ...overrides };
}

describe("createParticleField", () => {
  it("is deterministic for the same seed and canvas size", () => {
    const a = createParticleField(effect(), PERFORMANCE_TIER_CAPS.high, 800, 600);
    const b = createParticleField(effect(), PERFORMANCE_TIER_CAPS.high, 800, 600);
    expect(a).toEqual(b);
  });

  it("produces a different field for a different seed", () => {
    const a = createParticleField(effect({ seed: 1 }), PERFORMANCE_TIER_CAPS.high, 800, 600);
    const b = createParticleField(effect({ seed: 2 }), PERFORMANCE_TIER_CAPS.high, 800, 600);
    expect(a).not.toEqual(b);
  });

  it("scales particle count with intensity, capped by the performance tier", () => {
    const empty = createParticleField(effect({ intensity: 0 }), PERFORMANCE_TIER_CAPS.high, 800, 600);
    const full = createParticleField(effect({ intensity: 1 }), PERFORMANCE_TIER_CAPS.high, 800, 600);
    expect(empty).toHaveLength(0);
    expect(full).toHaveLength(PERFORMANCE_TIER_CAPS.high.maxParticlesPerEffect);
  });

  it("never creates particles on the low tier (effects disabled)", () => {
    const particles = createParticleField(effect({ intensity: 1 }), PERFORMANCE_TIER_CAPS.low, 800, 600);
    expect(particles).toHaveLength(0);
  });

  it("respects a custom size range", () => {
    const particles = createParticleField(effect({ sizeRange: { minPx: 20, maxPx: 25 } }), PERFORMANCE_TIER_CAPS.medium, 800, 600);
    for (const p of particles) {
      expect(p.size).toBeGreaterThanOrEqual(20);
      expect(p.size).toBeLessThanOrEqual(25);
    }
  });

  it("produces no particles at all for filmGrain (a non-particle effect)", () => {
    expect(createParticleField(effect({ kind: "filmGrain" }), PERFORMANCE_TIER_CAPS.high, 800, 600)).toEqual([]);
  });

  it("has one config entry for every particle-based effect kind", () => {
    const kinds = Object.keys(PARTICLE_KIND_CONFIG);
    expect(kinds.sort()).toEqual(["clouds", "confetti", "dust", "embers", "fireflies", "fog", "leaves", "rain", "snow", "stars"].sort());
  });
});

describe("stepParticles", () => {
  it("moves a falling particle downward over time", () => {
    // A canvas tall enough that a single short step never wraps a particle back to the top, so "downward" is unambiguous.
    const particles = createParticleField(effect({ kind: "rain", intensity: 1 }), PERFORMANCE_TIER_CAPS.high, 800, 100_000);
    const before = particles.map((p) => p.y);
    stepParticles(particles, 100, "rain", 800, 100_000, createSeededRandom(1));
    particles.forEach((p, i) => expect(p.y).toBeGreaterThan(before[i]!));
  });

  it("keeps a twinkling star stationary — only phase advances", () => {
    const particles = createParticleField(effect({ kind: "stars", intensity: 1 }), PERFORMANCE_TIER_CAPS.high, 800, 600);
    const before = particles.map((p) => ({ x: p.x, y: p.y }));
    stepParticles(particles, 100, "stars", 800, 600, createSeededRandom(1));
    particles.forEach((p, i) => {
      expect(p.x).toBeCloseTo(before[i]!.x, 5);
      expect(p.y).toBeCloseTo(before[i]!.y, 5);
    });
  });

  it("wraps a particle back onto the canvas once it drifts far enough past an edge", () => {
    const particles = createParticleField(effect({ kind: "rain", intensity: 1 }), PERFORMANCE_TIER_CAPS.high, 100, 100);
    for (const p of particles) p.y = 500; // force well past the bottom edge
    stepParticles(particles, 16, "rain", 100, 100, createSeededRandom(1));
    for (const p of particles) expect(p.y).toBeLessThan(100);
  });

  it("advances rotation only for rotating kinds", () => {
    const leaves = createParticleField(effect({ kind: "leaves", intensity: 1 }), PERFORMANCE_TIER_CAPS.high, 800, 600);
    const before = leaves.map((p) => p.rotationDeg);
    stepParticles(leaves, 200, "leaves", 800, 600, createSeededRandom(1));
    const changed = leaves.some((p, i) => p.rotationDeg !== before[i]);
    expect(changed).toBe(true);

    const snow = createParticleField(effect({ kind: "snow", intensity: 1 }), PERFORMANCE_TIER_CAPS.high, 800, 600);
    const beforeSnow = snow.map((p) => p.rotationDeg);
    stepParticles(snow, 200, "snow", 800, 600, createSeededRandom(1));
    snow.forEach((p, i) => expect(p.rotationDeg).toBe(beforeSnow[i]));
  });
});

describe("particleOpacity", () => {
  it("is always 1 for a non-pulsing kind", () => {
    const config = PARTICLE_KIND_CONFIG.snow;
    expect(particleOpacity({ x: 0, y: 0, size: 1, speedPxPerSec: 0, angleRad: 0, phase: 3, rotationDeg: 0, rotationSpeedDegPerSec: 0 }, config)).toBe(1);
  });

  it("oscillates within [0.4, 1] for a pulsing kind", () => {
    const config = PARTICLE_KIND_CONFIG.stars;
    for (let phase = 0; phase < 10; phase += 0.3) {
      const o = particleOpacity({ x: 0, y: 0, size: 1, speedPxPerSec: 0, angleRad: 0, phase, rotationDeg: 0, rotationSpeedDegPerSec: 0 }, config);
      expect(o).toBeGreaterThanOrEqual(0.4);
      expect(o).toBeLessThanOrEqual(1);
    }
  });
});
