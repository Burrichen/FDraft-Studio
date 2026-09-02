# Renderer host notes

Recorded 2026-09-02, from a **read-only** inspection of the sibling `../FDraft`
checkout (branch `feat/dev-build1-event-studio` at the time of writing — see
`docs/architecture/BASELINE_AUDIT.md`). Nothing here was copied into this
repository; no FDraft file was read beyond what's cited below. This documents
candidate real component-adapter mappings and host constraints for **Prompt
10** (FDraft runtime integration) — it does not change anything about the
sample adapters `packages/theme-renderer/src/componentAdapters/sampleAdapters.tsx`
implements now, which remain deterministic placeholders only.

Every mapping below is **candidate until independently verified** — FDraft's
codebase will have moved on by the time Prompt 10 starts, and none of this
was tested against `@fdraft/theme-renderer`'s actual `ComponentAdapterProps`
contract.

## Candidate real adapters, by sample component key

| Key | Closest real FDraft source | Notes |
| --- | --- | --- |
| `page-title` | No dedicated component — pages compose `<CardTitle>` (`src/components/ui/card.tsx`, a shadcn primitive) ad hoc inside `src/components/events/event-page-view.tsx`. | A real adapter likely needs to be a new thin wrapper, or just render the event name as text. |
| `event-information` | `src/components/events/event-page-view.tsx` — reads event name/status via `getEventDefinition()` (`src/domain/events/event-registry.ts`) and live availability via `useEventDiscovery()` (`src/components/events/event-discovery-provider.tsx`) + `event-availability.ts`. | `"use client"`; requires `EventDiscoveryProvider` and profile context in the tree — not a standalone presentational component. |
| `event-countdown` | No standalone UI component. Logic lives in `src/application/events/event-clock.ts` (`getEffectiveEventDate`) and `src/domain/events/event-availability.ts` (`getNextOccurrenceStart`); rendered inline in `event-page-view.tsx`. | Time-sensitive: must resolve "now" via `getEffectiveEventDate`, never `new Date()` directly, to respect the Admin Mode test-date override. |
| `draft-controls` | `src/components/drafts/draft-lifecycle-view.tsx` (skip/confirm/reroll UI) + `src/components/events/use-event-opt-in-flow.ts` (opt-in action) + `src/application/events/event-draft-finalization.ts` (logic only, no UI). | `"use client"`; opt-in flow uses `next/navigation`'s `useRouter` and expects a `Repositories` bag injected, not a global singleton. |
| `film-grid` | `src/components/drafts/active-draft-films.tsx` (`DraftFilmCard` grid) is the closest real match; `src/components/events/event-art-image.tsx` is decorative-only, not a grid. | `ActiveDraftFilms` depends on a `useWatchUndo()` context and expects pre-fetched `DraftFilmCardView[]` — it doesn't self-fetch. |
| `event-progress` | No dedicated event-progress UI found. Closest logic: `src/domain/events/event-eligibility.ts` + `event-availability.ts`. `src/components/drafts/draft-time-progress.tsx` is a generic (non-event) draft-time progress bar. | Would likely need a new component built on the eligibility/availability domain modules. |
| `points-counter` | `src/components/stats/points-card.tsx` (`PointsCard`) — real display component, fixed props `{icon, iconClassName, label, value}`, no built-in fetching. | Balance comes from `PointsRepository.getBalance()`/`getAllBalances()` (`src/repositories/points-repository.ts`); reward computation is `src/application/events/draft-completion-reward.ts` using `GENERIC_POINT_CURRENCY`. |

## Host constraints a real adapter implementation will need to handle

- **Persistence is Dexie-backed.** Real data comes from repository modules under `src/repositories/*.ts` (e.g. `draft-repository.ts`, `points-repository.ts`, `profile-repository.ts`), which use Dexie directly. A real adapter needs a repository instance injected — there's no global singleton to import.
- **Context dependencies.** Most real event UI requires `EventDiscoveryProvider` and a profile provider somewhere above it in the tree, and is marked `"use client"` (Next.js App Router client/server boundary matters for where an adapter can be mounted).
- **The Admin Mode test-date override.** Anything time-sensitive (countdown, availability, eligibility) must resolve "now" through `getEffectiveEventDate` (`src/application/events/event-clock.ts`), not `new Date()` — bypassing it breaks FDraft's dev/test clock switcher.
- **No component here currently accepts theme-driven styling.** None of the real components above expose a "safe outer shell + allowlisted style props" contract the way `ComponentAdapterProps` requires — Prompt 10's real adapters will need to be new wrapper components around this existing logic, not the existing components used directly.

## What this does *not* do

This is documentation only. It does not import, copy, or depend on anything from `../FDraft`, and it does not change `packages/theme-renderer`'s sample adapter set. `apps/renderer-lab` and `packages/theme-renderer` were verified (via `scripts/check-package-boundaries.mjs`) to contain no references into the sibling FDraft checkout.
