import { createId } from "@fdraft/theme-sdk";
import type { BorderToken, ColorToken, GradientToken, RadiusToken, ShadowToken, StudioProjectDocument } from "@fdraft/theme-sdk";
import type { Command } from "../history/commandStack.js";

/** Token creation only needs `do`/`undo` on the flat `tokens.*` arrays — no layer ever references a token until a separate command (e.g. `setShapeFill`) points at it, so adding one is always safe and freely undoable on its own. */
export function buildAddColorTokenCommand(name: string, value: string): { command: Command<StudioProjectDocument>; token: ColorToken } {
  const token: ColorToken = { id: createId(), name, value };
  return {
    token,
    command: {
      label: "New color",
      do: (p) => ({ ...p, tokens: { ...p.tokens, colors: [...p.tokens.colors, token] } }),
      undo: (p) => ({ ...p, tokens: { ...p.tokens, colors: p.tokens.colors.filter((c) => c.id !== token.id) } }),
    },
  };
}

export function buildAddGradientTokenCommand(name: string, stopColorTokenIds: [string, string]): { command: Command<StudioProjectDocument>; token: GradientToken } {
  const token: GradientToken = { id: createId(), name, angleDeg: 90, stops: [{ offset: 0, colorTokenId: stopColorTokenIds[0] }, { offset: 1, colorTokenId: stopColorTokenIds[1] }] };
  return {
    token,
    command: {
      label: "New gradient",
      do: (p) => ({ ...p, tokens: { ...p.tokens, gradients: [...p.tokens.gradients, token] } }),
      undo: (p) => ({ ...p, tokens: { ...p.tokens, gradients: p.tokens.gradients.filter((g) => g.id !== token.id) } }),
    },
  };
}

export function buildAddBorderTokenCommand(name: string, colorTokenId: string): { command: Command<StudioProjectDocument>; token: BorderToken } {
  const token: BorderToken = { id: createId(), name, width: 1, style: "solid", colorTokenId };
  return {
    token,
    command: {
      label: "New border",
      do: (p) => ({ ...p, tokens: { ...p.tokens, borders: [...p.tokens.borders, token] } }),
      undo: (p) => ({ ...p, tokens: { ...p.tokens, borders: p.tokens.borders.filter((b) => b.id !== token.id) } }),
    },
  };
}

export function buildAddRadiusTokenCommand(name: string, value: number): { command: Command<StudioProjectDocument>; token: RadiusToken } {
  const token: RadiusToken = { id: createId(), name, value };
  return {
    token,
    command: {
      label: "New corner radius",
      do: (p) => ({ ...p, tokens: { ...p.tokens, radii: [...p.tokens.radii, token] } }),
      undo: (p) => ({ ...p, tokens: { ...p.tokens, radii: p.tokens.radii.filter((r) => r.id !== token.id) } }),
    },
  };
}

export function buildAddShadowTokenCommand(name: string, colorTokenId: string): { command: Command<StudioProjectDocument>; token: ShadowToken } {
  const token: ShadowToken = { id: createId(), name, offsetX: 0, offsetY: 4, blur: 8, spread: 0, colorTokenId, inset: false };
  return {
    token,
    command: {
      label: "New shadow",
      do: (p) => ({ ...p, tokens: { ...p.tokens, shadows: [...p.tokens.shadows, token] } }),
      undo: (p) => ({ ...p, tokens: { ...p.tokens, shadows: p.tokens.shadows.filter((s) => s.id !== token.id) } }),
    },
  };
}
