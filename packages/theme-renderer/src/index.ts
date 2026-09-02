export { ThemeRenderer } from "./ThemeRenderer.js";
export type { ThemeRendererProps, ThemeRenderTarget } from "./ThemeRenderer.js";

export * from "./types.js";
export { RendererError } from "./errors.js";
export type { RendererErrorCode } from "./errors.js";

export { resolveMasterChain, resolveContainerLayers } from "./inheritance.js";
export { evaluateCondition } from "./conditions.js";
export { resolveInteractionOverride } from "./interactionState.js";
export { readRuntimeVariable, type RuntimeValue, type RuntimeVariableContext } from "./variables.js";
export {
  resolveActiveBehaviourRules,
  resolveTriggeredRule,
  EMPTY_BEHAVIOUR_RESOLUTION,
  type BehaviourResolution,
  type BehaviourTraceEntry,
  type BehaviourTraceCandidate,
  type BehaviourTriggerEvent,
  type TriggeredRuleResolution,
} from "./behaviourResolve.js";
export { pickActiveBreakpoint, resolveResponsiveGeometry } from "./responsive.js";
export { createSeededRandom, hashStringToSeed, randomInRange } from "./seededRandom.js";
export { PERFORMANCE_TIER_CAPS, performanceCapsFor, resolveParticleCount, type PerformanceTierCaps } from "./performanceCaps.js";
export { buildPresetKeyframes, buildCustomKeyframes, ANIMATION_EASING_CSS, type ResolvedKeyframeCss } from "./animationPresets.js";
export { createParticleField, stepParticles, particleOpacity, PARTICLE_KIND_CONFIG, type Particle, type ParticleKindConfig, type ParticleMotion, type ParticleShape } from "./particleEngine.js";
export { usePlaybackGate } from "./usePlaybackGate.js";
export { EffectCanvas } from "./layers/EffectCanvas.js";
export { FilmGrainEffect } from "./layers/FilmGrainEffect.js";
export { useLayerAnimation } from "./layers/useLayerAnimation.js";
export { stageStyle, layerBoxStyle } from "./transformStyle.js";
export { resolveGradientCss, resolveBoxShadowCss, resolveRadiusPx } from "./tokenStyle.js";
export { resolveComponentCopy, substitutePlaceholders } from "./copyResolution.js";
export { RenderErrorBoundary } from "./ErrorBoundary.js";
export { useRendererContext, buildRendererContextValue, resolveColor } from "./RendererContext.js";
export type { RendererContextValue } from "./RendererContext.js";

export {
  createComponentAdapterRegistry,
  createSampleComponentAdapterRegistry,
  createSampleCopyContractRegistry,
} from "./componentAdapters/registry.js";
export { SAMPLE_COMPONENT_KEYS, SAMPLE_COPY_CONTRACTS } from "./componentAdapters/sampleAdapters.js";
