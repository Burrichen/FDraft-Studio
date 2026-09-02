import { useState } from "react";
import type { AnimationDeclaration, AnimationPreset, ComponentLayer, EffectKind, EffectLayer, Layer, Mask, ShapeLayer, StudioProjectDocument, TextLayer, ZoneKind } from "@fdraft/theme-sdk";
import type { ComponentCopyContractRegistry, ComponentCopySlotDeclaration } from "@fdraft/theme-renderer";
import { buildSetEffectDeclarationCommand } from "../../editor/effectCommands.js";
import { buildAddAnimationCommand, buildDeleteAnimationCommand, buildUpdateAnimationCommand } from "../../editor/animationCommands.js";
import { getContainerAnimations } from "../../editor/containerRef.js";
import type { Command } from "../../history/commandStack.js";
import type { ContainerRef } from "../../editor/containerRef.js";
import {
  buildAlignCommand,
  buildDeleteCommand,
  buildDistributeCommand,
  buildDuplicateCommand,
  buildGroupCommand,
  buildUngroupCommand,
  buildZOrderCommand,
  renameLayer,
  setComponentCopyOverride,
  setComponentZoneKind,
  setLayerCrop,
  setLayerMask,
  setLayerOpacity,
  setLayerText,
  setLayerTextAlign,
  setLayerTransforms,
  setLayersLocked,
  setLayersVisible,
  setShapeCornerRadius,
  setShapeFillColor,
  type AlignEdge,
} from "../../editor/layerCommands.js";
import { buildAddColorTokenCommand, buildAddRadiusTokenCommand } from "../../editor/tokenCommands.js";
import { roundTransform } from "../../editor/geometry.js";
import type { Selection } from "../../editor/selection.js";

const ZONE_KINDS: ZoneKind[] = ["header", "sidebar", "main", "overlay", "footer"];

export interface PropertiesPanelProps {
  project: StudioProjectDocument;
  containerRef: ContainerRef;
  flatById: Map<string, Layer>;
  selection: Selection;
  onSelectionChange: (selection: Selection) => void;
  applyCommand: (command: Command<StudioProjectDocument>) => void;
  copyContracts: ComponentCopyContractRegistry;
}

type TextAlign = TextLayer["align"];

const ALIGN_EDGES: { edge: AlignEdge; label: string }[] = [
  { edge: "left", label: "Align left" },
  { edge: "center", label: "Align center" },
  { edge: "right", label: "Align right" },
  { edge: "top", label: "Align top" },
  { edge: "middle", label: "Align middle" },
  { edge: "bottom", label: "Align bottom" },
];

/**
 * Every numeric/text field here commits on blur/Enter rather than on
 * every keystroke, and each is keyed by the selected layer's id so React
 * remounts (and reinitialises local draft state) whenever the *selected
 * layer itself* changes — the same pattern `RightPanel` already uses for
 * project metadata, extended to per-layer editing.
 */
