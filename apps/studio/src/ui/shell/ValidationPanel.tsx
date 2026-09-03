import { useMemo } from "react";
import { checkDesignWarnings, validateProject, type StudioProjectDocument } from "@fdraft/theme-sdk";
import type { ShellTarget } from "./LeftPanel.js";
import { selectSingle, type Selection } from "../../editor/selection.js";
import { useModalA11y } from "../useModalA11y.js";

export interface ValidationPanelProps {
  project: StudioProjectDocument;
  onClose: () => void;
  onNavigate: (target: ShellTarget, selection: Selection) => void;
}

const DESIGN_WARNING_PATH = /^(masters|pages|popups)\[(\d+)\](?:\.layers\[([^\]]+)\])?$/;

function targetFor(project: StudioProjectDocument, kind: "masters" | "pages" | "popups", index: number): ShellTarget | undefined {
  if (kind === "pages") return project.pages[index] && { kind: "page", pageId: project.pages[index]!.id };
  if (kind === "popups") return project.popups[index] && { kind: "popup", popupId: project.popups[index]!.id };
  return project.masters[index] && { kind: "master", masterId: project.masters[index]!.id };
}

/**
 * A single actionable list: blocking errors (`validateProject` — must be
 * fixed before the project can pack/compile) and advisory warnings
 * (`checkDesignWarnings` — never block a save/export, but flag real
 * quality issues). "Go to" is only offered for design warnings, whose
 * `path` format this panel controls and can parse precisely; schema
 * error paths are still shown in full, just without a jump-to-layer
 * shortcut.
 */
export function ValidationPanel({ project, onClose, onNavigate }: ValidationPanelProps): React.ReactNode {
  const modalRef = useModalA11y(onClose);
  const schemaIssues = useMemo(() => validateProject(project).issues, [project]);
  const designWarnings = useMemo(() => checkDesignWarnings(project), [project]);

  function goTo(path: string): void {
    const match = DESIGN_WARNING_PATH.exec(path);
    if (!match) return;
    const [, kindRaw, indexRaw, layerId] = match;
    const kind = kindRaw as "masters" | "pages" | "popups";
    const target = targetFor(project, kind, Number(indexRaw));
    if (!target) return;
    onNavigate(target, layerId ? selectSingle(layerId) : new Set());
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Validation">
      <div className="modal" ref={modalRef} tabIndex={-1}>
        <div className="modal-header">
          <h2>Validation</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <h3>Blocking errors ({schemaIssues.length})</h3>
        {schemaIssues.length === 0 ? (
          <p className="validation-empty">None — this project can be saved and exported.</p>
        ) : (
          <ul className="validation-list">
            {schemaIssues.map((issue, i) => (
              <li key={i} className="validation-row">
                <span className="validation-severity validation-severity-error">Error</span>
                <span className="validation-message">
                  <code>{issue.code}</code> at <code>{issue.path || "(root)"}</code>: {issue.message}
                </span>
              </li>
            ))}
          </ul>
        )}

        <h3>Warnings ({designWarnings.length})</h3>
        {designWarnings.length === 0 ? (
          <p className="validation-empty">None found.</p>
        ) : (
          <ul className="validation-list">
            {designWarnings.map((warning, i) => {
              const canNavigate = DESIGN_WARNING_PATH.test(warning.path);
              return (
                <li key={i} className="validation-row">
                  <span className="validation-severity validation-severity-warning">Warning</span>
                  <span className="validation-message">{warning.message}</span>
                  {canNavigate && (
                    <button type="button" onClick={() => goTo(warning.path)}>
                      Go to
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
