import type { ErrorInfo, ReactNode } from "react";
import type { Id, Layer } from "@fdraft/theme-sdk";
import type {
  AssetResolver,
  ComponentAdapterRegistry,
  ComponentCopyContractRegistry,
  HostSettings,
  RenderableDocument,
  RenderState,
  SlotContentRegistry,
} from "./types.js";
import { DEFAULT_HOST_SETTINGS } from "./types.js";
import { RendererProvider, buildRendererContextValue } from "./RendererContext.js";
import { RenderErrorBoundary } from "./ErrorBoundary.js";
import { PageStage } from "./PageStage.js";
import { resolveContainerLayers } from "./inheritance.js";
import { performanceCapsFor } from "./performanceCaps.js";

function allEffectLayerIdsInOrder(layers: Layer[]): Id[] {
  const ids: Id[] = [];
  (function walk(ls: Layer[]) {
    for (const l of ls) {
      if (l.type === "effect") ids.push(l.id);
      if (l.type === "group") walk(l.children);
    }
  })(layers);
  return ids;
}

export type ThemeRenderTarget = { kind: "page"; pageId: Id } | { kind: "popup"; popupId: Id };

export interface ThemeRendererProps {
  document: RenderableDocument;
  assetResolver: AssetResolver;
  componentAdapters: ComponentAdapterRegistry;
  /** Each placed component's declared copy slots — see `ComponentCopySlotDeclaration`. Omitted keys render with no editable copy passed through (an adapter with no declared slots gets `copy: {}`). */
  copyContracts?: ComponentCopyContractRegistry;
  target: ThemeRenderTarget;
  slotContent?: SlotContentRegistry;
  hostSettings?: HostSettings;
  renderState?: RenderState;
  /** The host's actual rendered width, used to pick the active responsive breakpoint. */
  viewportWidthPx?: number;
  /** Reports a real pointer/focus/click event on a specific layer — omit to leave hover/focus/pressed/selected permanently unset (the safe default in a context where no such events exist, e.g. server rendering). See `applyInteractionFlagChange`. */
  onInteractionFlagChange?: (layerId: Id, which: "hover" | "focus" | "pressed" | "selected", value: boolean) => void;
  /**
   * What to show if rendering fails for any reason — a bad master chain,
   * an unexpected exception deep in a layer, anything. Defaults to a
   * minimal, visibly-safe placeholder. The host embedding this renderer
   * (FDraft, Studio, this package's own fixture lab) keeps running either
   * way; only this component's own subtree is replaced.
   */
  fallback?: (error: Error) => ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}

/**
 * Throws during its own render so `RenderErrorBoundary` (a strict
 * ancestor once this is mounted as its child) actually catches it. A bare
 * `throw` inside `ThemeRenderer`'s own render body would instead propagate
 * past the boundary it's lexically inside of, since that boundary hasn't
 * finished mounting yet — React only catches errors from a *descendant*
 * component's render.
 */
function ThrowRenderError({ message }: { message: string }): ReactNode {
  throw new Error(message);
}

interface RenderedStageProps {
  document: RenderableDocument;
  assetResolver: AssetResolver;
  componentAdapters: ComponentAdapterRegistry;
  copyContracts?: ComponentCopyContractRegistry;
  target: ThemeRenderTarget;
  slotContent?: SlotContentRegistry;
  hostSettings?: HostSettings;
  renderState?: RenderState;
  viewportWidthPx?: number;
  onInteractionFlagChange?: ThemeRendererProps["onInteractionFlagChange"];
}

/**
 * Everything that can throw a "this theme is broken" error — resolving
 * master inheritance included — happens in here, a genuine descendant of
 * `RenderErrorBoundary`, never directly in `ThemeRenderer`'s own render
 * body (see `ThrowRenderError`'s docstring for why that distinction
 * matters to React).
 */
function RenderedStage({ document, assetResolver, componentAdapters, copyContracts, target, slotContent, hostSettings, renderState, viewportWidthPx, onInteractionFlagChange }: RenderedStageProps): ReactNode {
  const container = target.kind === "page" ? document.pages.find((p) => p.id === target.pageId) : document.popups.find((p) => p.id === target.popupId);
  if (!container) {
    return <ThrowRenderError message={target.kind === "page" ? `page ${target.pageId} does not exist in this theme` : `popup ${target.popupId} does not exist in this theme`} />;
  }

  const layers = resolveContainerLayers(container, document.masters);
  const caps = performanceCapsFor(hostSettings ?? DEFAULT_HOST_SETTINGS);
  const allowedEffectLayerIds = new Set(allEffectLayerIdsInOrder(layers).slice(0, caps.maxEffectLayers));

  const contextValue = buildRendererContextValue(document, assetResolver, componentAdapters, {
    hostSettings,
    renderState,
    viewportWidthPx,
    slotContent,
    copyContracts,
    onInteractionFlagChange,
    containerAnimations: container.animations,
    allowedEffectLayerIds,
  });

  return (
    <RendererProvider value={contextValue}>
      <PageStage container={container} kind={target.kind} layers={layers} />
    </RendererProvider>
  );
}

function defaultFallback(error: Error): ReactNode {
  return (
    <div
      data-fdraft-error="theme-render-failed"
      role="alert"
      style={{
        padding: 16,
        border: "2px solid #a94442",
        background: "#f2dede",
        color: "#a94442",
        fontFamily: "sans-serif",
        fontSize: "0.875rem",
      }}
    >
      <strong>This theme could not be rendered.</strong>
      <div>{error.message}</div>
    </div>
  );
}

/** The single entry point every host (fixture lab, Studio, FDraft) renders a validated theme document through. */
export function ThemeRenderer({
  document,
  assetResolver,
  componentAdapters,
  copyContracts,
  target,
  slotContent,
  hostSettings,
  renderState,
  viewportWidthPx,
  onInteractionFlagChange,
  fallback = defaultFallback,
  onError,
}: ThemeRendererProps): ReactNode {
  return (
    <RenderErrorBoundary fallback={fallback} onError={onError}>
      <RenderedStage
        document={document}
        assetResolver={assetResolver}
        componentAdapters={componentAdapters}
        copyContracts={copyContracts}
        target={target}
        slotContent={slotContent}
        hostSettings={hostSettings}
        renderState={renderState}
        viewportWidthPx={viewportWidthPx}
        onInteractionFlagChange={onInteractionFlagChange}
      />
    </RenderErrorBoundary>
  );
}
