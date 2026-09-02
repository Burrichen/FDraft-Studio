import { z } from "zod";
import { IdSchema } from "./primitives.js";

/**
 * The closed set of read-only values a condition or Behaviour rule may
 * reference — the only "variables" a theme can ever compare against.
 * Every value here is presentation-safe: no profile records, filesystem
 * access, points, draft generation, watch-state mutation, or eligibility
 * decisions. `eventStatus` deliberately reuses the same underlying value
 * as the existing `Condition.eventPhase`/`AnimationTrigger.onEventPhase`/
 * `PopupTrigger.onEventPhase` concept rather than introducing a second,
 * overlapping "phase" field.
 */
export const RuntimeVariableSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("eventStatus") }),
  z.strictObject({ kind: z.literal("eventActive") }),
  z.strictObject({ kind: z.literal("eventAvailable") }),
  z.strictObject({ kind: z.literal("optedIn") }),
  z.strictObject({ kind: z.literal("currentPageId") }),
  z.strictObject({ kind: z.literal("currentPopupId") }),
  z.strictObject({ kind: z.literal("draftGenerated") }),
  z.strictObject({ kind: z.literal("progressPercent") }),
  z.strictObject({ kind: z.literal("watchedCount") }),
  z.strictObject({ kind: z.literal("targetCount") }),
  z.strictObject({ kind: z.literal("eventCompleted") }),
  z.strictObject({ kind: z.literal("performanceTier") }),
  z.strictObject({ kind: z.literal("reducedMotion") }),
  /**
   * A layer's real hover/focus/pressed/selected state. `layerId` is
   * optional: omitted, it means "the layer this condition is already
   * attached to" (the only sensible reading inside a per-layer
   * `InteractionState`, which always has exactly one current layer);
   * a Behaviour rule's `whileTrue`/`conditionBecomesTrue` condition has
   * no such ambient layer, so it must name one explicitly.
   */
  z.strictObject({ kind: z.literal("interactionFlag"), which: z.enum(["hover", "focus", "pressed", "selected"]), layerId: IdSchema.optional() }),
  /** The currently-active state id of an image-state group — an alternative, comparison-based way to reach what `stateEquals` already expresses. */
  z.strictObject({ kind: z.literal("imageState"), stateGroupId: IdSchema }),
  /** A host-supplied, named point in time (epoch milliseconds) — e.g. `"now"`, `"eventStartAt"`, `"eventEndAt"`. Which keys exist is a host/renderer contract, not a theme-sdk concern; an unknown key simply reads as `undefined`. */
  z.strictObject({ kind: z.literal("dateTime"), key: z.string().min(1) }),
]);
export type RuntimeVariable = z.infer<typeof RuntimeVariableSchema>;

export const ComparisonOperatorSchema = z.enum(["eq", "neq", "gt", "gte", "lt", "lte"]);
export type ComparisonOperator = z.infer<typeof ComparisonOperatorSchema>;

export const ComparisonValueSchema = z.union([z.string().max(256), z.number(), z.boolean()]);
export type ComparisonValue = z.infer<typeof ComparisonValueSchema>;

/** The value type each `RuntimeVariable` kind produces — the single source of truth both the SDK's own `checkBehaviourRules` type-mismatch check and a host's rule-builder UI (picking which input control to show, which operators to offer) read from, so the two can never disagree about what's comparable to what. */
export const RUNTIME_VARIABLE_VALUE_TYPE: Record<RuntimeVariable["kind"], "string" | "number" | "boolean"> = {
  eventStatus: "string",
  eventActive: "boolean",
  eventAvailable: "boolean",
  optedIn: "boolean",
  currentPageId: "string",
  currentPopupId: "string",
  draftGenerated: "boolean",
  progressPercent: "number",
  watchedCount: "number",
  targetCount: "number",
  eventCompleted: "boolean",
  performanceTier: "string",
  reducedMotion: "boolean",
  interactionFlag: "boolean",
  imageState: "string",
  dateTime: "number",
};

/**
 * Declarative conditions only. There is no "expression" or "script"
 * variant — every condition is a fixed, enumerable shape the renderer
 * evaluates itself. Themes cannot express arbitrary logic.
 */
export type Condition =
  | { type: "always" }
  | { type: "eventPhase"; phase: string }
  | { type: "stateEquals"; stateGroupId: string; stateId: string }
  | { type: "compare"; variable: RuntimeVariable; operator: ComparisonOperator; value: ComparisonValue }
  | { type: "inRange"; variable: RuntimeVariable; min: number; max: number }
  | { type: "boolean"; variable: RuntimeVariable; equals: boolean }
  | { type: "and"; conditions: Condition[] }
  | { type: "or"; conditions: Condition[] }
  | { type: "not"; condition: Condition };

