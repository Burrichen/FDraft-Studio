import type { BreakpointToken, CanvasSize, ResponsiveAnchor, ResponsiveConstraint, Transform } from "@fdraft/theme-sdk";
import { DEFAULT_CANVAS_SIZE } from "@fdraft/theme-sdk";

/** The widest-matching breakpoint (largest `minWidthPx <= viewportWidth`), or `undefined` if none matches. */
export function pickActiveBreakpoint(breakpoints: BreakpointToken[], viewportWidthPx: number): BreakpointToken | undefined {
  let best: BreakpointToken | undefined;
  for (const bp of breakpoints) {
    if (bp.minWidthPx <= viewportWidthPx && (best === undefined || bp.minWidthPx > best.minWidthPx)) {
      best = bp;
    }
  }
  return best;
}

function applyAnchor(transform: Transform, anchor: ResponsiveAnchor, canvas: CanvasSize): Transform {
  // Anchor offsets are resolved in the same canvas-percentage space every
  // other transform is (see transformStyle.ts) — a "px" anchor scales with
  // the canvas along with everything else rather than staying a constant
  // device pixel. True viewport-constant anchoring needs the host's actual
  // rendered size, which this phase's pure-CSS stage doesn't measure; it's
  // a reserved gap (see package README).
  const offsetX = anchor.unit === "percent" ? (anchor.offset / 100) * canvas.width : anchor.offset;
  const offsetY = anchor.unit === "percent" ? (anchor.offset / 100) * canvas.height : anchor.offset;

  switch (anchor.edge) {
    case "left":
      return { ...transform, x: offsetX };
    case "right":
      return { ...transform, x: canvas.width - offsetX - transform.width };
    case "top":
      return { ...transform, y: offsetY };
    case "bottom":
      return { ...transform, y: canvas.height - offsetY - transform.height };
    case "centerX":
      return { ...transform, x: (canvas.width - transform.width) / 2 + offsetX };
    case "centerY":
      return { ...transform, y: (canvas.height - transform.height) / 2 + offsetY };
    default:
      return transform;
  }
}

export interface EffectiveLayerGeometry {
  transform: Transform;
  visible: boolean;
}

/**
 * Applies the responsive constraint (if any) matching the active
 * breakpoint on top of a layer's base transform/visibility: first any
 * `transformOverride` fields, then anchor adjustments, then the
 * visibility override.
 */
export function resolveResponsiveGeometry(
  baseTransform: Transform,
  baseVisible: boolean,
  responsive: ResponsiveConstraint[],
  activeBreakpointId: string | undefined,
  canvas: CanvasSize | undefined,
): EffectiveLayerGeometry {
  const constraint = activeBreakpointId !== undefined ? responsive.find((r) => r.breakpointId === activeBreakpointId) : undefined;
  if (!constraint) return { transform: baseTransform, visible: baseVisible };

  const size = canvas ?? DEFAULT_CANVAS_SIZE;
  let transform: Transform = { ...baseTransform, ...constraint.transformOverride };
  for (const anchor of constraint.anchors) {
    transform = applyAnchor(transform, anchor, size);
  }

  return { transform, visible: constraint.visible ?? baseVisible };
}
