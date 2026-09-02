import { useState } from "react";
import type { Layer, MasterPage, Page, Popup, StudioProjectDocument } from "@fdraft/theme-sdk";
import type { Command } from "../../history/commandStack.js";
import type { ContainerRef } from "../../editor/containerRef.js";
import type { Selection } from "../../editor/selection.js";
import {
  buildAddMasterCommand,
  buildAddPageCommand,
  buildAddPopupCommand,
  buildDeleteMasterCommand,
  buildDeletePageCommand,
  buildDeletePopupCommand,
  buildDuplicatePageCommand,
  buildDuplicatePopupCommand,
  findMasterDependents,
  renameMaster,
  renamePage,
  renamePopup,
} from "../../project/containerCommands.js";
import { useAppContext } from "../../AppContext.js";
import { LayersPanel } from "../layers/LayersPanel.js";

export type ShellTarget = { kind: "page"; pageId: string } | { kind: "popup"; popupId: string } | { kind: "master"; masterId: string };

export interface LeftPanelProps {
  pages: Page[];
  popups: Popup[];
  masters: MasterPage[];
  target: ShellTarget | undefined;
  onSelectTarget: (target: ShellTarget) => void;
  project: StudioProjectDocument;
  containerRef: ContainerRef | undefined;
  layers: Layer[];
  selection: Selection;
  onSelectionChange: (selection: Selection) => void;
  applyCommand: (command: Command<StudioProjectDocument>) => void;
}

export function LeftPanel({ pages, popups, masters, target, onSelectTarget, project, containerRef, layers, selection, onSelectionChange, applyCommand }: LeftPanelProps): React.ReactNode {
  const { platform } = useAppContext();
  const [editingId, setEditingId] = useState<string | undefined>(undefined);

  async function handleDeleteMaster(masterId: string, name: string): Promise<void> {
    const dependents = findMasterDependents(project, masterId);
    if (dependents.length > 0) {
      await platform.confirm(`"${name}" is still used by ${dependents.length} page/popup/master (${dependents.map((d) => d.name).join(", ")}). Detach or reassign them first.`, { kind: "warning", title: "Cannot delete master" });
      return;
    }
    const ok = await platform.confirm(`Delete master "${name}"? This cannot be undone from here once you close the project.`, { kind: "warning", title: "Delete master" });
    if (!ok) return;
    const cmd = buildDeleteMasterCommand(project, masterId);
    if (cmd) applyCommand(cmd);
  }

  return (
    <nav className="left-panel" aria-label="Pages and layers">
      <div className="left-panel-section-header">
        <h2>Pages</h2>
        <button type="button" className="left-panel-add" aria-label="Add page" onClick={() => applyCommand(buildAddPageCommand(project, "New Page"))}>
          +
        </button>
      </div>
      <ul>
        {pages.map((page) => (
          <EditableListItem
            key={page.id}
            id={page.id}
            name={page.name}
            icon="▤"
            active={target?.kind === "page" && target.pageId === page.id}
            editing={editingId === page.id}
            onSelect={() => onSelectTarget({ kind: "page", pageId: page.id })}
            onStartRename={() => setEditingId(page.id)}
            onCommitRename={(name) => {
              const cmd = renamePage(project, page.id, name);
              if (cmd) applyCommand(cmd);
              setEditingId(undefined);
            }}
            onDuplicate={() => {
              const cmd = buildDuplicatePageCommand(project, page.id);
              if (cmd) applyCommand(cmd);
            }}
            onDelete={async () => {
              const ok = await platform.confirm(`Delete page "${page.name}"?`, { kind: "warning", title: "Delete page" });
              if (!ok) return;
              const cmd = buildDeletePageCommand(project, page.id);
              if (cmd) applyCommand(cmd);
            }}
          />
        ))}
        {pages.length === 0 && <li className="left-panel-empty">No pages yet</li>}
      </ul>

      <div className="left-panel-section-header">
        <h2>Popups</h2>
        <button type="button" className="left-panel-add" aria-label="Add popup" onClick={() => applyCommand(buildAddPopupCommand("New Popup"))}>
          +
        </button>
      </div>
      <ul>
        {popups.map((popup) => (
          <EditableListItem
            key={popup.id}
            id={popup.id}
            name={popup.name}
            icon="⧉"
            active={target?.kind === "popup" && target.popupId === popup.id}
            editing={editingId === popup.id}
            onSelect={() => onSelectTarget({ kind: "popup", popupId: popup.id })}
            onStartRename={() => setEditingId(popup.id)}
            onCommitRename={(name) => {
              const cmd = renamePopup(project, popup.id, name);
              if (cmd) applyCommand(cmd);
              setEditingId(undefined);
            }}
            onDuplicate={() => {
              const cmd = buildDuplicatePopupCommand(project, popup.id);
              if (cmd) applyCommand(cmd);
            }}
            onDelete={async () => {
              const ok = await platform.confirm(`Delete popup "${popup.name}"?`, { kind: "warning", title: "Delete popup" });
              if (!ok) return;
              const cmd = buildDeletePopupCommand(project, popup.id);
              if (cmd) applyCommand(cmd);
            }}
          />
        ))}
        {popups.length === 0 && <li className="left-panel-empty">No popups yet</li>}
      </ul>

      <div className="left-panel-section-header">
        <h2>Masters</h2>
        <button type="button" className="left-panel-add" aria-label="Add master" onClick={() => applyCommand(buildAddMasterCommand("New Master"))}>
          +
        </button>
      </div>
      <ul>
        {masters.map((master) => (
          <EditableListItem
            key={master.id}
            id={master.id}
            name={master.name}
            icon="▦"
            active={target?.kind === "master" && target.masterId === master.id}
            editing={editingId === master.id}
            onSelect={() => onSelectTarget({ kind: "master", masterId: master.id })}
            onStartRename={() => setEditingId(master.id)}
            onCommitRename={(name) => {
              const cmd = renameMaster(project, master.id, name);
              if (cmd) applyCommand(cmd);
              setEditingId(undefined);
            }}
            onDelete={() => void handleDeleteMaster(master.id, master.name)}
          />
        ))}
        {masters.length === 0 && <li className="left-panel-empty">No masters yet</li>}
      </ul>

      <h2>Layers</h2>
      {containerRef ? (
        <LayersPanel project={project} containerRef={containerRef} layers={layers} selection={selection} onSelectionChange={onSelectionChange} applyCommand={applyCommand} />
      ) : (
        <p className="left-panel-placeholder">Select a page, popup, or master to see its layers.</p>
      )}
    </nav>
  );
}

