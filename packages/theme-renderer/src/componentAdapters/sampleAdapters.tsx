import type { CSSProperties, ReactNode } from "react";
import type { ComponentAdapterProps, ComponentCopyContractRegistry } from "../types.js";

/**
 * Deterministic sample data only — never a copy of FDraft's real domain
 * logic. Every adapter here renders a fixed outer shell (the only thing a
 * theme is allowed to style, via `style`) around placeholder content
 * whose *visible copy* comes from `props.copy` (see
 * `SAMPLE_COPY_CONTRACTS` below and `resolveComponentCopy`) — never a
 * hardcoded string a theme has no way to reach. Nothing here grants
 * points, marks anything watched, reads a real profile, or invents event
 * behaviour; dynamic values (film titles, counts, dates) stay fixed
 * sample data, exactly as they would be host-supplied in the real thing.
 */

const shellBase: CSSProperties = {
  width: "100%",
  height: "100%",
  boxSizing: "border-box",
  fontFamily: "sans-serif",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

export function PageTitleAdapter({ style, copy }: ComponentAdapterProps): ReactNode {
  return (
    <h1 data-fdraft-component="page-title" style={{ ...shellBase, margin: 0, fontSize: "2rem", fontWeight: 700, justifyContent: "center", ...style }}>
      {copy.title}
    </h1>
  );
}

export function EventInformationAdapter({ style, copy }: ComponentAdapterProps): ReactNode {
  return (
    <div data-fdraft-component="event-information" style={{ ...shellBase, gap: 4, justifyContent: "center", ...style }}>
      <p style={{ margin: 0, fontWeight: 600 }}>{copy.eventName}</p>
      <p style={{ margin: 0, fontSize: "0.85rem" }}>{copy.dateRange}</p>
    </div>
  );
}

export function EventCountdownAdapter({ style, copy }: ComponentAdapterProps): ReactNode {
  // Static sample value — a real ticking countdown is FDraft's real
  // adapter's job (Prompt 10); this shell only proves layout/styling.
  return (
    <div data-fdraft-component="event-countdown" style={{ ...shellBase, alignItems: "center", justifyContent: "center", fontVariantNumeric: "tabular-nums", ...style }}>
      <span aria-label={copy.accessibleLabel} style={{ fontSize: "1.5rem", fontWeight: 700 }}>
        03d 04h 12m
      </span>
    </div>
  );
}

export function EventNavigationAdapter({ style, copy }: ComponentAdapterProps): ReactNode {
  return (
    <nav data-fdraft-component="event-navigation" aria-label={copy.accessibleLabel} style={{ ...shellBase, flexDirection: "row", gap: 12, alignItems: "center", justifyContent: "center", ...style }}>
      <span style={{ pointerEvents: "none" }}>{copy.previousLabel}</span>
      <span style={{ pointerEvents: "none" }}>{copy.nextLabel}</span>
    </nav>
  );
}

export function DraftControlsAdapter({ style, copy }: ComponentAdapterProps): ReactNode {
  return (
    <div data-fdraft-component="draft-controls" style={{ ...shellBase, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", ...style }}>
      <button type="button" disabled style={{ pointerEvents: "none" }}>
        {copy.skipLabel}
      </button>
      <button type="button" disabled style={{ pointerEvents: "none" }} aria-label={copy.accessibleLabel}>
        {copy.confirmLabel}
      </button>
    </div>
  );
}

export function DraftProgressAdapter({ style, copy }: ComponentAdapterProps): ReactNode {
  const samplePicksMade = 3;
  const sampleTotalPicks = 10;
  return (
    <div data-fdraft-component="draft-progress" style={{ ...shellBase, justifyContent: "center", gap: 4, ...style }}>
      <p style={{ margin: 0, fontSize: "0.8rem" }}>{(copy.statusLabel ?? "").replace("{{picksMade}}", String(samplePicksMade)).replace("{{totalPicks}}", String(sampleTotalPicks))}</p>
      <div style={{ background: "#ddd", height: 6, borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${(samplePicksMade / sampleTotalPicks) * 100}%`, height: "100%", background: "currentColor" }} />
      </div>
    </div>
  );
}

const SAMPLE_FILMS = ["Sample Film A", "Sample Film B", "Sample Film C", "Sample Film D"];

export function FilmGridAdapter({ style }: ComponentAdapterProps): ReactNode {
  return (
    <div
      data-fdraft-component="film-grid"
      style={{ ...shellBase, display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 4, ...style }}
    >
      {SAMPLE_FILMS.map((title) => (
        <div key={title} style={{ background: "#ddd", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", textAlign: "center" }}>
          {title}
        </div>
      ))}
    </div>
  );
}

export function FilmCardAdapter({ style, copy }: ComponentAdapterProps): ReactNode {
  return (
    <div data-fdraft-component="film-card" style={{ ...shellBase, background: "#ddd", alignItems: "center", justifyContent: "center", gap: 4, ...style }}>
      <span style={{ fontWeight: 600, fontSize: "0.8rem" }}>Sample Film A</span>
      <span style={{ fontSize: "0.7rem" }}>{copy.watchedBadgeLabel}</span>
    </div>
  );
}

export function EventProgressAdapter({ style, copy }: ComponentAdapterProps): ReactNode {
  const sampleProgressPercent = 42;
  return (
    <div data-fdraft-component="event-progress" style={{ ...shellBase, justifyContent: "center", gap: 4, ...style }}>
      <p style={{ margin: 0, fontSize: "0.75rem" }} aria-label={copy.accessibleLabel}>
        {(copy.statusLabel ?? "").replace("{{progress}}", String(sampleProgressPercent))}
      </p>
      <div style={{ background: "#ddd", height: 8, borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${sampleProgressPercent}%`, height: "100%", background: "currentColor" }} />
      </div>
    </div>
  );
}

export function PointsCounterAdapter({ style, copy }: ComponentAdapterProps): ReactNode {
  return (
    <div data-fdraft-component="points-counter" style={{ ...shellBase, alignItems: "center", justifyContent: "center", ...style }}>
      <span style={{ fontWeight: 700 }} aria-label={copy.accessibleLabel}>
        1,240 {copy.unitLabel}
      </span>
    </div>
  );
}

export function EventPointsCounterAdapter({ style, copy }: ComponentAdapterProps): ReactNode {
  return (
    <div data-fdraft-component="event-points-counter" style={{ ...shellBase, alignItems: "center", justifyContent: "center", ...style }}>
      <span style={{ fontWeight: 700 }} aria-label={copy.accessibleLabel}>
        180 {copy.unitLabel}
      </span>
    </div>
  );
}

export function ProfileBadgeAdapter({ style, copy }: ComponentAdapterProps): ReactNode {
  return (
    <div data-fdraft-component="profile-badge" style={{ ...shellBase, flexDirection: "row", alignItems: "center", gap: 8, ...style }}>
      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#ddd", flexShrink: 0 }} aria-hidden="true" />
      <span style={{ fontWeight: 600, fontSize: "0.85rem" }} aria-label={copy.accessibleLabel}>
        Sample User
      </span>
    </div>
  );
}

export function GenerateDraftActionAdapter({ style, copy }: ComponentAdapterProps): ReactNode {
  return (
    <button type="button" disabled data-fdraft-component="generate-draft-action" style={{ ...shellBase, alignItems: "center", justifyContent: "center", pointerEvents: "none", ...style }} aria-label={copy.accessibleLabel}>
      {copy.actionLabel}
    </button>
  );
}

export function CompleteWatchActionAdapter({ style, copy }: ComponentAdapterProps): ReactNode {
  return (
    <button type="button" disabled data-fdraft-component="complete-watch-action" style={{ ...shellBase, alignItems: "center", justifyContent: "center", pointerEvents: "none", ...style }} aria-label={copy.accessibleLabel}>
      {copy.actionLabel}
    </button>
  );
}

export function ChallengeCardAdapter({ style, copy }: ComponentAdapterProps): ReactNode {
  return (
    <div data-fdraft-component="challenge-card" style={{ ...shellBase, background: "#ddd", padding: 8, gap: 4, ...style }}>
      <strong style={{ fontSize: "0.85rem" }}>{copy.title}</strong>
      <p style={{ margin: 0, fontSize: "0.7rem" }}>{copy.description}</p>
    </div>
  );
}

export function ResultsCompletionContentAdapter({ style, copy }: ComponentAdapterProps): ReactNode {
  return (
    <div data-fdraft-component="results-completion-content" style={{ ...shellBase, justifyContent: "center", alignItems: "center", gap: 8, textAlign: "center", ...style }}>
      <h2 style={{ margin: 0, fontSize: "1.25rem" }}>{copy.headline}</h2>
      <p style={{ margin: 0, fontSize: "0.85rem" }}>{copy.body}</p>
    </div>
  );
}

/** Component keys the sample registry below implements, for reference from docs/tests. */
export const SAMPLE_COMPONENT_KEYS = [
  "page-title",
  "event-information",
  "event-countdown",
  "event-navigation",
  "draft-controls",
  "draft-progress",
  "film-grid",
  "film-card",
  "event-progress",
  "points-counter",
  "event-points-counter",
  "profile-badge",
  "generate-draft-action",
  "complete-watch-action",
  "challenge-card",
  "results-completion-content",
] as const;

/**
 * The copy contract for every sample component key — what Studio's
 * property/copy editing UI reads to know which slots exist, their
 * approved default text, whether they can ever be blank, allowed
 * runtime placeholders, and a safe accessible-name fallback. A real
 * FDraft host declares its own contract for its real adapters (Prompt
 * 10); this is the sample/Studio-preview version.
 */
export const SAMPLE_COPY_CONTRACTS: ComponentCopyContractRegistry = {
  "page-title": [{ key: "title", label: "Title", defaultText: "Sample Event Title", required: true, maxLength: 80, accessibleNameFallback: "Event title" }],
  "event-information": [
    { key: "eventName", label: "Event name", defaultText: "Sample Event", required: true, maxLength: 60, allowedPlaceholders: ["eventName"] },
    { key: "dateRange", label: "Date range", defaultText: "Runs 1 Oct – 31 Oct (sample dates)", required: false, maxLength: 80, allowedPlaceholders: ["eventDate"] },
  ],
  "event-countdown": [{ key: "accessibleLabel", label: "Accessible label", defaultText: "Time remaining until the event ends", required: true, maxLength: 100, accessibleNameFallback: "Event countdown" }],
  "event-navigation": [
    { key: "previousLabel", label: "Previous label", defaultText: "Previous", required: true, maxLength: 30 },
    { key: "nextLabel", label: "Next label", defaultText: "Next", required: true, maxLength: 30 },
    { key: "accessibleLabel", label: "Accessible label", defaultText: "Event navigation", required: true, maxLength: 60 },
  ],
  "draft-controls": [
    { key: "skipLabel", label: "Skip button", defaultText: "Skip", required: true, maxLength: 20 },
    { key: "confirmLabel", label: "Confirm button", defaultText: "Confirm pick", required: true, maxLength: 20 },
    { key: "accessibleLabel", label: "Confirm accessible label", defaultText: "Confirm your film pick", required: true, maxLength: 80 },
  ],
  "draft-progress": [{ key: "statusLabel", label: "Status text", defaultText: "{{picksMade}} of {{totalPicks}} picks made", required: true, maxLength: 60, allowedPlaceholders: ["progress", "targetCount", "watchedCount"] }],
  "film-grid": [],
  "film-card": [{ key: "watchedBadgeLabel", label: "Watched badge", defaultText: "Watched", required: false, maxLength: 20 }],
  "event-progress": [
    { key: "statusLabel", label: "Status text", defaultText: "{{progress}}% complete", required: true, maxLength: 60, allowedPlaceholders: ["progress", "watchedCount", "targetCount"] },
    { key: "accessibleLabel", label: "Accessible label", defaultText: "Event completion progress", required: true, maxLength: 80 },
  ],
  "points-counter": [
    { key: "unitLabel", label: "Unit label", defaultText: "pts", required: true, maxLength: 20 },
    { key: "accessibleLabel", label: "Accessible label", defaultText: "Your points", required: true, maxLength: 60 },
  ],
  "event-points-counter": [
    { key: "unitLabel", label: "Unit label", defaultText: "event pts", required: true, maxLength: 20 },
    { key: "accessibleLabel", label: "Accessible label", defaultText: "Your points for this event", required: true, maxLength: 60 },
  ],
  "profile-badge": [{ key: "accessibleLabel", label: "Accessible label", defaultText: "Your profile", required: true, maxLength: 60 }],
  "generate-draft-action": [
    { key: "actionLabel", label: "Button label", defaultText: "Generate My Draft", required: true, maxLength: 30 },
    { key: "accessibleLabel", label: "Accessible label", defaultText: "Generate my film draft", required: true, maxLength: 80 },
  ],
  "complete-watch-action": [
    { key: "actionLabel", label: "Button label", defaultText: "Mark as Watched", required: true, maxLength: 30 },
    { key: "accessibleLabel", label: "Accessible label", defaultText: "Mark this film as watched", required: true, maxLength: 80 },
  ],
  "challenge-card": [
    { key: "title", label: "Challenge title", defaultText: "Weekend Challenge", required: true, maxLength: 60 },
    { key: "description", label: "Description", defaultText: "Watch 3 films this weekend to earn a bonus.", required: false, maxLength: 200 },
  ],
  "results-completion-content": [
    { key: "headline", label: "Headline", defaultText: "You're all caught up!", required: true, maxLength: 80 },
    { key: "body", label: "Body text", defaultText: "Thanks for taking part — check back next event for more.", required: false, maxLength: 300, allowedPlaceholders: ["eventName"] },
  ],
};