export function PropertiesPanel({ project, containerRef, flatById, selection, onSelectionChange, applyCommand, copyContracts }: PropertiesPanelProps): React.ReactNode {
  const ids = [...selection];
  if (ids.length === 0) {
    return (
      <div className="properties-panel">
        <p className="right-panel-placeholder">Select a layer to edit its properties.</p>
      </div>
    );
  }

  const layers = ids.map((id) => flatById.get(id)).filter((l): l is Layer => !!l);
  if (layers.length === 0) return null;

  return (
    <div className="properties-panel">
      <h2>{layers.length === 1 ? "Layer" : `${layers.length} layers`}</h2>

      {layers.length === 1 ? (
        <>
          <SingleLayerFields key={layers[0]!.id} layer={layers[0]!} project={project} containerRef={containerRef} applyCommand={applyCommand} copyContracts={copyContracts} />
          <AnimationsSection key={`${layers[0]!.id}-animations`} layer={layers[0]!} containerRef={containerRef} applyCommand={applyCommand} animations={getContainerAnimations(project, containerRef)} />
        </>
      ) : (
        <MultiLayerFields layers={layers} containerRef={containerRef} project={project} applyCommand={applyCommand} />
      )}

      <div className="field-row">
        <label className="checkbox-field">
          <input type="checkbox" checked={layers.every((l) => l.visible)} onChange={(e) => applyCommand(setLayersVisible(containerRef, ids, e.target.checked))} />
          Visible
        </label>
        <label className="checkbox-field">
          <input type="checkbox" checked={layers.every((l) => l.locked)} onChange={(e) => applyCommand(setLayersLocked(containerRef, ids, e.target.checked))} />
          Locked
        </label>
      </div>

      <h3>Arrange</h3>
      <div className="button-row">
        <button type="button" onClick={() => run(buildZOrderCommand(project, containerRef, ids, "front"))}>
          Front
        </button>
        <button type="button" onClick={() => run(buildZOrderCommand(project, containerRef, ids, "forward"))}>
          Forward
        </button>
        <button type="button" onClick={() => run(buildZOrderCommand(project, containerRef, ids, "backward"))}>
          Backward
        </button>
        <button type="button" onClick={() => run(buildZOrderCommand(project, containerRef, ids, "back"))}>
          Back
        </button>
      </div>

      {layers.length >= 2 && (
        <>
          <h3>Align</h3>
          <div className="button-row">
            {ALIGN_EDGES.map(({ edge, label }) => (
              <button key={edge} type="button" onClick={() => run(buildAlignCommand(project, containerRef, ids, edge))}>
                {label}
              </button>
            ))}
          </div>
        </>
      )}
      {layers.length >= 3 && (
        <div className="button-row">
          <button type="button" onClick={() => run(buildDistributeCommand(project, containerRef, ids, "horizontal"))}>
            Distribute horizontally
          </button>
          <button type="button" onClick={() => run(buildDistributeCommand(project, containerRef, ids, "vertical"))}>
            Distribute vertically
          </button>
        </div>
      )}

      <h3>Layer</h3>
      <div className="button-row">
        <button type="button" onClick={() => run(buildDuplicateCommand(project, containerRef, ids))}>
          Duplicate
        </button>
        <button
          type="button"
          onClick={() => {
            run(buildDeleteCommand(project, containerRef, ids));
            onSelectionChange(new Set());
          }}
        >
          Delete
        </button>
        {layers.length >= 2 && (
          <button type="button" onClick={() => run(buildGroupCommand(project, containerRef, ids))}>
            Group
          </button>
        )}
        {layers.length === 1 && layers[0]!.type === "group" && (
          <button type="button" onClick={() => run(buildUngroupCommand(project, containerRef, layers[0]!.id))}>
            Ungroup
          </button>
        )}
      </div>
    </div>
  );

  function run(command: Command<StudioProjectDocument> | null): void {
    if (command) applyCommand(command);
  }
}

