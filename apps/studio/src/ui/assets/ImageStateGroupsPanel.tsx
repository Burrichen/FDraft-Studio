import { useState } from "react";
import type { AssetResolver } from "@fdraft/theme-renderer";
import type { Id, StudioProjectDocument } from "@fdraft/theme-sdk";
import type { Command } from "../../history/commandStack.js";
import { buildAddImageStateCommand, buildAddImageStateGroupCommand, buildDeleteImageStateCommand, renameImageStateGroup, setImageStateAsset, setImageStateGroupDefault } from "../../assets/assetCommands.js";

export interface ImageStateGroupsPanelProps {
  project: StudioProjectDocument;
  applyCommand: (command: Command<StudioProjectDocument>) => void;
  resolver: AssetResolver;
}

/**
 * A compact editor for named visual states (e.g. "Candy Bowl": full/75/35/
 * empty) — each state's own id is stable once created (renaming the state
 * or changing which asset it points at never touches that id), which is
 * what lets Behaviour Mode's conditions reference a specific state safely.
 */
export function ImageStateGroupsPanel({ project, applyCommand, resolver }: ImageStateGroupsPanelProps): React.ReactNode {
  const [expandedId, setExpandedId] = useState<Id | undefined>(undefined);
  const [newGroupName, setNewGroupName] = useState("");

  function handleAddGroup(): void {
    const name = newGroupName.trim();
    const firstAsset = project.assets.find((a) => a.kind === "image" || a.kind === "svg");
    if (!name || !firstAsset) return;
    const cmd = buildAddImageStateGroupCommand(name, [{ name: "default", assetId: firstAsset.id }]);
    if (cmd) {
      applyCommand(cmd);
      setNewGroupName("");
    }
  }

  return (
    <div className="image-state-groups">
      <h2>Image state groups</h2>
      <ul className="image-state-group-list">
        {project.imageStateGroups.map((group) => (
          <li key={group.id}>
            <button type="button" className="image-state-group-toggle" onClick={() => setExpandedId(expandedId === group.id ? undefined : group.id)} aria-expanded={expandedId === group.id}>
              {group.name} ({group.states.length})
            </button>
            {expandedId === group.id && (
              <div className="image-state-group-detail">
                <input
                  type="text"
                  defaultValue={group.name}
                  aria-label={`Rename ${group.name}`}
                  onBlur={(e) => {
                    const cmd = renameImageStateGroup(project, group.id, e.target.value.trim() || group.name);
                    if (cmd) applyCommand(cmd);
                  }}
                />
                {group.states.map((state) => (
                  <div key={state.id} className="image-state-row">
                    <span className="asset-thumb asset-thumb-small">{resolver.resolveAsset(state.assetId) ? <img src={resolver.resolveAsset(state.assetId)} alt="" /> : <span className="asset-thumb-icon">?</span>}</span>
                    <span className="image-state-name">{state.name}</span>
                    <select value={state.assetId} onChange={(e) => { const cmd = setImageStateAsset(project, group.id, state.id, e.target.value); if (cmd) applyCommand(cmd); }}>
                      {project.assets
                        .filter((a) => a.kind === "image" || a.kind === "svg")
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name ?? a.originalFileName ?? a.id}
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      aria-pressed={group.defaultStateId === state.id}
                      title="Default state"
                      onClick={() => { const cmd = setImageStateGroupDefault(project, group.id, state.id); if (cmd) applyCommand(cmd); }}
                    >
                      {group.defaultStateId === state.id ? "★" : "☆"}
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove state ${state.name}`}
                      disabled={group.states.length <= 1 || group.defaultStateId === state.id}
                      onClick={() => { const cmd = buildDeleteImageStateCommand(project, group.id, state.id); if (cmd) applyCommand(cmd); }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <AddStateRow project={project} groupId={group.id} applyCommand={applyCommand} />
              </div>
            )}
          </li>
        ))}
        {project.imageStateGroups.length === 0 && <li className="left-panel-empty">No image state groups yet</li>}
      </ul>
      <div className="field-row">
        <input type="text" placeholder="New group name" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} aria-label="New image state group name" />
        <button type="button" onClick={handleAddGroup} disabled={!project.assets.some((a) => a.kind === "image" || a.kind === "svg")}>
          Add
        </button>
      </div>
    </div>
  );
}

function AddStateRow({ project, groupId, applyCommand }: { project: StudioProjectDocument; groupId: Id; applyCommand: (command: Command<StudioProjectDocument>) => void }): React.ReactNode {
  const [name, setName] = useState("");
  const imageAssets = project.assets.filter((a) => a.kind === "image" || a.kind === "svg");
  const [assetId, setAssetId] = useState(imageAssets[0]?.id ?? "");

  return (
    <div className="image-state-row">
      <input type="text" placeholder="State name (e.g. 75)" value={name} onChange={(e) => setName(e.target.value)} aria-label="New state name" />
      <select value={assetId} onChange={(e) => setAssetId(e.target.value)} aria-label="New state asset">
        {imageAssets.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name ?? a.originalFileName ?? a.id}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={!name.trim() || !assetId}
        onClick={() => {
          const cmd = buildAddImageStateCommand(project, groupId, name.trim(), assetId);
          if (cmd) {
            applyCommand(cmd);
            setName("");
          }
        }}
      >
        + Add state
      </button>
    </div>
  );
}
