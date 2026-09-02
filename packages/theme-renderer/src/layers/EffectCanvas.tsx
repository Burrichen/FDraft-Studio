import { useEffect, useRef, type ReactNode } from "react";
import type { EffectDeclaration } from "@fdraft/theme-sdk";
import { createParticleField, stepParticles, particleOpacity, PARTICLE_KIND_CONFIG, type Particle } from "../particleEngine.js";
import { createSeededRandom } from "../seededRandom.js";
import { usePlaybackGate } from "../usePlaybackGate.js";
import type { PerformanceTierCaps } from "../performanceCaps.js";

export interface EffectCanvasProps {
  effect: EffectDeclaration;
  caps: PerformanceTierCaps;
  reducedMotion: boolean;
  colorHex: string | undefined;
}

function drawParticle(ctx: CanvasRenderingContext2D, p: Particle, kind: EffectDeclaration["kind"], colorHex: string, effectOpacity: number): void {
  if (kind === "filmGrain") return;
  const config = PARTICLE_KIND_CONFIG[kind];
  ctx.save();
  ctx.globalAlpha = particleOpacity(p, config) * effectOpacity;
  ctx.fillStyle = colorHex;
  ctx.strokeStyle = colorHex;

  ctx.translate(p.x, p.y);
  if (config.rotates) ctx.rotate((p.rotationDeg * Math.PI) / 180);

  switch (config.shape) {
    case "circle":
    case "blob":
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size / 2, p.size / (config.shape === "blob" ? 1.6 : 2), 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "line":
      ctx.lineWidth = Math.max(1, p.size / 8);
      ctx.beginPath();
      ctx.moveTo(0, -p.size / 2);
      ctx.lineTo(0, p.size / 2);
      ctx.stroke();
      break;
    case "rect":
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      break;
  }
  ctx.restore();
}

/**
 * The one maintained canvas implementation every particle-based effect
 * kind renders through — never per-kind bespoke code, and never hundreds
 * of editor-created image layers. `filmGrain` is the one effect kind that
 * isn't particle-based at all; `EffectLayerView` renders it through a
 * separate, cheaper SVG-turbulence path and never mounts this component
 * for it.
 */
export function EffectCanvas({ effect, caps, reducedMotion, colorHex }: EffectCanvasProps): ReactNode {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const active = usePlaybackGate(canvasRef);
  const particlesRef = useRef<Particle[]>([]);
  const sizeRef = useRef({ widthPx: 0, heightPx: 0 });
  const resolvedColor = colorHex ?? PARTICLE_KIND_CONFIG[effect.kind === "filmGrain" ? "snow" : effect.kind].baseColorHex;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || effect.kind === "filmGrain") return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frameId: number | undefined;
    let lastTs: number | undefined;
    let cancelled = false;

    function resize(): void {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(typeof window !== "undefined" ? (window.devicePixelRatio || 1) : 1, caps.maxDevicePixelRatio);
      const widthPx = Math.max(1, Math.round(rect.width));
      const heightPx = Math.max(1, Math.round(rect.height));
      canvas.width = Math.round(widthPx * dpr);
      canvas.height = Math.round(heightPx * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { widthPx, heightPx };
      particlesRef.current = createParticleField(effect, caps, widthPx, heightPx);
    }

    resize();
    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : undefined;
    resizeObserver?.observe(canvas);

    function drawStaticFrame(): void {
      const { widthPx, heightPx } = sizeRef.current;
      ctx!.clearRect(0, 0, widthPx, heightPx);
      if (effect.kind === "filmGrain") return;
      for (const p of particlesRef.current) drawParticle(ctx!, p, effect.kind, resolvedColor, effect.opacity);
    }

    if (reducedMotion || !caps.effectsEnabled) {
      drawStaticFrame();
      return () => resizeObserver?.disconnect();
    }

    const respawnRandom = createSeededRandom(effect.seed + 1);
    function tick(ts: number): void {
      if (cancelled) return;
      if (!active) {
        frameId = requestAnimationFrame(tick);
        return;
      }
      const dtMs = lastTs === undefined ? 16 : Math.min(64, ts - lastTs);
      lastTs = ts;
      if (effect.kind !== "filmGrain") {
        stepParticles(particlesRef.current, dtMs, effect.kind, sizeRef.current.widthPx, sizeRef.current.heightPx, respawnRandom);
      }
      drawStaticFrame();
      frameId = requestAnimationFrame(tick);
    }
    frameId = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      if (frameId !== undefined) cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- effect/caps/colorHex are treated as a stable per-mount configuration; a genuine authoring change is expected to remount (Studio always keys effect layers by their own id), not hot-swap physics mid-flight.
  }, [active, reducedMotion]);

  return <canvas ref={canvasRef} aria-hidden="true" style={{ width: "100%", height: "100%", display: "block", pointerEvents: "none" }} />;
}
