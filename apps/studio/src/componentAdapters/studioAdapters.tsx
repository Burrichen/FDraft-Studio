import type { CSSProperties, ReactNode } from "react";
import type { ComponentAdapterProps, ComponentAdapterRegistry, ComponentCopyContractRegistry } from "@fdraft/theme-renderer";
import { createSampleCopyContractRegistry } from "@fdraft/theme-renderer";

/**
 * Studio's own polished mock component adapters — visually distinct from
 * `@fdraft/theme-renderer`'s bare-bones sample set (used by the fixture
 * lab) but built on the exact same `ComponentAdapterProps` contract, and
 * just as much a mock: deterministic placeholder data, never a copy of
 * FDraft's real business logic. FDraft's real adapters (Prompt 10) will
 * map these same component keys to real components with live data.
 */

const shell: CSSProperties = {
  width: "100%",
  height: "100%",
  boxSizing: "border-box",
  fontFamily: "system-ui, sans-serif",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  overflow: "hidden",
  borderRadius: 6,
};

function PageTitle({ style, copy }: ComponentAdapterProps): ReactNode {
  return (
    <h1 data-fdraft-component="page-title" style={{ ...shell, margin: 0, fontSize: "2.25rem", fontWeight: 800, letterSpacing: "-0.02em", alignItems: "center", ...style }}>
      {copy.title}
    </h1>
  );
}

function EventInformation({ style, copy }: ComponentAdapterProps): ReactNode {
  return (
    <div data-fdraft-component="event-information" style={{ ...shell, gap: 6, padding: 12, background: "#f4f4f5", ...style }}>
      <strong style={{ fontSize: "1rem" }}>{copy.eventName}</strong>
      <span style={{ fontSize: "0.85rem", color: "#52525b" }}>{copy.dateRange}</span>
    </div>
  );
}

