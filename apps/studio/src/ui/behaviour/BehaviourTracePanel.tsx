import { useState } from "react";
import type { BehaviourResolution } from "@fdraft/theme-renderer";
import { describeTargetKey, type BehaviourNameLookups } from "../../behaviour/describeBehaviourRule.js";

export interface BehaviourTracePanelProps {
  resolution: BehaviourResolution;
  lookups: BehaviourNameLookups;
}

/**
 * Renders `BehaviourResolution.trace` — which rule won each contested
 * target for the current render state, and why. Extracted out of
 * `BehaviourWorkspace` so the Simulate workspace can show the exact same
 * "why is this what it is" panel for whatever scenario is active, without
 * a second, drifting implementation.
 */
export function BehaviourTracePanel({ resolution, lookups }: BehaviourTracePanelProps): React.ReactNode {
  const [showTrace, setShowTrace] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setShowTrace((v) => !v)}>
        {showTrace ? "Hide trace" : "Show trace"}
      </button>
      {showTrace && (
        <div className="behaviour-trace" role="region" aria-label="Behaviour rule trace">
          {resolution.trace.length === 0 && <p className="behaviour-empty">No continuous rules are contesting anything right now.</p>}
          {resolution.trace.map((entry) => (
            <div key={entry.targetKey} className="behaviour-trace-entry">
              <strong>{describeTargetKey(entry.targetKey, lookups)}</strong>
              <ul>
                {entry.candidates.map((c) => (
                  <li key={c.ruleId} className={c.ruleId === entry.winningRuleId ? "behaviour-trace-winner" : undefined}>
                    {c.ruleId === entry.winningRuleId ? "✓ " : "· "}
                    {c.ruleName} (priority {c.priority}) — {!c.enabled ? "disabled" : c.conditionMet ? "condition true" : "condition false"}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
