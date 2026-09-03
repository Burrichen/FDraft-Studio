import { useEffect, useState } from "react";
import { useAppContext } from "../../AppContext.js";
import { useProjectSessionState } from "../../project/useProjectSession.js";
import { loadFDraftLink } from "../../publish/fdraftLink.js";
import { executePublish, planPublish, type PublishPlan, type PublishResult } from "../../publish/publishToFDraft.js";
import { rollbackLastPublish } from "../../publish/publishDirectorySwap.js";
import { useModalA11y } from "../useModalA11y.js";
import "./publish.css";

export interface PublishToFDraftPanelProps {
  onClose: () => void;
  onLinkRepository: () => void;
}

function blockReasonText(reason: PublishPlan["blocked"][number]): string {
  switch (reason.kind) {
    case "invalidSlug":
      return reason.detail;
    case "validation":
      return `Doesn't validate: ${reason.issues.map((i) => i.message).join("; ")}`;
    case "compatibilityUnavailable":
      return reason.detail;
    case "incompatible":
      return `Incompatible with the linked FDraft: ${reason.check.reasons.join(" ")}`;
    case "slugCollision":
      return `A different project ("${reason.existingProjectName}") is already published under this slug.`;
    case "pathTooLong":
      return `"${reason.path}" (${reason.path.length} characters) is too long for Windows to open reliably — choose a shorter project name.`;
  }
}

/**
 * Compile + validate + compatibility-check + stage → present the exact
 * add/change/remove diff → require explicit confirmation → atomic write.
 * A `slugCollision` blocker is the one kind that can be overridden, and
 * only after a distinct, explicit "I understand" confirmation — every
 * other blocker (invalid project, incompatible with FDraft, FDraft's own
 * integration files missing/unparseable) is never bypassable from here.
 */
export function PublishToFDraftPanel({ onClose, onLinkRepository }: PublishToFDraftPanelProps): React.ReactNode {
  const modalRef = useModalA11y(onClose);
  const { platform, session } = useAppContext();
  const state = useProjectSessionState(session);
  const open = state.open!;

  const [repoPath, setRepoPath] = useState<string | undefined | null>(undefined); // undefined = loading, null = not linked
  const [plan, setPlan] = useState<PublishPlan | null>(null);
  const [planning, setPlanning] = useState(false);
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState<PublishResult | null>(null);
  const [rolledBack, setRolledBack] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const link = await loadFDraftLink(platform, open.project.metadata.id);
      if (cancelled) return;
      setRepoPath(link?.repoPath ?? null);
      if (link?.repoPath) {
        setPlanning(true);
        const next = await planPublish(platform, link.repoPath, open);
        if (!cancelled) {
          setPlan(next);
          setPlanning(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once on mount; re-plan is an explicit button, not automatic on every edit
  }, []);

  async function rePlan(): Promise<void> {
    if (!repoPath) return;
    setPlanning(true);
    setPlan(await planPublish(platform, repoPath, open));
    setPlanning(false);
  }

  async function confirmPublish(): Promise<void> {
    if (!repoPath || !plan) return;
    setPublishing(true);
    const next = await executePublish(platform, repoPath, plan);
    setResult(next);
    setPublishing(false);
  }

  async function undoPublish(): Promise<void> {
    if (!plan) return;
    await rollbackLastPublish(platform, plan.sourceDir);
    await rollbackLastPublish(platform, plan.packDir);
    setRolledBack(true);
  }

  const hardBlocks = plan?.blocked.filter((b) => b.kind !== "slugCollision") ?? [];
  const slugCollision = plan?.blocked.find((b) => b.kind === "slugCollision");
  const canPublish = !!plan && hardBlocks.length === 0 && (!slugCollision || confirmOverwrite);

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Publish to FDraft">
      <div className="modal publish-modal" ref={modalRef} tabIndex={-1}>
        <div className="modal-header">
          <h2>Publish to FDraft</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {repoPath === undefined && <p className="publish-status">Loading…</p>}

        {repoPath === null && (
          <>
            <p className="publish-status publish-status-warn">No FDraft repository linked yet.</p>
            <button type="button" onClick={onLinkRepository}>
              Link FDraft Repository…
            </button>
          </>
        )}

        {repoPath && (
          <>
            <p className="publish-hint">
              Publishing to <code>{repoPath}</code>
            </p>

            {planning && <p className="publish-status">Compiling and checking compatibility…</p>}

            {plan && !result && (
              <>
                {plan.blocked.length > 0 && (
                  <div className="publish-blockers">
                    <h3>Blocked</h3>
                    <ul>
                      {plan.blocked.map((b, i) => (
                        <li key={i} className="publish-status publish-status-error">
                          {blockReasonText(b)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <h3>Editable source — theme-projects/{plan.slug}/</h3>
                {plan.sourceIsAlreadyCanonical ? (
                  <p className="publish-status">Already the canonical source for this project — no source copy will be made.</p>
                ) : plan.sourceDiff.length === 0 ? (
                  <p className="publish-status">No changes.</p>
                ) : (
                  <ul className="publish-diff-list">
                    {plan.sourceDiff.map((d) => (
                      <li key={d.path} className={`publish-diff-${d.kind}`}>
                        {d.kind} {d.path}
                      </li>
                    ))}
                  </ul>
                )}

                <h3>Compiled runtime — src/theme-packs/{plan.slug}/</h3>
                {plan.packDiff.length === 0 ? (
                  <p className="publish-status">No changes.</p>
                ) : (
                  <ul className="publish-diff-list">
                    {plan.packDiff.map((d) => (
                      <li key={d.path} className={`publish-diff-${d.kind}`}>
                        {d.kind} {d.path}
                      </li>
                    ))}
                  </ul>
                )}

                {slugCollision && (
                  <label className="publish-overwrite-confirm">
                    <input type="checkbox" checked={confirmOverwrite} onChange={(e) => setConfirmOverwrite(e.target.checked)} />I understand this will overwrite a different project published under the same name.
                  </label>
                )}

                <div className="publish-row">
                  <button type="button" onClick={() => void rePlan()} disabled={planning}>
                    Re-check
                  </button>
                  <button type="button" onClick={() => void confirmPublish()} disabled={!canPublish || publishing}>
                    {publishing ? "Publishing…" : "Confirm and Publish"}
                  </button>
                </div>
              </>
            )}

            {result && (
              <div className="publish-result">
                <p className="publish-status publish-status-ok">Published.</p>
                <ul className="publish-diff-list">
                  {result.changedPaths.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
                <p className="publish-hint">Studio never runs Git. To commit these changes yourself:</p>
                <pre className="publish-git-hint">{result.gitCommandsHint}</pre>
                {(result.sourceHadPrevious || result.packHadPrevious) && !rolledBack && (
                  <button type="button" onClick={() => void undoPublish()}>
                    Undo this publish
                  </button>
                )}
                {rolledBack && <p className="publish-status publish-status-ok">Rolled back to the previous published version.</p>}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
