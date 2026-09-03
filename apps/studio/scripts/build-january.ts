/**
 * Builds the official "F* You, It's January!" starter project — no real
 * artwork exists anywhere for this event (confirmed: no
 * ../FDraft/public/events/january/ directory, no manifest, "a plain
 * icon-only theme" today per FDraft's own event-visual-themes code). The
 * grey/miserable mood is built entirely from design tokens (no images
 * needed for that part), and real particle effects (rain, clouds, fog)
 * stand in for "dark clouds, rain" — genuinely built-in, procedural,
 * FDraft-approved-shape effects, not invented artwork. "Scattered
 * rubbish" has no real asset and none is invented: a clearly-labeled,
 * visibly-named empty-slot placeholder shape records this as a real,
 * open missing-art item — never a silent gap. Kept exactly as-is by this
 * migration — no real artwork has been supplied yet.
 *
 * Now built from the FULL "FDraft Default Event" template
 * (`startFromDefaultTemplate`, all 14 component keys across 8 pages) —
 * the temporary compatibility-scoped 7-key structure this project used
 * before is gone, matching Christmas's own migration. FDraft's real,
 * currently-committed `FDRAFT_SUPPORTED_COMPONENT_KEYS`/
 * `FDRAFT_SUPPORTED_CAPABILITIES` now cover all 14 keys plus `behaviour`/
 * `effects` (see ../FDraft/src/infrastructure/theme-runtime/
 * compatibility.ts, commit `006035c`) — confirmed live before this
 * migration, not assumed. The real effects, grey palette, missing-art
 * placeholder, and every existing copy tone are preserved exactly.
 *
 * The event's real business rules — the 25–31 January window, film
 * eligibility, the curated whitelist, and Misery Points — are never
 * encoded here. This project only ever reads `progressPercent`/
 * `eventStatus`/etc. the same read-only way every other theme does;
 * FDraft continues to own all of that logic.
 *
 * Run: pnpm --filter @fdraft/studio exec tsx scripts/build-january.ts <workDir> [fdraftRepoPath]
 */
import {
  createSession,
  startFromDefaultTemplate,
  project,
  addPopup,
  addComponentLayer,
  addEffectLayer,
  addColorToken,
  addShapeLayer,
  addSimulationScenario,
  setCopy,
  saveCompileAndReport,
  assertClean,
  getContainerLayers,
  type ContainerRef,
} from "./starterEventBuilder.js";

