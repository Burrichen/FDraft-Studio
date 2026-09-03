/**
 * Shared helpers for building the official event starter projects
 * (Prompt 13) — Halloween, Christmas, and January each get their own
 * thin driver script that calls these. Every helper here is a direct
 * wrapper around real, already-built, already-tested Studio functions
 * (`ProjectSession`, the real asset-import pipeline, real
 * `Command<StudioProjectDocument>` factories) — never hand-authored
 * project JSON, and never a shortcut that bypasses validation/
 * sanitization/content-addressing. This is genuinely "the same tool a
 * user would use," driven headlessly because no interactive GUI session
 * is available in this environment.
 *
 * Run via `tsx` (see the per-event scripts for exact invocation).
 */
import { basename, join } from "node:path";
import { readFile } from "node:fs/promises";
import {
  createId,
  validateProject,
  checkDesignWarnings,
  type ComponentLayer,
  type ComponentRequirement,
  type Id,
  type ImageLayer,
  type Layer,
  type StudioProjectDocument,
  type Transform,
} from "@fdraft/theme-sdk";
import { compileProjectToFdtheme } from "@fdraft/theme-sdk/packaging";
import { createNodeTestPlatform } from "../test/helpers/nodePlatform.js";
import { resolveStudioPaths } from "../src/project/paths.js";
import { ProjectSession } from "../src/project/projectSession.js";
import { planAssetImport } from "../src/assets/assetImport.js";
import { buildAddAssetCommand, buildAddImageStateGroupCommand } from "../src/assets/assetCommands.js";
import { buildAddPageCommand, buildAddPopupCommand } from "../src/project/containerCommands.js";
import { buildPasteCommand, buildZOrderCommand, renameLayer, setComponentCopyOverride } from "../src/editor/layerCommands.js";
import { buildAddEffectLayerCommand } from "../src/editor/effectCommands.js";
import { buildAddColorTokenCommand } from "../src/editor/tokenCommands.js";
import { buildAddBehaviourRuleCommand } from "../src/behaviour/behaviourCommands.js";
import { createScenarioFromState } from "../src/simulation/simulationCommands.js";
import { getContainerLayers, type ContainerRef } from "../src/editor/containerRef.js";
import { planPublish, executePublish, type PublishPlan, type PublishResult } from "../src/publish/publishToFDraft.js";
import type { EffectKind, BehaviourRule, SimulationScenario } from "@fdraft/theme-sdk";
import type { OpenProject } from "../src/project/projectFile.js";

const SDK_VERSION = "0.1.0";
const MIN_RENDERER_VERSION = "0.1.0";

export async function createSession(workDir: string): Promise<{ session: ProjectSession; platform: ReturnType<typeof createNodeTestPlatform> }> {
  const platform = createNodeTestPlatform({ appDataDir: join(workDir, "appdata"), appConfigDir: join(workDir, "appconfig") });
  const paths = await resolveStudioPaths(platform);
  const session = new ProjectSession(platform, paths, SDK_VERSION);
  return { session, platform };
}

/** Starts a new project from the real, already-validated "FDraft Default Event" template — the same 8-surface contract Studio's own template picker offers. */
export function startFromDefaultTemplate(session: ProjectSession, name: string): void {
  session.newProjectFromTemplate(name, "standard-fdraft");
}

export function project(session: ProjectSession): StudioProjectDocument {
  return session.getState().open!.project;
}

/** Adds a real page via the real command factory, then looks it up by name — same lookup-after-apply pattern as every other command factory here. */
export function addPage(session: ProjectSession, name: string): ContainerRef {
  session.applyCommand(buildAddPageCommand(project(session), name));
  const page = project(session).pages.find((p) => p.name === name)!;
  return { kind: "page", id: page.id };
}

/**
 * Declares a `ComponentRequirement` for one component key — the exact
 * data shape `fdraftEventTemplate.ts`'s own `createFdraftDefaultEventProject`
 * already constructs internally (not new business logic, just factored
 * into a reusable step so a custom, compatibility-scoped page set — e.g.
 * one deliberately restricted to FDraft's currently-supported component
 * keys — can be built the same way).
 */
const ALLOWED_STYLE_PROPERTIES = ["color", "backgroundColor", "opacity", "fontSize", "fontWeight", "textAlign", "borderRadius", "padding", "margin"] as const;

