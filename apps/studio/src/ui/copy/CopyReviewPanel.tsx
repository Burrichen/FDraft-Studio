import { useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ThemeRenderer, type AssetResolver, type ComponentAdapterRegistry, type ComponentCopyContractRegistry } from "@fdraft/theme-renderer";
import type { StudioProjectDocument } from "@fdraft/theme-sdk";
import type { ShellTarget } from "../shell/LeftPanel.js";
import { selectSingle, type Selection } from "../../editor/selection.js";
import { DEFAULT_SIMULATION_SCENARIOS } from "../../simulation/defaultScenarios.js";
import { VIEWPORT_PROFILES, type ViewportProfile } from "../viewportProfiles.js";
import { computeStaticCopyFindings, computeUnresolvedPlaceholderFindings, collectComponentCopyTargets, type CopyReviewFinding, type CopyReviewCategory } from "../../copyReview/copyReviewFindings.js";
import { hasTextOverflow } from "../../copyReview/detectClipping.js";
import { useModalA11y } from "../useModalA11y.js";
import "./copyReview.css";

export interface CopyReviewPanelProps {
  project: StudioProjectDocument;
  copyContracts: ComponentCopyContractRegistry;
  resolver: AssetResolver;
  componentAdapters: ComponentAdapterRegistry;
  onClose: () => void;
  onNavigate: (target: ShellTarget, selection: Selection) => void;
}

const CATEGORY_LABELS: Record<CopyReviewCategory, string> = {
  fallbackToDefault: "Falling back to FDraft default",
  missing: "Missing (blank required slot)",
  unresolvedPlaceholder: "Unresolved placeholder",
  inaccessible: "Inaccessible (empty, no fallback name)",
  clipped: "Clipped",
};

function shellTargetFor(finding: CopyReviewFinding): ShellTarget | undefined {
  if (finding.containerKind === "page") return { kind: "page", pageId: finding.containerId };
  if (finding.containerKind === "popup") return { kind: "popup", popupId: finding.containerId };
  if (finding.containerKind === "master") return { kind: "master", masterId: finding.containerId };
  return undefined;
}

interface ScanCell {
  key: string;
  target: { kind: "page"; pageId: string } | { kind: "popup"; popupId: string };
  containerKind: "page" | "popup";
  containerId: string;
  containerName: string;
  viewport: ViewportProfile;
}

/**
 * Every page/popup × every declared component copy slot × every saved/
 * default scenario, checked against the one shared `resolveComponentCopy`
 * (never a second, drifting text-resolution rule). Four of the five
 * categories are static or scenario-only text analysis; `clipped` is a
 * real, live measurement pass — `hasTextOverflow` only means something
 * against an actual browser layout engine, so "Scan for clipped text"
 * mounts every page/popup off-screen at every viewport profile at once
 * (each in its own wrapper, so same-id layers across copies never
 * collide) and reads real `scrollWidth`/`clientWidth` off the live DOM
 * synchronously (`flushSync`) right after mount — not a heuristic. That
 * live pass checks each layer's *currently authored* copy (defaults plus
 * whatever overrides are already saved) — it does not attempt to render
 * every declared copy variant's wording, which would need constructing a
 * modified project per variant; a documented scope limit, not a silent
 * gap. Masters aren't scanned — `ThemeRenderer` only ever targets a page
 * or popup, the same limitation Preview mode already has.
 */
