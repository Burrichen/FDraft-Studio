import { useEffect, useMemo, useRef, useState } from "react";
import { ThemeRenderer, type AssetResolver, type ComponentAdapterRegistry, type ComponentCopyContractRegistry, type HostSettings } from "@fdraft/theme-renderer";
import { DEFAULT_CANVAS_SIZE, type Id, type Layer, type Page, type StudioProjectDocument, type Transform } from "@fdraft/theme-sdk";
import type { Command } from "../../history/commandStack.js";
import type { ContainerRef } from "../../editor/containerRef.js";
import { getContainerLayers, updateContainerLayers } from "../../editor/containerRef.js";
import { flattenLayers, topLevelAncestor } from "../../editor/layerTree.js";
import { computeSnapOffset, resizeTransform, roundTransform, snapLinesForRect, transformBounds, angleDeg, type ResizeHandle } from "../../editor/geometry.js";
import { clearSelection, marqueeSelect, selectAll, selectSingle, toggleSelection, type Selection } from "../../editor/selection.js";
import {
  buildDeleteCommand,
  buildDuplicateCommand,
  buildGroupCommand,
  buildPasteCommand,
  buildUngroupCommand,
  buildZOrderCommand,
  setLayerText,
  setLayerTransforms,
  type LayerTransformChange,
} from "../../editor/layerCommands.js";
import { getClipboardLayers, setClipboardLayers } from "../../editor/clipboard.js";
import { clampZoom, resetView, screenToCanvas, zoomAround, zoomToFit, type ViewState } from "../../editor/viewState.js";
import { SelectionOverlay } from "./SelectionOverlay.js";
import "./canvas.css";

export interface CanvasProps {
  project: StudioProjectDocument;
  containerRef: ContainerRef;
  resolver: AssetResolver;
  componentAdapters: ComponentAdapterRegistry;
  copyContracts?: ComponentCopyContractRegistry;
  hostSettings: HostSettings;
  applyCommand: (command: Command<StudioProjectDocument>) => void;
  selection: Selection;
  onSelectionChange: (selection: Selection) => void;
  onZoomChange?: (zoomPercent: number) => void;
}

type Gesture =
  | { kind: "move"; startCanvas: { x: number; y: number }; ids: Id[]; startTransforms: Map<Id, Transform> }
  | { kind: "resize"; startCanvas: { x: number; y: number }; id: Id; handle: ResizeHandle; startTransform: Transform; proportional: boolean }
  | { kind: "rotate"; id: Id; center: { x: number; y: number }; startAngle: number; startRotation: number }
  | { kind: "marquee"; startCanvas: { x: number; y: number }; startScreen: { x: number; y: number }; currentScreen: { x: number; y: number } };

const NUDGE_STEP = 1;
const NUDGE_STEP_LARGE = 10;
const NUDGE_STEP_PRECISE = 0.1;
const MASTER_PREVIEW_PAGE_ID = "__studio-master-preview__";