export const ConditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.strictObject({ type: z.literal("always") }),
    z.strictObject({ type: z.literal("eventPhase"), phase: z.string().min(1) }),
    z.strictObject({
      type: z.literal("stateEquals"),
      stateGroupId: IdSchema,
      stateId: IdSchema,
    }),
    z.strictObject({ type: z.literal("compare"), variable: RuntimeVariableSchema, operator: ComparisonOperatorSchema, value: ComparisonValueSchema }),
    /** `min`/`max` are both inclusive. */
    z.strictObject({ type: z.literal("inRange"), variable: RuntimeVariableSchema, min: z.number(), max: z.number() }),
    z.strictObject({ type: z.literal("boolean"), variable: RuntimeVariableSchema, equals: z.boolean() }),
    z.strictObject({ type: z.literal("and"), conditions: z.array(ConditionSchema).min(1) }),
    z.strictObject({ type: z.literal("or"), conditions: z.array(ConditionSchema).min(1) }),
    z.strictObject({ type: z.literal("not"), condition: ConditionSchema }),
  ]),
);

export const InteractionStateSchema = z.strictObject({
  id: IdSchema,
  name: z.string().min(1),
  condition: ConditionSchema,
  visible: z.boolean().optional(),
  opacity: z.number().min(0).max(1).optional(),
});
export type InteractionState = z.infer<typeof InteractionStateSchema>;

/**
 * `onEnter`/`onExit` self-trigger from the layer's own mount/unmount
 * lifecycle — no Behaviour rule needed. `manual` never self-triggers; it
 * only ever plays because a Behaviour rule's `startAnimation`/
 * `restartAnimation` action says so (a `whileTrue` rule with an
 * `interactionFlag` condition is how "on hover/focus/pressed" and
 * continuously-looping "idle" animations are built — see
 * `docs/IMPLEMENTATION_STATUS.md`'s Phase 9 row). `onStateChange`/
 * `onInterval`/`onEventPhase` predate the Behaviour rule engine and never
 * carried the parameters (which state group, what interval, which phase)
 * needed to self-trigger meaningfully; the renderer treats them exactly
 * like `manual` — kept only so already-serialised data stays schema-valid.
 * A `conditionBecomesTrue` Behaviour trigger is the fully-parameterised,
 * strictly more capable replacement for what they were meant to do.
 */
export const AnimationTriggerSchema = z.enum([
  "onEnter",
  "onExit",
  "manual",
  "onStateChange",
  "onInterval",
  "onEventPhase",
]);

export const AnimationEasingSchema = z.enum(["linear", "easeIn", "easeOut", "easeInOut"]);

export const AnimationPropertySchema = z.enum(["opacity", "x", "y", "rotation", "scale"]);

/** Upper bound on a single animation's duration, so no theme can declare an effectively-infinite tween. */
export const MAX_ANIMATION_DURATION_MS = 10_000;

/** The closed set of reusable animation shapes — each maps to a fixed, renderer-owned keyframe curve (never theme-authorable code); `intensity` scales its amplitude. */
export const AnimationPresetSchema = z.enum([
  "fade",
  "rise",
  "fall",
  "slideLeft",
  "slideRight",
  "scalePop",
  "float",
  "wobble",
  "pulse",
  "sway",
]);
export type AnimationPreset = z.infer<typeof AnimationPresetSchema>;

/** Upper bound on a custom keyframe list — enough for a genuinely useful hand-authored motion without turning Studio into a full timeline editor. */
export const MAX_ANIMATION_KEYFRAMES = 12;

export const AnimationKeyframeSchema = z.strictObject({
  /** Position along the animation's timeline, 0 to 100 (inclusive at both ends for a well-formed animation, but not enforced here — a keyframe list missing 0/100 simply holds its first/last declared value at the ends, same as CSS). */
  offsetPercent: z.number().min(0).max(100),
  opacity: z.number().min(0).max(1).optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  rotationDeg: z.number().optional(),
  scale: z.number().min(0).optional(),
});
export type AnimationKeyframe = z.infer<typeof AnimationKeyframeSchema>;

export const AnimationMotionSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("preset"), preset: AnimationPresetSchema }),
  z.strictObject({ type: z.literal("keyframes"), keyframes: z.array(AnimationKeyframeSchema).min(2).max(MAX_ANIMATION_KEYFRAMES) }),
]);
export type AnimationMotion = z.infer<typeof AnimationMotionSchema>;

/** Upper bound on a finite repeat count — "unbounded" must be the explicit, visible `infinite` choice, never a very large number standing in for it. */
export const MAX_ANIMATION_REPEAT_COUNT = 100;

export const AnimationRepeatSchema = z.discriminatedUnion("mode", [
  z.strictObject({ mode: z.literal("once") }),
  z.strictObject({ mode: z.literal("count"), count: z.number().int().positive().max(MAX_ANIMATION_REPEAT_COUNT) }),
  z.strictObject({ mode: z.literal("infinite") }),
]);
export type AnimationRepeat = z.infer<typeof AnimationRepeatSchema>;

