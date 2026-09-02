import { findAssetUsage, type AssetRecord, type AssetUsageRef, type Id, type StudioProjectDocument } from "@fdraft/theme-sdk";
import { sha256Hex } from "@fdraft/theme-sdk/packaging";

export interface AssetUsageSummary {
  count: number;
  refs: AssetUsageRef[];
}

/** Groups every reference `findAssetUsage` finds by which asset it points at — the Asset Workspace's usage-count and "where used" navigation both read from this. */
export function summarizeAssetUsage(project: StudioProjectDocument): Map<Id, AssetUsageSummary> {
  const byAsset = new Map<Id, AssetUsageSummary>();
  for (const ref of findAssetUsage(project)) {
    const existing = byAsset.get(ref.assetId);
    if (existing) {
      existing.count += 1;
      existing.refs.push(ref);
    } else {
      byAsset.set(ref.assetId, { count: 1, refs: [ref] });
    }
  }
  return byAsset;
}

/** Every asset record nothing in the project references — candidates for the explicit-confirmation cleanup flow. Never includes an asset just because it's the *inactive* state of a used image-state group (see `findAssetUsage`'s doc comment). */
export function findUnusedAssets(project: StudioProjectDocument): AssetRecord[] {
  const usage = summarizeAssetUsage(project);
  return project.assets.filter((asset) => !usage.has(asset.id));
}

/** An asset record whose bytes aren't present in `assetBytes` at all, or whose actual content hash doesn't match what the record claims — the two "missing/corrupt" cases the Asset Workspace's repair flow needs to detect. */
export interface AssetHealthIssue {
  assetId: Id;
  kind: "missing" | "hash-mismatch";
}

export async function findAssetHealthIssues(project: StudioProjectDocument, assetBytes: Record<string, Uint8Array>): Promise<AssetHealthIssue[]> {
  const issues: AssetHealthIssue[] = [];
  for (const asset of project.assets) {
    const bytes = assetBytes[asset.path];
    if (!bytes) {
      issues.push({ assetId: asset.id, kind: "missing" });
      continue;
    }
    const actualHash = await sha256Hex(bytes);
    if (actualHash !== asset.sha256) issues.push({ assetId: asset.id, kind: "hash-mismatch" });
  }
  return issues;
}
