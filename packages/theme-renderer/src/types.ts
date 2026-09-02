import type { ComponentType, ReactNode } from "react";
import type {
  AssetRecord,
  BehaviourRule,
  ComponentRequirement,
  DesignTokens,
  Id,
  ImageStateGroup,
  MasterPage,
  Page,
  Popup,
  CanvasSize,
} from "@fdraft/theme-sdk";

/**
 * The structural shape the renderer needs. Satisfied by
 * `RuntimeThemeDocument` (the normal case — a compiled theme) and by any
 * equivalent shape a host derives from a `StudioProjectDocument` itself
 * (e.g. Studio's live preview before a project is compiled) as long as
 * editor-only fields are left out. The renderer never reads a `manifest`
 * or `editorState` field — it doesn't know either exists.
 */
export interface RenderableDocument {
  canvas?: CanvasSize;
  tokens: DesignTokens;
  assets: AssetRecord[];
  imageStateGroups: ImageStateGroup[];
  componentRequirements: ComponentRequirement[];
  masters: MasterPage[];
  pages: Page[];
  popups: Popup[];
  /** Optional so a `RenderableDocument` built before this field existed still satisfies the interface — treated as `[]` wherever it's read. */
  behaviourRules?: BehaviourRule[];
}

/**
 * Resolves a bundled asset id to a usable `src`/URL. The renderer never
 * uses any URL that didn't come from this function — asset ids not
 * present in the document's own `assets` array are never looked up at
 * all, and a resolver returning `undefined` renders the layer's
 * "missing asset" fallback instead of guessing at a path.
 */
export interface AssetResolver {
  resolveAsset(assetId: Id): string | undefined;
}

export function createStaticAssetResolver(urlsByAssetId: Record<Id, string>): AssetResolver {
  return {
    resolveAsset: (assetId) => urlsByAssetId[assetId],
  };
}

/**
 * Renderer-affecting host preferences, independent of any one page.
 * `performanceTier` gates both particle effects and Prompt-9 keyframe
 * animations against documented, fixed caps — see
 * `PERFORMANCE_TIER_CAPS` — never an exact hardware performance
 * measurement: "low" shows everything in its resting/final state with no
 * motion and no effects at all; "medium" plays animations and effects at
 * a reduced particle/DPI cap; "high" is this phase's full experience.
 */
export interface HostSettings {
  reducedMotion: boolean;
  performanceTier: "low" | "medium" | "high";
}

export const DEFAULT_HOST_SETTINGS: HostSettings = { reducedMotion: false, performanceTier: "high" };

/**
 * The read-only, presentation-safe event/profile context a Behaviour
 * condition may compare against — see `RuntimeVariable`. Deliberately
 * excludes anything a theme must never see or influence: unrestricted
 * profile records, filesystem access, points mutation, draft generation,
 * watch-state mutation, or event eligibility decisions. `eventId` is
 * carried for host/adapter bookkeeping (e.g. analytics, placeholder
 * substitution) but is not itself a comparable `RuntimeVariable` — a
 * no-code rule author has no legitimate reason to hardcode one event's
 * UUID into a condition.
 */
export interface EventRenderContext {
  eventId?: string;
  eventActive?: boolean;
  eventAvailable?: boolean;
  optedIn?: boolean;
  draftGenerated?: boolean;
  progressPercent?: number;
  watchedCount?: number;
  targetCount?: number;
  eventCompleted?: boolean;
}

/** A single layer's current real interaction state, as tracked by whichever host mounts the renderer (native DOM events in a browser/webview) — never host business data. */
export interface LayerInteractionFlags {
  hover?: boolean;
  focus?: boolean;
  pressed?: boolean;
  /** Toggles on click; a theme opts in to it by referencing it in a condition. No host-supplied meaning beyond that. */
  selected?: boolean;
}

/**
 * The live, mutable-per-render state a theme's declarative conditions
 * read — event/profile context, which image-state-group states are
 * currently active, what event phase is in effect, per-layer interaction
 * flags, and which copy variant is active per component slot. The
 * renderer never invents or mutates this itself; it is entirely
 * host-supplied (real event/profile state in FDraft, mock state in Studio
 * and the fixture lab) — except `interactionFlags`, which a host derives
 * from real pointer/focus/click events on the layers this renderer itself
 * draws (see `ThemeRendererProps.onInteractionFlagChange` and
 * `applyInteractionFlagChange`).
 */