export function Canvas({ project, containerRef, resolver, componentAdapters, copyContracts, hostSettings, applyCommand, selection, onSelectionChange, onZoomChange }: CanvasProps): React.ReactNode {
  const canvasSize = project.canvas ?? DEFAULT_CANVAS_SIZE;
  const layers = useMemo(() => getContainerLayers(project, containerRef), [project, containerRef]);
  const flatById = useMemo(() => new Map(flattenLayers(layers).map((l) => [l.id, l] as const)), [layers]);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [view, setView] = useState<ViewState>({ zoom: 1, panX: 0, panY: 0 });
  const [hoveredId, setHoveredId] = useState<Id | undefined>(undefined);
  const [draft, setDraft] = useState<Map<Id, Transform> | null>(null);
  // `onGesturePointerUp` is a closure registered once at gesture start and
  // never re-registered as the gesture progresses (see `beginMove` etc.),
  // so by the time it fires it would otherwise still see `draft` exactly
  // as it was *at gesture start* (always null) — a classic stale-closure
  // trap. This ref is updated synchronously alongside every `setDraft`
  // call so the final commit always reads the latest computed transform.
  const draftRef = useRef<Map<Id, Transform> | null>(null);
  function updateDraft(next: Map<Id, Transform> | null): void {
    draftRef.current = next;
    setDraft(next);
  }
  const [editingTextId, setEditingTextId] = useState<Id | undefined>(undefined);
  const [marqueeScreenRect, setMarqueeScreenRect] = useState<{ x: number; y: number; width: number; height: number } | undefined>(undefined);
  const gestureRef = useRef<Gesture | null>(null);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const fit = () => setView(resetView(el.clientWidth, el.clientHeight, canvasSize.width, canvasSize.height));
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
    // Re-fit only when the edited container changes, not on every project edit (that would fight the user's own zoom/pan).
  }, [containerRef.kind, containerRef.id, canvasSize.width, canvasSize.height]);

  useEffect(() => onZoomChange?.(Math.round(view.zoom * 100)), [view.zoom, onZoomChange]);

  const renderDocument = useMemo<StudioProjectDocument>(() => {
    const base = draft ? updateContainerLayers(project, containerRef, (ls) => applyDraft(ls, draft)) : project;
    if (containerRef.kind !== "master") return base;
    // ThemeRenderer only ever targets a page/popup, never a master
    // directly (masters are only ever rendered as part of a page/popup's
    // inheritance chain). Editing a master's own layers still needs a
    // real preview, so we target a throwaway page that inherits from it
    // and has none of its own layers — same resolution path as any real
    // page, never persisted, never touched by anything else.
    const previewPage: Page = { id: MASTER_PREVIEW_PAGE_ID, name: "Master preview", slug: "master-preview", masterId: containerRef.id, layers: [], animations: [] };
    return { ...base, pages: [...base.pages, previewPage] };
  }, [project, containerRef, draft]);

  function pointerToCanvas(event: { clientX: number; clientY: number }): { x: number; y: number } {
    const rect = viewportRef.current!.getBoundingClientRect();
    return screenToCanvas(view, event.clientX - rect.left, event.clientY - rect.top);
  }

  function pointerToScreen(event: { clientX: number; clientY: number }): { x: number; y: number } {
    const rect = viewportRef.current!.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function otherLayerSnapTargets(excludeIds: Id[]): { x: number[]; y: number[] } {
    const exclude = new Set(excludeIds);
    const page = snapLinesForRect({ x: 0, y: 0, width: canvasSize.width, height: canvasSize.height });
    const xs = [...page.x];
    const ys = [...page.y];
    for (const l of layers) {
      if (exclude.has(l.id)) continue;
      const lines = snapLinesForRect(transformBounds(l.transform));
      xs.push(...lines.x);
      ys.push(...lines.y);
    }
    return { x: xs, y: ys };
  }

  function beginMove(ids: Id[], event: React.PointerEvent): void {
    const startTransforms = new Map(ids.map((id) => [id, flatById.get(id)!.transform] as const));
    gestureRef.current = { kind: "move", startCanvas: pointerToCanvas(event), ids, startTransforms };
    window.addEventListener("pointermove", onGesturePointerMove);
    window.addEventListener("pointerup", onGesturePointerUp, { once: true });
  }

  function beginResize(id: Id, handle: ResizeHandle, event: React.PointerEvent): void {
    const layer = flatById.get(id);
    if (!layer) return;
    gestureRef.current = { kind: "resize", startCanvas: pointerToCanvas(event), id, handle, startTransform: layer.transform, proportional: event.shiftKey };
    window.addEventListener("pointermove", onGesturePointerMove);
    window.addEventListener("pointerup", onGesturePointerUp, { once: true });
  }

  function beginRotate(id: Id, event: React.PointerEvent): void {
    const layer = flatById.get(id);
    if (!layer) return;
    const center = { x: layer.transform.x + layer.transform.width / 2, y: layer.transform.y + layer.transform.height / 2 };
    const pointer = pointerToCanvas(event);
    gestureRef.current = { kind: "rotate", id, center, startAngle: angleDeg(center, pointer), startRotation: layer.transform.rotationDeg };
    window.addEventListener("pointermove", onGesturePointerMove);
    window.addEventListener("pointerup", onGesturePointerUp, { once: true });
  }

  function onGesturePointerMove(event: PointerEvent): void {
    const gesture = gestureRef.current;
    if (!gesture) return;

    if (gesture.kind === "move") {
      const now = pointerToCanvas(event);
      let dx = now.x - gesture.startCanvas.x;
      let dy = now.y - gesture.startCanvas.y;
      if (!event.shiftKey) {
        const primaryId = gesture.ids[0]!;
        const startT = gesture.startTransforms.get(primaryId)!;
        const movedBounds = transformBounds({ ...startT, x: startT.x + dx, y: startT.y + dy });
        const targets = otherLayerSnapTargets(gesture.ids);
        const snap = computeSnapOffset(snapLinesForRect(movedBounds), targets.x, targets.y, 6);
        dx += snap.dx;
        dy += snap.dy;
      }
      const next = new Map<Id, Transform>();
      for (const id of gesture.ids) {
        const t = gesture.startTransforms.get(id)!;
        next.set(id, { ...t, x: t.x + dx, y: t.y + dy });
      }
      updateDraft(next);
    } else if (gesture.kind === "resize") {
      const now = pointerToCanvas(event);
      const delta = { x: now.x - gesture.startCanvas.x, y: now.y - gesture.startCanvas.y };
      const next = resizeTransform(gesture.startTransform, gesture.handle, delta, { proportional: gesture.proportional || event.shiftKey });
      updateDraft(new Map([[gesture.id, next]]));
    } else if (gesture.kind === "rotate") {
      const now = pointerToCanvas(event);
      const angleNow = angleDeg(gesture.center, now);
      let rotation = gesture.startRotation + (angleNow - gesture.startAngle);
      if (event.shiftKey) rotation = Math.round(rotation / 15) * 15;
      const layer = flatById.get(gesture.id)!;
      updateDraft(new Map([[gesture.id, { ...layer.transform, rotationDeg: rotation }]]));
    } else if (gesture.kind === "marquee") {
      const currentScreen = pointerToScreen(event);
      gestureRef.current = { ...gesture, currentScreen };
      setMarqueeScreenRect(normalizeRect(gesture.startScreen, currentScreen));
      const canvasNow = pointerToCanvas(event);
      const rect = normalizeRect(gesture.startCanvas, canvasNow);
      onSelectionChange(marqueeSelect(layers, rect));
    }
  }

  function onGesturePointerUp(): void {
    window.removeEventListener("pointermove", onGesturePointerMove);
    const gesture = gestureRef.current;
    gestureRef.current = null;
    if (!gesture) return;

    if (gesture.kind === "move" || gesture.kind === "resize" || gesture.kind === "rotate") {
      const finalDraft = draftRef.current;
      const changes: LayerTransformChange[] = [];
      if (gesture.kind === "move") {
        for (const id of gesture.ids) {
          const before = gesture.startTransforms.get(id)!;
          const after = finalDraft?.get(id) ?? before;
          if (!transformsEqual(before, after)) changes.push({ layerId: id, before, after });
        }
      } else if (gesture.kind === "resize") {
        const after = finalDraft?.get(gesture.id) ?? gesture.startTransform;
        if (!transformsEqual(gesture.startTransform, after)) changes.push({ layerId: gesture.id, before: gesture.startTransform, after });
      } else {
        const layer = flatById.get(gesture.id);
        const after = finalDraft?.get(gesture.id);
        if (layer && after && !transformsEqual(layer.transform, after)) changes.push({ layerId: gesture.id, before: layer.transform, after });
      }
      if (changes.length > 0) applyCommand(setLayerTransforms(containerRef, changes, gesture.kind === "move" ? "Move" : gesture.kind === "resize" ? "Resize" : "Rotate"));
    }
    updateDraft(null);
    setMarqueeScreenRect(undefined);
  }

  function onStagePointerDown(event: React.PointerEvent): void {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    const handleEl = target.closest("[data-fdraft-studio-handle]");
    if (handleEl) return; // handled by the overlay's own onPointerDown

    // Without this, a mousedown+drag starting over rendered text content
    // triggers the browser's native text-selection drag instead of (or
    // alongside) our own move/marquee gesture.
    event.preventDefault();

    const layerEl = target.closest("[data-fdraft-layer-id]");
    const hitId = layerEl?.getAttribute("data-fdraft-layer-id") ?? undefined;

    if (hitId) {
      const topId = topLevelAncestor(layers, hitId);
      const nextSelection = event.shiftKey ? toggleSelection(selection, topId) : selection.has(topId) ? selection : selectSingle(topId);
      onSelectionChange(nextSelection);
      if (nextSelection.has(topId)) beginMove([...nextSelection], event);
      return;
    }

    if (!event.shiftKey) onSelectionChange(clearSelection());
    const startCanvas = pointerToCanvas(event);
    const startScreen = pointerToScreen(event);
    gestureRef.current = { kind: "marquee", startCanvas, startScreen, currentScreen: startScreen };
    window.addEventListener("pointermove", onGesturePointerMove);
    window.addEventListener("pointerup", onGesturePointerUp, { once: true });
  }

  function onStageDoubleClick(event: React.MouseEvent): void {
    const el = (event.target as HTMLElement).closest("[data-fdraft-layer-id]");
    const id = el?.getAttribute("data-fdraft-layer-id");
    if (id && flatById.get(id)?.type === "text") setEditingTextId(id);
  }

  function onStagePointerOver(event: React.PointerEvent): void {
    const el = (event.target as HTMLElement).closest("[data-fdraft-layer-id]");
    setHoveredId(el ? topLevelAncestor(layers, el.getAttribute("data-fdraft-layer-id")!) : undefined);
  }

  function onWheel(event: React.WheelEvent): void {
    event.preventDefault();
    const screen = pointerToScreen(event);
    setView((v) => zoomAround(v, screen.x, screen.y, v.zoom * (1 - event.deltaY * 0.001)));
  }

  function handleZoomToFit(): void {
    const el = viewportRef.current;
    if (el) setView(zoomToFit({ x: 0, y: 0, width: canvasSize.width, height: canvasSize.height }, el.clientWidth, el.clientHeight));
  }

  function handleZoom100(): void {
    const el = viewportRef.current;
    if (!el) return;
    setView({ zoom: 1, panX: (el.clientWidth - canvasSize.width) / 2, panY: (el.clientHeight - canvasSize.height) / 2 });
  }

  function handleZoomStep(factor: number): void {
    const el = viewportRef.current;
    if (!el) return;
    setView((v) => zoomAround(v, el.clientWidth / 2, el.clientHeight / 2, clampZoom(v.zoom * factor)));
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (isTypingTarget(event.target)) return;
      const meta = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      // Shortcuts that don't require an existing selection.
      if (event.key === "Escape") {
        event.preventDefault();
        onSelectionChange(clearSelection());
        return;
      }
      if (meta && key === "a") {
        event.preventDefault();
        onSelectionChange(selectAll(layers));
        return;
      }
      if (meta && key === "v") {
        event.preventDefault();
        const copied = getClipboardLayers();
        if (copied && copied.length > 0) applyCommand(buildPasteCommand(containerRef, copied, event.shiftKey ? { dx: 0, dy: 0 } : { dx: 24, dy: 24 }));
        return;
      }

      if (selection.size === 0) return;
      const step = event.shiftKey ? NUDGE_STEP_LARGE : event.altKey ? NUDGE_STEP_PRECISE : NUDGE_STEP;
      let dx = 0;
      let dy = 0;
      if (event.key === "ArrowLeft") dx = -step;
      else if (event.key === "ArrowRight") dx = step;
      else if (event.key === "ArrowUp") dy = -step;
      else if (event.key === "ArrowDown") dy = step;
      else if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        const cmd = buildDeleteCommand(project, containerRef, [...selection]);
        if (cmd) applyCommand(cmd);
        onSelectionChange(clearSelection());
        return;
      } else if (meta && key === "d") {
        event.preventDefault();
        const cmd = buildDuplicateCommand(project, containerRef, [...selection]);
        if (cmd) applyCommand(cmd);
        return;
      } else if (meta && (key === "c" || key === "x")) {
        event.preventDefault();
        setClipboardLayers([...selection].map((id) => flatById.get(id)).filter((l): l is Layer => !!l));
        if (key === "x") {
          const cmd = buildDeleteCommand(project, containerRef, [...selection]);
          if (cmd) applyCommand(cmd);
          onSelectionChange(clearSelection());
        }
        return;
      } else if (meta && key === "g") {
        event.preventDefault();
        if (event.shiftKey) {
          const onlyId = selection.size === 1 ? [...selection][0]! : undefined;
          const cmd = onlyId ? buildUngroupCommand(project, containerRef, onlyId) : null;
          if (cmd) applyCommand(cmd);
        } else {
          const cmd = buildGroupCommand(project, containerRef, [...selection]);
          if (cmd) applyCommand(cmd);
        }
        return;
      } else if (key === "]" || key === "[") {
        event.preventDefault();
        const op = key === "]" ? (event.shiftKey ? "front" : "forward") : event.shiftKey ? "back" : "backward";
        const cmd = buildZOrderCommand(project, containerRef, [...selection], op);
        if (cmd) applyCommand(cmd);
        return;
      } else {
        return;
      }
      event.preventDefault();
      const changes: LayerTransformChange[] = [...selection].map((id) => {
        const t = flatById.get(id)!.transform;
        return { layerId: id, before: t, after: { ...t, x: t.x + dx, y: t.y + dy } };
      });
      applyCommand(setLayerTransforms(containerRef, changes, "Nudge"));
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selection, flatById, project, containerRef, applyCommand, onSelectionChange, layers]);

  return (
    <div
      ref={viewportRef}
      className="studio-canvas-viewport"
      onPointerDown={onStagePointerDown}
      onPointerMove={onStagePointerOver}
      onDoubleClick={onStageDoubleClick}
      onWheel={onWheel}
      role="application"
      aria-label="Design canvas"
      tabIndex={0}
    >
      <div className="studio-canvas-zoom-layer" style={{ transform: `translate(${view.panX}px, ${view.panY}px) scale(${view.zoom})`, width: canvasSize.width, height: canvasSize.height }}>
        <div className="studio-canvas-stage" style={{ width: canvasSize.width, height: canvasSize.height }}>
          <ThemeRenderer
            document={renderDocument}
            assetResolver={resolver}
            componentAdapters={componentAdapters}
            copyContracts={copyContracts}
            target={containerRef.kind === "page" ? { kind: "page", pageId: containerRef.id } : containerRef.kind === "popup" ? { kind: "popup", popupId: containerRef.id } : { kind: "page", pageId: MASTER_PREVIEW_PAGE_ID }}
            hostSettings={hostSettings}
            viewportWidthPx={canvasSize.width}
          />
          <SelectionOverlay canvas={canvasSize} zoom={view.zoom} layers={flatById} selection={selection} hoveredId={hoveredId} onHandlePointerDown={beginResize} onRotateHandlePointerDown={beginRotate} />
          {editingTextId && flatById.get(editingTextId)?.type === "text" && (
            <InlineTextEditor
              layer={flatById.get(editingTextId) as Extract<Layer, { type: "text" }>}
              canvas={canvasSize}
              onCommit={(value) => {
                const layer = flatById.get(editingTextId);
                if (layer && layer.type === "text" && layer.text !== value) applyCommand(setLayerText(containerRef, editingTextId, layer.text, value));
                setEditingTextId(undefined);
              }}
              onCancel={() => setEditingTextId(undefined)}
            />
          )}
        </div>
      </div>
      {marqueeScreenRect && <div className="studio-canvas-marquee" style={{ left: marqueeScreenRect.x, top: marqueeScreenRect.y, width: marqueeScreenRect.width, height: marqueeScreenRect.height }} />}

      <div className="studio-canvas-toolbar" role="toolbar" aria-label="Canvas zoom">
        <button type="button" onClick={() => handleZoomStep(0.8)} aria-label="Zoom out">
          −
        </button>
        <button type="button" onClick={handleZoom100} aria-label="Zoom to 100%">
          {Math.round(view.zoom * 100)}%
        </button>
        <button type="button" onClick={() => handleZoomStep(1.25)} aria-label="Zoom in">
          +
        </button>
        <button type="button" onClick={handleZoomToFit}>
          Zoom to fit
        </button>
      </div>
    </div>
  );
}

