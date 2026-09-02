import { useEffect, useMemo, useState } from "react";
import type { AssetResolver } from "@fdraft/theme-renderer";
import type { AssetRecord, Id } from "@fdraft/theme-sdk";
import { useAppContext } from "../../AppContext.js";
import { useProjectSessionState } from "../../project/useProjectSession.js";
import { planAssetImport } from "../../assets/assetImport.js";
import { buildAddAssetCommand, buildAddFolderCommand, buildDeleteAssetsCommand, buildDeleteFolderCommand } from "../../assets/assetCommands.js";
import { findAssetHealthIssues, findUnusedAssets, summarizeAssetUsage, type AssetHealthIssue } from "../../assets/assetUsageSummary.js";
import { measureImageDimensions } from "../../assets/imageOps.js";
import { AssetDetailPanel } from "./AssetDetailPanel.js";
import { ImageStateGroupsPanel } from "./ImageStateGroupsPanel.js";
import { ExportDialog } from "./ExportDialog.js";
import "./assets.css";

export interface AssetWorkspaceProps {
  resolver: AssetResolver;
}

interface PendingImportError {
  fileName: string;
  message: string;
}

const FILE_DIALOG_FILTERS = [{ name: "Images, SVG, fonts", extensions: ["png", "jpg", "jpeg", "webp", "gif", "avif", "svg", "woff2", "woff", "ttf", "otf"] }];

