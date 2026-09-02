import { useState } from "react";
import type { EffectKind, Id, Layer, StudioProjectDocument } from "@fdraft/theme-sdk";
import type { Command } from "../../history/commandStack.js";
import type { ContainerRef } from "../../editor/containerRef.js";
import { isGroupLayer } from "../../editor/layerTree.js";
import { buildReparentCommand, setLayersLocked, setLayersVisible } from "../../editor/layerCommands.js";
import { buildAddEffectLayerCommand } from "../../editor/effectCommands.js";
import { selectSingle, toggleSelection, type Selection } from "../../editor/selection.js";

const EFFECT_KINDS: { value: EffectKind; label: string }[] = [
  { value: "rain", label: "Rain" },
  { value: "snow", label: "Snow" },
  { value: "fog", label: "Fog" },
  { value: "leaves", label: "Leaves" },
  { value: "dust", label: "Dust" },
  { value: "stars", label: "Stars" },
  { value: "embers", label: "Embers" },
  { value: "confetti", label: "Confetti" },
  { value: "fireflies", label: "Fireflies" },
  { value: "filmGrain", label: "Film Grain" },
  { value: "clouds", label: "Clouds" },
];

export interface LayersPanelProps {
  project: StudioProjectDocument;
  containerRef: ContainerRef;
  layers: Layer[];
  selection: Selection;
  onSelectionChange: (selection: Selection) => void;
  applyCommand: (command: Command<StudioProjectDocument>) => void;
}

const ICONS: Record<Layer["type"], string> = {
  image: "🖼",
  text: "T",
  shape: "▭",
  effect: "✨",
  component: "◆",
  slot: "▢",
  group: "▶",
};

export function LayersPanel({ project, containerRef, layers, selection, onSelectionChange, applyCommand }: LayersPanelProps): React.ReactNode {
  const [query, setQuery] = useState("");
  const [dragOverId, setDragOverId] = useState<Id | undefined>(undefined);

  const q = query.trim().toLowerCase();
  function matches(layer: Layer): boolean {
    if (!q) return true;
    if (layer.name.toLowerCase().includes(q)) return true;
    return isGroupLayer(layer) && layer.children.some(matches);
  }

  const visible = q ? layers.filter(matches) : layers;

  function handleClick(layer: Layer, event: React.MouseEvent): void {
    const nextSelection = event.shiftKey ? toggleSelection(selection, layer.id) : selectSingle(layer.id);
    onSelectionChange(nextSelection);
  }

  function handleDrop(targetId: Id | "root", event: React.DragEvent): void {
    event.preventDefault();
    setDragOverId(undefined);
    const draggedId = event.dataTransfer.getData("text/fdraft-layer-id");
    if (!draggedId || draggedId === targetId) return;
    const cmd = buildReparentCommand(project, containerRef, draggedId, targetId, 0);
    if (cmd) applyCommand(cmd);
  }

  function renderLayer(layer: Layer, depth: number): React.ReactNode {
    const selected = selection.has(layer.id);
    return (
      <li key={layer.id}>
        <div
          className={`layers-row${selected ? " layers-row-selected" : ""}${dragOverId === layer.id ? " layers-row-dragover" : ""}`}
          style={{ paddingLeft: 8 + depth * 14 }}
          draggable
          onDragStart={(e) => e.dataTransfer.setData("text/fdraft-layer-id", layer.id)}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverId(layer.id);
          }}
          onDragLeave={() => setDragOverId(undefined)}
          onDrop={(e) => handleDrop(isGroupLayer(layer) ? layer.id : "root", e)}
        >
          <button type="button" className="layers-select" aria-pressed={selected} onClick={(e) => handleClick(layer, e)}>
            <span className="layers-icon" aria-hidden="true">
              {ICONS[layer.type]}
            </span>
            <span className="layers-name">{layer.name}</span>
          </button>
          <button
            type="button"
            className="layers-toggle"
            aria-label={layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`}
            aria-pressed={!layer.visible}
            onClick={() => applyCommand(setLayersVisible(containerRef, [layer.id], !layer.visible))}
          >
            {layer.visible ? "👁" : "🚫"}
          </button>
          <button
            type="button"
            className="layers-toggle"
            aria-label={layer.locked ? `Unlock ${layer.name}` : `Lock ${layer.name}`}
            aria-pressed={layer.locked}
            onClick={() => applyCommand(setLayersLocked(containerRef, [layer.id], !layer.locked))}
          >
            {layer.locked ? "🔒" : "🔓"}
          </button>
        </div>
        {isGroupLayer(layer) && layer.children.length > 0 && <ul className="layers-children">{layer.children.filter(matches).map((child) => renderLayer(child, depth + 1))}</ul>}
      </li>
    );
  }

  return (
    <div className="layers-panel">
      <div className="layers-panel-toolbar">
        <input type="search" className="layers-search" placeholder="Search layers…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search layers" />
        <select
          aria-label="Add effect layer"
          value=""
          onChange={(e) => {
            if (!e.target.value) return;
            applyCommand(buildAddEffectLayerCommand(project, containerRef, e.target.value as EffectKind));
          }}
        >
          <option value="">+ Effect…</option>
          {EFFECT_KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      </div>
      <ul
        className="layers-tree"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => handleDrop("root", e)}
      >
        {visible.map((layer) => renderLayer(layer, 0))}
        {visible.length === 0 && <li className="left-panel-empty">{q ? "No layers match your search" : "No layers yet"}</li>}
      </ul>
    </div>
  );
}

