export type StudioMode = "design" | "assets" | "behaviour" | "simulate" | "preview";

export interface TopBarProps {
  projectName: string;
  dirty: boolean;
  mode: StudioMode;
  onModeChange: (mode: StudioMode) => void;
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: string | undefined;
  redoLabel: string | undefined;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onClose: () => void;
  onToggleLeftPanel: () => void;
  onToggleRightPanel: () => void;
  leftPanelCollapsed: boolean;
  rightPanelCollapsed: boolean;
  onEnterFocusMode: () => void;
  onOpenValidation: () => void;
  onOpenPerformance: () => void;
  onOpenCopyReview: () => void;
  onOpenDevPreview: () => void;
  onOpenLinkFDraft: () => void;
  onOpenPublishToFDraft: () => void;
  onOpenTutorial: () => void;
}

const MODES: { id: StudioMode; label: string }[] = [
  { id: "design", label: "Design" },
  { id: "assets", label: "Assets" },
  { id: "behaviour", label: "Behaviour" },
  { id: "simulate", label: "Simulate" },
  { id: "preview", label: "Preview" },
];

/** The full editor command bar. In Preview mode, `StudioShell` doesn't render this at all — a dedicated minimal preview bar takes its place — so no editor control ever leaks into Preview mode. */
export function TopBar(props: TopBarProps): React.ReactNode {
  return (
    <header className="top-bar" role="banner">
      <div className="top-bar-group">
        <button type="button" onClick={props.onToggleLeftPanel} aria-pressed={!props.leftPanelCollapsed} aria-label="Toggle Pages and Layers panel">
          ☰
        </button>
        <span className="top-bar-title">
          {props.projectName}
          {props.dirty && <span aria-label="Unsaved changes"> •</span>}
        </span>
      </div>

      <nav className="top-bar-modes" aria-label="Editor mode">
        {MODES.map((m) => (
          <button key={m.id} type="button" aria-pressed={props.mode === m.id} onClick={() => props.onModeChange(m.id)}>
            {m.label}
          </button>
        ))}
      </nav>

      <div className="top-bar-group">
        <button type="button" onClick={props.onUndo} disabled={!props.canUndo} title={props.undoLabel ? `Undo ${props.undoLabel}` : undefined} aria-label="Undo">
          ↺ Undo
        </button>
        <button type="button" onClick={props.onRedo} disabled={!props.canRedo} title={props.redoLabel ? `Redo ${props.redoLabel}` : undefined} aria-label="Redo">
          ↻ Redo
        </button>
        <button type="button" onClick={props.onSave} aria-label="Save">
          Save
        </button>
        <button type="button" onClick={props.onSaveAs} aria-label="Save As">
          Save As…
        </button>
        <button type="button" onClick={props.onToggleRightPanel} aria-pressed={!props.rightPanelCollapsed} aria-label="Toggle Properties panel">
          ▤
        </button>
        <button type="button" onClick={props.onEnterFocusMode} aria-label="Enter distraction-free canvas mode" title="Distraction-free canvas — hides all panels and chrome, canvas stays fully editable (unlike Preview)">
          ⛶
        </button>
        <button type="button" onClick={props.onOpenValidation} aria-label="Open validation panel">
          Validate
        </button>
        <button type="button" onClick={props.onOpenCopyReview} aria-label="Open copy review">
          Copy review
        </button>
        <button type="button" onClick={props.onOpenPerformance} aria-label="Open performance inspector">
          Performance
        </button>
        <button type="button" onClick={props.onOpenDevPreview} aria-label="Preview in FDraft" title="Development-only: connect to a local FDraft dev server">
          Preview in FDraft
        </button>
        <button type="button" onClick={props.onOpenLinkFDraft} aria-label="Link FDraft Repository">
          Link FDraft Repo
        </button>
        <button type="button" onClick={props.onOpenPublishToFDraft} aria-label="Publish to FDraft">
          Publish to FDraft
        </button>
        <button type="button" onClick={props.onClose} aria-label="Close project">
          Close
        </button>
      </div>

      <nav className="top-bar-group" aria-label="Help">
        <button type="button" onClick={props.onOpenTutorial} aria-label="Help menu — open tutorial">
          Help
        </button>
      </nav>
    </header>
  );
}
