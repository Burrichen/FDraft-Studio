import { useEffect, useState } from "react";
import { useAppContext } from "../../AppContext.js";
import { useProjectSessionState } from "../../project/useProjectSession.js";
import { checkFDraftRepositoryPlausibility, type FDraftRepositoryCheck } from "../../publish/fdraftRepositoryCheck.js";
import { clearFDraftLink, loadFDraftLink, saveFDraftLink } from "../../publish/fdraftLink.js";
import { useModalA11y } from "../useModalA11y.js";
import "./publish.css";

export interface LinkFDraftRepositoryDialogProps {
  onClose: () => void;
  onLinkChanged: () => void;
}

/**
 * "Project → Link FDraft Repository": picks a local folder and runs a
 * best-effort plausibility check (never a hard guarantee — see
 * `checkFDraftRepositoryPlausibility`'s own doc comment) before saving the
 * link. The link itself is local-machine-only state, never part of the
 * portable `.fdstudio` project (see `fdraftLink.ts`).
 */
export function LinkFDraftRepositoryDialog({ onClose, onLinkChanged }: LinkFDraftRepositoryDialogProps): React.ReactNode {
  const modalRef = useModalA11y(onClose);
  const { platform, session } = useAppContext();
  const state = useProjectSessionState(session);
  const projectId = state.open!.project.metadata.id;

  const [linkedPath, setLinkedPath] = useState<string | undefined>(undefined);
  const [candidatePath, setCandidatePath] = useState<string | undefined>(undefined);
  const [check, setCheck] = useState<FDraftRepositoryCheck | undefined>(undefined);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const link = await loadFDraftLink(platform, projectId);
      if (!cancelled) setLinkedPath(link?.repoPath);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once on mount
  }, []);

  async function choose(): Promise<void> {
    const picked = await platform.openDirectory({ title: "Select the local FDraft repository" });
    if (!picked) return;
    setCandidatePath(picked);
    setChecking(true);
    const result = await checkFDraftRepositoryPlausibility(platform, picked);
    setCheck(result);
    setChecking(false);
  }

  async function link(): Promise<void> {
    if (!candidatePath) return;
    await saveFDraftLink(platform, projectId, candidatePath);
    setLinkedPath(candidatePath);
    setCandidatePath(undefined);
    setCheck(undefined);
    onLinkChanged();
  }

  async function unlink(): Promise<void> {
    await clearFDraftLink(platform, projectId);
    setLinkedPath(undefined);
    onLinkChanged();
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Link FDraft Repository">
      <div className="modal publish-modal" ref={modalRef} tabIndex={-1}>
        <div className="modal-header">
          <h2>Link FDraft Repository</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <p className="publish-hint">Select the local checkout of the FDraft application repository — never a copy inside this project, and Studio never runs Git in it.</p>

        {linkedPath && (
          <p className="publish-status publish-status-ok">
            Currently linked: <code>{linkedPath}</code>
          </p>
        )}

        <div className="publish-row">
          <button type="button" onClick={() => void choose()}>
            Choose folder…
          </button>
          {linkedPath && (
            <button type="button" onClick={() => void unlink()}>
              Unlink
            </button>
          )}
        </div>

        {checking && <p className="publish-status">Checking…</p>}

        {check && candidatePath && (
          <div className="publish-check">
            <p className={check.plausible ? "publish-status publish-status-ok" : "publish-status publish-status-warn"}>
              {check.plausible ? "Looks like a plausible FDraft repository." : "This doesn't look like an FDraft repository — you can still link it, but publishing will likely fail its own checks."}
            </p>
            {check.markersFound.length > 0 && (
              <ul className="publish-marker-list">
                {check.markersFound.map((m) => (
                  <li key={m}>✓ {m}</li>
                ))}
              </ul>
            )}
            {check.markersMissing.length > 0 && (
              <ul className="publish-marker-list publish-marker-list-missing">
                {check.markersMissing.map((m) => (
                  <li key={m}>✗ {m}</li>
                ))}
              </ul>
            )}
            <button type="button" onClick={() => void link()}>
              Link this folder
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
