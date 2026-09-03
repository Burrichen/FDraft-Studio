/**
 * Builds the official Halloween starter project — real imported artwork
 * from ../FDraft/public/events/halloween/, a real Behaviour-rule-driven
 * Candy Bowl image-state group, deliberate copy on every slot, saved
 * simulator scenarios, and a real publish attempt against the linked
 * FDraft checkout.
 *
 * The Candy Bowl's progress→state mapping needs the `behaviour`
 * capability, which FDraft's current build doesn't declare support for
 * yet (`FDRAFT_SUPPORTED_CAPABILITIES` in
 * ../FDraft/src/infrastructure/theme-runtime/compatibility.ts) — so the
 * publish step below is *expected* to be correctly blocked. That's not a
 * bug in this project; it's FDraft's own real compatibility check doing
 * its job, and is reported, not hidden. See
 * docs/IMPLEMENTATION_STATUS.md's Prompt 13 row for the recorded outcome.
 *
 * Run: pnpm --filter @fdraft/studio exec tsx scripts/build-halloween.ts <workDir> [fdraftRepoPath]
 */
import { join } from "node:path";
import { createId, type BehaviourRule } from "@fdraft/theme-sdk";
import {
  createSession,
  startFromDefaultTemplate,
  importAssetFile,
  addImageLayer,
  addImageStateGroup,
  addPopup,
  addComponentLayer,
  addBehaviourRule,
  addSimulationScenario,
  setCopy,
  saveCompileAndReport,
  assertClean,
  getContainerLayers,
  type ContainerRef,
} from "./starterEventBuilder.js";

// Resolved relative to this script, per CLAUDE.md's documented sibling-checkout layout
// (`../FDraft` next to this repository) — never a machine-specific absolute path.
// argv[4] lets the delete-original-sources proof (Phase 4) point this at a scratch
// copy instead of FDraft's real checkout, so the copy can be safely deleted afterward.
const ASSET_DIR = process.argv[4] ?? join(import.meta.dirname, "../../../../FDraft/public/events/halloween");

