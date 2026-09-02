import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import type { AnimationDeclaration } from "@fdraft/theme-sdk";
import type { RenderableDocument } from "../../src/types.js";
import {
  DEFAULT_HOST_SETTINGS,
  EMPTY_RENDER_STATE,
  type AssetResolver,
  type ComponentAdapterRegistry,
  type ComponentCopyContractRegistry,
  type HostSettings,
  type RenderState,
  type SlotContentRegistry,
} from "../../src/types.js";
import { RendererProvider, buildRendererContextValue } from "../../src/RendererContext.js";

export const EMPTY_DOCUMENT: RenderableDocument = {
  canvas: { width: 1000, height: 1000 },
  tokens: { colors: [], gradients: [], shadows: [], borders: [], spacing: [], radii: [], fonts: [], breakpoints: [] },
  assets: [],
  imageStateGroups: [],
  componentRequirements: [],
  masters: [],
  pages: [],
  popups: [],
};

export const NOOP_ASSET_RESOLVER: AssetResolver = { resolveAsset: () => undefined };

export function renderWithRendererContext(
  ui: ReactElement,
  overrides: {
    document?: RenderableDocument;
    assetResolver?: AssetResolver;
    componentAdapters?: ComponentAdapterRegistry;
    copyContracts?: ComponentCopyContractRegistry;
    hostSettings?: HostSettings;
    renderState?: RenderState;
    viewportWidthPx?: number;
    slotContent?: SlotContentRegistry;
    onInteractionFlagChange?: (layerId: string, which: "hover" | "focus" | "pressed" | "selected", value: boolean) => void;
    containerAnimations?: AnimationDeclaration[];
  } = {},
) {
  const value = buildRendererContextValue(
    overrides.document ?? EMPTY_DOCUMENT,
    overrides.assetResolver ?? NOOP_ASSET_RESOLVER,
    overrides.componentAdapters ?? {},
    {
      hostSettings: overrides.hostSettings ?? DEFAULT_HOST_SETTINGS,
      renderState: overrides.renderState ?? EMPTY_RENDER_STATE,
      viewportWidthPx: overrides.viewportWidthPx,
      slotContent: overrides.slotContent,
      copyContracts: overrides.copyContracts,
      onInteractionFlagChange: overrides.onInteractionFlagChange,
      containerAnimations: overrides.containerAnimations,
    },
  );
  return render(<RendererProvider value={value}>{ui}</RendererProvider>);
}
