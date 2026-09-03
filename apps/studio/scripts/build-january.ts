/**
 * Builds the official "F* You, It's January!" starter project — no real
 * artwork exists anywhere for this event (confirmed: no
 * ../FDraft/public/events/january/ directory, no manifest, "a plain
 * icon-only theme" today per FDraft's own event-visual-themes code). The
 * grey/miserable mood is built entirely from design tokens (no images
 * needed for that part), and real particle effects (rain, clouds) stand
 * in for "dark clouds, rain" — genuinely built-in, procedural,
 * FDraft-approved-shape effects, not invented artwork. "Scattered
 * rubbish" has no real asset and none is invented: a clearly-labeled,
 * visibly-named empty-slot placeholder shape records this as a real,
 * open missing-art item — never a silent gap.
 *
 * Like Halloween, the real particle effects mean this project declares
 * the `effects` capability, which FDraft's current build doesn't support
 * yet — the publish attempt below is *expected* to be correctly blocked,
 * reported not hidden. Uses the same compatibility-scoped 7-component-key
 * page structure as Christmas otherwise, so `effects` is the *only*
 * blocking reason here (a cleaner, more precise proof point than
 * Halloween's, which is also blocked on unsupported component keys).
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
  project,
  addPage,
  addPopup,
  addComponentRequirement,
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
import { renamePage } from "../src/project/containerCommands.js";

async function main(): Promise<void> {
  const workDir = process.argv[2];
  const fdraftRepoPath = process.argv[3];
  if (!workDir) throw new Error("Usage: build-january.ts <workDir> [fdraftRepoPath]");

  const { session, platform } = await createSession(workDir);
  session.newProject("F* You, It's January!");
  const homePage = project(session).pages[0]!;
  const renameCmd = renamePage(project(session), homePage.id, "Event Landing");
  if (renameCmd) session.applyCommand(renameCmd);
  const landing: ContainerRef = { kind: "page", id: homePage.id };

  addComponentRequirement(session, "page-title", { required: true });
  addComponentRequirement(session, "event-information", { required: true });
  addComponentRequirement(session, "event-countdown", { required: true });
  addComponentRequirement(session, "draft-controls", { required: true });
  addComponentRequirement(session, "film-grid", { required: true });
  addComponentRequirement(session, "event-progress", { required: true });
  addComponentRequirement(session, "points-counter", { required: true });

  const draftPage = addPage(session, "Draft");
  const resultsPage = addPage(session, "Results");
  const completionPage = addPage(session, "Completion");
  const aboutPage = addPage(session, "About/Information");
  const availablePage = addPage(session, "Event Available");
  const joinPopup = addPopup(session, "Join");

  // ---- Grey/miserable palette, token-driven — no images needed for the base mood ----
  const skyGrey = addColorToken(session, "January Sky Grey", "#3f3f46");
  const rubbleGrey = addColorToken(session, "Rubbish Placeholder Grey", "#6b6b73");
  for (const ref of [landing, draftPage, resultsPage, completionPage, aboutPage, availablePage, joinPopup]) {
    addShapeLayer(session, ref, { name: "Background", shape: "rect", fillColorTokenId: skyGrey, transform: { x: 0, y: 0, width: 1920, height: 1080, rotationDeg: 0, scaleX: 1, scaleY: 1 }, zIndex: -1 });
  }

  // ---- Real, built-in particle effects for "dark clouds, rain" (procedural, not asset-dependent) ----
  addEffectLayer(session, landing, "clouds", "Dark Clouds");
  addEffectLayer(session, landing, "rain", "Miserable Rain");
  addEffectLayer(session, landing, "fog", "Grey Fog");

  // ---- Clearly-labeled empty asset slot: "scattered rubbish" has no real art, none invented ----
  addShapeLayer(session, landing, {
    name: "MISSING ART — Scattered rubbish (needs illustration)",
    shape: "rect",
    fillColorTokenId: rubbleGrey,
    transform: { x: 700, y: 900, width: 520, height: 120, rotationDeg: 0, scaleX: 1, scaleY: 1 },
    zIndex: 5,
  });

  // ---- Components ----
  addComponentLayer(session, landing, { name: "Title", componentKey: "page-title", transform: { x: 660, y: 120, width: 600, height: 100, rotationDeg: 0, scaleX: 1, scaleY: 1 }, zIndex: 1 });
  addComponentLayer(session, landing, { name: "Info", componentKey: "event-information", transform: { x: 660, y: 250, width: 600, height: 100, rotationDeg: 0, scaleX: 1, scaleY: 1 }, zIndex: 1 });
  addComponentLayer(session, landing, { name: "Countdown", componentKey: "event-countdown", transform: { x: 660, y: 380, width: 600, height: 80, rotationDeg: 0, scaleX: 1, scaleY: 1 }, zIndex: 1 });

  addComponentLayer(session, draftPage, { name: "Title", componentKey: "page-title", transform: { x: 660, y: 100, width: 600, height: 100, rotationDeg: 0, scaleX: 1, scaleY: 1 }, zIndex: 1 });
  addComponentLayer(session, draftPage, { name: "Films", componentKey: "film-grid", transform: { x: 460, y: 240, width: 1000, height: 560, rotationDeg: 0, scaleX: 1, scaleY: 1 }, zIndex: 1 });
  addComponentLayer(session, draftPage, { name: "Controls", componentKey: "draft-controls", transform: { x: 660, y: 850, width: 600, height: 80, rotationDeg: 0, scaleX: 1, scaleY: 1 }, zIndex: 1 });

  addComponentLayer(session, resultsPage, { name: "Title", componentKey: "page-title", transform: { x: 660, y: 150, width: 600, height: 100, rotationDeg: 0, scaleX: 1, scaleY: 1 }, zIndex: 1 });
  addComponentLayer(session, resultsPage, { name: "Progress", componentKey: "event-progress", transform: { x: 660, y: 300, width: 600, height: 60, rotationDeg: 0, scaleX: 1, scaleY: 1 }, zIndex: 1 });
  addComponentLayer(session, resultsPage, { name: "Points", componentKey: "points-counter", transform: { x: 660, y: 420, width: 600, height: 80, rotationDeg: 0, scaleX: 1, scaleY: 1 }, zIndex: 1 });

  addComponentLayer(session, completionPage, { name: "Title", componentKey: "page-title", transform: { x: 660, y: 150, width: 600, height: 100, rotationDeg: 0, scaleX: 1, scaleY: 1 }, zIndex: 1 });
  addComponentLayer(session, completionPage, { name: "Progress", componentKey: "event-progress", transform: { x: 660, y: 300, width: 600, height: 60, rotationDeg: 0, scaleX: 1, scaleY: 1 }, zIndex: 1 });
  addComponentLayer(session, completionPage, { name: "Points", componentKey: "points-counter", transform: { x: 660, y: 420, width: 600, height: 80, rotationDeg: 0, scaleX: 1, scaleY: 1 }, zIndex: 1 });

  addComponentLayer(session, aboutPage, { name: "Title", componentKey: "page-title", transform: { x: 660, y: 150, width: 600, height: 100, rotationDeg: 0, scaleX: 1, scaleY: 1 }, zIndex: 1 });
  addComponentLayer(session, aboutPage, { name: "Info", componentKey: "event-information", transform: { x: 660, y: 280, width: 600, height: 140, rotationDeg: 0, scaleX: 1, scaleY: 1 }, zIndex: 1 });

  addComponentLayer(session, availablePage, { name: "Title", componentKey: "page-title", transform: { x: 660, y: 150, width: 600, height: 100, rotationDeg: 0, scaleX: 1, scaleY: 1 }, zIndex: 1 });
  addComponentLayer(session, availablePage, { name: "Info", componentKey: "event-information", transform: { x: 660, y: 280, width: 600, height: 100, rotationDeg: 0, scaleX: 1, scaleY: 1 }, zIndex: 1 });
  addComponentLayer(session, availablePage, { name: "Countdown", componentKey: "event-countdown", transform: { x: 660, y: 400, width: 600, height: 80, rotationDeg: 0, scaleX: 1, scaleY: 1 }, zIndex: 1 });

  addComponentLayer(session, joinPopup, { name: "Title", componentKey: "page-title", transform: { x: 460, y: 300, width: 1000, height: 100, rotationDeg: 0, scaleX: 1, scaleY: 1 }, zIndex: 1 });
  addComponentLayer(session, joinPopup, { name: "Info", componentKey: "event-information", transform: { x: 460, y: 430, width: 1000, height: 140, rotationDeg: 0, scaleX: 1, scaleY: 1 }, zIndex: 1 });

  // ---- Deliberate copy on every real slot — miserable on purpose, never hiding the real 25-31 Jan window/eligibility/points logic that stays in FDraft ----
  function componentLayerId(ref: ContainerRef, componentKey: string) {
    return getContainerLayers(project(session), ref).find((l) => l.type === "component" && l.componentKey === componentKey)!.id;
  }

  setCopy(session, landing, componentLayerId(landing, "page-title"), "title", "F* You, It's January");
  setCopy(session, landing, componentLayerId(landing, "event-information"), "eventName", "{{eventName}}");
  setCopy(session, landing, componentLayerId(landing, "event-information"), "dateRange", "One miserable week. Might as well watch something.");
  setCopy(session, landing, componentLayerId(landing, "event-countdown"), "accessibleLabel", "Time left in this miserable January event");

  setCopy(session, draftPage, componentLayerId(draftPage, "page-title"), "title", "Pick Something. Anything.");
  setCopy(session, draftPage, componentLayerId(draftPage, "draft-controls"), "skipLabel", "Can't Even");
  setCopy(session, draftPage, componentLayerId(draftPage, "draft-controls"), "confirmLabel", "Fine, This One");
  setCopy(session, draftPage, componentLayerId(draftPage, "draft-controls"), "accessibleLabel", "Confirm your January film pick");

  setCopy(session, resultsPage, componentLayerId(resultsPage, "page-title"), "title", "Misery, Quantified");
  setCopy(session, resultsPage, componentLayerId(resultsPage, "event-progress"), "statusLabel", "{{progress}}% through the misery");
  setCopy(session, resultsPage, componentLayerId(resultsPage, "event-progress"), "accessibleLabel", "January event progress");
  setCopy(session, resultsPage, componentLayerId(resultsPage, "points-counter"), "unitLabel", "misery pts");
  setCopy(session, resultsPage, componentLayerId(resultsPage, "points-counter"), "accessibleLabel", "Your misery points");

  setCopy(session, completionPage, componentLayerId(completionPage, "page-title"), "title", "You Survived");
  setCopy(session, completionPage, componentLayerId(completionPage, "event-progress"), "statusLabel", "100% — it's over");
  setCopy(session, completionPage, componentLayerId(completionPage, "event-progress"), "accessibleLabel", "January event completion");
  setCopy(session, completionPage, componentLayerId(completionPage, "points-counter"), "unitLabel", "misery pts");
  setCopy(session, completionPage, componentLayerId(completionPage, "points-counter"), "accessibleLabel", "Your final misery points");

  setCopy(session, aboutPage, componentLayerId(aboutPage, "page-title"), "title", "What Even Is This");
  setCopy(session, aboutPage, componentLayerId(aboutPage, "event-information"), "eventName", "{{eventName}}");
  setCopy(session, aboutPage, componentLayerId(aboutPage, "event-information"), "dateRange", "A short, grey, curated watch — because January deserves nothing more.");

  setCopy(session, availablePage, componentLayerId(availablePage, "page-title"), "title", "Not Yet. Obviously.");
  setCopy(session, availablePage, componentLayerId(availablePage, "event-information"), "eventName", "{{eventName}}");
  setCopy(session, availablePage, componentLayerId(availablePage, "event-information"), "dateRange", "Come back when it's actually miserable enough.");
  setCopy(session, availablePage, componentLayerId(availablePage, "event-countdown"), "accessibleLabel", "Time until the January event opens");

  setCopy(session, joinPopup, componentLayerId(joinPopup, "page-title"), "title", "It's Happening.");
  setCopy(session, joinPopup, componentLayerId(joinPopup, "event-information"), "eventName", "{{eventName}}");
  setCopy(session, joinPopup, componentLayerId(joinPopup, "event-information"), "dateRange", "Opt in from your profile. We won't judge. Much.");

  // ---- Saved simulator scenarios — exactly the 5 states named in the brief ----
  const common = { performanceTier: "high" as const, reducedMotion: false, dataProfile: "normal" as const };
  addSimulationScenario(session, "Available", { ...common, eventStatus: "available", eventActive: false, eventAvailable: true, optedIn: false, draftGenerated: false, eventCompleted: false, progressPercent: 0, watchedCount: 0, targetCount: 5 });
  addSimulationScenario(session, "Joined", { ...common, eventStatus: "active", eventActive: true, eventAvailable: true, optedIn: true, draftGenerated: false, eventCompleted: false, progressPercent: 0, watchedCount: 0, targetCount: 5 });
  addSimulationScenario(session, "Partial progress", { ...common, eventStatus: "active", eventActive: true, eventAvailable: true, optedIn: true, draftGenerated: true, eventCompleted: false, progressPercent: 40, watchedCount: 2, targetCount: 5 });
  addSimulationScenario(session, "Completed", { ...common, eventStatus: "active", eventActive: true, eventAvailable: true, optedIn: true, draftGenerated: true, eventCompleted: true, progressPercent: 100, watchedCount: 5, targetCount: 5 });
  addSimulationScenario(session, "Ended", { ...common, eventStatus: "ended", eventActive: false, eventAvailable: false, optedIn: true, draftGenerated: true, eventCompleted: true, progressPercent: 100, watchedCount: 5, targetCount: 5 });

  const report = await saveCompileAndReport(session, platform, { slug: "january", workDir, fdraftRepoPath });
  assertClean(report, "January");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
