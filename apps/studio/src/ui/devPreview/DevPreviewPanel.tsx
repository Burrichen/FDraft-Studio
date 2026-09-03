import { useEffect, useRef, useState } from "react";
import { useAppContext } from "../../AppContext.js";
import { useProjectSessionState } from "../../project/useProjectSession.js";
import { buildDevPreview, checkFDraftReachable, cleanupDevPreview, type DevPreviewResult } from "../../devPreview/devPreview.js";
import { useModalA11y } from "../useModalA11y.js";
import "./devPreview.css";

export interface DevPreviewPanelProps {
  onClose: () => void;
}

const DEFAULT_BASE_URL = "http://localhost:3000";
const MIN_RENDERER_VERSION = "0.1.0";

type ConnectionStatus = "checking" | "connected" | "disconnected";

/**
 * A dev-only workflow: compiles the current project to a Studio-managed
 * temp `.fdtheme`, never anywhere inside the FDraft repository, and shows
 * the exact absolute path (plus the dev preview page's own URL) for the
 * developer to paste into FDraft's own dev-only `/theme-preview` route —
 * that route (and its polling watch endpoint) already exist and already
 * do the actual reload; Studio's job here is only to keep a valid,
 * up-to-date `.fdtheme` on disk at a stable path and report connectivity
 * honestly. Every reachability check is a plain outbound `fetch` against
 * whatever local `baseUrl` is typed in — Studio never opens a network
 * listener of its own, so nothing here is reachable beyond this machine
 * regardless of what's typed. Rebuilds automatically after every
 * successful save (not on every keystroke); a failed/invalid compile
 * leaves the last good preview file exactly as it was. The temp file is
 * removed when this panel closes.
 */
export function DevPreviewPanel({ onClose }: DevPreviewPanelProps): React.ReactNode {
  const modalRef = useModalA11y(onClose);
  const { platform, session } = useAppContext();
  const state = useProjectSessionState(session);
  const open = state.open!;

  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL);
  // Both start "in progress" rather than "idle" — the mount effect below kicks off both immediately, and neither
  // function sets state until after its own first `await`, so nothing here calls setState synchronously in an effect.
  const [connection, setConnection] = useState<ConnectionStatus>("checking");
  const [building, setBuilding] = useState(true);
  const [result, setResult] = useState<DevPreviewResult | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const prevDirty = useRef(state.dirty);

  async function runBuild(): Promise<void> {
    const next = await buildDevPreview(platform, open, { minRendererVersion: MIN_RENDERER_VERSION });
    setResult(next);
    setBuilding(false);
  }

  async function checkConnection(): Promise<void> {
    const reachable = await checkFDraftReachable(baseUrl);
    setConnection(reachable ? "connected" : "disconnected");
  }

  // Mirrors ExportDialog.tsx's mount-effect shape (inline async IIFE + `cancelled` guard) rather than calling
  // the named `runBuild`/`checkConnection` helpers below, which stay reserved for direct event-handler use.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next = await buildDevPreview(platform, open, { minRendererVersion: MIN_RENDERER_VERSION });
      if (!cancelled) {
        setResult(next);
        setBuilding(false);
      }
    })();
    (async () => {
      const reachable = await checkFDraftReachable(baseUrl);
      if (!cancelled) setConnection(reachable ? "connected" : "disconnected");
    })();
    return () => {
      cancelled = true;
      void cleanupDevPreview(platform, open.project.metadata.id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately once on mount / once on unmount; auto-rebuild-on-save is the separate effect below
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (prevDirty.current && !state.dirty) {
      (async () => {
        const next = await buildDevPreview(platform, open, { minRendererVersion: MIN_RENDERER_VERSION });
        if (!cancelled) setResult(next);
      })();
    }
    prevDirty.current = state.dirty;
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-runs to observe state.dirty transitions; closes over the latest open/platform each render
  }, [state.dirty]);

  async function copy(text: string, label: string): Promise<void> {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }

  const previewPageUrl = `${baseUrl.replace(/\/+$/, "")}/theme-preview`;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Preview in FDraft">
      <div className="modal dev-preview-modal" ref={modalRef} tabIndex={-1}>
        <div className="modal-header">
          <h2>Preview in FDraft</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <p className="dev-preview-hint">
          Development-only. Compiles this project to a temporary theme file and connects to a local FDraft dev server you already have running — never your real profile, dates, points, drafts, or event opt-in.
        </p>

        <label className="dev-preview-field">
          FDraft dev server URL
          <div className="dev-preview-row">
            <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} aria-label="FDraft dev server URL" />
            <button
              type="button"
              onClick={() => {
                setConnection("checking");
                void checkConnection();
              }}
            >
              Check connection
            </button>
          </div>
        </label>
        <p className={connection === "connected" ? "dev-preview-status dev-preview-status-ok" : connection === "checking" ? "dev-preview-status" : "dev-preview-status dev-preview-status-error"}>
          {connection === "checking" ? "Checking connection…" : connection === "connected" ? "Connected — something is listening at that URL." : "Not connected — start FDraft's dev server, or check the URL."}
        </p>

        <div className="dev-preview-build">
          <p className={result?.status === "ready" ? "dev-preview-status dev-preview-status-ok" : result?.status === "invalid" ? "dev-preview-status dev-preview-status-error" : result?.status === "error" ? "dev-preview-status dev-preview-status-error" : "dev-preview-status"}>
            {building
              ? "Building…"
              : result?.status === "ready"
                ? "Preview theme is up to date."
                : result?.status === "invalid"
                  ? `Current edit doesn't validate — the last good preview file is untouched. ${result.analysis?.blockingErrors[0]?.message ?? ""}`
                  : result?.status === "error"
                    ? `Build failed: ${result.errorMessage}`
                    : "Not built yet."}
          </p>
          <button
            type="button"
            onClick={() => {
              setBuilding(true);
              void runBuild();
            }}
            disabled={building}
          >
            {building ? "Building…" : "Rebuild now"}
          </button>
        </div>

        {result?.tempPath && (
          <>
            <label className="dev-preview-field">
              Absolute path (paste into FDraft's dev preview page)
              <div className="dev-preview-row">
                <input value={result.tempPath} readOnly aria-label="Preview theme file path" />
                <button type="button" onClick={() => void copy(result.tempPath, "path")}>
                  Copy path
                </button>
              </div>
            </label>
            <label className="dev-preview-field">
              FDraft dev preview page
              <div className="dev-preview-row">
                <input value={previewPageUrl} readOnly aria-label="FDraft dev preview page URL" />
                <button type="button" onClick={() => void copy(previewPageUrl, "URL")}>
                  Copy URL
                </button>
              </div>
            </label>
          </>
        )}
        {copied && <p className="dev-preview-status dev-preview-status-ok">Copied {copied}.</p>}
      </div>
    </div>
  );
}
