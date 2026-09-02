import { RUNTIME_VARIABLE_VALUE_TYPE } from "@fdraft/theme-sdk";
import type { Condition, ComparisonOperator, RuntimeVariable, StudioProjectDocument } from "@fdraft/theme-sdk";
import { listAllLayers } from "../../behaviour/behaviourCommands.js";

export interface ConditionEditorProps {
  condition: Condition;
  onChange: (next: Condition) => void;
  project: StudioProjectDocument;
  depth?: number;
}

type LeafKind = "always" | "eventPhase" | "stateEquals" | "compare" | "inRange" | "boolean";
type NodeKind = LeafKind | "and" | "or";

const VARIABLE_KINDS: RuntimeVariable["kind"][] = [
  "eventStatus",
  "eventActive",
  "eventAvailable",
  "optedIn",
  "currentPageId",
  "currentPopupId",
  "draftGenerated",
  "progressPercent",
  "watchedCount",
  "targetCount",
  "eventCompleted",
  "performanceTier",
  "reducedMotion",
  "interactionFlag",
  "imageState",
  "dateTime",
];

function defaultVariable(kind: RuntimeVariable["kind"], project: StudioProjectDocument): RuntimeVariable {
  // A rule's condition has no ambient "current layer" the way a per-layer InteractionState would — it must name one explicitly.
  if (kind === "interactionFlag") return { kind, which: "hover", layerId: listAllLayers(project)[0]?.id ?? "" };
  if (kind === "imageState") return { kind, stateGroupId: project.imageStateGroups[0]?.id ?? "" };
  if (kind === "dateTime") return { kind, key: "now" };
  return { kind } as RuntimeVariable;
}

function defaultCondition(kind: NodeKind, project: StudioProjectDocument): Condition {
  switch (kind) {
    case "always":
      return { type: "always" };
    case "eventPhase":
      return { type: "eventPhase", phase: "active" };
    case "stateEquals": {
      const group = project.imageStateGroups[0];
      return { type: "stateEquals", stateGroupId: group?.id ?? "", stateId: group?.states[0]?.id ?? "" };
    }
    case "compare":
      return { type: "compare", variable: { kind: "progressPercent" }, operator: "gte", value: 0 };
    case "inRange":
      return { type: "inRange", variable: { kind: "progressPercent" }, min: 0, max: 100 };
    case "boolean":
      return { type: "boolean", variable: { kind: "optedIn" }, equals: true };
    case "and":
      return { type: "and", conditions: [{ type: "always" }] };
    case "or":
      return { type: "or", conditions: [{ type: "always" }] };
  }
}