function EditableListItem({
  name,
  icon,
  active,
  editing,
  onSelect,
  onStartRename,
  onCommitRename,
  onDuplicate,
  onDelete,
}: {
  id: string;
  name: string;
  icon: string;
  active: boolean;
  editing: boolean;
  onSelect: () => void;
  onStartRename: () => void;
  onCommitRename: (name: string) => void;
  onDuplicate?: () => void;
  onDelete: () => void;
}): React.ReactNode {
  const [draft, setDraft] = useState(name);

  if (editing) {
    return (
      <li className="left-panel-row">
        <input
          type="text"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => onCommitRename(draft.trim() || name)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") onCommitRename(name);
          }}
          aria-label={`Rename ${name}`}
        />
      </li>
    );
  }

  return (
    <li className="left-panel-row">
      <button type="button" className="left-panel-select" aria-pressed={active} onClick={onSelect} onDoubleClick={onStartRename}>
        <span className="left-panel-icon" aria-hidden="true">
          {icon}
        </span>
        {name}
      </button>
      <button type="button" className="left-panel-row-action" aria-label={`Rename ${name}`} onClick={onStartRename}>
        ✎
      </button>
      {onDuplicate && (
        <button type="button" className="left-panel-row-action" aria-label={`Duplicate ${name}`} onClick={onDuplicate}>
          ⧉
        </button>
      )}
      <button type="button" className="left-panel-row-action" aria-label={`Delete ${name}`} onClick={onDelete}>
        ✕
      </button>
    </li>
  );
}
