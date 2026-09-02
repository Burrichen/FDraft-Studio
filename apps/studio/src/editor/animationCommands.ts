import { createId } from "@fdraft/theme-sdk";
import type { AnimationDeclaration, AnimationPreset, Id, StudioProjectDocument } from "@fdraft/theme-sdk";
import type { Command } from "../history/commandStack.js";
import type { ContainerRef } from "./containerRef.js";
import { updateContainerAnimations } from "./containerRef.js";

/** A new animation is a schema-valid, immediately-useful default: fades in once on mount at a natural speed. */
export function buildAddAnimationCommand(ref: ContainerRef, targetLayerId: Id, preset: AnimationPreset = "fade"): { command: Command<StudioProjectDocument>; animation: AnimationDeclaration } {
  const animation: AnimationDeclaration = {
    id: createId(),
    name: "New animation",
    trigger: "onEnter",
    targetLayerId,
    motion: { type: "preset", preset },
    durationMs: 400,
    delayMs: 0,
    easing: "easeOut",
    loop: false,
    direction: "normal",
    intensity: 1,
  };
  return {
    animation,
    command: {
      label: "Add animation",
      do: (p) => updateContainerAnimations(p, ref, (animations) => [...animations, animation]),
      undo: (p) => updateContainerAnimations(p, ref, (animations) => animations.filter((a) => a.id !== animation.id)),
    },
  };
}

export function buildUpdateAnimationCommand(ref: ContainerRef, animationId: Id, before: AnimationDeclaration, after: AnimationDeclaration): Command<StudioProjectDocument> {
  return {
    label: "Change animation",
    do: (p) => updateContainerAnimations(p, ref, (animations) => animations.map((a) => (a.id === animationId ? after : a))),
    undo: (p) => updateContainerAnimations(p, ref, (animations) => animations.map((a) => (a.id === animationId ? before : a))),
  };
}

export function buildDeleteAnimationCommand(ref: ContainerRef, animation: AnimationDeclaration): Command<StudioProjectDocument> {
  return {
    label: "Delete animation",
    do: (p) => updateContainerAnimations(p, ref, (animations) => animations.filter((a) => a.id !== animation.id)),
    undo: (p) => updateContainerAnimations(p, ref, (animations) => [...animations, animation]),
  };
}
