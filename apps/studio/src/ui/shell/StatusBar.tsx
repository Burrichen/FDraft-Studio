import type { HostSettings } from "@fdraft/theme-renderer";

export interface StatusBarProps {
  dirty: boolean;
  lastSavedAt: number | undefined;
  zoomPercent: number;
  onZoomChange: (percent: number) => void;
  /** Design mode's Canvas has its own zoom toolbar with real pan/zoom — this just displays its live value there instead of offering a second, disconnected control. */
  zoomControlsOwnedElsewhere?: boolean;
  hostSettings: HostSettings;
  onHostSettingsChange: (next: HostSettings) => void;
}

/**
 * A real, always-visible way to preview reduced-motion and each
 * performance tier against the actual page/preview — not just Behaviour
 * Mode's own separate simulator, which exists for testing rules against
 * arbitrary event state rather than for a general accessibility/
 * performance preview.
 */
export function StatusBar({ dirty, lastSavedAt, zoomPercent, onZoomChange, zoomControlsOwnedElsewhere, hostSettings, onHostSettingsChange }: StatusBarProps): React.ReactNode {
  return (
    <footer className="status-bar" role="status">
      <span>{dirty ? "Unsaved changes" : lastSavedAt ? `Saved ${new Date(lastSavedAt).toLocaleTimeString()}` : "Never saved"}</span>
      <div className="status-host-settings">
        <label className="checkbox-field">
          <input type="checkbox" checked={hostSettings.reducedMotion} onChange={(e) => onHostSettingsChange({ ...hostSettings, reducedMotion: e.target.checked })} />
          Preview reduced motion
        </label>
        <label>
          Performance tier
          <select aria-label="Performance tier" value={hostSettings.performanceTier} onChange={(e) => onHostSettingsChange({ ...hostSettings, performanceTier: e.target.value as HostSettings["performanceTier"] })}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>
      </div>
      <div className="status-zoom">
        {!zoomControlsOwnedElsewhere && (
          <button type="button" onClick={() => onZoomChange(Math.max(25, zoomPercent - 25))} aria-label="Zoom out">
            −
          </button>
        )}
        <span>{zoomPercent}%</span>
        {!zoomControlsOwnedElsewhere && (
          <button type="button" onClick={() => onZoomChange(Math.min(400, zoomPercent + 25))} aria-label="Zoom in">
            +
          </button>
        )}
      </div>
    </footer>
  );
}
