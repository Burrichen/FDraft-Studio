import type { AnimationKeyframe, AnimationPreset } from "@fdraft/theme-sdk";

/**
 * One resolved `@keyframes` block for a specific (preset, intensity) pair,
 * or a specific custom keyframe list — computed once and cached by
 * `AnimationStylesheet`, never regenerated per frame. `intensity` scales
 * amplitude by plain multiplication in JS rather than CSS `calc()` inside
 * transform functions, which has patchier cross-engine support.
 */
export interface ResolvedKeyframeCss {
  animationName: string;
  css: string;
}

/** Every preset's motion at intensity 1.0 — `intensity` scales distances (px) and angles (deg) linearly; scale-based presets scale their departure from 1.0 linearly instead, so intensity 0 is always a no-op and intensity 2 is twice as pronounced. */
export function buildPresetKeyframes(preset: AnimationPreset, intensity: number): ResolvedKeyframeCss {
  const px = (base: number) => base * intensity;
  const deg = (base: number) => base * intensity;
  const scaleDelta = (base: number) => base * intensity;
  const animationName = `fdraft-anim-${preset}-${Math.round(intensity * 1000)}`;

  let body: string;
  switch (preset) {
    case "fade":
      body = `0% { opacity: 0; } 100% { opacity: 1; }`;
      break;
    case "rise":
      body = `0% { opacity: 0; transform: translateY(${px(24)}px); } 100% { opacity: 1; transform: translateY(0); }`;
      break;
    case "fall":
      body = `0% { opacity: 0; transform: translateY(${px(-24)}px); } 100% { opacity: 1; transform: translateY(0); }`;
      break;
    case "slideLeft":
      body = `0% { opacity: 0; transform: translateX(${px(40)}px); } 100% { opacity: 1; transform: translateX(0); }`;
      break;
    case "slideRight":
      body = `0% { opacity: 0; transform: translateX(${px(-40)}px); } 100% { opacity: 1; transform: translateX(0); }`;
      break;
    case "scalePop":
      body = `0% { opacity: 0; transform: scale(${Math.max(0, 1 - scaleDelta(0.4))}); } 60% { opacity: 1; transform: scale(${1 + scaleDelta(0.05)}); } 100% { opacity: 1; transform: scale(1); }`;
      break;
    case "float":
      body = `0%, 100% { transform: translateY(0); } 50% { transform: translateY(${px(-8)}px); }`;
      break;
    case "wobble":
      body = `0%, 100% { transform: rotate(${deg(-3)}deg); } 50% { transform: rotate(${deg(3)}deg); }`;
      break;
    case "pulse":
      body = `0%, 100% { transform: scale(1); } 50% { transform: scale(${1 + scaleDelta(0.05)}); }`;
      break;
    case "sway":
      body = `0%, 100% { transform: rotate(${deg(-2)}deg); } 50% { transform: rotate(${deg(2)}deg); }`;
      break;
  }
  return { animationName, css: `@keyframes ${animationName} { ${body} }` };
}

function keyframeTransform(k: AnimationKeyframe): string | undefined {
  const parts: string[] = [];
  if (k.x !== undefined || k.y !== undefined) parts.push(`translate(${k.x ?? 0}px, ${k.y ?? 0}px)`);
  if (k.rotationDeg !== undefined) parts.push(`rotate(${k.rotationDeg}deg)`);
  if (k.scale !== undefined) parts.push(`scale(${k.scale})`);
  return parts.length > 0 ? parts.join(" ") : undefined;
}

/** A custom, hand-authored keyframe list — each declared property is emitted only where the author set it at that specific offset (no cross-frame smart-fill); an offset with only `opacity` set, say, animates opacity there while leaving `transform` to whatever the browser's own keyframe interpolation already has in flight. */
export function buildCustomKeyframes(animationId: string, keyframes: AnimationKeyframe[]): ResolvedKeyframeCss {
  const animationName = `fdraft-anim-custom-${animationId}`;
  const steps = keyframes
    .map((k) => {
      const declarations: string[] = [];
      if (k.opacity !== undefined) declarations.push(`opacity: ${k.opacity};`);
      const transform = keyframeTransform(k);
      if (transform) declarations.push(`transform: ${transform};`);
      return `${k.offsetPercent}% { ${declarations.join(" ")} }`;
    })
    .join(" ");
  return { animationName, css: `@keyframes ${animationName} { ${steps} }` };
}

export const ANIMATION_EASING_CSS: Record<string, string> = {
  linear: "linear",
  easeIn: "cubic-bezier(0.42, 0, 1, 1)",
  easeOut: "cubic-bezier(0, 0, 0.58, 1)",
  easeInOut: "cubic-bezier(0.42, 0, 0.58, 1)",
};
