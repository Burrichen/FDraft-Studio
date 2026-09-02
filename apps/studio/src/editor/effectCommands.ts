import { createId, DEFAULT_CANVAS_SIZE } from "@fdraft/theme-sdk";
import type { EffectDeclaration, EffectKind, EffectLayer, Id, StudioProjectDocument } from "@fdraft/theme-sdk";
import type { Command } from "../history/commandStack.js";
import type { ContainerRef } from "./containerRef.js";
import { getContainerLayers, updateContainerLayers } from "./containerRef.js";
import { insertLayerInto, updateLayer, removeLayer } from "./layerTree.js";

const EFFECT_KIND_LABEL: Record<EffectKind, string> = {
  rain: "Rain",
  snow: "Snow",
  fog: "Fog",
  leaves: "Leaves",
  dust: "Dust",
  stars: "Stars",
  embers: "Embers",
  confetti: "Confetti",
  fireflies: "Fireflies",
  filmGrain: "Film Grain",
  clouds: "Clouds",
};

/** A new effect layer defaults to covering the whole canvas (a full-bleed ambient effect is the overwhelmingly common case) and appears above every existing sibling — send-to-back with the existing z-order commands if it should sit behind the UI instead. */
export function buildAddEffectLayerCommand(project: StudioProjectDocument, ref: ContainerRef, kind: EffectKind): Command<StudioProjectDocument> {
  const canvas = project.canvas ?? DEFAULT_CANVAS_SIZE;
  const siblings = getContainerLayers(project, ref);
  const zIndex = siblings.length > 0 ? Math.max(...siblings.map((l) => l.zIndex)) + 1 : 0;
  const label = EFFECT_KIND_LABEL[kind];

  const layer: EffectLayer = {
    id: createId(),
    type: "effect",
    name: label,
    effect: { id: createId(), name: label, kind, intensity: 0.5, speed: 1, opacity: 1, seed: 0 },
    transform: { x: 0, y: 0, width: canvas.width, height: canvas.height, rotationDeg: 0, scaleX: 1, scaleY: 1 },
    opacity: 1,
    visible: true,
    locked: false,
    zIndex,
    responsive: [],
    interactionStates: [],
  };

  return {
    label: `Add ${label} effect`,
    do: (p) => updateContainerLayers(p, ref, (layers) => insertLayerInto(layers, "root", layer)),
    undo: (p) => updateContainerLayers(p, ref, (layers) => removeLayer(layers, layer.id).layers),
  };
}

export function buildSetEffectDeclarationCommand(ref: ContainerRef, layerId: Id, before: EffectDeclaration, after: EffectDeclaration): Command<StudioProjectDocument> {
  return {
    label: "Change effect settings",
    do: (p) => updateContainerLayers(p, ref, (layers) => updateLayer(layers, layerId, (l) => (l.type === "effect" ? { ...l, effect: after } : l))),
    undo: (p) => updateContainerLayers(p, ref, (layers) => updateLayer(layers, layerId, (l) => (l.type === "effect" ? { ...l, effect: before } : l))),
  };
}