export function addComponentRequirement(session: ProjectSession, componentKey: string, opts: { required?: boolean; singleton?: boolean } = {}): Id {
  const id = createId();
  const requirement: ComponentRequirement = {
    id,
    componentKey,
    required: opts.required ?? true,
    allowedProperties: [...ALLOWED_STYLE_PROPERTIES],
    singleton: opts.singleton,
  };
  session.applyCommand({
    label: "Add component requirement",
    do: (p) => ({ ...p, componentRequirements: [...p.componentRequirements, requirement] }),
    undo: (p) => ({ ...p, componentRequirements: p.componentRequirements.filter((r) => r.id !== id) }),
  });
  return id;
}

/**
 * Imports one real file from disk through the exact production sequence
 * `AssetWorkspace.tsx`'s own `importFiles()` runs: read real bytes →
 * `planAssetImport` (extension/size/SVG-safety checks, content hashing,
 * duplicate-content detection) → `mergeAssetBytes` → `buildAddAssetCommand`.
 * Returns the resulting asset's real id (an existing asset's id when the
 * content is a byte-for-byte duplicate of one already imported).
 */
export async function importAssetFile(session: ProjectSession, absolutePath: string): Promise<Id> {
  const fileName = basename(absolutePath);
  const bytes = new Uint8Array(await readFile(absolutePath));
  const plan = await planAssetImport(fileName, bytes, project(session));
  if (plan.reused) return plan.existingAssetId!;
  session.mergeAssetBytes({ [plan.path]: plan.bytes });
  const id = createId();
  session.applyCommand(
    buildAddAssetCommand({
      id,
      kind: plan.kind,
      path: plan.path,
      mimeType: plan.mimeType,
      sizeBytes: plan.sizeBytes,
      sha256: plan.sha256,
      name: plan.fileName,
      originalFileName: plan.fileName,
    }),
  );
  return id;
}

/** Adds a real design-token color, returning its id directly (this one command factory returns the token alongside the command, so no name-lookup is needed). */
export function addColorToken(session: ProjectSession, name: string, value: string): Id {
  const { command, token } = buildAddColorTokenCommand(name, value);
  session.applyCommand(command);
  return token.id;
}

/** Places a real, plain shape layer — used both for ordinary background fills and for a clearly-labeled empty-asset placeholder (a visibly-named "MISSING ART" layer, never a silent gap). */
export function addShapeLayer(
  session: ProjectSession,
  ref: ContainerRef,
  opts: { name: string; shape: "rect" | "ellipse"; transform: Transform; zIndex: number; fillColorTokenId?: Id },
): Id {
  const layer: Layer = {
    id: createId(),
    type: "shape",
    name: opts.name,
    shape: opts.shape,
    fillColorTokenId: opts.fillColorTokenId,
    transform: opts.transform,
    opacity: 1,
    visible: true,
    locked: false,
    zIndex: opts.zIndex,
    responsive: [],
    interactionStates: [],
  };
  session.applyCommand(buildPasteCommand(ref, [layer], { dx: 0, dy: 0 }));
  return getContainerLayers(project(session), ref).find((l) => l.name === opts.name)!.id;
}

/** Adds a popup via the real command factory, then looks it up by name (command factories generate their id internally and don't return it — the established pattern this whole driver follows). */
export function addPopup(session: ProjectSession, name: string): ContainerRef {
  session.applyCommand(buildAddPopupCommand(name));
  const popup = project(session).popups.find((p) => p.name === name)!;
  return { kind: "popup", id: popup.id };
}

/** Places a real image layer via the real paste-command path (deep id-remapping, the same mechanism copy/paste uses) — the layer is looked up afterward by its distinctive `name`. */
export function addImageLayer(
  session: ProjectSession,
  ref: ContainerRef,
  opts: { name: string; assetId: Id; transform: Transform; zIndex: number; stateGroupId?: Id },
): Id {
  const layer: ImageLayer = {
    id: createId(),
    type: "image",
    name: opts.name,
    assetId: opts.assetId,
    stateGroupId: opts.stateGroupId,
    transform: opts.transform,
    opacity: 1,
    visible: true,
    locked: false,
    zIndex: opts.zIndex,
    responsive: [],
    interactionStates: [],
  };
  session.applyCommand(buildPasteCommand(ref, [layer], { dx: 0, dy: 0 }));
  return getContainerLayers(project(session), ref).find((l) => l.name === opts.name)!.id;
}

