import type { CanvasSize, Id, Layer, Transform } from "@fdraft/theme-sdk";
import type { ResizeHandle } from "../../editor/geometry.js";
import { transformBounds, unionRect } from "../../editor/geometry.js";

export interface SelectionOverlayProps {
  canvas: CanvasSize;
  zoom: number;
  layers: Map<Id, Layer>;
  selection: ReadonlySet<Id>;
  hoveredId: Id | undefined;
  onHandlePointerDown: (layerId: Id, handle: ResizeHandle, event: React.PointerEvent) => void;
  onRotateHandlePointerDown: (layerId: Id, event: React.PointerEvent) => void;
}

const HANDLE_SIZE_PX = 8;
const ROTATE_OFFSET_PX = 22;

const HANDLES: { handle: ResizeHandle; xPct: number; yPct: number; cursor: string }[] = [
  { handle: "nw", xPct: 0, yPct: 0, cursor: "nwse-resize" },
  { handle: "n", xPct: 50, yPct: 0, cursor: "ns-resize" },
  { handle: "ne", xPct: 100, yPct: 0, cursor: "nesw-resize" },
  { handle: "e", xPct: 100, yPct: 50, cursor: "ew-resize" },
  { handle: "se", xPct: 100, yPct: 100, cursor: "nwse-resize" },
  { handle: "s", xPct: 50, yPct: 100, cursor: "ns-resize" },
  { handle: "sw", xPct: 0, yPct: 100, cursor: "nesw-resize" },
  { handle: "w", xPct: 0, yPct: 50, cursor: "ew-resize" },
];

function toPercent(value: number, of: number): string {
  return `${(value / of) * 100}%`;
}

function LayerOutline({ transform, canvas, children, dashed }: { transform: Transform; canvas: CanvasSize; children?: React.ReactNode; dashed?: boolean }): React.ReactNode {
  return (
    <div
      style={{
        position: "absolute",
        left: toPercent(transform.x, canvas.width),
        top: toPercent(transform.y, canvas.height),
        width: toPercent(transform.width, canvas.width),
        height: toPercent(transform.height, canvas.height),
        transform: transform.rotationDeg !== 0 ? `rotate(${transform.rotationDeg}deg)` : undefined,
        transformOrigin: "center center",
        outline: dashed ? "1px dashed rgba(249,115,22,0.5)" : "1.5px solid #f97316",
        outlineOffset: -0.5,
        pointerEvents: "none",
      }}
    >
      {children}
    </div>
  );
}

/**
 * Renders on top of `ThemeRenderer`'s own DOM output — never a second
 * drawing of the shapes/text/images themselves, only outlines and
 * handles positioned with the exact same percent-of-canvas math the
 * renderer uses (`transformStyle.ts`), so they land pixel-for-pixel on
 * the real content regardless of zoom or rotation.
 */
export function SelectionOverlay({ canvas, zoom, layers, selection, hoveredId, onHandlePointerDown, onRotateHandlePointerDown }: SelectionOverlayProps): React.ReactNode {
  const selectedLayers = [...selection].map((id) => layers.get(id)).filter((l): l is Layer => !!l);
  const isSingle = selectedLayers.length === 1;
  const handleSizePct = { x: (HANDLE_SIZE_PX / zoom / canvas.width) * 100, y: (HANDLE_SIZE_PX / zoom / canvas.height) * 100 };

  const combinedBounds = selectedLayers.length > 1 ? unionRect(selectedLayers.map((l) => transformBounds(l.transform))) : undefined;

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }} aria-hidden="true">
      {hoveredId && !selection.has(hoveredId) && layers.get(hoveredId) && <LayerOutline transform={layers.get(hoveredId)!.transform} canvas={canvas} dashed />}

      {selectedLayers.map((layer) => (
        <LayerOutline key={layer.id} transform={layer.transform} canvas={canvas}>
          {isSingle && (
            <>
              {HANDLES.map(({ handle, xPct, yPct, cursor }) => (
                <div
                  key={handle}
                  data-fdraft-studio-handle={handle}
                  style={{
                    position: "absolute",
                    left: `${xPct}%`,
                    top: `${yPct}%`,
                    width: `${handleSizePct.x}%`,
                    height: `${handleSizePct.y}%`,
                    transform: "translate(-50%, -50%)",
                    background: "#fff",
                    border: "1.5px solid #f97316",
                    borderRadius: 1,
                    cursor,
                    pointerEvents: "auto",
                  }}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    onHandlePointerDown(layer.id, handle, event);
                  }}
                />
              ))}
              <div
                data-fdraft-studio-handle="rotate"
                style={{
                  position: "absolute",
                  left: "50%",
                  top: `-${(ROTATE_OFFSET_PX / zoom / canvas.height) * 100}%`,
                  width: `${handleSizePct.x}%`,
                  height: `${handleSizePct.y}%`,
                  transform: "translate(-50%, -50%)",
                  background: "#fff",
                  border: "1.5px solid #f97316",
                  borderRadius: "50%",
                  cursor: "grab",
                  pointerEvents: "auto",
                }}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  onRotateHandlePointerDown(layer.id, event);
                }}
              />
            </>
          )}
        </LayerOutline>
      ))}

      {combinedBounds && (
        <div
          style={{
            position: "absolute",
            left: toPercent(combinedBounds.x, canvas.width),
            top: toPercent(combinedBounds.y, canvas.height),
            width: toPercent(combinedBounds.width, canvas.width),
            height: toPercent(combinedBounds.height, canvas.height),
            outline: "1px dashed rgba(249,115,22,0.7)",
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}
