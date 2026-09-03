/**
 * Real overflow detection — the standard `scrollWidth`/`scrollHeight` vs.
 * `clientWidth`/`clientHeight` comparison, applied to a genuinely rendered
 * element in an actual layout engine. Deliberately not a character-count
 * or measured-canvas-text heuristic: those can't account for wrapping,
 * font metrics, or a component adapter's own internal padding/line-height,
 * so they'd either miss real clipping or flag text that actually fits.
 *
 * jsdom has no real layout engine (every element reports 0 for these), so
 * this function is only ever meaningful against a real browser — Copy
 * Review's "Scan for clipped text" action runs it inside Studio's actual
 * Tauri webview, and it's proven in this repo's headless-Chromium
 * verification pass, not a unit test.
 */
export function hasTextOverflow(el: Element): boolean {
  return el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
}