function VariableEditor({ variable, project, onChange }: { variable: RuntimeVariable; project: StudioProjectDocument; onChange: (v: RuntimeVariable) => void }): React.ReactNode {
  return (
    <>
      <select aria-label="Variable" value={variable.kind} onChange={(e) => onChange(defaultVariable(e.target.value as RuntimeVariable["kind"], project))}>
        {VARIABLE_KINDS.map((k) => (
          <option key={k} value={k}>
            {k}
          </option>
        ))}
      </select>
      {variable.kind === "interactionFlag" && (
        <>
          <select aria-label="Interaction flag" value={variable.which} onChange={(e) => onChange({ ...variable, which: e.target.value as typeof variable.which })}>
            <option value="hover">hover</option>
            <option value="focus">focus</option>
            <option value="pressed">pressed</option>
            <option value="selected">selected</option>
          </select>
          <select aria-label="Interaction flag layer" value={variable.layerId ?? ""} onChange={(e) => onChange({ ...variable, layerId: e.target.value })}>
            {listAllLayers(project).length === 0 && <option value="">No layers</option>}
            {listAllLayers(project).map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </>
      )}
      {variable.kind === "imageState" && (
        <select aria-label="Image state group" value={variable.stateGroupId} onChange={(e) => onChange({ kind: "imageState", stateGroupId: e.target.value })}>
          {project.imageStateGroups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      )}
      {variable.kind === "dateTime" && <input aria-label="Date/time key" value={variable.key} onChange={(e) => onChange({ kind: "dateTime", key: e.target.value })} />}
    </>
  );
}

const NUMERIC_OPERATORS: ComparisonOperator[] = ["eq", "neq", "gt", "gte", "lt", "lte"];
const NON_NUMERIC_OPERATORS: ComparisonOperator[] = ["eq", "neq"];

/**
 * A recursive editor for the SDK's closed `Condition` tree — every branch
 * maps to exactly one schema-valid shape, so there is no way to author
 * anything this control can't also represent (no free-text expression
 * field anywhere). `not` is represented as a "Negate" checkbox on every
 * node rather than its own selectable kind, so wrapping/unwrapping a
 * negation never requires rebuilding the node underneath it.
 */
export function ConditionEditor({ condition, onChange, project, depth = 0 }: ConditionEditorProps): React.ReactNode {
  const negated = condition.type === "not";
  const inner = negated ? condition.condition : condition;
  const setInner = (next: Condition) => onChange(negated ? { type: "not", condition: next } : next);
  const toggleNegate = (checked: boolean) => onChange(checked ? { type: "not", condition: inner } : inner);

  const kind = inner.type as NodeKind;
  const valueType = inner.type === "compare" || inner.type === "inRange" || inner.type === "boolean" ? RUNTIME_VARIABLE_VALUE_TYPE[inner.variable.kind] : undefined;

  return (
    <div className="condition-editor" style={{ marginLeft: depth * 16 }}>
      <div className="condition-editor-row">
        <select aria-label={depth === 0 ? "Condition type" : "Nested condition type"} value={kind} onChange={(e) => setInner(defaultCondition(e.target.value as NodeKind, project))}>
          <option value="always">always</option>
          <option value="eventPhase">event status equals</option>
          <option value="stateEquals">image state equals</option>
          <option value="compare">compare</option>
          <option value="inRange">is between (inclusive)</option>
          <option value="boolean">is true/false</option>
          <option value="and">all of (AND)</option>
          <option value="or">any of (OR)</option>
        </select>
        <label className="condition-editor-negate">
          <input type="checkbox" checked={negated} onChange={(e) => toggleNegate(e.target.checked)} /> Negate
        </label>
      </div>

      {inner.type === "eventPhase" && <input aria-label="Event status" value={inner.phase} onChange={(e) => setInner({ type: "eventPhase", phase: e.target.value })} />}

      {inner.type === "stateEquals" && (
        <>
          <select aria-label="Image state group" value={inner.stateGroupId} onChange={(e) => setInner({ type: "stateEquals", stateGroupId: e.target.value, stateId: project.imageStateGroups.find((g) => g.id === e.target.value)?.states[0]?.id ?? "" })}>
            {project.imageStateGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <select aria-label="Image state" value={inner.stateId} onChange={(e) => setInner({ type: "stateEquals", stateGroupId: inner.stateGroupId, stateId: e.target.value })}>
            {(project.imageStateGroups.find((g) => g.id === inner.stateGroupId)?.states ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </>
      )}

      {inner.type === "compare" && (
        <>
          <VariableEditor variable={inner.variable} project={project} onChange={(variable) => setInner({ type: "compare", variable, operator: "eq", value: RUNTIME_VARIABLE_VALUE_TYPE[variable.kind] === "number" ? 0 : RUNTIME_VARIABLE_VALUE_TYPE[variable.kind] === "boolean" ? true : "" })} />
          <select aria-label="Operator" value={inner.operator} onChange={(e) => setInner({ ...inner, operator: e.target.value as ComparisonOperator })}>
            {(valueType === "number" ? NUMERIC_OPERATORS : NON_NUMERIC_OPERATORS).map((op) => (
              <option key={op} value={op}>
                {op}
              </option>
            ))}
          </select>
          {valueType === "boolean" ? (
            <input aria-label="Value" type="checkbox" checked={inner.value === true} onChange={(e) => setInner({ ...inner, value: e.target.checked })} />
          ) : valueType === "number" ? (
            <input aria-label="Value" type="number" value={Number(inner.value)} onChange={(e) => setInner({ ...inner, value: Number(e.target.value) })} />
          ) : (
            <input aria-label="Value" value={String(inner.value)} onChange={(e) => setInner({ ...inner, value: e.target.value })} />
          )}
        </>
      )}

      {inner.type === "inRange" && (
        <>
          <VariableEditor variable={inner.variable} project={project} onChange={(variable) => setInner({ type: "inRange", variable, min: inner.min, max: inner.max })} />
          <input aria-label="Minimum" type="number" value={inner.min} onChange={(e) => setInner({ ...inner, min: Number(e.target.value) })} />
          <input aria-label="Maximum" type="number" value={inner.max} onChange={(e) => setInner({ ...inner, max: Number(e.target.value) })} />
        </>
      )}

      {inner.type === "boolean" && (
        <>
          <VariableEditor variable={inner.variable} project={project} onChange={(variable) => setInner({ type: "boolean", variable, equals: inner.equals })} />
          <label>
            <input type="checkbox" checked={inner.equals} onChange={(e) => setInner({ ...inner, equals: e.target.checked })} /> is true
          </label>
        </>
      )}

      {(inner.type === "and" || inner.type === "or") && (
        <div className="condition-editor-group">
          {inner.conditions.map((child, i) => (
            <div key={i} className="condition-editor-group-item">
              <ConditionEditor
                condition={child}
                project={project}
                depth={depth + 1}
                onChange={(next) => setInner({ ...inner, conditions: inner.conditions.map((c, j) => (j === i ? next : c)) } as Condition)}
              />
              <button
                type="button"
                onClick={() => {
                  const remaining = inner.conditions.filter((_, j) => j !== i);
                  setInner(remaining.length === 0 ? { type: "always" } : ({ ...inner, conditions: remaining } as Condition));
                }}
              >
                Remove condition
              </button>
            </div>
          ))}
          <button type="button" onClick={() => setInner({ ...inner, conditions: [...inner.conditions, { type: "always" }] } as Condition)}>
            + Add condition
          </button>
        </div>
      )}
    </div>
  );
}
