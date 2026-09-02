import type { HostSettings } from "./types.js";

/**
 * Fixed, documented caps per performance tier — never a measurement of
 * actual device capability, only a bounded budget a host opts into. These
 * numbers are the real protection against unbounded particles, animation
 * storms, and oversized high-DPI canvases; a theme's `intensity`/`seed`/
 * etc. can only ever select a point *within* the active tier's budget,
 * never override it.
 */
export interface PerformanceTierCaps {
  /** Hard ceiling on particles for one effect layer at intensity 1.0 — `EffectDeclaration.intensity` scales linearly from 0 up to this. */
  maxParticlesPerEffect: number;
  /** At most this many effect layers actually render per page/popup; extras (by declaration order) render nothing rather than compounding cost silently. */
  maxEffectLayers: number;
  /** Ceiling on `window.devicePixelRatio` a canvas is ever backed at — protects against a very high-DPI display multiplying canvas-fill cost far beyond what's visually necessary. */
  maxDevicePixelRatio: number;
  /** Whether Prompt-9 keyframe animations (entrance/idle/manual) play at all; when false every layer renders directly in its resting/final state, identically to `reducedMotion`. */
  animationsEnabled: boolean;
  /** Whether effect layers render at all. */
  effectsEnabled: boolean;
}

export const PERFORMANCE_TIER_CAPS: Record<HostSettings["performanceTier"], PerformanceTierCaps> = {
  low: { maxParticlesPerEffect: 0, maxEffectLayers: 0, maxDevicePixelRatio: 1, animationsEnabled: false, effectsEnabled: false },
  medium: { maxParticlesPerEffect: 40, maxEffectLayers: 2, maxDevicePixelRatio: 1.5, animationsEnabled: true, effectsEnabled: true },
  high: { maxParticlesPerEffect: 150, maxEffectLayers: 4, maxDevicePixelRatio: 2, animationsEnabled: true, effectsEnabled: true },
};

export function performanceCapsFor(hostSettings: HostSettings): PerformanceTierCaps {
  return PERFORMANCE_TIER_CAPS[hostSettings.performanceTier];
}

/** The actual, bounded particle count for one effect layer at the active tier — the only place `EffectDeclaration.intensity` is ever converted into a real count. */
export function resolveParticleCount(intensity: number, caps: PerformanceTierCaps): number {
  return Math.round(Math.max(0, Math.min(1, intensity)) * caps.maxParticlesPerEffect);
}