export function AssetWorkspace({ resolver }: AssetWorkspaceProps): React.ReactNode {
  const { platform, session } = useAppContext();
  const state = useProjectSessionState(session);
  const project = state.open!.project;
  const assetBytes = state.open!.assets;

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const [folderFilter, setFolderFilter] = useState<Id | "root" | undefined>(undefined);
  const [selectedId, setSelectedId] = useState<Id | undefined>(undefined);
  const [importing, setImporting] = useState(false);
  const [importErrors, setImportErrors] = useState<PendingImportError[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [exportKind, setExportKind] = useState<"fdstudio" | "fdtheme" | undefined>(undefined);

  const usage = useMemo(() => summarizeAssetUsage(project), [project]);
  const unused = useMemo(() => findUnusedAssets(project), [project]);

  const [healthIssues, setHealthIssues] = useState<AssetHealthIssue[]>([]);
  useEffect(() => {
    let cancelled = false;
    void findAssetHealthIssues(project, assetBytes).then((issues) => {
      if (!cancelled) setHealthIssues(issues);
    });
    return () => {
      cancelled = true;
    };
  }, [project, assetBytes]);
  const brokenAssetIds = useMemo(() => new Set(healthIssues.map((i) => i.assetId)), [healthIssues]);

  const filtered = project.assets.filter((asset) => {
    if (folderFilter === "root" && asset.folderId !== undefined) return false;
    if (folderFilter && folderFilter !== "root" && asset.folderId !== folderFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const name = (asset.name ?? asset.originalFileName ?? "").toLowerCase();
      const tags = (asset.tags ?? []).join(" ").toLowerCase();
      if (!name.includes(q) && !tags.includes(q)) return false;
    }
    return true;
  });

  async function importFiles(files: { name: string; bytes: Uint8Array }[]): Promise<void> {
    setImporting(true);
    const errors: PendingImportError[] = [];
    for (const file of files) {
      try {
        const plan = await planAssetImport(file.name, file.bytes, session.getState().open!.project);
        if (plan.reused) continue; // identical content already in the project — nothing new to add
        session.mergeAssetBytes({ [plan.path]: plan.bytes });
        const dims = plan.kind !== "font" ? await measureImageDimensions(plan.bytes, plan.mimeType) : undefined;
        const record: AssetRecord = {
          id: cryptoRandomId(),
          kind: plan.kind,
          path: plan.path,
          mimeType: plan.mimeType,
          sizeBytes: plan.sizeBytes,
          sha256: plan.sha256,
          name: plan.fileName,
          originalFileName: plan.fileName,
          width: dims?.width,
          height: dims?.height,
          folderId: folderFilter && folderFilter !== "root" ? folderFilter : undefined,
        };
        session.applyCommand(buildAddAssetCommand(record));
      } catch (error) {
        errors.push({ fileName: file.name, message: error instanceof Error ? error.message : String(error) });
      }
    }
    setImportErrors(errors);
    setImporting(false);
  }

  function cryptoRandomId(): Id {
    return crypto.randomUUID();
  }

  async function handleFileDialogImport(): Promise<void> {
    const paths = await platform.openFiles({ title: "Import assets", filters: FILE_DIALOG_FILTERS });
    if (!paths || paths.length === 0) return;
    const files = await Promise.all(paths.map(async (path) => ({ name: platform.basename(path), bytes: await platform.readFile(path) })));
    await importFiles(files);
  }

  async function handleDrop(event: React.DragEvent): Promise<void> {
    event.preventDefault();
    setDragOver(false);
    const dropped = [...event.dataTransfer.files];
    if (dropped.length === 0) return;
    const files = await Promise.all(dropped.map(async (f) => ({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) })));
    await importFiles(files);
  }

  async function handlePaste(event: React.ClipboardEvent): Promise<void> {
    const items = [...event.clipboardData.items].filter((i) => i.kind === "file");
    if (items.length === 0) return;
    event.preventDefault();
    const files = await Promise.all(
      items.map(async (item) => {
        const blob = item.getAsFile();
        if (!blob) return null;
        return { name: blob.name || `pasted-image-${Date.now()}.png`, bytes: new Uint8Array(await blob.arrayBuffer()) };
      }),
    );
    await importFiles(files.filter((f): f is NonNullable<typeof f> => !!f));
  }

  function handleFindUnused(): void {
    if (unused.length === 0) {
      void platform.confirm("No unused assets found — every asset is referenced somewhere in the project.", { kind: "info", title: "Unused assets" });
      return;
    }
    void (async () => {
      const names = unused.map((a) => a.name ?? a.originalFileName ?? a.id).join(", ");
      const ok = await platform.confirm(`Delete ${unused.length} unused asset${unused.length === 1 ? "" : "s"}? ${names}`, { kind: "warning", title: "Delete unused assets" });
      if (!ok) return;
      const cmd = buildDeleteAssetsCommand(project, unused.map((a) => a.id));
      if (cmd) session.applyCommand(cmd);
      if (unused.some((a) => a.id === selectedId)) setSelectedId(undefined);
    })();
  }

  function handleNewFolder(): void {
    session.applyCommand(buildAddFolderCommand("New folder", folderFilter && folderFilter !== "root" ? folderFilter : undefined));
  }

  const selectedAsset = project.assets.find((a) => a.id === selectedId);

  return (
    <div className="asset-workspace" onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={(e) => void handleDrop(e)} onPaste={(e) => void handlePaste(e)}>
      <aside className="asset-folders">
        <h2>Folders</h2>
        <ul className="asset-folder-list">
          <li>
            <button type="button" aria-pressed={folderFilter === undefined} onClick={() => setFolderFilter(undefined)}>
              All assets ({project.assets.length})
            </button>
          </li>
          <li>
            <button type="button" aria-pressed={folderFilter === "root"} onClick={() => setFolderFilter("root")}>
              Unfiled
            </button>
          </li>
          {project.assetFolders.map((folder) => (
            <li key={folder.id}>
              <button type="button" aria-pressed={folderFilter === folder.id} onClick={() => setFolderFilter(folder.id)}>
                {folder.name}
              </button>
              <button type="button" className="asset-folder-delete" aria-label={`Delete folder ${folder.name}`} onClick={() => { const cmd = buildDeleteFolderCommand(project, folder.id); if (cmd) session.applyCommand(cmd); if (folderFilter === folder.id) setFolderFilter(undefined); }}>
                ✕
              </button>
            </li>
          ))}
        </ul>
        <button type="button" onClick={handleNewFolder}>
          + New folder
        </button>

        <ImageStateGroupsPanel project={project} applyCommand={(c) => session.applyCommand(c)} resolver={resolver} />
      </aside>

      <main className="asset-main">
        <div className="asset-toolbar">
          <button type="button" onClick={() => void handleFileDialogImport()} disabled={importing}>
            {importing ? "Importing…" : "Import…"}
          </button>
          <input type="search" placeholder="Search name or tag…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search assets" />
          <div className="asset-view-toggle" role="group" aria-label="View mode">
            <button type="button" aria-pressed={viewMode === "grid"} onClick={() => setViewMode("grid")}>
              Grid
            </button>
            <button type="button" aria-pressed={viewMode === "list"} onClick={() => setViewMode("list")}>
              List
            </button>
          </div>
          <button type="button" onClick={handleFindUnused}>
            Find unused ({unused.length})
          </button>
          <button type="button" onClick={() => setExportKind("fdstudio")}>
            Export project…
          </button>
          <button type="button" onClick={() => setExportKind("fdtheme")}>
            Export theme…
          </button>
        </div>

        {importErrors.length > 0 && (
          <div className="asset-import-errors" role="alert">
            {importErrors.map((e, i) => (
              <p key={i}>
                <strong>{e.fileName}:</strong> {e.message}
              </p>
            ))}
            <button type="button" onClick={() => setImportErrors([])}>
              Dismiss
            </button>
          </div>
        )}

        <div className={`asset-drop-zone${dragOver ? " asset-drop-zone-active" : ""}${viewMode === "grid" ? " asset-grid" : " asset-list"}`}>
          {filtered.length === 0 && <p className="asset-empty">{project.assets.length === 0 ? "Drag and drop files here, paste an image, or use Import…" : "No assets match your search."}</p>}
          {filtered.map((asset) =>
            viewMode === "grid" ? (
              <AssetGridCell key={asset.id} asset={asset} resolver={resolver} selected={asset.id === selectedId} usageCount={usage.get(asset.id)?.count ?? 0} broken={brokenAssetIds.has(asset.id)} onSelect={() => setSelectedId(asset.id)} />
            ) : (
              <AssetListRow key={asset.id} asset={asset} resolver={resolver} selected={asset.id === selectedId} usageCount={usage.get(asset.id)?.count ?? 0} broken={brokenAssetIds.has(asset.id)} onSelect={() => setSelectedId(asset.id)} />
            ),
          )}
        </div>
      </main>

      {selectedAsset && (
        <AssetDetailPanel
          key={selectedAsset.id}
          asset={selectedAsset}
          project={project}
          resolver={resolver}
          usage={usage.get(selectedAsset.id)}
          broken={brokenAssetIds.has(selectedAsset.id)}
          onClose={() => setSelectedId(undefined)}
          onDeleted={() => setSelectedId(undefined)}
        />
      )}

      {exportKind && <ExportDialog kind={exportKind} onClose={() => setExportKind(undefined)} />}
    </div>
  );
}

