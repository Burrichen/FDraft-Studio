import { useMemo, useState } from "react";
import { ThemeRenderer, createSampleComponentAdapterRegistry, createSampleCopyContractRegistry, type HostSettings, type RenderState } from "@fdraft/theme-renderer";
// @ts-expect-error -- virtual module supplied by ./plugins/fdraftFixturesPlugin.ts, no ambient types
import { scenarios } from "virtual:fdraft-fixtures";
import type { FixtureScenario } from "./fixtures/types.js";
import { runPreflight, type PreflightResult } from "./preflight.js";
import { buildAssetResolver } from "./assetResolver.js";
import "./app.css";

const typedScenarios = scenarios as FixtureScenario[];

const VIEWPORT_PRESETS = [
  { label: "Mobile (375px)", widthPx: 375 },
  { label: "Tablet (768px)", widthPx: 768 },
  { label: "Desktop (1440px)", widthPx: 1440 },
];

const componentAdapters = createSampleComponentAdapterRegistry();
const copyContracts = createSampleCopyContractRegistry();

type Target = { kind: "page" | "popup"; id: string };

/** Pure presentational: renders whatever a resolved `preflight` says to, at one viewport width. Never touches state — every input is a prop. */
function ScenarioStage({
  preflight,
  target,
  scenarioAssets,
  viewportWidthPx,
  hostSettings,
  renderState,
}: {
  preflight: PreflightResult;
  target: Target | null;
  scenarioAssets: FixtureScenario["assets"];
  viewportWidthPx: number;
  hostSettings: HostSettings;
  renderState: RenderState;
}) {
  if (preflight.status === "invalid") {
    return (
      <div className="issue-panel" role="alert">
        <strong>
          This theme could not be rendered ({preflight.issues.length} issue{preflight.issues.length === 1 ? "" : "s"}):
        </strong>
        <ul>
          {preflight.issues.map((issue, i) => (
            <li key={i}>
              <code>{issue.code}</code>
              {issue.path ? (
                <>
                  {" "}
                  at <code>{issue.path}</code>
                </>
              ) : null}
              : {issue.message}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (!target) {
    return <div className="issue-panel">This theme has no pages or popups to render.</div>;
  }

  const { document } = preflight;
  const resolver = buildAssetResolver(document.assets, scenarioAssets);

  return (
    <div className="viewport-frame" style={{ width: viewportWidthPx }}>
      <div className="viewport-label">{viewportWidthPx}px</div>
      <ThemeRenderer
        document={document}
        assetResolver={resolver}
        componentAdapters={componentAdapters}
        copyContracts={copyContracts}
        target={target.kind === "page" ? { kind: "page", pageId: target.id } : { kind: "popup", popupId: target.id }}
        hostSettings={hostSettings}
        renderState={renderState}
        viewportWidthPx={viewportWidthPx}
      />
    </div>
  );
}

export function App() {
  const [scenarioId, setScenarioId] = useState(typedScenarios[0]?.id ?? "");
  const [viewportWidthPx, setViewportWidthPx] = useState(1440);
  const [compareViewports, setCompareViewports] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [performanceTier, setPerformanceTier] = useState<"low" | "high">("high");
  const [requestedTarget, setRequestedTarget] = useState<Target | null>(null);
  const [activeStatesByGroup, setActiveStatesByGroup] = useState<Record<string, string>>({});

  const scenario = typedScenarios.find((s) => s.id === scenarioId) ?? typedScenarios[0];
  const preflight = useMemo(() => (scenario ? runPreflight(scenario) : null), [scenario]);

  const pages = preflight?.status === "valid" ? preflight.document.pages.map((p) => ({ id: p.id, name: p.name })) : [];
  const popups = preflight?.status === "valid" ? preflight.document.popups.map((p) => ({ id: p.id, name: p.name })) : [];
  const imageStateGroups = preflight?.status === "valid" ? preflight.document.imageStateGroups : [];

  // Derived, not stateful: falls back to the first available page/popup
  // whenever the requested target doesn't belong to the current document
  // (e.g. right after switching scenarios) instead of needing an effect.
  const target: Target | null =
    requestedTarget && (pages.some((p) => p.id === requestedTarget.id) || popups.some((p) => p.id === requestedTarget.id))
      ? requestedTarget
      : pages[0]
        ? { kind: "page", id: pages[0].id }
        : popups[0]
          ? { kind: "popup", id: popups[0].id }
          : null;

  const hostSettings: HostSettings = { reducedMotion, performanceTier };
  const renderState: RenderState = { activeImageStates: activeStatesByGroup };

  if (!scenario || !preflight) {
    return <p>No fixtures loaded.</p>;
  }

  return (
    <div className="lab">
      <aside className="sidebar">
        <h1>Renderer Fixture Lab</h1>
        <p className="subtitle">Proves @fdraft/theme-renderer independently of Studio and FDraft.</p>

        <section>
          <h2>Scenario</h2>
          <select
            value={scenario.id}
            onChange={(event) => {
              setScenarioId(event.target.value);
              setRequestedTarget(null);
              setActiveStatesByGroup({});
            }}
          >
            {typedScenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <p className="description">{scenario.description}</p>
        </section>

        {(pages.length > 0 || popups.length > 0) && (
          <section>
            <h2>Page / popup</h2>
            {pages.map((p) => (
              <label key={p.id} className="radio-row">
                <input type="radio" checked={target?.kind === "page" && target.id === p.id} onChange={() => setRequestedTarget({ kind: "page", id: p.id })} />
                Page: {p.name}
              </label>
            ))}
            {popups.map((p) => (
              <label key={p.id} className="radio-row">
                <input type="radio" checked={target?.kind === "popup" && target.id === p.id} onChange={() => setRequestedTarget({ kind: "popup", id: p.id })} />
                Popup: {p.name}
              </label>
            ))}
          </section>
        )}

        <section>
          <h2>Viewport</h2>
          {VIEWPORT_PRESETS.map((preset) => (
            <label key={preset.widthPx} className="radio-row">
              <input type="radio" checked={viewportWidthPx === preset.widthPx} onChange={() => setViewportWidthPx(preset.widthPx)} />
              {preset.label}
            </label>
          ))}
          <label className="radio-row">
            <input type="checkbox" checked={compareViewports} onChange={(event) => setCompareViewports(event.target.checked)} />
            Compare mobile vs. desktop side by side
          </label>
        </section>

        <section>
          <h2>Host settings</h2>
          <label className="radio-row">
            <input type="checkbox" checked={reducedMotion} onChange={(event) => setReducedMotion(event.target.checked)} />
            Reduced motion
          </label>
          <label className="radio-row">
            <input type="checkbox" checked={performanceTier === "low"} onChange={(event) => setPerformanceTier(event.target.checked ? "low" : "high")} />
            Low performance tier (skips effect layers)
          </label>
        </section>

        {imageStateGroups.length > 0 && (
          <section>
            <h2>Mock image state</h2>
            {imageStateGroups.map((group) => (
              <label key={group.id} className="radio-row">
                {group.name}:
                <select
                  value={activeStatesByGroup[group.id] ?? group.defaultStateId}
                  onChange={(event) => setActiveStatesByGroup((prev) => ({ ...prev, [group.id]: event.target.value }))}
                >
                  {group.states.map((state) => (
                    <option key={state.id} value={state.id}>
                      {state.name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </section>
        )}
      </aside>

      <main className="stage-area">
        {compareViewports ? (
          <div className="compare-row">
            <ScenarioStage preflight={preflight} target={target} scenarioAssets={scenario.assets} viewportWidthPx={375} hostSettings={hostSettings} renderState={renderState} />
            <ScenarioStage preflight={preflight} target={target} scenarioAssets={scenario.assets} viewportWidthPx={1440} hostSettings={hostSettings} renderState={renderState} />
          </div>
        ) : (
          <ScenarioStage preflight={preflight} target={target} scenarioAssets={scenario.assets} viewportWidthPx={viewportWidthPx} hostSettings={hostSettings} renderState={renderState} />
        )}
      </main>
    </div>
  );
}
