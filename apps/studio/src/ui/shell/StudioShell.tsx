import { useEffect, useMemo, useState } from "react";
import { ThemeRenderer, type HostSettings } from "@fdraft/theme-renderer";
import { useAppContext } from "../../AppContext.js";
import { useTutorial } from "../../tutorial/TutorialContext.js";
import { useProjectSessionState } from "../../project/useProjectSession.js";
import { isMissingPathError } from "../../project/projectSession.js";
import { createBlobAssetResolver } from "../../project/assetBlobResolver.js";
import { createStudioComponentAdapterRegistry, createStudioCopyContractRegistry } from "../../componentAdapters/studioAdapters.js";
import type { ContainerRef } from "../../editor/containerRef.js";
import { getContainerLayers } from "../../editor/containerRef.js";
import { flattenLayers } from "../../editor/layerTree.js";
import { clearSelection, pruneSelection, type Selection } from "../../editor/selection.js";
import { Canvas } from "../canvas/Canvas.js";
import { AssetWorkspace } from "../assets/AssetWorkspace.js";
import { BehaviourWorkspace } from "../behaviour/BehaviourWorkspace.js";
import { SimulateWorkspace } from "../simulation/SimulateWorkspace.js";
import { ValidationPanel } from "./ValidationPanel.js";
import { CopyReviewPanel } from "../copy/CopyReviewPanel.js";
import { DevPreviewPanel } from "../devPreview/DevPreviewPanel.js";
import { LinkFDraftRepositoryDialog } from "../publish/LinkFDraftRepositoryDialog.js";
import { PublishToFDraftPanel } from "../publish/PublishToFDraftPanel.js";
import { VIEWPORT_PROFILES } from "../viewportProfiles.js";
import { PerformanceInspectorPanel } from "./PerformanceInspectorPanel.js";
import { TopBar, type StudioMode } from "./TopBar.js";
import { LeftPanel, type ShellTarget } from "./LeftPanel.js";
import { RightPanel, rightPanelKey } from "./RightPanel.js";
import { StatusBar } from "./StatusBar.js";
import "./shell.css";

const componentAdapters = createStudioComponentAdapterRegistry();
const copyContracts = createStudioCopyContractRegistry();

function toContainerRef(target: ShellTarget | undefined): ContainerRef | undefined {
  if (!target) return undefined;
  if (target.kind === "page") return { kind: "page", id: target.pageId };
  if (target.kind === "popup") return { kind: "popup", id: target.popupId };
  return { kind: "master", id: target.masterId };
}

/** A master isn't itself a navigable surface, so Preview/Behaviour mode (unlike Design mode, which can edit a master's own layers directly) fall back to the project's first real page/popup instead of trying to "preview" one. */
function renderableTarget(target: ShellTarget | undefined, project: { pages: { id: string }[]; popups: { id: string }[] } | undefined): { kind: "page"; pageId: string } | { kind: "popup"; popupId: string } | undefined {
  if (target && target.kind !== "master") return target;
  if (project?.pages[0]) return { kind: "page", pageId: project.pages[0].id };
  if (project?.popups[0]) return { kind: "popup", popupId: project.popups[0].id };
  return undefined;
}

