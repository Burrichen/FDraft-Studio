/** path (as declared in the document's own AssetRecord.path) -> data: URL. */
export type FixtureAssetMap = Record<string, string>;

export interface FixtureScenario {
  id: string;
  label: string;
  description: string;
  /** Which SDK validator the app should run against `raw` — the app does this itself, live, in the browser. */
  kind: "project" | "theme";
  /** Unvalidated JSON exactly as loaded — some scenarios are deliberately invalid. */
  raw: unknown;
  assets: FixtureAssetMap;
}
