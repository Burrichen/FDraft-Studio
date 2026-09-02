import type { CSSProperties } from "react";
import type { CanvasSize, Transform } from "@fdraft/theme-sdk";
import { DEFAULT_CANVAS_SIZE } from "@fdraft/theme-sdk";

/**
 * Every layer is positioned as a percentage of the design canvas rather
 * than fixed pixels, inside a stage element that itself scales
 * (`width: 100%`, `aspect-ratio: canvas.width/canvas.height`) to fit
 * whatever viewport a host renders into. This is what "safe responsive
 * layout" means for this phase — geometry always scales; breakpoint
 * overrides (see `responsive.ts`) additionally adjust it at named widths.
 */
export function stageStyle(canvas: CanvasSize | undefined): CSSProperties {
  const size = canvas ?? DEFAULT_CANVAS_SIZE;
  return {
    position: "relative",
    width: "100%",
    aspectRatio: `${size.width} / ${size.height}`,
    overflow: "hidden",
    // Establishes a query container so text (see fontSizeToCqw below) can
    // scale with the stage's actual rendered width via `cqw` units,
    // without JS measuring anything.
    containerType: "inline-size",
  };
}

/**
 * Converts a design-space font size (authored against the canvas width)
 * into CSS container-query width units, so it scales exactly like every
 * percentage-positioned layer does — `stageStyle`'s `container-type:
 * inline-size` is what makes `cqw` mean "% of the stage's actual rendered
 * width" rather than the viewport's.
 */
export function fontSizeToCqw(fontSizePx: number, canvas: CanvasSize | undefined): string {
  const size = canvas ?? DEFAULT_CANVAS_SIZE;
  return `${(fontSizePx / size.width) * 100}cqw`;
}

export interface LayerBoxOptions {
  transform: Transform;
  canvas: CanvasSize | undefined;
  opacity: number;
  visible: boolean;
  zIndex: number;
  reducedMotion: boolean;
}

export function layerBoxStyle({ transform, canvas, opacity, visible, zIndex, reducedMotion }: LayerBoxOptions): CSSProperties {
  const size = canvas ?? DEFAULT_CANVAS_SIZE;
  const toPercent = (value: number, of: number) => `${(value / of) * 100}%`;

  const parts: string[] = [];
  if (transform.rotationDeg !== 0) parts.push(`rotate(${transform.rotationDeg}deg)`);
  if (transform.scaleX !== 1 || transform.scaleY !== 1) parts.push(`scale(${transform.scaleX}, ${transform.scaleY})`);

  return {
    position: "absolute",
    left: toPercent(transform.x, size.width),
    top: toPercent(transform.y, size.height),
    width: toPercent(transform.width, size.width),
    height: toPercent(transform.height, size.height),
    opacity,
    zIndex,
    display: visible ? undefined : "none",
    transform: parts.length > 0 ? parts.join(" ") : undefined,
    transformOrigin: "center center",
    transition: reducedMotion ? "none" : undefined,
    // Every real (non-group) layer must stay a hit-test target even when
    // nested inside a group wrapper, which deliberately sets
    // `pointer-events: none` on itself (see GroupLayerView) since it has
    // no visual footprint of its own — `pointer-events` otherwise
    // inherits to descendants, so this explicit `auto` opts back in.
    pointerEvents: "auto",
  };
}
