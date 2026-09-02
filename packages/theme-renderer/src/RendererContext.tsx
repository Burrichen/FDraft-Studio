import { createContext, useContext } from "react";
import type { AnimationDeclaration, AssetRecord, ColorToken, Id } from "@fdraft/theme-sdk";
import type { AssetResolver, ComponentAdapterRegistry, ComponentCopyContractRegistry, HostSettings, RenderableDocument, RenderState, SlotContentRegistry } from "./types.js";
import { DEFAULT_HOST_SETTINGS, EMPTY_RENDER_STATE } from "./types.js";
import { pickActiveBreakpoint } from "./responsive.js";
import { resolveActiveBehaviourRules, type BehaviourResolution } from "./behaviourResolve.js";

export interface RendererContextValue {
  document: RenderableDocument;
  assetResolver: AssetResolver;
  componentAdapters: ComponentAdapterRegistry;
  copyContracts: ComponentCopyContractRegistry;
  slotContent: SlotContentRegistry;
  hostSettings: HostSettings;
  renderState: RenderState;
  /** Every `whileTrue` Behaviour rule's effect on this render, resolved once per `ThemeRenderer` render rather than per-layer — see `resolveActiveBehaviourRules`. */
  behaviourResolution: BehaviourResolution;
  /** Folds a real pointer/focus/click event on a specific layer into the `renderState` the host re-supplies next render — absent when the host didn't opt in, in which case those layers simply never report hover/focus/pressed/selected. */
  onInteractionFlagChange?: (layerId: Id, which: "hover" | "focus" | "pressed" | "selected", value: boolean) => void;
  /** The current container's own `AnimationDeclaration`s, grouped by `targetLayerId` — see `useLayerAnimation`. Master-declared animations are not inherited (masters are a layout-reuse mechanism; Prompt 7/8 never extended that to animations either). */
  animationsByLayerId: Map<Id, AnimationDeclaration[]>;
  /** Which effect layers are actually allowed to render — the first `PerformanceTierCaps.maxEffectLayers` in document/z-order; the rest render nothing at all. The real, structural protection against an "effect storm," computed once per render by `ThemeRenderer` rather than left for each `EffectLayerView` to guess at independently. `undefined` (only from directly building a context outside `ThemeRenderer`, e.g. an isolated layer test) means no cap is enforced. */
  allowedEffectLayerIds: Set<Id> | undefined;
  activeBreakpointId: string | undefined;
  assetsById: Map<Id, AssetRecord>;
  colorsById: Map<Id, ColorToken>;
}

const RendererReactContext = createContext<RendererContextValue | undefined>(undefined);

export interface BuildRendererContextOptions {
  hostSettings?: HostSettings;
  renderState?: RenderState;
  viewportWidthPx?: number;
  slotContent?: SlotContentRegistry;
  copyContracts?: ComponentCopyContractRegistry;
  onInteractionFlagChange?: RendererContextValue["onInteractionFlagChange"];
  containerAnimations?: AnimationDeclaration[];
  allowedEffectLayerIds?: Set<Id>;
}

export function buildRendererContextValue(
  document: RenderableDocument,
  assetResolver: AssetResolver,
  componentAdapters: ComponentAdapterRegistry,
  options: BuildRendererContextOptions = {},
): RendererContextValue {
  const { hostSettings = DEFAULT_HOST_SETTINGS, renderState = EMPTY_RENDER_STATE, viewportWidthPx, slotContent = {}, copyContracts = {}, onInteractionFlagChange, containerAnimations = [], allowedEffectLayerIds } = options;
  const activeBreakpoint =
    viewportWidthPx !== undefined ? pickActiveBreakpoint(document.tokens.breakpoints, viewportWidthPx) : undefined;
  const animationsByLayerId = new Map<Id, AnimationDeclaration[]>();
  for (const animation of containerAnimations) {
    const list = animationsByLayerId.get(animation.targetLayerId) ?? [];
    list.push(animation);
    animationsByLayerId.set(animation.targetLayerId, list);
  }
  return {
    document,
    assetResolver,
    componentAdapters,
    copyContracts,
    slotContent,
    hostSettings,
    renderState,
    behaviourResolution: resolveActiveBehaviourRules(document.behaviourRules ?? [], renderState, hostSettings),
    onInteractionFlagChange,
    animationsByLayerId,
    allowedEffectLayerIds,
    activeBreakpointId: activeBreakpoint?.id,
    assetsById: new Map(document.assets.map((a) => [a.id, a])),
    colorsById: new Map(document.tokens.colors.map((c) => [c.id, c])),
  };
}

export const RendererProvider = RendererReactContext.Provider;

export function useRendererContext(): RendererContextValue {
  const value = useContext(RendererReactContext);
  if (!value) {
    throw new Error("useRendererContext must be used within a <ThemeRenderer>");
  }
  return value;
}

export function resolveColor(colorsById: Map<Id, ColorToken>, tokenId: Id | undefined): string | undefined {
  if (tokenId === undefined) return undefined;
  return colorsById.get(tokenId)?.value;
}