function EventCountdown({ style, copy }: ComponentAdapterProps): ReactNode {
  return (
    <div data-fdraft-component="event-countdown" style={{ ...shell, alignItems: "center", background: "#18181b", color: "#fff", ...style }} aria-label={copy.accessibleLabel}>
      <span style={{ fontSize: "1.75rem", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>03d 04h 12m</span>
    </div>
  );
}

function EventNavigation({ style, copy }: ComponentAdapterProps): ReactNode {
  return (
    <nav data-fdraft-component="event-navigation" aria-label={copy.accessibleLabel} style={{ ...shell, flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: "0 8px", ...style }}>
      <span style={{ fontSize: "0.85rem", color: "#52525b" }}>{copy.previousLabel}</span>
      <span style={{ fontSize: "0.85rem", color: "#52525b" }}>{copy.nextLabel}</span>
    </nav>
  );
}

function DraftControls({ style, copy }: ComponentAdapterProps): ReactNode {
  return (
    <div data-fdraft-component="draft-controls" style={{ ...shell, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, ...style }}>
      <span style={{ padding: "8px 16px", borderRadius: 999, background: "#e4e4e7", fontSize: "0.85rem" }}>{copy.skipLabel}</span>
      <span style={{ padding: "8px 16px", borderRadius: 999, background: "#18181b", color: "#fff", fontSize: "0.85rem" }} aria-label={copy.accessibleLabel}>
        {copy.confirmLabel}
      </span>
    </div>
  );
}

function DraftProgress({ style, copy }: ComponentAdapterProps): ReactNode {
  return (
    <div data-fdraft-component="draft-progress" style={{ ...shell, gap: 6, padding: "0 4px", ...style }}>
      <span style={{ fontSize: "0.8rem", color: "#52525b" }}>{(copy.statusLabel ?? "").replace("{{picksMade}}", "3").replace("{{totalPicks}}", "10")}</span>
      <div style={{ background: "#e4e4e7", height: 8, borderRadius: 999, overflow: "hidden" }}>
        <div style={{ width: "30%", height: "100%", background: "#f97316" }} />
      </div>
    </div>
  );
}

const MOCK_FILMS = ["Sample Film A", "Sample Film B", "Sample Film C", "Sample Film D"];

function FilmGrid({ style }: ComponentAdapterProps): ReactNode {
  return (
    <div data-fdraft-component="film-grid" style={{ ...shell, display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6, ...style }}>
      {MOCK_FILMS.map((title) => (
        <div key={title} style={{ background: "#e4e4e7", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", color: "#3f3f46", textAlign: "center", padding: 4 }}>
          {title}
        </div>
      ))}
    </div>
  );
}

function FilmCard({ style, copy }: ComponentAdapterProps): ReactNode {
  return (
    <div data-fdraft-component="film-card" style={{ ...shell, alignItems: "center", gap: 4, background: "#e4e4e7", ...style }}>
      <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>Sample Film A</span>
      <span style={{ fontSize: "0.7rem", color: "#3f3f46" }}>{copy.watchedBadgeLabel}</span>
    </div>
  );
}

function EventProgress({ style, copy }: ComponentAdapterProps): ReactNode {
  return (
    <div data-fdraft-component="event-progress" style={{ ...shell, padding: "0 4px", gap: 4, ...style }} aria-label={copy.accessibleLabel}>
      <span style={{ fontSize: "0.75rem", color: "#52525b" }}>{(copy.statusLabel ?? "").replace("{{progress}}", "42")}</span>
      <div style={{ background: "#e4e4e7", height: 10, borderRadius: 999, overflow: "hidden" }}>
        <div style={{ width: "42%", height: "100%", background: "#f97316" }} />
      </div>
    </div>
  );
}

function PointsCounter({ style, copy }: ComponentAdapterProps): ReactNode {
  return (
    <div data-fdraft-component="points-counter" style={{ ...shell, alignItems: "center", background: "#fff7ed", border: "1px solid #fdba74", ...style }} aria-label={copy.accessibleLabel}>
      <span style={{ fontWeight: 700, color: "#c2410c" }}>1,240 {copy.unitLabel}</span>
    </div>
  );
}

function EventPointsCounter({ style, copy }: ComponentAdapterProps): ReactNode {
  return (
    <div data-fdraft-component="event-points-counter" style={{ ...shell, alignItems: "center", background: "#fef3c7", border: "1px solid #fcd34d", ...style }} aria-label={copy.accessibleLabel}>
      <span style={{ fontWeight: 700, color: "#92400e" }}>180 {copy.unitLabel}</span>
    </div>
  );
}

function ProfileBadge({ style, copy }: ComponentAdapterProps): ReactNode {
  return (
    <div data-fdraft-component="profile-badge" style={{ ...shell, flexDirection: "row", alignItems: "center", gap: 8, ...style }}>
      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#e4e4e7", flexShrink: 0 }} aria-hidden="true" />
      <span style={{ fontWeight: 600, fontSize: "0.85rem" }} aria-label={copy.accessibleLabel}>
        Sample User
      </span>
    </div>
  );
}

function GenerateDraftAction({ style, copy }: ComponentAdapterProps): ReactNode {
  return (
    <button type="button" disabled data-fdraft-component="generate-draft-action" style={{ ...shell, alignItems: "center", background: "#18181b", color: "#fff", fontWeight: 600, pointerEvents: "none", border: "none", ...style }} aria-label={copy.accessibleLabel}>
      {copy.actionLabel}
    </button>
  );
}

function CompleteWatchAction({ style, copy }: ComponentAdapterProps): ReactNode {
  return (
    <button type="button" disabled data-fdraft-component="complete-watch-action" style={{ ...shell, alignItems: "center", background: "#16a34a", color: "#fff", fontWeight: 600, pointerEvents: "none", border: "none", ...style }} aria-label={copy.accessibleLabel}>
      {copy.actionLabel}
    </button>
  );
}

function ChallengeCard({ style, copy }: ComponentAdapterProps): ReactNode {
  return (
    <div data-fdraft-component="challenge-card" style={{ ...shell, gap: 4, padding: 10, background: "#faf5ff", border: "1px solid #d8b4fe", ...style }}>
      <strong style={{ fontSize: "0.9rem", color: "#6b21a8" }}>{copy.title}</strong>
      <p style={{ margin: 0, fontSize: "0.75rem", color: "#52525b" }}>{copy.description}</p>
    </div>
  );
}

function ResultsCompletionContent({ style, copy }: ComponentAdapterProps): ReactNode {
  return (
    <div data-fdraft-component="results-completion-content" style={{ ...shell, alignItems: "center", gap: 8, textAlign: "center", ...style }}>
      <h2 style={{ margin: 0, fontSize: "1.4rem" }}>{copy.headline}</h2>
      <p style={{ margin: 0, fontSize: "0.85rem", color: "#52525b" }}>{copy.body}</p>
    </div>
  );
}

export function createStudioComponentAdapterRegistry(): ComponentAdapterRegistry {
  return {
    "page-title": PageTitle,
    "event-information": EventInformation,
    "event-countdown": EventCountdown,
    "event-navigation": EventNavigation,
    "draft-controls": DraftControls,
    "draft-progress": DraftProgress,
    "film-grid": FilmGrid,
    "film-card": FilmCard,
    "event-progress": EventProgress,
    "points-counter": PointsCounter,
    "event-points-counter": EventPointsCounter,
    "profile-badge": ProfileBadge,
    "generate-draft-action": GenerateDraftAction,
    "complete-watch-action": CompleteWatchAction,
    "challenge-card": ChallengeCard,
    "results-completion-content": ResultsCompletionContent,
  };
}

/** Studio's copy *contract* (which slots exist, defaults, required/placeholders) is identical to the sample registry's — only the visual shell differs. Re-declaring the same contract twice would just be a drift risk for no benefit. */
export function createStudioCopyContractRegistry(): ComponentCopyContractRegistry {
  return createSampleCopyContractRegistry();
}
