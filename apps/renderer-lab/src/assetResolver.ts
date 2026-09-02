import type { AssetResolver } from "@fdraft/theme-renderer";
import type { AssetRecord } from "@fdraft/theme-sdk";
import type { FixtureAssetMap } from "./fixtures/types.js";

/** Only ever hands back a URL for an asset id present in the document's own `assets` array — never guesses at a path. */
export function buildAssetResolver(assets: AssetRecord[], assetMap: FixtureAssetMap): AssetResolver {
  const byId = new Map(assets.map((a) => [a.id, a.path]));
  return {
    resolveAsset: (assetId) => {
      const path = byId.get(assetId);
      return path !== undefined ? assetMap[path] : undefined;
    },
  };
}
