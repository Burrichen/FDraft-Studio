import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { AnimationDeclaration, AnimationKeyframe, Id } from "@fdraft/theme-sdk";
import { useRendererContext } from "../RendererContext.js";
import { buildPresetKeyframes, buildCustomKeyframes, ANIMATION_EASING_CSS } from "../animationPresets.js";
import { performanceCapsFor } from "../performanceCaps.js";
import { hashStringToSeed, createSeededRandom } from "../seededRandom.js";

export interface LayerAnimationResult {
  /** Merge directly into the layer's inline style — empty when nothing should animate right now. */
  style: CSSProperties;
  /** True while an `onExit` animation is playing out — the caller should keep rendering (not switch to `display: none`) until this goes false. */
  isExiting: boolean;
}

const NOOP_RESULT: LayerAnimationResult = { style: {}, isExiting: false };

/** A deterministic, per-(animation, layer) start-delay jitter — never `Math.random()`, so two renders of the same document always agree, and a test can assert an exact value. */
function resolveDelayMs(anim: AnimationDeclaration, layerId: Id): number {
  if (!anim.randomOffsetMs) return anim.delayMs;
  const random = createSeededRandom(hashStringToSeed(`${anim.id}:${layerId}`));
  return anim.delayMs + Math.floor(random() * anim.randomOffsetMs);
}

function resolveRepeat(anim: AnimationDeclaration): { iterationCount: string; effectiveDurationMs: number } {
  const repeat = anim.repeat ?? (anim.loop ? { mode: "infinite" as const } : { mode: "once" as const });
  if (repeat.mode === "infinite") return { iterationCount: "infinite", effectiveDurationMs: Infinity };
  if (repeat.mode === "count") return { iterationCount: String(repeat.count), effectiveDurationMs: anim.durationMs * repeat.count };
  return { iterationCount: "1", effectiveDurationMs: anim.durationMs };
}

/** The legacy single-property tween as a 2-keyframe list, so it flows through exactly the same custom-keyframe CSS path as a hand-authored one. */
function legacyKeyframes(anim: AnimationDeclaration): AnimationKeyframe[] {
  const field: "opacity" | "x" | "y" | "rotationDeg" | "scale" = anim.property === "rotation" ? "rotationDeg" : anim.property === "opacity" ? "opacity" : anim.property === "x" ? "x" : anim.property === "y" ? "y" : "scale";
  return [
    { offsetPercent: 0, [field]: anim.from },
    { offsetPercent: 100, [field]: anim.to },
  ];
}

/** Builds the actual `@keyframes` CSS (memoised per unique config, not per frame) and the inline `animation` style for one active declaration. */
function resolveAnimationStyle(anim: AnimationDeclaration, layerId: Id): { style: CSSProperties; effectiveDurationMs: number } {
  const resolved = anim.motion
    ? anim.motion.type === "preset"
      ? buildPresetKeyframes(anim.motion.preset, anim.intensity)
      : buildCustomKeyframes(anim.id, anim.motion.keyframes)
    : buildCustomKeyframes(anim.id, legacyKeyframes(anim));

  injectKeyframesOnce(resolved.animationName, resolved.css);

  const { iterationCount, effectiveDurationMs } = resolveRepeat(anim);
  const delayMs = resolveDelayMs(anim, layerId);

  return {
    effectiveDurationMs: effectiveDurationMs === Infinity ? Infinity : effectiveDurationMs + delayMs,
    style: {
      animationName: resolved.animationName,
      animationDuration: `${anim.durationMs}ms`,
      animationDelay: `${delayMs}ms`,
      animationTimingFunction: ANIMATION_EASING_CSS[anim.easing] ?? "linear",
      animationIterationCount: iterationCount,
      animationDirection: anim.direction,
      animationFillMode: "both",
    },
  };
}

