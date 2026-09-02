/**
 * A tiny, deterministic PRNG (mulberry32) — never `Math.random()`. Given
 * the same seed, every call produces the exact same sequence, on any
 * machine, forever: the basis for reproducible particle-effect previews,
 * reproducible animation start-delay jitter, and exact-value tests.
 */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return function next(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministically folds a string (an id, typically) into a 32-bit unsigned seed — so "seed this from the animation+layer id" never needs `Math.random()` either. */
export function hashStringToSeed(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** A uniformly-distributed value in `[min, max]` from a seeded generator. */
export function randomInRange(random: () => number, min: number, max: number): number {
  return min + random() * (max - min);
}
