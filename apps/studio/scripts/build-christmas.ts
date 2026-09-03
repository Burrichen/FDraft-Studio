/**
 * Builds the official Christmas starter project — real imported artwork
 * from ../FDraft/public/events/christmas/ (FDraft's own README calls
 * this set "a scaffold only — placeholder-quality," not final creative;
 * recorded here honestly, not claimed as approved final art).
 *
 * Now built from the FULL "FDraft Default Event" template
 * (`startFromDefaultTemplate`, all 14 component keys across 8 pages) —
 * the temporary compatibility-scoped 7-key structure this project used
 * before is gone. FDraft's real, currently-committed
 * `FDRAFT_SUPPORTED_COMPONENT_KEYS` now covers all 14 (see
 * ../FDraft/src/infrastructure/theme-runtime/compatibility.ts, commit
 * `006035c`) — confirmed live before this migration, not assumed. The
 * original visual appearance and event behaviour are preserved exactly:
 * the same real decorative imagery in the same positions, the same
 * copy tone, the same simulator scenarios — only the underlying page/
 * component structure changed, from a reduced custom set to the real,
 * complete, official template.
 *
 * Run: pnpm --filter @fdraft/studio exec tsx scripts/build-christmas.ts <workDir> [fdraftRepoPath]
 */
import { join } from "node:path";
import {
  createSession,
  startFromDefaultTemplate,
  project,
  addPopup,
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

// Resolved relative to this script, per CLAUDE.md's documented sibling-checkout layout
// (`../FDraft` next to this repository) — never a machine-specific absolute path.
// argv[4] lets the delete-original-sources proof point this at a scratch
// copy instead of FDraft's real checkout, so the copy can be safely deleted afterward.
const ASSET_DIR = process.argv[4] ?? join(import.meta.dirname, "../../../../FDraft/public/events/christmas");

async function main(): Promise<void> {
  const workDir = process.argv[2];
  const fdraftRepoPath = process.argv[3];
  if (!workDir) throw new Error("Usage: build-christmas.ts <workDir> [fdraftRepoPath]");

  const { session, platform } = await createSession(workDir);
  startFromDefaultTemplate(session, "Christmas");

  const pageRef = (name: string): ContainerRef => ({ kind: "page", id: project(session).pages.find((p) => p.name === name)!.id });
  function titleLayerId(ref: ContainerRef) {
    return getContainerLayers(project(session), ref).find((l) => l.type === "component" && l.componentKey === "page-title")!.id;
  }
  function componentLayerId(ref: ContainerRef, componentKey: string) {
    return getContainerLayers(project(session), ref).find((l) => l.type === "component" && l.componentKey === componentKey)!.id;
  }

  const landing = pageRef("Event Landing");

  // ---- Event Available / Join popup — mirrors Halloween's own real popup pattern ----
  const availablePopup = addPopup(session, "Event Available");
  addComponentLayer(session, availablePopup, { name: "Popup Title", componentKey: "page-title", transform: { x: 460, y: 300, width: 1000, height: 100, rotationDeg: 0, scaleX: 1, scaleY: 1 }, zIndex: 1 });
  addComponentLayer(session, availablePopup, { name: "Popup Info", componentKey: "event-information", transform: { x: 460, y: 430, width: 1000, height: 140, rotationDeg: 0, scaleX: 1, scaleY: 1 }, zIndex: 1 });
  addComponentLayer(session, availablePopup, { name: "Popup Join Action", componentKey: "generate-draft-action", transform: { x: 810, y: 620, width: 300, height: 70, rotationDeg: 0, scaleX: 1, scaleY: 1 }, zIndex: 1 });

  // ---- Real imported artwork, decorative, positioned exactly as before — same "cozy scene," no CSS/layout code, only Studio's own layer/transform model ----
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
  addImageLayer(session, availablePopup, { name: "Modal Left", assetId: modalLeft, transform: { x: 0, y: 480, width: 260, height: 400, rotationDeg: 0, scaleX: 1, scaleY: 1 }, zIndex: 0 });
  addImageLayer(session, availablePopup, { name: "Modal Right", assetId: modalRight, transform: { x: 1660, y: 480, width: 260, height: 400, rotationDeg: 0, scaleX: 1, scaleY: 1 }, zIndex: 0 });

  // ---- Deliberate copy on every real slot — the same Christmas tone as before, now covering every one of the 14 real components ----

  // Event Landing
  setCopy(session, landing, titleLayerId(landing), "title", "A Cozy Christmas");
  setCopy(session, landing, componentLayerId(landing, "event-information"), "eventName", "{{eventName}}");
  setCopy(session, landing, componentLayerId(landing, "event-information"), "dateRange", "Runs through the holidays — watch, and warm up by the tree");
  setCopy(session, landing, componentLayerId(landing, "event-countdown"), "accessibleLabel", "Time left in the Christmas event");
  setCopy(session, landing, componentLayerId(landing, "profile-badge"), "accessibleLabel", "Your Christmas profile");
  setCopy(session, landing, componentLayerId(landing, "event-navigation"), "previousLabel", "Back");
  setCopy(session, landing, componentLayerId(landing, "event-navigation"), "nextLabel", "Onward");
  setCopy(session, landing, componentLayerId(landing, "event-navigation"), "accessibleLabel", "Christmas event navigation");
  setCopy(session, landing, componentLayerId(landing, "generate-draft-action"), "actionLabel", "Start My Watchlist");
  setCopy(session, landing, componentLayerId(landing, "generate-draft-action"), "accessibleLabel", "Generate my Christmas film draft");

  // Draft
  const draft = pageRef("Draft");
  setCopy(session, draft, titleLayerId(draft), "title", "Trim Your Watchlist");
  setCopy(session, draft, componentLayerId(draft, "draft-progress"), "statusLabel", "{{picksMade}} of {{totalPicks}} picks wrapped");
  setCopy(session, draft, componentLayerId(draft, "draft-controls"), "skipLabel", "Not Feeling Festive");
  setCopy(session, draft, componentLayerId(draft, "draft-controls"), "confirmLabel", "Add To Stocking");
  setCopy(session, draft, componentLayerId(draft, "draft-controls"), "accessibleLabel", "Confirm your Christmas film pick");

  // Results
  const results = pageRef("Results");
  setCopy(session, results, titleLayerId(results), "title", "Under The Tree So Far");
  setCopy(session, results, componentLayerId(results, "results-completion-content"), "headline", "Making good progress!");
  setCopy(session, results, componentLayerId(results, "results-completion-content"), "body", "Keep watching and the stocking keeps filling.");
  setCopy(session, results, componentLayerId(results, "points-counter"), "unitLabel", "candy cane pts");
  setCopy(session, results, componentLayerId(results, "points-counter"), "accessibleLabel", "Your Christmas points");

  // Completion
  const completion = pageRef("Completion");
  setCopy(session, completion, titleLayerId(completion), "title", "All Wrapped Up");
  setCopy(session, completion, componentLayerId(completion, "results-completion-content"), "headline", "Happy holidays!");
  setCopy(session, completion, componentLayerId(completion, "results-completion-content"), "body", "You've watched every pick — thanks for spending {{eventName}} with us.");
  setCopy(session, completion, componentLayerId(completion, "complete-watch-action"), "actionLabel", "Mark as Watched");
  setCopy(session, completion, componentLayerId(completion, "complete-watch-action"), "accessibleLabel", "Mark this Christmas film as watched");

  // About/Information
  const about = pageRef("About/Information");
  setCopy(session, about, titleLayerId(about), "title", "About This Christmas");
  setCopy(session, about, componentLayerId(about, "event-information"), "eventName", "{{eventName}}");
  setCopy(session, about, componentLayerId(about, "event-information"), "dateRange", "A season of cozy films — no naughty list, just good picks");

  // Event Available
  const available = pageRef("Event Available");
  setCopy(session, available, titleLayerId(available), "title", "Christmas Is Coming");
  setCopy(session, available, componentLayerId(available, "event-information"), "eventName", "{{eventName}}");
  setCopy(session, available, componentLayerId(available, "event-information"), "dateRange", "Not open yet — hang your stocking and wait");
  setCopy(session, available, componentLayerId(available, "event-countdown"), "accessibleLabel", "Time until Christmas opens");
  setCopy(session, available, componentLayerId(available, "challenge-card"), "title", "Cocoa & a Classic");
  setCopy(session, available, componentLayerId(available, "challenge-card"), "description", "Watch 3 festive picks this weekend for a bonus handful of candy canes.");

  // Join
  const joinPage = pageRef("Join");
  setCopy(session, joinPage, titleLayerId(joinPage), "title", "Christmas Is Here!");
  setCopy(session, joinPage, componentLayerId(joinPage, "event-information"), "eventName", "{{eventName}}");
  setCopy(session, joinPage, componentLayerId(joinPage, "event-information"), "dateRange", "Opt in from your profile to start unwrapping films");
  setCopy(session, joinPage, componentLayerId(joinPage, "generate-draft-action"), "actionLabel", "Add To Stocking");
  setCopy(session, joinPage, componentLayerId(joinPage, "generate-draft-action"), "accessibleLabel", "Join the Christmas event");

  // Event Complete
  const complete = pageRef("Event Complete");
  setCopy(session, complete, titleLayerId(complete), "title", "Christmas Has Ended");
  setCopy(session, complete, componentLayerId(complete, "results-completion-content"), "headline", "That's a wrap.");
  setCopy(session, complete, componentLayerId(complete, "results-completion-content"), "body", "The stockings are empty and the tree's coming down — see you next Christmas.");
  setCopy(session, complete, componentLayerId(complete, "points-counter"), "unitLabel", "candy cane pts");
  setCopy(session, complete, componentLayerId(complete, "points-counter"), "accessibleLabel", "Your final Christmas points");
  setCopy(session, complete, componentLayerId(complete, "event-points-counter"), "unitLabel", "candy cane pts");
  setCopy(session, complete, componentLayerId(complete, "event-points-counter"), "accessibleLabel", "Your points for this Christmas event");

  // Event Available popup
  setCopy(session, availablePopup, titleLayerId(availablePopup), "title", "Christmas Is Open!");
  setCopy(session, availablePopup, componentLayerId(availablePopup, "event-information"), "eventName", "{{eventName}}");
  setCopy(session, availablePopup, componentLayerId(availablePopup, "event-information"), "dateRange", "Opt in now — the tree is lit and waiting");
  setCopy(session, availablePopup, componentLayerId(availablePopup, "generate-draft-action"), "actionLabel", "Let's Go");
  setCopy(session, availablePopup, componentLayerId(availablePopup, "generate-draft-action"), "accessibleLabel", "Join the Christmas event now");

  // ---- Saved simulator scenarios — identical to before ----
  const base = { eventStatus: "active", eventActive: true, eventAvailable: true, performanceTier: "high" as const, reducedMotion: false, dataProfile: "normal" as const };
  addSimulationScenario(session, "Not opted in yet", { ...base, optedIn: false, draftGenerated: false, eventCompleted: false, progressPercent: 0, watchedCount: 0, targetCount: 8 });
  addSimulationScenario(session, "Midway through", { ...base, optedIn: true, draftGenerated: true, eventCompleted: false, progressPercent: 50, watchedCount: 4, targetCount: 8 });
  addSimulationScenario(session, "All wrapped up", { ...base, optedIn: true, draftGenerated: true, eventCompleted: true, progressPercent: 100, watchedCount: 8, targetCount: 8 });
  addSimulationScenario(session, "Christmas ended", { eventStatus: "ended", eventActive: false, eventAvailable: false, optedIn: true, draftGenerated: true, eventCompleted: true, progressPercent: 100, watchedCount: 8, targetCount: 8, performanceTier: "high", reducedMotion: false, dataProfile: "normal" });

  // `confirmSlugOverwrite: true` — this is the SAME official Christmas
  // project being deliberately migrated off its temporary 7-key
  // structure onto the full template (per its own header comment), not a
  // different project colliding on the same slug. This official builder
  // is expected to be re-run as the canonical Christmas source evolves.
  const report = await saveCompileAndReport(session, platform, { slug: "christmas", workDir, fdraftRepoPath, confirmSlugOverwrite: true });
  assertClean(report, "Christmas");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