export function StudioShell(): React.ReactNode {
  const { platform, session } = useAppContext();
  const tutorial = useTutorial();
  const state = useProjectSessionState(session);
  const open = state.open;

  const [mode, setMode] = useState<StudioMode>("design");
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [validationOpen, setValidationOpen] = useState(false);
  const [performanceOpen, setPerformanceOpen] = useState(false);
  const [copyReviewOpen, setCopyReviewOpen] = useState(false);
  const [previewViewportIndex, setPreviewViewportIndex] = useState(0);
  const [devPreviewOpen, setDevPreviewOpen] = useState(false);
  const [linkFDraftOpen, setLinkFDraftOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishKey, setPublishKey] = useState(0);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [target, setTarget] = useState<ShellTarget | undefined>(undefined);
  const [rawSelection, setRawSelection] = useState<Selection>(clearSelection());

  const project = open?.project;
  const targetStillExists =
    !!target &&
    !!project &&
    (target.kind === "page"
      ? project.pages.some((p) => p.id === target.pageId)
      : target.kind === "popup"
        ? project.popups.some((p) => p.id === target.popupId)
        : project.masters.some((m) => m.id === target.masterId));
  const effectiveTarget: ShellTarget | undefined = targetStillExists
    ? target
    : project?.pages[0]
      ? { kind: "page", pageId: project.pages[0].id }
      : project?.popups[0]
        ? { kind: "popup", popupId: project.popups[0].id }
        : undefined;

  const containerRef = toContainerRef(effectiveTarget);
  const layers = useMemo(() => (project && containerRef ? getContainerLayers(project, containerRef) : []), [project, containerRef]);
  const flatById = useMemo(() => new Map(flattenLayers(layers).map((l) => [l.id, l] as const)), [layers]);
  // Derived, not effect-synced: a layer id that no longer exists after an edit (deleted, ungrouped away, switched to a
  // different page/popup entirely) is simply never in `layers`, so it drops out of the selection on the very next render.
  const selection = useMemo(() => pruneSelection(layers, rawSelection), [layers, rawSelection]);

  function handleSelectTarget(next: ShellTarget): void {
    setTarget(next);
    setRawSelection(clearSelection());
  }

  function handleValidationNavigate(next: ShellTarget, nextSelection: Selection): void {
    setTarget(next);
    setRawSelection(nextSelection);
    setMode("design");
    setValidationOpen(false);
  }

  function handleCopyReviewNavigate(next: ShellTarget, nextSelection: Selection): void {
    setTarget(next);
    setRawSelection(nextSelection);
    setMode("design");
    setCopyReviewOpen(false);
  }

  const resolver = useMemo(() => createBlobAssetResolver(open ?? null), [open]);
  useEffect(() => () => resolver.dispose(), [resolver]);

  const [hostSettings, setHostSettings] = useState<HostSettings>({ reducedMotion: false, performanceTier: "high" });

  async function handleSave(): Promise<void> {
    try {
      await session.save();
    } catch (error) {
      if (isMissingPathError(error)) {
        await handleSaveAs();
      } else {
        await platform.confirm(error instanceof Error ? error.message : String(error), { kind: "warning", title: "Save failed" });
      }
    }
  }

  async function handleSaveAs(): Promise<void> {
    const path = await platform.saveFile({ title: "Save Project As", defaultPath: project?.metadata.name ? `${project.metadata.name}.fdstudio` : undefined, filters: [{ name: "FDraft Studio Project", extensions: ["fdstudio"] }] });
    if (!path) return;
    await session.saveAs(path, "file");
  }

  async function handleClose(): Promise<void> {
    await session.close(async () => platform.confirm("This project has unsaved changes. Close without saving?", { kind: "warning", title: "Unsaved changes" }));
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape" && focusMode) {
        event.preventDefault();
        setFocusMode(false);
        return;
      }
      const meta = event.metaKey || event.ctrlKey;
      if (!meta) return;
      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (event.shiftKey) void handleSaveAs();
        else void handleSave();
      } else if (event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) session.redo();
        else session.undo();
      } else if (event.key.toLowerCase() === "y") {
        event.preventDefault();
        session.redo();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- session/platform/project identity is stable per open project
  }, [open, focusMode]);

  if (!project) return null;

  const previewableTarget = renderableTarget(effectiveTarget, project);

  if (mode === "preview") {
    const previewViewport = VIEWPORT_PROFILES[previewViewportIndex]!;
    function cycleViewport(direction: -1 | 1): void {
      setPreviewViewportIndex((i) => (i + direction + VIEWPORT_PROFILES.length) % VIEWPORT_PROFILES.length);
    }
    return (
      <div className="shell shell-preview">
        {/* A plain div, not <header> — this is a minimal exit affordance, not the page's banner landmark (the real one is Design/Behaviour mode's TopBar, entirely absent here). No editor overlay, selection marker, or mock control lives inside `shell-center-preview` below — everything interactive stays up here in the bar. */}
        <div className="preview-bar">
          <span>{project.metadata.name} — Preview</span>
          <div className="preview-viewport-cycler" role="group" aria-label="Viewport profile">
            <button type="button" onClick={() => cycleViewport(-1)} aria-label="Previous viewport profile">
              ‹
            </button>
            <span>
              {previewViewport.label} ({previewViewport.widthPx}px)
            </span>
            <button type="button" onClick={() => cycleViewport(1)} aria-label="Next viewport profile">
              ›
            </button>
          </div>
          <button type="button" onClick={() => setMode("design")}>
            Exit Preview
          </button>
        </div>
        <main className="shell-center shell-center-preview">
          {previewableTarget ? (
            <div className="preview-viewport-frame" style={{ width: previewViewport.widthPx }}>
              <ThemeRenderer
                document={project}
                assetResolver={resolver}
                componentAdapters={componentAdapters}
                copyContracts={copyContracts}
                target={previewableTarget}
                hostSettings={hostSettings}
              />
            </div>
          ) : (
            <p className="shell-empty">This project has no pages or popups yet.</p>
          )}
        </main>
      </div>
    );
  }

  const centerContent =
    mode === "design" && containerRef ? (
      <Canvas
        project={project}
        containerRef={containerRef}
        resolver={resolver}
        componentAdapters={componentAdapters}
        copyContracts={copyContracts}
        hostSettings={hostSettings}
        applyCommand={(command) => session.applyCommand(command)}
        selection={selection}
        onSelectionChange={setRawSelection}
        onZoomChange={setZoomPercent}
      />
    ) : previewableTarget ? (
      <div className="shell-stage-wrapper">
        <div className="shell-stage-scaler" style={{ transform: `scale(${zoomPercent / 100})` }}>
          <ThemeRenderer
            document={project}
            assetResolver={resolver}
            componentAdapters={componentAdapters}
            copyContracts={copyContracts}
            target={previewableTarget}
            hostSettings={hostSettings}
          />
        </div>
      </div>
    ) : (
      <p className="shell-empty">This project has no pages or popups yet.</p>
    );

  if (focusMode) {
    return (
      <div className="shell shell-focus">
        <main className="shell-center shell-center-focus">{centerContent}</main>
        <button type="button" className="focus-exit" onClick={() => setFocusMode(false)} aria-label="Exit distraction-free canvas mode">
          Exit Focus Mode (Esc)
        </button>
      </div>
    );
  }

  return (
    <div className="shell">
      <TopBar
        projectName={project.metadata.name}
        dirty={state.dirty}
        mode={mode}
        onModeChange={setMode}
        canUndo={state.canUndo}
        canRedo={state.canRedo}
        undoLabel={state.undoLabel}
        redoLabel={state.redoLabel}
        onUndo={() => session.undo()}
        onRedo={() => session.redo()}
        onSave={() => void handleSave()}
        onSaveAs={() => void handleSaveAs()}
        onClose={() => void handleClose()}
        onToggleLeftPanel={() => setLeftCollapsed((v) => !v)}
        onToggleRightPanel={() => setRightCollapsed((v) => !v)}
        leftPanelCollapsed={leftCollapsed}
        rightPanelCollapsed={rightCollapsed}
        onEnterFocusMode={() => setFocusMode(true)}
        onOpenValidation={() => setValidationOpen(true)}
        onOpenPerformance={() => setPerformanceOpen(true)}
        onOpenCopyReview={() => setCopyReviewOpen(true)}
        onOpenDevPreview={() => setDevPreviewOpen(true)}
        onOpenLinkFDraft={() => setLinkFDraftOpen(true)}
        onOpenPublishToFDraft={() => setPublishOpen(true)}
        onOpenTutorial={() => tutorial.open()}
      />
      <div className="shell-body">
        {mode === "assets" ? (
          <AssetWorkspace resolver={resolver} />
        ) : mode === "behaviour" ? (
          <BehaviourWorkspace resolver={resolver} componentAdapters={componentAdapters} copyContracts={copyContracts} />
        ) : mode === "simulate" ? (
          <SimulateWorkspace resolver={resolver} componentAdapters={componentAdapters} copyContracts={copyContracts} />
        ) : (
          <>
            {!leftCollapsed && (
              <LeftPanel
                pages={project.pages}
                popups={project.popups}
                masters={project.masters}
                target={effectiveTarget}
                onSelectTarget={handleSelectTarget}
                project={project}
                containerRef={containerRef}
                layers={layers}
                selection={selection}
                onSelectionChange={setRawSelection}
                applyCommand={(command) => session.applyCommand(command)}
              />
            )}
            <main className="shell-center">
              <div className="shell-mode-label">Design Mode</div>
              {centerContent}
            </main>
            {!rightCollapsed && (
              <RightPanel
                key={rightPanelKey(project.metadata)}
                metadata={project.metadata}
                onEditMetadata={(patch) => session.editMetadata(patch)}
                project={project}
                containerRef={containerRef}
                flatById={flatById}
                selection={selection}
                onSelectionChange={setRawSelection}
                applyCommand={(command) => session.applyCommand(command)}
                copyContracts={copyContracts}
              />
            )}
          </>
        )}
      </div>
      <StatusBar dirty={state.dirty} lastSavedAt={open?.lastSavedAt} zoomPercent={zoomPercent} onZoomChange={setZoomPercent} zoomControlsOwnedElsewhere={mode === "design"} hostSettings={hostSettings} onHostSettingsChange={setHostSettings} />
      {validationOpen && <ValidationPanel project={project} onClose={() => setValidationOpen(false)} onNavigate={handleValidationNavigate} />}
      {performanceOpen && <PerformanceInspectorPanel project={project} onClose={() => setPerformanceOpen(false)} />}
      {copyReviewOpen && (
        <CopyReviewPanel
          project={project}
          copyContracts={copyContracts}
          resolver={resolver}
          componentAdapters={componentAdapters}
          onClose={() => setCopyReviewOpen(false)}
          onNavigate={handleCopyReviewNavigate}
        />
      )}
      {devPreviewOpen && <DevPreviewPanel onClose={() => setDevPreviewOpen(false)} />}
      {linkFDraftOpen && (
        <LinkFDraftRepositoryDialog
          onClose={() => setLinkFDraftOpen(false)}
          onLinkChanged={() => setPublishKey((k) => k + 1)}
        />
      )}
      {publishOpen && (
        <PublishToFDraftPanel
          key={publishKey}
          onClose={() => setPublishOpen(false)}
          onLinkRepository={() => {
            setPublishOpen(false);
            setLinkFDraftOpen(true);
          }}
        />
      )}
    </div>
  );
}
