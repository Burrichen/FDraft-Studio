import type { EffectDeclaration, EffectKind } from "@fdraft/theme-sdk";
import { createSeededRandom, randomInRange } from "./seededRandom.js";
import type { PerformanceTierCaps } from "./performanceCaps.js";
import { resolveParticleCount } from "./performanceCaps.js";

export type ParticleMotion = "fall" | "rise" | "drift" | "twinkle" | "wander";
export type ParticleShape = "circle" | "line" | "rect" | "blob";

export interface ParticleKindConfig {
  motion: ParticleMotion;
  shape: ParticleShape;
  baseColorHex: string;
  sizeRangePxDefault: readonly [number, number];
  speedPxPerSecDefault: number;
  /** 0 = "fall"/"rise" straight along the configured direction; "drift" kinds default to a gentle rightward crawl. */
  directionDegDefault: number;
  rotates: boolean;
  /** A gentle horizontal (for "fall") or vertical (for "drift") oscillation layered on top of the base velocity — what makes snow/leaves/dust feel organic instead of a rigid grid fall. */
  sways: boolean;
  opacityPulses: boolean;
}

/** One config per effect kind that's actually particle-based — `filmGrain` renders through a wholly different (SVG turbulence) path; see `EffectLayerView`. */
export const PARTICLE_KIND_CONFIG: Record<Exclude<EffectKind, "filmGrain">, ParticleKindConfig> = {
  rain: { motion: "fall", shape: "line", baseColorHex: "#8fb4d9", sizeRangePxDefault: [10, 22], speedPxPerSecDefault: 420, directionDegDefault: 0, rotates: false, sways: false, opacityPulses: false },
  snow: { motion: "fall", shape: "circle", baseColorHex: "#ffffff", sizeRangePxDefault: [2, 6], speedPxPerSecDefault: 40, directionDegDefault: 0, rotates: false, sways: true, opacityPulses: false },
  fog: { motion: "drift", shape: "blob", baseColorHex: "#cfd8dc", sizeRangePxDefault: [80, 160], speedPxPerSecDefault: 8, directionDegDefault: 90, rotates: false, sways: false, opacityPulses: false },
  leaves: { motion: "fall", shape: "blob", baseColorHex: "#c9862f", sizeRangePxDefault: [6, 13], speedPxPerSecDefault: 32, directionDegDefault: 0, rotates: true, sways: true, opacityPulses: false },
  dust: { motion: "drift", shape: "circle", baseColorHex: "#d8cba0", sizeRangePxDefault: [1, 3], speedPxPerSecDefault: 10, directionDegDefault: 90, rotates: false, sways: true, opacityPulses: false },
  stars: { motion: "twinkle", shape: "circle", baseColorHex: "#ffffff", sizeRangePxDefault: [1, 3], speedPxPerSecDefault: 0, directionDegDefault: 0, rotates: false, sways: false, opacityPulses: true },
  embers: { motion: "rise", shape: "circle", baseColorHex: "#ff7043", sizeRangePxDefault: [2, 4], speedPxPerSecDefault: 26, directionDegDefault: 180, rotates: false, sways: true, opacityPulses: true },
  confetti: { motion: "fall", shape: "rect", baseColorHex: "#e91e63", sizeRangePxDefault: [6, 11], speedPxPerSecDefault: 65, directionDegDefault: 0, rotates: true, sways: true, opacityPulses: false },
  fireflies: { motion: "wander", shape: "circle", baseColorHex: "#e8ff7a", sizeRangePxDefault: [2, 4], speedPxPerSecDefault: 16, directionDegDefault: 0, rotates: false, sways: false, opacityPulses: true },
  clouds: { motion: "drift", shape: "blob", baseColorHex: "#ffffff", sizeRangePxDefault: [100, 200], speedPxPerSecDefault: 6, directionDegDefault: 90, rotates: false, sways: false, opacityPulses: false },
};

