import { describe, expect, it } from "vitest";
import { createSeededRandom, hashStringToSeed, randomInRange } from "../src/seededRandom.js";

describe("createSeededRandom", () => {
  it("produces the exact same sequence for the same seed", () => {
    const a = createSeededRandom(42);
    const b = createSeededRandom(42);
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it("produces a different sequence for a different seed", () => {
    const a = createSeededRandom(1);
    const b = createSeededRandom(2);
    expect(a()).not.toBe(b());
  });

  it("always produces values in [0, 1)", () => {
    const random = createSeededRandom(7);
    for (let i = 0; i < 200; i += 1) {
      const v = random();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("hashStringToSeed", () => {
  it("is deterministic for the same string", () => {
    expect(hashStringToSeed("layer-1")).toBe(hashStringToSeed("layer-1"));
  });

  it("differs for different strings", () => {
    expect(hashStringToSeed("layer-1")).not.toBe(hashStringToSeed("layer-2"));
  });

  it("is always a non-negative 32-bit integer", () => {
    const h = hashStringToSeed("anything at all");
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });
});

describe("randomInRange", () => {
  it("stays within [min, max] across many draws", () => {
    const random = createSeededRandom(99);
    for (let i = 0; i < 200; i += 1) {
      const v = randomInRange(random, 5, 10);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThanOrEqual(10);
    }
  });
});
