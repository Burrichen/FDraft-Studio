import { useEffect, useState, type ReactNode } from "react";
import type { EffectDeclaration } from "@fdraft/theme-sdk";

/**
 * Film grain is deliberately not particle-based — a noise texture reads
 * far more convincingly (and far more cheaply) from an SVG
 * `feTurbulence` filter than from thousands of individually-drawn
 * specks, so it gets its own small, cheap path instead of forcing it
 * through `EffectCanvas`. The "animation" is just periodically changing
 * the turbulence seed (a handful of times a second, not per paint frame)
 * — `reducedMotion` freezes it at its first frame entirely.
 */
export function FilmGrainEffect({ effect, reducedMotion }: { effect: EffectDeclaration; reducedMotion: boolean }): ReactNode {
  const [tick, setTick] = useState(0);
  const filterId = `fdraft-grain-${effect.id}`;

  useEffect(() => {
    if (reducedMotion) return;
    const interval = setInterval(() => setTick((t) => t + 1), Math.max(80, 200 / Math.max(0.1, effect.speed)));
    return () => clearInterval(interval);
  }, [reducedMotion, effect.speed]);

  const baseFrequency = 0.6 + effect.intensity * 0.5;

  return (
    <svg aria-hidden="true" style={{ width: "100%", height: "100%", display: "block", pointerEvents: "none" }}>
      <filter id={filterId}>
        <feTurbulence type="fractalNoise" baseFrequency={baseFrequency} numOctaves={2} seed={effect.seed + tick} stitchTiles="stitch" result="noise" />
        <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.9 0 0 0 0" />
      </filter>
      <rect width="100%" height="100%" filter={`url(#${filterId})`} opacity={effect.opacity} />
    </svg>
  );
}