/** Places a real component layer, reusing an existing `ComponentRequirement` the default template already created for this `componentKey` (never a duplicate requirement for the same key). */
export function addComponentLayer(
  session: ProjectSession,
  ref: ContainerRef,
  opts: { name: string; componentKey: string; transform: Transform; zIndex: number; zoneKind?: ComponentLayer["zoneKind"] },
): Id {
  const requirement = project(session).componentRequirements.find((r) => r.componentKey === opts.componentKey);
  if (!requirement) throw new Error(`No ComponentRequirement exists for "${opts.componentKey}" — the default template doesn't declare it.`);
  const layer: ComponentLayer = {
    id: createId(),
    type: "component",
    name: opts.name,
    componentKey: opts.componentKey,
    componentRequirementId: requirement.id,
    zoneKind: opts.zoneKind,
    styleOverrides: [],
    transform: opts.transform,
    opacity: 1,
    visible: true,
    locked: false,
    zIndex: opts.zIndex,
    responsive: [],
    interactionStates: [],
  };
  session.applyCommand(buildPasteCommand(ref, [layer], { dx: 0, dy: 0 }));
  return getContainerLayers(project(session), ref).find((l) => l.name === opts.name)!.id;
}

/** Adds a real effect layer (procedural, not asset-dependent) via the real command factory — auto-placed full-canvas, matching Studio's own "+ Effect…" behavior — then renames it to something distinctive for later lookup. */
/** A new effect layer defaults to full-bleed + above every sibling (per `buildAddEffectLayerCommand`'s own doc comment) — sent to back here, since an ambient full-canvas effect (rain/fog/clouds) sitting above interactive components would trip `DECORATIVE_LAYER_COVERS_COMPONENT` and could visually block them. */
export function addEffectLayer(session: ProjectSession, ref: ContainerRef, kind: EffectKind, name: string): Id {
  const before = getContainerLayers(project(session), ref);
  session.applyCommand(buildAddEffectLayerCommand(project(session), ref, kind));
  const after = getContainerLayers(project(session), ref);
  const added = after.find((l) => !before.some((b) => b.id === l.id))!;
  session.applyCommand(renameLayer(ref, added.id, added.name, name));
  const zOrderCommand = buildZOrderCommand(project(session), ref, [added.id], "back");
  if (zOrderCommand) session.applyCommand(zOrderCommand);
  return added.id;
}

/** Deliberately edits one component's copy slot — the real command `PropertiesPanel.tsx`'s `CopySlotField` commits on blur. */
export function setCopy(session: ProjectSession, ref: ContainerRef, layerId: Id, slotKey: string, text: string): void {
  session.applyCommand(setComponentCopyOverride(ref, layerId, slotKey, undefined, text));
}

/** Creates a real image-state group from already-imported assets, returns its id and each state's id keyed by state name. */
export function addImageStateGroup(session: ProjectSession, name: string, states: { name: string; assetId: Id }[]): { groupId: Id; stateIdsByName: Record<string, Id> } {
  const command = buildAddImageStateGroupCommand(name, states);
  if (!command) throw new Error(`buildAddImageStateGroupCommand("${name}", ...) returned null — no states given?`);
  session.applyCommand(command);
  const group = project(session).imageStateGroups.find((g) => g.name === name)!;
  const stateIdsByName: Record<string, Id> = {};
  for (const s of group.states) stateIdsByName[s.name] = s.id;
  return { groupId: group.id, stateIdsByName };
}

export function addBehaviourRule(session: ProjectSession, rule: BehaviourRule): void {
  session.applyCommand(buildAddBehaviourRuleCommand(rule));
}

export function addSimulationScenario(session: ProjectSession, name: string, state: Omit<SimulationScenario, "id" | "name" | "description"> & { description?: string }): void {
  const { description, ...rest } = state;
  const scenario = createScenarioFromState(name, rest);
  session.applyCommand({ label: "Save scenario", do: (p) => ({ ...p, simulationScenarios: [...p.simulationScenarios, { ...scenario, description }] }), undo: (p) => p });
}

