import { z } from "zod";
import { IdSchema } from "./primitives.js";
import { ConditionSchema, type Condition } from "./interaction.js";
import { SafeComponentStylePropertySchema, StyleValueSchema } from "./components.js";

/**
 * What makes a Behaviour rule start being considered at all. Lifecycle and
 * interaction triggers are edge events (a click, a page becoming current)
 * that a host dispatches at the moment they happen; `whileTrue` is the
 * continuous case — the rule is simply active for as long as its own
 * `condition` holds, re-evaluated fresh on every render, with no notion of
 * "already fired." `conditionBecomesTrue` sits between the two: a general
 * edge trigger for any closed condition (progress crossing a threshold,
 * draft generation completing) without needing a dedicated enum member
 * for every possible variable transition.
 */
export const BehaviourTriggerSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("whileTrue") }),
  z.strictObject({ type: z.literal("pageEnter"), pageId: IdSchema }),
  z.strictObject({ type: z.literal("pageExit"), pageId: IdSchema }),
  z.strictObject({ type: z.literal("popupOpen"), popupId: IdSchema }),
  z.strictObject({ type: z.literal("popupClose"), popupId: IdSchema }),
  z.strictObject({ type: z.literal("click"), layerId: IdSchema }),
  z.strictObject({ type: z.literal("hoverStart"), layerId: IdSchema }),
  z.strictObject({ type: z.literal("hoverEnd"), layerId: IdSchema }),
  z.strictObject({ type: z.literal("focus"), layerId: IdSchema }),
  z.strictObject({ type: z.literal("blur"), layerId: IdSchema }),
  z.strictObject({ type: z.literal("eventPhaseChange"), toPhase: z.string().min(1) }),
  z.strictObject({ type: z.literal("conditionBecomesTrue"), condition: ConditionSchema }),
]);
export type BehaviourTrigger = z.infer<typeof BehaviourTriggerSchema>;

/**
 * The full closed set of safe visual effects a Behaviour rule may cause.
 * Every action is presentational and reversible — none can call an FDraft
 * business action (points, draft generation, watch-state, eligibility),
 * mutate profile data, or reach outside the current theme's own declared
 * pages/popups/layers/tokens.
 */
export const BehaviourActionSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("show"), layerId: IdSchema }),
  z.strictObject({ type: z.literal("hide"), layerId: IdSchema }),
  /** Enables/disables a purely presentational interaction affordance on the layer — never a host action. */
  z.strictObject({ type: z.literal("setEnabled"), layerId: IdSchema, enabled: z.boolean() }),
  z.strictObject({ type: z.literal("setImageState"), stateGroupId: IdSchema, stateId: IdSchema }),
  /** The same closed allowlist a `ComponentStyleOverride` may use — see `SAFE_COMPONENT_STYLE_PROPERTIES`. */
  z.strictObject({ type: z.literal("applyStyleOverride"), layerId: IdSchema, componentRequirementId: IdSchema, property: SafeComponentStylePropertySchema, value: StyleValueSchema }),
  z.strictObject({ type: z.literal("startAnimation"), animationId: IdSchema }),
  z.strictObject({ type: z.literal("stopAnimation"), animationId: IdSchema }),
  z.strictObject({ type: z.literal("restartAnimation"), animationId: IdSchema }),
  /** Opens/closes/navigates through the host adapter — the renderer never performs browser navigation or DOM mutation itself, only reports the intent as data for the host to act on. */
  z.strictObject({ type: z.literal("openPopup"), popupId: IdSchema }),
  z.strictObject({ type: z.literal("closePopup"), popupId: IdSchema }),
  z.strictObject({ type: z.literal("navigateToPage"), pageId: IdSchema }),
  z.strictObject({ type: z.literal("selectCopyVariant"), layerId: IdSchema, slotKey: z.string().min(1), variantId: IdSchema }),
]);
export type BehaviourAction = z.infer<typeof BehaviourActionSchema>;

/**
 * One no-code rule: fires on `trigger`, gated by `condition` (defaults to
 * always-true), and performs one or more `actions`. `priority` breaks a
 * tie when two enabled rules would otherwise both apply to the same
 * target (e.g. both trying to show/hide the same layer) — the higher
 * `priority` wins; equal priority is broken by array order, later wins.
 * See `@fdraft/theme-renderer`'s `resolveActiveBehaviourRules`/
 * `resolveTriggeredRule` for the one shared, deterministic implementation
 * of this rule — Studio's preview and FDraft's real runtime never
 * interpret rules differently.
 */
export const BehaviourRuleSchema = z.strictObject({
  id: IdSchema,
  name: z.string().min(1),
  enabled: z.boolean().default(true),
  priority: z.number().int().default(0),
  trigger: BehaviourTriggerSchema,
  condition: ConditionSchema.default({ type: "always" }),
  actions: z.array(BehaviourActionSchema).min(1),
});
export type BehaviourRule = z.infer<typeof BehaviourRuleSchema>;

export type { Condition };