function SingleLayerFields({ layer, project, containerRef, applyCommand, copyContracts }: { layer: Layer; project: StudioProjectDocument; containerRef: ContainerRef; applyCommand: (c: Command<StudioProjectDocument>) => void; copyContracts: ComponentCopyContractRegistry }): React.ReactNode {
  const [name, setName] = useState(layer.name);
  const t = roundTransform(layer.transform);
  const [x, setX] = useState(String(t.x));
  const [y, setY] = useState(String(t.y));
  const [width, setWidth] = useState(String(t.width));
  const [height, setHeight] = useState(String(t.height));
  const [rotation, setRotation] = useState(String(t.rotationDeg));
  const [opacity, setOpacity] = useState(String(Math.round(layer.opacity * 100)));
  const [text, setText] = useState(layer.type === "text" ? layer.text : "");

  function commitTransform(patch: Partial<typeof t>): void {
    applyCommand(setLayerTransforms(containerRef, [{ layerId: layer.id, before: layer.transform, after: { ...layer.transform, ...patch } }], "Edit properties"));
  }

  return (
    <>
      <label className="field">
        Name
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            if (name.trim() && name !== layer.name) applyCommand(renameLayer(containerRef, layer.id, layer.name, name.trim()));
          }}
        />
      </label>

      <div className="field-grid">
        <NumberField label="X" value={x} onChange={setX} onCommit={(v) => commitTransform({ x: v })} />
        <NumberField label="Y" value={y} onChange={setY} onCommit={(v) => commitTransform({ y: v })} />
        <NumberField label="W" value={width} onChange={setWidth} onCommit={(v) => commitTransform({ width: Math.max(1, v) })} />
        <NumberField label="H" value={height} onChange={setHeight} onCommit={(v) => commitTransform({ height: Math.max(1, v) })} />
        <NumberField label="Rotation°" value={rotation} onChange={setRotation} onCommit={(v) => commitTransform({ rotationDeg: v })} />
        <NumberField label="Opacity%" value={opacity} onChange={setOpacity} onCommit={(v) => applyCommand(setLayerOpacity(containerRef, layer.id, layer.opacity, Math.max(0, Math.min(100, v)) / 100))} />
      </div>

      {layer.type === "text" && (
        <>
          <label className="field">
            Text
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onBlur={() => {
                if (text !== layer.text) applyCommand(setLayerText(containerRef, layer.id, layer.text, text));
              }}
            />
          </label>
          <label className="field">
            Alignment
            <select value={layer.align} onChange={(e) => applyCommand(setLayerTextAlign(containerRef, layer.id, layer.align, e.target.value as TextAlign))}>
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
              <option value="justify">Justify</option>
            </select>
          </label>
        </>
      )}

      {layer.type === "image" && (
        <>
          <div className="button-row">
            <button type="button" disabled={!layer.crop} onClick={() => applyCommand(setLayerCrop(containerRef, layer.id, layer.crop, undefined))}>
              Reset crop
            </button>
          </div>
          <label className="field">
            Mask
            <select
              value={layer.mask?.type ?? "none"}
              onChange={(e) => {
                const type = e.target.value as Mask["type"];
                const after: Mask | undefined = type === "none" ? undefined : { type };
                applyCommand(setLayerMask(containerRef, layer.id, layer.mask, after));
              }}
            >
              <option value="none">None</option>
              <option value="rect">Rectangle</option>
              <option value="ellipse">Ellipse / circle</option>
              <option value="image">Image-based (asset picker not yet available)</option>
            </select>
          </label>
        </>
      )}

      {layer.type === "shape" && <ShapeLayerFields layer={layer} project={project} containerRef={containerRef} applyCommand={applyCommand} />}

      {layer.type === "component" && <ComponentLayerFields layer={layer} containerRef={containerRef} applyCommand={applyCommand} copyContracts={copyContracts} />}

      {layer.type === "effect" && <EffectLayerFields layer={layer} containerRef={containerRef} applyCommand={applyCommand} />}
    </>
  );
}

const EFFECT_KIND_OPTIONS: EffectKind[] = ["rain", "snow", "fog", "leaves", "dust", "stars", "embers", "confetti", "fireflies", "filmGrain", "clouds"];

