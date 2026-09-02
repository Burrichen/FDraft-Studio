import type { Id, StudioProjectDocument } from "@fdraft/theme-sdk";
import { resolveMasterChain } from "@fdraft/theme-renderer";
import type { Command } from "../../history/commandStack.js";
import { flattenLayers } from "../../editor/layerTree.js";
import { buildDetachFromMasterCommand, setContainerMaster, setMasterLayerOverride } from "../../project/containerCommands.js";

export interface MasterInheritancePanelProps {
  project: StudioProjectDocument;
  containerKind: "page" | "popup";
  containerId: Id;
  masterId: Id | undefined;
  masterLayerOverrides: Record<Id, { visible?: boolean; opacity?: number }> | undefined;
  applyCommand: (command: Command<StudioProjectDocument>) => void;
}

/**
 * Master assignment plus per-layer override editing for the page/popup
 * currently being edited — "identify the override" is just the presence
 * of a `masterLayerOverrides` entry, "reset to inherited" removes it, and
 * "detach safely" materialises everything currently inherited as this
 * container's own layers (see `buildDetachFromMasterCommand`'s doc
 * comment) rather than leaving it silently still linked.
 */
export function MasterInheritancePanel({ project, containerKind, containerId, masterId, masterLayerOverrides, applyCommand }: MasterInheritancePanelProps): React.ReactNode {
  const chain = masterId ? resolveMasterChain(project.masters, masterId) : [];
  const inheritedLayers = flattenLayers(chain.flatMap((m) => m.layers));

  return (
    <div className="master-panel">
      <h2>Master</h2>
      <label className="field">
        Inherits from
        <select value={masterId ?? ""} onChange={(e) => applyCommand2(setContainerMaster(project, containerKind, containerId, e.target.value || undefined))}>
          <option value="">None</option>
          {project.masters.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>

      {masterId && (
        <>
          <p className="master-panel-hint">{inheritedLayers.length} inherited layer{inheritedLayers.length === 1 ? "" : "s"}. Overrides here affect only this page/popup.</p>
          <ul className="master-layer-list">
            {inheritedLayers.map((layer) => {
              const override = masterLayerOverrides?.[layer.id];
              const effectiveVisible = override?.visible ?? layer.visible;
              return (
                <li key={layer.id} className="master-layer-row">
                  <span className="master-layer-name">{layer.name}</span>
                  {override && <span className="master-layer-overridden-badge">Overridden</span>}
                  <label className="master-layer-visible">
                    <input
                      type="checkbox"
                      checked={effectiveVisible}
                      onChange={(e) => applyCommand2(setMasterLayerOverride(project, containerKind, containerId, layer.id, { ...override, visible: e.target.checked }))}
                    />
                    Visible
                  </label>
                  <button type="button" disabled={!override} onClick={() => applyCommand2(setMasterLayerOverride(project, containerKind, containerId, layer.id, undefined))}>
                    Reset
                  </button>
                </li>
              );
            })}
          </ul>

          <button type="button" onClick={() => applyCommand2(buildDetachFromMasterCommand(project, containerKind, containerId))}>
            Detach from master
          </button>
        </>
      )}
    </div>
  );

  function applyCommand2(command: Command<StudioProjectDocument> | null): void {
    if (command) applyCommand(command);
  }
}