async function main(): Promise<void> {
  const workDir = process.argv[2];
  const fdraftRepoPath = process.argv[3];
  if (!workDir) throw new Error("Usage: build-january.ts <workDir> [fdraftRepoPath]");

  const { session, platform } = await createSession(workDir);
  startFromDefaultTemplate(session, "F* You, It's January!");

  const pageRef = (name: string): ContainerRef => ({ kind: "page", id: project(session).pages.find((p) => p.name === name)!.id });
  function titleLayerId(ref: ContainerRef) {
    return getContainerLayers(project(session), ref).find((l) => l.type === "component" && l.componentKey === "page-title")!.id;
  }
  function componentLayerId(ref: ContainerRef, componentKey: string) {
    return getContainerLayers(project(session), ref).find((l) => l.type === "component" && l.componentKey === componentKey)!.id;
  }

  const landing = pageRef("Event Landing");
  const draftPage = pageRef("Draft");
  const resultsPage = pageRef("Results");
  const completionPage = pageRef("Completion");
  const aboutPage = pageRef("About/Information");
  const availablePage = pageRef("Event Available");
  const joinPage = pageRef("Join");
  const completePage = pageRef("Event Complete");

  // ---- Event Available / Join popup — mirrors Halloween's and Christmas's own real popup pattern ----
  const availablePopup = addPopup(session, "Event Available");
  addComponentLayer(session, availablePopup, { name: "Popup Title", componentKey: "page-title", transform: { x: 460, y: 300, width: 1000, height: 100, rotationDeg: 0, scaleX: 1, scaleY: 1 }, zIndex: 1 });
  addComponentLayer(session, availablePopup, { name: "Popup Info", componentKey: "event-information", transform: { x: 460, y: 430, width: 1000, height: 140, rotationDeg: 0, scaleX: 1, scaleY: 1 }, zIndex: 1 });
  addComponentLayer(session, availablePopup, { name: "Popup Join Action", componentKey: "generate-draft-action", transform: { x: 810, y: 620, width: 300, height: 70, rotationDeg: 0, scaleX: 1, scaleY: 1 }, zIndex: 1 });

  // ---- Grey/miserable palette, token-driven — no images needed for the base mood; unchanged from before, now applied across all 8 real pages + popup ----
  const skyGrey = addColorToken(session, "January Sky Grey", "#3f3f46");
  const rubbleGrey = addColorToken(session, "Rubbish Placeholder Grey", "#6b6b73");
  for (const ref of [landing, draftPage, resultsPage, completionPage, aboutPage, availablePage, joinPage, completePage, availablePopup]) {
    addShapeLayer(session, ref, { name: "Background", shape: "rect", fillColorTokenId: skyGrey, transform: { x: 0, y: 0, width: 1920, height: 1080, rotationDeg: 0, scaleX: 1, scaleY: 1 }, zIndex: -1 });
  }

  // ---- Real, built-in particle effects for "dark clouds, rain" — unchanged, still on Event Landing only ----
  addEffectLayer(session, landing, "clouds", "Dark Clouds");
  addEffectLayer(session, landing, "rain", "Miserable Rain");
  addEffectLayer(session, landing, "fog", "Grey Fog");

  // ---- Clearly-labeled empty asset slot: "scattered rubbish" has no real art, none invented — unchanged ----
  addShapeLayer(session, landing, {
    name: "MISSING ART — Scattered rubbish (needs illustration)",
    shape: "rect",
    fillColorTokenId: rubbleGrey,
    transform: { x: 700, y: 900, width: 520, height: 120, rotationDeg: 0, scaleX: 1, scaleY: 1 },
    zIndex: 5,
  });

  // ---- Deliberate copy on every real slot — miserable on purpose, never hiding the real 25-31 Jan window/eligibility/points logic that stays in FDraft ----

  // Event Landing
  setCopy(session, landing, titleLayerId(landing), "title", "F* You, It's January");
  setCopy(session, landing, componentLayerId(landing, "event-information"), "eventName", "{{eventName}}");
  setCopy(session, landing, componentLayerId(landing, "event-information"), "dateRange", "One miserable week. Might as well watch something.");
  setCopy(session, landing, componentLayerId(landing, "event-countdown"), "accessibleLabel", "Time left in this miserable January event");
  setCopy(session, landing, componentLayerId(landing, "profile-badge"), "accessibleLabel", "Your January profile");
  setCopy(session, landing, componentLayerId(landing, "event-navigation"), "previousLabel", "Back");
  setCopy(session, landing, componentLayerId(landing, "event-navigation"), "nextLabel", "Fine, Next");
  setCopy(session, landing, componentLayerId(landing, "event-navigation"), "accessibleLabel", "January event navigation");
  setCopy(session, landing, componentLayerId(landing, "generate-draft-action"), "actionLabel", "Fine. Let's Do This.");
  setCopy(session, landing, componentLayerId(landing, "generate-draft-action"), "accessibleLabel", "Generate my January film draft");

  // Draft
  setCopy(session, draftPage, titleLayerId(draftPage), "title", "Pick Something. Anything.");
  setCopy(session, draftPage, componentLayerId(draftPage, "draft-progress"), "statusLabel", "{{picksMade}} of {{totalPicks}} endured");
  setCopy(session, draftPage, componentLayerId(draftPage, "draft-controls"), "skipLabel", "Can't Even");
  setCopy(session, draftPage, componentLayerId(draftPage, "draft-controls"), "confirmLabel", "Fine, This One");
  setCopy(session, draftPage, componentLayerId(draftPage, "draft-controls"), "accessibleLabel", "Confirm your January film pick");

  // Results
  setCopy(session, resultsPage, titleLayerId(resultsPage), "title", "Misery, Quantified");
  setCopy(session, resultsPage, componentLayerId(resultsPage, "results-completion-content"), "headline", "Still going.");
  setCopy(session, resultsPage, componentLayerId(resultsPage, "results-completion-content"), "body", "The grey continues. So do you.");
  setCopy(session, resultsPage, componentLayerId(resultsPage, "points-counter"), "unitLabel", "misery pts");
  setCopy(session, resultsPage, componentLayerId(resultsPage, "points-counter"), "accessibleLabel", "Your misery points");

  // Completion
  setCopy(session, completionPage, titleLayerId(completionPage), "title", "You Survived");
  setCopy(session, completionPage, componentLayerId(completionPage, "results-completion-content"), "headline", "It's over.");
  setCopy(session, completionPage, componentLayerId(completionPage, "results-completion-content"), "body", "Every miserable pick, watched. Go outside, maybe.");
  setCopy(session, completionPage, componentLayerId(completionPage, "complete-watch-action"), "actionLabel", "Mark as Watched");
  setCopy(session, completionPage, componentLayerId(completionPage, "complete-watch-action"), "accessibleLabel", "Mark this January film as watched");

  // About/Information
  setCopy(session, aboutPage, titleLayerId(aboutPage), "title", "What Even Is This");
  setCopy(session, aboutPage, componentLayerId(aboutPage, "event-information"), "eventName", "{{eventName}}");
  setCopy(session, aboutPage, componentLayerId(aboutPage, "event-information"), "dateRange", "A short, grey, curated watch — because January deserves nothing more.");

  // Event Available
  setCopy(session, availablePage, titleLayerId(availablePage), "title", "Not Yet. Obviously.");
  setCopy(session, availablePage, componentLayerId(availablePage, "event-information"), "eventName", "{{eventName}}");
  setCopy(session, availablePage, componentLayerId(availablePage, "event-information"), "dateRange", "Come back when it's actually miserable enough.");
  setCopy(session, availablePage, componentLayerId(availablePage, "event-countdown"), "accessibleLabel", "Time until the January event opens");
  setCopy(session, availablePage, componentLayerId(availablePage, "challenge-card"), "title", "Endure 3 in a Row");
  setCopy(session, availablePage, componentLayerId(availablePage, "challenge-card"), "description", "Watch 3 picks back to back. No reward. That's the point.");

  // Join
  setCopy(session, joinPage, titleLayerId(joinPage), "title", "It's Happening.");
  setCopy(session, joinPage, componentLayerId(joinPage, "event-information"), "eventName", "{{eventName}}");
  setCopy(session, joinPage, componentLayerId(joinPage, "event-information"), "dateRange", "Opt in from your profile. We won't judge. Much.");
  setCopy(session, joinPage, componentLayerId(joinPage, "generate-draft-action"), "actionLabel", "Fine, Sign Me Up");
  setCopy(session, joinPage, componentLayerId(joinPage, "generate-draft-action"), "accessibleLabel", "Join the January event");

  // Event Complete
  setCopy(session, completePage, titleLayerId(completePage), "title", "January Is Over");
  setCopy(session, completePage, componentLayerId(completePage, "results-completion-content"), "headline", "It's February now.");
  setCopy(session, completePage, componentLayerId(completePage, "results-completion-content"), "body", "You made it through {{eventName}}. Small mercies.");
  setCopy(session, completePage, componentLayerId(completePage, "points-counter"), "unitLabel", "misery pts");
  setCopy(session, completePage, componentLayerId(completePage, "points-counter"), "accessibleLabel", "Your final misery points");
  setCopy(session, completePage, componentLayerId(completePage, "event-points-counter"), "unitLabel", "misery pts");
  setCopy(session, completePage, componentLayerId(completePage, "event-points-counter"), "accessibleLabel", "Your points for this January event");

  // Event Available popup
  setCopy(session, availablePopup, titleLayerId(availablePopup), "title", "It's January. Again.");
  setCopy(session, availablePopup, componentLayerId(availablePopup, "event-information"), "eventName", "{{eventName}}");
  setCopy(session, availablePopup, componentLayerId(availablePopup, "event-information"), "dateRange", "Opt in now. Or don't. It's January either way.");
  setCopy(session, availablePopup, componentLayerId(availablePopup, "generate-draft-action"), "actionLabel", "Let's Get This Over With");
  setCopy(session, availablePopup, componentLayerId(availablePopup, "generate-draft-action"), "accessibleLabel", "Join the January event now");

  // ---- Saved simulator scenarios — exactly the 5 states named in the brief, unchanged ----
  const common = { performanceTier: "high" as const, reducedMotion: false, dataProfile: "normal" as const };
  addSimulationScenario(session, "Available", { ...common, eventStatus: "available", eventActive: false, eventAvailable: true, optedIn: false, draftGenerated: false, eventCompleted: false, progressPercent: 0, watchedCount: 0, targetCount: 5 });
  addSimulationScenario(session, "Joined", { ...common, eventStatus: "active", eventActive: true, eventAvailable: true, optedIn: true, draftGenerated: false, eventCompleted: false, progressPercent: 0, watchedCount: 0, targetCount: 5 });
  addSimulationScenario(session, "Partial progress", { ...common, eventStatus: "active", eventActive: true, eventAvailable: true, optedIn: true, draftGenerated: true, eventCompleted: false, progressPercent: 40, watchedCount: 2, targetCount: 5 });
  addSimulationScenario(session, "Completed", { ...common, eventStatus: "active", eventActive: true, eventAvailable: true, optedIn: true, draftGenerated: true, eventCompleted: true, progressPercent: 100, watchedCount: 5, targetCount: 5 });
  addSimulationScenario(session, "Ended", { ...common, eventStatus: "ended", eventActive: false, eventAvailable: false, optedIn: true, draftGenerated: true, eventCompleted: true, progressPercent: 100, watchedCount: 5, targetCount: 5 });

  // Official, intentionally re-runnable builder — see build-christmas.ts's
  // own comment on `confirmSlugOverwrite` for why this is safe here. Note
  // the real slug is derived from this project's real name ("F* You,
  // It's January!"), never forced to a fixed "january" identifier — see
  // `slug.ts`'s `slugify`.
  const report = await saveCompileAndReport(session, platform, { slug: "january", workDir, fdraftRepoPath, confirmSlugOverwrite: true });
  assertClean(report, "January");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
