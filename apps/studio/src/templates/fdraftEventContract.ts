import type { ComponentRequirement, Transform, ZoneKind } from "@fdraft/theme-sdk";

/**
 * The registered page/component contract for the guaranteed "FDraft
 * Default Event" template — the 8 surfaces every FDraft event exposes
 * (Event Landing, Draft, Results, Completion, About/Information, Event
 * Available, Join, Event Complete), each declared as a composition of
 * the shared component registry's own keys (`@fdraft/theme-renderer`'s
 * `SAMPLE_COMPONENT_KEYS`/`SAMPLE_COPY_CONTRACTS`) — never a hand-drawn
 * guess at a real screen's pixel layout. Every string a user sees on
 * these pages comes from a component's own declared copy slot and its
 * approved default text; this file places components, it never invents
 * copy of its own.
 */

export interface ContractComponentPlacement {
  componentKey: string;
  transform: Transform;
  zoneKind?: ZoneKind;
}

export interface ContractPage {
  name: string;
  slug: string;
  components: ContractComponentPlacement[];
}

const baseTransform = (x: number, y: number, width: number, height: number): Transform => ({ x, y, width, height, rotationDeg: 0, scaleX: 1, scaleY: 1 });

export const FDRAFT_EVENT_PAGES: ContractPage[] = [
  {
    name: "Event Landing",
    slug: "event-landing",
    components: [
      { componentKey: "page-title", transform: baseTransform(80, 60, 1760, 100) },
      { componentKey: "event-information", transform: baseTransform(80, 190, 800, 100) },
      { componentKey: "event-countdown", transform: baseTransform(80, 320, 400, 100) },
      { componentKey: "generate-draft-action", transform: baseTransform(80, 460, 320, 64) },
      { componentKey: "profile-badge", transform: baseTransform(1600, 40, 240, 48), zoneKind: "header" },
      { componentKey: "event-navigation", transform: baseTransform(80, 980, 1760, 60), zoneKind: "footer" },
    ],
  },
  {
    name: "Draft",
    slug: "draft",
    components: [
      { componentKey: "page-title", transform: baseTransform(80, 60, 1760, 100) },
      { componentKey: "film-grid", transform: baseTransform(80, 190, 1760, 680) },
      { componentKey: "draft-progress", transform: baseTransform(80, 900, 400, 48) },
      { componentKey: "draft-controls", transform: baseTransform(560, 890, 600, 64) },
    ],
  },
  {
    name: "Results",
    slug: "results",
    components: [
      { componentKey: "page-title", transform: baseTransform(80, 60, 1760, 100) },
      { componentKey: "results-completion-content", transform: baseTransform(260, 220, 1400, 400) },
      { componentKey: "points-counter", transform: baseTransform(80, 660, 280, 64) },
    ],
  },
  {
    name: "Completion",
    slug: "completion",
    components: [
      { componentKey: "page-title", transform: baseTransform(80, 60, 1760, 100) },
      { componentKey: "results-completion-content", transform: baseTransform(260, 220, 1400, 300) },
      { componentKey: "complete-watch-action", transform: baseTransform(800, 560, 320, 64) },
    ],
  },
  {
    name: "About/Information",
    slug: "about",
    components: [
      { componentKey: "page-title", transform: baseTransform(80, 60, 1760, 100) },
      { componentKey: "event-information", transform: baseTransform(80, 190, 1200, 200) },
    ],
  },
  {
    name: "Event Available",
    slug: "event-available",
    components: [
      { componentKey: "page-title", transform: baseTransform(80, 60, 1760, 100) },
      { componentKey: "event-information", transform: baseTransform(80, 190, 800, 100) },
      { componentKey: "event-countdown", transform: baseTransform(80, 320, 400, 100) },
      { componentKey: "challenge-card", transform: baseTransform(1240, 190, 600, 260) },
    ],
  },
  {
    name: "Join",
    slug: "join",
    components: [
      { componentKey: "page-title", transform: baseTransform(80, 60, 1760, 100) },
      { componentKey: "event-information", transform: baseTransform(80, 190, 800, 100) },
      { componentKey: "generate-draft-action", transform: baseTransform(80, 320, 320, 64) },
    ],
  },
  {
    name: "Event Complete",
    slug: "event-complete",
    components: [
      { componentKey: "page-title", transform: baseTransform(80, 60, 1760, 100) },
      { componentKey: "results-completion-content", transform: baseTransform(260, 220, 1400, 300) },
      { componentKey: "points-counter", transform: baseTransform(80, 600, 280, 64) },
      { componentKey: "event-points-counter", transform: baseTransform(400, 600, 280, 64) },
    ],
  },
];

export const FDRAFT_EVENT_ALLOWED_PROPERTIES: ComponentRequirement["allowedProperties"] = ["color", "backgroundColor", "opacity", "fontSize", "fontWeight", "textAlign", "borderRadius", "padding", "margin"];

/** Per-`componentKey` requirement metadata — required/singleton/zone/minimum-size — deduplicated once per project regardless of how many pages place that component. */
export const FDRAFT_EVENT_COMPONENT_METADATA: Record<string, Pick<ComponentRequirement, "required" | "singleton" | "compatibleZoneKinds" | "minWidthPx" | "minHeightPx">> = {
  "page-title": { required: true, singleton: true },
  "event-information": { required: true },
  "event-countdown": { required: true },
  "generate-draft-action": { required: true, singleton: true, minWidthPx: 120, minHeightPx: 44 },
  "profile-badge": { required: false, compatibleZoneKinds: ["header"] },
  "event-navigation": { required: false, compatibleZoneKinds: ["footer"] },
  "film-grid": { required: true },
  "draft-progress": { required: true },
  "draft-controls": { required: true },
  "results-completion-content": { required: true },
  "points-counter": { required: true },
  "complete-watch-action": { required: true, singleton: true, minWidthPx: 120, minHeightPx: 44 },
  "challenge-card": { required: false },
  "event-points-counter": { required: false },
};
