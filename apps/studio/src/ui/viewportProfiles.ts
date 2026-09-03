/**
 * A fixed, Studio-defined set of preview widths — independent of a theme's
 * own author-configurable `BreakpointToken[]` (`minWidthPx` values that can
 * be anything). Nothing in this codebase had a canonical "preview at N
 * sizes" list before this; Copy Review and Preview mode's viewport cycler
 * both share this one definition so they can never quietly disagree about
 * what "Desktop"/"Laptop"/"Mobile" means.
 */
export interface ViewportProfile {
  id: string;
  label: string;
  widthPx: number;
  heightPx: number;
}

export const VIEWPORT_PROFILES: ViewportProfile[] = [
  { id: "desktop", label: "Desktop", widthPx: 1920, heightPx: 1080 },
  { id: "laptop", label: "Laptop", widthPx: 1366, heightPx: 768 },
  { id: "mobile", label: "Mobile", widthPx: 390, heightPx: 844 },
];