export function CopyReviewPanel({ project, copyContracts, resolver, componentAdapters, onClose, onNavigate }: CopyReviewPanelProps): React.ReactNode {
  const modalRef = useModalA11y(onClose);
  const scenarios = useMemo(() => [...DEFAULT_SIMULATION_SCENARIOS, ...project.simulationScenarios], [project.simulationScenarios]);
  const staticFindings = useMemo(() => computeStaticCopyFindings(project, copyContracts), [project, copyContracts]);
  const placeholderFindings = useMemo(() => computeUnresolvedPlaceholderFindings(project, copyContracts, scenarios), [project, copyContracts, scenarios]);

  const [categoryFilter, setCategoryFilter] = useState<CopyReviewCategory | "all">("all");
  const [clippedFindings, setClippedFindings] = useState<CopyReviewFinding[]>([]);
  const [scanning, setScanning] = useState(false);
  const wrapperRefs = useRef(new Map<string, HTMLDivElement>());

  // Deduped per layer (not per slot) — clipping is measured against a component layer's whole rendered box, not one slot's text in isolation.
  const layersByContainer = useMemo(() => {
    const byContainer = new Map<string, Map<string, { layerName: string; componentKey: string }>>();
    for (const { layer, base } of collectComponentCopyTargets(project, copyContracts)) {
      const key = `${base.containerKind}:${base.containerId}`;
      const layers = byContainer.get(key) ?? new Map<string, { layerName: string; componentKey: string }>();
      layers.set(layer.id, { layerName: layer.name, componentKey: layer.componentKey });
      byContainer.set(key, layers);
    }
    return byContainer;
  }, [project, copyContracts]);

  const scanCells: ScanCell[] = useMemo(() => {
    const previewable: { kind: "page" | "popup"; id: string; name: string }[] = [
      ...project.pages.map((p) => ({ kind: "page" as const, id: p.id, name: p.name })),
      ...project.popups.map((p) => ({ kind: "popup" as const, id: p.id, name: p.name })),
    ];
    return previewable.flatMap((container) =>
      VIEWPORT_PROFILES.map((viewport) => ({
        key: `${container.kind}:${container.id}:${viewport.id}`,
        target: container.kind === "page" ? { kind: "page" as const, pageId: container.id } : { kind: "popup" as const, popupId: container.id },
        containerKind: container.kind,
        containerId: container.id,
        containerName: container.name,
        viewport,
      })),
    );
  }, [project.pages, project.popups]);

  function startScan(): void {
    // Mounting every scan cell is the "external system" a real layout engine measures — flushSync forces the commit (and jsdom-free real layout, when run in an actual browser) to finish before we read from it.
    flushSync(() => setScanning(true));
    const found: CopyReviewFinding[] = [];
    for (const cell of scanCells) {
      const wrapper = wrapperRefs.current.get(cell.key);
      if (!wrapper) continue;
      const layers = layersByContainer.get(`${cell.containerKind}:${cell.containerId}`);
      for (const [layerId, info] of layers ?? []) {
        const el = wrapper.querySelector(`[data-fdraft-layer-id="${layerId}"]`);
        if (el && hasTextOverflow(el)) {
          found.push({
            containerKind: cell.containerKind,
            containerId: cell.containerId,
            containerName: cell.containerName,
            layerId,
            layerName: info.layerName,
            componentKey: info.componentKey,
            slotKey: "*",
            slotLabel: "Rendered content",
            textSource: { kind: "default" },
            category: "clipped",
            detail: `Overflows its box at ${cell.viewport.label} (${cell.viewport.widthPx}px) using the currently authored copy.`,
            viewportId: cell.viewport.id,
          });
        }
      }
    }
    flushSync(() => {
      setClippedFindings(found);
      setScanning(false);
    });
  }

  const allFindings = [...staticFindings, ...placeholderFindings, ...clippedFindings];
  const visibleFindings = categoryFilter === "all" ? allFindings : allFindings.filter((f) => f.category === categoryFilter);

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Copy review">
      <div className="modal copy-review-modal" ref={modalRef} tabIndex={-1}>
        <div className="modal-header">
          <h2>Copy review</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="copy-review-toolbar">
          <label>
            Category
            <select aria-label="Category filter" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as CopyReviewCategory | "all")}>
              <option value="all">All ({allFindings.length})</option>
              {(Object.keys(CATEGORY_LABELS) as CopyReviewCategory[]).map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]} ({allFindings.filter((f) => f.category === c).length})
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={startScan} disabled={scanning || scanCells.length === 0}>
            {scanning ? "Scanning…" : "Scan for clipped text"}
          </button>
        </div>

        {visibleFindings.length === 0 ? (
          <p className="validation-empty">Nothing to report{categoryFilter !== "all" ? ` in "${CATEGORY_LABELS[categoryFilter]}"` : ""}.</p>
        ) : (
          <ul className="validation-list">
            {visibleFindings.map((f, i) => {
              const target = shellTargetFor(f);
              return (
                <li key={i} className="validation-row">
                  <span className="validation-severity validation-severity-warning">{CATEGORY_LABELS[f.category]}</span>
                  <span className="validation-message">
                    {f.containerName} — {f.layerName} — {f.slotLabel}
                    {f.textSource.kind === "variant" ? ` (variant "${f.textSource.variantLabel}")` : ""}
                    {f.scenarioName ? ` — scenario "${f.scenarioName}"` : ""}: {f.detail}
                  </span>
                  {target && (
                    <button type="button" onClick={() => onNavigate(target, selectSingle(f.layerId))}>
                      Go to
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {scanning && (
          <div className="copy-review-scan-stage" aria-hidden="true">
            {scanCells.map((cell) => (
              <div
                key={cell.key}
                ref={(el) => {
                  if (el) wrapperRefs.current.set(cell.key, el);
                  else wrapperRefs.current.delete(cell.key);
                }}
                style={{ width: cell.viewport.widthPx, containerType: "inline-size" }}
              >
                <ThemeRenderer document={project} assetResolver={resolver} componentAdapters={componentAdapters} copyContracts={copyContracts} target={cell.target} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
