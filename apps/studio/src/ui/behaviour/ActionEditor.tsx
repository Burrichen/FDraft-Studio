import type { BehaviourAction, ComponentLayer, StudioProjectDocument } from "@fdraft/theme-sdk";
import { listAllLayers, listAllAnimations } from "../../behaviour/behaviourCommands.js";

export interface ActionEditorProps {
  action: BehaviourAction;
  onChange: (next: BehaviourAction) => void;
  onRemove: () => void;
  project: StudioProjectDocument;
}

const ACTION_TYPES: BehaviourAction["type"][] = [
  "show",
  "hide",
  "setEnabled",
  "setImageState",
  "applyStyleOverride",
  "startAnimation",
  "stopAnimation",
  "restartAnimation",
  "openPopup",
  "closePopup",
  "navigateToPage",
  "selectCopyVariant",
];

function defaultAction(type: BehaviourAction["type"], project: StudioProjectDocument): BehaviourAction {
  const layerId = listAllLayers(project)[0]?.id ?? "";
  const animationId = listAllAnimations(project)[0]?.id ?? "";
  const stateGroup = project.imageStateGroups[0];
  const componentRequirement = project.componentRequirements[0];
  switch (type) {
    case "show":
      return { type, layerId };
    case "hide":
      return { type, layerId };
    case "setEnabled":
      return { type, layerId, enabled: false };
    case "setImageState":
      return { type, stateGroupId: stateGroup?.id ?? "", stateId: stateGroup?.states[0]?.id ?? "" };
    case "applyStyleOverride":
      return { type, layerId, componentRequirementId: componentRequirement?.id ?? "", property: componentRequirement?.allowedProperties[0] ?? "color", value: "" };
    case "startAnimation":
    case "stopAnimation":
    case "restartAnimation":
      return { type, animationId };
    case "openPopup":
    case "closePopup":
      return { type, popupId: project.popups[0]?.id ?? "" };
    case "navigateToPage":
      return { type, pageId: project.pages[0]?.id ?? "" };
    case "selectCopyVariant":
      return { type, layerId, slotKey: "", variantId: "" };
  }
}

/** One row editing a single closed `BehaviourAction` shape — the dropdown's options are exactly the schema's discriminated union members, so nothing this control produces can ever be an arbitrary/unsafe action. */
export function ActionEditor({ action, onChange, onRemove, project }: ActionEditorProps): React.ReactNode {
  const layers = listAllLayers(project);
  const animations = listAllAnimations(project);
  const componentLayers = layers.filter((l): l is ComponentLayer => l.type === "component");
  const selectedComponentLayer = action.type === "selectCopyVariant" ? componentLayers.find((l) => l.id === action.layerId) : undefined;

  return (
    <div className="action-editor-row">
      <select aria-label="Action type" value={action.type} onChange={(e) => onChange(defaultAction(e.target.value as BehaviourAction["type"], project))}>
        {ACTION_TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>

      {(action.type === "show" || action.type === "hide") && (
        <select aria-label="Layer" value={action.layerId} onChange={(e) => onChange({ ...action, layerId: e.target.value })}>
          {layers.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      )}

      {action.type === "setEnabled" && (
        <>
          <select aria-label="Layer" value={action.layerId} onChange={(e) => onChange({ ...action, layerId: e.target.value })}>
            {layers.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <label>
            <input type="checkbox" checked={action.enabled} onChange={(e) => onChange({ ...action, enabled: e.target.checked })} /> enabled
          </label>
        </>
      )}

      {action.type === "setImageState" && (
        <>
          <select aria-label="Image state group" value={action.stateGroupId} onChange={(e) => onChange({ ...action, stateGroupId: e.target.value, stateId: project.imageStateGroups.find((g) => g.id === e.target.value)?.states[0]?.id ?? "" })}>
            {project.imageStateGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <select aria-label="Image state" value={action.stateId} onChange={(e) => onChange({ ...action, stateId: e.target.value })}>
            {(project.imageStateGroups.find((g) => g.id === action.stateGroupId)?.states ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </>
      )}

      {action.type === "applyStyleOverride" && (
        <>
          <select aria-label="Layer" value={action.layerId} onChange={(e) => onChange({ ...action, layerId: e.target.value })}>
            {layers.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <select aria-label="Component requirement" value={action.componentRequirementId} onChange={(e) => onChange({ ...action, componentRequirementId: e.target.value })}>
            {project.componentRequirements.map((r) => (
              <option key={r.id} value={r.id}>
                {r.componentKey}
              </option>
            ))}
          </select>
          <select aria-label="Style property" value={action.property} onChange={(e) => onChange({ ...action, property: e.target.value as typeof action.property })}>
            {(project.componentRequirements.find((r) => r.id === action.componentRequirementId)?.allowedProperties ?? []).map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <input aria-label="Value" value={String(action.value)} onChange={(e) => onChange({ ...action, value: e.target.value })} />
        </>
      )}

      {(action.type === "startAnimation" || action.type === "stopAnimation" || action.type === "restartAnimation") && (
        <select aria-label="Animation" value={action.animationId} onChange={(e) => onChange({ ...action, animationId: e.target.value })}>
          {animations.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      )}

      {(action.type === "openPopup" || action.type === "closePopup") && (
        <select aria-label="Popup" value={action.popupId} onChange={(e) => onChange({ ...action, popupId: e.target.value })}>
          {project.popups.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      )}

      {action.type === "navigateToPage" && (
        <select aria-label="Page" value={action.pageId} onChange={(e) => onChange({ ...action, pageId: e.target.value })}>
          {project.pages.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      )}

      {action.type === "selectCopyVariant" && (
        <>
          <select aria-label="Component layer" value={action.layerId} onChange={(e) => onChange({ ...action, layerId: e.target.value, slotKey: "", variantId: "" })}>
            {componentLayers.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <select aria-label="Copy slot" value={action.slotKey} onChange={(e) => onChange({ ...action, slotKey: e.target.value, variantId: "" })}>
            {Object.keys(selectedComponentLayer?.copyVariants ?? {}).map((slotKey) => (
              <option key={slotKey} value={slotKey}>
                {slotKey}
              </option>
            ))}
          </select>
          <select aria-label="Copy variant" value={action.variantId} onChange={(e) => onChange({ ...action, variantId: e.target.value })}>
            {(selectedComponentLayer?.copyVariants?.[action.slotKey] ?? []).map((v) => (
              <option key={v.id} value={v.id}>
                {v.text}
              </option>
            ))}
          </select>
        </>
      )}

      <button type="button" onClick={onRemove}>
        Remove action
      </button>
    </div>
  );
}