export interface Particle {
  x: number;
  y: number;
  size: number;
  speedPxPerSec: number;
  /** Radians; 0 = down, increasing clockwise on screen — see `EffectDeclaration.directionDeg`. */
  angleRad: number;
  /** Advances every frame; drives sway/twinkle/pulse oscillation and (for `wander`) heading changes — never reset, so motion stays smooth. */
  phase: number;
  rotationDeg: number;
  rotationSpeedDegPerSec: number;
}

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Deterministically creates a full particle field for one effect at the current tier's cap — same `seed` and same canvas size always produce the exact same field. */
export function createParticleField(effect: EffectDeclaration, caps: PerformanceTierCaps, widthPx: number, heightPx: number): Particle[] {
  if (effect.kind === "filmGrain") return [];
  const config = PARTICLE_KIND_CONFIG[effect.kind];
  const count = resolveParticleCount(effect.intensity, caps);
  const random = createSeededRandom(effect.seed);
  const [sizeMin, sizeMax] = effect.sizeRange ? [effect.sizeRange.minPx, effect.sizeRange.maxPx] : config.sizeRangePxDefault;
  const directionRad = degToRad(effect.directionDeg ?? config.directionDegDefault);

  const particles: Particle[] = [];
  for (let i = 0; i < count; i += 1) {
    particles.push({
      x: randomInRange(random, 0, widthPx),
      y: randomInRange(random, 0, heightPx),
      size: randomInRange(random, sizeMin, sizeMax),
      speedPxPerSec: config.speedPxPerSecDefault * effect.speed,
      angleRad: directionRad,
      phase: randomInRange(random, 0, Math.PI * 2),
      rotationDeg: randomInRange(random, 0, 360),
      rotationSpeedDegPerSec: config.rotates ? randomInRange(random, -60, 60) : 0,
    });
  }
  return particles;
}

/** Advances one frame in place and returns the same array (mutated) — called up to 60x/sec, so this deliberately never allocates a new array or re-seeds anything. */
export function stepParticles(particles: Particle[], dtMs: number, kind: Exclude<EffectKind, "filmGrain">, widthPx: number, heightPx: number, respawnRandom: () => number): void {
  const config = PARTICLE_KIND_CONFIG[kind];
  const dtSec = dtMs / 1000;
  const margin = 32;

  for (const p of particles) {
    p.phase += dtSec;
    if (config.rotates) p.rotationDeg = (p.rotationDeg + p.rotationSpeedDegPerSec * dtSec) % 360;

    switch (config.motion) {
      case "fall":
      case "rise": {
        const sway = config.sways ? Math.sin(p.phase * 1.3) * 12 * dtSec : 0;
        p.x += Math.sin(p.angleRad) * p.speedPxPerSec * dtSec + sway;
        p.y += Math.cos(p.angleRad) * p.speedPxPerSec * dtSec;
        break;
      }
      case "drift": {
        const bob = Math.sin(p.phase * 0.5) * 4 * dtSec;
        p.x += Math.sin(p.angleRad) * p.speedPxPerSec * dtSec;
        p.y += Math.cos(p.angleRad) * p.speedPxPerSec * dtSec + bob;
        break;
      }
      case "wander": {
        p.angleRad += (respawnRandom() - 0.5) * 0.4;
        p.x += Math.sin(p.angleRad) * p.speedPxPerSec * dtSec;
        p.y += Math.cos(p.angleRad) * p.speedPxPerSec * dtSec;
        break;
      }
      case "twinkle":
        break; // stationary — only `phase` (opacity) moves.
    }

    // Wrap around whichever edge the particle would otherwise leave through, so the field is a continuous loop rather than a one-shot burst.
    if (p.x < -margin) p.x = widthPx + margin;
    if (p.x > widthPx + margin) p.x = -margin;
    if (p.y < -margin) p.y = heightPx + margin;
    if (p.y > heightPx + margin) p.y = -margin;
  }
}

/** The current opacity multiplier (0-1) for a particle whose kind pulses/twinkles — a plain sine wave over `phase`, never a random per-frame flicker (which would fail any seeded-repeatability test and look worse besides). */
export function particleOpacity(p: Particle, config: ParticleKindConfig): number {
  if (!config.opacityPulses) return 1;
  return 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(p.phase * 2));
}
