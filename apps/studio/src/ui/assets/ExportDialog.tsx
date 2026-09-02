import { useEffect, useState } from "react";
import { useAppContext } from "../../AppContext.js";
import { useProjectSessionState } from "../../project/useProjectSession.js";
import { analyzeProjectExport, analyzeThemeExport, type ExportAnalysis } from "../../project/exportAnalysis.js";
import { formatBytes } from "./AssetWorkspace.js";

export interface ExportDialogProps {
  kind: "fdstudio" | "fdtheme";
  onClose: () => void;
}

const SDK_VERSION = "0.1.0";
const MIN_RENDERER_VERSION = "0.1.0";

type Status = "analyzing" | "ready" | "exporting" | "done" | "error";

/**
 * The one preview both export routes share: compatibility/capabilities,
 * asset counts, a *real* compiled/packed size (not an estimate — see
 * `exportAnalysis.ts`), and a warnings/blocking-errors split, all
 * computed before the user commits to a write. Export itself is atomic
 * (`exportRuntimeTheme`/`exportBackup`) — a failure here never touches
 * any previously-exported file.
 */
export function ExportDialog({ kind, onClose }: ExportDialogProps): React.ReactNode {
  const { platform, session } = useAppContext();
  const state = useProjectSessionState(session);
  const project = state.open!.project;
  const assets = state.open!.assets;

  const [analysis, setAnalysis] = useState<ExportAnalysis | undefined>(undefined);
  const [status, setStatus] = useState<Status>("analyzing");
  const [message, setMessage] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = kind === "fdstudio" ? await analyzeProjectExport(project, assets, SDK_VERSION) : await analyzeThemeExport(project, assets, { minRendererVersion: MIN_RENDERER_VERSION });
      if (!cancelled) {
        setAnalysis(result);
        setStatus("ready");
      }
    })();
    return () => {
      cancelled = true;
    };
    // Deliberately runs once per mount (the caller remounts this dialog fresh every time it's opened via `key`-less conditional rendering that unmounts on close) — not on every keystroke elsewhere in the app.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleExport(): Promise<void> {
    const defaultName = `${project.metadata.name || "event"}${kind === "fdstudio" ? ".fdstudio" : ".fdtheme"}`;
    const path = await platform.saveFile({
      title: kind === "fdstudio" ? "Export project" : "Export theme",
      defaultPath: defaultName,
      filters: [{ name: kind === "fdstudio" ? "FDraft Studio Project" : "FDraft Theme", extensions: [kind] }],
    });
    if (!path) return;

    setStatus("exporting");
    try {
      if (kind === "fdstudio") await session.exportBackup(path);
      else await session.exportRuntimeTheme(path, { minRendererVersion: MIN_RENDERER_VERSION });
      setStatus("done");
      setMessage(`Exported to ${path}`);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={kind === "fdstudio" ? "Export project" : "Export theme"}>
      <div className="modal">
        <div className="modal-header">
          <h2>{kind === "fdstudio" ? "Export editable project (.fdstudio)" : "Export runtime theme (.fdtheme)"}</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {status === "analyzing" && <p>Analysing project…</p>}

        {analysis && (
          <div className="export-analysis">
            <dl className="asset-detail-facts">
              <dt>Status</dt>
              <dd>{analysis.valid ? "Ready to export" : "Cannot export yet"}</dd>
              <dt>Assets</dt>
              <dd>
                {analysis.usedAssetCount} used of {analysis.assetCount} total
              </dd>
              {kind === "fdtheme" && (
                <>
                  <dt>Capabilities</dt>
                  <dd>{analysis.capabilities.length > 0 ? analysis.capabilities.join(", ") : "none"}</dd>
                  <dt>Required components</dt>
                  <dd>{analysis.requiredComponentKeys.length > 0 ? analysis.requiredComponentKeys.join(", ") : "none"}</dd>
                  <dt>Minimum renderer</dt>
                  <dd>{MIN_RENDERER_VERSION}</dd>
                </>
              )}
              <dt>Package size</dt>
              <dd>{analysis.packageSizeBytes !== undefined ? formatBytes(analysis.packageSizeBytes) : "—"}</dd>
            </dl>

            {analysis.blockingErrors.length > 0 && (
              <div className="export-errors" role="alert">
                <h3>Blocking errors</h3>
                <ul>
                  {analysis.blockingErrors.map((issue, i) => (
                    <li key={i}>
                      <code>{issue.code}</code> at <code>{issue.path || "(root)"}</code>: {issue.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {analysis.warnings.length > 0 && (
              <div className="export-warnings">
                <h3>Warnings</h3>
                <ul>
                  {analysis.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {status === "done" && <p className="export-success">{message}</p>}
        {status === "error" && (
          <p className="export-errors" role="alert">
            Export failed: {message}
          </p>
        )}

        <div className="button-row">
          <button type="button" onClick={() => void handleExport()} disabled={!analysis?.valid || status === "exporting" || status === "analyzing"}>
            {status === "exporting" ? "Exporting…" : "Choose location and export"}
          </button>
          <button type="button" onClick={onClose}>
            {status === "done" ? "Close" : "Cancel"}
          </button>
        </div>
      </div>
    </div>
  );
}