/** An uncontrolled numeric field committing on blur/Enter — the same documented "doesn't live-resync from an external change while still selected" tradeoff `SingleLayerFields`'s own numeric fields already accept, extended here instead of introducing a second, controlled-input pattern to keep in sync. */
function UncontrolledNumberField({ label, defaultValue, onCommit }: { label: string; defaultValue: string; onCommit: (v: number) => void }): React.ReactNode {
  return (
    <label className="field field-number">
      {label}
      <input
        type="number"
        defaultValue={defaultValue}
        onBlur={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onCommit(n);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
    </label>
  );
}

/** Kind is fixed once an effect layer is created — each kind has a genuinely different config shape and motion pattern, so changing kind is a delete-and-recreate rather than an in-place field. */
function EffectLayerFields({ layer, containerRef, applyCommand }: { layer: EffectLayer; containerRef: ContainerRef; applyCommand: (c: Command<StudioProjectDocument>) => void }): React.ReactNode {
  const effect = layer.effect;
  function update(patch: Partial<typeof effect>): void {
    applyCommand(buildSetEffectDeclarationCommand(containerRef, layer.id, effect, { ...effect, ...patch }));
  }

  return (
    <>
      <h3>Effect: {EFFECT_KIND_OPTIONS.includes(effect.kind) ? effect.kind : effect.kind}</h3>
      <div className="field-grid" key={layer.id}>
        <label className="field">
          Intensity
          <input type="range" min={0} max={1} step={0.05} value={effect.intensity} onChange={(e) => update({ intensity: Number(e.target.value) })} />
        </label>
        <label className="field">
          Speed
          <input type="range" min={0} max={5} step={0.1} value={effect.speed} onChange={(e) => update({ speed: Number(e.target.value) })} />
        </label>
        <UncontrolledNumberField label="Direction°" defaultValue={String(effect.directionDeg ?? 0)} onCommit={(v) => update({ directionDeg: ((v % 360) + 360) % 360 })} />
        <label className="field">
          Opacity
          <input type="range" min={0} max={1} step={0.05} value={effect.opacity} onChange={(e) => update({ opacity: Number(e.target.value) })} />
        </label>
        <UncontrolledNumberField label="Min size (px)" defaultValue={String(effect.sizeRange?.minPx ?? "")} onCommit={(v) => update({ sizeRange: { minPx: Math.max(1, v), maxPx: Math.max(Math.max(1, v), effect.sizeRange?.maxPx ?? v) } })} />
        <UncontrolledNumberField label="Max size (px)" defaultValue={String(effect.sizeRange?.maxPx ?? "")} onCommit={(v) => update({ sizeRange: { minPx: Math.min(effect.sizeRange?.minPx ?? v, v), maxPx: Math.max(1, v) } })} />
        <UncontrolledNumberField label="Seed" defaultValue={String(effect.seed)} onCommit={(v) => update({ seed: Math.max(0, Math.round(v)) })} />
      </div>
      <p className="field-hint">Behind or in front of the UI is controlled by this layer&apos;s own front/back position — see Arrange above.</p>
    </>
  );
}

const ANIMATION_PRESET_OPTIONS: AnimationPreset[] = ["fade", "rise", "fall", "slideLeft", "slideRight", "scalePop", "float", "wobble", "pulse", "sway"];

/**
 * Every animation targeting the selected layer — entrance/exit play
 * automatically; a `manual` one only plays when a Behaviour rule's
 * `startAnimation` says so (see Behaviour Mode) — hover/focus/pressed and
 * rule-gated idle loops are built there, not here.
 */
function AnimationsSection({ layer, containerRef, applyCommand, animations }: { layer: Layer; containerRef: ContainerRef; applyCommand: (c: Command<StudioProjectDocument>) => void; animations: AnimationDeclaration[] }): React.ReactNode {
  const targeting = animations.filter((a) => a.targetLayerId === layer.id);

  return (
    <>
      <h3>Animations</h3>
      {targeting.map((animation) => (
        <AnimationFields key={animation.id} animation={animation} containerRef={containerRef} applyCommand={applyCommand} />
      ))}
      <div className="button-row">
        <button
          type="button"
          onClick={() => {
            const { command } = buildAddAnimationCommand(containerRef, layer.id);
            applyCommand(command);
          }}
        >
          + Add animation
        </button>
      </div>
    </>
  );
}

function AnimationFields({ animation, containerRef, applyCommand }: { animation: AnimationDeclaration; containerRef: ContainerRef; applyCommand: (c: Command<StudioProjectDocument>) => void }): React.ReactNode {
  function update(patch: Partial<AnimationDeclaration>): void {
    applyCommand(buildUpdateAnimationCommand(containerRef, animation.id, animation, { ...animation, ...patch }));
  }

  const preset = animation.motion?.type === "preset" ? animation.motion.preset : undefined;

  return (
    <div className="animation-fields">
      <div className="field-row">
        <input
          aria-label="Animation name"
          value={animation.name}
          onChange={(e) => update({ name: e.target.value })}
          style={{ flex: 1 }}
        />
        <button type="button" onClick={() => applyCommand(buildDeleteAnimationCommand(containerRef, animation))} aria-label={`Delete ${animation.name}`}>
          Delete
        </button>
      </div>
      <div className="field-grid">
        <label className="field">
          Trigger
          <select aria-label="Trigger" value={animation.trigger} onChange={(e) => update({ trigger: e.target.value as AnimationDeclaration["trigger"] })}>
            <option value="onEnter">On enter (entrance / idle if repeated)</option>
            <option value="onExit">On exit</option>
            <option value="manual">Manual (via a Behaviour rule)</option>
          </select>
        </label>
        <label className="field">
          Preset
          <select
            aria-label="Preset"
            value={preset ?? ""}
            onChange={(e) => update({ motion: { type: "preset", preset: e.target.value as AnimationPreset } })}
          >
            {ANIMATION_PRESET_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <UncontrolledNumberField label="Duration (ms)" defaultValue={String(animation.durationMs)} onCommit={(v) => update({ durationMs: Math.max(1, Math.round(v)) })} />
        <UncontrolledNumberField label="Delay (ms)" defaultValue={String(animation.delayMs)} onCommit={(v) => update({ delayMs: Math.max(0, Math.round(v)) })} />
        <label className="field">
          Easing
          <select aria-label="Easing" value={animation.easing} onChange={(e) => update({ easing: e.target.value as AnimationDeclaration["easing"] })}>
            <option value="linear">Linear</option>
            <option value="easeIn">Ease in</option>
            <option value="easeOut">Ease out</option>
            <option value="easeInOut">Ease in/out</option>
          </select>
        </label>
        <label className="field">
          Repeat
          <select
            aria-label="Repeat"
            value={animation.repeat?.mode ?? "once"}
            onChange={(e) => {
              const mode = e.target.value as "once" | "count" | "infinite";
              update({ repeat: mode === "count" ? { mode, count: 3 } : { mode } });
            }}
          >
            <option value="once">Once</option>
            <option value="count">A number of times</option>
            <option value="infinite">Infinite (idle loop)</option>
          </select>
        </label>
        {animation.repeat?.mode === "count" && (
          <UncontrolledNumberField label="Repeat count" defaultValue={String(animation.repeat.count)} onCommit={(v) => update({ repeat: { mode: "count", count: Math.max(1, Math.round(v)) } })} />
        )}
        <label className="field">
          Direction
          <select aria-label="Animation direction" value={animation.direction} onChange={(e) => update({ direction: e.target.value as AnimationDeclaration["direction"] })}>
            <option value="normal">Normal</option>
            <option value="reverse">Reverse</option>
            <option value="alternate">Alternate</option>
          </select>
        </label>
        <UncontrolledNumberField label="Intensity" defaultValue={String(animation.intensity)} onCommit={(v) => update({ intensity: Math.max(0, Math.min(2, v)) })} />
        <UncontrolledNumberField label="Random offset (ms)" defaultValue={String(animation.randomOffsetMs ?? 0)} onCommit={(v) => update({ randomOffsetMs: Math.max(0, Math.round(v)) || undefined })} />
      </div>
    </div>
  );
}

const NEW_TOKEN_OPTION = "__new__";

/**
 * Fill color and corner radius, with an inline "+ New…" quick-create so
 * this is usable from a project with zero tokens so far — border,
 * gradient fill, and shadows share the same schema/rendering support
 * (see `@fdraft/theme-renderer`'s `tokenStyle.ts`) but have no picker UI
 * yet, since border/shadow tokens require a color to already exist and a
 * good quick-create flow for that needs more than this pass's budget.
 */
function ShapeLayerFields({ layer, project, containerRef, applyCommand }: { layer: ShapeLayer; project: StudioProjectDocument; containerRef: ContainerRef; applyCommand: (c: Command<StudioProjectDocument>) => void }): React.ReactNode {
  function handleFillChange(value: string): void {
    if (value === NEW_TOKEN_OPTION) {
      const { command, token } = buildAddColorTokenCommand(`Color ${project.tokens.colors.length + 1}`, "#cccccc");
      applyCommand(command);
      applyCommand(setShapeFillColor(containerRef, layer.id, layer.fillColorTokenId, token.id));
      return;
    }
    applyCommand(setShapeFillColor(containerRef, layer.id, layer.fillColorTokenId, value || undefined));
  }

  function handleRadiusChange(value: string): void {
    if (value === NEW_TOKEN_OPTION) {
      const { command, token } = buildAddRadiusTokenCommand(`Radius ${project.tokens.radii.length + 1}`, 8);
      applyCommand(command);
      applyCommand(setShapeCornerRadius(containerRef, layer.id, layer.cornerRadiusTokenId, token.id));
      return;
    }
    applyCommand(setShapeCornerRadius(containerRef, layer.id, layer.cornerRadiusTokenId, value || undefined));
  }

  return (
    <>
      <label className="field">
        Fill color
        <select value={layer.fillColorTokenId ?? ""} onChange={(e) => handleFillChange(e.target.value)}>
          <option value="">None</option>
          {project.tokens.colors.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value={NEW_TOKEN_OPTION}>+ New color…</option>
        </select>
      </label>
      <label className="field">
        Corner radius
        <select value={layer.cornerRadiusTokenId ?? ""} onChange={(e) => handleRadiusChange(e.target.value)}>
          <option value="">None</option>
          {project.tokens.radii.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} ({r.value}px)
            </option>
          ))}
          <option value={NEW_TOKEN_OPTION}>+ New radius…</option>
        </select>
      </label>
    </>
  );
}

