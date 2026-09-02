import { useState } from "react";
import type { Layer, ProjectMetadata, StudioProjectDocument } from "@fdraft/theme-sdk";
import type { ComponentCopyContractRegistry } from "@fdraft/theme-renderer";
import type { Command } from "../../history/commandStack.js";
import type { ContainerRef } from "../../editor/containerRef.js";
import type { Selection } from "../../editor/selection.js";
import { PropertiesPanel } from "../properties/PropertiesPanel.js";
import { MasterInheritancePanel } from "./MasterInheritancePanel.js";

export interface RightPanelProps {
  metadata: ProjectMetadata;
  onEditMetadata: (patch: Partial<Pick<ProjectMetadata, "name" | "description">>) => void;
  project: StudioProjectDocument;
  containerRef: ContainerRef | undefined;
  flatById: Map<string, Layer>;
  selection: Selection;
  onSelectionChange: (selection: Selection) => void;
  applyCommand: (command: Command<StudioProjectDocument>) => void;
  copyContracts: ComponentCopyContractRegistry;
}

/**
 * Placeholder Properties panel — project metadata editing is real;
 * per-layer property editing is a later phase.
 *
 * Local draft state only ever needs to reset when `metadata` changes for
 * a reason *other* than this panel's own edit (e.g. undo/redo). Rather
 * than an effect resyncing state (which the React team recommends
 * against — see https://react.dev/learn/you-might-not-need-an-effect),
 * the caller keys this component by the metadata it's showing so React
 * remounts it — and reinitialises local state — exactly when that
 * content actually changes.
 */
export function RightPanel({ metadata, onEditMetadata, project, containerRef, flatById, selection, onSelectionChange, applyCommand, copyContracts }: RightPanelProps): React.ReactNode {
  const [name, setName] = useState(metadata.name);
  const [description, setDescription] = useState(metadata.description ?? "");

  return (
    <aside className="right-panel" aria-label="Properties">
      <h2>Project</h2>
      <label className="field">
        Name
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            if (name.trim() && name !== metadata.name) onEditMetadata({ name: name.trim() });
          }}
        />
      </label>
      <label className="field">
        Description
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => {
            if (description !== (metadata.description ?? "")) onEditMetadata({ description });
          }}
        />
      </label>

      {containerRef && (containerRef.kind === "page" || containerRef.kind === "popup") && (
        <MasterInheritancePanel
          project={project}
          containerKind={containerRef.kind}
          containerId={containerRef.id}
          masterId={(containerRef.kind === "page" ? project.pages : project.popups).find((c) => c.id === containerRef.id)?.masterId}
          masterLayerOverrides={(containerRef.kind === "page" ? project.pages : project.popups).find((c) => c.id === containerRef.id)?.masterLayerOverrides}
          applyCommand={applyCommand}
        />
      )}

      <h2>Layer properties</h2>
      {containerRef ? (
        <PropertiesPanel project={project} containerRef={containerRef} flatById={flatById} selection={selection} onSelectionChange={onSelectionChange} applyCommand={applyCommand} copyContracts={copyContracts} />
      ) : (
        <p className="right-panel-placeholder">Select a page or popup first.</p>
      )}
    </aside>
  );
}

/** The key `StudioShell` should render this component with — see the class doc comment above. */
export function rightPanelKey(metadata: ProjectMetadata): string {
  return `${metadata.id}:${metadata.name}:${metadata.description ?? ""}`;
}
