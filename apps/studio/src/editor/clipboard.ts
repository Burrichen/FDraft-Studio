import type { Layer } from "@fdraft/theme-sdk";

/**
 * A single desktop-app-wide clipboard for layers, deliberately not
 * per-component state — copy/cut in one panel and paste from another (or
 * after switching pages) must see the same content, exactly like the
 * system clipboard it stands in for.
 */
let clipboard: Layer[] | null = null;

export function setClipboardLayers(layers: Layer[]): void {
  clipboard = layers;
}

export function getClipboardLayers(): Layer[] | null {
  return clipboard;
}
