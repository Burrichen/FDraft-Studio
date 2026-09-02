import type { AssetResolver } from "@fdraft/theme-renderer";
import type { OpenProject } from "./projectFile.js";

export interface DisposableAssetResolver extends AssetResolver {
  dispose(): void;
}

/**
 * Resolves a theme's asset ids to `blob:` URLs built directly from the
 * open project's in-memory bytes — no server, no filesystem round trip,
 * works identically in a browser and in Tauri's webview. URLs are cached
 * per assetId and revoked by `dispose()`, which a host calls whenever the
 * open project changes or unmounts, so blob URLs don't leak across
 * project switches.
 */
export function createBlobAssetResolver(open: OpenProject | null): DisposableAssetResolver {
  const cache = new Map<string, string>();

  return {
    resolveAsset(assetId) {
      if (!open) return undefined;
      const cached = cache.get(assetId);
      if (cached) return cached;

      const record = open.project.assets.find((a) => a.id === assetId);
      if (!record) return undefined;
      const bytes = open.assets[record.path];
      if (!bytes) return undefined;

      const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: record.mimeType }));
      cache.set(assetId, url);
      return url;
    },
    dispose() {
      for (const url of cache.values()) URL.revokeObjectURL(url);
      cache.clear();
    },
  };
}
