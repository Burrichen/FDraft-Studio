import { useMemo, useState } from "react";
import type { StudioProjectDocument } from "@fdraft/theme-sdk";
import { PERFORMANCE_TIER_CAPS } from "@fdraft/theme-renderer";
import { analyzePerformance } from "../../performance/performanceInspector.js";

export interface PerformanceInspectorPanelProps {
  project: StudioProjectDocument;
  onClose: () => void;
}

const TIER_LABEL: Record<"low" | "medium" | "high", string> = { low: "Low", medium: "Medium", high: "High" };

/**
 * Approximate, structural counts only — never a measured frame rate, a
 * hardware benchmark, or a promise about how this will actually perform
 * on any given device. Every particle count shown is already the real,
 * tier-capped number the renderer would draw (see
 * `PERFORMANCE_TIER_CAPS`), not a raw, unbounded value a theme could ask
 * for.
 */
export function PerformanceInspectorPanel({ project, onClose }: PerformanceInspectorPanelProps): React.ReactNode {
  const [tier, setTier] = useState<"low" | "medium" | "high">("high");
  const report = useMemo(() => analyzePerformance(project, tier), [project, tier]);
  const caps = PERFORMANCE_TIER_CAPS[tier];

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Performance inspector">
      <div className="modal">
        <div className="modal-header">
          <h2>Performance inspector</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <p className="field-hint">
          Approximate counts only — not a measured frame rate or a hardware benchmark. These numbers already reflect the fixed, documented caps for the tier you pick below, so a heavy theme can never silently exceed them.
        </p>

        <label className="field">
          Preview tier
          <select aria-label="Preview tier" value={tier} onChange={(e) => setTier(e.target.value as "low" | "medium" | "high")}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>

        <dl className="performance-summary">
          <div>
            <dt>Total layers</dt>
            <dd>{report.totalLayers}</dd>
          </div>
          <div>
            <dt>Animated layers</dt>
            <dd>
              {report.animatedLayerIds.size} ({report.animations.length} animation{report.animations.length === 1 ? "" : "s"})
            </dd>
          </div>
          <div>
            <dt>Effect layers</dt>
            <dd>
              {report.effectLayers.length} / {caps.maxEffectLayers} allowed at {TIER_LABEL[tier]}
            </dd>
          </div>
          <div>
            <dt>Large assets (≥ 2 MB)</dt>
            <dd>{report.largeAssets.length}</dd>
          </div>
        </dl>

        {!caps.animationsEnabled && <p className="validation-empty">Animations and effects are fully disabled at the Low tier — every layer renders in its resting/final state.</p>}

        <h3>Effect layers</h3>
        {report.effectLayers.length === 0 ? (
          <p className="validation-empty">None in this project.</p>
        ) : (
          <ul className="validation-list">
            {report.effectLayers.map((e) => (
              <li key={e.layerId} className="validation-row">
                <span className="validation-message">
                  {e.containerLabel} — &quot;{e.name}&quot; ({e.kind}), intensity {e.intensity} → ~{e.approxParticleCount} particles at {TIER_LABEL[tier]}
                </span>
              </li>
            ))}
          </ul>
        )}
        {report.effectLayersOverCap && <p className="validation-row validation-severity-warning">More effect layers are placed than the {TIER_LABEL[tier]} tier renders at once — extras beyond the cap render nothing, in declaration order.</p>}

        {report.largeAssets.length > 0 && (
          <>
            <h3>Large assets</h3>
            <ul className="validation-list">
              {report.largeAssets.map((a) => (
                <li key={a.assetId} className="validation-row">
                  <span className="validation-message">
                    {a.name} — {(a.sizeBytes / (1024 * 1024)).toFixed(1)} MB
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        <h3>Warnings ({report.designWarnings.length})</h3>
        {report.designWarnings.length === 0 ? (
          <p className="validation-empty">None found.</p>
        ) : (
          <ul className="validation-list">
            {report.designWarnings.map((w, i) => (
              <li key={i} className="validation-row">
                <span className="validation-severity validation-severity-warning">Warning</span>
                <span className="validation-message">{w.message}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
