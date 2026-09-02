import type { ComponentAdapterRegistry, ComponentCopyContractRegistry } from "../types.js";
import {
  PageTitleAdapter,
  EventInformationAdapter,
  EventCountdownAdapter,
  EventNavigationAdapter,
  DraftControlsAdapter,
  DraftProgressAdapter,
  FilmGridAdapter,
  FilmCardAdapter,
  EventProgressAdapter,
  PointsCounterAdapter,
  EventPointsCounterAdapter,
  ProfileBadgeAdapter,
  GenerateDraftActionAdapter,
  CompleteWatchActionAdapter,
  ChallengeCardAdapter,
  ResultsCompletionContentAdapter,
  SAMPLE_COPY_CONTRACTS,
} from "./sampleAdapters.js";

export function createComponentAdapterRegistry(adapters: ComponentAdapterRegistry): ComponentAdapterRegistry {
  return { ...adapters };
}

/**
 * The sample registry: deterministic placeholder components proving the
 * component-adapter architecture end-to-end. Studio will later swap in
 * polished mock adapters; FDraft will map the same keys to real
 * components with live read-only data (Prompt 10). Neither of those hosts
 * should import this registry — it's fixture-lab/demo material only.
 */
export function createSampleComponentAdapterRegistry(): ComponentAdapterRegistry {
  return createComponentAdapterRegistry({
    "page-title": PageTitleAdapter,
    "event-information": EventInformationAdapter,
    "event-countdown": EventCountdownAdapter,
    "event-navigation": EventNavigationAdapter,
    "draft-controls": DraftControlsAdapter,
    "draft-progress": DraftProgressAdapter,
    "film-grid": FilmGridAdapter,
    "film-card": FilmCardAdapter,
    "event-progress": EventProgressAdapter,
    "points-counter": PointsCounterAdapter,
    "event-points-counter": EventPointsCounterAdapter,
    "profile-badge": ProfileBadgeAdapter,
    "generate-draft-action": GenerateDraftActionAdapter,
    "complete-watch-action": CompleteWatchActionAdapter,
    "challenge-card": ChallengeCardAdapter,
    "results-completion-content": ResultsCompletionContentAdapter,
  });
}

/** The copy contract paired with `createSampleComponentAdapterRegistry()` — see `SAMPLE_COPY_CONTRACTS`'s own doc comment. */
export function createSampleCopyContractRegistry(): ComponentCopyContractRegistry {
  return { ...SAMPLE_COPY_CONTRACTS };
}