export const AnimationDirectionSchema = z.enum(["normal", "reverse", "alternate"]);
export type AnimationDirection = z.infer<typeof AnimationDirectionSchema>;

/** Upper bound on the deterministic random start-delay jitter — organic-feeling without ever meaningfully desynchronising from `durationMs`. */
export const MAX_ANIMATION_RANDOM_OFFSET_MS = 2_000;

export const AnimationDeclarationSchema = z
  .strictObject({
    id: IdSchema,
    name: z.string().min(1),
    trigger: AnimationTriggerSchema,
    targetLayerId: IdSchema,
    /** Legacy single-property tween, kept so already-serialised data stays valid — a new animation should use `motion` (a preset or a keyframe list) instead. */
    property: AnimationPropertySchema.optional(),
    from: z.number().optional(),
    to: z.number().optional(),
    motion: AnimationMotionSchema.optional(),
    durationMs: z.number().int().positive().max(MAX_ANIMATION_DURATION_MS),
    delayMs: z.number().int().nonnegative().default(0),
    easing: AnimationEasingSchema,
    /** Legacy boolean, superseded by `repeat` when present — kept so already-serialised data stays valid. */
    loop: z.boolean().default(false),
    repeat: AnimationRepeatSchema.optional(),
    direction: AnimationDirectionSchema.default("normal"),
    /** Scales a preset's motion amplitude; meaningless for a custom `keyframes` motion, which already states its own absolute values. */
    intensity: z.number().min(0).max(2).default(1),
    /** A bounded, deterministic-per-layer jitter added to `delayMs` (seeded from the animation+layer id, never `Math.random()`) — several copies of the same animated layer then look organically staggered rather than perfectly synchronised, while remaining exactly reproducible for tests. */
    randomOffsetMs: z.number().int().nonnegative().max(MAX_ANIMATION_RANDOM_OFFSET_MS).optional(),
  })
  .refine((decl) => decl.motion !== undefined || (decl.property !== undefined && decl.from !== undefined && decl.to !== undefined), {
    message: "an animation needs either `motion` (a preset or keyframe list) or the legacy `property`+`from`+`to`",
  });
export type AnimationDeclaration = z.infer<typeof AnimationDeclarationSchema>;

/**
 * A fixed enum of built-in visual effect kinds the renderer knows how to
 * draw. There is no way to reference custom code here.
 */
export const EffectKindSchema = z.enum(["rain", "snow", "fog", "leaves", "dust", "stars", "embers", "confetti", "fireflies", "filmGrain", "clouds"]);
export type EffectKind = z.infer<typeof EffectKindSchema>;

/** Upper bound on the speed multiplier — fast enough to read as "fast," never fast enough to strobe. */
export const MAX_EFFECT_SPEED = 5;
/** Upper bound on a particle's rendered size, in CSS px at 100% intensity — see the per-tier particle-count caps in `@fdraft/theme-renderer` for the actual unbounded-particle protection. */
export const MAX_EFFECT_PARTICLE_SIZE_PX = 128;

export const EffectSizeRangeSchema = z
  .strictObject({ minPx: z.number().positive().max(MAX_EFFECT_PARTICLE_SIZE_PX), maxPx: z.number().positive().max(MAX_EFFECT_PARTICLE_SIZE_PX) })
  .refine((r) => r.minPx <= r.maxPx, { message: "minPx must be <= maxPx" });
export type EffectSizeRange = z.infer<typeof EffectSizeRangeSchema>;

export const EffectDeclarationSchema = z.strictObject({
  id: IdSchema,
  name: z.string().min(1),
  kind: EffectKindSchema,
  /** 0 (off) to 1 (this kind's densest still-bounded look) — never a raw particle count; the renderer converts this to an actual, per-performance-tier-capped particle count, so a theme can never request an unbounded number. */
  intensity: z.number().min(0).max(1),
  /** A multiplier on the kind's base motion speed. */
  speed: z.number().min(0).max(MAX_EFFECT_SPEED).default(1),
  /** Degrees, 0 = straight down, clockwise-positive — meaningful for falling/drifting kinds (rain/snow/leaves/dust/embers/fireflies), ignored by kinds with their own fixed motion (stars twinkle in place; film grain has no direction). */
  directionDeg: z.number().min(0).max(360).optional(),
  sizeRange: EffectSizeRangeSchema.optional(),
  /** An overall opacity multiplier for the whole effect, independent of the layer's own `opacity`. */
  opacity: z.number().min(0).max(1).default(1),
  colorTokenId: IdSchema.optional(),
  /** Seeds this effect's particle field deterministically — the same seed always produces the same initial positions/sizes/phases, for reproducible previews and tests. */
  seed: z.number().int().nonnegative().default(0),
  targetLayerId: IdSchema.optional(),
});
export type EffectDeclaration = z.infer<typeof EffectDeclarationSchema>;
