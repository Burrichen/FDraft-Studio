/**
 * Builds the official Christmas starter project — real imported artwork
 * from ../FDraft/public/events/christmas/ (FDraft's own README calls
 * this set "a scaffold only — placeholder-quality," not final creative;
 * recorded here honestly, not claimed as approved final art).
 *
 * Unlike the Halloween/January scripts, this one deliberately does NOT
 * start from `createFdraftDefaultEventProject` — that template places 14
 * component keys, but FDraft's real, currently-committed
 * `FDRAFT_SUPPORTED_COMPONENT_KEYS` only has adapters for 7 of them
 * (confirmed live against ../FDraft/src/infrastructure/theme-runtime/
 * compatibility.ts while building Halloween — a real, previously-
 * undocumented gap between Studio's template contract and FDraft's actual
 * adapter coverage, recorded in docs/IMPLEMENTATION_STATUS.md as a
 * dogfooding finding, not silently routed around). This project is built
 * from a custom, compatibility-scoped page set using only the 7 keys
 * FDraft actually supports today (`page-title`, `event-information`,
 * `event-countdown`, `draft-controls`, `film-grid`, `event-progress`,
 * `points-counter`) plus `masters`/`popups` — so this is the one event
 * proven to actually publish successfully, end to end, right now.
 *
 * Run: pnpm --filter @fdraft/studio exec tsx scripts/build-christmas.ts <workDir> [fdraftRepoPath]
 */
import { join } from "node:path";
import {
  createSession,
  project,
  addPage,
  addPopup,
  addComponentRequirement,
  addComponentLayer,
  addImageLayer,
  importAssetFile,
  addSimulationScenario,
  setCopy,
  saveCompileAndReport,
  assertClean,
  getContainerLayers,
  type ContainerRef,
} from "./starterEventBuilder.js";
import { renamePage } from "../src/project/containerCommands.js";

// Resolved relative to this script, per CLAUDE.md's documented sibling-checkout layout
// (`../FDraft` next to this repository) — never a machine-specific absolute path.
// argv[4] lets the delete-original-sources proof (Phase 4) point this at a scratch
// copy instead of FDraft's real checkout, so the copy can be safely deleted afterward.
const ASSET_DIR = process.argv[4] ?? join(import.meta.dirname, "../../../../FDraft/public/events/christmas");

