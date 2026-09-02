import { useEffect, useState } from "react";
import { useAppContext } from "../../AppContext.js";
import { useProjectSessionState } from "../../project/useProjectSession.js";
import { loadRecentProjects, recordRecentProject, removeRecentProject, checkRecentProjectPaths, type RecentProjectStatus } from "../../recent/recentProjects.js";
import { listRecoveryCandidates, loadRecoveryPayload, discardRecovery, type RecoveryRecord } from "../../recovery/recovery.js";
import { STARTER_TEMPLATES, type StarterTemplateId } from "../../templates/starterTemplates.js";
import "./startup.css";

type LoadState<T> = { status: "loading" } | { status: "ready"; value: T } | { status: "error"; message: string };

export function StartupScreen(): React.ReactNode {
  const { platform, paths, session } = useAppContext();
  const sessionState = useProjectSessionState(session);

  const [recent, setRecent] = useState<LoadState<RecentProjectStatus[]>>({ status: "loading" });
  const [recovery, setRecovery] = useState<RecoveryRecord[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [newProjectName, setNewProjectName] = useState("");
  const [templateId, setTemplateId] = useState<StarterTemplateId>("standard-fdraft");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const entries = await checkRecentProjectPaths(platform, await loadRecentProjects(platform, paths));
        if (!cancelled) setRecent({ status: "ready", value: entries });
      } catch (error) {
        if (!cancelled) setRecent({ status: "error", message: String(error) });
      }
      try {
        const candidates = await listRecoveryCandidates(platform, paths);
        if (!cancelled) setRecovery(candidates);
      } catch {
        // A broken recovery scan must never block startup.
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- platform/paths/session are stable for the app's lifetime
  }, []);

  async function refreshRecent(): Promise<void> {
    const entries = await checkRecentProjectPaths(platform, await loadRecentProjects(platform, paths));
    setRecent({ status: "ready", value: entries });
  }

  async function openAndRemember(path: string): Promise<void> {
    setLocalError(null);
    setBusy("Opening project…");
    try {
      await session.open(path);
      const open = session.getState().open;
      if (open) {
        await recordRecentProject(platform, paths, { path, name: open.project.metadata.name, kind: open.kind, lastOpenedAt: platform.now() });
      }
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
      await refreshRecent();
    }
  }

  async function handleOpenFile(): Promise<void> {
    const path = await platform.openFile({ title: "Open FDraft Studio Project", filters: [{ name: "FDraft Studio Project", extensions: ["fdstudio"] }] });
    if (path) await openAndRemember(path);
  }

  async function handleOpenFolder(): Promise<void> {
    const path = await platform.openDirectory({ title: "Open Unpacked Project Folder" });
    if (path) await openAndRemember(path);
  }

  async function handleImportTheme(): Promise<void> {
    const path = await platform.openFile({ title: "Import Compiled Theme", filters: [{ name: "Compiled FDraft Theme", extensions: ["fdtheme"] }] });
    if (!path) return;
    setLocalError(null);
    setBusy("Importing theme…");
    try {
      const bytes = await platform.readFile(path);
      await session.importFdtheme(bytes);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  }

  function handleCreateNew(): void {
    const name = newProjectName.trim();
    if (!name) return;
    session.newProjectFromTemplate(name, templateId);
  }

  async function handleRecover(record: RecoveryRecord): Promise<void> {
    setBusy("Recovering…");
    try {
      const open = await loadRecoveryPayload(platform, paths, record);
      session.resumeFromRecovery(open);
      await discardRecovery(platform, paths, record.key);
      setRecovery((prev) => prev.filter((r) => r.key !== record.key));
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  }

  async function handleDiscardRecovery(record: RecoveryRecord): Promise<void> {
    await discardRecovery(platform, paths, record.key);
    setRecovery((prev) => prev.filter((r) => r.key !== record.key));
  }

  async function handleRemoveRecent(path: string): Promise<void> {
    await removeRecentProject(platform, paths, path);
    await refreshRecent();
  }

  if (sessionState.status === "loading" || busy) {
    return (
      <div className="startup" data-testid="startup-loading">
        <p role="status">{busy ?? "Loading…"}</p>
      </div>
    );
  }

  return (
    <div className="startup">
      <header className="startup-header">
        <h1>FDraft Studio</h1>
        <p>Design FDraft themes and event pages without writing code.</p>
      </header>

      {(localError || sessionState.status === "error") && (
        <div className="startup-error" role="alert">
          {localError ?? sessionState.errorMessage}
        </div>
      )}

      {recovery.length > 0 && (
        <section className="startup-recovery" aria-label="Recover unsaved work">
          <h2>Recover unsaved work?</h2>
          {recovery.map((record) => (
            <div key={record.key} className="recovery-row">
              <span>{record.projectPath}</span>
              <span className="recovery-time">autosaved {new Date(record.savedAt).toLocaleString()}</span>
              <button type="button" onClick={() => handleRecover(record)}>
                Recover
              </button>
              <button type="button" onClick={() => handleDiscardRecovery(record)}>
                Discard
              </button>
            </div>
          ))}
        </section>
      )}

      <section className="startup-actions">
        <div className="startup-new">
          <input
            type="text"
            placeholder="New project name"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateNew();
            }}
            aria-label="New project name"
          />
          <select value={templateId} onChange={(e) => setTemplateId(e.target.value as StarterTemplateId)} aria-label="Starter template">
            {STARTER_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          <button type="button" onClick={handleCreateNew} disabled={!newProjectName.trim()}>
            New Project
          </button>
        </div>
        <p className="startup-template-description">{STARTER_TEMPLATES.find((t) => t.id === templateId)?.description}</p>
        <button type="button" onClick={handleOpenFile}>
          Open Project…
        </button>
        <button type="button" onClick={handleOpenFolder}>
          Open Unpacked Project Folder…
        </button>
        <button type="button" onClick={handleImportTheme}>
          Import Theme…
        </button>
      </section>

      <section className="startup-recent" aria-label="Recent projects">
        <h2>Recent Projects</h2>
        {recent.status === "loading" && <p>Loading recent projects…</p>}
        {recent.status === "error" && <p role="alert">Could not load recent projects: {recent.message}</p>}
        {recent.status === "ready" && recent.value.length === 0 && <p className="startup-empty">No recent projects yet.</p>}
        {recent.status === "ready" &&
          recent.value.map((entry) => (
            <div key={entry.path} className="recent-row">
              <button type="button" disabled={entry.missing} onClick={() => openAndRemember(entry.path)} className="recent-open">
                <strong>{entry.name}</strong>
                <span className="recent-path">{entry.path}</span>
              </button>
              {entry.missing && <span className="recent-missing">Not found</span>}
              <button type="button" onClick={() => handleRemoveRecent(entry.path)} aria-label={`Remove ${entry.name} from recent projects`}>
                Remove
              </button>
            </div>
          ))}
      </section>
    </div>
  );
}