export interface RenderState {
  activeImageStates: Record<Id, Id>;
  eventPhase?: string;
  event?: EventRenderContext;
  currentPageId?: Id;
  currentPopupId?: Id;
  /** Host-named points in time, in epoch milliseconds (e.g. `"now"`, `"eventStartAt"`) — which keys exist is a host/renderer contract, not enforced by the schema. */
  dateTimeValues?: Record<string, number>;
  interactionFlags?: Record<Id, LayerInteractionFlags>;
  /** Which copy variant (by id) is currently selected per component layer/slot — set by a Behaviour rule's `selectCopyVariant` action via `RendererContext`'s computed resolution, or seeded directly by a host. */
  activeCopyVariants?: Record<Id, Record<string, Id>>;
  /**
   * Resolved values for the closed set of runtime placeholders a copy
   * slot may reference (e.g. `eventName`, `watchedCount`, `targetCount`,
   * `progress`, `eventDate`) — host-supplied dynamic content, never
   * theme-authored. A `{{name}}` token in copy text only gets substituted
   * when the owning slot's `allowedPlaceholders` names it AND a value is
   * present here; otherwise the literal token is left in place rather
   * than silently dropped, so an unresolved placeholder stays visible
   * (and easy to flag) instead of disappearing.
   */
  placeholderValues?: Record<string, string>;
}

export const EMPTY_RENDER_STATE: RenderState = { activeImageStates: {} };

/** Pure, immutable update — the pattern a host uses to fold a real DOM interaction event into the `renderState` it re-supplies on the next render. Never mutates its input. */
export function applyInteractionFlagChange(state: RenderState, layerId: Id, which: keyof LayerInteractionFlags, value: boolean): RenderState {
  return {
    ...state,
    interactionFlags: {
      ...state.interactionFlags,
      [layerId]: { ...state.interactionFlags?.[layerId], [which]: value },
    },
  };
}

/**
 * One editable visible-copy slot a component adapter declares — never
 * its action/route/event logic, only what it displays. `required: true`
 * means the slot can never render as empty text (an empty/blank
 * theme-authored override falls back to `defaultText`); `accessibleNameFallback`
 * is what a host uses for e.g. `aria-label` when the visible text alone
 * wouldn't be a safe accessible name (icon-only buttons, heavily
 * placeholder-driven copy).
 */
export interface ComponentCopySlotDeclaration {
  key: string;
  label: string;
  defaultText: string;
  required: boolean;
  /** Character-count guidance shown to the theme author — advisory, not enforced by the schema. */
  maxLength?: number;
  /** The closed set of `{{name}}` runtime placeholders this slot may reference — see `RenderState.placeholderValues`. */
  allowedPlaceholders?: string[];
  accessibleNameFallback?: string;
}

/** A component's full copy contract — one entry per editable slot. Declared per `componentKey`, independent of which host's adapter actually renders it. */
export type ComponentCopyContractRegistry = Record<string, ComponentCopySlotDeclaration[]>;

/** Props every host-supplied component adapter receives. A theme can style, position, and edit declared copy for only this outer shell — never reach inside it or change its action/route/event logic. */
export interface ComponentAdapterProps {
  componentKey: string;
  requirement: ComponentRequirement;
  /** Only the style properties `requirement.allowedProperties` permits, already narrowed by the caller. */
  style: Record<string, string | number>;
  widthPx: number;
  heightPx: number;
  /** Resolved, placeholder-substituted text per declared copy-slot key — see `ComponentCopyContractRegistry`/`resolveComponentCopy`. Empty object for a component with no declared copy slots. */
  copy: Record<string, string>;
  /** Whether this component's own presentational interaction affordance (e.g. a hover/press look) should behave as enabled — set by a Behaviour rule's `setEnabled` action, `true` by default. Never a host business action: an adapter still owns whatever real action firing means. */
  enabled: boolean;
}

export type ComponentAdapter = ComponentType<ComponentAdapterProps>;

export type ComponentAdapterRegistry = Record<string, ComponentAdapter>;

/**
 * Optional host content for named slot/zone layers, keyed by `slotKey`.
 * A slot with no matching entry renders a placeholder shell instead —
 * slots are always safe to render even when a host supplies nothing.
 */
export type SlotContentRegistry = Record<string, ReactNode>;