async function main(): Promise<void> {
  const workDir = process.argv[2];
  const fdraftRepoPath = process.argv[3];
  if (!workDir) throw new Error("Usage: build-christmas.ts <workDir> [fdraftRepoPath]");

  const { session, platform } = await createSession(workDir);
  session.newProject("Christmas");
  const homePage = project(session).pages[0]!;
  const renameCmd = renamePage(project(session), homePage.id, "Event Landing");
  if (renameCmd) session.applyCommand(renameCmd);
  const landing: ContainerRef = { kind: "page", id: homePage.id };

  // ---- Component requirements: only FDraft's real, currently-supported 7 keys ----
  addComponentRequirement(session, "page-title", { required: true });
  addComponentRequirement(session, "event-information", { required: true });
  addComponentRequirement(session, "event-countdown", { required: true });
  addComponentRequirement(session, "draft-controls", { required: true });
  addComponentRequirement(session, "film-grid", { required: true });
  addComponentRequirement(session, "event-progress", { required: true });
  addComponentRequirement(session, "points-counter", { required: true });

  // ---- Pages ----
  const draftPage = addPage(session, "Draft");
  const resultsPage = addPage(session, "Results");
  const completionPage = addPage(session, "Completion");
  const aboutPage = addPage(session, "About/Information");
  const availablePage = addPage(session, "Event Available");
  const joinPopup = addPopup(session, "Join");

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

  // ---- Real imported artwork, decorative, positioned as a general "cozy scene" — no CSS/layout code copied, only Studio's own layer/transform model ----
  const tree = await importAssetFile(session, join(ASSET_DIR, "interactives/christmas-tree.png"));
  const presents = await importAssetFile(session, join(ASSET_DIR, "interactives/presents.png"));
  const snowman = await importAssetFile(session, join(ASSET_DIR, "interactives/snowman.png"));
  const stocking = await importAssetFile(session, join(ASSET_DIR, "interactives/stocking.png"));
  const candyCanes = await importAssetFile(session, join(ASSET_DIR, "interactives/candy-canes.png"));
  const fairyLights = await importAssetFile(session, join(ASSET_DIR, "decorations/fairy-lights.png"));
  const modalLeft = await importAssetFile(session, join(ASSET_DIR, "modal/modal-left.png"));
  const modalRight = await importAssetFile(session, join(ASSET_DIR, "modal/modal-right.png"));

  addImageLayer(session, landing, { name: "Tree", assetId: tree, transform: { x: 120, y: 600, width: 300, height: 375, rotationDeg: 0, scaleX: 1, scaleY: 1 }, zIndex: 0 });
  addImageLayer(session, landing, { name: "Presents", assetId: presents, transform: { x: 420, y: 780, width: 260, height: 208, rotationDeg: 0, scaleX: 1, scaleY: 1 }, zIndex: 0 });
  addImageLayer(session, landing, { name: "Snowman", assetId: snowman, transform: { x: 1500, y: 640, width: 260, height: 332, rotationDeg: 0, scaleX: 1, scaleY: 1 }, zIndex: 0 });
  addImageLayer(session, landing, { name: "Stocking", assetId: stocking, transform: { x: 1720, y: 750, width: 180, height: 252, rotationDeg: 0, scaleX: 1, scaleY: 1 }, zIndex: 0 });
  addImageLayer(session, landing, { name: "Candy Canes", assetId: candyCanes, transform: { x: 40, y: 40, width: 120, height: 160, rotationDeg: -15, scaleX: 1, scaleY: 1 }, zIndex: 0 });
  addImageLayer(session, landing, { name: "Fairy Lights", assetId: fairyLights, transform: { x: 660, y: 0, width: 600, height: 144, rotationDeg: 0, scaleX: 1, scaleY: 1 }, zIndex: 0 });
  addImageLayer(session, joinPopup, { name: "Modal Left", assetId: modalLeft, transform: { x: 0, y: 480, width: 260, height: 400, rotationDeg: 0, scaleX: 1, scaleY: 1 }, zIndex: 0 });
  addImageLayer(session, joinPopup, { name: "Modal Right", assetId: modalRight, transform: { x: 1660, y: 480, width: 260, height: 400, rotationDeg: 0, scaleX: 1, scaleY: 1 }, zIndex: 0 });

  // ---- Deliberate copy on every real slot ----
  function componentLayerId(ref: ContainerRef, componentKey: string) {
    return getContainerLayers(project(session), ref).find((l) => l.type === "component" && l.componentKey === componentKey)!.id;
  }

  setCopy(session, landing, componentLayerId(landing, "page-title"), "title", "A Cozy Christmas");
  setCopy(session, landing, componentLayerId(landing, "event-information"), "eventName", "{{eventName}}");
  setCopy(session, landing, componentLayerId(landing, "event-information"), "dateRange", "Runs through the holidays — watch, and warm up by the tree");
  setCopy(session, landing, componentLayerId(landing, "event-countdown"), "accessibleLabel", "Time left in the Christmas event");

  setCopy(session, draftPage, componentLayerId(draftPage, "page-title"), "title", "Trim Your Watchlist");
  setCopy(session, draftPage, componentLayerId(draftPage, "draft-controls"), "skipLabel", "Not Feeling Festive");
  setCopy(session, draftPage, componentLayerId(draftPage, "draft-controls"), "confirmLabel", "Add To Stocking");
  setCopy(session, draftPage, componentLayerId(draftPage, "draft-controls"), "accessibleLabel", "Confirm your Christmas film pick");

  setCopy(session, resultsPage, componentLayerId(resultsPage, "page-title"), "title", "Under The Tree So Far");
  setCopy(session, resultsPage, componentLayerId(resultsPage, "event-progress"), "statusLabel", "{{progress}}% unwrapped");
  setCopy(session, resultsPage, componentLayerId(resultsPage, "event-progress"), "accessibleLabel", "Christmas event progress");
  setCopy(session, resultsPage, componentLayerId(resultsPage, "points-counter"), "unitLabel", "candy cane pts");
  setCopy(session, resultsPage, componentLayerId(resultsPage, "points-counter"), "accessibleLabel", "Your Christmas points");

  setCopy(session, completionPage, componentLayerId(completionPage, "page-title"), "title", "All Wrapped Up");
  setCopy(session, completionPage, componentLayerId(completionPage, "event-progress"), "statusLabel", "100% unwrapped — happy holidays!");
  setCopy(session, completionPage, componentLayerId(completionPage, "event-progress"), "accessibleLabel", "Christmas event completion");
  setCopy(session, completionPage, componentLayerId(completionPage, "points-counter"), "unitLabel", "candy cane pts");
  setCopy(session, completionPage, componentLayerId(completionPage, "points-counter"), "accessibleLabel", "Your final Christmas points");

  setCopy(session, aboutPage, componentLayerId(aboutPage, "page-title"), "title", "About This Christmas");
  setCopy(session, aboutPage, componentLayerId(aboutPage, "event-information"), "eventName", "{{eventName}}");
  setCopy(session, aboutPage, componentLayerId(aboutPage, "event-information"), "dateRange", "A season of cozy films — no naughty list, just good picks");

  setCopy(session, availablePage, componentLayerId(availablePage, "page-title"), "title", "Christmas Is Coming");
  setCopy(session, availablePage, componentLayerId(availablePage, "event-information"), "eventName", "{{eventName}}");
  setCopy(session, availablePage, componentLayerId(availablePage, "event-information"), "dateRange", "Not open yet — hang your stocking and wait");
  setCopy(session, availablePage, componentLayerId(availablePage, "event-countdown"), "accessibleLabel", "Time until Christmas opens");

  setCopy(session, joinPopup, componentLayerId(joinPopup, "page-title"), "title", "Christmas Is Here!");
  setCopy(session, joinPopup, componentLayerId(joinPopup, "event-information"), "eventName", "{{eventName}}");
  setCopy(session, joinPopup, componentLayerId(joinPopup, "event-information"), "dateRange", "Opt in from your profile to start unwrapping films");

  // ---- Saved simulator scenarios ----
  const base = { eventStatus: "active", eventActive: true, eventAvailable: true, performanceTier: "high" as const, reducedMotion: false, dataProfile: "normal" as const };
  addSimulationScenario(session, "Not opted in yet", { ...base, optedIn: false, draftGenerated: false, eventCompleted: false, progressPercent: 0, watchedCount: 0, targetCount: 8 });
  addSimulationScenario(session, "Midway through", { ...base, optedIn: true, draftGenerated: true, eventCompleted: false, progressPercent: 50, watchedCount: 4, targetCount: 8 });
  addSimulationScenario(session, "All wrapped up", { ...base, optedIn: true, draftGenerated: true, eventCompleted: true, progressPercent: 100, watchedCount: 8, targetCount: 8 });
  addSimulationScenario(session, "Christmas ended", { eventStatus: "ended", eventActive: false, eventAvailable: false, optedIn: true, draftGenerated: true, eventCompleted: true, progressPercent: 100, watchedCount: 8, targetCount: 8, performanceTier: "high", reducedMotion: false, dataProfile: "normal" });

  const report = await saveCompileAndReport(session, platform, { slug: "christmas", workDir, fdraftRepoPath });
  assertClean(report, "Christmas");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
