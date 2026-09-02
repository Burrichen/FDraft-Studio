import type { ReactNode } from "react";

/** A visible, useful compatibility error for an unresolvable component — never a silently blank layer. */
export function MissingComponentFallback({ componentKey, reason }: { componentKey: string; reason: string }): ReactNode {
  return (
    <div
      data-fdraft-error="missing-component"
      data-fdraft-component-key={componentKey}
      title={reason}
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        background: "#fff3cd",
        border: "1px solid #f0ad4e",
        color: "#6b4d0a",
        fontSize: "0.75rem",
        textAlign: "center",
        padding: "4px",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      <strong>Unsupported component</strong>
      <span>{componentKey}</span>
    </div>
  );
}
