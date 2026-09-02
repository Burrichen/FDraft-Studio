import type { ReactNode } from "react";

/** A visible, safe placeholder for a layer whose asset couldn't be resolved — never a broken `<img>` with a guessed `src`. */
export function MissingAssetFallback({ assetId, label }: { assetId: string | undefined; label: string }): ReactNode {
  return (
    <div
      data-fdraft-error="missing-asset"
      title={`Missing asset for "${label}"${assetId ? ` (${assetId})` : ""}`}
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "repeating-conic-gradient(#d9534f 0% 25%, #f4c7c3 0% 50%) 50% / 16px 16px",
        color: "#5a1a1a",
        fontSize: "0.75rem",
        textAlign: "center",
        padding: "4px",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      Missing asset
    </div>
  );
}
