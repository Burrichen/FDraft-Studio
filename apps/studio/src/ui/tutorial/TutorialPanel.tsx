import { useState } from "react";
import { useModalA11y } from "../useModalA11y.js";
import { useTutorial } from "../../tutorial/TutorialContext.js";
import { TUTORIAL_STEPS } from "../../tutorial/tutorialContent.js";
import { DocViewerPanel, type DocKind } from "./DocViewerPanel.js";
import "./tutorial.css";

/**
 * Mounted unconditionally at the `App.tsx` level (see `TutorialProvider`'s
 * own doc comment) — this thin wrapper subscribes to `useTutorial()` and
 * only ever renders `TutorialDialog` while `isOpen` is true. Matters for
 * more than tidiness: `useModalA11y`'s focus-on-mount effect fires once,
 * when its OWNING component first mounts. If the dialog's own state/hooks
 * lived in a component that stays mounted across open→close→open (an
 * `if (!isOpen) return null` inside the same component, an earlier draft
 * of this file did exactly that), the focus effect would only ever fire
 * on the very first render — with the ref still `null`, before the
 * dialog's own JSX exists — and never again. A genuine conditional mount
 * (`{isOpen && <TutorialDialog .../>}`) gives every reopen a fresh
 * `useModalA11y` mount, and — as a direct consequence — a naturally reset
 * step/splash state on every reopen, matching the same pattern every
 * other Studio modal already uses (`ValidationPanel`, `CopyReviewPanel`,
 * etc., each rendered as `{open && <Panel .../>}` from their parent).
 */
export function TutorialPanel(): React.ReactNode {
  const { isOpen } = useTutorial();
  return isOpen ? <TutorialDialog /> : null;
}

function TutorialDialog(): React.ReactNode {
  const { close, finish } = useTutorial();
  const [stepIndex, setStepIndex] = useState(0);
  const [started, setStarted] = useState(false);
  const [docOpen, setDocOpen] = useState<DocKind | null>(null);
  const modalRef = useModalA11y(close);

  const total = TUTORIAL_STEPS.length;
  const step = TUTORIAL_STEPS[stepIndex]!;
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === total - 1;

  function restart(): void {
    setStepIndex(0);
    setStarted(true);
  }

  return (
    <div className="modal-overlay tutorial-overlay" role="dialog" aria-modal="true" aria-label="FDraft Studio Tutorial">
      <div className="modal tutorial-modal" ref={modalRef} tabIndex={-1}>
        <div className="modal-header">
          <h2>{started ? step.title : "FDraft Studio Tutorial"}</h2>
          <button type="button" onClick={close} aria-label="Close">
            ✕
          </button>
        </div>

        {!started ? (
          <div className="tutorial-splash">
            <p>A short, real tour of FDraft Studio's current interface — {total} steps, always available again from Help → Tutorial.</p>
            <div className="tutorial-nav">
              <button type="button" onClick={() => setStarted(true)} className="tutorial-primary">
                Start Tutorial
              </button>
              <button type="button" onClick={close}>
                Skip for Now
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="tutorial-progress" aria-live="polite">
              Step {stepIndex + 1} of {total}
            </p>
            <div className="tutorial-body">{step.body}</div>

            {isLast ? (
              <div className="tutorial-doc-links">
                <p>Learn more, entirely offline:</p>
                <button type="button" onClick={() => setDocOpen("user-guide")}>
                  Open User Guide
                </button>
                <button type="button" onClick={() => setDocOpen("troubleshooting")}>
                  Open Troubleshooting
                </button>
              </div>
            ) : null}

            <div className="tutorial-nav">
              <button type="button" onClick={() => setStepIndex((i) => Math.max(0, i - 1))} disabled={isFirst}>
                Back
              </button>
              {isLast ? (
                <button type="button" onClick={finish} className="tutorial-primary">
                  Finish
                </button>
              ) : (
                <button type="button" onClick={() => setStepIndex((i) => Math.min(total - 1, i + 1))} className="tutorial-primary">
                  Next
                </button>
              )}
              <button type="button" onClick={restart}>
                Restart Tutorial
              </button>
              <button type="button" onClick={close}>
                Close Tutorial
              </button>
            </div>
          </>
        )}
      </div>
      {docOpen ? <DocViewerPanel kind={docOpen} onClose={() => setDocOpen(null)} /> : null}
    </div>
  );
}
