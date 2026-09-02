import { useState } from "react";
import type { AssetResolver } from "@fdraft/theme-renderer";
import type { AssetRecord, AssetUsageRef, StudioProjectDocument } from "@fdraft/theme-sdk";
import { useAppContext } from "../../AppContext.js";
import { planAssetImport } from "../../assets/assetImport.js";
import { buildDeleteAssetsCommand, buildDuplicateAssetCommand, buildReplaceAssetSourceCommand, moveAssetToFolder, renameAsset, setAssetTags } from "../../assets/assetCommands.js";
import { measureImageDimensions } from "../../assets/imageOps.js";
import type { AssetUsageSummary } from "../../assets/assetUsageSummary.js";
import { flattenLayers } from "../../editor/layerTree.js";
import { formatBytes } from "./AssetWorkspace.js";

export interface AssetDetailPanelProps {
  asset: AssetRecord;
  project: StudioProjectDocument;
  resolver: AssetResolver;
  usage: AssetUsageSummary | undefined;
  broken: boolean;
  onClose: () => void;
  onDeleted: () => void;
}

function describeUsageRef(project: StudioProjectDocument, ref: AssetUsageRef): string {
  if (ref.via === "fontToken") {
    const token = project.tokens.fonts.find((f) => f.id === ref.fontTokenId);
    return `Font token "${token?.name ?? ref.fontTokenId}"`;
  }
  if (ref.via === "imageStateGroup") {
    const group = project.imageStateGroups.find((g) => g.id === ref.stateGroupId);
    return `Image state group "${group?.name ?? ref.stateGroupId}"`;
  }
  const containers = ref.containerKind === "page" ? project.pages : ref.containerKind === "popup" ? project.popups : project.masters;
  const container = containers.find((c) => c.id === ref.containerId);
  const layer = container ? flattenLayers(container.layers).find((l) => l.id === ref.layerId) : undefined;
  const kindLabel = ref.containerKind === "page" ? "Page" : ref.containerKind === "popup" ? "Popup" : "Master";
  const layerLabel = layer?.name ?? ref.layerId ?? "layer";
  const viaLabel = ref.via === "layerMask" ? " (mask)" : "";
  return `${kindLabel} "${container?.name ?? ref.containerId}" → ${layerLabel}${viaLabel}`;
}

export function AssetDetailPanel({ asset, project, resolver, usage, broken, onClose, onDeleted }: AssetDetailPanelProps): React.ReactNode {
  const { platform, session } = useAppContext();
  const [name, setName] = useState(asset.name ?? asset.originalFileName ?? "");
  const [tagsText, setTagsText] = useState((asset.tags ?? []).join(", "));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const url = resolver.resolveAsset(asset.id);

  async function handleReplace(): Promise<void> {
    const path = await platform.openFile({ title: "Replace asset source" });
    if (!path) return;
    setBusy(true);
    setError(undefined);
    try {
      const bytes = await platform.readFile(path);
      const plan = await planAssetImport(platform.basename(path), bytes, project);
      if (plan.kind !== asset.kind) throw new Error(`Replacement must be the same asset type (expected ${asset.kind}, got ${plan.kind})`);
      session.mergeAssetBytes({ [plan.path]: plan.bytes });
      const dims = plan.kind !== "font" ? await measureImageDimensions(plan.bytes, plan.mimeType) : undefined;
      session.applyCommand(
        buildReplaceAssetSourceCommand(asset.id, asset, { kind: plan.kind, path: plan.path, mimeType: plan.mimeType, sizeBytes: plan.sizeBytes, sha256: plan.sha256, width: dims?.width, height: dims?.height }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function handleDuplicate(): void {
    const cmd = buildDuplicateAssetCommand(project, asset.id);
    if (cmd) session.applyCommand(cmd);
  }

  async function handleDelete(): Promise<void> {
    const usedCount = usage?.count ?? 0;
    const message = usedCount > 0 ? `"${name}" is used in ${usedCount} place${usedCount === 1 ? "" : "s"}. Deleting it will leave those references broken. Delete anyway?` : `Delete "${name}"?`;
    const ok = await platform.confirm(message, { kind: "warning", title: "Delete asset" });
    if (!ok) return;
    const cmd = buildDeleteAssetsCommand(project, [asset.id]);
    if (cmd) session.applyCommand(cmd);
    onDeleted();
  }

  return (
    <aside className="asset-detail-panel" aria-label="Asset details">
      <div className="asset-detail-header">
        <h2>Asset</h2>
        <button type="button" onClick={onClose} aria-label="Close asset details">
          ✕
        </button>
      </div>

      <div className="asset-detail-preview">
        {asset.kind === "font" ? <span className="asset-thumb-icon">Aa</span> : url ? <img src={url} alt="" /> : <span className="asset-thumb-icon">?</span>}
      </div>

      {broken && (
        <p className="asset-detail-error" role="alert">
          This asset's file is missing or its content no longer matches what was recorded — use "Replace source" below to repair it.
        </p>
      )}

      {error && <p className="asset-detail-error" role="alert">{error}</p>}

      <label className="field">
        Name
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            const cmd = renameAsset(project, asset.id, name.trim() || asset.name || asset.id);
            if (cmd) session.applyCommand(cmd);
          }}
        />
      </label>

      <label className="field">
        Tags (comma-separated)
        <input
          type="text"
          value={tagsText}
          onChange={(e) => setTagsText(e.target.value)}
          onBlur={() => {
            const tags = tagsText
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean);
            const cmd = setAssetTags(project, asset.id, tags);
            if (cmd) session.applyCommand(cmd);
          }}
        />
      </label>

      <label className="field">
        Folder
        <select
          value={asset.folderId ?? ""}
          onChange={(e) => session.applyCommand(moveAssetToFolder(asset.id, asset.folderId, e.target.value || undefined))}
        >
          <option value="">Unfiled</option>
          {project.assetFolders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </label>

      <dl className="asset-detail-facts">
        <dt>Format</dt>
        <dd>{asset.mimeType}</dd>
        <dt>Dimensions</dt>
        <dd>{asset.width && asset.height ? `${asset.width} × ${asset.height}px` : "—"}</dd>
        <dt>Size</dt>
        <dd>{formatBytes(asset.sizeBytes)}</dd>
        <dt>Hash</dt>
        <dd className="asset-detail-hash">{asset.sha256}</dd>
        <dt>Usage</dt>
        <dd>{usage?.count ?? 0} reference{usage?.count === 1 ? "" : "s"}</dd>
      </dl>

      {usage && usage.refs.length > 0 && (
        <>
          <h3>Where used</h3>
          <ul className="asset-detail-usage">
            {usage.refs.map((ref, i) => (
              <li key={i}>{describeUsageRef(project, ref)}</li>
            ))}
          </ul>
        </>
      )}

      <div className="button-row">
        <button type="button" onClick={() => void handleReplace()} disabled={busy}>
          Replace source…
        </button>
        <button type="button" onClick={handleDuplicate}>
          Duplicate
        </button>
        <button type="button" onClick={() => void handleDelete()}>
          Delete
        </button>
      </div>
    </aside>
  );
}