function AssetGridCell({ asset, resolver, selected, usageCount, broken, onSelect }: { asset: AssetRecord; resolver: AssetResolver; selected: boolean; usageCount: number; broken: boolean; onSelect: () => void }): React.ReactNode {
  const url = resolver.resolveAsset(asset.id);
  return (
    <button type="button" className={`asset-cell${selected ? " asset-cell-selected" : ""}`} onClick={onSelect} aria-pressed={selected}>
      <div className="asset-thumb">
        {asset.kind === "font" ? <span className="asset-thumb-icon">Aa</span> : url ? <img src={url} alt="" /> : <span className="asset-thumb-icon">?</span>}
      </div>
      <span className="asset-cell-name">{asset.name ?? asset.originalFileName ?? asset.id}</span>
      {broken ? <span className="asset-unused-badge asset-broken-badge">Missing</span> : usageCount === 0 && <span className="asset-unused-badge">Unused</span>}
    </button>
  );
}

function AssetListRow({ asset, resolver, selected, usageCount, broken, onSelect }: { asset: AssetRecord; resolver: AssetResolver; selected: boolean; usageCount: number; broken: boolean; onSelect: () => void }): React.ReactNode {
  const url = resolver.resolveAsset(asset.id);
  return (
    <button type="button" className={`asset-row${selected ? " asset-cell-selected" : ""}`} onClick={onSelect} aria-pressed={selected}>
      <div className="asset-thumb asset-thumb-small">{asset.kind === "font" ? <span className="asset-thumb-icon">Aa</span> : url ? <img src={url} alt="" /> : <span className="asset-thumb-icon">?</span>}</div>
      <span className="asset-row-name">{asset.name ?? asset.originalFileName ?? asset.id}</span>
      <span className="asset-row-meta">{asset.width && asset.height ? `${asset.width}×${asset.height}` : ""}</span>
      <span className="asset-row-meta">{formatBytes(asset.sizeBytes)}</span>
      <span className="asset-row-meta">{broken ? "Missing/corrupt" : usageCount === 0 ? "Unused" : `Used ${usageCount}×`}</span>
    </button>
  );
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