// A single shared <style> element every unique keyframe name is written to at most once — animations reuse
// the same preset+intensity combination constantly (many layers fading in at intensity 1), so this avoids
// both duplicate DOM style rules and any need to inject per-instance <style> elements in React itself.
const injectedNames = new Set<string>();
let sharedStyleEl: HTMLStyleElement | null = null;
function injectKeyframesOnce(name: string, css: string): void {
  if (injectedNames.has(name)) return;
  if (typeof document === "undefined") return; // SSR/non-DOM test environments — the animation still resolves geometry correctly, it just never gets a live stylesheet.
  if (!sharedStyleEl) {
    sharedStyleEl = document.createElement("style");
    sharedStyleEl.setAttribute("data-fdraft-animations", "true");
    document.head.appendChild(sharedStyleEl);
  }
  sharedStyleEl.appendChild(document.createTextNode(css));
  injectedNames.add(name);
}

/**
 * Resolves every animation targeting this layer into live CSS. `onEnter`
 * plays automatically from mount (a `repeat: infinite` `onEnter`
 * animation is how a continuously-looping "idle" motion like float/pulse/
 * wobble/sway is built — no Behaviour rule needed); `onExit` plays once
 * when `visible` flips from true to false, and `isExiting` tells the
 * caller to keep the layer mounted until it finishes; `manual` (and the
 * legacy, parameter-less `onStateChange`/`onInterval`/`onEventPhase`)
 * never self-triggers — it plays only while
 * `behaviourResolution.animationActiveOverrides[animation.id]` says so,
 * which is exactly how "on hover/focus/pressed" and a rule-gated idle
 * loop are built (see `BehaviourResolution`). Both `reducedMotion` and a
 * performance tier with `animationsEnabled: false` make this a no-op —
 * every layer then renders directly in its resting/final geometry.
 */
export function useLayerAnimation(layerId: Id, visible: boolean): LayerAnimationResult {
  const { animationsByLayerId, hostSettings, behaviourResolution } = useRendererContext();
  const [isExiting, setIsExiting] = useState(false);
  const wasVisibleRef = useRef(visible);
  const exitTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const animations = animationsByLayerId.get(layerId) ?? [];
  const exitAnimation = animations.find((a) => a.trigger === "onExit");
  const caps = performanceCapsFor(hostSettings);
  const animationsAllowed = caps.animationsEnabled && !hostSettings.reducedMotion;

  useEffect(() => {
    const wasVisible = wasVisibleRef.current;
    wasVisibleRef.current = visible;
    if (wasVisible && !visible && exitAnimation && animationsAllowed) {
      setIsExiting(true);
      const { effectiveDurationMs } = resolveRepeat(exitAnimation);
      const totalMs = effectiveDurationMs === Infinity ? exitAnimation.durationMs : effectiveDurationMs;
      exitTimeoutRef.current = setTimeout(() => setIsExiting(false), totalMs + resolveDelayMs(exitAnimation, layerId));
    }
    return () => clearTimeout(exitTimeoutRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- exitAnimation is derived fresh each render from a stable declaration list; re-running on every animations-array identity change would restart the exit timer needlessly.
  }, [visible, animationsAllowed]);

  if (!animationsAllowed || animations.length === 0) return NOOP_RESULT;

  if (isExiting && exitAnimation) {
    return { style: resolveAnimationStyle(exitAnimation, layerId).style, isExiting: true };
  }
  if (!visible) return NOOP_RESULT;

  const enterAnimation = animations.find((a) => a.trigger === "onEnter");
  if (enterAnimation) {
    return { style: resolveAnimationStyle(enterAnimation, layerId).style, isExiting: false };
  }

  const activeManual = animations.find((a) => a.trigger !== "onEnter" && a.trigger !== "onExit" && behaviourResolution.animationActiveOverrides[a.id]);
  if (activeManual) {
    return { style: resolveAnimationStyle(activeManual, layerId).style, isExiting: false };
  }

  return NOOP_RESULT;
}
