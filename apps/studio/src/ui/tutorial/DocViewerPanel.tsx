import { useModalA11y } from "../useModalA11y.js";
import { renderMarkdown } from "./renderMarkdown.js";
import userGuideRaw from "../../tutorial/content/USER_GUIDE.md?raw";
import troubleshootingRaw from "../../tutorial/content/TROUBLESHOOTING.md?raw";
import "./tutorial.css";

export type DocKind = "user-guide" | "troubleshooting";

const DOCS: Record<DocKind, { title: string; raw: string }> = {
  "user-guide": { title: "User Guide", raw: userGuideRaw },
  troubleshooting: { title: "Troubleshooting", raw: troubleshootingRaw },
};

export function DocViewerPanel({ kind, onClose }: { kind: DocKind; onClose: () => void }): React.ReactNode {
  const doc = DOCS[kind];
  const modalRef = useModalA11y(onClose);
  return (
    <div className="modal-overlay tutorial-doc-overlay" role="dialog" aria-modal="true" aria-label={doc.title}>
      <div className="modal tutorial-doc-modal" ref={modalRef} tabIndex={-1}>
        <div className="modal-header">
          <h2>{doc.title}</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="tutorial-doc-content">{renderMarkdown(doc.raw)}</div>
      </div>
    </div>
  );
}