function InlineTextEditor({ layer, canvas, onCommit, onCancel }: { layer: Extract<Layer, { type: "text" }>; canvas: { width: number; height: number }; onCommit: (value: string) => void; onCancel: () => void }): React.ReactNode {
  const [value, setValue] = useState(layer.text);
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => onCommit(value)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          onCommit(value);
        }
      }}
      aria-label={`Edit text: ${layer.name}`}
      style={{
        position: "absolute",
        left: `${(layer.transform.x / canvas.width) * 100}%`,
        top: `${(layer.transform.y / canvas.height) * 100}%`,
        width: `${(layer.transform.width / canvas.width) * 100}%`,
        height: `${(layer.transform.height / canvas.height) * 100}%`,
        resize: "none",
        font: "inherit",
        fontSize: layer.fontSizePx,
        textAlign: layer.align,
        border: "1.5px solid #f97316",
        background: "#fff",
        padding: 0,
        margin: 0,
      }}
    />
  );
}

function applyDraft(layers: Layer[], draft: Map<Id, Transform>): Layer[] {
  return layers.map((layer) => {
    const own = draft.has(layer.id) ? { ...layer, transform: draft.get(layer.id)! } : layer;
    if (own.type === "group") return { ...own, children: applyDraft(own.children, draft) };
    return own;
  });
}

function transformsEqual(a: Transform, b: Transform): boolean {
  const ra = roundTransform(a);
  const rb = roundTransform(b);
  return ra.x === rb.x && ra.y === rb.y && ra.width === rb.width && ra.height === rb.height && ra.rotationDeg === rb.rotationDeg && ra.scaleX === rb.scaleX && ra.scaleY === rb.scaleY;
}

function normalizeRect(a: { x: number; y: number }, b: { x: number; y: number }): { x: number; y: number; width: number; height: number } {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y) };
}

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
}