async function main(): Promise<void> {
  const workDir = process.argv[2];
  const fdraftRepoPath = process.argv[3];
  if (!workDir) throw new Error("Usage: build-halloween.ts <workDir> [fdraftRepoPath]");

  const { session, platform } = await createSession(workDir);
  startFromDefaultTemplate(session, "Halloween");

  // ---- Import every real asset ----
  const candyBowlEmpty = await importAssetFile(session, join(ASSET_DIR, "interactives/candy-bowl-empty.png"));
  const candyBowlLow = await importAssetFile(session, join(ASSET_DIR, "interactives/candy-bowl-low.png"));
  const candyBowlMedium = await importAssetFile(session, join(ASSET_DIR, "interactives/candy-bowl-medium.png"));
  const candyBowlFull = await importAssetFile(session, join(ASSET_DIR, "interactives/candy-bowl-full.png"));
  const pumpkinCarved = await importAssetFile(session, join(ASSET_DIR, "interactives/pumpkin-carved.png"));
  const gravestoneBase = await importAssetFile(session, join(ASSET_DIR, "interactives/gravestone-base.png"));
  const gravestoneMoss = await importAssetFile(session, join(ASSET_DIR, "interactives/gravestone-moss-overlay.png"));
  const ghost = await importAssetFile(session, join(ASSET_DIR, "modal/ghost.png"));

  const project = () => session.getState().open!.project;
  const pageRef = (name: string): ContainerRef => ({ kind: "page", id: project().pages.find((p) => p.name === name)!.id });

  // ---- Candy Bowl: real image-state group + real Behaviour rule (editable mapping, not hard-coded) ----
  const { groupId: candyBowlGroupId, stateIdsByName } = addImageStateGroup(session, "Candy Bowl", [
    { name: "Empty", assetId: candyBowlEmpty },
    { name: "Low", assetId: candyBowlLow },
    { name: "Medium", assetId: candyBowlMedium },
    { name: "Full", assetId: candyBowlFull },
  ]);

  const landing = pageRef("Event Landing");
  addImageLayer(session, landing, {
    name: "Candy Bowl",
    assetId: candyBowlFull,
    stateGroupId: candyBowlGroupId,
    transform: { x: 1380, y: 850, width: 360, height: 234, rotationDeg: 0, scaleX: 1, scaleY: 1 },
    zIndex: 20,
  });
  addImageLayer(session, landing, {
    name: "Pumpkin",
    assetId: pumpkinCarved,
    transform: { x: 820, y: 620, width: 300, height: 270, rotationDeg: 0, scaleX: 1, scaleY: 1 },
    zIndex: 20,
  });
  addImageLayer(session, landing, {
    name: "Gravestone",
    assetId: gravestoneBase,
    transform: { x: 260, y: 680, width: 280, height: 400, rotationDeg: 0, scaleX: 1, scaleY: 1 },
    zIndex: 20,
  });
  addImageLayer(session, landing, {
    name: "Gravestone Moss",
    assetId: gravestoneMoss,
    transform: { x: 260, y: 680, width: 280, height: 400, rotationDeg: 0, scaleX: 1, scaleY: 1 },
    zIndex: 21,
  });

  // Editable progress→state mapping — a project author can change these boundaries in Behaviour Mode; the renderer/evaluator never hard-codes "Halloween logic."
  const candyBowlRule: BehaviourRule = {
    id: createId(),
    name: "Candy bowl fills as progress increases",
    enabled: true,
    priority: 0,
    trigger: { type: "whileTrue" },
    condition: { type: "always" },
    actions: [
      { type: "setImageState", stateGroupId: candyBowlGroupId, stateId: stateIdsByName["Empty"]! },
    ],
  };
  addBehaviourRule(session, candyBowlRule);
  addBehaviourRule(session, {
    id: createId(),
    name: "Candy bowl: low",
    enabled: true,
    priority: 1,
    trigger: { type: "whileTrue" },
    condition: { type: "inRange", variable: { kind: "progressPercent" }, min: 25, max: 49 },
    actions: [{ type: "setImageState", stateGroupId: candyBowlGroupId, stateId: stateIdsByName["Low"]! }],
  });
  addBehaviourRule(session, {
    id: createId(),
    name: "Candy bowl: medium",
    enabled: true,
    priority: 1,
    trigger: { type: "whileTrue" },
    condition: { type: "inRange", variable: { kind: "progressPercent" }, min: 50, max: 74 },
    actions: [{ type: "setImageState", stateGroupId: candyBowlGroupId, stateId: stateIdsByName["Medium"]! }],
  });
  addBehaviourRule(session, {
    id: createId(),
    name: "Candy bowl: full",
    enabled: true,
    priority: 1,
    trigger: { type: "whileTrue" },
    condition: { type: "inRange", variable: { kind: "progressPercent" }, min: 75, max: 100 },
    actions: [{ type: "setImageState", stateGroupId: candyBowlGroupId, stateId: stateIdsByName["Full"]! }],
  });

  // ---- Event Available / Join popup ----
  const joinPopup = addPopup(session, "Event Available");
  addComponentLayer(session, joinPopup, { name: "Popup Title", componentKey: "page-title", transform: { x: 460, y: 300, width: 1000, height: 100, rotationDeg: 0, scaleX: 1, scaleY: 1 }, zIndex: 1 });
  addComponentLayer(session, joinPopup, { name: "Popup Info", componentKey: "event-information", transform: { x: 460, y: 430, width: 1000, height: 140, rotationDeg: 0, scaleX: 1, scaleY: 1 }, zIndex: 1 });
  addComponentLayer(session, joinPopup, { name: "Popup Join Action", componentKey: "generate-draft-action", transform: { x: 810, y: 620, width: 300, height: 70, rotationDeg: 0, scaleX: 1, scaleY: 1 }, zIndex: 1 });
  addImageLayer(session, joinPopup, { name: "Ghost", assetId: ghost, transform: { x: 1500, y: 620, width: 240, height: 285, rotationDeg: 0, scaleX: 1, scaleY: 1 }, zIndex: 2 });

  // ---- Deliberate copy on every real slot ----
  function titleLayerId(ref: ContainerRef) {
    return getContainerLayers(project(), ref).find((l) => l.type === "component" && l.componentKey === "page-title")!.id;
  }
  function componentLayerId(ref: ContainerRef, componentKey: string) {
    return getContainerLayers(project(), ref).find((l) => l.type === "component" && l.componentKey === componentKey)!.id;
  }

  // Event Landing
  setCopy(session, landing, titleLayerId(landing), "title", "Halloween Watch Party");
  setCopy(session, landing, componentLayerId(landing, "event-information"), "eventName", "{{eventName}}");
  setCopy(session, landing, componentLayerId(landing, "event-information"), "dateRange", "All October long — the bowl fills as you watch");
  setCopy(session, landing, componentLayerId(landing, "event-countdown"), "accessibleLabel", "Time left to trick-or-treat this Halloween");
  setCopy(session, landing, componentLayerId(landing, "profile-badge"), "accessibleLabel", "Your ghoul profile");
  setCopy(session, landing, componentLayerId(landing, "event-navigation"), "previousLabel", "Back");
  setCopy(session, landing, componentLayerId(landing, "event-navigation"), "nextLabel", "Onward");
  setCopy(session, landing, componentLayerId(landing, "event-navigation"), "accessibleLabel", "Halloween event navigation");
  setCopy(session, landing, componentLayerId(landing, "generate-draft-action"), "actionLabel", "Conjure My Draft");
  setCopy(session, landing, componentLayerId(landing, "generate-draft-action"), "accessibleLabel", "Generate my Halloween film draft");

  // Draft
  const draft = pageRef("Draft");
  setCopy(session, draft, titleLayerId(draft), "title", "Your Haunted Watchlist");
  setCopy(session, draft, componentLayerId(draft, "draft-progress"), "statusLabel", "{{picksMade}} of {{totalPicks}} frights picked");
  setCopy(session, draft, componentLayerId(draft, "draft-controls"), "skipLabel", "Too Spooky, Skip");
  setCopy(session, draft, componentLayerId(draft, "draft-controls"), "confirmLabel", "Lock It In");
  setCopy(session, draft, componentLayerId(draft, "draft-controls"), "accessibleLabel", "Confirm your Halloween film pick");

  // Results
  const results = pageRef("Results");
  setCopy(session, results, titleLayerId(results), "title", "The Bowl So Far");
  setCopy(session, results, componentLayerId(results, "results-completion-content"), "headline", "Sweet progress!");
  setCopy(session, results, componentLayerId(results, "results-completion-content"), "body", "Keep watching and the candy bowl keeps filling.");
  setCopy(session, results, componentLayerId(results, "points-counter"), "unitLabel", "candy pts");
  setCopy(session, results, componentLayerId(results, "points-counter"), "accessibleLabel", "Your Halloween points");

  // Completion
  const completion = pageRef("Completion");
  setCopy(session, completion, titleLayerId(completion), "title", "Trick or Treat, Complete!");
  setCopy(session, completion, componentLayerId(completion, "results-completion-content"), "headline", "The bowl is full!");
  setCopy(session, completion, componentLayerId(completion, "results-completion-content"), "body", "You've watched every pick — thanks for haunting {{eventName}} with us.");
  setCopy(session, completion, componentLayerId(completion, "complete-watch-action"), "actionLabel", "Mark as Watched");
  setCopy(session, completion, componentLayerId(completion, "complete-watch-action"), "accessibleLabel", "Mark this Halloween film as watched");

  // About/Information
  const about = pageRef("About/Information");
  setCopy(session, about, titleLayerId(about), "title", "About This Haunting");
  setCopy(session, about, componentLayerId(about, "event-information"), "eventName", "{{eventName}}");
  setCopy(session, about, componentLayerId(about, "event-information"), "dateRange", "A month of movies, one candy bowl, zero real ghosts (probably)");

  // Event Available
  const available = pageRef("Event Available");
  setCopy(session, available, titleLayerId(available), "title", "The Bowl Awaits");
  setCopy(session, available, componentLayerId(available, "event-information"), "eventName", "{{eventName}}");
  setCopy(session, available, componentLayerId(available, "event-information"), "dateRange", "Opens soon — sharpen your carving knife");
  setCopy(session, available, componentLayerId(available, "event-countdown"), "accessibleLabel", "Time until Halloween opens");
  setCopy(session, available, componentLayerId(available, "challenge-card"), "title", "Midnight Marathon");
  setCopy(session, available, componentLayerId(available, "challenge-card"), "description", "Watch 3 spooky picks this weekend for a bonus handful of candy.");

  // Join
  const joinPage = pageRef("Join");
  setCopy(session, joinPage, titleLayerId(joinPage), "title", "Dare To Join?");
  setCopy(session, joinPage, componentLayerId(joinPage, "event-information"), "eventName", "{{eventName}}");
  setCopy(session, joinPage, componentLayerId(joinPage, "event-information"), "dateRange", "One click and the bowl starts filling");
  setCopy(session, joinPage, componentLayerId(joinPage, "generate-draft-action"), "actionLabel", "Join the Haunting");
  setCopy(session, joinPage, componentLayerId(joinPage, "generate-draft-action"), "accessibleLabel", "Join the Halloween event");

  // Event Complete
  const complete = pageRef("Event Complete");
  setCopy(session, complete, titleLayerId(complete), "title", "Halloween Has Ended");
  setCopy(session, complete, componentLayerId(complete, "results-completion-content"), "headline", "That's a wrap, ghouls.");
  setCopy(session, complete, componentLayerId(complete, "results-completion-content"), "body", "The bowl's empty and the pumpkins are rotting — see you next October.");
  setCopy(session, complete, componentLayerId(complete, "points-counter"), "unitLabel", "candy pts");
  setCopy(session, complete, componentLayerId(complete, "points-counter"), "accessibleLabel", "Your final Halloween points");
  setCopy(session, complete, componentLayerId(complete, "event-points-counter"), "unitLabel", "event pts");
  setCopy(session, complete, componentLayerId(complete, "event-points-counter"), "accessibleLabel", "Your points for this Halloween event");

  // Join popup
  setCopy(session, joinPopup, titleLayerId(joinPopup), "title", "Halloween Is Open!");
  setCopy(session, joinPopup, componentLayerId(joinPopup, "event-information"), "eventName", "{{eventName}}");
  setCopy(session, joinPopup, componentLayerId(joinPopup, "event-information"), "dateRange", "Opt in now — the candy bowl is waiting");
  setCopy(session, joinPopup, componentLayerId(joinPopup, "generate-draft-action"), "actionLabel", "Let's Go");
  setCopy(session, joinPopup, componentLayerId(joinPopup, "generate-draft-action"), "accessibleLabel", "Join the Halloween event now");

  // ---- Saved simulator scenarios ----
  const base = { eventStatus: "active", eventActive: true, eventAvailable: true, performanceTier: "high" as const, reducedMotion: false, dataProfile: "normal" as const };
  addSimulationScenario(session, "Candy bowl: just opened", { ...base, optedIn: true, draftGenerated: false, eventCompleted: false, progressPercent: 0, watchedCount: 0, targetCount: 10, description: "Bowl should read Empty." });
  addSimulationScenario(session, "Candy bowl: quarter full", { ...base, optedIn: true, draftGenerated: true, eventCompleted: false, progressPercent: 30, watchedCount: 3, targetCount: 10, description: "Bowl should read Low." });
  addSimulationScenario(session, "Candy bowl: half full", { ...base, optedIn: true, draftGenerated: true, eventCompleted: false, progressPercent: 60, watchedCount: 6, targetCount: 10, description: "Bowl should read Medium." });
  addSimulationScenario(session, "Candy bowl: full", { ...base, optedIn: true, draftGenerated: true, eventCompleted: true, progressPercent: 100, watchedCount: 10, targetCount: 10, description: "Bowl should read Full." });
  addSimulationScenario(session, "Halloween ended", { eventStatus: "ended", eventActive: false, eventAvailable: false, optedIn: true, draftGenerated: true, eventCompleted: true, progressPercent: 100, watchedCount: 10, targetCount: 10, performanceTier: "high", reducedMotion: false, dataProfile: "normal", description: "Event Complete page state." });

  const report = await saveCompileAndReport(session, platform, { slug: "halloween", workDir, fdraftRepoPath });
  assertClean(report, "Halloween");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