export interface BuildReport {
  slug: string;
  fdstudioPath: string;
  fdthemePath: string;
  validation: { valid: boolean; issueCount: number; warningCount: number };
  compiledSizeBytes: number;
  publish: { attempted: boolean; plan?: PublishPlan; result?: PublishResult; blockedReasons?: string[] };
}

/**
 * Validates, saves a real `.fdstudio`, compiles a real `.fdtheme`, and —
 * if a FDraft repo path is given — attempts a real publish through
 * Studio's own `planPublish`/`executePublish`. A compatibility block is
 * reported, not hidden: this is expected and correct for a project using
 * a capability FDraft's current build doesn't support yet (see the
 * per-event scripts' own notes).
 *
 * `confirmSlugOverwrite` mirrors `PublishToFDraftPanel.tsx`'s own real
 * "I understand this will overwrite a different project" checkbox — the
 * gate lives entirely in the CALLER (`executePublish` itself never
 * re-checks `plan.blocked`, by design, since re-running the check risks
 * racing an edit made between plan and confirm), so a headless driver
 * must implement the identical gate itself, never bypass it silently.
 * Pass `true` only when you have deliberately confirmed the existing
 * published project at that slug is the SAME conceptual project being
 * intentionally republished/migrated (e.g. Christmas's move off its
 * temporary 7-key structure) — never to route around a genuine
 * different-project collision.
 */
export async function saveCompileAndReport(
  session: ProjectSession,
  platform: ReturnType<typeof createNodeTestPlatform>,
  opts: { slug: string; workDir: string; fdraftRepoPath?: string; confirmSlugOverwrite?: boolean },
): Promise<BuildReport> {
  const doc = project(session);
  const validation = validateProject(doc);
  const warnings = checkDesignWarnings(doc);

  const fdstudioPath = join(opts.workDir, `${opts.slug}.fdstudio`);
  await session.saveAs(fdstudioPath, "file");

  const compiled = await compileProjectToFdtheme(doc, session.getState().open!.assets, { minRendererVersion: MIN_RENDERER_VERSION });
  const fdthemePath = join(opts.workDir, `${opts.slug}.fdtheme`);
  await (await import("node:fs/promises")).writeFile(fdthemePath, compiled);

  const report: BuildReport = {
    slug: opts.slug,
    fdstudioPath,
    fdthemePath,
    validation: { valid: validation.valid, issueCount: validation.issues.length, warningCount: warnings.length },
    compiledSizeBytes: compiled.byteLength,
    publish: { attempted: false },
  };

  if (opts.fdraftRepoPath) {
    const open: OpenProject = session.getState().open!;
    const plan = await planPublish(platform, opts.fdraftRepoPath, open);
    report.publish.attempted = true;
    report.publish.plan = plan;
    const hardBlocks = plan.blocked.filter((b) => b.kind !== "slugCollision");
    const slugCollision = plan.blocked.find((b) => b.kind === "slugCollision");
    const canPublish = hardBlocks.length === 0 && (!slugCollision || opts.confirmSlugOverwrite === true);
    if (canPublish) {
      report.publish.result = await executePublish(platform, opts.fdraftRepoPath, plan);
    } else {
      report.publish.blockedReasons = plan.blocked.map((b) => JSON.stringify(b));
    }
  }

  return report;
}

export function assertClean(report: BuildReport, label: string): void {
  if (!report.validation.valid) throw new Error(`${label}: project does not validate (${report.validation.issueCount} issue(s)).`);
  console.log(`${label}: valid=${report.validation.valid}, designWarnings=${report.validation.warningCount}, .fdstudio=${report.fdstudioPath}, .fdtheme=${report.fdthemePath} (${report.compiledSizeBytes} bytes)`);
  if (report.publish.attempted) {
    if (report.publish.result) {
      console.log(`${label}: PUBLISHED — ${report.publish.result.changedPaths.join(", ")}`);
    } else {
      console.log(`${label}: publish BLOCKED (expected/documented) — ${JSON.stringify(report.publish.blockedReasons)}`);
    }
  }
}

export { getContainerLayers };
export type { ContainerRef, Layer };