function ComponentLayerFields({ layer, containerRef, applyCommand, copyContracts }: { layer: ComponentLayer; containerRef: ContainerRef; applyCommand: (c: Command<StudioProjectDocument>) => void; copyContracts: ComponentCopyContractRegistry }): React.ReactNode {
  const slots = copyContracts[layer.componentKey] ?? [];

  return (
    <>
      <label className="field">
        Zone
        <select value={layer.zoneKind ?? ""} onChange={(e) => applyCommand(setComponentZoneKind(containerRef, layer.id, layer.zoneKind, (e.target.value || undefined) as ZoneKind | undefined))}>
          <option value="">No zone</option>
          {ZONE_KINDS.map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </select>
      </label>

      {slots.length > 0 && (
        <>
          <h3>Copy</h3>
          {slots.map((slot) => (
            <CopySlotField key={slot.key} slot={slot} value={layer.copyOverrides?.[slot.key]} onCommit={(value) => applyCommand(setComponentCopyOverride(containerRef, layer.id, slot.key, layer.copyOverrides?.[slot.key], value))} />
          ))}
        </>
      )}
    </>
  );
}

/** Clearing the field entirely resets to the FDraft default rather than persisting an explicit empty override — a deliberately-blank *optional* slot is reachable programmatically (`setComponentCopyOverride`) but not surfaced as a distinct choice in this panel. */
function CopySlotField({ slot, value, onCommit }: { slot: ComponentCopySlotDeclaration; value: string | undefined; onCommit: (value: string | undefined) => void }): React.ReactNode {
  const [draft, setDraft] = useState(value ?? "");
  const overLimit = slot.maxLength !== undefined && draft.length > slot.maxLength;

  return (
    <label className="field">
      {slot.label}
      {slot.required && <span aria-hidden="true"> *</span>}
      <textarea
        value={draft}
        placeholder={slot.defaultText}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => onCommit(draft.trim().length > 0 ? draft : undefined)}
        aria-label={slot.label}
        aria-required={slot.required}
      />
      {slot.maxLength !== undefined && (
        <span className={overLimit ? "field-hint field-hint-warn" : "field-hint"}>
          {draft.length}/{slot.maxLength}
        </span>
      )}
      {value === undefined && <span className="field-hint">Using FDraft default</span>}
    </label>
  );
}

function MultiLayerFields({ layers, containerRef, applyCommand }: { layers: Layer[]; containerRef: ContainerRef; project: StudioProjectDocument; applyCommand: (c: Command<StudioProjectDocument>) => void }): React.ReactNode {
  const [opacity, setOpacity] = useState("");
  return (
    <div className="field">
      <p className="right-panel-placeholder">{layers.length} layers selected. Shared fields only.</p>
      <NumberField
        label="Opacity%"
        value={opacity}
        onChange={setOpacity}
        placeholder="Mixed"
        onCommit={(v) => {
          for (const layer of layers) applyCommand(setLayerOpacity(containerRef, layer.id, layer.opacity, Math.max(0, Math.min(100, v)) / 100));
        }}
      />
    </div>
  );
}

function NumberField({ label, value, onChange, onCommit, placeholder }: { label: string; value: string; onChange: (v: string) => void; onCommit: (v: number) => void; placeholder?: string }): React.ReactNode {
  return (
    <label className="field field-number">
      {label}
      <input
        type="number"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {
          const n = Number(value);
          if (Number.isFinite(n)) onCommit(n);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
    </label>
  );
}
